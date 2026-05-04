"""ตะกร้าสินค้า — แยกจาก views.py เฟส C"""
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from products.models import Product
from .serializers import CartItemSerializer, CartSerializer, CartUpdateSerializer
from . import view_helpers as vh


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

            cart = vh.get_cart(request)
            current_quantity = int(cart.get(str(product_id), 0))
            new_quantity = current_quantity + quantity

            available_qty = max(0, int(product.stock_quantity or 0) - int(product.reserved_quantity or 0))
            if available_qty < new_quantity:
                return Response({
                    'error': 'สินค้าไม่เพียงพอ'
                }, status=400)

            cart[str(product_id)] = new_quantity
            vh.save_cart(request, cart)

            return Response({
                'product_id': product.id,
                'name': product.name,
                'unit_label': product.unit_label,
                'unit_detail': product.unit_detail,
                'quantity': new_quantity,
                'price': float(product.price),
                'available_quantity': available_qty,
                'total_price': float(product.price) * new_quantity
            }, status=200)

        return Response(serializer.errors, status=400)


class CartListView(APIView):
    """ดูตะกร้าสินค้า"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cart = vh.get_cart(request)
        items = []
        total_items = 0
        total_amount = 0.0

        for product_id, quantity in cart.items():
            try:
                product = Product.objects.get(id=int(product_id), is_available=True)
            except Product.DoesNotExist:
                continue

            qty = int(quantity)
            price = float(product.price)
            item_total = price * qty
            total_items += qty
            total_amount += item_total

            items.append({
                'id': product.id,
                'product_id': product.id,
                'name': product.name,
                'product_name': product.name,
                'unit_label': product.unit_label,
                'unit_detail': product.unit_detail,
                'price': price,
                'stock_quantity': product.stock_quantity,
                'available_quantity': max(0, int(product.stock_quantity or 0) - int(product.reserved_quantity or 0)),
                'image': product.image.url if product.image else None,
                'category': product.category.name if product.category else '',
                'quantity': qty,
                'total_price': item_total,
            })

        cart_data = {
            'items': items,
            'total_items': total_items,
            'total_amount': total_amount
        }

        serializer = CartSerializer(cart_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CartUpdateView(APIView):
    """แก้ไขสินค้าในตะกร้า"""
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request):
        serializer = CartUpdateSerializer(data=request.data)
        if serializer.is_valid():
            product_id = serializer.validated_data['product_id']
            quantity = serializer.validated_data['quantity']

            product = get_object_or_404(Product, id=product_id, is_available=True)
            cart = vh.get_cart(request)

            if quantity == 0:
                cart.pop(str(product_id), None)
                vh.save_cart(request, cart)
                return Response({
                    'message': 'ลบสินค้าจากตะกร้าสำเร็จ',
                    'product_id': product_id,
                    'quantity': 0
                }, status=status.HTTP_200_OK)

            available_qty = max(0, int(product.stock_quantity or 0) - int(product.reserved_quantity or 0))
            if available_qty < quantity:
                return Response({
                    'error': 'สินค้าไม่เพียงพอ'
                }, status=status.HTTP_400_BAD_REQUEST)

            cart[str(product_id)] = quantity
            vh.save_cart(request, cart)

            return Response({
                'message': 'อัปเดตตะกร้าสำเร็จ',
                'product_id': product.id,
                'product_name': product.name,
                'unit_label': product.unit_label,
                'unit_detail': product.unit_detail,
                'quantity': quantity,
                'price': float(product.price),
                'available_quantity': available_qty,
                'total_price': float(product.price) * quantity
            }, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CartDeleteView(APIView):
    """ลบสินค้าจากตะกร้า"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, product_id):
        product = get_object_or_404(Product, id=product_id)
        cart = vh.get_cart(request)
        cart.pop(str(product_id), None)
        vh.save_cart(request, cart)

        return Response({
            'message': 'ลบสินค้าจากตะกร้าสำเร็จ',
            'product_id': product_id,
            'product_name': product.name
        }, status=status.HTTP_200_OK)
