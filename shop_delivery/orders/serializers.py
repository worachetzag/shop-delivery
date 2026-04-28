from collections import Counter

from django.db import transaction
from django.db.models import F
from rest_framework import serializers
from decimal import Decimal
from .delivery_pricing import fee_for_distance_km, haversine_distance_km, quantize_distance_km
from .store_location import get_delivery_origin_lat_lng
from .models import Order, OrderItem, DriverAssignment
from products.models import Product
from accounts.models import Customer, CustomerAddress


def _format_delivery_address_from_saved(addr: CustomerAddress) -> str:
    """รวมข้อความที่อยู่จัดส่งจาก CustomerAddress สำหรับบันทึกใน Order.delivery_address"""
    lines = []
    main = (addr.address_line or '').strip()
    if main:
        lines.append(main)
    tail = ' '.join(
        p.strip()
        for p in (addr.district, addr.province, addr.postal_code)
        if p and str(p).strip()
    )
    if tail:
        lines.append(tail)
    return '\n'.join(lines)


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price', 'total_price']
        read_only_fields = ['total_price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_slip_status_display = serializers.CharField(source='get_payment_slip_status_display', read_only=True)
    payment_slip_url = serializers.SerializerMethodField()
    driver_assignment = serializers.SerializerMethodField()
    
    class Meta:
        model = Order
        fields = ['id', 'order_number', 'customer', 'customer_name', 'order_type', 'order_type_display',
                 'payment_method', 'payment_method_display', 'status', 'status_display',
                 'delivery_address', 'delivery_phone', 'delivery_notes',
                 'delivery_distance',
                 'subtotal', 'delivery_fee', 'total_amount', 'items',
                 'payment_slip_status', 'payment_slip_status_display', 'payment_slip_url',
                 'payment_slip_uploaded_at', 'payment_verified_at',
                 'driver_assignment',
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'subtotal', 'total_amount', 'delivery_fee']

    def get_payment_slip_url(self, obj):
        request = self.context.get('request')
        if not obj.payment_slip:
            return None
        if request:
            return request.build_absolute_uri(obj.payment_slip.url)
        return obj.payment_slip.url

    def get_driver_assignment(self, obj):
        assignment = getattr(obj, 'driver_assignment', None)
        if not assignment:
            return None
        return {
            'id': assignment.id,
            'driver_id': assignment.driver_id,
            'driver_name': assignment.driver.get_full_name() or assignment.driver.username,
            'status': assignment.status,
            'status_display': assignment.get_status_display(),
            'current_location_text': assignment.current_location_text,
            'current_latitude': assignment.current_latitude,
            'current_longitude': assignment.current_longitude,
            'last_location_at': assignment.last_location_at,
        }


class OrderCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True)
    # เลือกที่อยู่จากที่บันทึกไว้ (GET /api/accounts/addresses/) — ไม่ต้องส่ง delivery_address ซ้ำ
    customer_address_id = serializers.IntegerField(
        required=False, allow_null=True, write_only=True,
    )
    # ระยะจากแผนที่ฝั่งลูกค้า (กม.) — ใช้เมื่อไม่คำนวณจากพิกัดร้าน
    delivery_distance = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, allow_null=True,
    )
    # พิกัดปลายทาง — ใช้เมื่อ settings ตั้ง DELIVERY_ORIGIN_LATITUDE/LONGITUDE
    delivery_latitude = serializers.DecimalField(
        max_digits=18, decimal_places=15, required=False, allow_null=True, write_only=True,
    )
    delivery_longitude = serializers.DecimalField(
        max_digits=18, decimal_places=15, required=False, allow_null=True, write_only=True,
    )

    class Meta:
        model = Order
        fields = [
            'order_type', 'payment_method', 'delivery_address',
            'delivery_phone', 'delivery_notes', 'items',
            'customer_address_id',
            'delivery_distance', 'delivery_latitude', 'delivery_longitude',
        ]
        extra_kwargs = {
            # อนุญาตว่างชั่วคราว — ถ้ามี customer_address_id จะเติมใน validate
            'delivery_address': {'required': False, 'allow_blank': True},
            'delivery_phone': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        order_type = data.get('order_type')
        if order_type == 'pickup':
            data['delivery_distance'] = None
            return data

        ca_id = data.get('customer_address_id')
        if ca_id is not None:
            request = self.context.get('request')
            if not request or not getattr(request.user, 'is_authenticated', False):
                raise serializers.ValidationError({
                    'customer_address_id': 'ต้องเข้าสู่ระบบเพื่อเลือกที่อยู่ที่บันทึกไว้',
                })
            customer_obj = Customer.objects.filter(user=request.user).first()
            if not customer_obj:
                raise serializers.ValidationError({
                    'customer_address_id': 'ไม่พบข้อมูลลูกค้า',
                })
            try:
                ca = CustomerAddress.objects.get(pk=ca_id, customer=customer_obj)
            except CustomerAddress.DoesNotExist:
                raise serializers.ValidationError({
                    'customer_address_id': 'ไม่พบที่อยู่นี้หรือไม่ใช่ของคุณ',
                })
            formatted = _format_delivery_address_from_saved(ca).strip()
            if not formatted:
                raise serializers.ValidationError({
                    'customer_address_id': 'ที่อยู่ที่เลือกยังไม่มีรายละเอียดที่อยู่',
                })
            data['delivery_address'] = formatted
            phone_from_ca = (ca.phone_number or '').strip()
            if phone_from_ca:
                data['delivery_phone'] = phone_from_ca
            elif not (data.get('delivery_phone') or '').strip():
                data['delivery_phone'] = (customer_obj.phone_number or '').strip()
            if ca.latitude is not None and ca.longitude is not None:
                data['delivery_latitude'] = ca.latitude
                data['delivery_longitude'] = ca.longitude

        addr = (data.get('delivery_address') or '').strip()
        if not addr:
            raise serializers.ValidationError({
                'delivery_address': (
                    'กรุณาระบุที่อยู่จัดส่ง หรือส่ง customer_address_id '
                    'เพื่อเลือกจากที่อยู่ที่บันทึกไว้'
                ),
            })

        o_lat, o_lng = get_delivery_origin_lat_lng()
        lat = data.get('delivery_latitude')
        lng = data.get('delivery_longitude')

        if o_lat is not None and o_lng is not None and lat is not None and lng is not None:
            km = haversine_distance_km(
                float(o_lat), float(o_lng),
                float(lat), float(lng),
            )
            data['delivery_distance'] = quantize_distance_km(km)
        elif data.get('delivery_distance') is None:
            raise serializers.ValidationError({
                'delivery_distance': (
                    'จำเป็นสำหรับการจัดส่ง: ส่งระยะทาง (กม.) จากแผนที่ '
                    'หรือส่ง delivery_latitude / delivery_longitude เมื่อตั้งพิกัดร้านในระบบแล้ว'
                ),
            })
        else:
            if float(data['delivery_distance']) < 0:
                raise serializers.ValidationError({
                    'delivery_distance': 'ระยะทางต้องไม่ติดลบ',
                })

        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        validated_data.pop('customer_address_id', None)
        subtotal = Decimal('0')
        for item_data in items_data:
            product = Product.objects.get(id=item_data['product_id'])
            quantity = item_data['quantity']
            price = product.price
            subtotal += price * quantity

        order_type = validated_data['order_type']
        if order_type == 'pickup':
            delivery_distance = None
            delivery_fee = Decimal('0')
        else:
            delivery_distance = validated_data.get('delivery_distance')
            delivery_fee = fee_for_distance_km(delivery_distance)

        total_amount = subtotal + delivery_fee

        # รวมจำนวนต่อสินค้า (กรณีหลายบรรทัดเป็นสินค้าเดียวกัน)
        need_by_product = Counter()
        for item_data in items_data:
            need_by_product[item_data['product_id']] += int(item_data['quantity'])

        with transaction.atomic():
            # ล็อกสต็อกและตรวจว่าพอ — หักด้วย .update(F(...)) ไม่ผ่าน API แอดมิน จึงไม่ถูกบันทึกในประวัติพนักงาน
            for pid, need in need_by_product.items():
                product = Product.objects.select_for_update().get(id=pid)
                if not product.is_available:
                    raise serializers.ValidationError({
                        'items': f'สินค้า "{product.name}" ไม่พร้อมขาย',
                    })
                if product.stock_quantity < need:
                    raise serializers.ValidationError({
                        'items': (
                            f'สินค้า "{product.name}" คงเหลือไม่พอ '
                            f'(ต้องการ {need} {product.unit_label or "หน่วย"} มี {product.stock_quantity})'
                        ),
                    })

            order = Order.objects.create(
                **validated_data,
                subtotal=subtotal,
                delivery_fee=delivery_fee,
                total_amount=total_amount,
                payment_slip_status='not_required' if validated_data.get('payment_method') == 'cod' else 'pending',
            )

            for item_data in items_data:
                product = Product.objects.get(id=item_data['product_id'])
                quantity = item_data['quantity']
                price = product.price
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    quantity=quantity,
                    price=price,
                )

            for pid, need in need_by_product.items():
                n = Product.objects.filter(pk=pid, stock_quantity__gte=need).update(
                    stock_quantity=F('stock_quantity') - need
                )
                if n != 1:
                    raise serializers.ValidationError({'items': 'สต็อกสินค้าไม่เพียงพอ กรุณาลองใหม่'})

            Order.objects.filter(pk=order.pk).update(inventory_reserved=True)

        return order


class CartItemSerializer(serializers.Serializer):
    """ต้องสอดคล้องกับ dict ที่ CartListView สร้าง — เดิมมีแค่ product_id/quantity ทำให้ชื่อสินค้าหายจาก JSON"""
    id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField()
    name = serializers.CharField(read_only=True)
    product_name = serializers.CharField(read_only=True)
    unit_label = serializers.CharField(read_only=True, allow_blank=True, required=False)
    unit_detail = serializers.CharField(read_only=True, allow_blank=True, required=False)
    image = serializers.CharField(read_only=True, allow_null=True, required=False)
    category = serializers.CharField(read_only=True, allow_blank=True, required=False)
    stock_quantity = serializers.IntegerField(read_only=True, required=False)
    quantity = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


class OrderTrackingSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    driver_name = serializers.CharField(source='driver_assignment.driver.get_full_name', read_only=True)
    driver_phone = serializers.CharField(source='driver_assignment.driver.driver_profile.phone_number', read_only=True)
    assignment_status = serializers.CharField(source='driver_assignment.get_status_display', read_only=True)
    payment_slip_status_display = serializers.CharField(source='get_payment_slip_status_display', read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'order_number', 'customer_name', 'status', 'status_display', 'delivery_address',
                 'delivery_phone', 'delivery_notes',
                 'delivery_distance', 'subtotal', 'delivery_fee', 'total_amount', 'items',
                 'driver_name', 'driver_phone', 'assignment_status',
                 'payment_slip_status', 'payment_slip_status_display',
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        ('pending', 'รอดำเนินการ'),
        ('confirmed', 'ยืนยันแล้ว'),
        ('preparing', 'กำลังเตรียม'),
        ('ready', 'พร้อมส่ง'),
        ('out_for_delivery', 'กำลังจัดส่ง'),
        ('delivered', 'จัดส่งแล้ว'),
        ('cancelled', 'ยกเลิก')
    ])
    notes = serializers.CharField(required=False, allow_blank=True)


class CartSerializer(serializers.Serializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_items = serializers.IntegerField(read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


class CartUpdateSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=0)


class DriverAssignmentSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source='order.order_number', read_only=True)
    driver_name = serializers.CharField(source='driver.get_full_name', read_only=True)
    driver_phone = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_total_amount = serializers.DecimalField(source='order.total_amount', max_digits=10, decimal_places=2, read_only=True)
    delivery_address = serializers.CharField(source='order.delivery_address', read_only=True)
    delivery_phone = serializers.CharField(source='order.delivery_phone', read_only=True, allow_blank=True)
    delivery_notes = serializers.CharField(source='order.delivery_notes', read_only=True, allow_blank=True)
    customer_name = serializers.CharField(source='order.customer.user.get_full_name', read_only=True, allow_blank=True)
    customer_username = serializers.CharField(source='order.customer.user.username', read_only=True, allow_blank=True)
    customer_phone = serializers.CharField(source='order.customer.phone_number', read_only=True, allow_blank=True)
    order_type_display = serializers.CharField(source='order.get_order_type_display', read_only=True)

    class Meta:
        model = DriverAssignment
        fields = [
            'id', 'order', 'driver', 'driver_name', 'driver_phone',
            'order_number',
            'status', 'status_display', 'notes',
            'current_latitude', 'current_longitude', 'current_location_text', 'last_location_at',
            'assigned_at', 'updated_at', 'order_total_amount', 'delivery_address',
            'delivery_phone', 'delivery_notes',
            'customer_name', 'customer_username', 'customer_phone', 'order_type_display',
        ]
        read_only_fields = ['assigned_at', 'updated_at']

    def get_driver_phone(self, obj):
        driver_profile = getattr(obj.driver, 'driver_profile', None)
        return getattr(driver_profile, 'phone_number', '')
