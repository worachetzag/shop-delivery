"""
ซิงค์สต็อกกับสถานะออเดอร์ — หักตอนสร้างออเดอร์ (serializer) คืนตอนยกเลิก
ไม่บันทึกในประวัติพนักงาน (ใช้ F() update โดยตรง) — ข้อความ audit สร้างจาก meta ที่คืนกลับ
"""
from collections import Counter, defaultdict

from django.db import transaction
from django.db.models import F

from products.models import Product


def _quantities_by_product(order):
    counts = Counter()
    for item in order.items.all():
        counts[item.product_id] += int(item.quantity)
    return counts


def _aggregated_line_items(order):
    """รวมจำนวนต่อ product_id สำหรับแสดงใน audit"""
    agg = defaultdict(lambda: {'name': '', 'quantity': 0})
    for it in order.items.select_related('product').all():
        pid = it.product_id
        agg[pid]['name'] = it.product.name
        agg[pid]['quantity'] += int(it.quantity)
    return [
        {'product_id': pid, 'name': data['name'], 'quantity': data['quantity']}
        for pid, data in sorted(agg.items(), key=lambda x: x[0])
    ]


def format_order_stock_audit_label(
    order_id: int,
    old_status: str,
    new_status: str,
    stock_meta: dict,
    *,
    source: str = 'admin',
) -> str:
    """ข้อความภาษาไทยสำหรับคอลัมน์การกระทำ / สรุปในประวัติ"""
    from .models import Order

    old_d = dict(Order.STATUS_CHOICES).get(old_status, old_status)
    new_d = dict(Order.STATUS_CHOICES).get(new_status, new_status)
    prefix = '[คนขับ] ' if source == 'driver' else ''
    parts = [f'{prefix}ออเดอร์ #{order_id}: {old_d} → {new_d}']

    if stock_meta.get('restocked') and stock_meta.get('restock_items'):
        line = ', '.join(f"«{x['name']}» ×{x['quantity']}" for x in stock_meta['restock_items'])
        parts.append(f'คืนสต็อกเข้าคลัง: {line}')
    elif new_status == 'cancelled' and old_status != 'cancelled':
        if stock_meta.get('restock_skipped_delivered'):
            parts.append('ไม่คืนสต็อก (จัดส่งสำเร็จแล้ว — สินค้าออกจากร้าน)')
        elif stock_meta.get('restock_skipped_not_reserved'):
            parts.append('ไม่คืนสต็อก (ออเดอร์นี้ไม่ได้หักคลังตอนสร้าง)')
        elif stock_meta.get('restock_skipped_already_restocked'):
            parts.append('ไม่คืนสต็อก (เคยคืนแล้ว)')

    if stock_meta.get('rededucted') and stock_meta.get('rededuct_items'):
        line = ', '.join(f"«{x['name']}» ×{x['quantity']}" for x in stock_meta['rededuct_items'])
        parts.append(f'หักสต็อกกลับจากคลัง: {line}')

    return ' · '.join(parts)[:450]


@transaction.atomic
def sync_order_stock_for_status_change(order, old_status: str, new_status: str):
    """
    คืน (order, meta) — meta ใช้ประกอบ audit / UI

    meta keys:
      restocked, restock_items,
      restock_skipped_delivered, restock_skipped_not_reserved, restock_skipped_already_restocked,
      rededucted, rededuct_items
    """
    from .models import Order

    meta = {
        'restocked': False,
        'restock_items': [],
        'restock_skipped_delivered': False,
        'restock_skipped_not_reserved': False,
        'restock_skipped_already_restocked': False,
        'rededucted': False,
        'rededuct_items': [],
    }

    order = Order.objects.select_for_update().get(pk=order.pk)

    # --- เข้าสู่ cancelled ---
    if new_status == 'cancelled' and old_status != 'cancelled':
        if old_status == 'delivered':
            meta['restock_skipped_delivered'] = True
            return order, meta
        if not order.inventory_reserved:
            meta['restock_skipped_not_reserved'] = True
            return order, meta
        if order.stock_restocked_on_cancel:
            meta['restock_skipped_already_restocked'] = True
            return order, meta

        restock_items = _aggregated_line_items(order)
        counts = _quantities_by_product(order)
        for pid, qty in counts.items():
            Product.objects.filter(pk=pid).update(stock_quantity=F('stock_quantity') + qty)
        order.stock_restocked_on_cancel = True
        order.save(update_fields=['stock_restocked_on_cancel', 'updated_at'])
        meta['restocked'] = True
        meta['restock_items'] = restock_items
        return order, meta

    # --- ออกจาก cancelled ---
    if old_status == 'cancelled' and new_status != 'cancelled':
        if not order.inventory_reserved or not order.stock_restocked_on_cancel:
            return order, meta

        rededuct_items = _aggregated_line_items(order)
        counts = _quantities_by_product(order)
        for pid, qty in counts.items():
            product = Product.objects.select_for_update().get(pk=pid)
            if product.stock_quantity < qty:
                raise ValueError(
                    f'สต็อกสินค้า "{product.name}" ไม่พอสำหรับเปิดออเดอร์นี้ต่อ '
                    f'(ต้องการ {qty} เหลือ {product.stock_quantity})'
                )
        for pid, qty in counts.items():
            n = Product.objects.filter(pk=pid, stock_quantity__gte=qty).update(
                stock_quantity=F('stock_quantity') - qty
            )
            if n != 1:
                raise ValueError('สต็อกไม่พอ กรุณาลองใหม่')
        order.stock_restocked_on_cancel = False
        order.save(update_fields=['stock_restocked_on_cancel', 'updated_at'])
        meta['rededucted'] = True
        meta['rededuct_items'] = rededuct_items
        return order, meta

    return order, meta
