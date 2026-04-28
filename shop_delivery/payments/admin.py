from django.contrib import admin
from .models import PaymentTransaction, PaymentWebhook, PaymentCheckLog


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