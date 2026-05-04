from django.urls import path
from . import views

app_name = 'orders'

urlpatterns = [
    path('store-location/', views.StoreLocationPublicView.as_view(), name='store-location'),
    path('admin/store-settings/', views.AdminStoreSettingsView.as_view(), name='admin-store-settings'),
    path('', views.OrderCreateView.as_view(), name='order-create'),
    path('list/', views.OrderListView.as_view(), name='order-list'),
    path('customer/attention-summary/', views.CustomerOrderAttentionSummaryView.as_view(), name='customer-order-attention-summary'),
    path('<int:order_id>/assign-driver/', views.AdminAssignDriverView.as_view(), name='admin-assign-driver'),
    path('driver/assignments/', views.DriverAssignmentListView.as_view(), name='driver-assignment-list'),
    path('driver/assignments/<int:assignment_id>/', views.DriverAssignmentDetailView.as_view(), name='driver-assignment-detail'),
    path('driver/assignments/<int:assignment_id>/status/', views.DriverAssignmentStatusUpdateView.as_view(), name='driver-assignment-status'),
    path('<int:order_id>/driver-tracking/', views.OrderDriverTrackingView.as_view(), name='order-driver-tracking'),
    path('<int:order_id>/', views.OrderDetailView.as_view(), name='order-detail'),
    path('<int:order_id>/promptpay-qr/', views.PromptPayQRCodeView.as_view(), name='promptpay-qr'),
    path('<int:order_id>/payment-slip/', views.PaymentSlipUploadView.as_view(), name='payment-slip-upload'),
    path('<int:order_id>/payment-slip/review/', views.AdminPaymentSlipReviewView.as_view(), name='payment-slip-review'),
    path(
        '<int:order_id>/cancel-awaiting-payment-proof/',
        views.OrderCancelAwaitingPaymentProofView.as_view(),
        name='order-cancel-awaiting-payment-proof',
    ),
    path('admin/stats/', views.AdminOrderStatsView.as_view(), name='admin-order-stats'),
    path('cart/add/', views.CartView.as_view(), name='cart-add'),
    path('cart/', views.CartListView.as_view(), name='cart-list'),
    path('cart/update/', views.CartUpdateView.as_view(), name='cart-update'),
    path('cart/<int:product_id>/', views.CartDeleteView.as_view(), name='cart-delete'),
    path('<int:order_id>/tracking/', views.OrderTrackingView.as_view(), name='order-tracking'),
    path('<int:order_id>/status/', views.OrderStatusUpdateView.as_view(), name='order-status-update'),
]
