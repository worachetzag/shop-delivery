from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q, Sum
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
import base64
import io
import qrcode
from decimal import Decimal, ROUND_HALF_UP
from accounts.models import Customer
from accounts.models import DriverProfile, StaffAuditLog
from accounts.permissions import is_admin_user as _is_admin_user
from accounts.staff_audit import log_staff_audit
from products.models import Product
from line_bot.notify import send_order_status_notification
from .models import Order, OrderItem, DriverAssignment, StoreLocation
from .store_location import get_store_location_payload
from .stock_helpers import (
    format_order_stock_audit_label,
    sync_order_stock_for_status_change,
)
from .serializers import (
    OrderSerializer, OrderCreateSerializer, CartItemSerializer,
    OrderTrackingSerializer, OrderStatusUpdateSerializer,
    CartSerializer, CartUpdateSerializer, DriverAssignmentSerializer
)


class StoreLocationPublicView(APIView):
    """พิกัดร้านสำหรับแอป/LIFF (แสดงแผนที่ / ส่งคู่กับ delivery_latitude, delivery_longitude ตอนสร้างออเดอร์)"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(get_store_location_payload())


class AdminStoreSettingsView(APIView):
    """ตั้งค่าร้านสำหรับเจ้าของร้าน (พิกัด/ข้อมูลร้าน + เวลาทำการรับเอง/จัดส่ง)."""
    permission_classes = [permissions.IsAuthenticated]

    def _deny_if_not_admin(self, user):
        if not _is_admin_user(user):
            return Response(
                {'error': 'ไม่มีสิทธิ์เข้าถึงการตั้งค่าร้าน'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    @staticmethod
    def _serialize_hours():
        # import ภายในเพื่อเลี่ยง circular import (logistics -> orders)
        from logistics.models import ServiceHours

        data = {}
        for row in ServiceHours.objects.filter(service_type__in=['pickup', 'delivery']):
            data[row.service_type] = {
                'start_time': row.start_time.strftime('%H:%M:%S'),
                'end_time': row.end_time.strftime('%H:%M:%S'),
                'is_active': bool(row.is_active),
            }
        return data

    def get(self, request):
        denied = self._deny_if_not_admin(request.user)
        if denied:
            return denied

        loc = StoreLocation.objects.order_by('id').first()
        payload = {
            'store_location': {
                'name': (loc.name if loc else '') or '',
                'address': (loc.address if loc else '') or '',
                'promptpay_number': (loc.promptpay_number if loc else '') or '',
                'latitude': loc.latitude if loc else None,
                'longitude': loc.longitude if loc else None,
                'updated_at': loc.updated_at if loc else None,
            },
            'service_hours': self._serialize_hours(),
        }
        return Response(payload)

    def put(self, request):
        denied = self._deny_if_not_admin(request.user)
        if denied:
            return denied

        # import ภายในเพื่อเลี่ยง circular import (logistics -> orders)
        from logistics.models import ServiceHours

        location_data = request.data.get('store_location') or {}
        hours_data = request.data.get('service_hours') or {}

        lat = location_data.get('latitude')
        lng = location_data.get('longitude')
        if lat not in (None, ''):
            try:
                lat = Decimal(str(lat))
            except Exception:
                return Response({'error': 'latitude ไม่ถูกต้อง'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            lat = None
        if lng not in (None, ''):
            try:
                lng = Decimal(str(lng))
            except Exception:
                return Response({'error': 'longitude ไม่ถูกต้อง'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            lng = None

        with transaction.atomic():
            loc = StoreLocation.objects.order_by('id').first()
            if not loc:
                loc = StoreLocation.objects.create(
                    name=(location_data.get('name') or '').strip(),
                    address=(location_data.get('address') or '').strip(),
                    promptpay_number=''.join(ch for ch in str(location_data.get('promptpay_number') or '') if ch.isdigit()),
                    latitude=lat,
                    longitude=lng,
                )
            else:
                loc.name = (location_data.get('name') or '').strip()
                loc.address = (location_data.get('address') or '').strip()
                loc.promptpay_number = ''.join(ch for ch in str(location_data.get('promptpay_number') or '') if ch.isdigit())
                loc.latitude = lat
                loc.longitude = lng
                loc.save()

            for service_type in ['pickup', 'delivery']:
                row = hours_data.get(service_type)
                if not isinstance(row, dict):
                    continue
                start_time = row.get('start_time')
                end_time = row.get('end_time')
                if not start_time or not end_time:
                    continue
                ServiceHours.objects.update_or_create(
                    service_type=service_type,
                    defaults={
                        'start_time': start_time,
                        'end_time': end_time,
                        'is_active': bool(row.get('is_active', True)),
                    },
                )

        return self.get(request)


def _cart_cache_key(user_id):
    return f"cart_user_{user_id}"


def _get_cart(request):
    if request.user.is_authenticated:
        return cache.get(_cart_cache_key(request.user.id), {})
    return request.session.get('cart', {})


def _save_cart(request, cart):
    if request.user.is_authenticated:
        cache.set(_cart_cache_key(request.user.id), cart, timeout=60 * 60 * 24 * 7)
        return
    request.session['cart'] = cart
    request.session.modified = True


def _crc16_ccitt(payload):
    crc = 0xFFFF
    for char in payload:
        crc ^= ord(char) << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return f"{crc:04X}"


def _format_tlv(tag, value):
    value_str = str(value)
    return f"{tag}{len(value_str):02d}{value_str}"


def _sync_driver_availability(driver_user):
    """Sync DriverProfile availability from active assignments."""
    if not driver_user:
        return
    driver_profile = getattr(driver_user, 'driver_profile', None)
    if not driver_profile:
        return
    has_active_jobs = DriverAssignment.objects.filter(
        driver=driver_user
    ).exclude(status__in=['delivered', 'cancelled']).exists()
    next_available = not has_active_jobs
    if driver_profile.is_available != next_available:
        driver_profile.is_available = next_available
        driver_profile.save(update_fields=['is_available'])


def _driver_order_stock_audit_worthy(old_os: str, new_os: str, stock_meta: dict) -> bool:
    """บันทึก audit เฉพาะเมื่อสถานะออเดอร์เกี่ยวกับยกเลิก หรือมีการปรับ/ข้ามสต็อก"""
    if stock_meta.get('restocked') or stock_meta.get('rededucted'):
        return True
    if (
        stock_meta.get('restock_skipped_delivered')
        or stock_meta.get('restock_skipped_not_reserved')
        or stock_meta.get('restock_skipped_already_restocked')
    ):
        return True
    if old_os != new_os and (old_os == 'cancelled' or new_os == 'cancelled'):
        return True
    return False


def _build_promptpay_payload(promptpay_number, amount):
    sanitized = ''.join(ch for ch in str(promptpay_number or '') if ch.isdigit())
    proxy_tag = None
    if sanitized.startswith('0') and len(sanitized) == 10:
        # Thai mobile number -> PromptPay proxy format (0066 + 9 digits)
        sanitized = f"0066{sanitized[1:]}"
        proxy_tag = '01'
    elif sanitized.startswith('66') and len(sanitized) == 11:
        sanitized = f"00{sanitized}"
        proxy_tag = '01'
    elif sanitized.startswith('0066') and len(sanitized) == 13:
        proxy_tag = '01'
    elif len(sanitized) == 13:
        # Thai national ID / tax ID (PromptPay proxy)
        proxy_tag = '02'

    if proxy_tag is None:
        raise ValueError('รูปแบบพร้อมเพย์ไม่ถูกต้อง (รองรับเบอร์มือถือไทย 10 หลัก หรือเลข 13 หลัก)')

    amount_decimal = Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    merchant_account_info = (
        _format_tlv('00', 'A000000677010111')
        + _format_tlv(proxy_tag, sanitized)
    )

    payload_without_crc = (
        _format_tlv('00', '01')
        + _format_tlv('01', '12')
        + _format_tlv('29', merchant_account_info)
        + _format_tlv('53', '764')
        + _format_tlv('54', f"{amount_decimal:.2f}")
        + _format_tlv('58', 'TH')
        + _format_tlv('62', _format_tlv('07', f"ORDER{timezone.now().strftime('%H%M%S')}"))
        + '6304'
    )
    return f"{payload_without_crc}{_crc16_ccitt(payload_without_crc)}"


class OrderCreateView(generics.CreateAPIView):
    """สร้างคำสั่งซื้อใหม่"""
    serializer_class = OrderCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # ตั้งค่า customer
        customer = get_object_or_404(Customer, user=request.user)
        serializer.validated_data['customer'] = customer
        
        order = serializer.save()
        # Clear cart after successful order placement.
        _save_cart(request, {})

        order = Order.objects.prefetch_related('items__product').get(pk=order.pk)
        order_payload = OrderSerializer(order, context={'request': request}).data
        return Response({
            'message': 'สร้างคำสั่งซื้อสำเร็จ',
            'order_id': order.id,
            'order_number': order.order_number,
            'total_amount': order.total_amount,
            'subtotal': order.subtotal,
            'delivery_fee': order.delivery_fee,
            'delivery_distance': order_payload.get('delivery_distance'),
            'order': order_payload,
        }, status=201)


class OrderListView(generics.ListAPIView):
    """รายการคำสั่งซื้อของลูกค้า"""
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _is_admin_user(self, user):
        return _is_admin_user(user)
    
    def get_queryset(self):
        base = Order.objects.all()
        if not self._is_admin_user(self.request.user):
            customer = Customer.objects.filter(user=self.request.user).first()
            if customer:
                base = Order.objects.filter(customer=customer)
            else:
                return Order.objects.none()
        qs = base.order_by('-created_at').prefetch_related('items__product')
        # กรองตาม query (?status= / ?group=shipping สำหรับแท็บลูกค้า)
        group = self.request.query_params.get('group')
        if group == 'shipping':
            qs = qs.filter(status__in=['ready', 'delivering'])
        else:
            st = self.request.query_params.get('status')
            if st and st.strip():
                qs = qs.filter(status=st.strip())
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(order_number__icontains=q)
                | Q(id__iexact=q)
                | Q(customer__user__first_name__icontains=q)
                | Q(customer__user__last_name__icontains=q)
                | Q(customer__user__username__icontains=q)
            )
        return qs


class OrderDetailView(generics.RetrieveAPIView):
    """รายละเอียดคำสั่งซื้อรายรายการ"""
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = 'order_id'

    def _is_admin_user(self, user):
        return _is_admin_user(user)

    def get_queryset(self):
        if self._is_admin_user(self.request.user):
            return Order.objects.all().prefetch_related('items__product')
        customer = Customer.objects.filter(user=self.request.user).first()
        if customer:
            return Order.objects.filter(customer=customer).prefetch_related('items__product')
        return Order.objects.none()


class AdminOrderStatsView(APIView):
    """สรุปข้อมูลจริงสำหรับ dashboard แอดมิน"""
    permission_classes = [permissions.IsAuthenticated]

    def _is_admin_user(self, user):
        return _is_admin_user(user)

    def get(self, request):
        if not self._is_admin_user(request.user):
            return Response(
                {'error': 'ไม่มีสิทธิ์เข้าถึงข้อมูลแอดมิน'},
                status=status.HTTP_403_FORBIDDEN
            )

        orders_qs = Order.objects.all()
        total_orders = orders_qs.count()
        pending_orders = orders_qs.filter(status='pending').count()
        # Revenue should include only completed orders.
        total_revenue = orders_qs.filter(status='delivered').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        active_drivers = DriverProfile.objects.filter(is_available=True).count()

        return Response({
            'total_orders': total_orders,
            'pending_orders': pending_orders,
            'total_revenue': float(total_revenue),
            'active_drivers': active_drivers,
        }, status=status.HTTP_200_OK)


class CartView(APIView):
    """จัดการตะกร้าสินค้า"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """เพิ่มสินค้าในตะกร้า"""
        serializer = CartItemSerializer(data=request.data)
        if serializer.is_valid():
            product_id = serializer.validated_data['product_id']
            quantity = serializer.validated_data['quantity']
            
            product = get_object_or_404(Product, id=product_id, is_available=True)

            cart = _get_cart(request)
            current_quantity = int(cart.get(str(product_id), 0))
            new_quantity = current_quantity + quantity

            available_qty = max(0, int(product.stock_quantity or 0) - int(product.reserved_quantity or 0))
            if available_qty < new_quantity:
                return Response({
                    'error': 'สินค้าไม่เพียงพอ'
                }, status=400)

            cart[str(product_id)] = new_quantity
            _save_cart(request, cart)

            return Response({
                'product_id': product.id,
                'name': product.name,
                'unit_label': product.unit_label,
                'unit_detail': product.unit_detail,
                'quantity': new_quantity,
                'price': float(product.price),
                'available_quantity': available_qty,
                'total_price': float(product.price) * new_quantity
            }, status=200)
        
        return Response(serializer.errors, status=400)


class OrderTrackingView(generics.RetrieveAPIView):
    """ติดตามคำสั่งซื้อ"""
    serializer_class = OrderTrackingSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        order_id = self.kwargs['order_id']
        customer = get_object_or_404(Customer, user=self.request.user)
        return get_object_or_404(
            Order.objects.filter(customer=customer).prefetch_related('items__product'),
            id=order_id,
        )


class OrderStatusUpdateView(APIView):
    """อัปเดตสถานะคำสั่งซื้อ (เฉพาะแอดมินร้าน)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def put(self, request, order_id):
        if not _is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์อัปเดตสถานะคำสั่งซื้อ'}, status=status.HTTP_403_FORBIDDEN)

        order = get_object_or_404(Order, id=order_id)
        serializer = OrderStatusUpdateSerializer(data=request.data)
        
        if serializer.is_valid():
            new_status = serializer.validated_data['status']
            notes = serializer.validated_data.get('notes', '')
            try:
                with transaction.atomic():
                    order = get_object_or_404(Order.objects.select_for_update(), id=order_id)
                    old_status = order.status
                    order, stock_meta = sync_order_stock_for_status_change(order, old_status, new_status)
                    order.refresh_from_db()
                    order.status = new_status
                    if notes:
                        order.delivery_notes = (
                            f"{order.delivery_notes}\n{notes}" if order.delivery_notes else notes
                        )
                    order.save()
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            action_label_th = format_order_stock_audit_label(
                order.id, old_status, new_status, stock_meta, source='admin'
            )
            audit_detail = {
                'order_id': order.id,
                'from': old_status,
                'to': new_status,
                'notes': notes or None,
                'action_label_th': action_label_th,
                'stock_restocked': bool(stock_meta.get('restocked')),
                'stock_rededucted': bool(stock_meta.get('rededucted')),
                'restock_items': stock_meta.get('restock_items') or [],
                'rededuct_items': stock_meta.get('rededuct_items') or [],
                'restock_skipped_delivered': bool(stock_meta.get('restock_skipped_delivered')),
                'restock_skipped_not_reserved': bool(stock_meta.get('restock_skipped_not_reserved')),
                'restock_skipped_already_restocked': bool(stock_meta.get('restock_skipped_already_restocked')),
            }
            log_staff_audit(
                request,
                StaffAuditLog.Action.ORDER_STATUS,
                target_type='order',
                target_id=str(order.id),
                summary=action_label_th[:500],
                detail=audit_detail,
            )
            send_order_status_notification(
                order=order,
                source='admin',
                old_status=old_status,
                new_status=order.status,
                actor=request.user,
            )
            
            return Response({
                'message': 'อัปเดตสถานะสำเร็จ',
                'order_id': order.id,
                'status': order.status,
                'status_display': order.get_status_display()
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PromptPayQRCodeView(APIView):
    """สร้าง QR PromptPay ตามยอดคำสั่งซื้อ"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        if order.customer.user_id != request.user.id:
            return Response({'error': 'ไม่มีสิทธิ์ใช้งานคำสั่งซื้อนี้'}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_method != 'promptpay':
            return Response({'error': 'คำสั่งซื้อนี้ไม่ได้เลือกชำระด้วย PromptPay'}, status=status.HTTP_400_BAD_REQUEST)

        loc = StoreLocation.objects.order_by('id').first()
        promptpay_number = (
            (getattr(loc, 'promptpay_number', '') or '')
            or getattr(settings, 'PROMPTPAY_NUMBER', '')
            or getattr(settings, 'PROMPTPAY_MERCHANT_ID', '')
        )
        if not promptpay_number:
            return Response({'error': 'ยังไม่ได้ตั้งค่า PromptPay Number ในระบบ'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            payload = _build_promptpay_payload(promptpay_number, order.total_amount)
        except ValueError as error:
            return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)
        qr = qrcode.QRCode(version=1, box_size=10, border=3)
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

        return Response({
            'order_id': order.id,
            'amount': float(order.total_amount),
            'promptpay_number': promptpay_number,
            'qr_payload': payload,
            'qr_image': f"data:image/png;base64,{qr_base64}",
            'payment_slip_status': order.payment_slip_status,
        }, status=status.HTTP_200_OK)


class PaymentSlipUploadView(APIView):
    """อัปโหลดสลิปเพื่อยืนยันการชำระเงิน"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        if order.customer.user_id != request.user.id:
            return Response({'error': 'ไม่มีสิทธิ์ใช้งานคำสั่งซื้อนี้'}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_method != 'promptpay':
            return Response({'error': 'คำสั่งซื้อนี้ไม่ได้เลือกชำระด้วย PromptPay'}, status=status.HTTP_400_BAD_REQUEST)

        payment_slip = request.FILES.get('payment_slip')
        if not payment_slip:
            return Response({'error': 'กรุณาแนบไฟล์สลิป'}, status=status.HTTP_400_BAD_REQUEST)

        order.payment_slip = payment_slip
        order.payment_slip_status = 'uploaded'
        order.payment_slip_uploaded_at = timezone.now()
        order.payment_verified_at = None
        order.save(update_fields=['payment_slip', 'payment_slip_status', 'payment_slip_uploaded_at', 'payment_verified_at', 'updated_at'])

        payment_slip_url = request.build_absolute_uri(order.payment_slip.url) if order.payment_slip else None

        return Response({
            'message': 'อัปโหลดสลิปเรียบร้อย รอแอดมินตรวจสอบ',
            'order_id': order.id,
            'payment_slip_status': order.payment_slip_status,
            'payment_slip_status_display': order.get_payment_slip_status_display(),
            'payment_slip_uploaded_at': order.payment_slip_uploaded_at,
            'payment_verified_at': order.payment_verified_at,
            'payment_slip_url': payment_slip_url,
        }, status=status.HTTP_200_OK)

    def delete(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        if order.customer.user_id != request.user.id:
            return Response({'error': 'ไม่มีสิทธิ์ใช้งานคำสั่งซื้อนี้'}, status=status.HTTP_403_FORBIDDEN)
        if order.payment_method != 'promptpay':
            return Response({'error': 'คำสั่งซื้อนี้ไม่ได้เลือกชำระด้วย PromptPay'}, status=status.HTTP_400_BAD_REQUEST)
        if not order.payment_slip:
            return Response({'error': 'ยังไม่มีสลิปให้ลบ'}, status=status.HTTP_400_BAD_REQUEST)
        if order.payment_slip_status == 'verified':
            return Response({'error': 'สลิปนี้ถูกยืนยันแล้ว ไม่สามารถลบได้'}, status=status.HTTP_400_BAD_REQUEST)

        order.payment_slip.delete(save=False)
        order.payment_slip = None
        order.payment_slip_status = 'pending'
        order.payment_slip_uploaded_at = None
        order.payment_verified_at = None
        order.save(update_fields=['payment_slip', 'payment_slip_status', 'payment_slip_uploaded_at', 'payment_verified_at', 'updated_at'])

        return Response({
            'message': 'ลบสลิปเรียบร้อย สามารถอัปโหลดใหม่ได้',
            'order_id': order.id,
            'payment_slip_status': order.payment_slip_status,
            'payment_slip_status_display': order.get_payment_slip_status_display(),
            'payment_slip_uploaded_at': order.payment_slip_uploaded_at,
            'payment_verified_at': order.payment_verified_at,
            'payment_slip_url': None,
        }, status=status.HTTP_200_OK)


class AdminPaymentSlipReviewView(APIView):
    """แอดมินตรวจสอบและยืนยันสลิป"""
    permission_classes = [permissions.IsAuthenticated]

    def _is_admin_user(self, user):
        if user.is_superuser or user.is_staff:
            return True
        role_obj = getattr(user, 'user_role', None)
        if not role_obj:
            return hasattr(user, 'admin_profile')
        return role_obj.role in ['store_admin', 'super_admin', 'admin']

    def put(self, request, order_id):
        if not self._is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์ทำรายการนี้'}, status=status.HTTP_403_FORBIDDEN)

        order = get_object_or_404(Order, id=order_id)
        if order.payment_method != 'promptpay':
            return Response({'error': 'คำสั่งซื้อนี้ไม่ได้ชำระด้วย PromptPay'}, status=status.HTTP_400_BAD_REQUEST)
        if not order.payment_slip:
            return Response({'error': 'ยังไม่มีการอัปโหลดสลิป'}, status=status.HTTP_400_BAD_REQUEST)

        decision = request.data.get('decision')
        if decision not in ['verified', 'rejected']:
            return Response({'error': 'decision ต้องเป็น verified หรือ rejected'}, status=status.HTTP_400_BAD_REQUEST)

        order.payment_slip_status = decision
        if decision == 'verified':
            order.payment_verified_at = timezone.now()
        else:
            order.payment_verified_at = None
        order.save(update_fields=['payment_slip_status', 'payment_verified_at', 'updated_at'])

        log_staff_audit(
            request,
            StaffAuditLog.Action.PAYMENT_SLIP_REVIEW,
            target_type='order',
            target_id=str(order.id),
            summary=f'ออเดอร์ #{order.id} ตรวจสลิป: {decision}',
            detail={'order_id': order.id, 'decision': decision},
        )

        return Response({
            'message': 'อัปเดตสถานะสลิปเรียบร้อย',
            'order_id': order.id,
            'payment_slip_status': order.payment_slip_status,
            'payment_slip_status_display': order.get_payment_slip_status_display(),
        }, status=status.HTTP_200_OK)


class AdminAssignDriverView(APIView):
    """แอดมินมอบหมายงานให้คนขับ"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        if not _is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์มอบหมายงาน'}, status=status.HTTP_403_FORBIDDEN)

        driver_id = request.data.get('driver_id')
        notes = (request.data.get('notes') or '').strip()
        if not driver_id:
            return Response({'error': 'กรุณาเลือกคนขับ'}, status=status.HTTP_400_BAD_REQUEST)

        order = get_object_or_404(Order, id=order_id)
        if order.payment_method == 'promptpay' and order.payment_slip_status != 'verified':
            return Response(
                {'error': 'คำสั่งซื้อ PromptPay ต้องยืนยันสลิปก่อนมอบหมายคนขับ'},
                status=status.HTTP_400_BAD_REQUEST
            )
        driver_user = get_object_or_404(DriverProfile.objects.select_related('user'), id=driver_id).user

        # Prevent assigning a driver who is already on another active job.
        active_assignment_exists = DriverAssignment.objects.filter(
            driver=driver_user
        ).exclude(order=order).exclude(status__in=['delivered', 'cancelled']).exists()
        if active_assignment_exists:
            return Response(
                {'error': 'คนขับคนนี้มีงานที่ยังไม่เสร็จอยู่ ไม่สามารถมอบหมายซ้ำได้'},
                status=status.HTTP_400_BAD_REQUEST
            )

        previous_driver = getattr(getattr(order, 'driver_assignment', None), 'driver', None)

        assignment, _ = DriverAssignment.objects.update_or_create(
            order=order,
            defaults={
                'driver': driver_user,
                'assigned_by': request.user,
                'status': 'assigned',
                'notes': notes,
            }
        )
        if order.status in ['pending', 'confirmed', 'preparing', 'ready']:
            order.status = 'delivering'
            order.save(update_fields=['status', 'updated_at'])

        _sync_driver_availability(driver_user)
        if previous_driver and previous_driver.id != driver_user.id:
            _sync_driver_availability(previous_driver)

        serializer = DriverAssignmentSerializer(assignment)
        log_staff_audit(
            request,
            StaffAuditLog.Action.ASSIGN_DRIVER,
            target_type='order',
            target_id=str(order.id),
            summary=f'ออเดอร์ #{order.id} มอบหมายคนขับ {driver_user.username}',
            detail={
                'order_id': order.id,
                'driver_profile_id': driver_id,
                'driver_username': driver_user.username,
            },
        )
        return Response({
            'message': 'มอบหมายคนขับสำเร็จ',
            'assignment': serializer.data,
        }, status=status.HTTP_200_OK)


class DriverAssignmentListView(generics.ListAPIView):
    """รายการงานของคนขับที่ล็อกอินอยู่"""
    serializer_class = DriverAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            DriverAssignment.objects.filter(driver=self.request.user)
            .select_related('order', 'order__customer', 'order__customer__user', 'driver')
            .order_by('-assigned_at')
        )


class DriverAssignmentDetailView(generics.RetrieveAPIView):
    """รายละเอียดงานของคนขับ (เฉพาะงานตัวเอง)"""
    serializer_class = DriverAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = 'assignment_id'

    def get_queryset(self):
        return DriverAssignment.objects.filter(driver=self.request.user).select_related(
            'order', 'order__customer', 'order__customer__user', 'driver'
        )


class DriverAssignmentStatusUpdateView(APIView):
    """คนขับอัปเดตสถานะงานพร้อมตำแหน่งล่าสุด"""
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, assignment_id):
        assignment = get_object_or_404(
            DriverAssignment.objects.select_related(
                'order', 'order__customer', 'order__customer__user', 'driver'
            ),
            id=assignment_id,
            driver=request.user,
        )
        next_status = request.data.get('status')
        valid_statuses = ['accepted', 'picked_up', 'on_the_way', 'delivered', 'cancelled']
        if next_status not in valid_statuses:
            return Response({'error': 'สถานะไม่ถูกต้อง'}, status=status.HTTP_400_BAD_REQUEST)

        transition_map = {
            'assigned': ['accepted', 'cancelled'],
            'accepted': ['picked_up', 'cancelled'],
            'picked_up': ['on_the_way', 'cancelled'],
            'on_the_way': ['delivered', 'cancelled'],
            'delivered': [],
            'cancelled': [],
        }
        current_status = assignment.status
        if next_status != current_status and next_status not in transition_map.get(current_status, []):
            return Response(
                {
                    'error': f'ไม่สามารถเปลี่ยนสถานะจาก {assignment.get_status_display()} ไปเป็นสถานะที่เลือกได้',
                    'current_status': current_status,
                    'allowed_next_statuses': transition_map.get(current_status, []),
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        def _order_status_for_driver_event(os_before, nxt):
            if nxt == 'accepted':
                return 'preparing' if os_before == 'pending' else os_before
            if nxt in ['picked_up', 'on_the_way']:
                return 'delivering'
            if nxt == 'delivered':
                return 'delivered'
            if nxt == 'cancelled':
                return 'cancelled'
            return os_before

        try:
            with transaction.atomic():
                assignment = (
                    DriverAssignment.objects.select_for_update()
                    .select_related('order', 'order__customer', 'order__customer__user', 'driver')
                    .get(id=assignment_id, driver=request.user)
                )
                order = Order.objects.select_for_update().get(pk=assignment.order_id)
                cur = assignment.status
                if next_status != cur and next_status not in transition_map.get(cur, []):
                    return Response(
                        {
                            'error': 'สถานะงานเปลี่ยนระหว่างทาง กรุณารีเฟรช',
                            'current_status': cur,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                old_os = order.status
                new_os = _order_status_for_driver_event(old_os, next_status)

                order, stock_meta = sync_order_stock_for_status_change(order, old_os, new_os)
                order.refresh_from_db()
                order.status = new_os

                assignment.status = next_status
                assignment.notes = (request.data.get('notes') or assignment.notes or '').strip()
                assignment.current_location_text = (
                    request.data.get('current_location_text') or assignment.current_location_text or ''
                ).strip()

                lat = request.data.get('current_latitude')
                lng = request.data.get('current_longitude')
                if lat not in [None, '']:
                    assignment.current_latitude = lat
                if lng not in [None, '']:
                    assignment.current_longitude = lng
                if assignment.current_location_text or lat not in [None, ''] or lng not in [None, '']:
                    assignment.last_location_at = timezone.now()

                assignment.save()
                order.save(update_fields=['status', 'updated_at'])
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if _driver_order_stock_audit_worthy(old_os, new_os, stock_meta):
            action_label_th = format_order_stock_audit_label(
                order.id, old_os, new_os, stock_meta, source='driver'
            )
            log_staff_audit(
                request,
                StaffAuditLog.Action.ORDER_STATUS,
                target_type='order',
                target_id=str(order.id),
                summary=action_label_th[:500],
                detail={
                    'order_id': order.id,
                    'order_status_from': old_os,
                    'order_status_to': new_os,
                    'driver_assignment_status': next_status,
                    'action_label_th': action_label_th,
                    'stock_restocked': bool(stock_meta.get('restocked')),
                    'stock_rededucted': bool(stock_meta.get('rededucted')),
                    'restock_items': stock_meta.get('restock_items') or [],
                    'rededuct_items': stock_meta.get('rededuct_items') or [],
                    'restock_skipped_delivered': bool(stock_meta.get('restock_skipped_delivered')),
                    'restock_skipped_not_reserved': bool(stock_meta.get('restock_skipped_not_reserved')),
                    'restock_skipped_already_restocked': bool(stock_meta.get('restock_skipped_already_restocked')),
                    'source': 'driver',
                },
            )

        send_order_status_notification(
            order=order,
            source='driver',
            old_status=old_os,
            new_status=order.status,
            actor=request.user,
            driver_status=assignment.get_status_display(),
        )

        assignment = DriverAssignment.objects.select_related(
            'order', 'order__customer', 'order__customer__user', 'driver'
        ).get(id=assignment_id, driver=request.user)
        _sync_driver_availability(assignment.driver)

        return Response({
            'message': 'อัปเดตสถานะงานสำเร็จ',
            'assignment': DriverAssignmentSerializer(assignment).data,
        }, status=status.HTTP_200_OK)


class OrderDriverTrackingView(APIView):
    """ลูกค้า/แอดมินดูสถานะและตำแหน่งคนขับ"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id):
        order = get_object_or_404(Order, id=order_id)
        is_owner = hasattr(request.user, 'customer') and order.customer.user_id == request.user.id
        if not (_is_admin_user(request.user) or is_owner or (hasattr(order, 'driver_assignment') and order.driver_assignment.driver_id == request.user.id)):
            return Response({'error': 'ไม่มีสิทธิ์เข้าถึงการติดตามนี้'}, status=status.HTTP_403_FORBIDDEN)

        assignment = getattr(order, 'driver_assignment', None)
        driver_payload = None
        if assignment:
            driver_profile = getattr(assignment.driver, 'driver_profile', None)
            driver_payload = {
                'id': assignment.driver_id,
                'name': assignment.driver.get_full_name() or assignment.driver.username,
                'phone': getattr(driver_profile, 'phone_number', ''),
                'vehicle': (
                    f"{getattr(driver_profile, 'vehicle_type', '')} {getattr(driver_profile, 'vehicle_number', '')}".strip()
                    if driver_profile else ''
                ),
            }

        timeline = [
            {'code': 'pending', 'title': 'รอร้านยืนยัน', 'completed': order.status not in ['pending'], 'current': order.status == 'pending'},
            {'code': 'preparing', 'title': 'กำลังเตรียมสินค้า', 'completed': order.status in ['preparing', 'ready', 'delivering', 'delivered'], 'current': order.status == 'preparing'},
            {'code': 'delivering', 'title': 'กำลังจัดส่ง', 'completed': order.status in ['delivering', 'delivered'], 'current': order.status == 'delivering'},
            {'code': 'delivered', 'title': 'จัดส่งสำเร็จ', 'completed': order.status == 'delivered', 'current': order.status == 'delivered'},
        ]

        return Response({
            'order_id': order.id,
            'order_number': order.order_number,
            'order_status': order.status,
            'order_status_display': order.get_status_display(),
            'driver_assignment_status': assignment.status if assignment else None,
            'driver_assignment_status_display': assignment.get_status_display() if assignment else None,
            'current_location_text': assignment.current_location_text if assignment else '',
            'current_latitude': assignment.current_latitude if assignment else None,
            'current_longitude': assignment.current_longitude if assignment else None,
            'delivery_latitude': order.delivery_latitude,
            'delivery_longitude': order.delivery_longitude,
            'last_location_at': assignment.last_location_at if assignment else None,
            'driver': driver_payload,
            'delivery_address': order.delivery_address,
            'timeline': timeline,
            'items': [
                {
                    'id': item.id,
                    'product_name': item.product.name,
                    'quantity': item.quantity,
                    'price': item.price,
                } for item in order.items.select_related('product').all()
            ],
        }, status=status.HTTP_200_OK)


class CartListView(APIView):
    """ดูตะกร้าสินค้า"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        cart = _get_cart(request)
        items = []
        total_items = 0
        total_amount = 0.0

        for product_id, quantity in cart.items():
            try:
                product = Product.objects.get(id=int(product_id), is_available=True)
            except Product.DoesNotExist:
                continue

            qty = int(quantity)
            price = float(product.price)
            item_total = price * qty
            total_items += qty
            total_amount += item_total

            items.append({
                'id': product.id,
                'product_id': product.id,
                'name': product.name,
                'product_name': product.name,
                'unit_label': product.unit_label,
                'unit_detail': product.unit_detail,
                'price': price,
                'stock_quantity': product.stock_quantity,
                'available_quantity': max(0, int(product.stock_quantity or 0) - int(product.reserved_quantity or 0)),
                'image': product.image.url if product.image else None,
                'category': product.category.name if product.category else '',
                'quantity': qty,
                'total_price': item_total,
            })

        cart_data = {
            'items': items,
            'total_items': total_items,
            'total_amount': total_amount
        }
        
        serializer = CartSerializer(cart_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CartUpdateView(APIView):
    """แก้ไขสินค้าในตะกร้า"""
    permission_classes = [permissions.IsAuthenticated]
    
    def put(self, request):
        serializer = CartUpdateSerializer(data=request.data)
        if serializer.is_valid():
            product_id = serializer.validated_data['product_id']
            quantity = serializer.validated_data['quantity']
            
            product = get_object_or_404(Product, id=product_id, is_available=True)
            cart = _get_cart(request)
            
            if quantity == 0:
                cart.pop(str(product_id), None)
                _save_cart(request, cart)
                return Response({
                    'message': 'ลบสินค้าจากตะกร้าสำเร็จ',
                    'product_id': product_id,
                    'quantity': 0
                }, status=status.HTTP_200_OK)
            
            available_qty = max(0, int(product.stock_quantity or 0) - int(product.reserved_quantity or 0))
            if available_qty < quantity:
                return Response({
                    'error': 'สินค้าไม่เพียงพอ'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            cart[str(product_id)] = quantity
            _save_cart(request, cart)

            return Response({
                'message': 'อัปเดตตะกร้าสำเร็จ',
                'product_id': product.id,
                'product_name': product.name,
                'unit_label': product.unit_label,
                'unit_detail': product.unit_detail,
                'quantity': quantity,
                'price': float(product.price),
                'available_quantity': available_qty,
                'total_price': float(product.price) * quantity
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CartDeleteView(APIView):
    """ลบสินค้าจากตะกร้า"""
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request, product_id):
        product = get_object_or_404(Product, id=product_id)
        cart = _get_cart(request)
        cart.pop(str(product_id), None)
        _save_cart(request, cart)

        return Response({
            'message': 'ลบสินค้าจากตะกร้าสำเร็จ',
            'product_id': product_id,
            'product_name': product.name
        }, status=status.HTTP_200_OK)