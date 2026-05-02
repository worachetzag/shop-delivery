import logging
from django.conf import settings
from django.utils import timezone
from linebot import LineBotApi
from linebot.models import FlexSendMessage, TextSendMessage
from .models import LineBotUser, LineNotification

logger = logging.getLogger(__name__)


STATUS_NOTIFICATION_TYPE = {
    'pending': 'order_created',
    'confirmed': 'order_created',
    'preparing': 'order_preparing',
    'ready': 'order_ready',
    'delivering': 'order_delivering',
    'out_for_delivery': 'order_delivering',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancelled',
}

def _resolve_notification_type(order_status: str) -> str:
    return STATUS_NOTIFICATION_TYPE.get(order_status, 'order_created')


def _valid_line_token() -> str:
    token = (getattr(settings, 'LINE_CHANNEL_ACCESS_TOKEN', '') or '').strip()
    if not token:
        return ''
    if token in {'your-channel-access-token', 'your-channel-secret'}:
        return ''
    return token


def _display_name(user):
    if not user:
        return ''
    return (user.get_full_name() or user.username or '').strip()


def _order_detail_url(order_id: int) -> str:
    liff_id = (getattr(settings, 'LINE_LIFF_ID', '') or '').strip()
    if liff_id:
        # LIFF: ส่วนหลัง liffId ต่อท้าย Endpoint URL — ถ้า Endpoint เป็น .../customer/ ต้องใช้แค่ orders/<id>
        # ไม่ใช้ customer/orders/<id> เพราะจะได้ .../customer/customer/orders/<id>
        oid = int(order_id)
        prefix = (getattr(settings, 'LINE_LIFF_ORDER_URI_PREFIX', None) or 'orders').strip().strip('/')
        rel = f'{prefix}/{oid}' if prefix else f'orders/{oid}'
        return f'https://liff.line.me/{liff_id}/{rel}'

    frontend = (getattr(settings, 'FRONTEND_URL', '') or '').strip().rstrip('/')
    if not frontend:
        return f'/customer/orders/{order_id}'
    return f'{frontend}/customer/orders/{order_id}'


def send_order_status_notification(
    *,
    order,
    source: str,
    old_status: str,
    new_status: str,
    actor=None,
    driver_status: str = '',
    old_driver_status: str = '',
) -> bool:
    """
    ส่งข้อความแจ้งสถานะคำสั่งซื้อไปหา customer ทาง LINE chat.
    คืนค่า True เมื่อส่งสำเร็จ, False เมื่อข้าม/ส่งไม่สำเร็จ
    """
    customer_user = getattr(getattr(order, 'customer', None), 'user', None)
    if not customer_user:
        return False

    line_user = getattr(customer_user, 'line_user', None)
    line_user_id = getattr(line_user, 'line_user_id', '')
    if not line_user_id:
        return False

    token = _valid_line_token()
    if not token:
        logger.info('Skip LINE notification: LINE_CHANNEL_ACCESS_TOKEN is not configured.')
        return False

    order_no = order.order_number or f'#{order.id}'
    order_status_text = order.get_status_display()
    old_status_text = old_status
    if old_status:
        old_status_text = dict(order._meta.get_field('status').choices).get(old_status, old_status)
    changed_at = timezone.localtime(timezone.now()).strftime('%d/%m/%Y %H:%M')

    # กรณีคนขับอัปเดตสถานะ ให้โชว์สถานะงานคนขับเป็นหัวข้อหลัก
    headline_status = driver_status if source == 'driver' and driver_status else order_status_text
    lines = [
        f'อัปเดตคำสั่งซื้อ {order_no}',
        f'สถานะล่าสุด: {headline_status}',
    ]
    if source == 'driver':
        if old_driver_status and driver_status and old_driver_status != driver_status:
            lines.append(f'จาก: {old_driver_status}')
        elif old_status and old_status != new_status:
            # fallback เผื่อไม่ส่ง old_driver_status มา
            lines.append(f'จาก: {old_status_text}')
    elif old_status and old_status != new_status:
        lines.append(f'จาก: {old_status_text}')
    if source == 'driver' and driver_status:
        lines.append(f'สถานะออเดอร์: {order_status_text}')
        if old_status and old_status != new_status:
            lines.append(f'สถานะออเดอร์เดิม: {old_status_text}')
    lines.append(f'เวลา: {changed_at}')
    detail_url = _order_detail_url(order.id)
    lines.append(f'ตรวจสอบรายละเอียด: {detail_url}')
    message_text = '\n'.join(lines)

    try:
        line_bot_api = LineBotApi(token)
        flex_message = FlexSendMessage(
            alt_text=f'อัปเดตสถานะคำสั่งซื้อ {order_no}: {headline_status}',
            contents={
                "type": "bubble",
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "spacing": "sm",
                    "contents": [
                        {
                            "type": "text",
                            "text": f"อัปเดตคำสั่งซื้อ {order_no}",
                            "weight": "bold",
                            "size": "md",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": f"สถานะล่าสุด: {headline_status}",
                            "size": "sm",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": f"เวลา: {changed_at}",
                            "size": "xs",
                            "color": "#999999",
                            "wrap": True
                        },
                        {
                            "type": "text",
                            "text": "ตรวจสอบรายละเอียด",
                            "size": "sm",
                            "color": "#1E88E5",
                            "decoration": "underline",
                            "margin": "md",
                            "action": {
                                "type": "uri",
                                "label": "ตรวจสอบรายละเอียด",
                                "uri": detail_url
                            }
                        }
                    ]
                }
            }
        )
        # ส่งเฉพาะ Flex เพื่อให้มีบับเบิลเดียวตามที่ต้องการ
        line_bot_api.push_message(line_user_id, flex_message)

        bot_user, _ = LineBotUser.objects.get_or_create(
            line_user_id=line_user_id,
            defaults={
                'display_name': getattr(line_user, 'display_name', '') or _display_name(customer_user) or 'LINE User',
                'picture_url': getattr(line_user, 'picture_url', '') or '',
                'status_message': getattr(line_user, 'status_message', '') or '',
            },
        )
        LineNotification.objects.create(
            recipient=bot_user,
            notification_type=_resolve_notification_type(new_status),
            order=order,
            message=message_text,
            is_sent=True,
            sent_at=timezone.now(),
        )
        return True
    except Exception as exc:
        logger.warning('Failed to send LINE status notification for order %s: %s', order.id, exc)
        return False
