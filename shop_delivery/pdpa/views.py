from rest_framework import generics, permissions
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from accounts.models import Customer
from .models import ConsentRecord, PrivacyPolicy
from .serializers import ConsentRecordSerializer, PrivacyPolicySerializer


class PrivacyPolicyView(generics.ListAPIView):
    """นโยบายความเป็นส่วนตัว"""
    serializer_class = PrivacyPolicySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        return PrivacyPolicy.objects.filter(is_active=True).order_by('-effective_date')


class ConsentRecordView(generics.ListCreateAPIView):
    """จัดการความยินยอม PDPA"""
    serializer_class = ConsentRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        customer = get_object_or_404(Customer, user=self.request.user)
        return ConsentRecord.objects.filter(customer=customer).order_by('-given_at')
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # ตั้งค่า customer และ IP
        customer = get_object_or_404(Customer, user=request.user)
        serializer.validated_data['customer'] = customer
        serializer.validated_data['ip_address'] = request.META.get('REMOTE_ADDR')
        serializer.validated_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
        
        consent = serializer.save()
        
        return Response({
            'message': 'บันทึกความยินยอมสำเร็จ',
            'consent_id': consent.id
        }, status=201)