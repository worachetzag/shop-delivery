"""ฟังก์ชันช่วยสำหรับ orders views — แยกออกจาก views.py เฟส C"""
from decimal import Decimal, ROUND_HALF_UP

from django.core.cache import cache
from django.utils import timezone

from .models import DriverAssignment


def cart_cache_key(user_id):
    return f"cart_user_{user_id}"


def get_cart(request):
    if request.user.is_authenticated:
        return cache.get(cart_cache_key(request.user.id), {})
    return request.session.get('cart', {})


def save_cart(request, cart):
    if request.user.is_authenticated:
        cache.set(cart_cache_key(request.user.id), cart, timeout=60 * 60 * 24 * 7)
        return
    request.session['cart'] = cart
    request.session.modified = True


def crc16_ccitt(payload):
    crc = 0xFFFF
    for char in payload:
        crc ^= ord(char) << 8
        for _ in range(8):
            if crc & 0x8000:
                crc = (crc << 1) ^ 0x1021
            else:
                crc <<= 1
            crc &= 0xFFFF
    return f"{crc:04X}"


def format_tlv(tag, value):
    value_str = str(value)
    return f"{tag}{len(value_str):02d}{value_str}"


def sync_driver_availability(driver_user):
    """Sync DriverProfile availability from active assignments."""
    if not driver_user:
        return
    driver_profile = getattr(driver_user, 'driver_profile', None)
    if not driver_profile:
        return
    has_active_jobs = DriverAssignment.objects.filter(
        driver=driver_user,
        order__order_type='delivery',
    ).exclude(status__in=['delivered', 'cancelled']).exists()
    next_available = not has_active_jobs
    if driver_profile.is_available != next_available:
        driver_profile.is_available = next_available
        driver_profile.save(update_fields=['is_available'])


def driver_order_stock_audit_worthy(old_os: str, new_os: str, stock_meta: dict) -> bool:
    """บันทึก audit เฉพาะเมื่อสถานะออเดอร์เกี่ยวกับยกเลิก หรือมีการปรับ/ข้ามสต็อก"""
    if stock_meta.get('restocked') or stock_meta.get('rededucted'):
        return True
    if (
        stock_meta.get('restock_skipped_delivered')
        or stock_meta.get('restock_skipped_not_reserved')
        or stock_meta.get('restock_skipped_already_restocked')
    ):
        return True
    if old_os != new_os and (old_os == 'cancelled' or new_os == 'cancelled'):
        return True
    return False


def build_promptpay_payload(promptpay_number, amount):
    sanitized = ''.join(ch for ch in str(promptpay_number or '') if ch.isdigit())
    proxy_tag = None
    if sanitized.startswith('0') and len(sanitized) == 10:
        sanitized = f"0066{sanitized[1:]}"
        proxy_tag = '01'
    elif sanitized.startswith('66') and len(sanitized) == 11:
        sanitized = f"00{sanitized}"
        proxy_tag = '01'
    elif sanitized.startswith('0066') and len(sanitized) == 13:
        proxy_tag = '01'
    elif len(sanitized) == 13:
        proxy_tag = '02'

    if proxy_tag is None:
        raise ValueError('รูปแบบพร้อมเพย์ไม่ถูกต้อง (รองรับเบอร์มือถือไทย 10 หลัก หรือเลข 13 หลัก)')

    amount_decimal = Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    merchant_account_info = (
        format_tlv('00', 'A000000677010111')
        + format_tlv(proxy_tag, sanitized)
    )

    payload_without_crc = (
        format_tlv('00', '01')
        + format_tlv('01', '12')
        + format_tlv('29', merchant_account_info)
        + format_tlv('53', '764')
        + format_tlv('54', f"{amount_decimal:.2f}")
        + format_tlv('58', 'TH')
        + format_tlv('62', format_tlv('07', f"ORDER{timezone.now().strftime('%H%M%S')}"))
        + '6304'
    )
    return f"{payload_without_crc}{crc16_ccitt(payload_without_crc)}"
