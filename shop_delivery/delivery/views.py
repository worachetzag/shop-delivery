from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
import qrcode
import io
import base64
from PIL import Image

from .models import (
    Customer, Category, Product, Order, OrderItem, Delivery, ServiceHours,
    LineUser, UserRole, DriverProfile, AdminProfile, DriverAssignment,
    ConsentRecord, DataProcessingActivity, PrivacyPolicy, AuditLog
)
from .serializers import (
    CustomerSerializer, CustomerCreateSerializer, CategorySerializer, ProductSerializer,
    OrderSerializer, OrderCreateSerializer, OrderItemSerializer, DeliverySerializer,
    ServiceHoursSerializer, LineUserSerializer, LineUserCreateSerializer,
    UserRoleSerializer, DriverProfileSerializer, AdminProfileSerializer,
    DriverAssignmentSerializer, ConsentRecordSerializer, DataProcessingActivitySerializer,
    PrivacyPolicySerializer, AuditLogSerializer, CartItemSerializer, CartSerializer,
    LinePaySerializer, PromptPaySerializer, TrueMoneySerializer, RabbitPaySerializer,
    SCBEasySerializer, PaymentSerializer, DeliveryFeeCalculationSerializer,
    DeliveryTrackingSerializer
)


class CustomerRegistrationView(generics.CreateAPIView):
    """ลงทะเบียนลูกค้าใหม่"""
    serializer_class = CustomerCreateSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = serializer.save()
        
        # สร้าง UserRole
        UserRole.objects.create(user=customer.user, role='customer')
        
        return Response({
            'message': 'ลงทะเบียนสำเร็จ',
            'customer_id': customer.id,
            'user_id': customer.user.id
        }, status=status.HTTP_201_CREATED)


class CustomerProfileView(generics.RetrieveUpdateDestroyAPIView):
    """จัดการโปรไฟล์ลูกค้า"""
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return get_object_or_404(Customer, user=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        """ลบข้อมูลส่วนบุคคล (Right to be Forgotten)"""
        customer = self.get_object()
        
        # บันทึก audit log
        AuditLog.objects.create(
            user=request.user,
            action='delete',
            model_name='Customer',
            object_id=str(customer.id),
            description=f'ลบข้อมูลส่วนบุคคลของลูกค้า {customer.user.get_full_name()}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        # ลบข้อมูล
        customer.user.delete()
        
        return Response({
            'message': 'ลบข้อมูลส่วนบุคคลสำเร็จ'
        }, status=status.HTTP_200_OK)


class ProductListView(generics.ListAPIView):
    """รายการสินค้าทั้งหมด"""
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        queryset = Product.objects.filter(is_available=True)
        
        # Filter by category
        category_id = self.request.query_params.get('category_id')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        # Filter special offers
        special_offer = self.request.query_params.get('special_offer')
        if special_offer == 'true':
            queryset = queryset.filter(is_special_offer=True)
        
        return queryset


class CategoryListView(generics.ListAPIView):
    """รายการหมวดหมู่สินค้า"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class CartView(APIView):
    """จัดการตะกร้าสินค้า"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        """เพิ่มสินค้าในตะกร้า"""
        serializer = CartItemSerializer(data=request.data)
        if serializer.is_valid():
            product_id = serializer.validated_data['product_id']
            quantity = serializer.validated_data['quantity']
            
            product = get_object_or_404(Product, id=product_id, is_available=True)
            
            if product.stock_quantity < quantity:
                return Response({
                    'error': 'สินค้าไม่เพียงพอ'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # ในระบบจริงจะเก็บตะกร้าใน session หรือ database
            # ที่นี่เราจะ return ข้อมูลสินค้า
            return Response({
                'product_id': product.id,
                'product_name': product.name,
                'quantity': quantity,
                'price': product.price,
                'total_price': product.price * quantity
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class OrderCreateView(generics.CreateAPIView):
    """สร้างคำสั่งซื้อใหม่"""
    serializer_class = OrderCreateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # ตั้งค่า customer
        customer = get_object_or_404(Customer, user=request.user)
        serializer.validated_data['customer'] = customer
        
        order = serializer.save()
        
        # บันทึก audit log
        AuditLog.objects.create(
            user=request.user,
            action='create',
            model_name='Order',
            object_id=str(order.id),
            description=f'สร้างคำสั่งซื้อ #{order.id}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({
            'message': 'สร้างคำสั่งซื้อสำเร็จ',
            'order_id': order.id,
            'total_amount': order.total_amount
        }, status=status.HTTP_201_CREATED)


class OrderListView(generics.ListAPIView):
    """รายการคำสั่งซื้อของลูกค้า"""
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        customer = get_object_or_404(Customer, user=self.request.user)
        return Order.objects.filter(customer=customer).order_by('-created_at')


class DeliveryFeeCalculationView(APIView):
    """คำนวณค่าจัดส่ง"""
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = DeliveryFeeCalculationSerializer(data=request.data)
        if serializer.is_valid():
            distance = serializer.validated_data['distance']
            
            # คำนวณค่าจัดส่งตามระยะทาง
            if distance <= 3:
                delivery_fee = Decimal('0')
            elif distance <= 5:
                delivery_fee = Decimal('20')
            elif distance <= 10:
                delivery_fee = Decimal('35')
            else:
                delivery_fee = Decimal('50')
            
            return Response({
                'distance': distance,
                'delivery_fee': delivery_fee
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PromptPayQRView(APIView):
    """สร้าง QR Code สำหรับ PromptPay"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PromptPaySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            # สร้าง QR Code สำหรับ PromptPay
            # ในระบบจริงจะใช้ PromptPay API
            qr_data = f"00020101021229370016A000000677010111011300669999999999995204000053030025404{amount:.2f}5802TH6304"
            
            # สร้าง QR Code image
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TrueMoneyQRView(APIView):
    """สร้าง QR Code สำหรับ TrueMoney"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = TrueMoneySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            # สร้าง QR Code สำหรับ TrueMoney
            # ในระบบจริงจะใช้ TrueMoney API
            qr_data = f"truemoney://pay?amount={amount}&order_id={order_id}"
            
            # สร้าง QR Code image
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RabbitPayQRView(APIView):
    """สร้าง QR Code สำหรับ Rabbit LINE Pay"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = RabbitPaySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            # สร้าง QR Code สำหรับ Rabbit LINE Pay
            # ในระบบจริงจะใช้ Rabbit LINE Pay API
            qr_data = f"rabbit://pay?amount={amount}&order_id={order_id}"
            
            # สร้าง QR Code image
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SCBEasyQRView(APIView):
    """สร้าง QR Code สำหรับ SCB Easy"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = SCBEasySerializer(data=request.data)
        if serializer.is_valid():
            order_id = serializer.validated_data['order_id']
            amount = serializer.validated_data['amount']
            
            # สร้าง QR Code สำหรับ SCB Easy
            # ในระบบจริงจะใช้ SCB Easy API
            qr_data = f"scb://pay?amount={amount}&order_id={order_id}"
            
            # สร้าง QR Code image
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return Response({
                'order_id': order_id,
                'amount': amount,
                'qr_code': qr_data,
                'qr_image': f"data:image/png;base64,{img_str}"
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
            }, status=status.HTTP_400_BAD_REQUEST)
        
        assignment.status = new_status
        assignment.save()
        
        # บันทึก audit log
        AuditLog.objects.create(
            user=request.user,
            action='update',
            model_name='DriverAssignment',
            object_id=str(assignment.id),
            description=f'อัปเดตสถานะการจัดส่งเป็น {assignment.get_status_display()}',
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )
        
        return Response({
            'message': 'อัปเดตสถานะสำเร็จ',
            'status': assignment.status,
            'status_display': assignment.get_status_display()
        }, status=status.HTTP_200_OK)


class PrivacyPolicyView(generics.ListAPIView):
    """นโยบายความเป็นส่วนตัว"""
    serializer_class = PrivacyPolicySerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        return PrivacyPolicy.objects.filter(is_active=True).order_by('-effective_date')


class ConsentRecordView(generics.ListCreateAPIView):
    """จัดการความยินยอม PDPA"""
    serializer_class = ConsentRecordSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        customer = get_object_or_404(Customer, user=self.request.user)
        return ConsentRecord.objects.filter(customer=customer).order_by('-given_at')
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # ตั้งค่า customer และ IP
        customer = get_object_or_404(Customer, user=request.user)
        serializer.validated_data['customer'] = customer
        serializer.validated_data['ip_address'] = request.META.get('REMOTE_ADDR')
        serializer.validated_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
        
        consent = serializer.save()
        
        return Response({
            'message': 'บันทึกความยินยอมสำเร็จ',
            'consent_id': consent.id
        }, status=status.HTTP_201_CREATED)


class DataExportView(APIView):
    """ส่งออกข้อมูลส่วนบุคคล"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        customer = get_object_or_404(Customer, user=request.user)
        
        # รวบรวมข้อมูลส่วนบุคคล
        data = {
            'personal_info': {
                'name': customer.user.get_full_name(),
                'email': customer.user.email,
                'phone': customer.phone_number,
                'address': customer.address,
                'id_card': customer.id_card_number,
                'date_of_birth': customer.date_of_birth,
            },
            'orders': list(Order.objects.filter(customer=customer).values(
                'id', 'order_type', 'status', 'total_amount', 'created_at'
            )),
            'consents': list(ConsentRecord.objects.filter(customer=customer).values(
                'consent_type', 'is_given', 'given_at', 'withdrawn_at'
            ))
        }
        
        return Response(data, status=status.HTTP_200_OK)