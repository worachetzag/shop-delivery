from urllib.parse import urlparse

from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.views import View
import json
from django.conf import settings


def _external_frontend_base():
    """
    Redirect ไป SPA เฉพาะเมื่อตั้ง FRONTEND_URL เป็น URL จริง (https และไม่ใช่ localhost)
    ถ้ายังไม่มีหน้าบ้าน / ยังเป็น localhost → คืน None ให้แสดงหน้า Django แทน
    """
    raw = (getattr(settings, 'FRONTEND_URL', '') or '').strip()
    if not raw.startswith('https://'):
        return None
    host = urlparse(raw).hostname or ''
    if host in ('localhost', '127.0.0.1'):
        return None
    return raw.rstrip('/')


class LiffView(View):
    """หน้าแรก /liff/ — มี SPA แล้ว redirect ไปที่นั้น ไม่มีแสดงข้อความบน Django"""

    def get(self, request):
        target = _external_frontend_base()
        if target:
            return HttpResponseRedirect(f'{target}/')
        base = request.build_absolute_uri('/').rstrip('/')
        return render(
            request,
            'liff/no_frontend.html',
            {
                'liff_id': settings.LINE_LIFF_ID,
                'api_base': base,
                'healthz': f'{base}/healthz/',
                'admin_url': f'{base}/admin/',
                'liff_products': f'{base}/liff/products/',
            },
        )


class LiffProductsView(View):
    """LIFF Products Page"""
    
    def get(self, request):
        context = {
            'liff_id': settings.LINE_LIFF_ID,
            'page': 'products'
        }
        return render(request, 'liff/products.html', context)


class LiffCartView(View):
    """LIFF Cart Page"""
    
    def get(self, request):
        context = {
            'liff_id': settings.LINE_LIFF_ID,
            'page': 'cart'
        }
        return render(request, 'liff/cart.html', context)


class LiffOrdersView(View):
    """LIFF Orders Page"""
    
    def get(self, request):
        context = {
            'liff_id': settings.LINE_LIFF_ID,
            'page': 'orders'
        }
        return render(request, 'liff/orders.html', context)


class LiffTrackingView(View):
    """LIFF Tracking Page"""
    
    def get(self, request):
        context = {
            'liff_id': settings.LINE_LIFF_ID,
            'page': 'tracking'
        }
        return render(request, 'liff/tracking.html', context)


class LiffDriverView(View):
    """LIFF Driver Page"""
    
    def get(self, request):
        context = {
            'liff_id': settings.LINE_LIFF_ID,
            'page': 'driver'
        }
        return render(request, 'liff/driver.html', context)


@method_decorator(csrf_exempt, name='dispatch')
class LiffApiView(View):
    """LIFF API Endpoint"""
    
    def post(self, request):
        try:
            data = json.loads(request.body)
            action = data.get('action')
            
            if action == 'get_user_profile':
                # Get user profile from LIFF
                return JsonResponse({
                    'success': True,
                    'data': {
                        'userId': data.get('userId'),
                        'displayName': data.get('displayName'),
                        'pictureUrl': data.get('pictureUrl')
                    }
                })
            
            elif action == 'get_products':
                # Get products list
                return JsonResponse({
                    'success': True,
                    'data': {
                        'products': [
                            {
                                'id': 1,
                                'name': 'สินค้าตัวอย่าง',
                                'price': 100,
                                'image': '/static/images/product1.jpg'
                            }
                        ]
                    }
                })
            
            elif action == 'add_to_cart':
                # Add product to cart
                return JsonResponse({
                    'success': True,
                    'message': 'เพิ่มสินค้าในตะกร้าสำเร็จ'
                })
            
            elif action == 'create_order':
                # Create new order
                return JsonResponse({
                    'success': True,
                    'data': {
                        'orderId': 12345,
                        'totalAmount': 500
                    }
                })
            
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Action not found'
                })
                
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': str(e)
            })
