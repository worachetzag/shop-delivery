from rest_framework import serializers
from .models import ConsentRecord, DataProcessingActivity, PrivacyPolicy, AuditLog


class ConsentRecordSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    consent_type_display = serializers.CharField(source='get_consent_type_display', read_only=True)
    
    class Meta:
        model = ConsentRecord
        fields = ['id', 'customer', 'customer_name', 'consent_type', 'consent_type_display', 
                 'is_given', 'given_at', 'withdrawn_at', 'ip_address', 'user_agent']
        read_only_fields = ['given_at', 'withdrawn_at']


class PrivacyPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacyPolicy
        fields = ['id', 'version', 'title', 'content', 'effective_date', 'is_active', 
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']



