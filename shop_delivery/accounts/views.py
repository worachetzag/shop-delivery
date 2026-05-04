from rest_framework import filters, generics, status, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from shop_delivery.pagination import StandardPagination
from rest_framework.authtoken.models import Token
from django.shortcuts import get_object_or_404, render
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.http import HttpResponseRedirect, JsonResponse
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction, IntegrityError
from datetime import datetime
from django.core.exceptions import ValidationError
from django.core.validators import EmailValidator
from django.db.models import Count, DecimalField, Max, Q, Sum, Value
from django.db.models.functions import Coalesce
import requests
import re
import logging
import secrets
from urllib.parse import quote_plus, unquote, urlencode

logger = logging.getLogger(__name__)


def _sanitize_line_oauth_next(raw_next) -> str:
    """
    จำกัด path หลังล็อกอิน LINE ให้อยู่ใต้ /customer เท่านั้น (กัน open redirect)
    ใช้ส่งผู้ใช้กลับไปหน้ารายละเอียดออเดอร์จากลิงก์ในแชท เช่น /customer/orders/123
    """
    default = '/customer'
    if raw_next is None:
        return default
    try:
        full = unquote(str(raw_next).strip())
    except Exception:
        return default
    if not full:
        return default
    if not full.startswith('/'):
        full = '/' + full
    lower = full.lower()
    if lower.startswith(('http://', 'https://', '//')):
        return default
    base, _, query = full.partition('?')
    base = base.split('#', 1)[0]
    if '..' in base:
        return default
    # ลิงก์จาก LIFF notify: path หลัง liffId เป็น orders/<id> (ไม่มี prefix /customer)
    om = re.match(r'^/orders/(\d+)/?$', base, re.I)
    if om:
        base = f'/customer/orders/{om.group(1)}'
    elif re.match(r'^/orders/?$', base, re.I):
        base = '/customer/orders'
    if base == '/customer':
        out = base
    elif base.startswith('/customer/') and not base.startswith('/customer/login'):
        out = base
    else:
        return default
    if query:
        return f'{out}?{query[:800]}'
    return out


def _normalize_contact_email(raw):
    """ค่าที่ลูกค้ากรอก — ว่างได้; ถ้าไม่ว่างต้องเป็นอีเมลที่ใช้ได้"""
    s = '' if raw is None else str(raw).strip()
    if not s:
        return ''
    EmailValidator(message='รูปแบบอีเมลไม่ถูกต้อง')(s)
    return s


def driver_profile_photo_url(request, profile):
    """URL เต็มสำหรับรูปคนขับ (หรือ None ถ้าไม่มี)"""
    if not profile:
        return None
    photo = getattr(profile, 'photo', None)
    if not photo:
        return None
    try:
        url = photo.url
    except ValueError:
        return None
    if request:
        return request.build_absolute_uri(url)
    return url


class AddressGeocodeView(APIView):
    """
    Geocode ที่อยู่เพื่อให้ได้ latitude/longitude (ใช้ในหน้า Checkout ตอนกรอกที่อยู่ใหม่)
    หมายเหตุ: ใช้ Nominatim (OpenStreetMap) แบบ public เพื่อความสะดวกในการพัฒนา/ทดสอบ
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        address_line = (request.data.get('address_line') or request.data.get('address') or '').strip()
        district = (request.data.get('district') or '').strip()
        province = (request.data.get('province') or '').strip()
        postal_code = (request.data.get('postal_code') or request.data.get('postalCode') or '').strip()

        query = ' '.join([p for p in [address_line, district, province, postal_code] if p]).strip()
        if not query:
            return Response({'error': 'address query ไม่ครบ'}, status=status.HTTP_400_BAD_REQUEST)

        # Nominatim endpoint
        url = 'https://nominatim.openstreetmap.org/search'
        params = {
            'format': 'json',
            'limit': 1,
            'q': query,
        }

        headers = {
            # user-agent สำคัญตามนโยบายของ Nominatim
            'User-Agent': 'shop-delivery/1.0 (contact: unknown)',
            'Accept-Language': 'th',
        }

        try:
            resp = requests.get(url, params=params, headers=headers, timeout=8)
            if resp.status_code != 200:
                return Response({'error': 'geocode service error'}, status=status.HTTP_502_BAD_GATEWAY)

            results = resp.json() if resp.text else []
            if not results:
                return Response({'error': 'ไม่พบพิกัดจากที่อยู่'}, status=status.HTTP_404_NOT_FOUND)

            top = results[0]
            lat = top.get('lat')
            lon = top.get('lon')
            if lat is None or lon is None:
                return Response({'error': 'geocode ไม่ได้พิกัด'}, status=status.HTTP_404_NOT_FOUND)

            return Response({'latitude': lat, 'longitude': lon}, status=status.HTTP_200_OK)
        except requests.RequestException:
            logger.exception('Geocode failed')
            return Response({'error': 'geocode failed'}, status=status.HTTP_502_BAD_GATEWAY)

def _line_callback_url(request):
    """Resolve LINE callback URL with predictable priority."""
    configured = getattr(settings, 'LINE_LOGIN_CALLBACK_URL', '').strip()
    if configured:
        return configured
    return request.build_absolute_uri('/accounts/line/login/callback/')


from .models import Customer, CustomerAddress, LineUser, UserRole, DriverProfile, AdminProfile, StaffAuditLog

from .serializers import (
    CustomerSerializer,
    CustomerAddressSerializer,
    CustomerCreateSerializer,
    CustomerLoginSerializer,
    LineLoginSerializer,
    StaffAuditLogSerializer,
    AdminCustomerListSerializer,
    AdminCustomerDetailSerializer,
)
from .permissions import is_admin_user, can_manage_staff_accounts
from .staff_audit import log_staff_audit
from .validators import (
    is_reasonable_customer_dob,
    is_valid_thai_citizen_id,
    refresh_customer_profile_completed,
    thai_citizen_id_digits,
)


class CustomerLoginView(generics.GenericAPIView):
    """เข้าสู่ระบบลูกค้า"""
    serializer_class = CustomerLoginSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        user = authenticate(username=username, password=password)
        if user:
            # Login session สำหรับ Django
            from django.contrib.auth import login
            login(request, user)
            
            # สร้างหรือดึง token
            token, created = Token.objects.get_or_create(user=user)
            
            # ดึงข้อมูล role
            try:
                user_role = user.user_role
                role = user_role.role
            except:
                role = 'customer'  # default
            
            # ตรวจสอบ role
            if role != 'customer':
                return Response({
                    'error': 'บัญชีนี้ไม่ใช่บัญชีลูกค้า กรุณาใช้หน้าล็อกอินที่ถูกต้อง'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # ดึงข้อมูลลูกค้า
            try:
                customer = Customer.objects.get(user=user)
                return Response({
                    'message': 'เข้าสู่ระบบสำเร็จ',
                    'token': token.key,
                    'user_id': user.id,
                    'customer_id': customer.id,
                    'username': user.username,
                    'email': user.email,
                    'role': role,
                }, status=status.HTTP_200_OK)
            except Customer.DoesNotExist:
                return Response({
                    'error': 'ไม่พบข้อมูลลูกค้า'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({
                'error': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
            }, status=status.HTTP_401_UNAUTHORIZED)


class AdminLoginView(generics.GenericAPIView):
    """เข้าสู่ระบบแอดมิน"""
    serializer_class = CustomerLoginSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        user = authenticate(username=username, password=password)
        if user:
            # Login session สำหรับ admin
            from django.contrib.auth import login
            login(request, user)
            
            # สร้างหรือดึง token
            token, created = Token.objects.get_or_create(user=user)
            
            # Allow Django staff/superuser as admin even without UserRole.
            if user.is_superuser or user.is_staff:
                role = 'super_admin'
            else:
                try:
                    user_role = user.user_role
                    role = user_role.role
                except Exception:
                    if hasattr(user, 'admin_profile'):
                        role = 'store_admin'
                        UserRole.objects.update_or_create(user=user, defaults={'role': 'store_admin'})
                    else:
                        return Response({
                            'error': 'บัญชีนี้ไม่ได้รับบทบาท กรุณาติดต่อผู้ดูแลระบบ'
                        }, status=status.HTTP_403_FORBIDDEN)

            # ตรวจสอบ role ต้องเป็น store_admin หรือ super_admin
            if role not in ['store_admin', 'super_admin', 'admin']:
                return Response({
                    'error': 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงหน้าแอดมิน'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Redirect URL สำหรับ admin dashboard
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
            redirect_url = f'{frontend_url}/admin/dashboard'

            log_staff_audit(
                request,
                StaffAuditLog.Action.ADMIN_LOGIN,
                summary=f'เข้าสู่ระบบแอดมิน: {user.username}',
                detail={'role': role},
            )

            return Response({
                'message': 'เข้าสู่ระบบแอดมินสำเร็จ',
                'token': token.key,
                'user_id': user.id,
                'username': user.username,
                'email': user.email,
                'role': role,
                'redirect_url': redirect_url,
                'can_view_staff_audit': can_manage_staff_accounts(user),
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
            }, status=status.HTTP_401_UNAUTHORIZED)


class DriverLoginView(generics.GenericAPIView):
    """เข้าสู่ระบบคนขับ"""
    serializer_class = CustomerLoginSerializer
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        user = authenticate(username=username, password=password)
        if not user:
            return Response({'error': 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'}, status=status.HTTP_401_UNAUTHORIZED)

        role_obj = getattr(user, 'user_role', None)
        role = role_obj.role if role_obj else ''
        if role != 'driver':
            return Response({'error': 'บัญชีนี้ไม่มีสิทธิ์เข้าหน้าคนขับ'}, status=status.HTTP_403_FORBIDDEN)

        if not hasattr(user, 'driver_profile'):
            return Response({'error': 'ไม่พบข้อมูลโปรไฟล์คนขับ'}, status=status.HTTP_404_NOT_FOUND)

        from django.contrib.auth import login
        login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        return Response({
            'message': 'เข้าสู่ระบบคนขับสำเร็จ',
            'token': token.key,
            'username': user.username,
            'role': role,
        }, status=status.HTTP_200_OK)


class StaffAuditLogListView(generics.ListAPIView):
    """ประวัติการทำงาน — เฉพาะเจ้าของร้าน (super_admin / admin ระดับบน)"""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StaffAuditLogSerializer
    queryset = StaffAuditLog.objects.select_related('actor').all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = (
        'summary',
        'action',
        'target_type',
        'target_id',
        'actor__username',
        'actor__first_name',
        'actor__last_name',
    )
    ordering_fields = ['id', 'created_at', 'action', 'ip_address']
    ordering = ['-created_at']

    def get_queryset(self):
        if not can_manage_staff_accounts(self.request.user):
            return StaffAuditLog.objects.none()
        qs = StaffAuditLog.objects.select_related('actor').all()
        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)
        username = self.request.query_params.get('username')
        if username:
            qs = qs.filter(actor__username__icontains=username.strip())
        return qs

    def list(self, request, *args, **kwargs):
        if not can_manage_staff_accounts(request.user):
            return Response({'error': 'ไม่มีสิทธิ์ดูประวัติพนักงาน'}, status=status.HTTP_403_FORBIDDEN)
        return super().list(request, *args, **kwargs)


class AdminLogoutView(generics.GenericAPIView):
    """ออกจากระบบแอดมิน + บันทึกประวัติ"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({'error': 'ไม่ใช่บัญชีแอดมิน'}, status=status.HTTP_403_FORBIDDEN)
        actor = request.user
        log_staff_audit(
            request,
            StaffAuditLog.Action.ADMIN_LOGOUT,
            summary=f'ออกจากระบบ: {actor.username}',
            actor=actor,
        )
        from django.contrib.auth import logout

        logout(request)
        return Response({'message': 'ออกจากระบบแล้ว'}, status=status.HTTP_200_OK)


class AdminStaffListCreateView(generics.GenericAPIView):
    """จัดการพนักงาน (store admin/super admin)"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์เข้าถึงข้อมูลแอดมิน'}, status=status.HTTP_403_FORBIDDEN)

        if can_manage_staff_accounts(request.user):
            users = (
                User.objects.filter(
                    Q(user_role__role__in=['store_admin', 'super_admin', 'admin']) |
                    Q(is_staff=True) |
                    Q(is_superuser=True)
                )
                .distinct()
                .order_by('-date_joined')
            )
        else:
            users = User.objects.filter(id=request.user.id).order_by('-date_joined')

        data = []
        for user in users:
            role_obj = getattr(user, 'user_role', None)
            role = role_obj.role if role_obj else ('super_admin' if user.is_superuser else 'store_admin')
            data.append({
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'email': user.email,
                'role': role,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            })
        paginator = StandardPagination()
        page = paginator.paginate_queryset(data, request, self)
        if page is not None:
            return paginator.get_paginated_response(list(page))
        return Response(data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        if not can_manage_staff_accounts(request.user):
            return Response({'error': 'บัญชีนี้ไม่มีสิทธิ์เพิ่มพนักงาน'}, status=status.HTTP_403_FORBIDDEN)

        username = (request.data.get('username') or '').strip()
        password = (request.data.get('password') or '').strip()
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip()
        role = (request.data.get('role') or 'store_admin').strip()

        if not username or not password:
            return Response({'error': 'กรุณากรอก username และ password'}, status=status.HTTP_400_BAD_REQUEST)
        if role not in ['store_admin', 'super_admin', 'admin']:
            return Response({'error': 'role ไม่ถูกต้อง'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'username นี้ถูกใช้งานแล้ว'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            email=email,
        )
        # Do not grant Django admin-site access for staff created from this screen.
        user.is_staff = False
        user.is_superuser = False
        user.save()
        UserRole.objects.update_or_create(user=user, defaults={'role': role})

        log_staff_audit(
            request,
            StaffAuditLog.Action.STAFF_CREATE,
            target_type='user',
            target_id=str(user.id),
            summary=f'เพิ่มบัญชีพนักงาน {username} ({role})',
            detail={'username': username, 'role': role},
        )

        return Response({
            'message': 'เพิ่มพนักงานสำเร็จ',
            'id': user.id,
            'username': user.username,
        }, status=status.HTTP_201_CREATED)


class AdminStaffDetailView(generics.GenericAPIView):
    """แก้ไข/ลบพนักงาน"""
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def put(self, request, user_id, *args, **kwargs):
        can_manage = can_manage_staff_accounts(request.user)
        is_self_edit = is_admin_user(request.user) and request.user.id == user_id
        if not (can_manage or is_self_edit):
            return Response({'error': 'บัญชีนี้ไม่มีสิทธิ์แก้ไขพนักงาน'}, status=status.HTTP_403_FORBIDDEN)

        user = get_object_or_404(User, id=user_id)

        username = (request.data.get('username') or user.username).strip()
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip()
        role = (request.data.get('role') or '').strip()
        password = (request.data.get('password') or '').strip()

        if not username:
            return Response({'error': 'กรุณากรอก username'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exclude(id=user.id).exists():
            return Response({'error': 'username นี้ถูกใช้งานแล้ว'}, status=status.HTTP_400_BAD_REQUEST)

        if role:
            if not can_manage:
                return Response({'error': 'ไม่มีสิทธิ์เปลี่ยนบทบาทผู้ใช้งาน'}, status=status.HTTP_403_FORBIDDEN)
            if role not in ['store_admin', 'super_admin', 'admin']:
                return Response({'error': 'role ไม่ถูกต้อง'}, status=status.HTTP_400_BAD_REQUEST)
            UserRole.objects.update_or_create(user=user, defaults={'role': role})

        user.username = username
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        # Keep access flags off for accounts managed in this screen.
        user.is_staff = False
        user.is_superuser = False
        if password:
            user.set_password(password)
        user.save()

        role_obj = getattr(user, 'user_role', None)
        log_staff_audit(
            request,
            StaffAuditLog.Action.STAFF_UPDATE,
            target_type='user',
            target_id=str(user.id),
            summary=f'แก้ไขบัญชีพนักงาน {user.username}',
            detail={
                'username': user.username,
                'role': role_obj.role if role_obj else None,
                'password_changed': bool(password),
            },
        )

        return Response({
            'message': 'แก้ไขข้อมูลพนักงานสำเร็จ',
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'role': role_obj.role if role_obj else 'store_admin',
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, user_id, *args, **kwargs):
        if not can_manage_staff_accounts(request.user):
            return Response({'error': 'บัญชีนี้ไม่มีสิทธิ์ลบพนักงาน'}, status=status.HTTP_403_FORBIDDEN)

        if request.user.id == user_id:
            return Response({'error': 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่'}, status=status.HTTP_400_BAD_REQUEST)

        user = get_object_or_404(User, id=user_id)
        uname = user.username
        uid = user.id
        user.delete()
        log_staff_audit(
            request,
            StaffAuditLog.Action.STAFF_DELETE,
            target_type='user',
            target_id=str(uid),
            summary=f'ลบบัญชีพนักงาน {uname}',
            detail={'username': uname},
        )
        return Response({'message': 'ลบพนักงานสำเร็จ'}, status=status.HTTP_200_OK)


class AdminDriverListCreateView(generics.GenericAPIView):
    """จัดการคนขับ"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์เข้าถึงข้อมูลคนขับ'}, status=status.HTTP_403_FORBIDDEN)

        from orders.models import DriverAssignment
        drivers = DriverProfile.objects.select_related('user').order_by('-created_at')
        data = []
        for driver in drivers:
            active_jobs = DriverAssignment.objects.filter(
                driver=driver.user,
                order__order_type='delivery',
            ).exclude(status__in=['delivered', 'cancelled'])
            has_active_assignment = active_jobs.exists()
            effective_available = bool(driver.is_available) and not has_active_assignment
            data.append({
                'id': driver.id,
                'user_id': driver.user_id,
                'username': driver.user.username,
                'first_name': driver.user.first_name,
                'last_name': driver.user.last_name,
                'email': driver.user.email,
                'full_name': f"{driver.user.first_name} {driver.user.last_name}".strip() or driver.user.username,
                'phone_number': driver.phone_number,
                'license_number': driver.license_number,
                'vehicle_type': driver.vehicle_type,
                'vehicle_number': driver.vehicle_number,
                'is_available': effective_available,
                'has_active_assignment': has_active_assignment,
                'active_assignment_count': active_jobs.count(),
                'photo_url': driver_profile_photo_url(request, driver),
            })
        paginator = StandardPagination()
        page = paginator.paginate_queryset(data, request, self)
        if page is not None:
            return paginator.get_paginated_response(list(page))
        return Response(data, status=status.HTTP_200_OK)

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์เพิ่มคนขับ'}, status=status.HTTP_403_FORBIDDEN)

        username = (request.data.get('username') or '').strip()
        password = (request.data.get('password') or '').strip()
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip()
        phone_number = (request.data.get('phone_number') or '').strip()
        license_number = (request.data.get('license_number') or '').strip()
        vehicle_type = (request.data.get('vehicle_type') or '').strip()
        vehicle_number = (request.data.get('vehicle_number') or '').strip()

        if not username or not password:
            return Response({'error': 'กรุณากรอก username และ password'}, status=status.HTTP_400_BAD_REQUEST)
        if not phone_number or not license_number or not vehicle_type or not vehicle_number:
            return Response({'error': 'กรุณากรอกข้อมูลคนขับให้ครบถ้วน'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'username นี้ถูกใช้งานแล้ว'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            email=email,
        )
        UserRole.objects.update_or_create(user=user, defaults={'role': 'driver'})
        profile = DriverProfile.objects.create(
            user=user,
            license_number=license_number,
            vehicle_type=vehicle_type,
            vehicle_number=vehicle_number,
            phone_number=phone_number,
            is_available=True,
        )
        upload = request.FILES.get('photo')
        if upload:
            profile.photo = upload
            profile.save(update_fields=['photo'])

        al = f'เพิ่มคนขับ «{user.username}»'
        log_staff_audit(
            request,
            StaffAuditLog.Action.DRIVER_CREATE,
            target_type='driver',
            target_id=str(profile.id),
            summary=f'{al} (รหัสโปรไฟล์ #{profile.id})'[:500],
            detail={
                'driver_profile_id': profile.id,
                'user_id': user.id,
                'username': user.username,
                'action_label_th': al[:300],
            },
        )

        return Response({
            'message': 'เพิ่มคนขับสำเร็จ',
            'username': user.username,
            'photo_url': driver_profile_photo_url(request, profile),
        }, status=status.HTTP_201_CREATED)


class AdminDriverDetailView(generics.GenericAPIView):
    """แก้ไข/ลบคนขับ"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @transaction.atomic
    def put(self, request, driver_id, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์แก้ไขข้อมูลคนขับ'}, status=status.HTTP_403_FORBIDDEN)

        driver = get_object_or_404(DriverProfile.objects.select_related('user'), id=driver_id)
        user = driver.user

        username = (request.data.get('username') or user.username).strip()
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip()
        phone_number = (request.data.get('phone_number') or driver.phone_number).strip()
        license_number = (request.data.get('license_number') or driver.license_number).strip()
        vehicle_type = (request.data.get('vehicle_type') or driver.vehicle_type).strip()
        vehicle_number = (request.data.get('vehicle_number') or driver.vehicle_number).strip()
        password = (request.data.get('password') or '').strip()
        is_available_raw = request.data.get('is_available', driver.is_available)

        if not username:
            return Response({'error': 'กรุณากรอก username'}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exclude(id=user.id).exists():
            return Response({'error': 'username นี้ถูกใช้งานแล้ว'}, status=status.HTTP_400_BAD_REQUEST)
        if not phone_number or not license_number or not vehicle_type or not vehicle_number:
            return Response({'error': 'กรุณากรอกข้อมูลคนขับให้ครบถ้วน'}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(is_available_raw, str):
            is_available = is_available_raw.strip().lower() in ['true', '1', 'yes', 'y', 'on']
        else:
            is_available = bool(is_available_raw)

        user.username = username
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        if password:
            user.set_password(password)
        user.save()

        driver.phone_number = phone_number
        driver.license_number = license_number
        driver.vehicle_type = vehicle_type
        driver.vehicle_number = vehicle_number
        driver.is_available = is_available

        clear_photo = request.data.get('clear_photo')
        clear_photo_flag = False
        if clear_photo is True:
            clear_photo_flag = True
        elif isinstance(clear_photo, str) and clear_photo.strip().lower() in ('true', '1', 'yes', 'on'):
            clear_photo_flag = True
        if clear_photo_flag:
            if driver.photo:
                driver.photo.delete(save=False)
            driver.photo = None

        upload = request.FILES.get('photo')
        if upload:
            driver.photo = upload

        driver.save()

        al = f'แก้ไขคนขับ «{user.username}»'
        log_staff_audit(
            request,
            StaffAuditLog.Action.DRIVER_UPDATE,
            target_type='driver',
            target_id=str(driver.id),
            summary=f'{al} (โปรไฟล์ #{driver.id})'[:500],
            detail={
                'driver_profile_id': driver.id,
                'user_id': user.id,
                'username': user.username,
                'password_changed': bool(password),
                'photo_updated': bool(upload) or clear_photo_flag,
                'action_label_th': al[:300],
            },
        )

        return Response({
            'message': 'แก้ไขข้อมูลคนขับสำเร็จ',
            'id': driver.id,
            'user_id': user.id,
            'username': user.username,
            'full_name': f"{user.first_name} {user.last_name}".strip() or user.username,
            'phone_number': driver.phone_number,
            'license_number': driver.license_number,
            'vehicle_type': driver.vehicle_type,
            'vehicle_number': driver.vehicle_number,
            'is_available': driver.is_available,
            'photo_url': driver_profile_photo_url(request, driver),
        }, status=status.HTTP_200_OK)

    @transaction.atomic
    def delete(self, request, driver_id, *args, **kwargs):
        if not is_admin_user(request.user):
            return Response({'error': 'ไม่มีสิทธิ์ลบคนขับ'}, status=status.HTTP_403_FORBIDDEN)

        driver = get_object_or_404(DriverProfile.objects.select_related('user'), id=driver_id)
        uname = driver.user.username
        did = driver.id
        uid = driver.user_id
        al = f'ลบคนขับ «{uname}»'
        log_staff_audit(
            request,
            StaffAuditLog.Action.DRIVER_DELETE,
            target_type='driver',
            target_id=str(did),
            summary=f'{al} (โปรไฟล์ #{did})'[:500],
            detail={
                'driver_profile_id': did,
                'user_id': uid,
                'username': uname,
                'action_label_th': al[:300],
            },
        )
        driver.user.delete()
        return Response({'message': 'ลบคนขับสำเร็จ'}, status=status.HTTP_200_OK)


class LineLoginView(generics.GenericAPIView):
    """เข้าสู่ระบบผ่าน LINE"""
    serializer_class = LineLoginSerializer
    
    def get(self, request, *args, **kwargs):
        """LINE Login Callback URL"""
        code = request.GET.get('code')
        state = request.GET.get('state')
        
        if not code:
            return Response({
                'error': 'ไม่พบ authorization code'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # TODO: ใช้ code เพื่อขอ access token จาก LINE
        # และดึงข้อมูล user profile
        
        return Response({
            'message': 'LINE Login Callback สำเร็จ',
            'code': code,
            'state': state,
        }, status=status.HTTP_200_OK)
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        line_user_id = serializer.validated_data['line_user_id']
        display_name = serializer.validated_data['display_name']
        picture_url = serializer.validated_data.get('picture_url')
        status_message = serializer.validated_data.get('status_message')
        
        # หาหรือสร้าง LineUser ก่อน
        try:
            line_user = LineUser.objects.get(line_user_id=line_user_id)
            user = line_user.user
            customer = Customer.objects.get(user=user)
        except LineUser.DoesNotExist:
            # สร้าง User ใหม่
            username = f"line_{line_user_id}"
            user = User.objects.create_user(
                username=username,
                email=f"{line_user_id}@line.local",
                first_name=display_name.split()[0] if display_name else '',
                last_name=' '.join(display_name.split()[1:]) if len(display_name.split()) > 1 else '',
            )
            
            # สร้าง Customer
            customer = Customer.objects.create(
                user=user,
                phone_number='',
                address='',
            )
            
            # สร้าง LineUser
            line_user = LineUser.objects.create(
                user=user,
                line_user_id=line_user_id,
                display_name=display_name,
                picture_url=picture_url,
                status_message=status_message,
            )
            
            # สร้าง UserRole
            UserRole.objects.create(user=user, role='customer')
        
        # อัปเดตข้อมูลถ้ามีการเปลี่ยนแปลง
        if line_user.display_name != display_name:
            line_user.display_name = display_name
        if line_user.picture_url != picture_url:
            line_user.picture_url = picture_url
        if line_user.status_message != status_message:
            line_user.status_message = status_message
        line_user.save()
        
        # สร้างหรือดึง token
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'message': 'เข้าสู่ระบบผ่าน LINE สำเร็จ',
            'token': token.key,
            'user_id': user.id,
            'customer_id': customer.id,
            'line_user_id': line_user_id,
            'display_name': display_name,
            'is_new_user': not line_user.user,
        }, status=status.HTTP_200_OK)


class CustomerRegistrationView(generics.CreateAPIView):
    """ลงทะเบียนลูกค้าใหม่"""
    serializer_class = CustomerCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        
        # สร้าง UserRole
        UserRole.objects.create(user=customer.user, role='customer')
        
        return Response({
            'message': 'ลงทะเบียนสำเร็จ',
            'customer_id': customer.id,
            'user_id': customer.user.id
        }, status=status.HTTP_201_CREATED)


class CustomerProfileView(generics.RetrieveUpdateDestroyAPIView):
    """จัดการโปรไฟล์ลูกค้า"""
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        # ดึง customer จาก session ถ้ามี
        if self.request.user.is_authenticated:
            try:
                return Customer.objects.get(user=self.request.user)
            except Customer.DoesNotExist:
                return None
            except:
                return None
        else:
            return None
    
    def update(self, request, *args, **kwargs):
        """อัพเดทข้อมูล Customer"""
        instance = self.get_object()
        if instance is None or not request.user.is_authenticated:
            return Response({
                'error': 'กรุณาเข้าสู่ระบบเพื่ออัพเดทข้อมูล',
                'is_authenticated': request.user.is_authenticated
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        user = request.user
        data = request.data

        if 'first_name' in data:
            user.first_name = str(data.get('first_name') or '').strip()[:150]
        if 'last_name' in data:
            user.last_name = str(data.get('last_name') or '').strip()[:150]
        if 'first_name' in data or 'last_name' in data:
            user.save(update_fields=['first_name', 'last_name'])

        if 'id_card_number' in data:
            nid = thai_citizen_id_digits(str(data.get('id_card_number') or ''))
            if len(nid) != 13:
                return Response(
                    {'error': 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not is_valid_thai_citizen_id(nid):
                return Response(
                    {'error': 'เลขบัตรประชาชนไม่ถูกต้อง'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            instance.id_card_number = nid

        if 'date_of_birth' in data:
            raw_dob = data.get('date_of_birth')
            parsed = None
            if hasattr(raw_dob, 'year'):
                parsed = raw_dob
            elif raw_dob not in (None, ''):
                try:
                    parsed = datetime.strptime(str(raw_dob).strip()[:10], '%Y-%m-%d').date()
                except ValueError:
                    parsed = None
            if parsed is None:
                return Response(
                    {'error': 'วันเกิดไม่ถูกต้อง (ใช้รูปแบบ ค.ศ. YYYY-MM-DD)'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not is_reasonable_customer_dob(parsed):
                return Response(
                    {'error': 'วันเกิดอยู่นอกช่วงที่ใช้ได้'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            instance.date_of_birth = parsed

        if 'address' in data:
            instance.address = str(data.get('address') or '').strip()

        if 'phone_number' in data:
            instance.phone_number = str(data.get('phone_number') or '').strip()[:15]

        if 'contact_email' in data or 'email' in data:
            raw = (
                request.data['contact_email']
                if 'contact_email' in request.data
                else request.data.get('email')
            )
            try:
                instance.contact_email = _normalize_contact_email(raw)
            except ValidationError as e:
                msg = (
                    e.messages[0]
                    if getattr(e, 'messages', None)
                    else 'รูปแบบอีเมลไม่ถูกต้อง'
                )
                return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        if 'latitude' in data and data['latitude']:
            instance.latitude = data['latitude']
        if 'longitude' in data and data['longitude']:
            instance.longitude = data['longitude']

        refresh_customer_profile_completed(instance)
        try:
            instance.save()
        except IntegrityError:
            return Response(
                {'error': 'เลขบัตรประชาชนซ้ำกับผู้ใช้อื่นในระบบ'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        serializer = self.get_serializer(instance)
        
        return Response({
            'message': 'อัพเดทข้อมูลสำเร็จ',
            'data': serializer.data
        }, status=status.HTTP_200_OK)
    
    def destroy(self, request, *args, **kwargs):
        """ลบข้อมูลส่วนบุคคล (Right to be Forgotten)"""
        customer = self.get_object()
        
        # ลบข้อมูล
        customer.user.delete()
        
        return Response({
            'message': 'ลบข้อมูลส่วนบุคคลสำเร็จ'
        }, status=status.HTTP_200_OK)


class CustomerAddressListCreateView(generics.ListCreateAPIView):
    """รายการที่อยู่จัดส่งของลูกค้า / เพิ่มที่อยู่ใหม่"""
    serializer_class = CustomerAddressSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        customer = get_object_or_404(Customer, user=self.request.user)
        return CustomerAddress.objects.filter(customer=customer).order_by('-is_default', '-updated_at')

    @transaction.atomic
    def perform_create(self, serializer):
        customer = get_object_or_404(Customer, user=self.request.user)
        is_default = serializer.validated_data.get('is_default', False)

        if is_default or not CustomerAddress.objects.filter(customer=customer).exists():
            CustomerAddress.objects.filter(customer=customer, is_default=True).update(is_default=False)
            serializer.save(customer=customer, is_default=True)
            return

        serializer.save(customer=customer)


class CustomerAddressDetailView(generics.RetrieveUpdateDestroyAPIView):
    """ดู/แก้ไข/ลบที่อยู่จัดส่ง"""
    serializer_class = CustomerAddressSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        customer = get_object_or_404(Customer, user=self.request.user)
        return CustomerAddress.objects.filter(customer=customer)

    @transaction.atomic
    def perform_update(self, serializer):
        customer = get_object_or_404(Customer, user=self.request.user)
        is_default = serializer.validated_data.get('is_default', None)
        if is_default is True:
            CustomerAddress.objects.filter(customer=customer, is_default=True).update(is_default=False)
            serializer.save(is_default=True)
            return
        serializer.save()

    @transaction.atomic
    def perform_destroy(self, instance):
        customer = instance.customer
        was_default = instance.is_default
        instance.delete()
        if was_default:
            next_address = CustomerAddress.objects.filter(customer=customer).order_by('-updated_at').first()
            if next_address:
                next_address.is_default = True
                next_address.save(update_fields=['is_default'])


class DataExportView(generics.RetrieveAPIView):
    """ส่งออกข้อมูลส่วนบุคคล"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        customer = get_object_or_404(Customer, user=request.user)
        
        # รวบรวมข้อมูลส่วนบุคคล
        data = {
            'personal_info': {
                'name': customer.user.get_full_name(),
                'email': customer.user.email,
                'phone': customer.phone_number,
                'address': customer.address,
                'id_card': customer.id_card_number,
                'date_of_birth': customer.date_of_birth,
            },
            'orders': list(customer.orders.values(
                'id', 'order_type', 'status', 'total_amount', 'created_at'
            )),
        }
        
        return Response(data, status=status.HTTP_200_OK)


def profile_view(request):
    """Profile view สำหรับ redirect หลัง LINE Login"""
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    if request.user.is_authenticated:
        # Redirect กลับไปที่ frontend พร้อม token
        try:
            token = Token.objects.get(user=request.user)
        except Token.DoesNotExist:
            token = Token.objects.create(user=request.user)
        role = getattr(getattr(request.user, 'user_role', None), 'role', None) or 'customer'
        auth_q = urlencode(
            {
                'token': token.key,
                'login': 'success',
                'username': request.user.username,
                'user_role': role,
            }
        )
        return HttpResponseRedirect(f"{frontend_url}?{auth_q}")
    else:
        # ถ้ายังไม่ได้ login ให้ redirect ไปหน้า login
        return HttpResponseRedirect(f"{frontend_url}/login")


def line_login_start(request):
    """Start LINE OAuth flow without allauth dependency."""
    state = secrets.token_urlsafe(24)
    request.session['line_oauth_state'] = state
    request.session['line_oauth_next'] = _sanitize_line_oauth_next(request.GET.get('next'))

    redirect_uri = _line_callback_url(request)
    logger.info(f"LINE OAuth start redirect_uri={redirect_uri}")

    params = {
        'response_type': 'code',
        'client_id': settings.LINE_LOGIN_CHANNEL_ID,
        'redirect_uri': redirect_uri,
        'state': state,
        # Keep scope minimal for stable LIFF login flow.
        'scope': 'profile',
    }
    auth_url = f"https://access.line.me/oauth2/v2.1/authorize?{urlencode(params)}"
    return HttpResponseRedirect(auth_url)


@csrf_exempt
def line_login_callback(request):
    """LINE Login Callback"""
    code = request.GET.get('code')
    state = request.GET.get('state')
    error = request.GET.get('error')
    
    logger.info(f"LINE Login Callback - code: {code}, state: {state}, error: {error}")
    
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    login_url = f"{frontend_url}/login"

    if error:
        # ถ้ามี error ให้ redirect กลับไปหน้า login
        return HttpResponseRedirect(f"{login_url}?error={error}")
    
    if not code:
        # ถ้าไม่มี code ให้ redirect กลับไปหน้า login
        return HttpResponseRedirect(f"{login_url}?error=no_code")

    expected_state = request.session.pop('line_oauth_state', None)
    if expected_state and state != expected_state:
        logger.error(f"LINE state mismatch. expected={expected_state}, got={state}")
        return HttpResponseRedirect(f"{login_url}?error=state_mismatch")
    
    try:
        # ขอ access token จาก LINE
        channel_id = settings.LINE_LOGIN_CHANNEL_ID
        channel_secret = settings.LINE_LOGIN_CHANNEL_SECRET
        redirect_uri = _line_callback_url(request)
        logger.info(f"LINE OAuth token exchange redirect_uri={redirect_uri}")
        
        token_url = "https://api.line.me/oauth2/v2.1/token"
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': redirect_uri,
            'client_id': channel_id,
            'client_secret': channel_secret
        }
        
        response = requests.post(token_url, data=token_data)
        
        if response.status_code != 200:
            logger.error(f"LINE Token Error: {response.status_code} - {response.text}")
            return HttpResponseRedirect(f"{login_url}?error=token_error&reason={quote_plus(str(response.status_code))}")
        
        token_response = response.json()
        access_token = token_response.get('access_token')
        
        # ดึงข้อมูล user profile จาก LINE
        profile_url = "https://api.line.me/v2/profile"
        headers = {'Authorization': f'Bearer {access_token}'}
        profile_response = requests.get(profile_url, headers=headers)
        
        if profile_response.status_code != 200:
            logger.error(f"LINE Profile Error: {profile_response.status_code} - {profile_response.text}")
            return HttpResponseRedirect(f"{login_url}?error=profile_error&reason={quote_plus(str(profile_response.status_code))}")
        
        profile_data = profile_response.json()
        line_user_id = profile_data.get('userId')
        if not line_user_id:
            logger.error(f"LINE profile missing userId: {profile_data}")
            return HttpResponseRedirect(f"{login_url}?error=profile_missing_user_id")
        # ป้องกันข้อมูลเกินความยาวคอลัมน์ (varchar) แล้วทำให้ OAuth callback ล้ม
        line_user_model = LineUser
        display_name_max = line_user_model._meta.get_field('display_name').max_length or 100
        picture_url_max = line_user_model._meta.get_field('picture_url').max_length or 500
        status_message_max = line_user_model._meta.get_field('status_message').max_length or 500
        display_name = str(profile_data.get('displayName', '') or '')[:display_name_max]
        picture_url = str(profile_data.get('pictureUrl', '') or '')[:picture_url_max]
        status_message = str(profile_data.get('statusMessage', '') or '')[:status_message_max]
        
        def _build_customer_id_card(seed_value):
            digits = ''.join(ch for ch in str(seed_value or '') if ch.isdigit())
            if not digits:
                digits = '0'
            id_card_candidate = (digits + ('0' * 13))[:13]
            suffix = 1
            while Customer.objects.filter(id_card_number=id_card_candidate).exists():
                suffix_str = str(suffix)
                id_card_candidate = id_card_candidate[:13 - len(suffix_str)] + suffix_str
                suffix += 1
            return id_card_candidate

        # หาหรือสร้าง LineUser
        try:
            line_user = LineUser.objects.get(line_user_id=line_user_id)
            user = line_user.user
            customer = Customer.objects.filter(user=user).first()
            if not customer:
                customer = Customer.objects.create(
                    user=user,
                    id_card_number=_build_customer_id_card(line_user_id or user.id),
                    date_of_birth='2000-01-01',
                    phone_number='',
                    address='',
                )
            UserRole.objects.get_or_create(user=user, defaults={'role': 'customer'})
        except LineUser.DoesNotExist:
            username_base = f"line_{line_user_id}"
            line_email = f"{line_user_id}@line.local"
            # พยายามผูกกลับ user เดิมก่อน เพื่อลดการสร้างบัญชีซ้ำ
            user = User.objects.filter(username=username_base).first() or User.objects.filter(email=line_email).first()
            if not user:
                # สร้าง User ใหม่เมื่อไม่พบของเดิมจริงๆ
                username = username_base
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{username_base[:140]}_{counter}"
                    counter += 1
                user = User.objects.create_user(
                    username=username,
                    email=line_email,
                    first_name=display_name.split()[0] if display_name else '',
                    last_name=' '.join(display_name.split()[1:]) if len(display_name.split()) > 1 else '',
                )

            # สร้าง Customer
            customer = Customer.objects.filter(user=user).first()
            if not customer:
                customer = Customer.objects.create(
                    user=user,
                    id_card_number=_build_customer_id_card(line_user_id or user.id),
                    date_of_birth='2000-01-01',
                    phone_number='',
                    address='',
                )
            
            # สร้าง LineUser
            line_user = LineUser.objects.create(
                user=user,
                line_user_id=line_user_id,
                display_name=display_name,
                picture_url=picture_url,
                status_message=status_message,
            )
            
            # สร้าง UserRole
            UserRole.objects.create(user=user, role='customer')
        
        # อัปเดตข้อมูลถ้ามีการเปลี่ยนแปลง
        if line_user.display_name != display_name:
            line_user.display_name = display_name
        if line_user.picture_url != picture_url:
            line_user.picture_url = picture_url
        if line_user.status_message != status_message:
            line_user.status_message = status_message
        line_user.save()
        
        # สร้างหรือดึง token
        token, created = Token.objects.get_or_create(user=user)
        
        # ทำ login เพื่อสร้าง session
        from django.contrib.auth import login
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        
        # Redirect กลับไปที่ frontend พร้อม token (เก็บ path จาก ?next= ตอนเริ่ม OAuth)
        logger.info(f"Redirecting to frontend with token for user: {user.username}")
        stored_next = request.session.pop('line_oauth_next', None)
        if not getattr(customer, 'profile_completed', False):
            next_path = '/customer/profile?section=personal&complete=required'
        else:
            next_path = _sanitize_line_oauth_next(stored_next)
        query_sep = '&' if '?' in next_path else '?'
        role = getattr(getattr(user, 'user_role', None), 'role', None) or 'customer'
        auth_q = urlencode(
            {
                'token': token.key,
                'login': 'success',
                'username': user.username,
                'user_role': role,
            }
        )
        return HttpResponseRedirect(f"{frontend_url.rstrip('/')}{next_path}{query_sep}{auth_q}")
        
    except Exception as e:
        logger.exception("LINE Login Error")
        return HttpResponseRedirect(f"{login_url}?error=line_login_failed&reason={quote_plus(e.__class__.__name__)}")


class AdminCustomerListView(generics.ListAPIView):
    """รายการลูกค้าสำหรับแอดมินร้าน"""

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardPagination
    serializer_class = AdminCustomerListSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = (
        'id',
        'last_order_at',
        'order_count',
        'total_spent_delivered',
        'phone_number',
        'date_of_birth',
        'user__username',
        'user__first_name',
        'user__last_name',
    )
    ordering = ['-order_count', '-last_order_at', '-id']

    def get_queryset(self):
        if not is_admin_user(self.request.user):
            return Customer.objects.none()
        qs = (
            Customer.objects.select_related('user')
            .annotate(
                order_count=Count('orders', distinct=True),
                total_spent_delivered=Coalesce(
                    Sum('orders__total_amount', filter=Q(orders__status='delivered')),
                    Value(0),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
                last_order_at=Max('orders__created_at'),
            )
        )
        q = (self.request.query_params.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(user__username__icontains=q)
                | Q(user__first_name__icontains=q)
                | Q(user__last_name__icontains=q)
                | Q(user__email__icontains=q)
                | Q(contact_email__icontains=q)
                | Q(phone_number__icontains=q)
            )
        return qs


class AdminCustomerDetailView(generics.RetrieveAPIView):
    """รายละเอียดลูกค้า + สรุปออเดอร์สำหรับแอดมิน"""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AdminCustomerDetailSerializer
    lookup_field = 'pk'
    lookup_url_kwarg = 'customer_id'

    def get_queryset(self):
        if not is_admin_user(self.request.user):
            return Customer.objects.none()
        return Customer.objects.select_related('user').prefetch_related(
            'addresses',
            'user__line_user',
        )