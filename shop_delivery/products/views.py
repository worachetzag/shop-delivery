from django.db import transaction
from django.db.models import F, IntegerField, Q, Sum, Value
from django.db.models import ExpressionWrapper
from django.db.models.functions import Greatest
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
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

        # หน้าแรก / ลิงก์ — สินค้าลดราคา (ราคาก่อนลด) หรือติดป้ายราคาพิเศษ
        on_sale = self.request.query_params.get('on_sale')
        if on_sale == 'true':
            queryset = queryset.filter(
                Q(compare_at_price__isnull=False, compare_at_price__gt=F('price'))
                | Q(is_special_offer=True)
            )

        return queryset.annotate(available_quantity_calc=F('stock_quantity') - F('reserved_quantity'))


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

    def get_queryset(self):
        return HomePromotion.objects.all().order_by('sort_order', 'id')


class AdminHomePromotionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """แอดมิน — ดู / แก้ / ลบการ์ดโปรโมชั่นหน้าแรก"""

    queryset = HomePromotion.objects.all()
    serializer_class = HomePromotionAdminSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]


class AdminProductListCreateView(generics.ListCreateAPIView):
    """Admin product list/create."""
    queryset = Product.objects.all().select_related('category').order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]

    def get_queryset(self):
        qs = Product.objects.all().select_related('category').order_by('-id')
        if self.request.method != 'GET':
            return qs
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
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    pagination_class = None

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
            StaffAuditLog.Action.PRODUCT_UPDATE,
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


class AdminSupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SupplierSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = Supplier.objects.all()


class AdminPurchaseOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = PurchaseOrder.objects.select_related('supplier', 'created_by').prefetch_related('items__product')

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


class AdminPurchaseOrderDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]
    queryset = PurchaseOrder.objects.select_related('supplier', 'created_by').prefetch_related('items__product')


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

        log_staff_audit(
            request,
            StaffAuditLog.Action.PRODUCT_UPDATE,
            target_type='purchase_order',
            target_id=str(purchase_order.id),
            summary=f'รับเข้าสินค้าจากใบสั่งซื้อ {purchase_order.reference}',
            detail={
                'purchase_order_id': purchase_order.id,
                'reference': purchase_order.reference,
                'status': purchase_order.status,
                'total_ordered': total_ordered,
                'total_received': total_received,
            },
        )
        purchase_order.refresh_from_db()
        return Response(PurchaseOrderSerializer(purchase_order, context={'request': request}).data)