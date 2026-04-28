from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.permissions import BasePermission
from accounts.models import StaffAuditLog
from accounts.staff_audit import log_staff_audit
from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


def _product_unit_label(product):
    return (product.unit_label or '').strip() or 'หน่วย'


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
        pieces.append('ตั้งเป็นโปรพิเศษ' if instance.is_special_offer else 'ยกเลิกโปรพิเศษ')

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

        # Filter special offers
        special_offer = self.request.query_params.get('special_offer')
        if special_offer == 'true':
            queryset = queryset.filter(is_special_offer=True)

        return queryset


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


class AdminProductListCreateView(generics.ListCreateAPIView):
    """Admin product list/create."""
    queryset = Product.objects.all().select_related('category').order_by('-id')
    serializer_class = ProductSerializer
    permission_classes = [IsStoreAdminOrSuperAdmin]

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
            'is_special_offer': old_inst.is_special_offer,
            'category_id': old_inst.category_id,
        }
        instance = serializer.save()
        summary, detail = _audit_log_product_update(instance, old, serializer.validated_data)
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