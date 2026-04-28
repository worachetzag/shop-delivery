from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import (
    Customer, Category, Product, Order, OrderItem, Delivery, ServiceHours,
    LineUser, UserRole, DriverProfile, AdminProfile, DriverAssignment,
    ConsentRecord, DataProcessingActivity, PrivacyPolicy, AuditLog,
    PaymentTransaction, PaymentWebhook, PaymentCheckLog
)


# Unregister the default User admin
admin.site.unregister(User)


# Custom User Admin
@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'date_joined')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'date_joined')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering = ('-date_joined',)


# Customer Admin
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('user', 'id_card_number', 'phone_number', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__first_name', 'user__last_name', 'id_card_number', 'phone_number')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


# Category Admin
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at',)


# Product Admin
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'stock_quantity', 'is_available', 'is_special_offer', 'created_at')
    list_filter = ('category', 'is_available', 'is_special_offer', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_editable = ('price', 'stock_quantity', 'is_available', 'is_special_offer')


# Order Admin
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'order_type', 'payment_method', 'status', 'total_amount', 'created_at')
    list_filter = ('order_type', 'payment_method', 'status', 'created_at')
    search_fields = ('customer__user__first_name', 'customer__user__last_name', 'id')
    readonly_fields = ('created_at', 'updated_at', 'subtotal', 'total_amount')
    ordering = ('-created_at',)
    list_editable = ('status',)


# OrderItem Admin
@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'product', 'quantity', 'price', 'total_price')
    list_filter = ('order__created_at',)
    search_fields = ('order__id', 'product__name')
    readonly_fields = ('total_price',)


# Delivery Admin
@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('order', 'delivery_person', 'estimated_delivery_time', 'actual_delivery_time', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('order__id', 'delivery_person__first_name', 'delivery_person__last_name')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


# ServiceHours Admin
@admin.register(ServiceHours)
class ServiceHoursAdmin(admin.ModelAdmin):
    list_display = ('service_type', 'start_time', 'end_time', 'is_active')
    list_filter = ('service_type', 'is_active')
    list_editable = ('is_active',)


# LINE User Admin
@admin.register(LineUser)
class LineUserAdmin(admin.ModelAdmin):
    list_display = ('user', 'line_user_id', 'display_name', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__first_name', 'user__last_name', 'line_user_id', 'display_name')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


# User Role Admin
@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_editable = ('is_active',)


# Driver Profile Admin
@admin.register(DriverProfile)
class DriverProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'license_number', 'vehicle_type', 'vehicle_number', 'is_available', 'created_at')
    list_filter = ('vehicle_type', 'is_available', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'license_number', 'vehicle_number')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_editable = ('is_available',)


# Admin Profile Admin
@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'employee_id', 'department', 'created_at')
    list_filter = ('department', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'employee_id')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)


# Driver Assignment Admin
@admin.register(DriverAssignment)
class DriverAssignmentAdmin(admin.ModelAdmin):
    list_display = ('driver', 'order', 'status', 'assigned_at', 'created_at')
    list_filter = ('status', 'assigned_at', 'created_at')
    search_fields = ('driver__first_name', 'driver__last_name', 'order__id')
    readonly_fields = ('created_at', 'updated_at', 'assigned_at')
    ordering = ('-created_at',)
    list_editable = ('status',)


# Payment Transaction Admin
@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'order', 'payment_method', 'amount', 'status', 'created_at', 'paid_at')
    list_filter = ('payment_method', 'status', 'created_at')
    search_fields = ('order__id', 'transaction_id', 'reference_id')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_editable = ('status',)


# Payment Webhook Admin
@admin.register(PaymentWebhook)
class PaymentWebhookAdmin(admin.ModelAdmin):
    list_display = ('webhook_type', 'transaction', 'is_verified', 'processed_at', 'created_at')
    list_filter = ('webhook_type', 'is_verified', 'created_at')
    search_fields = ('transaction__order__id', 'transaction__transaction_id')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)


# Payment Check Log Admin
@admin.register(PaymentCheckLog)
class PaymentCheckLogAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'check_method', 'status_before', 'status_after', 'is_status_changed', 'created_at')
    list_filter = ('check_method', 'is_status_changed', 'created_at')
    search_fields = ('transaction__order__id', 'transaction__transaction_id')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)


# Consent Record Admin
@admin.register(ConsentRecord)
class ConsentRecordAdmin(admin.ModelAdmin):
    list_display = ('customer', 'consent_type', 'is_given', 'given_at', 'withdrawn_at')
    list_filter = ('consent_type', 'is_given', 'given_at')
    search_fields = ('customer__user__first_name', 'customer__user__last_name')
    readonly_fields = ('given_at', 'withdrawn_at')
    ordering = ('-given_at',)


# Data Processing Activity Admin
@admin.register(DataProcessingActivity)
class DataProcessingActivityAdmin(admin.ModelAdmin):
    list_display = ('purpose', 'description', 'is_active', 'created_at')
    list_filter = ('purpose', 'is_active', 'created_at')
    search_fields = ('purpose', 'description')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    list_editable = ('is_active',)


# Privacy Policy Admin
@admin.register(PrivacyPolicy)
class PrivacyPolicyAdmin(admin.ModelAdmin):
    list_display = ('version', 'title', 'effective_date', 'is_active', 'created_at')
    list_filter = ('is_active', 'effective_date', 'created_at')
    search_fields = ('title', 'content')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-effective_date',)
    list_editable = ('is_active',)


# Audit Log Admin
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'model_name', 'object_id', 'timestamp')
    list_filter = ('action', 'model_name', 'timestamp')
    search_fields = ('user__first_name', 'user__last_name', 'model_name', 'object_id')
    readonly_fields = ('timestamp',)
    ordering = ('-timestamp',)


# Admin site customization
admin.site.site_header = "Samsung Panich Delivery Admin"
admin.site.site_title = "SSP Admin"
admin.site.index_title = "จัดการระบบ Samsung Panich Delivery"
