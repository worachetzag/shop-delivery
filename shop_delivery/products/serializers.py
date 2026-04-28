from rest_framework import serializers
from .models import (
    Category,
    Product,
    PurchaseOrder,
    PurchaseOrderItem,
    StockMovement,
    Supplier,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['created_at']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    available_quantity = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    
    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'unit_label', 'unit_detail', 'category', 'category_name',
                 'image', 'stock_quantity', 'reserved_quantity', 'available_quantity', 'min_stock_level',
                 'is_low_stock', 'is_available', 'is_special_offer',
                 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'reserved_quantity', 'available_quantity', 'is_low_stock']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        image_path = data.get('image')
        request = self.context.get('request')
        if image_path and request:
            data['image'] = request.build_absolute_uri(image_path)
        return data

    def get_available_quantity(self, obj):
        return max(0, int(obj.stock_quantity or 0) - int(obj.reserved_quantity or 0))

    def get_is_low_stock(self, obj):
        return self.get_available_quantity(obj) <= int(obj.min_stock_level or 0)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_name', 'phone', 'email', 'address',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_unit = serializers.CharField(source='product.unit_label', read_only=True)
    movement_label = serializers.CharField(source='get_movement_type_display', read_only=True)
    actor_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_unit',
            'movement_type', 'movement_label',
            'quantity_change', 'quantity_before', 'quantity_after',
            'reserved_before', 'reserved_after', 'unit_cost',
            'source_type', 'source_id', 'reference', 'note',
            'actor_name', 'created_at',
        ]


class ManualStockAdjustmentSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity_change = serializers.IntegerField()
    movement_type = serializers.ChoiceField(
        choices=[
            'adjustment_in',
            'adjustment_out',
            'return_in',
            'damage_out',
        ],
        required=False,
    )
    reference = serializers.CharField(required=False, allow_blank=True, max_length=120)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('quantity_change') == 0:
            raise serializers.ValidationError({'quantity_change': 'จำนวนต้องไม่เป็น 0'})
        if not attrs.get('movement_type'):
            attrs['movement_type'] = 'adjustment_in' if attrs['quantity_change'] > 0 else 'adjustment_out'
        return attrs


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    available_quantity = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_name',
            'ordered_quantity', 'received_quantity', 'unit_cost', 'available_quantity',
        ]

    def get_available_quantity(self, obj):
        p = obj.product
        return max(0, int(p.stock_quantity or 0) - int(p.reserved_quantity or 0))


class PurchaseOrderSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = PurchaseOrderItemSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'reference', 'supplier', 'supplier_name', 'status', 'status_display',
            'expected_date', 'notes', 'items', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['reference', 'created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        purchase_order = PurchaseOrder.objects.create(**validated_data)
        for item in items_data:
            PurchaseOrderItem.objects.create(purchase_order=purchase_order, **item)
        return purchase_order

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                PurchaseOrderItem.objects.create(purchase_order=instance, **item)
        return instance



