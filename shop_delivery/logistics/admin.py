from django.contrib import admin
from .models import ServiceHours, Delivery, DriverAssignment


# Service Hours Admin
@admin.register(ServiceHours)
class ServiceHoursAdmin(admin.ModelAdmin):
    list_display = ('service_type', 'start_time', 'end_time', 'is_active')
    list_filter = ('service_type', 'is_active')
    list_editable = ('is_active',)


# Delivery Admin
@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('order', 'delivery_person', 'estimated_delivery_time', 'actual_delivery_time', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('order__id', 'delivery_person__first_name', 'delivery_person__last_name')
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