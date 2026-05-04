from django.db import models
from django.contrib.auth.models import User
from accounts.models import Customer


class ConsentRecord(models.Model):
    """บันทึกความยินยอม PDPA"""
    CONSENT_TYPE_CHOICES = [
        ('marketing', 'การตลาด'),
        ('data_processing', 'การประมวลผลข้อมูล'),
        ('third_party', 'การแชร์ข้อมูลกับบุคคลที่สาม'),
        ('analytics', 'การวิเคราะห์ข้อมูล'),
        ('privacy_policy', 'นโยบายความเป็นส่วนตัว (PDPA)'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='consents', verbose_name="ลูกค้า")
    consent_type = models.CharField(max_length=20, choices=CONSENT_TYPE_CHOICES, verbose_name="ประเภทความยินยอม")
    privacy_policy = models.ForeignKey(
        'PrivacyPolicy',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consent_records',
        verbose_name="นโยบายที่อ้างอิง",
    )
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

    @classmethod
    def get_current_for_storefront(cls):
        """
        นโยบายฉบับเดียวที่หน้าบ้าน / consent ใช้ — is_active ล่าสุดตามวันที่มีผล แล้วตาม id
        เมื่อแอดมินเปิดใช้งานเวอร์ชันใหม่ (แถวใหม่) ลูกค้าที่ยอมรับฉบับเก่าจะต้องยอมรับใหม่
        เพราะ ConsentRecord อ้าง privacy_policy_id
        """
        return cls.objects.filter(is_active=True).order_by('-effective_date', '-id').first()


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