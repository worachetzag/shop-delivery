from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    path('line/login/', views.line_login_start, name='line-login-start'),
    path('line/login/callback/', views.line_login_callback, name='line-login-callback'),
    path('register/', views.CustomerRegistrationView.as_view(), name='customer-register'),
    path('login/', views.CustomerLoginView.as_view(), name='customer-login'),
    path('driver/login/', views.DriverLoginView.as_view(), name='driver-login'),
    path('admin/login/', views.AdminLoginView.as_view(), name='admin-login'),  # Admin login
    path('logout/', views.AdminLogoutView.as_view(), name='admin-logout'),
    path('admin/audit-log/', views.StaffAuditLogListView.as_view(), name='admin-audit-log'),
    path('profile/', views.profile_view, name='profile-redirect'),  # สำหรับ allauth redirect
    path('api-profile/', views.CustomerProfileView.as_view(), name='customer-profile'),  # สำหรับ API
    path('addresses/', views.CustomerAddressListCreateView.as_view(), name='customer-addresses'),
    path('addresses/<int:pk>/', views.CustomerAddressDetailView.as_view(), name='customer-address-detail'),
    path('data-export/', views.DataExportView.as_view(), name='data-export'),
    path('admin/staff/', views.AdminStaffListCreateView.as_view(), name='admin-staff-list-create'),
    path('admin/staff/<int:user_id>/', views.AdminStaffDetailView.as_view(), name='admin-staff-detail'),
    path('admin/drivers/', views.AdminDriverListCreateView.as_view(), name='admin-driver-list-create'),
    path('admin/drivers/<int:driver_id>/', views.AdminDriverDetailView.as_view(), name='admin-driver-detail'),
]
