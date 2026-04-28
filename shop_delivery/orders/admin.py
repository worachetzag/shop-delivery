from django.contrib import admin
from .models import Order, OrderItem, StoreLocation


# Order Admin
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'order_type', 'payment_method', 'status', 'delivery_distance', 'delivery_fee', 'total_amount', 'created_at')
    list_filter = ('order_type', 'payment_method', 'status', 'created_at')
    search_fields = ('customer__user__first_name', 'customer__user__last_name', 'id')
    readonly_fields = ('created_at', 'updated_at', 'subtotal', 'delivery_fee', 'total_amount')
    ordering = ('-created_at',)
    list_editable = ('status',)


@admin.register(StoreLocation)
class StoreLocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'promptpay_number', 'latitude', 'longitude', 'updated_at')
    search_fields = ('name', 'address')
    fieldsets = (
        (None, {
            'fields': ('name', 'address', 'promptpay_number', 'latitude', 'longitude'),
            'description': 'ตั้งพิกัดร้านที่นี่ได้โดยไม่ต้องแก้ .env — ใช้แถวเดียวพอ (ระบบใช้แถวแรกเท่านั้น)',
        }),
    )


# OrderItem Admin
@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'price', 'total_price')
    list_filter = ('order__created_at',)
    search_fields = ('order__id', 'product__name')
    readonly_fields = ('total_price',)