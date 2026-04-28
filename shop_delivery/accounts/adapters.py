from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from django.conf import settings
from django.contrib.auth.models import User
from django.db import IntegrityError
from accounts.models import Customer, LineUser

class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Custom adapter for handling social account login
    Redirect to frontend after successful LINE login
    และสร้าง Customer และ LineUser เมื่อ LINE login
    """
    
    def get_login_redirect_url(self, request):
        """Redirect to frontend after social login — ถ้า FRONTEND_URL ยังเป็น localhost แต่รันบน server ให้กลับไปหน้า LIFF ใน Django"""
        from urllib.parse import urlparse

        raw = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').strip()
        host = urlparse(raw).hostname or ''
        if host in ('localhost', '127.0.0.1') and not getattr(settings, 'DEBUG', True):
            return '/liff/products/'
        base = raw.rstrip('/')
        return f'{base}/'
    
    def save_user(self, request, sociallogin, form=None):
        """
        Override save_user เพื่อสร้าง Customer และ LineUser เมื่อ LINE login
        """
        user = super().save_user(request, sociallogin, form)
        
        # ถ้าเป็น LINE login - สร้าง Customer อัตโนมัติ
        if sociallogin.account.provider == 'line':
            uid_seed = sociallogin.account.uid or ''
            digits = ''.join(ch for ch in uid_seed if ch.isdigit())
            if not digits:
                digits = str(user.id)

            # Customer.id_card_number is required+unique. Generate a stable placeholder for LINE users.
            base_id_card = (digits + ('0' * 13))[:13]
            id_card_candidate = base_id_card
            suffix = 1
            while Customer.objects.filter(id_card_number=id_card_candidate).exclude(user=user).exists():
                suffix_str = str(suffix)
                id_card_candidate = (base_id_card[:13 - len(suffix_str)] + suffix_str)
                suffix += 1

            # สร้าง/อัพเดท Customer
            try:
                customer, created = Customer.objects.get_or_create(
                    user=user,
                    defaults={
                        'id_card_number': id_card_candidate,
                        'date_of_birth': '2000-01-01',
                        'address': '',
                        'phone_number': f'LINE_{sociallogin.account.uid}'[:15],
                    }
                )
            except IntegrityError:
                # Retry with a random-like fallback when concurrent inserts collide.
                fallback_id = (str(user.id).zfill(13))[:13]
                customer, created = Customer.objects.get_or_create(
                    user=user,
                    defaults={
                        'id_card_number': fallback_id,
                        'date_of_birth': '2000-01-01',
                        'address': '',
                        'phone_number': f'LINE_{user.id}'[:15],
                    }
                )
            
            # สร้าง UserRole เป็น customer อัตโนมัติ
            from accounts.models import UserRole
            UserRole.objects.get_or_create(
                user=user,
                defaults={'role': 'customer'}
            )
            
            # ดึงข้อมูล LINE User จาก extra_data (LINE Login)
            social_account = sociallogin.account
            extra_data = social_account.extra_data
            
            # LINE Login ใช้ 'name' และ 'picture' แทน 'displayName' และ 'pictureUrl'
            line_user_id = extra_data.get('userId') or extra_data.get('sub') or social_account.uid
            display_name = extra_data.get('displayName') or extra_data.get('name', '')
            picture_url = extra_data.get('pictureUrl') or extra_data.get('picture', '')
            status_message = extra_data.get('statusMessage', '')
            
            # อัพเดท User's first_name และ last_name
            if display_name:
                user.first_name = display_name.split()[0]
                user.last_name = ' '.join(display_name.split()[1:]) if len(display_name.split()) > 1 else ''
                user.save()
            
            # สร้าง/อัพเดท LineUser และเชื่อมกับ User
            line_user, created = LineUser.objects.update_or_create(
                line_user_id=line_user_id,
                defaults={
                    'user': user,
                    'display_name': display_name,
                    'picture_url': picture_url if picture_url else None,
                    'status_message': status_message
                }
            )
            
            print(f"{'Created' if created else 'Updated'} LineUser: {line_user_id} - {display_name} for user: {user.username}")
        
        return user

