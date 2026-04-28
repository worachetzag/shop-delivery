from rest_framework import serializers
from .models import ServiceHours, Delivery, DriverAssignment
from accounts.models import DriverProfile


class DeliveryFeeCalculationSerializer(serializers.Serializer):
    distance = serializers.DecimalField(max_digits=8, decimal_places=2)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


class DriverProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DriverProfile
        fields = ['id', 'user', 'full_name', 'phone', 'license_number', 
                 'vehicle_type', 'vehicle_number', 'status', 'status_display',
                 'is_available', 'rating', 'total_deliveries', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'rating', 'total_deliveries']


class DriverAssignmentSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.get_full_name', read_only=True)
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DriverAssignment
        fields = ['id', 'driver', 'driver_name', 'order', 'order_id', 'assigned_at', 
                 'status', 'status_display', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'assigned_at']
