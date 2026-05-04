from rest_framework import serializers
from .models import ConsentRecord, DataProcessingActivity, PrivacyPolicy, AuditLog


class ConsentRecordSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.user.get_full_name', read_only=True)
    consent_type_display = serializers.CharField(source='get_consent_type_display', read_only=True)
    privacy_policy = serializers.PrimaryKeyRelatedField(
        queryset=PrivacyPolicy.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ConsentRecord
        fields = [
            'id', 'customer', 'customer_name', 'consent_type', 'consent_type_display',
            'privacy_policy', 'is_given', 'given_at', 'withdrawn_at', 'ip_address', 'user_agent',
        ]
        read_only_fields = [
            'given_at', 'withdrawn_at', 'customer',
            'ip_address', 'user_agent',  # เติมที่ ConsentRecordView.create จาก request
        ]

    def validate(self, attrs):
        consent_type = attrs.get('consent_type')
        is_given = attrs.get('is_given')
        policy = attrs.get('privacy_policy')
        if consent_type == 'privacy_policy':
            if is_given:
                current = PrivacyPolicy.objects.filter(is_active=True).order_by(
                    '-effective_date', '-id',
                ).first()
                if not current:
                    raise serializers.ValidationError(
                        {'privacy_policy': 'ยังไม่มีนโยบายที่เปิดใช้งาน'},
                    )
                if not policy or policy.id != current.id:
                    raise serializers.ValidationError(
                        {'privacy_policy': 'ต้องอ้างอิงนโยบายปัจจุบัน'},
                    )
            else:
                # ปฏิเสธนโยบาย — อนุญาตแนบ privacy_policy = ฉบับปัจจุบันเพื่อ audit
                current = PrivacyPolicy.objects.filter(is_active=True).order_by(
                    '-effective_date', '-id',
                ).first()
                if policy is not None and current and policy.id == current.id:
                    attrs['privacy_policy'] = current
                else:
                    attrs['privacy_policy'] = None
        elif policy is not None:
            attrs['privacy_policy'] = None
        return attrs


class PrivacyPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacyPolicy
        fields = ['id', 'version', 'title', 'content', 'effective_date', 'is_active', 
                 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']



