"""
ซิงค์สต็อกกับสถานะออเดอร์ — หักตอนสร้างออเดอร์ (serializer) คืนตอนยกเลิก
ไม่บันทึกในประวัติพนักงาน (ใช้ F() update โดยตรง) — ข้อความ audit สร้างจาก meta ที่คืนกลับ
"""
from collections import Counter, defaultdict

from django.db import transaction

from products.models import Product
from products.stock import apply_stock_movement


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

    # --- เข้าสู่ delivered (ตัดจริง) ---
    if new_status == 'delivered' and old_status != 'delivered':
        if order.inventory_reserved:
            commit_items = _aggregated_line_items(order)
            counts = _quantities_by_product(order)
            for pid, qty in counts.items():
                apply_stock_movement(
                    product_id=pid,
                    movement_type='sale_commit',
                    quantity_change=-qty,
                    reserved_change=-qty,
                    source_type='order',
                    source_id=order.order_number or str(order.id),
                    reference=f'order:{order.id}',
                    note=f'ตัดสต็อกจากคำสั่งซื้อ {order.order_number or order.id}',
                )
            meta['rededucted'] = True
            meta['rededuct_items'] = commit_items
        return order, meta

    # --- ออกจาก delivered (ย้อนสถานะ) ---
    if old_status == 'delivered' and new_status != 'delivered':
        rollback_items = _aggregated_line_items(order)
        counts = _quantities_by_product(order)
        for pid, qty in counts.items():
            apply_stock_movement(
                product_id=pid,
                movement_type='return_in',
                quantity_change=qty,
                reserved_change=qty,
                source_type='order',
                source_id=order.order_number or str(order.id),
                reference=f'order:{order.id}',
                note=f'ย้อนสถานะจากจัดส่งสำเร็จสำหรับคำสั่งซื้อ {order.order_number or order.id}',
            )
        meta['restocked'] = True
        meta['restock_items'] = rollback_items
        return order, meta

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

        release_items = _aggregated_line_items(order)
        counts = _quantities_by_product(order)
        for pid, qty in counts.items():
            apply_stock_movement(
                product_id=pid,
                movement_type='sale_release',
                quantity_change=0,
                reserved_change=-qty,
                source_type='order',
                source_id=order.order_number or str(order.id),
                reference=f'order:{order.id}',
                note=f'คืนจองจากคำสั่งซื้อที่ยกเลิก {order.order_number or order.id}',
            )
        order.stock_restocked_on_cancel = True
        order.save(update_fields=['stock_restocked_on_cancel', 'updated_at'])
        meta['restocked'] = True
        meta['restock_items'] = release_items
        return order, meta

    # --- ออกจาก cancelled ---
    if old_status == 'cancelled' and new_status != 'cancelled':
        if not order.inventory_reserved or not order.stock_restocked_on_cancel:
            return order, meta

        reserve_items = _aggregated_line_items(order)
        counts = _quantities_by_product(order)
        for pid, qty in counts.items():
            product = Product.objects.select_for_update().get(pk=pid)
            available = int(product.stock_quantity or 0) - int(product.reserved_quantity or 0)
            if available < qty:
                raise ValueError(
                    f'สต็อกสินค้า "{product.name}" ไม่พอสำหรับเปิดออเดอร์นี้ต่อ '
                    f'(ต้องการ {qty} เหลือพร้อมขาย {available})'
                )
        for pid, qty in counts.items():
            apply_stock_movement(
                product_id=pid,
                movement_type='sale_reserve',
                quantity_change=0,
                reserved_change=qty,
                source_type='order',
                source_id=order.order_number or str(order.id),
                reference=f'order:{order.id}',
                note=f'จองสต็อกใหม่หลังยกเลิกถูกย้อนกลับ {order.order_number or order.id}',
            )
        order.stock_restocked_on_cancel = False
        order.save(update_fields=['stock_restocked_on_cancel', 'updated_at'])
        meta['rededucted'] = True
        meta['rededuct_items'] = reserve_items
        return order, meta

    return order, meta
