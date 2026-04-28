"""บันทึกประวัติการกระทำของแอดมิน/พนักงาน"""

from __future__ import annotations

from typing import Any, Dict, Optional

from django.contrib.auth.models import User


def get_client_ip(request) -> Optional[str]:
    if not request:
        return None
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def log_staff_audit(
    request,
    action: str,
    *,
    target_type: str = '',
    target_id: str = '',
    summary: str = '',
    detail: Optional[Dict[str, Any]] = None,
    actor: Optional[User] = None,
) -> None:
    """
    บันทึกเมื่อผู้ใช้ที่ล็อกอินเป็นฝั่งแอดมินแล้วทำรายการสำคัญ
    actor: ใช้ตอน logout หลังจะ clear session
    """
    from .models import StaffAuditLog

    user = actor
    if user is None and request is not None:
        user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return

    StaffAuditLog.objects.create(
        actor=user,
        action=action,
        target_type=target_type or '',
        target_id=(str(target_id) if target_id is not None else '')[:64],
        summary=(summary or '')[:500],
        detail=detail if isinstance(detail, dict) else {},
        ip_address=get_client_ip(request),
    )
