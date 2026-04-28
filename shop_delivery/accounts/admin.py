from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import Customer, LineUser, UserRole, DriverProfile, AdminProfile, StaffAuditLog


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


@admin.register(StaffAuditLog)
class StaffAuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor', 'action', 'summary', 'ip_address')
    list_filter = ('action', 'target_type', 'created_at')
    search_fields = ('summary', 'actor__username', 'target_id')
    readonly_fields = ('actor', 'action', 'target_type', 'target_id', 'summary', 'detail', 'ip_address', 'created_at')
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# Admin Profile Admin
@admin.register(AdminProfile)
class AdminProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'employee_id', 'department', 'created_at')
    list_filter = ('department', 'created_at')
    search_fields = ('user__first_name', 'user__last_name', 'employee_id')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)