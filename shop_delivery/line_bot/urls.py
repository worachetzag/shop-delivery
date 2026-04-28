from django.urls import path
from . import views

app_name = 'line_bot'

urlpatterns = [
    path('webhook/', views.LineWebhookView.as_view(), name='webhook'),
    path('send-notification/', views.SendNotificationView.as_view(), name='send-notification'),
    path('users/', views.LineUserListView.as_view(), name='users'),
]



