from django.http import QueryDict
from rest_framework import serializers


def _store_low_stock_alert_quantity():
    from orders.models import StoreLocation

    loc = StoreLocation.objects.order_by('id').first()
    if loc is None:
        return 5
    return int(loc.low_stock_alert_quantity)


from .models import (
    Category,
    HomePromotion,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    StockMovement,
    Supplier,
)


def _normalize_product_payload(initial_data):
    """Multipart forms send ''; treat as null for nullable compare_at_price."""
    if isinstance(initial_data, QueryDict):
        flat = {}
        for key in initial_data.keys():
            values = initial_data.getlist(key)
            flat[key] = values[0] if len(values) == 1 else values
        if flat.get('compare_at_price') == '':
            flat['compare_at_price'] = None
        return flat
    if isinstance(initial_data, dict):
        merged = dict(initial_data)
        if merged.get('compare_at_price') == '':
            merged['compare_at_price'] = None
        return merged
    return initial_data


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']


class HomePromotionSerializer(serializers.ModelSerializer):
    """ลูกค้า — link_url และ banner_image เป็นค่าที่ใช้ได้ทันที"""

    link_url = serializers.SerializerMethodField()
    banner_image = serializers.SerializerMethodField()

    class Meta:
        model = HomePromotion
        fields = ['id', 'title', 'description', 'link_label', 'link_url', 'banner_image', 'icon', 'sort_order']

    def get_link_url(self, obj):
        return obj.resolve_link_url()

    def get_banner_image(self, obj):
        if not obj.banner_image:
            return None
        # ส่ง path ของไฟล์ (หรือ URL เต็มจาก storage ภายนอก) — ไม่ใช้ build_absolute_uri
        # เพราะ Host จาก proxy/LIFF ทำให้ absolute URL ผิดโดเมน → รูปแบนเนอร์ 404
        return obj.banner_image.url


class HomePromotionAdminSerializer(serializers.ModelSerializer):
    """CRUD โปรโมชั่นหน้าแรกผ่านแอปแอดมิน"""

    link_category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), allow_null=True, required=False
    )
    link_product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), allow_null=True, required=False
    )
    remove_banner_image = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = HomePromotion
        fields = [
            'id',
            'title',
            'description',
            'banner_image',
            'remove_banner_image',
            'link_target',
            'link_category',
            'link_product',
            'link_label',
            'link_url',
            'icon',
            'sort_order',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        remove_banner = bool(attrs.get('remove_banner_image'))

        title_val = attrs.get('title')
        if title_val is None and instance is not None:
            title_val = instance.title
        title_clean = (title_val or '').strip()

        has_banner = False
        if attrs.get('banner_image'):
            has_banner = True
        elif remove_banner:
            has_banner = False
        elif instance is not None and instance.banner_image:
            has_banner = True

        if not has_banner and not title_clean:
            raise serializers.ValidationError(
                {'title': 'กรอกหัวข้อ — หรืออัปโหลดรูปแบนเนอร์'}
            )
        attrs['title'] = title_clean

        target = attrs.get('link_target')
        if target is None:
            target = instance.link_target if instance else HomePromotion.LinkTarget.CUSTOM

        if target == HomePromotion.LinkTarget.CATEGORY:
            cat = attrs.get('link_category')
            if cat is None and instance:
                cat = instance.link_category
            if cat is None:
                raise serializers.ValidationError({'link_category': 'เลือกหมวดหมู่เมื่อเป้าหมายเป็นหมวด'})

        if target == HomePromotion.LinkTarget.PRODUCT:
            prod = attrs.get('link_product')
            if prod is None and instance:
                prod = instance.link_product
            if prod is None:
                raise serializers.ValidationError({'link_product': 'เลือกสินค้าเมื่อเป้าหมายเป็นสินค้าเดียว'})

        if target == HomePromotion.LinkTarget.CUSTOM:
            url = attrs.get('link_url')
            if url is None and instance:
                url = instance.link_url
            if not (url or '').strip():
                raise serializers.ValidationError({'link_url': 'กรอกลิงก์เมื่อเลือกโหมดลิงก์กำหนดเอง'})

        return attrs

    def _normalize_link_storage(self, validated_data, instance=None):
        base_inst = instance or getattr(self, 'instance', None)
        target = validated_data.get('link_target')
        if target is None and base_inst:
            target = base_inst.link_target
        if target is None:
            target = HomePromotion.LinkTarget.CUSTOM

        if target != HomePromotion.LinkTarget.CATEGORY:
            validated_data['link_category'] = None
        if target != HomePromotion.LinkTarget.PRODUCT:
            validated_data['link_product'] = None
        if target != HomePromotion.LinkTarget.CUSTOM:
            validated_data['link_url'] = ''

    def create(self, validated_data):
        validated_data.pop('remove_banner_image', None)
        self._normalize_link_storage(validated_data, instance=None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        remove = validated_data.pop('remove_banner_image', False)
        if remove:
            if instance.banner_image:
                instance.banner_image.delete(save=False)
            validated_data['banner_image'] = None
        self._normalize_link_storage(validated_data, instance=instance)
        return super().update(instance, validated_data)


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    available_quantity = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._cached_store_alert_qty = None

    def _get_store_alert_qty(self):
        if self._cached_store_alert_qty is None:
            self._cached_store_alert_qty = _store_low_stock_alert_quantity()
        return self._cached_store_alert_qty

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'compare_at_price', 'unit_label', 'unit_detail', 'category', 'category_name',
                 'image', 'stock_quantity', 'reserved_quantity', 'available_quantity', 'min_stock_level',
                 'is_low_stock', 'is_available', 'is_featured', 'is_special_offer',
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'reserved_quantity', 'available_quantity', 'is_low_stock']

    def to_internal_value(self, initial_data):
        return super().to_internal_value(_normalize_product_payload(initial_data))

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        price = attrs.get('price')
        if price is None and instance is not None:
            price = instance.price

        if 'compare_at_price' in attrs:
            compare = attrs['compare_at_price']
        elif instance is not None:
            compare = instance.compare_at_price
        else:
            compare = None

        if compare is not None and price is not None and compare <= price:
            raise serializers.ValidationError({
                'compare_at_price': 'ราคาก่อนลดต้องมากกว่าราคาขาย',
            })
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        image_path = data.get('image')
        request = self.context.get('request')
        if image_path and request:
            data['image'] = request.build_absolute_uri(image_path)
        return data

    def get_available_quantity(self, obj):
        return max(0, int(obj.stock_quantity or 0) - int(obj.reserved_quantity or 0))

    def get_is_low_stock(self, obj):
        avail = self.get_available_quantity(obj)
        prod_thr = int(obj.min_stock_level or 0)
        store_thr = self._get_store_alert_qty()
        if store_thr > 0 and avail <= store_thr:
            return True
        return avail <= prod_thr


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_name', 'phone', 'email', 'address',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit_label', read_only=True)
    movement_label = serializers.CharField(source='get_movement_type_display', read_only=True)
    actor_name = serializers.SerializerMethodField()
    actor_display = serializers.SerializerMethodField()

    def get_actor_name(self, obj):
        u = getattr(obj, 'created_by', None)
        if not u:
            return ''
        return getattr(u, 'username', '') or ''

    def get_actor_display(self, obj):
        u = getattr(obj, 'created_by', None)
        if not u:
            return ''
        full = (u.get_full_name() or '').strip()
        if full:
            return full
        return getattr(u, 'username', '') or ''

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_unit',
            'movement_type', 'movement_label',
            'quantity_change', 'quantity_before', 'quantity_after',
            'reserved_before', 'reserved_after', 'unit_cost',
            'source_type', 'source_id', 'reference', 'note',
            'actor_name', 'actor_display', 'created_at',
        ]


class ManualStockAdjustmentSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity_change = serializers.IntegerField()
    movement_type = serializers.ChoiceField(
        choices=[
            'adjustment_in',
            'adjustment_out',
            'return_in',
            'damage_out',
        ],
        required=False,
    )
    reference = serializers.CharField(required=False, allow_blank=True, max_length=120)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('quantity_change') == 0:
            raise serializers.ValidationError({'quantity_change': 'จำนวนต้องไม่เป็น 0'})
        if not attrs.get('movement_type'):
            attrs['movement_type'] = 'adjustment_in' if attrs['quantity_change'] > 0 else 'adjustment_out'
        return attrs


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_name',
            'ordered_quantity', 'received_quantity', 'unit_cost', 'available_quantity',
        ]

    def get_available_quantity(self, obj):
        p = obj.product
        return max(0, int(p.stock_quantity or 0) - int(p.reserved_quantity or 0))


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = PurchaseOrderItemSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'reference', 'supplier', 'supplier_name', 'status', 'status_display',
            'expected_date', 'notes', 'items', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['reference', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        purchase_order = PurchaseOrder.objects.create(**validated_data)
        for item in items_data:
            PurchaseOrderItem.objects.create(purchase_order=purchase_order, **item)
        return purchase_order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                PurchaseOrderItem.objects.create(purchase_order=instance, **item)
        return instance



