"""สิทธิ์แอดมินร้าน — แยกไฟล์เพื่อใช้จาก views อื่นโดยไม่ circular import"""

from rest_framework.permissions import BasePermission


def is_admin_user(user):
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser or user.is_staff:
        return True
    role_obj = getattr(user, 'user_role', None)
    if not role_obj:
        return hasattr(user, 'admin_profile')
    return role_obj.role in ['store_admin', 'super_admin', 'admin']


def can_manage_staff_accounts(user):
    """เจ้าของร้าน / ผู้จัดการระดับบน — ดูประวัติพนักงาน, จัดการบัญชีพนักงาน"""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    role_obj = getattr(user, 'user_role', None)
    if not role_obj:
        return False
    return role_obj.role in ['super_admin', 'admin']


class IsStoreAdminOrSuperAdmin(BasePermission):
    """ร้านค้า / แอดมินระบบ — ใช้ร่วมกับ DRF (products, logistics, ฯลฯ)"""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        role_obj = getattr(request.user, 'user_role', None)
        if not role_obj:
            return hasattr(request.user, 'admin_profile')
        return role_obj.role in ['store_admin', 'super_admin', 'admin']
