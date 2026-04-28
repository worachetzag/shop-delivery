from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    Customer, Category, Product, Order, OrderItem, Delivery, ServiceHours,
    LineUser, UserRole, DriverProfile, AdminProfile, DriverAssignment,
    ConsentRecord, DataProcessingActivity, PrivacyPolicy, AuditLog
)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']


class CustomerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Customer
        fields = ['id', 'user', 'id_card_number', 'date_of_birth', 'address', 'phone_number', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CustomerCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)

    class Meta:
        model = Customer
        fields = ['username', 'password', 'first_name', 'last_name', 'email', 
                 'id_card_number', 'date_of_birth', 'address', 'phone_number']

    def create(self, validated_data):
        user_data = {
            'username': validated_data.pop('username'),
            'password': validated_data.pop('password'),
            'first_name': validated_data.pop('first_name'),
            'last_name': validated_data.pop('last_name'),
            'email': validated_data.pop('email'),
        }
        
        user = User.objects.create_user(**user_data)
        customer = Customer.objects.create(user=user, **validated_data)
        return customer


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'category', 'category_name', 
                 'image', 'stock_quantity', 'is_available', 'is_special_offer', 
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_image = serializers.ImageField(source='product.image', read_only=True)
    
    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_image', 'quantity', 'price', 'total_price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    
    class Meta:
        model = Order
        fields = ['id', 'customer', 'customer_name', 'order_type', 'order_type_display',
                 'payment_method', 'payment_method_display', 'status', 'status_display',
                 'delivery_address', 'delivery_fee', 'delivery_distance',
                 'pickup_time', 'subtotal', 'total_amount', 'cash_amount',
                 'items', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'subtotal', 'total_amount']


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)
    
    class Meta:
        model = Order
        fields = ['customer', 'order_type', 'payment_method', 'delivery_address', 
                 'delivery_distance', 'pickup_time', 'cash_amount', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        order = Order.objects.create(**validated_data)
        
        subtotal = 0
        for item_data in items_data:
            product = item_data['product']
            quantity = item_data['quantity']
            price = product.price
            total_price = price * quantity
            
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                price=price,
                total_price=total_price
            )
            subtotal += total_price
        
        # คำนวณค่าจัดส่ง
        if order.order_type == 'delivery' and order.delivery_distance:
            order.delivery_fee = order.calculate_delivery_fee()
        
        order.subtotal = subtotal
        order.total_amount = subtotal + order.delivery_fee
        order.save()
        
        return order


class DeliverySerializer(serializers.ModelSerializer):
    order_info = OrderSerializer(source='order', read_only=True)
    delivery_person_name = serializers.CharField(source='delivery_person.get_full_name', read_only=True)
    
    class Meta:
        model = Delivery
        fields = ['id', 'order', 'order_info', 'delivery_person', 'delivery_person_name',
                 'estimated_delivery_time', 'actual_delivery_time', 'notes',
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ServiceHoursSerializer(serializers.ModelSerializer):
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    
    class Meta:
        model = ServiceHours
        fields = ['id', 'service_type', 'service_type_display', 'start_time', 'end_time', 'is_active']


# LINE LIFF Serializers
class LineUserSerializer(serializers.ModelSerializer):
    user_info = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = LineUser
        fields = ['id', 'user', 'user_info', 'line_user_id', 'display_name', 'picture_url', 'status_message', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class LineUserCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)

    class Meta:
        model = LineUser
        fields = ['username', 'password', 'first_name', 'last_name', 'email', 
                 'line_user_id', 'display_name', 'picture_url', 'status_message']

    def create(self, validated_data):
        user_data = {
            'username': validated_data.pop('username'),
            'password': validated_data.pop('password'),
            'first_name': validated_data.pop('first_name'),
            'last_name': validated_data.pop('last_name'),
            'email': validated_data.pop('email'),
        }
        
        user = User.objects.create_user(**user_data)
        line_user = LineUser.objects.create(user=user, **validated_data)
        return line_user


# User Role Management Serializers
class UserRoleSerializer(serializers.ModelSerializer):
    user_info = UserSerializer(source='user', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    
    class Meta:
        model = UserRole
        fields = ['id', 'user', 'user_info', 'role', 'role_display', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class DriverProfileSerializer(serializers.ModelSerializer):
    user_info = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = DriverProfile
        fields = ['id', 'user', 'user_info', 'license_number', 'vehicle_type', 'vehicle_number', 
                 'phone_number', 'is_available', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class AdminProfileSerializer(serializers.ModelSerializer):
    user_info = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = AdminProfile
        fields = ['id', 'user', 'user_info', 'employee_id', 'department', 'phone_number', 
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class DriverAssignmentSerializer(serializers.ModelSerializer):
    driver_name = serializers.CharField(source='driver.get_full_name', read_only=True)
    order_info = OrderSerializer(source='order', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = DriverAssignment
        fields = ['id', 'driver', 'driver_name', 'order', 'order_info', 'assigned_at', 
                 'status', 'status_display', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'assigned_at']


# PDPA Serializers
class ConsentRecordSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    consent_type_display = serializers.CharField(source='get_consent_type_display', read_only=True)
    
    class Meta:
        model = ConsentRecord
        fields = ['id', 'customer', 'customer_name', 'consent_type', 'consent_type_display', 
                 'is_given', 'given_at', 'withdrawn_at', 'ip_address', 'user_agent']
        read_only_fields = ['given_at', 'withdrawn_at']


class DataProcessingActivitySerializer(serializers.ModelSerializer):
    purpose_display = serializers.CharField(source='get_purpose_display', read_only=True)
    
    class Meta:
        model = DataProcessingActivity
        fields = ['id', 'purpose', 'purpose_display', 'description', 'data_categories', 
                 'legal_basis', 'retention_period', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class PrivacyPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacyPolicy
        fields = ['id', 'version', 'title', 'content', 'effective_date', 'is_active', 
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'action_display', 'model_name', 
                 'object_id', 'description', 'ip_address', 'user_agent', 'timestamp']
        read_only_fields = ['timestamp']


# Cart Management Serializers
class CartItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


class CartSerializer(serializers.Serializer):
    items = CartItemSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


# Payment Serializers
class LinePaySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField(default='THB')
    product_name = serializers.CharField()
    product_image_url = serializers.URLField(required=False)


class PromptPaySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    qr_code = serializers.CharField(read_only=True)
    qr_image_url = serializers.URLField(read_only=True)


class TrueMoneySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    qr_code = serializers.CharField(read_only=True)
    qr_image_url = serializers.URLField(read_only=True)


class RabbitPaySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    qr_code = serializers.CharField(read_only=True)
    qr_image_url = serializers.URLField(read_only=True)


class SCBEasySerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    qr_code = serializers.CharField(read_only=True)
    qr_image_url = serializers.URLField(read_only=True)


class PaymentSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    payment_method = serializers.ChoiceField(choices=[
        ('line_pay', 'LINE Pay'),
        ('promptpay', 'PromptPay'),
        ('truemoney', 'TrueMoney Wallet'),
        ('rabbit', 'Rabbit LINE Pay'),
        ('scb_easy', 'SCB Easy'),
        ('cod', 'ชำระปลายทาง'),
        ('cash', 'เงินสด'),
    ])
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    cash_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)


# Delivery Management Serializers
class DeliveryFeeCalculationSerializer(serializers.Serializer):
    distance = serializers.DecimalField(max_digits=8, decimal_places=2)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)


class DeliveryTrackingSerializer(serializers.ModelSerializer):
    order_info = OrderSerializer(source='order', read_only=True)
    driver_name = serializers.CharField(source='delivery_person.get_full_name', read_only=True)
    
    class Meta:
        model = Delivery
        fields = ['id', 'order', 'order_info', 'delivery_person', 'driver_name',
                 'estimated_delivery_time', 'actual_delivery_time', 'notes',
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
