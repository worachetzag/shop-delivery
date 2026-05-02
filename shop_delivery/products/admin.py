from django.contrib import admin
from .models import Category, Product, PurchaseOrder, PurchaseOrderItem, StockMovement, Supplier


# Category Admin
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'has_icon', 'created_at')
    search_fields = ('name',)
    readonly_fields = ('created_at',)

    @admin.display(description='ไอคอน', boolean=True)
    def has_icon(self, obj):
        return bool(obj.icon)


# Product Admin
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'category',
        'price',
        'compare_at_price',
        'stock_quantity',
        'is_available',
        'is_featured',
        'is_special_offer',
        'created_at',
    )
    list_filter = ('category', 'is_available', 'is_featured', 'is_special_offer', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
    # ห้ามแก้ stock_quantity ตรงนี้ เพื่อไม่ข้าม flow StockMovement
    list_editable = ('price', 'compare_at_price', 'is_available', 'is_featured', 'is_special_offer')


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ('name', 'contact_name', 'phone', 'is_active', 'updated_at')
    search_fields = ('name', 'contact_name', 'phone', 'email')
    list_filter = ('is_active',)


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 0


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('reference', 'supplier', 'status', 'expected_date', 'created_by', 'created_at')
    list_filter = ('status', 'supplier', 'created_at')
    search_fields = ('reference', 'supplier__name', 'notes')
    inlines = [PurchaseOrderItemInline]


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = (
        'created_at', 'product', 'movement_type', 'quantity_change',
        'quantity_before', 'quantity_after', 'reserved_before', 'reserved_after', 'source_type', 'source_id',
    )
    list_filter = ('movement_type', 'source_type', 'created_at')
    search_fields = ('product__name', 'reference', 'source_id', 'note')
    readonly_fields = (
        'product', 'movement_type', 'quantity_change', 'quantity_before', 'quantity_after',
        'reserved_before', 'reserved_after', 'unit_cost', 'source_type', 'source_id',
        'reference', 'note', 'created_by', 'created_at',
    )