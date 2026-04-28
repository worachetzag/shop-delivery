from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
import json
import hashlib
import hmac
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, TextSendMessage, TemplateSendMessage, ButtonsTemplate

from .models import LineBotUser, LineMessage, LineNotification
from accounts.models import Customer
from orders.models import Order


# Initialize LINE Bot API
line_bot_api = LineBotApi(settings.LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(settings.LINE_CHANNEL_SECRET)


@method_decorator(csrf_exempt, name='dispatch')
class LineWebhookView(APIView):
    """รับ Webhook จาก LINE"""
    
    def post(self, request):
        # Get X-Line-Signature header value
        signature = request.META.get('HTTP_X_LINE_SIGNATURE')
        body = request.body.decode('utf-8')
        
        try:
            handler.handle(body, signature)
        except InvalidSignatureError:
            return HttpResponse(status=400)
        
        return HttpResponse(status=200)
    
    def get(self, request):
        """Webhook verification"""
        return HttpResponse("LINE Bot Webhook is working!")


@handler.add(MessageEvent, message=TextMessage)
def handle_text_message(event):
    """จัดการข้อความที่ส่งมา"""
    user_id = event.source.user_id
    message_text = event.message.text
    
    # Get or create LINE Bot User
    line_user, created = LineBotUser.objects.get_or_create(
        line_user_id=user_id,
        defaults={
            'display_name': 'Unknown User',
            'status_message': '',
        }
    )
    
    # Update display name if available
    try:
        profile = line_bot_api.get_profile(user_id)
        line_user.display_name = profile.display_name
        line_user.picture_url = profile.picture_url
        line_user.status_message = profile.status_message
        line_user.save()
    except:
        pass
    
    # Handle different message types
    if message_text.lower() in ['สวัสดี', 'hello', 'hi']:
        reply_text = f"สวัสดีครับ {line_user.display_name}! ยินดีต้อนรับสู่ Samsung Panich Delivery"
        reply_message = TextSendMessage(text=reply_text)
        line_bot_api.reply_message(event.reply_token, reply_message)
    
    elif message_text.lower() in ['สั่งซื้อ', 'order', 'สั่ง']:
        # Send order menu
        template_message = TemplateSendMessage(
            alt_text='เมนูสั่งซื้อ',
            template=ButtonsTemplate(
                text='เลือกเมนูสั่งซื้อ',
                actions=[
                    {
                        'type': 'uri',
                        'label': 'ดูสินค้า',
                        'uri': f'https://liff.line.me/{settings.LINE_LIFF_ID}?page=products'
                    },
                    {
                        'type': 'uri',
                        'label': 'ตะกร้าสินค้า',
                        'uri': f'https://liff.line.me/{settings.LINE_LIFF_ID}?page=cart'
                    },
                    {
                        'type': 'uri',
                        'label': 'คำสั่งซื้อของฉัน',
                        'uri': f'https://liff.line.me/{settings.LINE_LIFF_ID}?page=orders'
                    }
                ]
            )
        )
        line_bot_api.reply_message(event.reply_token, template_message)
    
    elif message_text.lower() in ['ติดตาม', 'track', 'status']:
        # Send tracking menu
        template_message = TemplateSendMessage(
            alt_text='ติดตามคำสั่งซื้อ',
            template=ButtonsTemplate(
                text='ติดตามคำสั่งซื้อ',
                actions=[
                    {
                        'type': 'uri',
                        'label': 'ติดตามคำสั่งซื้อ',
                        'uri': f'https://liff.line.me/{settings.LINE_LIFF_ID}?page=tracking'
                    },
                    {
                        'type': 'uri',
                        'label': 'ติดต่อเรา',
                        'uri': f'https://liff.line.me/{settings.LINE_LIFF_ID}?page=contact'
                    }
                ]
            )
        )
        line_bot_api.reply_message(event.reply_token, template_message)
    
    else:
        # Default response
        reply_text = "ขอบคุณสำหรับข้อความครับ! หากต้องการสั่งซื้อ กรุณาพิมพ์ 'สั่งซื้อ' หรือ 'ติดตาม' เพื่อติดตามคำสั่งซื้อ"
        reply_message = TextSendMessage(text=reply_text)
        line_bot_api.reply_message(event.reply_token, reply_message)


class SendNotificationView(APIView):
    """ส่งการแจ้งเตือนผ่าน LINE Bot"""
    
    def post(self, request):
        data = request.data
        user_id = data.get('user_id')
        notification_type = data.get('notification_type')
        message = data.get('message')
        order_id = data.get('order_id')
        
        try:
            # Get LINE Bot User
            line_user = LineBotUser.objects.get(line_user_id=user_id)
            
            # Create notification record
            notification = LineNotification.objects.create(
                recipient=line_user,
                notification_type=notification_type,
                order_id=order_id,
                message=message
            )
            
            # Send message via LINE Bot
            reply_message = TextSendMessage(text=message)
            line_bot_api.push_message(user_id, reply_message)
            
            # Update notification status
            notification.is_sent = True
            notification.save()
            
            return Response({
                'message': 'ส่งการแจ้งเตือนสำเร็จ',
                'notification_id': notification.id
            }, status=status.HTTP_200_OK)
            
        except LineBotUser.DoesNotExist:
            return Response({
                'error': 'ไม่พบผู้ใช้งาน LINE Bot'
            }, status=status.HTTP_404_NOT_FOUND)
        
        except Exception as e:
            return Response({
                'error': f'เกิดข้อผิดพลาด: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LineUserListView(APIView):
    """รายการผู้ใช้งาน LINE Bot"""
    
    def get(self, request):
        users = LineBotUser.objects.filter(is_active=True)
        data = []
        
        for user in users:
            data.append({
                'line_user_id': user.line_user_id,
                'display_name': user.display_name,
                'picture_url': user.picture_url,
                'status_message': user.status_message,
                'created_at': user.created_at
            })
        
        return Response(data, status=status.HTTP_200_OK)