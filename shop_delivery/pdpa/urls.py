from django.urls import path
from . import views

app_name = 'pdpa'

urlpatterns = [
    path('privacy-policy/', views.PrivacyPolicyView.as_view(), name='privacy-policy'),
    path('consent/', views.ConsentRecordView.as_view(), name='consent-record'),
]



