from django.db import transaction
from django.db.models import F

from .models import Product, StockMovement


@transaction.atomic
def apply_stock_movement(
    *,
    product_id: int,
    movement_type: str,
    quantity_change: int,
    reserved_change: int = 0,
    source_type: str = '',
    source_id: str = '',
    reference: str = '',
    note: str = '',
    actor=None,
    unit_cost=None,
):
    product = Product.objects.select_for_update().get(pk=product_id)
    before_stock = int(product.stock_quantity or 0)
    before_reserved = int(product.reserved_quantity or 0)
    after_stock = before_stock + int(quantity_change or 0)
    after_reserved = before_reserved + int(reserved_change or 0)

    if after_stock < 0:
        raise ValueError(f'สต็อก "{product.name}" ไม่พอ')
    if after_reserved < 0:
        raise ValueError(f'จำนวนจอง "{product.name}" ติดลบไม่ได้')
    if after_reserved > after_stock:
        raise ValueError(f'จำนวนจอง "{product.name}" มากกว่าสต็อกจริงไม่ได้')

    Product.objects.filter(pk=product.pk).update(
        stock_quantity=F('stock_quantity') + int(quantity_change or 0),
        reserved_quantity=F('reserved_quantity') + int(reserved_change or 0),
    )

    movement = StockMovement.objects.create(
        product=product,
        movement_type=movement_type,
        quantity_change=int(quantity_change or 0),
        quantity_before=before_stock,
        quantity_after=after_stock,
        reserved_before=before_reserved,
        reserved_after=after_reserved,
        source_type=source_type or '',
        source_id=str(source_id or ''),
        reference=reference or '',
        note=note or '',
        created_by=actor if getattr(actor, 'is_authenticated', False) else None,
        unit_cost=unit_cost,
    )
    product.refresh_from_db(fields=['stock_quantity', 'reserved_quantity'])
    return product, movement

