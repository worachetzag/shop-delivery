from django.urls import path
from . import views

app_name = 'products'

urlpatterns = [
    path('', views.ProductListView.as_view(), name='product-list'),
    path('<int:pk>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('categories/', views.CategoryListView.as_view(), name='category-list'),
    path('admin/', views.AdminProductListCreateView.as_view(), name='admin-product-list-create'),
    path('admin/<int:pk>/', views.AdminProductDetailView.as_view(), name='admin-product-detail'),
    path('admin/categories/', views.AdminCategoryListCreateView.as_view(), name='admin-category-list-create'),
    path('admin/categories/<int:pk>/', views.AdminCategoryDetailView.as_view(), name='admin-category-detail'),
    path('admin/inventory/overview/', views.AdminInventoryOverviewView.as_view(), name='admin-inventory-overview'),
    path('admin/inventory/movements/', views.AdminStockMovementListCreateView.as_view(), name='admin-stock-movement-list-create'),
    path('admin/inventory/suppliers/', views.AdminSupplierListCreateView.as_view(), name='admin-supplier-list-create'),
    path('admin/inventory/suppliers/<int:pk>/', views.AdminSupplierDetailView.as_view(), name='admin-supplier-detail'),
    path('admin/inventory/purchase-orders/', views.AdminPurchaseOrderListCreateView.as_view(), name='admin-purchase-order-list-create'),
    path('admin/inventory/purchase-orders/<int:pk>/', views.AdminPurchaseOrderDetailView.as_view(), name='admin-purchase-order-detail'),
    path('admin/inventory/purchase-orders/<int:pk>/receive/', views.AdminPurchaseOrderReceiveView.as_view(), name='admin-purchase-order-receive'),
]



