from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    path('promptpay/', views.PromptPayQRView.as_view(), name='promptpay-qr'),
    path('truemoney/', views.TrueMoneyQRView.as_view(), name='truemoney-qr'),
    path('rabbit/', views.RabbitPayQRView.as_view(), name='rabbit-qr'),
    path('scb-easy/', views.SCBEasyQRView.as_view(), name='scb-easy-qr'),
    path('status/<str:transaction_id>/', views.PaymentStatusCheckView.as_view(), name='payment-status'),
    path('webhook/', views.PaymentWebhookView.as_view(), name='payment-webhook'),
]
