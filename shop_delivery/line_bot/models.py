from django.db import models
from django.contrib.auth.models import User
from accounts.models import Customer
from orders.models import Order


class LineBotUser(models.Model):
    """ข้อมูล LINE Bot User"""
    line_user_id = models.CharField(max_length=100, unique=True, verbose_name="LINE User ID")
    display_name = models.CharField(max_length=100, verbose_name="ชื่อแสดงใน LINE")
    picture_url = models.URLField(blank=True, null=True, verbose_name="URL รูปโปรไฟล์")
    status_message = models.CharField(max_length=200, blank=True, verbose_name="สถานะ")
    is_active = models.BooleanField(default=True, verbose_name="เปิดใช้งาน")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "LINE Bot User"
        verbose_name_plural = "LINE Bot Users"

    def __str__(self):
        return f"{self.display_name} ({self.line_user_id})"


class LineMessage(models.Model):
    """บันทึกข้อความที่ส่งผ่าน LINE Bot"""
    MESSAGE_TYPE_CHOICES = [
        ('text', 'ข้อความ'),
        ('image', 'รูปภาพ'),
        ('template', 'Template'),
        ('flex', 'Flex Message'),
    ]

    recipient = models.ForeignKey(LineBotUser, on_delete=models.CASCADE, verbose_name="ผู้รับ")
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, verbose_name="ประเภทข้อความ")
    content = models.TextField(verbose_name="เนื้อหา")
    is_sent = models.BooleanField(default=False, verbose_name="ส่งสำเร็จ")
    sent_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาส่ง")
    error_message = models.TextField(blank=True, verbose_name="ข้อความผิดพลาด")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "LINE Message"
        verbose_name_plural = "LINE Messages"
        ordering = ['-created_at']

    def __str__(self):
        return f"Message to {self.recipient.display_name} - {self.get_message_type_display()}"


class LineNotification(models.Model):
    """การแจ้งเตือนผ่าน LINE Bot"""
    NOTIFICATION_TYPE_CHOICES = [
        ('order_created', 'สร้างคำสั่งซื้อ'),
        ('order_preparing', 'จัดเตรียมสินค้า'),
        ('order_ready', 'พร้อมรับ/ส่ง'),
        ('order_delivering', 'กำลังจัดส่ง'),
        ('order_delivered', 'จัดส่งสำเร็จ'),
        ('order_cancelled', 'ยกเลิกคำสั่งซื้อ'),
        ('payment_success', 'ชำระเงินสำเร็จ'),
        ('payment_failed', 'ชำระเงินล้มเหลว'),
        ('delivery_assigned', 'มอบหมายงานจัดส่ง'),
        ('delivery_picked_up', 'รับสินค้าแล้ว'),
        ('delivery_delivered', 'จัดส่งสำเร็จ'),
    ]

    recipient = models.ForeignKey(LineBotUser, on_delete=models.CASCADE, verbose_name="ผู้รับ")
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES, verbose_name="ประเภทการแจ้งเตือน")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, blank=True, null=True, verbose_name="คำสั่งซื้อ")
    message = models.TextField(verbose_name="ข้อความ")
    is_sent = models.BooleanField(default=False, verbose_name="ส่งสำเร็จ")
    sent_at = models.DateTimeField(blank=True, null=True, verbose_name="เวลาส่ง")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "LINE Notification"
        verbose_name_plural = "LINE Notifications"
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification to {self.recipient.display_name} - {self.get_notification_type_display()}"