from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal


class LineUser(models.Model):
    """ข้อมูล LINE User"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='line_user')
    line_user_id = models.CharField(max_length=100, unique=True, verbose_name="LINE User ID")
    display_name = models.CharField(max_length=100, verbose_name="ชื่อแสดงใน LINE")
    picture_url = models.URLField(blank=True, null=True, verbose_name="URL รูปโปรไฟล์")
    status_message = models.CharField(max_length=200, blank=True, verbose_name="สถานะ")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "LINE User"
        verbose_name_plural = "LINE Users"

    def __str__(self):
        return f"{self.display_name} ({self.line_user_id})"


class UserRole(models.Model):
    """บทบาทผู้ใช้งาน"""
    ROLE_CHOICES = [
        ('customer', 'ลูกค้า'),
        ('store_admin', 'แอดมินร้านค้า'),
        ('driver', 'คนขับรถส่ง'),
        ('super_admin', 'ผู้ดูแลระบบ'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='user_role')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, verbose_name="บทบาท")
    is_active = models.BooleanField(default=True, verbose_name="เปิดใช้งาน")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "บทบาทผู้ใช้งาน"
        verbose_name_plural = "บทบาทผู้ใช้งาน"

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.get_role_display()}"


class DriverProfile(models.Model):
    """ข้อมูลคนขับรถส่ง"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='driver_profile')
    license_number = models.CharField(max_length=20, verbose_name="เลขใบขับขี่")
    vehicle_type = models.CharField(max_length=50, verbose_name="ประเภทรถ")
    vehicle_number = models.CharField(max_length=20, verbose_name="เลขทะเบียนรถ")
    phone_number = models.CharField(max_length=15, verbose_name="เบอร์โทรศัพท์")
    is_available = models.BooleanField(default=True, verbose_name="พร้อมรับงาน")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ข้อมูลคนขับรถส่ง"
        verbose_name_plural = "ข้อมูลคนขับรถส่ง"

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.vehicle_number}"


class AdminProfile(models.Model):
    """ข้อมูลแอดมินร้านค้า"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='admin_profile')
    employee_id = models.CharField(max_length=20, verbose_name="รหัสพนักงาน")
    department = models.CharField(max_length=100, verbose_name="แผนก")
    phone_number = models.CharField(max_length=15, verbose_name="เบอร์โทรศัพท์")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ข้อมูลแอดมินร้านค้า"
        verbose_name_plural = "ข้อมูลแอดมินร้านค้า"

    def __str__(self):
        return f"{self.user.get_full_name()} - {self.employee_id}"


class DriverAssignment(models.Model):
    """การมอบหมายงานจัดส่งให้คนขับ"""
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments', verbose_name="คนขับ")
    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='driver_assignments', verbose_name="คำสั่งซื้อ")
    assigned_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลามอบหมาย")
    status = models.CharField(max_length=20, choices=[
        ('assigned', 'ได้รับมอบหมาย'),
        ('accepted', 'รับงาน'),
        ('picked_up', 'รับสินค้าแล้ว'),
        ('delivered', 'จัดส่งสำเร็จ'),
        ('cancelled', 'ยกเลิก'),
    ], default='assigned', verbose_name="สถานะ")
    notes = models.TextField(blank=True, verbose_name="หมายเหตุ")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "การมอบหมายงานจัดส่ง"
        verbose_name_plural = "การมอบหมายงานจัดส่ง"

    def __str__(self):
        return f"{self.driver.get_full_name()} - คำสั่งซื้อ #{self.order.id}"


class ConsentRecord(models.Model):
    """บันทึกความยินยอม PDPA"""
    CONSENT_TYPE_CHOICES = [
        ('marketing', 'การตลาด'),
        ('data_processing', 'การประมวลผลข้อมูล'),
        ('third_party', 'การแชร์ข้อมูลกับบุคคลที่สาม'),
        ('analytics', 'การวิเคราะห์ข้อมูล'),
    ]

    customer = models.ForeignKey('Customer', on_delete=models.CASCADE, related_name='consents', verbose_name="ลูกค้า")
    consent_type = models.CharField(max_length=20, choices=CONSENT_TYPE_CHOICES, verbose_name="ประเภทความยินยอม")
    is_given = models.BooleanField(verbose_name="ให้ความยินยอม")
    given_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลาที่ให้ความยินยอม")
    withdrawn_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาที่ถอนความยินยอม")
    ip_address = models.GenericIPAddressField(verbose_name="IP Address")
    user_agent = models.TextField(verbose_name="User Agent")

    class Meta:
        verbose_name = "บันทึกความยินยอม"
        verbose_name_plural = "บันทึกความยินยอม"

    def __str__(self):
        status = "ให้ความยินยอม" if self.is_given else "ถอนความยินยอม"
        return f"{self.customer} - {self.get_consent_type_display()} - {status}"


class DataProcessingActivity(models.Model):
    """กิจกรรมการประมวลผลข้อมูล"""
    PURPOSE_CHOICES = [
        ('order_processing', 'การประมวลผลคำสั่งซื้อ'),
        ('delivery', 'การจัดส่ง'),
        ('customer_service', 'การบริการลูกค้า'),
        ('marketing', 'การตลาด'),
        ('analytics', 'การวิเคราะห์'),
    ]

    purpose = models.CharField(max_length=30, choices=PURPOSE_CHOICES, verbose_name="วัตถุประสงค์")
    description = models.TextField(verbose_name="คำอธิบาย")
    data_categories = models.TextField(verbose_name="หมวดหมู่ข้อมูล")
    legal_basis = models.TextField(verbose_name="ฐานกฎหมาย")
    retention_period = models.CharField(max_length=100, verbose_name="ระยะเวลาการเก็บรักษา")
    is_active = models.BooleanField(default=True, verbose_name="เปิดใช้งาน")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "กิจกรรมการประมวลผลข้อมูล"
        verbose_name_plural = "กิจกรรมการประมวลผลข้อมูล"

    def __str__(self):
        return f"{self.get_purpose_display()} - {self.description[:50]}"


class PrivacyPolicy(models.Model):
    """นโยบายความเป็นส่วนตัว"""
    version = models.CharField(max_length=10, verbose_name="เวอร์ชัน")
    title = models.CharField(max_length=200, verbose_name="หัวข้อ")
    content = models.TextField(verbose_name="เนื้อหา")
    effective_date = models.DateField(verbose_name="วันที่มีผลบังคับใช้")
    is_active = models.BooleanField(default=True, verbose_name="เปิดใช้งาน")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "นโยบายความเป็นส่วนตัว"
        verbose_name_plural = "นโยบายความเป็นส่วนตัว"

    def __str__(self):
        return f"{self.title} v{self.version}"


class AuditLog(models.Model):
    """บันทึกการเข้าถึงและแก้ไขข้อมูล"""
    ACTION_CHOICES = [
        ('create', 'สร้าง'),
        ('read', 'อ่าน'),
        ('update', 'แก้ไข'),
        ('delete', 'ลบ'),
        ('login', 'เข้าสู่ระบบ'),
        ('logout', 'ออกจากระบบ'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="ผู้ใช้งาน")
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, verbose_name="การกระทำ")
    model_name = models.CharField(max_length=100, verbose_name="ชื่อ Model")
    object_id = models.CharField(max_length=100, blank=True, verbose_name="ID วัตถุ")
    description = models.TextField(verbose_name="คำอธิบาย")
    ip_address = models.GenericIPAddressField(verbose_name="IP Address")
    user_agent = models.TextField(verbose_name="User Agent")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="เวลา")

    class Meta:
        verbose_name = "บันทึกการเข้าถึง"
        verbose_name_plural = "บันทึกการเข้าถึง"
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user} - {self.get_action_display()} - {self.model_name} - {self.timestamp}"


class PaymentTransaction(models.Model):
    """บันทึกการทำรายการชำระเงิน"""
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'รอดำเนินการ'),
        ('processing', 'กำลังดำเนินการ'),
        ('completed', 'สำเร็จ'),
        ('failed', 'ล้มเหลว'),
        ('cancelled', 'ยกเลิก'),
        ('refunded', 'คืนเงิน'),
    ]

    order = models.ForeignKey('Order', on_delete=models.CASCADE, related_name='payment_transactions', verbose_name="คำสั่งซื้อ")
    payment_method = models.CharField(max_length=20, choices=[
        ('line_pay', 'LINE Pay'),
        ('promptpay', 'PromptPay'),
        ('truemoney', 'TrueMoney Wallet'),
        ('rabbit', 'Rabbit LINE Pay'),
        ('scb_easy', 'SCB Easy'),
        ('cod', 'ชำระปลายทาง'),
        ('cash', 'เงินสด'),
    ], verbose_name="วิธีการชำระเงิน")
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="จำนวนเงิน")
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending', verbose_name="สถานะ")
    
    # สำหรับ PromptPay และ QR Code
    qr_code = models.TextField(blank=True, verbose_name="QR Code")
    qr_image_url = models.URLField(blank=True, verbose_name="QR Image URL")
    
    # สำหรับการเช็คสถานะ
    transaction_id = models.CharField(max_length=100, blank=True, verbose_name="Transaction ID")
    reference_id = models.CharField(max_length=100, blank=True, verbose_name="Reference ID")
    bank_reference = models.CharField(max_length=100, blank=True, verbose_name="Bank Reference")
    
    # เวลา
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลาสร้าง")
    paid_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาชำระเงิน")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="เวลาอัปเดต")
    
    # ข้อมูลเพิ่มเติม
    notes = models.TextField(blank=True, verbose_name="หมายเหตุ")
    ip_address = models.GenericIPAddressField(verbose_name="IP Address")
    user_agent = models.TextField(verbose_name="User Agent")

    class Meta:
        verbose_name = "รายการชำระเงิน"
        verbose_name_plural = "รายการชำระเงิน"
        ordering = ['-created_at']

    def __str__(self):
        return f"Payment #{self.id} - {self.order} - {self.get_status_display()}"


class PaymentWebhook(models.Model):
    """บันทึก Webhook จาก Payment Gateway"""
    WEBHOOK_TYPE_CHOICES = [
        ('promptpay', 'PromptPay'),
        ('line_pay', 'LINE Pay'),
        ('truemoney', 'TrueMoney'),
        ('rabbit', 'Rabbit LINE Pay'),
        ('scb_easy', 'SCB Easy'),
    ]

    webhook_type = models.CharField(max_length=20, choices=WEBHOOK_TYPE_CHOICES, verbose_name="ประเภท Webhook")
    transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='webhooks', verbose_name="รายการชำระเงิน")
    payload = models.JSONField(verbose_name="ข้อมูล Webhook")
    signature = models.CharField(max_length=500, blank=True, verbose_name="Signature")
    is_verified = models.BooleanField(default=False, verbose_name="ยืนยันแล้ว")
    processed_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาประมวลผล")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลาสร้าง")

    class Meta:
        verbose_name = "Payment Webhook"
        verbose_name_plural = "Payment Webhooks"
        ordering = ['-created_at']

    def __str__(self):
        return f"Webhook {self.get_webhook_type_display()} - {self.transaction}"


class PaymentCheckLog(models.Model):
    """บันทึกการเช็คสถานะการชำระเงิน"""
    transaction = models.ForeignKey(PaymentTransaction, on_delete=models.CASCADE, related_name='check_logs', verbose_name="รายการชำระเงิน")
    check_method = models.CharField(max_length=50, verbose_name="วิธีการเช็ค")
    check_result = models.JSONField(verbose_name="ผลการเช็ค")
    status_before = models.CharField(max_length=20, verbose_name="สถานะก่อนเช็ค")
    status_after = models.CharField(max_length=20, verbose_name="สถานะหลังเช็ค")
    is_status_changed = models.BooleanField(default=False, verbose_name="สถานะเปลี่ยน")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="เวลาสร้าง")

    class Meta:
        verbose_name = "บันทึกการเช็คสถานะ"
        verbose_name_plural = "บันทึกการเช็คสถานะ"
        ordering = ['-created_at']

    def __str__(self):
        return f"Check Log - {self.transaction} - {self.created_at}"


class Customer(models.Model):
    """ข้อมูลลูกค้า"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')
    id_card_number = models.CharField(max_length=13, unique=True, verbose_name="เลขบัตรประชาชน")
    date_of_birth = models.DateField(verbose_name="วันเดือนปีเกิด")
    address = models.TextField(verbose_name="ที่อยู่")
    phone_number = models.CharField(max_length=15, verbose_name="เบอร์โทรศัพท์")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ลูกค้า"
        verbose_name_plural = "ลูกค้า"

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"


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
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='products', verbose_name="หมวดหมู่")
    image = models.ImageField(upload_to='products/', blank=True, null=True, verbose_name="รูปภาพ")
    stock_quantity = models.PositiveIntegerField(default=0, verbose_name="จำนวนสินค้าคงเหลือ")
    is_available = models.BooleanField(default=True, verbose_name="พร้อมจำหน่าย")
    is_special_offer = models.BooleanField(default=False, verbose_name="สินค้าโปรโมชั่น")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "สินค้า"
        verbose_name_plural = "สินค้า"

    def __str__(self):
        return self.name


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

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='orders', verbose_name="ลูกค้า")
    order_type = models.CharField(max_length=10, choices=ORDER_TYPE_CHOICES, verbose_name="ประเภทคำสั่งซื้อ")
    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES, verbose_name="วิธีการชำระเงิน")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name="สถานะ")
    
    # สำหรับการจัดส่ง
    delivery_address = models.TextField(blank=True, verbose_name="ที่อยู่จัดส่ง")
    delivery_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="ค่าจัดส่ง")
    delivery_distance = models.DecimalField(max_digits=8, decimal_places=2, blank=True, null=True, verbose_name="ระยะทาง (กม.)")
    
    # สำหรับการรับเองที่ร้าน
    pickup_time = models.DateTimeField(blank=True, null=True, verbose_name="เวลารับสินค้า")
    
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ยอดรวมสินค้า")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ยอดรวมทั้งหมด")
    
    # สำหรับการชำระเงินสด
    cash_amount = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="จำนวนเงินสด")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "คำสั่งซื้อ"
        verbose_name_plural = "คำสั่งซื้อ"
        ordering = ['-created_at']

    def __str__(self):
        return f"คำสั่งซื้อ #{self.id} - {self.customer}"

    def calculate_delivery_fee(self):
        """คำนวณค่าจัดส่งตามระยะทาง"""
        if not self.delivery_distance:
            return Decimal('0')
        
        distance = float(self.delivery_distance)
        if distance <= 3:
            return Decimal('0')
        elif distance <= 5:
            return Decimal('20')
        elif distance <= 10:
            return Decimal('35')
        else:
            return Decimal('50')  # สำหรับระยะทางมากกว่า 10 กม.


class OrderItem(models.Model):
    """รายการสินค้าในคำสั่งซื้อ"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name="คำสั่งซื้อ")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, verbose_name="สินค้า")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)], verbose_name="จำนวน")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ราคาต่อหน่วย")
    total_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="ราคารวม")

    class Meta:
        verbose_name = "รายการสินค้า"
        verbose_name_plural = "รายการสินค้า"

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"

    def save(self, *args, **kwargs):
        self.total_price = self.price * self.quantity
        super().save(*args, **kwargs)


class Delivery(models.Model):
    """ข้อมูลการจัดส่ง"""
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery', verbose_name="คำสั่งซื้อ")
    delivery_person = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="คนส่ง")
    estimated_delivery_time = models.DateTimeField(verbose_name="เวลาจัดส่งโดยประมาณ")
    actual_delivery_time = models.DateTimeField(blank=True, null=True, verbose_name="เวลาจัดส่งจริง")
    notes = models.TextField(blank=True, verbose_name="หมายเหตุ")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "การจัดส่ง"
        verbose_name_plural = "การจัดส่ง"

    def __str__(self):
        return f"การจัดส่ง #{self.order.id}"


class ServiceHours(models.Model):
    """เวลาบริการ"""
    SERVICE_TYPE_CHOICES = [
        ('delivery', 'บริการจัดส่ง'),
        ('pickup', 'บริการรับเองที่ร้าน'),
    ]

    service_type = models.CharField(max_length=10, choices=SERVICE_TYPE_CHOICES, verbose_name="ประเภทบริการ")
    start_time = models.TimeField(verbose_name="เวลาเริ่ม")
    end_time = models.TimeField(verbose_name="เวลาสิ้นสุด")
    is_active = models.BooleanField(default=True, verbose_name="เปิดใช้งาน")

    class Meta:
        verbose_name = "เวลาบริการ"
        verbose_name_plural = "เวลาบริการ"

    def __str__(self):
        return f"{self.get_service_type_display()} {self.start_time} - {self.end_time}"