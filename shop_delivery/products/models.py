from django.conf import settings
from django.db import models
from django.utils import timezone


class Category(models.Model):
    """หมวดหมู่สินค้า"""
    name = models.CharField(max_length=100, verbose_name="ชื่อหมวดหมู่")
    description = models.TextField(blank=True, verbose_name="คำอธิบาย")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "หมวดหมู่สินค้า"
        verbose_name_plural = "หมวดหมู่สินค้า"

    def __str__(self):
        return self.name


class Product(models.Model):
    """สินค้า"""
    name = models.CharField(max_length=200, verbose_name="ชื่อสินค้า")
    description = models.TextField(blank=True, verbose_name="คำอธิบาย")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ราคา")
    unit_label = models.CharField(max_length=50, default='ชิ้น', verbose_name="หน่วยสินค้า")
    unit_detail = models.CharField(max_length=100, blank=True, default='', verbose_name="รายละเอียดหน่วย/ขนาด")
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products', verbose_name="หมวดหมู่")
    image = models.ImageField(upload_to='products/', blank=True, null=True, verbose_name="รูปภาพ")
    stock_quantity = models.PositiveIntegerField(default=0, verbose_name="จำนวนสินค้าคงเหลือ")
    reserved_quantity = models.PositiveIntegerField(default=0, verbose_name="จำนวนที่ถูกจองจากคำสั่งซื้อ")
    min_stock_level = models.PositiveIntegerField(default=0, verbose_name="จุดแจ้งเตือนสต็อกต่ำ")
    is_available = models.BooleanField(default=True, verbose_name="พร้อมจำหน่าย")
    is_special_offer = models.BooleanField(default=False, verbose_name="สินค้าโปรโมชั่น")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "สินค้า"
        verbose_name_plural = "สินค้า"

    def __str__(self):
        return self.name

    @property
    def available_quantity(self):
        return max(0, int(self.stock_quantity or 0) - int(self.reserved_quantity or 0))

    @property
    def is_low_stock(self):
        avail = self.available_quantity
        prod_thr = int(self.min_stock_level or 0)
        store_thr = 5
        try:
            # Lazy import: orders.models imports Product — avoid cycle at module import time.
            from orders.models import StoreLocation

            loc = StoreLocation.objects.order_by('id').first()
            if loc is not None:
                store_thr = int(loc.low_stock_alert_quantity)
        except Exception:
            store_thr = 5
        if store_thr > 0 and avail <= store_thr:
            return True
        return avail <= prod_thr


class Supplier(models.Model):
    name = models.CharField(max_length=200, unique=True, verbose_name="ชื่อผู้จำหน่าย")
    contact_name = models.CharField(max_length=120, blank=True, verbose_name="ชื่อผู้ติดต่อ")
    phone = models.CharField(max_length=40, blank=True, verbose_name="เบอร์โทร")
    email = models.EmailField(blank=True, verbose_name="อีเมล")
    address = models.TextField(blank=True, verbose_name="ที่อยู่")
    is_active = models.BooleanField(default=True, verbose_name="ใช้งานอยู่")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ผู้จำหน่าย"
        verbose_name_plural = "ผู้จำหน่าย"
        ordering = ['name']

    def __str__(self):
        return self.name


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('draft', 'ฉบับร่าง'),
        ('approved', 'อนุมัติแล้ว'),
        ('partial_received', 'รับเข้าแล้วบางส่วน'),
        ('received', 'รับเข้าแล้ว'),
        ('cancelled', 'ยกเลิก'),
    ]

    reference = models.CharField(max_length=24, unique=True, blank=True, verbose_name="เลขเอกสาร")
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchase_orders',
        verbose_name="ผู้จำหน่าย",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name="สถานะ")
    expected_date = models.DateField(null=True, blank=True, verbose_name="วันที่คาดว่าจะได้รับ")
    notes = models.TextField(blank=True, verbose_name="หมายเหตุ")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_purchase_orders',
        verbose_name="ผู้สร้าง",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ใบสั่งซื้อสินค้า"
        verbose_name_plural = "ใบสั่งซื้อสินค้า"
        ordering = ['-created_at']

    def __str__(self):
        return self.reference or f'PO-{self.id}'

    def save(self, *args, **kwargs):
        if not self.reference:
            ts = timezone.localtime().strftime('%Y%m%d%H%M%S')
            self.reference = f'PO{ts}'
        super().save(*args, **kwargs)


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name="ใบสั่งซื้อ",
    )
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='purchase_order_items', verbose_name="สินค้า")
    ordered_quantity = models.PositiveIntegerField(default=0, verbose_name="จำนวนที่สั่ง")
    received_quantity = models.PositiveIntegerField(default=0, verbose_name="จำนวนที่รับแล้ว")
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="ต้นทุนต่อหน่วย")

    class Meta:
        verbose_name = "รายการใบสั่งซื้อ"
        verbose_name_plural = "รายการใบสั่งซื้อ"
        unique_together = ('purchase_order', 'product')


class StockMovement(models.Model):
    MOVEMENT_CHOICES = [
        ('purchase_receipt', 'รับเข้าสินค้า'),
        ('sale_reserve', 'จองจากคำสั่งซื้อ'),
        ('sale_release', 'คืนจองจากคำสั่งซื้อ'),
        ('sale_commit', 'ตัดสต็อกจากคำสั่งซื้อ'),
        ('adjustment_in', 'ปรับเพิ่มสต็อก'),
        ('adjustment_out', 'ปรับลดสต็อก'),
        ('return_in', 'คืนสินค้าเข้าคลัง'),
        ('damage_out', 'เสียหาย/สูญหาย'),
    ]

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='stock_movements', verbose_name="สินค้า")
    movement_type = models.CharField(max_length=30, choices=MOVEMENT_CHOICES, verbose_name="ประเภท")
    quantity_change = models.IntegerField(verbose_name="จำนวนที่เปลี่ยนแปลง")
    quantity_before = models.IntegerField(default=0, verbose_name="คงเหลือก่อน")
    quantity_after = models.IntegerField(default=0, verbose_name="คงเหลือหลัง")
    reserved_before = models.IntegerField(default=0, verbose_name="จองก่อน")
    reserved_after = models.IntegerField(default=0, verbose_name="จองหลัง")
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="ต้นทุนต่อหน่วย")
    source_type = models.CharField(max_length=40, blank=True, verbose_name="ที่มา")
    source_id = models.CharField(max_length=64, blank=True, verbose_name="รหัสเอกสารอ้างอิง")
    reference = models.CharField(max_length=120, blank=True, verbose_name="เลขอ้างอิง")
    note = models.TextField(blank=True, verbose_name="หมายเหตุ")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_movements',
        verbose_name="ผู้ทำรายการ",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "ประวัติการเคลื่อนไหวสต็อก"
        verbose_name_plural = "ประวัติการเคลื่อนไหวสต็อก"
        ordering = ['-created_at', '-id']