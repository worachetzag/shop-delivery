from django.contrib import admin
from .models import ConsentRecord, DataProcessingActivity, PrivacyPolicy, AuditLog


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