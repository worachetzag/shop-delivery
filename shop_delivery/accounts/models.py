from django.db import models
from django.contrib.auth.models import User


class LineUser(models.Model):
    """ข้อมูล LINE User"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='line_user')
    line_user_id = models.CharField(max_length=100, unique=True, verbose_name="LINE User ID")
    display_name = models.CharField(max_length=100, verbose_name="ชื่อแสดงใน LINE")
    picture_url = models.URLField(max_length=500, blank=True, null=True, verbose_name="URL รูปโปรไฟล์")
    status_message = models.CharField(max_length=500, blank=True, verbose_name="สถานะ")
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
    photo = models.ImageField(
        upload_to='driver_photos/',
        blank=True,
        null=True,
        verbose_name="รูปประจำตัวคนขับ",
    )
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


class StaffAuditLog(models.Model):
    """ประวัติการทำงานของพนักงาน/แอดมิน (ให้เจ้าของร้านตรวจสอบ)"""

    class Action(models.TextChoices):
        ADMIN_LOGIN = 'admin_login', 'เข้าสู่ระบบแอดมิน'
        ADMIN_LOGOUT = 'admin_logout', 'ออกจากระบบแอดมิน'
        PRODUCT_CREATE = 'product_create', 'เพิ่มสินค้า'
        PRODUCT_UPDATE = 'product_update', 'แก้ไขสินค้า'
        PRODUCT_DELETE = 'product_delete', 'ลบสินค้า'
        CATEGORY_CREATE = 'category_create', 'เพิ่มหมวดหมู่'
        CATEGORY_UPDATE = 'category_update', 'แก้ไขหมวดหมู่'
        CATEGORY_DELETE = 'category_delete', 'ลบหมวดหมู่'
        ORDER_STATUS = 'order_status', 'เปลี่ยนสถานะคำสั่งซื้อ'
        PAYMENT_SLIP_REVIEW = 'payment_slip_review', 'ตรวจสอบสลิปโอนเงิน'
        ASSIGN_DRIVER = 'assign_driver', 'มอบหมายคนขับ'
        STAFF_CREATE = 'staff_create', 'เพิ่มบัญชีพนักงาน'
        STAFF_UPDATE = 'staff_update', 'แก้ไขบัญชีพนักงาน'
        STAFF_DELETE = 'staff_delete', 'ลบบัญชีพนักงาน'
        HOME_PROMOTION_CREATE = 'home_promotion_create', 'เพิ่มแบนเนอร์/โปรหน้าแรก'
        HOME_PROMOTION_UPDATE = 'home_promotion_update', 'แก้ไขแบนเนอร์/โปรหน้าแรก'
        HOME_PROMOTION_DELETE = 'home_promotion_delete', 'ลบแบนเนอร์/โปรหน้าแรก'
        SUPPLIER_CREATE = 'supplier_create', 'เพิ่มผู้จำหน่าย'
        SUPPLIER_UPDATE = 'supplier_update', 'แก้ไขผู้จำหน่าย'
        SUPPLIER_DELETE = 'supplier_delete', 'ลบผู้จำหน่าย'
        PURCHASE_ORDER_CREATE = 'purchase_order_create', 'สร้างใบสั่งซื้อ'
        PURCHASE_ORDER_UPDATE = 'purchase_order_update', 'แก้ไขใบสั่งซื้อ'
        PURCHASE_ORDER_DELETE = 'purchase_order_delete', 'ลบใบสั่งซื้อ'
        PURCHASE_ORDER_RECEIVE = 'purchase_order_receive', 'รับเข้าจากใบสั่งซื้อ'
        STORE_SETTINGS_UPDATE = 'store_settings_update', 'แก้ไขตั้งค่าร้าน'
        DRIVER_CREATE = 'driver_create', 'เพิ่มบัญชีคนขับ'
        DRIVER_UPDATE = 'driver_update', 'แก้ไขบัญชีคนขับ'
        DRIVER_DELETE = 'driver_delete', 'ลบบัญชีคนขับ'
        INVENTORY_ADJUSTMENT = 'inventory_adjustment', 'ปรับสต็อกมือ (คลัง)'

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_audit_logs',
        verbose_name='ผู้ทำรายการ',
    )
    action = models.CharField(max_length=40, choices=Action.choices, verbose_name='ประเภท')
    target_type = models.CharField(max_length=40, blank=True, verbose_name='ประเภทเป้าหมาย')
    target_id = models.CharField(max_length=64, blank=True, verbose_name='รหัสเป้าหมาย')
    summary = models.CharField(max_length=500, blank=True, verbose_name='สรุป')
    detail = models.JSONField(default=dict, blank=True, verbose_name='รายละเอียด')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='เวลา')

    class Meta:
        verbose_name = 'ประวัติพนักงาน'
        verbose_name_plural = 'ประวัติพนักงาน'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.created_at} {self.actor_id} {self.action}'


class Customer(models.Model):
    """ข้อมูลลูกค้า"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='customer')
    id_card_number = models.CharField(max_length=13, unique=True, verbose_name="เลขบัตรประชาชน")
    date_of_birth = models.DateField(verbose_name="วันเดือนปีเกิด")
    address = models.TextField(verbose_name="ที่อยู่")
    phone_number = models.CharField(max_length=15, verbose_name="เบอร์โทรศัพท์")
    contact_email = models.EmailField(blank=True, default='', verbose_name="อีเมลติดต่อ (จากลูกค้า)")
    # เพิ่ม lat/lon สำหรับเก็บพิกัดที่อยู่
    latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True, verbose_name="ละติจูด")
    longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True, verbose_name="ลองจิจูด")
    profile_completed = models.BooleanField(
        default=False,
        verbose_name="กรอกโปรไฟล์ครบแล้ว",
        help_text="ครบถ้ามีชื่อ–สกุล เลขบัตรประชาชนถูกต้อง วันเกิด ที่อยู่ เบอร์โทร",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ลูกค้า"
        verbose_name_plural = "ลูกค้า"

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"


class CustomerAddress(models.Model):
    """หลายที่อยู่จัดส่งของลูกค้า"""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    label = models.CharField(max_length=50, default='ที่อยู่')
    recipient_name = models.CharField(max_length=120, blank=True)
    phone_number = models.CharField(max_length=15, blank=True)
    address_line = models.TextField()
    district = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=10, blank=True)
    latitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
    longitude = models.DecimalField(max_digits=18, decimal_places=15, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ที่อยู่ลูกค้า"
        verbose_name_plural = "ที่อยู่ลูกค้า"
        ordering = ['-is_default', '-updated_at']

    def __str__(self):
        return f"{self.customer.user.username} - {self.label}"