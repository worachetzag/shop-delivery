from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from django.conf import settings
import hmac
import qrcode
import io
import base64
from PIL import Image
from .serializers import (
    PromptPaySerializer, TrueMoneySerializer, RabbitPaySerializer, SCBEasySerializer,
    PaymentStatusSerializer, PaymentWebhookSerializer, PaymentCheckLogSerializer
)
from .models import PaymentTransaction, PaymentWebhook, PaymentCheckLog

_PAYMENT_WEBHOOK_META_HEADER = 'HTTP_X_PAYMENT_WEBHOOK_SECRET'


def _payment_webhook_secret_authorized(request) -> bool:
    """Production (DEBUG=False): ต้องตั้ง PAYMENT_WEBHOOK_SECRET และส่ง header ให้ตรงกัน"""
    secret = (getattr(settings, 'PAYMENT_WEBHOOK_SECRET', None) or '').strip()
    if not secret:
        return bool(settings.DEBUG)
    received = (request.META.get(_PAYMENT_WEBHOOK_META_HEADER) or '').strip()
    try:
        a = received.encode('utf-8')
        b = secret.encode('utf-8')
    except Exception:
        return False
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


def _webhook_type_for_payment_method(payment_method: str) -> str:
    key = (payment_method or '').strip().lower().replace(' ', '_')
    mapping = {
        'promptpay': 'promptpay',
        'truemoney': 'truemoney',
        'rabbit_line_pay': 'rabbit',
        'rabbit': 'rabbit',
        'scb_easy': 'scb_easy',
        'line_pay': 'line_pay',
    }
    return mapping.get(key, 'promptpay')


class PromptPayQRView(APIView):
    """สร้าง QR Code สำหรับ PromptPay"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PromptPaySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            # สร้าง QR Code สำหรับ PromptPay
            qr_data = f"00020101021229370016A000000677010111011300669999999999995204000053030025404{amount:.2f}5802TH6304"
            
            # สร้าง QR Code image
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=200)
        
        return Response(serializer.errors, status=400)


class TrueMoneyQRView(APIView):
    """สร้าง QR Code สำหรับ TrueMoney"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = TrueMoneySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            qr_data = f"truemoney://pay?amount={amount}&order_id={order_id}"
            
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=200)
        
        return Response(serializer.errors, status=400)


class RabbitPayQRView(APIView):
    """สร้าง QR Code สำหรับ Rabbit LINE Pay"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = RabbitPaySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            qr_data = f"rabbit://pay?amount={amount}&order_id={order_id}"
            
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=200)
        
        return Response(serializer.errors, status=400)


class SCBEasyQRView(APIView):
    """สร้าง QR Code สำหรับ SCB Easy"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = SCBEasySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            qr_data = f"scb://pay?amount={amount}&order_id={order_id}"
            
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=200)
        
        return Response(serializer.errors, status=400)


class PaymentStatusCheckView(APIView):
    """เช็คสถานะการชำระเงิน"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, transaction_id):
        try:
            payment = PaymentTransaction.objects.get(transaction_id=transaction_id)
            
            # บันทึกการเช็คสถานะ
            PaymentCheckLog.objects.create(
                transaction_id=transaction_id,
                check_type='manual',
                status=payment.status,
                response_data={'status': payment.status}
            )
            
            serializer = PaymentStatusSerializer({
                'transaction_id': payment.transaction_id,
                'status': payment.status,
                'amount': payment.amount,
                'payment_method': payment.payment_method,
                'created_at': payment.created_at,
                'updated_at': payment.updated_at,
                'order_id': payment.order_id
            })
            
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except PaymentTransaction.DoesNotExist:
            return Response(
                {'error': 'Transaction not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class PaymentWebhookView(APIView):
    """รับ webhook จาก payment gateway — ยืนยันด้วย X-Payment-Webhook-Secret เมื่อตั้ง PAYMENT_WEBHOOK_SECRET"""
    permission_classes = []  # ไม่ใช้ user auth — ใช้ shared secret แทน

    def post(self, request):
        if not _payment_webhook_secret_authorized(request):
            return Response(
                {'error': 'Webhook authentication failed or PAYMENT_WEBHOOK_SECRET not configured'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PaymentWebhookSerializer(data=request.data)
        if serializer.is_valid():
            transaction_id = serializer.validated_data['transaction_id']
            new_status = serializer.validated_data['status']
            amount = serializer.validated_data['amount']
            payment_method = serializer.validated_data['payment_method']

            try:
                payment = PaymentTransaction.objects.get(transaction_id=transaction_id)
                payment.status = new_status
                payment.save()

                secret_configured = bool((getattr(settings, 'PAYMENT_WEBHOOK_SECRET', None) or '').strip())
                payload = request.data
                if hasattr(payload, 'dict'):
                    payload = payload.dict()
                elif not isinstance(payload, dict):
                    payload = {'_raw': str(payload)}

                PaymentWebhook.objects.create(
                    webhook_type=_webhook_type_for_payment_method(payment_method),
                    transaction=payment,
                    payload=payload,
                    signature=(request.META.get(_PAYMENT_WEBHOOK_META_HEADER) or '')[:500],
                    is_verified=secret_configured,
                    processed_at=None,
                )

                return Response({'status': 'success'}, status=status.HTTP_200_OK)

            except PaymentTransaction.DoesNotExist:
                return Response(
                    {'error': 'Transaction not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)