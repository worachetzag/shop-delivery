from django.db import transaction
from django.db.models import Case, F, IntegerField, Q, Sum, Value, When
from django.db.models import ExpressionWrapper
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from rest_framework import filters, generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from accounts.models import StaffAuditLog
from accounts.staff_audit import log_staff_audit
from .models import Category, HomePromotion, Product, PurchaseOrder, PurchaseOrderItem, StockMovement, Supplier
from .serializers import (
    CategorySerializer,
    HomePromotionAdminSerializer,
    HomePromotionSerializer,
    ManualStockAdjustmentSerializer,
    ProductSerializer,
    PurchaseOrderSerializer,
    StockMovementSerializer,
    SupplierSerializer,
)
from .stock import apply_stock_movement


def _product_unit_label(product):
    return (product.unit_label or '').strip() or 'หน่วย'


def _admin_store_low_stock_threshold() -> int:
    """ค่าเตือนใกล้หมดระดับร้าน — ให้สอดคล้องกับ Product.is_low_stock"""
    try:
        from orders.models import StoreLocation

        loc = StoreLocation.objects.order_by('id').first()
        if loc is not None:
            return int(loc.low_stock_alert_quantity)
    except Exception:
        pass
    return 5


def _admin_product_list_queryset_filtered(qs, stock_filter: str):
    """
    stock_filter: all | low | out | promo | featured
    promo = มีราคาก่อนลดจริง (compare_at_price > ราคาขาย)
    featured = สินค้าแนะนำบนหน้าแรก (คนละอย่างกับโปรลดราคา)
    """
    key = (stock_filter or 'all').strip().lower()
    if key in ('', 'all'):
        return qs

    qs = qs.annotate(
        _avail=Greatest(
            Value(0),
            ExpressionWrapper(F('stock_quantity') - F('reserved_quantity'), output_field=IntegerField()),
        ),
    )
    if key == 'promo':
        return qs.filter(compare_at_price__isnull=False).filter(compare_at_price__gt=F('price'))
    if key == 'featured':
        return qs.filter(is_featured=True)
    if key == 'out':
        return qs.filter(_avail__lte=0)
    if key == 'low':
        store_thr = _admin_store_low_stock_threshold()
        low_cond = Q(_avail__lte=F('min_stock_level'))
        if store_thr > 0:
            low_cond |= Q(_avail__lte=store_thr)
        return qs.filter(low_cond).exclude(_avail__lte=0)
    return qs


def _audit_log_product_create(instance):
    u = _product_unit_label(instance)
    action_th = f'เพิ่มสินค้า — สต็อกเริ่มต้น {instance.stock_quantity} {u} · ราคา ฿{instance.price}'
    summary = f'«{instance.name}» {action_th}'
    detail = {
        'product_id': instance.id,
        'name': instance.name,
        'stock_quantity': instance.stock_quantity,
        'unit_label': u,
        'price': str(instance.price),
        'action_label_th': action_th[:300],
    }
    return summary[:500], detail


def _audit_log_product_update(instance, old, validated_data):
    """old: snapshot ก่อนบันทึก — บันทึกเฉพาะฟิลด์ที่ส่งมาใน request (validated_data)"""
    u = _product_unit_label(instance)
    pieces = []
    detail = {
        'product_id': instance.id,
        'name': instance.name,
    }

    if 'stock_quantity' in validated_data:
        new = int(instance.stock_quantity)
        prev = int(old['stock_quantity'])
        delta = new - prev
        detail['stock_before'] = prev
        detail['stock_after'] = new
        detail['stock_delta'] = delta
        detail['stock_unit'] = u
        if delta > 0:
            pieces.append(f'เพิ่มสต็อก {delta} {u} (เหลือ {new} จากเดิม {prev})')
        elif delta < 0:
            pieces.append(f'ลดสต็อก {-delta} {u} (เหลือ {new} จากเดิม {prev})')
        else:
            pieces.append(f'สต็อกไม่เปลี่ยน ({new} {u})')

    if 'price' in validated_data:
        pieces.append(f'ราคา {old["price"]} → {instance.price} บาท')
        detail['price_before'] = str(old['price'])
        detail['price_after'] = str(instance.price)

    if 'is_available' in validated_data:
        pieces.append('เปิดขาย' if instance.is_available else 'ปิดขาย')

    if 'is_special_offer' in validated_data:
        pieces.append('ตั้งเป็นป้ายราคาพิเศษ' if instance.is_special_offer else 'ยกเลิกป้ายราคาพิเศษ')

    if 'is_featured' in validated_data:
        pieces.append('ตั้งเป็นสินค้าแนะนำ' if instance.is_featured else 'ยกเลิกสินค้าแนะนำ')

    if 'name' in validated_data and instance.name != old['name']:
        pieces.append(f'ชื่อ «{old["name"]}» → «{instance.name}»')

    if 'category' in validated_data and instance.category_id != old['category_id']:
        pieces.append('เปลี่ยนหมวดหมู่')
        detail['category_id_before'] = old['category_id']
        detail['category_id_after'] = instance.category_id

    if 'description' in validated_data:
        pieces.append('แก้คำอธิบายสินค้า')

    if 'unit_label' in validated_data or 'unit_detail' in validated_data:
        ud = f' ({instance.unit_detail})' if instance.unit_detail else ''
        pieces.append(f'หน่วยเป็น {instance.unit_label or "-"}{ud}')

    if 'image' in validated_data:
        pieces.append('เปลี่ยนรูปสินค้า')
    if 'min_stock_level' in validated_data:
        pieces.append(f'จุดเตือนสต็อกต่ำเป็น {instance.min_stock_level}')

    if not pieces:
        pieces.append('บันทึกข้อมูลสินค้า')

    action_th = ' · '.join(pieces)
    detail['action_label_th'] = action_th[:400]
    summary = f'«{instance.name}» {action_th}'[:500]
    return summary, detail


def _home_promotion_audit_snapshot(obj):
    """ข้อมูลสำหรับบันทึก audit / เปรียบเทียบก่อน–หลังแก้ไขแบนเนอร์หน้าแรก"""
    return {
        'promotion_id': obj.id,
        'title': (obj.title or '')[:120],
        'link_target': obj.link_target,
        'link_category_id': obj.link_category_id,
        'link_product_id': obj.link_product_id,
        'link_label': (obj.link_label or '')[:80],
        'link_url': (obj.link_url or '')[:200],
        'icon': (obj.icon or '')[:20],
        'sort_order': obj.sort_order,
        'is_active': obj.is_active,
        'has_banner': bool(obj.banner_image),
    }


def _audit_log_home_promotion_create(instance):
    label = (instance.title or '').strip() or f'#{instance.id}'
    action_th = f'เพิ่มแบนเนอร์/โปรหน้าแรก «{label}»'
    detail = _home_promotion_audit_snapshot(instance)
    detail['action_label_th'] = action_th[:300]
    return f'{action_th} (รหัส #{instance.id})'[:500], detail


def _audit_log_home_promotion_update(old_snap, instance, validated_data):
    new_snap = _home_promotion_audit_snapshot(instance)
    pieces = []
    if old_snap.get('title') != new_snap.get('title'):
        pieces.append(
            f'หัวข้อ «{old_snap.get("title") or "—"}» → «{new_snap.get("title") or "—"}»'
        )
    if old_snap.get('link_target') != new_snap.get('link_target'):
        pieces.append('เปลี่ยนเป้าหมายลิงก์')
    if old_snap.get('sort_order') != new_snap.get('sort_order'):
        pieces.append(f'ลำดับ {old_snap.get("sort_order")} → {new_snap.get("sort_order")}')
    if old_snap.get('is_active') != new_snap.get('is_active'):
        pieces.append('เปลี่ยนสถานะแสดง/ปิด')
    if validated_data.get('banner_image') or validated_data.get('remove_banner_image'):
        if validated_data.get('remove_banner_image'):
            pieces.append('ลบรูปแบนเนอร์')
        else:
            pieces.append('เปลี่ยน/อัปโหลดรูปแบนเนอร์')
    elif old_snap.get('has_banner') != new_snap.get('has_banner'):
        pieces.append('เปลี่ยนรูปแบนเนอร์')
    if old_snap.get('link_category_id') != new_snap.get('link_category_id'):
        pieces.append('เปลี่ยนหมวดลิงก์')
    if old_snap.get('link_product_id') != new_snap.get('link_product_id'):
        pieces.append('เปลี่ยนสินค้าลิงก์')
    if old_snap.get('link_url') != new_snap.get('link_url') or old_snap.get('link_label') != new_snap.get('link_label'):
        pieces.append('แก้ข้อความปุ่ม/ลิงก์')
    if not pieces:
        pieces.append('บันทึกแบนเนอร์หน้าแรก')
    action_th = ' · '.join(pieces)
    detail = {**new_snap, 'before': old_snap, 'action_label_th': action_th[:400]}
    label = (instance.title or '').strip() or f'#{instance.id}'
    summary = f'«{label}» {action_th}'[:500]
    return summary, detail


class ProductListView(generics.ListAPIView):
    """รายการสินค้าทั้งหมด"""
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    search_fields = ['name', 'description', 'category__name']
    ordering_fields = ['id', 'name', 'price', 'created_at', 'stock_quantity']
    ordering = ['category_id', 'name']

    def get_queryset(self):
        queryset = Product.objects.filter(is_available=True).select_related('category')

        # Filter by category
        category_id = self.request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        # สินค้าแนะนำ (หน้าแรก)
        featured = self.request.query_params.get('featured')
        if featured == 'true':
            queryset = queryset.filter(is_featured=True)

        # เดิม: กรองป้ายโปร — เก็บไว้ให้ลิงก์/API เก่า (ไม่ใช่หมวดแนะนำ)
        special_offer = self.request.query_params.get('special_offer')
        if special_offer == 'true':
            queryset = queryset.filter(is_special_offer=True)

        # หน้าแรก / ลิงก์ — เฉพาะสินค้าที่ตั้งราคาก่อนลดสูงกว่าราคาขายจริง (ไม่ใช้ป้าย is_special_offer)
        on_sale = self.request.query_params.get('on_sale')
        if on_sale == 'true':
            queryset = queryset.filter(
                compare_at_price__isnull=False,
                compare_at_price__gt=F('price'),
            )

        return queryset.annotate(available_quantity_calc=F('stock_quantity') - F('reserved_quantity')).annotate(
            _listing_stock_sort=Case(
                When(available_quantity_calc__gt=0, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            ),
        )

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        prior = tuple(queryset.query.order_by)
        if not prior:
            prior = ('category_id', 'name')
        return queryset.order_by('_listing_stock_sort', *prior)


class ProductDetailView(generics.RetrieveAPIView):
    """รายละเอียดสินค้า (public)"""
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.filter(is_available=True).select_related('category')


class CategoryListView(generics.ListAPIView):
    """รายการหมวดหมู่สินค้า (ไม่แบ่งหน้า — ใช้เติม dropdown / filter)"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class HomePromotionListView(generics.ListAPIView):
    """การ์ดโปรโมชั่น/แบนเนอร์หน้าแรก (ลูกค้า — เปิดใช้เท่านั้น)"""

    serializer_class = HomePromotionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return HomePromotion.objects.filter(is_active=True).order_by('sort_order', 'id')


class IsStoreAdminOrSuperAdmin(BasePermission):
    """Allow only store admins/super admins."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj:
            return hasattr(request.user, 'admin_profile')
        return role_obj.role in ['store_admin', 'super_admin', 'admin']


class AdminHomePromotionListCreateView(generics.ListCreateAPIView):
    """แอดมิน — รายการและสร้างการ์ดโปรโมชั่นหน้าแรก"""

    serializer_class = HomePromotionAdminSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    queryset = HomePromotion.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ('title', 'description', 'link_label', 'link_url')
    ordering_fields = ('id', 'sort_order', 'title', 'created_at', 'is_active', 'updated_at')
    ordering = ('sort_order', 'id')

    def perform_create(self, serializer):
        instance = serializer.save()
        summary, detail = _audit_log_home_promotion_create(instance)
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.HOME_PROMOTION_CREATE,
            target_type='home_promotion',
            target_id=str(instance.id),
            summary=summary,
            detail=detail,
        )


class AdminHomePromotionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """แอดมิน — ดู / แก้ / ลบการ์ดโปรโมชั่นหน้าแรก"""

    queryset = HomePromotion.objects.all()
    serializer_class = HomePromotionAdminSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def perform_update(self, serializer):
        old_snap = _home_promotion_audit_snapshot(serializer.instance)
        vd = dict(serializer.validated_data)
        instance = serializer.save()
        summary, detail = _audit_log_home_promotion_update(old_snap, instance, vd)
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.HOME_PROMOTION_UPDATE,
            target_type='home_promotion',
            target_id=str(instance.id),
            summary=summary,
            detail=detail,
        )

    def destroy(self, request, *args, **kwargs):
        promotion = self.get_object()
        pid = promotion.id
        title = (promotion.title or '').strip() or f'#{pid}'
        snap = _home_promotion_audit_snapshot(promotion)
        response = super().destroy(request, *args, **kwargs)
        if response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT):
            action_th = f'ลบแบนเนอร์/โปรหน้าแรก «{title}»'
            log_staff_audit(
                request,
                StaffAuditLog.Action.HOME_PROMOTION_DELETE,
                target_type='home_promotion',
                target_id=str(pid),
                summary=f'{action_th} (รหัส #{pid})'[:500],
                detail={**snap, 'action_label_th': action_th[:300]},
            )
        return response


class AdminProductListCreateView(generics.ListCreateAPIView):
    """Admin product list/create."""
    queryset = Product.objects.all().select_related('category').order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ('name', 'description', 'category__name')
    ordering_fields = (
        'id',
        'name',
        'price',
        'compare_at_price',
        'created_at',
        'stock_quantity',
        'reserved_quantity',
        'category__name',
        'is_available',
        'is_featured',
    )
    ordering = ('-id',)

    def get_queryset(self):
        qs = Product.objects.all().select_related('category')
        if self.request.method != 'GET':
            return qs.order_by('-id')
        raw_cat = (self.request.query_params.get('category_id') or '').strip()
        if raw_cat.isdigit():
            qs = qs.filter(category_id=int(raw_cat))
        stock_filter = self.request.query_params.get('stock_filter', 'all')
        return _admin_product_list_queryset_filtered(qs, stock_filter)

    def perform_create(self, serializer):
        instance = serializer.save()
        summary, detail = _audit_log_product_create(instance)
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.PRODUCT_CREATE,
            target_type='product',
            target_id=str(instance.id),
            summary=summary,
            detail=detail,
        )


class AdminProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin product update/delete."""
    queryset = Product.objects.all().select_related('category')
    serializer_class = ProductSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]

    def perform_update(self, serializer):
        old_inst = serializer.instance
        old = {
            'name': old_inst.name,
            'stock_quantity': old_inst.stock_quantity,
            'price': old_inst.price,
            'is_available': old_inst.is_available,
            'is_featured': old_inst.is_featured,
            'is_special_offer': old_inst.is_special_offer,
            'category_id': old_inst.category_id,
        }
        incoming_fields = dict(serializer.validated_data)
        stock_in_payload = 'stock_quantity' in incoming_fields
        target_stock = int(incoming_fields.get('stock_quantity', old_inst.stock_quantity))
        if stock_in_payload:
            # ให้การเปลี่ยนสต็อกจากหน้าสินค้าใช้ movement flow เดียวกับหน้าจัดการสต็อก
            serializer.validated_data.pop('stock_quantity', None)

        with transaction.atomic():
            instance = serializer.save()
            if stock_in_payload:
                delta = target_stock - int(old['stock_quantity'])
                if delta:
                    movement_type = 'adjustment_in' if delta > 0 else 'adjustment_out'
                    apply_stock_movement(
                        product_id=instance.id,
                        movement_type=movement_type,
                        quantity_change=delta,
                        reserved_change=0,
                        source_type='admin_product_edit',
                        source_id=str(instance.id),
                        reference=f'product:{instance.id}',
                        note='ปรับสต็อกจากหน้าจัดการสินค้า',
                        actor=self.request.user,
                    )
                    instance.refresh_from_db()

        summary, detail = _audit_log_product_update(instance, old, incoming_fields)
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.PRODUCT_UPDATE,
            target_type='product',
            target_id=str(instance.id),
            summary=summary,
            detail=detail,
        )

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        if product.orderitem_set.exists():
            return Response(
                {'error': 'ไม่สามารถลบสินค้าที่มีประวัติคำสั่งซื้อได้ กรุณาปิดขายแทน'},
                status=status.HTTP_400_BAD_REQUEST
            )
        pid, pname = product.id, product.name
        response = super().destroy(request, *args, **kwargs)
        if response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT):
            action_th = f'ลบสินค้าออกจากระบบ — «{pname}» (รหัส #{pid})'
            log_staff_audit(
                request,
                StaffAuditLog.Action.PRODUCT_DELETE,
                target_type='product',
                target_id=str(pid),
                summary=action_th[:500],
                detail={
                    'name': pname,
                    'product_id': pid,
                    'action_label_th': action_th[:300],
                },
            )
        return response


class AdminCategoryListCreateView(generics.ListCreateAPIView):
    """Admin category list/create."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ('name', 'description')
    ordering_fields = ('id', 'name', 'created_at')
    ordering = ('name',)

    def create(self, request, *args, **kwargs):
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'กรุณากรอกชื่อหมวดหมู่'}, status=status.HTTP_400_BAD_REQUEST)
        if Category.objects.filter(name__iexact=name).exists():
            return Response({'error': 'ชื่อหมวดหมู่นี้มีอยู่แล้ว'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save()
        action_th = f'เพิ่มหมวดหมู่ «{instance.name}»'
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.CATEGORY_CREATE,
            target_type='category',
            target_id=str(instance.id),
            summary=f'{action_th} (รหัส #{instance.id})',
            detail={
                'name': instance.name,
                'category_id': instance.id,
                'action_label_th': action_th[:300],
            },
        )


class AdminCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Admin category update/delete."""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def update(self, request, *args, **kwargs):
        category = self.get_object()
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'กรุณากรอกชื่อหมวดหมู่'}, status=status.HTTP_400_BAD_REQUEST)
        if Category.objects.filter(name__iexact=name).exclude(id=category.id).exists():
            return Response({'error': 'ชื่อหมวดหมู่นี้มีอยู่แล้ว'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        old_name = serializer.instance.name
        instance = serializer.save()
        vd = serializer.validated_data
        pieces = []
        if 'name' in vd and instance.name != old_name:
            pieces.append(f'ชื่อหมวด «{old_name}» → «{instance.name}»')
        if 'description' in vd:
            pieces.append('แก้คำอธิบายหมวด')
        if not pieces:
            pieces.append(f'แก้ไขหมวด «{instance.name}»')
        action_th = ' · '.join(pieces)
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.CATEGORY_UPDATE,
            target_type='category',
            target_id=str(instance.id),
            summary=f'«{instance.name}» {action_th}'[:500],
            detail={
                'name': instance.name,
                'category_id': instance.id,
                'action_label_th': action_th[:300],
            },
        )

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if category.products.exists():
            return Response(
                {'error': 'ไม่สามารถลบหมวดหมู่ที่ยังมีสินค้าอยู่ได้'},
                status=status.HTTP_400_BAD_REQUEST
            )
        cid, cname = category.id, category.name
        response = super().destroy(request, *args, **kwargs)
        if response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT):
            action_th = f'ลบหมวดหมู่ «{cname}» (รหัส #{cid})'
            log_staff_audit(
                request,
                StaffAuditLog.Action.CATEGORY_DELETE,
                target_type='category',
                target_id=str(cid),
                summary=action_th[:500],
                detail={
                    'name': cname,
                    'category_id': cid,
                    'action_label_th': action_th[:300],
                },
            )
        return response


class AdminInventoryOverviewView(APIView):
    permission_classes = [IsStoreAdminOrSuperAdmin]

    def get(self, request):
        products = Product.objects.all()
        agg = products.aggregate(
            total_on_hand=Sum('stock_quantity'),
            total_reserved=Sum('reserved_quantity'),
            stock_value=Sum(F('stock_quantity') * F('price')),
        )
        from orders.models import StoreLocation

        loc = StoreLocation.objects.order_by('id').first()
        store_thr = int(loc.low_stock_alert_quantity) if loc else 5
        q_prod = Q(stock_quantity__lte=F('reserved_quantity') + F('min_stock_level'))
        if store_thr > 0:
            q_store = Q(stock_quantity__lte=F('reserved_quantity') + store_thr)
            low_stock_count = products.filter(Q(is_available=True) & (q_prod | q_store)).count()
        else:
            low_stock_count = products.filter(is_available=True).filter(q_prod).count()
        out_of_stock_count = products.filter(
            is_available=True,
            stock_quantity__lte=F('reserved_quantity'),
        ).count()
        return Response({
            'total_products': products.count(),
            'total_on_hand': int(agg.get('total_on_hand') or 0),
            'total_reserved': int(agg.get('total_reserved') or 0),
            'total_available': int((agg.get('total_on_hand') or 0) - (agg.get('total_reserved') or 0)),
            'inventory_value': float(agg.get('stock_value') or 0),
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
        })


class AdminStockMovementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsStoreAdminOrSuperAdmin]
    serializer_class = StockMovementSerializer
    queryset = StockMovement.objects.select_related('product', 'created_by').all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ('product__name', 'reference', 'source_id', 'note', 'movement_type', 'source_type')
    ordering_fields = ('id', 'created_at', 'quantity_change', 'movement_type')
    ordering = ('-created_at', '-id')

    def get_queryset(self):
        qs = super().get_queryset()
        q = (self.request.query_params.get('q') or '').strip()
        product_id = self.request.query_params.get('product_id')
        movement_type = self.request.query_params.get('movement_type')
        source_type = self.request.query_params.get('source_type')
        if product_id:
            qs = qs.filter(product_id=product_id)
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        if source_type:
            qs = qs.filter(source_type=source_type)
        if q:
            qs = qs.filter(
                Q(product__name__icontains=q)
                | Q(reference__icontains=q)
                | Q(source_id__icontains=q)
                | Q(note__icontains=q)
            )
        return qs

    def create(self, request, *args, **kwargs):
        payload = ManualStockAdjustmentSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        product, movement = apply_stock_movement(
            product_id=data['product_id'],
            movement_type=data['movement_type'],
            quantity_change=data['quantity_change'],
            reserved_change=0,
            source_type='manual_adjustment',
            source_id='',
            reference=data.get('reference', ''),
            note=data.get('note', ''),
            actor=request.user,
        )
        action_th = (
            f'ปรับสต็อกสินค้า «{product.name}» '
            f'{"+" if data["quantity_change"] > 0 else ""}{data["quantity_change"]} '
            f'{product.unit_label or "หน่วย"}'
        )
        log_staff_audit(
            request,
            StaffAuditLog.Action.INVENTORY_ADJUSTMENT,
            target_type='product',
            target_id=str(product.id),
            summary=action_th[:500],
            detail={
                'product_id': product.id,
                'movement_id': movement.id,
                'movement_type': movement.movement_type,
                'quantity_change': movement.quantity_change,
                'stock_before': movement.quantity_before,
                'stock_after': movement.quantity_after,
                'reserved_before': movement.reserved_before,
                'reserved_after': movement.reserved_after,
                'note': movement.note,
                'action_label_th': action_th[:300],
            },
        )
        return Response(StockMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class AdminSupplierListCreateView(generics.ListCreateAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = Supplier.objects.all()
    pagination_class = None
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ('name', 'contact_name', 'phone', 'email', 'address')
    ordering_fields = ('id', 'name', 'created_at', 'is_active', 'phone')
    ordering = ('name',)

    def perform_create(self, serializer):
        instance = serializer.save()
        al = f'เพิ่มผู้จำหน่าย «{instance.name}»'
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.SUPPLIER_CREATE,
            target_type='supplier',
            target_id=str(instance.id),
            summary=f'{al} (รหัส #{instance.id})'[:500],
            detail={
                'supplier_id': instance.id,
                'name': instance.name,
                'action_label_th': al[:300],
            },
        )


class AdminSupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = Supplier.objects.all()

    def perform_update(self, serializer):
        old = {
            'name': serializer.instance.name,
            'phone': serializer.instance.phone or '',
            'is_active': serializer.instance.is_active,
        }
        instance = serializer.save()
        vd = serializer.validated_data
        pieces = []
        if 'name' in vd and instance.name != old['name']:
            pieces.append(f'ชื่อ «{old["name"]}» → «{instance.name}»')
        if 'phone' in vd:
            pieces.append('แก้เบอร์/ช่องทางติดต่อ')
        if 'is_active' in vd and instance.is_active != old['is_active']:
            pieces.append('เปลี่ยนสถานะใช้งาน')
        if set(vd) & {'contact_name', 'email', 'address'}:
            pieces.append('แก้ข้อมูลผู้ติดต่อ/ที่อยู่')
        if not pieces:
            pieces.append('แก้ไขผู้จำหน่าย')
        action_th = ' · '.join(pieces)
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.SUPPLIER_UPDATE,
            target_type='supplier',
            target_id=str(instance.id),
            summary=f'«{instance.name}» {action_th}'[:500],
            detail={
                'supplier_id': instance.id,
                'name': instance.name,
                'action_label_th': action_th[:400],
            },
        )

    def destroy(self, request, *args, **kwargs):
        supplier = self.get_object()
        sid, sname = supplier.id, supplier.name
        response = super().destroy(request, *args, **kwargs)
        if response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT):
            al = f'ลบผู้จำหน่าย «{sname}»'
            log_staff_audit(
                request,
                StaffAuditLog.Action.SUPPLIER_DELETE,
                target_type='supplier',
                target_id=str(sid),
                summary=f'{al} (รหัส #{sid})'[:500],
                detail={'supplier_id': sid, 'name': sname, 'action_label_th': al[:300]},
            )
        return response


class AdminPurchaseOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = PurchaseOrder.objects.select_related('supplier', 'created_by').prefetch_related('items__product')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ('reference', 'notes', 'supplier__name')
    ordering_fields = ('id', 'created_at', 'updated_at', 'status', 'reference', 'expected_date')
    ordering = ('-created_at',)

    def get_queryset(self):
        qs = super().get_queryset()
        status_q = self.request.query_params.get('status')
        supplier_id = self.request.query_params.get('supplier_id')
        q = (self.request.query_params.get('q') or '').strip()
        if status_q:
            qs = qs.filter(status=status_q)
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)
        if q:
            qs = qs.filter(Q(reference__icontains=q) | Q(notes__icontains=q) | Q(supplier__name__icontains=q))
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        sup_name = instance.supplier.name if instance.supplier_id else ''
        al = f'สร้างใบสั่งซื้อ {instance.reference}' + (f' ({sup_name})' if sup_name else '')
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.PURCHASE_ORDER_CREATE,
            target_type='purchase_order',
            target_id=str(instance.id),
            summary=al[:500],
            detail={
                'purchase_order_id': instance.id,
                'reference': instance.reference,
                'supplier_id': instance.supplier_id,
                'supplier_name': sup_name,
                'items_count': instance.items.count(),
                'action_label_th': al[:300],
            },
        )


class AdminPurchaseOrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = PurchaseOrder.objects.select_related('supplier', 'created_by').prefetch_related('items__product')

    def perform_update(self, serializer):
        old_inst = serializer.instance
        old_status = old_inst.status
        old_supplier_id = old_inst.supplier_id
        instance = serializer.save()
        vd = serializer.validated_data
        pieces = []
        if vd.get('supplier') is not None and instance.supplier_id != old_supplier_id:
            pieces.append('เปลี่ยนผู้จำหน่าย')
        if vd.get('status') is not None and instance.status != old_status:
            pieces.append(f'สถานะ → {instance.get_status_display()}')
        if 'items' in vd:
            pieces.append('แก้รายการสินค้าในใบ')
        if vd.keys() & {'notes', 'expected_date'}:
            pieces.append('แก้หมายเหตุหรือวันที่คาดรับ')
        if not pieces:
            pieces.append('แก้ไขใบสั่งซื้อ')
        action_th = ' · '.join(pieces)
        al = f'{instance.reference}: {action_th}'
        log_staff_audit(
            self.request,
            StaffAuditLog.Action.PURCHASE_ORDER_UPDATE,
            target_type='purchase_order',
            target_id=str(instance.id),
            summary=al[:500],
            detail={
                'purchase_order_id': instance.id,
                'reference': instance.reference,
                'status': instance.status,
                'action_label_th': al[:400],
            },
        )

    def destroy(self, request, *args, **kwargs):
        po = self.get_object()
        pid, ref = po.id, po.reference
        response = super().destroy(request, *args, **kwargs)
        if response.status_code in (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT):
            al = f'ลบใบสั่งซื้อ {ref}'
            log_staff_audit(
                request,
                StaffAuditLog.Action.PURCHASE_ORDER_DELETE,
                target_type='purchase_order',
                target_id=str(pid),
                summary=al[:500],
                detail={
                    'purchase_order_id': pid,
                    'reference': ref,
                    'action_label_th': al[:300],
                },
            )
        return response


class AdminPurchaseOrderReceiveView(APIView):
    permission_classes = [IsStoreAdminOrSuperAdmin]

    def post(self, request, pk):
        purchase_order = get_object_or_404(
            PurchaseOrder.objects.prefetch_related('items__product').select_related('supplier'),
            pk=pk,
        )
        receipts = request.data.get('items', [])
        if not isinstance(receipts, list) or not receipts:
            return Response({'error': 'กรุณาระบุรายการรับเข้า'}, status=status.HTTP_400_BAD_REQUEST)

        received_any = False
        for line in receipts:
            item_id = line.get('item_id')
            receive_qty = int(line.get('receive_quantity') or 0)
            if receive_qty <= 0:
                continue
            po_item = purchase_order.items.filter(pk=item_id).select_related('product').first()
            if not po_item:
                continue
            remaining = int(po_item.ordered_quantity or 0) - int(po_item.received_quantity or 0)
            if remaining <= 0:
                continue
            accepted_qty = min(remaining, receive_qty)
            po_item.received_quantity = int(po_item.received_quantity or 0) + accepted_qty
            po_item.save(update_fields=['received_quantity'])
            apply_stock_movement(
                product_id=po_item.product_id,
                movement_type='purchase_receipt',
                quantity_change=accepted_qty,
                reserved_change=0,
                source_type='purchase_order',
                source_id=purchase_order.reference,
                reference=f'{purchase_order.reference}:{po_item.id}',
                note=f'รับเข้าจากใบสั่งซื้อ {purchase_order.reference}',
                actor=request.user,
                unit_cost=po_item.unit_cost,
            )
            received_any = True

        if not received_any:
            return Response({'error': 'ไม่มีรายการรับเข้าที่ถูกต้อง'}, status=status.HTTP_400_BAD_REQUEST)

        total_ordered = sum(int(i.ordered_quantity or 0) for i in purchase_order.items.all())
        total_received = sum(int(i.received_quantity or 0) for i in purchase_order.items.all())
        if total_received <= 0:
            next_status = 'approved'
        elif total_received < total_ordered:
            next_status = 'partial_received'
        else:
            next_status = 'received'
        if purchase_order.status != next_status:
            purchase_order.status = next_status
            purchase_order.save(update_fields=['status', 'updated_at'])

        al = f'รับเข้าจากใบสั่งซื้อ {purchase_order.reference}'
        log_staff_audit(
            request,
            StaffAuditLog.Action.PURCHASE_ORDER_RECEIVE,
            target_type='purchase_order',
            target_id=str(purchase_order.id),
            summary=f'{al} (สถานะ {purchase_order.get_status_display()})'[:500],
            detail={
                'purchase_order_id': purchase_order.id,
                'reference': purchase_order.reference,
                'status': purchase_order.status,
                'total_ordered': total_ordered,
                'total_received': total_received,
                'action_label_th': al[:300],
            },
        )
        purchase_order.refresh_from_db()
        return Response(PurchaseOrderSerializer(purchase_order, context={'request': request}).data)