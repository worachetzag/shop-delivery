from django.urls import path
from . import views

app_name = 'logistics'

urlpatterns = [
    path('calculate-fee/', views.DeliveryFeeCalculationView.as_view(), name='delivery-fee'),
    path('driver/assignments/', views.DriverAssignmentListView.as_view(), name='driver-assignments'),
    path('driver/assignments/<int:pk>/update/', views.DriverAssignmentUpdateView.as_view(), name='driver-assignment-update'),
    path('drivers/', views.DriverProfileListView.as_view(), name='driver-list'),
    path('drivers/<int:pk>/', views.DriverProfileDetailView.as_view(), name='driver-detail'),
    path('drivers/availability/', views.DriverAvailabilityView.as_view(), name='driver-availability'),
]
