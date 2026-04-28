from rest_framework import serializers
from .models import PaymentTransaction, PaymentWebhook, PaymentCheckLog


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


class PaymentStatusSerializer(serializers.Serializer):
    transaction_id = serializers.CharField()
    status = serializers.CharField(read_only=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    payment_method = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)
    order_id = serializers.IntegerField(read_only=True)


class PaymentWebhookSerializer(serializers.Serializer):
    transaction_id = serializers.CharField()
    status = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method = serializers.CharField()
    signature = serializers.CharField(required=False)
    webhook_data = serializers.JSONField(required=False)


class PaymentCheckLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentCheckLog
        fields = '__all__'
        read_only_fields = ('created_at',)
