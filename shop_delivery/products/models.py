from django.db import models


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
    is_available = models.BooleanField(default=True, verbose_name="พร้อมจำหน่าย")
    is_special_offer = models.BooleanField(default=False, verbose_name="สินค้าโปรโมชั่น")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "สินค้า"
        verbose_name_plural = "สินค้า"

    def __str__(self):
        return self.name