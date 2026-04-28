from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import ServiceHours, DriverAssignment
from .serializers import DeliveryFeeCalculationSerializer, DriverAssignmentSerializer, DriverProfileSerializer
from accounts.models import DriverProfile
from orders.delivery_pricing import fee_for_distance_km


class DeliveryFeeCalculationView(APIView):
    """คำนวณค่าจัดส่งจากระยะทาง (กม.) — ตารางเดียวกับตอนสร้างออเดอร์"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = DeliveryFeeCalculationSerializer(data=request.data)
        if serializer.is_valid():
            distance = serializer.validated_data['distance']
            delivery_fee = fee_for_distance_km(distance)
            
            return Response({
                'distance': distance,
                'delivery_fee': delivery_fee
            }, status=200)
        
        return Response(serializer.errors, status=400)


class DriverAssignmentListView(generics.ListAPIView):
    """รายการงานจัดส่งของคนขับ"""
    serializer_class = DriverAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return DriverAssignment.objects.filter(driver=self.request.user).order_by('-assigned_at')


class DriverAssignmentUpdateView(generics.UpdateAPIView):
    """อัปเดตสถานะการจัดส่ง"""
    serializer_class = DriverAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return DriverAssignment.objects.filter(driver=self.request.user)
    
    def update(self, request, *args, **kwargs):
        assignment = self.get_object()
        new_status = request.data.get('status')
        
        if new_status not in ['accepted', 'picked_up', 'delivered', 'cancelled']:
            return Response({
                'error': 'สถานะไม่ถูกต้อง'
            }, status=400)
        
        assignment.status = new_status
        assignment.save()
        
        return Response({
            'message': 'อัปเดตสถานะสำเร็จ',
            'status': assignment.status,
            'status_display': assignment.get_status_display()
        }, status=200)


class DriverProfileListView(generics.ListCreateAPIView):
    """รายการคนขับและเพิ่มคนขับใหม่"""
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return DriverProfile.objects.all().order_by('-created_at')
    
    def perform_create(self, serializer):
        serializer.save()


class DriverProfileDetailView(generics.RetrieveUpdateDestroyAPIView):
    """ดู แก้ไข และลบข้อมูลคนขับ"""
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return DriverProfile.objects.all()


class DriverAvailabilityView(APIView):
    """อัปเดตสถานะการพร้อมใช้งานของคนขับ"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        driver_id = request.data.get('driver_id')
        is_available = request.data.get('is_available')
        
        try:
            driver = DriverProfile.objects.get(id=driver_id)
            driver.is_available = is_available
            driver.save()
            
            return Response({
                'message': 'อัปเดตสถานะสำเร็จ',
                'driver_id': driver.id,
                'is_available': driver.is_available
            }, status=status.HTTP_200_OK)
            
        except DriverProfile.DoesNotExist:
            return Response(
                {'error': 'ไม่พบข้อมูลคนขับ'}, 
                status=status.HTTP_404_NOT_FOUND
            )