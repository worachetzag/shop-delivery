from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from django.views.static import serve
from rest_framework.routers import DefaultRouter


def healthz(request):
    """สำหรับ health check (Render / load balancer)."""
    return HttpResponse('ok', content_type='text/plain')


# API Router
router = DefaultRouter()

# health + media/static อยู่บนสุด — ให้ชัดว่า /media/ ไม่ถูกแทรกโดย include อื่น
urlpatterns = [
    path('healthz', healthz),
    path('healthz/', healthz),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        re_path(
            r'^media/(?P<path>.*)$',
            serve,
            {'document_root': settings.MEDIA_ROOT},
        ),
    ]

urlpatterns += [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/accounts/', include('accounts.urls')),
    path('accounts/', include('accounts.urls')),
    path('accounts/', include('allauth.urls')),
    path('api/products/', include('products.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/pdpa/', include('pdpa.urls')),
    path('api/logistics/', include('logistics.urls')),
    path('api/line/', include('line_bot.urls')),
    path('liff/', include('liff.urls')),
]
