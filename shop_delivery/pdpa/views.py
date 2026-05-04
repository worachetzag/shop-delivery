from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import transaction
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
    """นโยบายความเป็นส่วนตัว (ฉบับที่ใช้งานล่าสุดเท่านั้น — เหมือน /consent/status)"""
    serializer_class = PrivacyPolicySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        p = PrivacyPolicy.get_current_for_storefront()
        if not p:
            return PrivacyPolicy.objects.none()
        return PrivacyPolicy.objects.filter(pk=p.pk)


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
    """ลูกค้า: ต้องแสดง popup หรือไม่ — ยังไม่ยอมรับฉบับที่ใช้งานล่าสุด (เวอร์ชันใหม่ = policy id ใหม่ → ต้องยอมรับใหม่)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj or role_obj.role != 'customer':
            return Response({'requires_consent': False, 'policy': None})

        try:
            customer = Customer.objects.get(user=request.user)
        except Customer.DoesNotExist:
            return Response({'requires_consent': False, 'policy': None})

        policy = PrivacyPolicy.get_current_for_storefront()
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
        policy = PrivacyPolicy.get_current_for_storefront()

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


def _admin_pdpa_denied():
    return Response(
        {'error': 'ไม่มีสิทธิ์แก้ไขนโยบายความเป็นส่วนตัว'},
        status=status.HTTP_403_FORBIDDEN,
    )


def _privacy_policy_activate_exclusive(policy):
    """มีได้แค่หนึ่งฉบับที่ is_active=True สำหรับ API ลูกค้า"""
    if policy.is_active:
        PrivacyPolicy.objects.exclude(pk=policy.pk).update(is_active=False)


class AdminPrivacyPolicyListCreateView(APIView):
    """แอดมิน: รายการนโยบายทุกฉบับ (ย้อนหลังได้) + สร้างเวอร์ชันใหม่"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_admin_user(request.user):
            return _admin_pdpa_denied()
        qs = PrivacyPolicy.objects.all().order_by('-effective_date', '-id')
        return Response({
            'policies': PrivacyPolicySerializer(qs, many=True).data,
        })

    def post(self, request):
        if not _is_admin_user(request.user):
            return _admin_pdpa_denied()
        serializer = PrivacyPolicySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            policy = serializer.save()
            _privacy_policy_activate_exclusive(policy)
            policy.refresh_from_db()
        return Response(
            {
                'message': 'สร้างนโยบายฉบับใหม่แล้ว',
                'policy': PrivacyPolicySerializer(policy).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminPrivacyPolicyDetailView(APIView):
    """แอดมิน: อ่าน/แก้ไขนโยบายตาม id (ฉบับเก่าแก้ได้ — ไม่ลบเพื่อเก็บประวัติ)"""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        if not _is_admin_user(request.user):
            return _admin_pdpa_denied()
        policy = get_object_or_404(PrivacyPolicy, pk=pk)
        return Response({'policy': PrivacyPolicySerializer(policy).data})

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        if not _is_admin_user(request.user):
            return _admin_pdpa_denied()
        policy = get_object_or_404(PrivacyPolicy, pk=pk)
        serializer = PrivacyPolicySerializer(policy, data=request.data, partial=partial)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            policy = serializer.save()
            _privacy_policy_activate_exclusive(policy)
            policy.refresh_from_db()
        return Response(
            {
                'message': 'บันทึกนโยบายแล้ว',
                'policy': PrivacyPolicySerializer(policy).data,
            },
            status=status.HTTP_200_OK,
        )