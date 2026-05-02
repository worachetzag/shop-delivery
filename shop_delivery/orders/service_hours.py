"""เวลาทำการร้าน (logistics.ServiceHours) — สำหรับ API สาธารณะและบล็อกสร้างออเดอร์"""
from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

from django.utils import timezone


def serialize_public_service_hours() -> Dict[str, Any]:
    from logistics.models import ServiceHours

    data: Dict[str, Any] = {}
    for row in ServiceHours.objects.filter(service_type__in=['pickup', 'delivery']).order_by('id'):
        data[row.service_type] = {
            'start_time': row.start_time.strftime('%H:%M:%S'),
            'end_time': row.end_time.strftime('%H:%M:%S'),
            'is_active': bool(row.is_active),
        }
    return data


def _time_in_open_window(now_t, start, end) -> bool:
    """รองรับกรณีข้ามเที่ยงคืน: start > end หมายถึงช่วงเย็น → เช้า"""
    if start == end:
        return True
    if start < end:
        return start <= now_t <= end
    return now_t >= start or now_t <= end


def is_order_type_allowed_now(order_type: str) -> Tuple[bool, Optional[str]]:
    """
    คืน (True, None) ถ้าเปิดรับตอนนี้
    ถ้าไม่มีแถว ServiceHours สำหรับประเภทนั้น — ถือว่ายังไม่บังคับช่วงเวลา (เปิดตลอด)
    """
    if order_type not in ('pickup', 'delivery'):
        return True, None

    from logistics.models import ServiceHours

    row = ServiceHours.objects.filter(service_type=order_type).order_by('id').first()
    if row is None:
        return True, None

    if not row.is_active:
        label = 'รับที่ร้าน' if order_type == 'pickup' else 'จัดส่งถึงบ้าน'
        return False, f'ขณะนี้ร้านปิดรับคำสั่งแบบ{label} ชั่วคราว'

    now_t = timezone.localtime().time()
    if _time_in_open_window(now_t, row.start_time, row.end_time):
        return True, None

    label = 'รับที่ร้าน' if order_type == 'pickup' else 'จัดส่งถึงบ้าน'
    st = row.start_time.strftime('%H:%M')
    et = row.end_time.strftime('%H:%M')
    return False, (
        f'ยังไม่อยู่ในช่วงเวลาเปิดรับคำสั่งแบบ{label} '
        f'(เปิดรับ {st}–{et} น. ตามเวลาประเทศไทย)'
    )
