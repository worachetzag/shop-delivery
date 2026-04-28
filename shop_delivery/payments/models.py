from django.db import models
from orders.models import Order


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

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payment_transactions', verbose_name="คำสั่งซื้อ")
    payment_method = models.CharField(max_length=20, choices=Order.PAYMENT_METHOD_CHOICES, verbose_name="วิธีการชำระเงิน")
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