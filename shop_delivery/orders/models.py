from django.db import models
from django.db import transaction
from django.contrib.auth.models import User
from django.utils import timezone
from accounts.models import Customer
from products.models import Product


class Order(models.Model):
    """คำสั่งซื้อ"""
    ORDER_TYPE_CHOICES = [
        ('pickup', 'รับเองที่ร้าน'),
        ('delivery', 'จัดส่ง'),
    ]

    PAYMENT_METHOD_CHOICES = [
        ('line_pay', 'LINE Pay'),
        ('promptpay', 'PromptPay'),
        ('truemoney', 'TrueMoney Wallet'),
        ('rabbit', 'Rabbit LINE Pay'),
        ('scb_easy', 'SCB Easy'),
        ('cod', 'ชำระปลายทาง'),
        ('cash', 'เงินสด'),
    ]

    STATUS_CHOICES = [
        ('pending', 'รอดำเนินการ'),
        ('preparing', 'จัดเตรียมสินค้า'),
        ('ready', 'พร้อมรับ/ส่ง'),
        ('delivering', 'กำลังจัดส่ง'),
        ('delivered', 'จัดส่งสำเร็จ'),
        ('cancelled', 'ยกเลิก'),
    ]
    PAYMENT_SLIP_STATUS_CHOICES = [
        ('not_required', 'ไม่ต้องใช้สลิป'),
        ('pending', 'รอสลิป'),
        ('uploaded', 'อัปโหลดแล้ว รอตรวจสอบ'),
        ('verified', 'ยืนยันแล้ว'),
        ('rejected', 'สลิปไม่ถูกต้อง'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='orders', verbose_name="ลูกค้า")
    order_number = models.CharField(max_length=16, unique=True, blank=True, verbose_name="หมายเลขคำสั่งซื้อ")
    order_type = models.CharField(max_length=10, choices=ORDER_TYPE_CHOICES, verbose_name="ประเภทคำสั่งซื้อ")
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, verbose_name="วิธีการชำระเงิน")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="สถานะ")
    
    # ข้อมูลการจัดส่ง
    delivery_address = models.TextField(blank=True, verbose_name="ที่อยู่จัดส่ง")
    delivery_phone = models.CharField(max_length=15, blank=True, verbose_name="เบอร์โทรศัพท์สำหรับจัดส่ง")
    delivery_notes = models.TextField(blank=True, verbose_name="หมายเหตุการจัดส่ง")
    # ระยะทางจัดส่ง (กม.) — จากลูกค้า (แผนที่) หรือคำนวณ Haversine จากพิกัดร้าน+ปลายทาง
    delivery_distance = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        blank=True,
        null=True,
        verbose_name="ระยะทางจัดส่ง (กม.)",
    )
    
    # ข้อมูลการชำระเงิน
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ยอดรวมสินค้า")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="ค่าจัดส่ง")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ยอดรวมทั้งหมด")
    payment_slip = models.ImageField(upload_to='payment_slips/', blank=True, null=True, verbose_name="สลิปการชำระเงิน")
    payment_slip_status = models.CharField(
        max_length=20,
        choices=PAYMENT_SLIP_STATUS_CHOICES,
        default='pending',
        verbose_name="สถานะสลิป",
    )
    payment_slip_uploaded_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาที่อัปโหลดสลิป")
    payment_verified_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาที่ยืนยันการชำระเงิน")

    # สต็อก: หักตอนสร้างออเดอร์ (inventory_reserved) / คืนตอนยกเลิก (stock_restocked_on_cancel)
    inventory_reserved = models.BooleanField(
        default=False,
        verbose_name="หักสต็อกจากออเดอร์นี้แล้ว",
        help_text="True เมื่อสร้างออเดอร์แล้วหักสต็อกในคลัง — ออเดอร์เก่าก่อนมีฟีเจอร์นี้จะเป็น False",
    )
    stock_restocked_on_cancel = models.BooleanField(
        default=False,
        verbose_name="คืนสต็อกหลังยกเลิกแล้ว",
        help_text="กันคืนสต็อกซ้ำเมื่อยกเลิกออเดอร์",
    )
    
    # เวลา
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลาสร้าง")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="เวลาอัปเดต")

    class Meta:
        verbose_name = "คำสั่งซื้อ"
        verbose_name_plural = "คำสั่งซื้อ"
        ordering = ['-created_at']

    def __str__(self):
        return f"คำสั่งซื้อ {self.order_number or f'#{self.id}'} - {self.customer}"

    @staticmethod
    def _generate_order_number_for_date(target_date):
        with transaction.atomic():
            sequence, _ = DailyOrderSequence.objects.select_for_update().get_or_create(
                date=target_date,
                defaults={'last_number': 0},
            )
            sequence.last_number += 1
            sequence.save(update_fields=['last_number'])
            return f"SP{target_date.strftime('%Y%m%d')}{sequence.last_number:03d}"

    def save(self, *args, **kwargs):
        if not self.order_number:
            target_date = timezone.localdate()
            self.order_number = self._generate_order_number_for_date(target_date)
        super().save(*args, **kwargs)


class DailyOrderSequence(models.Model):
    """ตัวนับเลขออเดอร์รายวัน"""
    date = models.DateField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "ลำดับเลขออเดอร์รายวัน"
        verbose_name_plural = "ลำดับเลขออเดอร์รายวัน"


class OrderItem(models.Model):
    """รายการสินค้าในคำสั่งซื้อ"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name="คำสั่งซื้อ")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="สินค้า")
    quantity = models.PositiveIntegerField(verbose_name="จำนวน")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ราคาต่อหน่วย")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ราคารวม")

    class Meta:
        verbose_name = "รายการสินค้า"
        verbose_name_plural = "รายการสินค้า"

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.price
        super().save(*args, **kwargs)


class DriverAssignment(models.Model):
    """มอบหมายคำสั่งซื้อให้คนขับและเก็บสถานะติดตาม"""
    STATUS_CHOICES = [
        ('assigned', 'มอบหมายแล้ว'),
        ('accepted', 'คนขับรับงานแล้ว'),
        ('picked_up', 'รับสินค้าแล้ว'),
        ('on_the_way', 'กำลังจัดส่ง'),
        ('delivered', 'จัดส่งสำเร็จ'),
        ('cancelled', 'ยกเลิก'),
    ]

    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='driver_assignment', verbose_name="คำสั่งซื้อ")
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='order_driver_assignments', verbose_name="คนขับ")
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_driver_jobs', verbose_name="ผู้มอบหมาย"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned', verbose_name="สถานะงานจัดส่ง")
    notes = models.TextField(blank=True, verbose_name="หมายเหตุ")
    current_latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True, verbose_name="พิกัดละติจูดล่าสุด")
    current_longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True, verbose_name="พิกัดลองจิจูดล่าสุด")
    current_location_text = models.CharField(max_length=255, blank=True, verbose_name="ตำแหน่งล่าสุด")
    last_location_at = models.DateTimeField(null=True, blank=True, verbose_name="เวลาอัปเดตตำแหน่งล่าสุด")
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลามอบหมาย")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="เวลาอัปเดต")

    class Meta:
        verbose_name = "การมอบหมายงานคนขับ"
        verbose_name_plural = "การมอบหมายงานคนขับ"
        ordering = ['-assigned_at']

    def __str__(self):
        return f"Order #{self.order_id} -> {self.driver.username}"


class StoreLocation(models.Model):
    """พิกัดร้านสำหรับคำนวณระยะจัดส่ง (Haversine) — ใช้แถวเดียว; ถ้าไม่ตั้งจะใช้ค่าใน .env แทน"""
    name = models.CharField(max_length=120, blank=True, verbose_name="ชื่อร้าน/จุดอ้างอิง")
    address = models.TextField(blank=True, verbose_name="ที่อยู่ร้าน")
    latitude = models.DecimalField(
        max_digits=18,
        decimal_places=15,
        null=True,
        blank=True,
        verbose_name="ละติจูดร้าน",
    )
    longitude = models.DecimalField(
        max_digits=18,
        decimal_places=15,
        null=True,
        blank=True,
        verbose_name="ลองจิจูดร้าน",
    )
    promptpay_number = models.CharField(
        max_length=32,
        blank=True,
        default='',
        verbose_name="เบอร์พร้อมเพย์ร้าน",
        help_text="ใส่เบอร์มือถือ 10 หลัก หรือเลข PromptPay ที่ต้องการรับเงิน",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="อัปเดตล่าสุด")

    class Meta:
        verbose_name = "พิกัดร้าน"
        verbose_name_plural = "พิกัดร้าน"

    def __str__(self):
        if self.latitude is not None and self.longitude is not None:
            return f"{self.name or 'ร้าน'} ({self.latitude}, {self.longitude})"
        return self.name or "พิกัดร้าน (ยังไม่ระบุ)"