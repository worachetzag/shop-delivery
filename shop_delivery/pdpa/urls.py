from django.urls import path
from . import views

app_name = 'pdpa'

urlpatterns = [
    path('privacy-policy/', views.PrivacyPolicyView.as_view(), name='privacy-policy'),
    path('admin/privacy-policy/', views.AdminPrivacyPolicyView.as_view(), name='admin-privacy-policy'),
    path('consent/status/', views.PdpaConsentStatusView.as_view(), name='pdpa-consent-status'),
    path('consent/summary/', views.PdpaCustomerConsentSummaryView.as_view(), name='pdpa-consent-summary'),
    path('consent/withdraw-privacy/', views.PdpaWithdrawPrivacyConsentView.as_view(), name='pdpa-withdraw-privacy'),
    path('consent/withdraw-marketing/', views.PdpaWithdrawMarketingConsentView.as_view(), name='pdpa-withdraw-marketing'),
    path('consent/', views.ConsentRecordView.as_view(), name='consent-record'),
]



