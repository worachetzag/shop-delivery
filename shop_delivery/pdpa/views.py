from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.models import Customer
from accounts.permissions import is_admin_user as _is_admin_user
from .models import ConsentRecord, PrivacyPolicy
from .serializers import ConsentRecordSerializer, PrivacyPolicySerializer


def _dt_iso(dt):
    if dt is None:
        return None
    return dt.isoformat()


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

        customer = get_object_or_404(Customer, user=request.user)
        ip_raw = request.META.get('REMOTE_ADDR')
        ip_address = ip_raw if ip_raw else '0.0.0.0'

        consent = serializer.save(
            customer=customer,
            ip_address=ip_address,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
        )

        return Response({
            'message': 'บันทึกความยินยอมสำเร็จ',
            'consent_id': consent.id
        }, status=201)


class PdpaConsentStatusView(APIView):
    """ลูกค้า: ต้องแสดง popup ยอมรับ PDPA หรือไม่ (ยังไม่ยอมรับฉบับที่ใช้อยู่)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj or role_obj.role != 'customer':
            return Response({'requires_consent': False, 'policy': None})

        try:
            customer = Customer.objects.get(user=request.user)
        except Customer.DoesNotExist:
            return Response({'requires_consent': False, 'policy': None})

        policy = PrivacyPolicy.objects.filter(is_active=True).order_by('-effective_date', '-id').first()
        if not policy:
            return Response({'requires_consent': False, 'policy': None})

        accepted = ConsentRecord.objects.filter(
            customer=customer,
            consent_type='privacy_policy',
            is_given=True,
            privacy_policy_id=policy.id,
            withdrawn_at__isnull=True,
        ).exists()

        ser = PrivacyPolicySerializer(policy)
        if accepted:
            return Response({'requires_consent': False, 'policy': ser.data})
        return Response({'requires_consent': True, 'policy': ser.data})


class PdpaWithdrawPrivacyConsentView(APIView):
    """ลูกค้าถอนความยินยอมนโยบายความเป็นส่วนตัว — ระบบจะขอให้ยอมรับฉบับปัจจุบันอีกครั้งในขั้นตอนถัดไป"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj or role_obj.role != 'customer':
            return Response(
                {'error': 'ไม่มีสิทธิ์ดำเนินการนี้'},
                status=status.HTTP_403_FORBIDDEN,
            )
        customer = get_object_or_404(Customer, user=request.user)
        now = timezone.now()
        updated = ConsentRecord.objects.filter(
            customer=customer,
            consent_type='privacy_policy',
            is_given=True,
            withdrawn_at__isnull=True,
        ).update(withdrawn_at=now)
        return Response(
            {
                'message': 'ถอนความยินยอมนโยบายความเป็นส่วนตัวแล้ว',
                'records_updated': updated,
            },
            status=status.HTTP_200_OK,
        )


class PdpaWithdrawMarketingConsentView(APIView):
    """ลูกค้าถอนความยินยอมการตลาด (แยกจากนโยบายความเป็นส่วนตัว)"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj or role_obj.role != 'customer':
            return Response(
                {'error': 'ไม่มีสิทธิ์ดำเนินการนี้'},
                status=status.HTTP_403_FORBIDDEN,
            )
        customer = get_object_or_404(Customer, user=request.user)
        now = timezone.now()
        updated = ConsentRecord.objects.filter(
            customer=customer,
            consent_type='marketing',
            is_given=True,
            withdrawn_at__isnull=True,
        ).update(withdrawn_at=now)
        return Response(
            {
                'message': 'ถอนความยินยอมการตลาดแล้ว',
                'records_updated': updated,
            },
            status=status.HTTP_200_OK,
        )


class PdpaCustomerConsentSummaryView(APIView):
    """ลูกค้า: สรุปสถานะความยินยอมนโยบายปัจจุบันและการตลาด (แสดงในโปรไฟล์)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj or role_obj.role != 'customer':
            return Response(
                {'error': 'ไม่มีสิทธิ์ดำเนินการนี้'},
                status=status.HTTP_403_FORBIDDEN,
            )
        customer = get_object_or_404(Customer, user=request.user)
        policy = PrivacyPolicy.objects.filter(is_active=True).order_by('-effective_date', '-id').first()

        current_policy = None
        privacy_active = None
        if policy:
            current_policy = {
                'id': policy.id,
                'version': policy.version,
                'title': policy.title,
            }
            privacy_active = ConsentRecord.objects.filter(
                customer=customer,
                consent_type='privacy_policy',
                is_given=True,
                privacy_policy_id=policy.id,
                withdrawn_at__isnull=True,
            ).order_by('-given_at').first()

        privacy_accepted = privacy_active is not None
        privacy_last_accepted_at = _dt_iso(privacy_active.given_at) if privacy_active else None

        privacy_last_withdrawn = ConsentRecord.objects.filter(
            customer=customer,
            consent_type='privacy_policy',
            withdrawn_at__isnull=False,
        ).order_by('-withdrawn_at').first()
        privacy_last_withdrawn_at = _dt_iso(
            privacy_last_withdrawn.withdrawn_at,
        ) if privacy_last_withdrawn else None

        marketing_active = ConsentRecord.objects.filter(
            customer=customer,
            consent_type='marketing',
            is_given=True,
            withdrawn_at__isnull=True,
        ).order_by('-given_at').first()
        marketing_opt_in = marketing_active is not None
        marketing_last_given_at = _dt_iso(marketing_active.given_at) if marketing_active else None

        marketing_last_withdrawn = ConsentRecord.objects.filter(
            customer=customer,
            consent_type='marketing',
            withdrawn_at__isnull=False,
        ).order_by('-withdrawn_at').first()
        marketing_last_withdrawn_at = _dt_iso(
            marketing_last_withdrawn.withdrawn_at,
        ) if marketing_last_withdrawn else None

        return Response(
            {
                'privacy_policy': {
                    'accepted': privacy_accepted,
                    'current_policy': current_policy,
                    'last_accepted_at': privacy_last_accepted_at,
                    'last_withdrawn_at': privacy_last_withdrawn_at,
                },
                'marketing': {
                    'opt_in': marketing_opt_in,
                    'last_given_at': marketing_last_given_at,
                    'last_withdrawn_at': marketing_last_withdrawn_at,
                },
            },
        )


class AdminPrivacyPolicyView(APIView):
    """อ่าน/บันทึกนโยบาย PDPA ฉบับล่าสุด (สำหรับแอดมิน) — เนื้อหาเป็น HTML จาก rich text editor"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_admin_user(request.user):
            return Response(
                {'error': 'ไม่มีสิทธิ์แก้ไขนโยบายความเป็นส่วนตัว'},
                status=status.HTTP_403_FORBIDDEN,
            )
        obj = PrivacyPolicy.objects.order_by('-effective_date', '-id').first()
        if not obj:
            return Response({'policy': None})
        return Response({'policy': PrivacyPolicySerializer(obj).data})

    def put(self, request):
        if not _is_admin_user(request.user):
            return Response(
                {'error': 'ไม่มีสิทธิ์แก้ไขนโยบายความเป็นส่วนตัว'},
                status=status.HTTP_403_FORBIDDEN,
            )
        instance = PrivacyPolicy.objects.order_by('-effective_date', '-id').first()
        serializer = PrivacyPolicySerializer(
            instance=instance,
            data=request.data,
            partial=instance is not None,
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        policy = serializer.save()
        return Response(
            {
                'message': 'บันทึกนโยบายแล้ว',
                'policy': PrivacyPolicySerializer(policy).data,
            },
            status=status.HTTP_200_OK,
        )