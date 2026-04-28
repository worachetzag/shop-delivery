from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Customer, CustomerAddress, LineUser, UserRole, DriverProfile, AdminProfile, StaffAuditLog


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']


class CustomerSerializer(serializers.ModelSerializer):
    user_info = UserSerializer(source='user', read_only=True)
    
    # เพิ่ม fields สำหรับ frontend
    picture_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = ['id', 'user', 'user_info', 'id_card_number', 'date_of_birth', 
                 'address', 'phone_number', 'latitude', 'longitude', 'picture_url', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_picture_url(self, obj):
        """ดึงรูปโปรไฟล์จาก LineUser ถ้ามี"""
        try:
            line_user = obj.user.line_user
            return line_user.picture_url
        except:
            return None


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


class CustomerLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class LineLoginSerializer(serializers.Serializer):
    line_user_id = serializers.CharField()
    display_name = serializers.CharField()
    picture_url = serializers.URLField(required=False, allow_null=True)
    status_message = serializers.CharField(required=False, allow_null=True)


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = [
            'id',
            'label',
            'recipient_name',
            'phone_number',
            'address_line',
            'district',
            'province',
            'postal_code',
            'latitude',
            'longitude',
            'is_default',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class StaffAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()

    class Meta:
        model = StaffAuditLog
        fields = [
            'id',
            'created_at',
            'actor_username',
            'action',
            'action_display',
            'target_type',
            'target_id',
            'summary',
            'detail',
            'ip_address',
        ]

    def get_actor_username(self, obj):
        if obj.actor_id:
            return obj.actor.username
        return '(ลบผู้ใช้แล้ว)'

    def get_action_display(self, obj):
        """ถ้ามี action_label_th ใน detail ให้แสดงแทนป้ายทั่วไป (ละเอียดตามที่บันทึก)"""
        if isinstance(obj.detail, dict):
            custom = obj.detail.get('action_label_th')
            if custom:
                return custom
        return obj.get_action_display()
