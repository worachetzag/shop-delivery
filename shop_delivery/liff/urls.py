from django.urls import path
from . import views

app_name = 'liff'

urlpatterns = [
    path('', views.LiffView.as_view(), name='index'),
    path('products/', views.LiffProductsView.as_view(), name='products'),
    path('cart/', views.LiffCartView.as_view(), name='cart'),
    path('orders/', views.LiffOrdersView.as_view(), name='orders'),
    path('tracking/', views.LiffTrackingView.as_view(), name='tracking'),
    path('driver/', views.LiffDriverView.as_view(), name='driver'),
    path('api/', views.LiffApiView.as_view(), name='api'),
]



