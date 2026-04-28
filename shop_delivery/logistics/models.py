from django.db import models
from django.contrib.auth.models import User
from orders.models import Order


class ServiceHours(models.Model):
    """เวลาทำการ"""
    SERVICE_TYPE_CHOICES = [
        ('pickup', 'รับสินค้า'),
        ('delivery', 'จัดส่ง'),
    ]

    service_type = models.CharField(max_length=10, choices=SERVICE_TYPE_CHOICES, verbose_name="ประเภทบริการ")
    start_time = models.TimeField(verbose_name="เวลาเริ่ม")
    end_time = models.TimeField(verbose_name="เวลาสิ้นสุด")
    is_active = models.BooleanField(default=True, verbose_name="เปิดใช้งาน")

    class Meta:
        verbose_name = "เวลาทำการ"
        verbose_name_plural = "เวลาทำการ"

    def __str__(self):
        return f"{self.get_service_type_display()} - {self.start_time} - {self.end_time}"


class Delivery(models.Model):
    """การจัดส่ง"""
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='delivery', verbose_name="คำสั่งซื้อ")
    delivery_person = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="คนจัดส่ง")
    estimated_delivery_time = models.DateTimeField(blank=True, null=True, verbose_name="เวลาจัดส่งที่คาดการณ์")
    actual_delivery_time = models.DateTimeField(blank=True, null=True, verbose_name="เวลาจัดส่งจริง")
    notes = models.TextField(blank=True, verbose_name="หมายเหตุ")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "การจัดส่ง"
        verbose_name_plural = "การจัดส่ง"

    def __str__(self):
        return f"การจัดส่ง #{self.order.id}"


class DriverAssignment(models.Model):
    """การมอบหมายงานจัดส่งให้คนขับ"""
    driver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments', verbose_name="คนขับ")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='driver_assignments', verbose_name="คำสั่งซื้อ")
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