from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter

# API Router
router = DefaultRouter()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    
    # Include app URLs
    path('api/accounts/', include('accounts.urls')),  # API endpoints สำหรับ accounts
    path('accounts/', include('accounts.urls')),  # WEB endpoints (custom LINE login/callback first)
    path('accounts/', include('allauth.urls')),  # keep allauth endpoints as fallback
    path('api/products/', include('products.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/pdpa/', include('pdpa.urls')),
    path('api/logistics/', include('logistics.urls')),
    path('api/line/', include('line_bot.urls')),
    path('liff/', include('liff.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)