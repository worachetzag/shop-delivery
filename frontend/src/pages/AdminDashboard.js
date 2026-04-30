import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import ApiPaginationBar from '../components/ApiPaginationBar';
import './AdminDashboard.css';

const ADMIN_ORDERS_PAGE_SIZE = 15;
const ADMIN_PRODUCTS_PAGE_SIZE = 20;

const AdminDashboard = ({ forcedTab = null, forcedSubsection = null }) => {
  const popup = usePopup();
  const UNIT_OPTIONS = ['ชิ้น', 'แพ็ค', 'ขวด', 'กิโลกรัม', 'กรัม', 'มิลลิลิตร', 'ลิตร', 'อื่นๆ'];
  const UNIT_DETAIL_OPTIONS = ['มล.', 'ลิตร', 'กรัม', 'กก.', 'ชิ้น', 'แพ็ค', 'ขวด', 'กล่อง', 'ซอง', 'ถุง'];
  const navigate = useNavigate();
  const location = useLocation();
  const ordersCustomerIdFilter = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = (sp.get('customer_id') || '').trim();
    return /^\d+$/.test(raw) ? raw : '';
  }, [location.search]);
  const getAdminToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
  const currentUsername = localStorage.getItem('username') || '';
  const userRole = localStorage.getItem('user_role') || '';
  const canManageStaff = ['super_admin', 'admin'].includes(userRole);
  const resolveActiveTab = (pathname) => {
    if (pathname.startsWith('/admin/products')) return 'products';
    if (pathname.startsWith('/admin/categories')) return 'categories';
    if (pathname.startsWith('/admin/personnel')) return 'drivers';
    return 'orders';
  };
  const activeTab = forcedTab || resolveActiveTab(location.pathname);
  const showStaffSection = !forcedSubsection || forcedSubsection === 'staff';
  const showDriverSection = !forcedSubsection || forcedSubsection === 'drivers';
  const [orders, setOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalCount, setOrdersTotalCount] = useState(0);
  const [ordersSearchDraft, setOrdersSearchDraft] = useState('');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [productsPage, setProductsPage] = useState(1);
  const [productsTotalCount, setProductsTotalCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [savingStaff, setSavingStaff] = useState(false);
  const [savingDriver, setSavingDriver] = useState(false);
  const [savingStaffUpdate, setSavingStaffUpdate] = useState(false);
  const [savingDriverUpdate, setSavingDriverUpdate] = useState(false);
  const [personnelCreateMode, setPersonnelCreateMode] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingCategoryUpdate, setSavingCategoryUpdate] = useState(false);
  const [savingProductUpdate, setSavingProductUpdate] = useState(false);
  const [productImageFile, setProductImageFile] = useState(null);
  const [productEditImageFile, setProductEditImageFile] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    unit_label: 'ชิ้น',
    custom_unit_label: '',
    unit_detail: '',
    unit_detail_value: '',
    unit_detail_unit: 'มล.',
    image: '',
    category: '',
    stock_quantity: '',
    is_available: true,
    is_special_offer: false,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });
  const [categoryEditForm, setCategoryEditForm] = useState({
    id: null,
    name: '',
    description: '',
  });
  const [productEditForm, setProductEditForm] = useState({
    id: null,
    name: '',
    description: '',
    price: '',
    category: '',
    unit_label: 'ชิ้น',
    custom_unit_label: '',
    unit_detail: '',
    image: '',
    stock_quantity: '',
    is_available: true,
    is_special_offer: false,
  });
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    activeDrivers: 0
  });
  const [stockDrafts, setStockDrafts] = useState({});
  const [staffForm, setStaffForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'store_admin',
  });
  const [driverForm, setDriverForm] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    license_number: '',
    vehicle_type: '',
    vehicle_number: '',
  });
  const [staffEditForm, setStaffEditForm] = useState({
    id: null,
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'store_admin',
    password: '',
  });
  const [driverEditForm, setDriverEditForm] = useState({
    id: null,
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    license_number: '',
    vehicle_type: '',
    vehicle_number: '',
    is_available: true,
    password: '',
  });
  const [driverCreatePhoto, setDriverCreatePhoto] = useState(null);
  const [driverEditPhoto, setDriverEditPhoto] = useState(null);
  const [driverEditClearPhoto, setDriverEditClearPhoto] = useState(false);
  const selfStaffProfile = staffMembers.find((staff) => staff.username === currentUsername) || null;

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, ordersPage, ordersSearch, ordersCustomerIdFilter]);

  useEffect(() => {
    setOrdersPage(1);
  }, [ordersSearch, ordersCustomerIdFilter]);

  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts();
    }
  }, [activeTab, productsPage]);

  useEffect(() => {
    if (activeTab === 'products' || activeTab === 'categories') {
      loadCategories();
    }
    if (activeTab === 'drivers') {
      loadStaffMembers();
      loadDrivers();
    }
    loadStats();
  }, [activeTab]);

  useEffect(() => {
    const nextDrafts = {};
    products.forEach((product) => {
      nextDrafts[product.id] = String(product.stock_quantity ?? 0);
    });
    setStockDrafts(nextDrafts);
  }, [products]);

  const loadOrders = async () => {
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: String(ordersPage),
        page_size: String(ADMIN_ORDERS_PAGE_SIZE),
      });
      if (ordersSearch.trim()) {
        params.set('q', ordersSearch.trim());
      }
      if (ordersCustomerIdFilter) {
        params.set('customer_id', ordersCustomerIdFilter);
      }
      const response = await fetch(`${config.API_BASE_URL}orders/list/?${params.toString()}`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const list = data.results || data;
        setOrders(Array.isArray(list) ? list : []);
        setOrdersTotalCount(typeof data.count === 'number' ? data.count : (Array.isArray(list) ? list.length : 0));
      } else {
        console.error('Failed to load orders:', response.status);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const token = getAdminToken();
      const params = new URLSearchParams({
        page: String(productsPage),
        page_size: String(ADMIN_PRODUCTS_PAGE_SIZE),
      });
      const response = await fetch(`${config.API_BASE_URL}products/admin/?${params.toString()}`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load products: ${response.status}`);
      }
      const data = await response.json();
      const list = data.results || data || [];
      setProducts(Array.isArray(list) ? list : []);
      setProductsTotalCount(typeof data.count === 'number' ? data.count : (Array.isArray(list) ? list.length : 0));
    } catch (error) {
      console.error('Error loading products:', error);
      popup.error('โหลดรายการสินค้าไม่สำเร็จ');
    }
  };

  const loadCategories = async () => {
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/categories/`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load categories: ${response.status}`);
      }
      const data = await response.json();
      setCategories(data.results || data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleCategoryInputChange = (e) => {
    const { name, value } = e.target;
    setCategoryForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setSavingCategory(true);
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/categories/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
      }
      setCategoryForm({ name: '', description: '' });
      await loadCategories();
      popup.info('เพิ่มหมวดหมู่สำเร็จ');
    } catch (error) {
      popup.error(error.message || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
    } finally {
      setSavingCategory(false);
    }
  };

  const startEditCategory = (category) => {
    setEditingCategory(category.id);
    setCategoryEditForm({
      id: category.id,
      name: category.name || '',
      description: category.description || '',
    });
  };

  const saveEditCategory = async (e) => {
    e.preventDefault();
    if (!categoryEditForm.id) return;
    setSavingCategoryUpdate(true);
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/categories/${categoryEditForm.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: categoryEditForm.name.trim(),
          description: categoryEditForm.description.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'แก้ไขหมวดหมู่ไม่สำเร็จ');
      }
      await loadCategories();
      setEditingCategory(null);
      setCategoryEditForm({ id: null, name: '', description: '' });
      popup.info('แก้ไขหมวดหมู่สำเร็จ');
    } catch (error) {
      popup.error(error.message || 'แก้ไขหมวดหมู่ไม่สำเร็จ');
    } finally {
      setSavingCategoryUpdate(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!(await popup.confirm(`ต้องการลบหมวดหมู่ "${category.name}" ใช่หรือไม่?`, { tone: 'danger', confirmText: 'ลบหมวดหมู่' }))) {
      return;
    }
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/categories/${category.id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'ลบหมวดหมู่ไม่สำเร็จ');
      }
      await loadCategories();
      popup.info('ลบหมวดหมู่สำเร็จ');
    } catch (error) {
      popup.error(error.message || 'ลบหมวดหมู่ไม่สำเร็จ');
    }
  };

  const loadStats = async () => {
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}orders/admin/stats/`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to load stats: ${response.status}`);
      }

      const data = await response.json();
      setStats({
        totalOrders: Number(data.total_orders || 0),
        pendingOrders: Number(data.pending_orders || 0),
        totalRevenue: Number(data.total_revenue || 0),
        activeDrivers: Number(data.active_drivers || 0),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats({
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        activeDrivers: 0,
      });
    }
  };

  const loadStaffMembers = async () => {
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/staff/?page_size=100`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load staff: ${response.status}`);
      }
      const data = await response.json();
      const list = data.results !== undefined ? data.results : data;
      setStaffMembers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading staff members:', error);
      setStaffMembers([]);
    }
  };

  const loadDrivers = async () => {
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/drivers/?page_size=100`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Failed to load drivers: ${response.status}`);
      }
      const data = await response.json();
      const list = data.results !== undefined ? data.results : data;
      setDrivers(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading drivers:', error);
      setDrivers([]);
    }
  };

  const handleProductInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const token = getAdminToken();
      const resolvedUnitLabel = productForm.unit_label === 'อื่นๆ'
        ? productForm.custom_unit_label.trim()
        : productForm.unit_label.trim();
      if (!resolvedUnitLabel) {
        throw new Error('กรุณาระบุหน่วยสินค้า');
      }
      const generatedUnitDetail = productForm.unit_detail_value
        ? `${productForm.unit_detail_value} ${productForm.unit_detail_unit}`.trim()
        : '';
      const mergedUnitDetail = generatedUnitDetail
        ? `${generatedUnitDetail}${productForm.unit_detail.trim() ? ` (${productForm.unit_detail.trim()})` : ''}`
        : productForm.unit_detail.trim();

      const formData = new FormData();
      formData.append('name', productForm.name.trim());
      formData.append('description', productForm.description.trim());
      formData.append('price', String(parseFloat(productForm.price)));
      formData.append('unit_label', resolvedUnitLabel);
      formData.append('unit_detail', mergedUnitDetail);
      formData.append('category', String(parseInt(productForm.category, 10)));
      formData.append('stock_quantity', String(parseInt(productForm.stock_quantity, 10)));
      formData.append('is_available', productForm.is_available ? 'true' : 'false');
      formData.append('is_special_offer', productForm.is_special_offer ? 'true' : 'false');
      if (productImageFile) {
        formData.append('image', productImageFile);
      }

      const response = await fetch(`${config.API_BASE_URL}products/admin/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(JSON.stringify(err));
      }

      setProductForm({
        name: '',
        description: '',
        price: '',
        unit_label: 'ชิ้น',
        custom_unit_label: '',
        unit_detail: '',
        unit_detail_value: '',
        unit_detail_unit: 'มล.',
        image: '',
        category: '',
        stock_quantity: '',
        is_available: true,
        is_special_offer: false,
      });
      setProductImageFile(null);
      await loadProducts();
      popup.info('เพิ่มสินค้าใหม่สำเร็จ');
    } catch (error) {
      console.error('Error creating product:', error);
      popup.error('ไม่สามารถเพิ่มสินค้าได้');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleStockDraftChange = (productId, value) => {
    setStockDrafts((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const saveStockQuantity = async (product) => {
    const rawValue = stockDrafts[product.id];
    const parsed = parseInt(rawValue, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      popup.info('กรุณากรอกจำนวนสต็อกเป็นตัวเลข 0 ขึ้นไป');
      return;
    }

    if (parsed === Number(product.stock_quantity || 0)) {
      return;
    }

    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/${product.id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ stock_quantity: parsed }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update stock: ${response.status}`);
      }
      await loadProducts();
    } catch (error) {
      console.error('Error saving stock quantity:', error);
      popup.info('บันทึกจำนวนสินค้าไม่สำเร็จ');
    }
  };

  const startEditProduct = (product) => {
    const normalizedUnitLabel = UNIT_OPTIONS.includes(product.unit_label) ? product.unit_label : 'อื่นๆ';
    setEditingProduct(product.id);
    setProductEditForm({
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      category: String(product.category ?? ''),
      unit_label: normalizedUnitLabel || 'ชิ้น',
      custom_unit_label: normalizedUnitLabel === 'อื่นๆ' ? (product.unit_label || '') : '',
      unit_detail: product.unit_detail || '',
      image: product.image || '',
      stock_quantity: String(product.stock_quantity ?? 0),
      is_available: Boolean(product.is_available),
      is_special_offer: Boolean(product.is_special_offer),
    });
    setProductEditImageFile(null);
  };

  const saveEditProduct = async (e) => {
    e.preventDefault();
    if (!productEditForm.id) return;
    setSavingProductUpdate(true);
    try {
      const token = getAdminToken();
      const resolvedUnitLabel = productEditForm.unit_label === 'อื่นๆ'
        ? (productEditForm.custom_unit_label || '').trim()
        : productEditForm.unit_label.trim();
      if (!resolvedUnitLabel) {
        throw new Error('กรุณาระบุหน่วยสินค้า');
      }

      const formData = new FormData();
      formData.append('name', productEditForm.name.trim());
      formData.append('description', productEditForm.description.trim());
      formData.append('price', String(parseFloat(productEditForm.price)));
      formData.append('category', String(parseInt(productEditForm.category, 10)));
      formData.append('unit_label', resolvedUnitLabel);
      formData.append('unit_detail', productEditForm.unit_detail.trim());
      formData.append('stock_quantity', String(parseInt(productEditForm.stock_quantity, 10)));
      formData.append('is_available', productEditForm.is_available ? 'true' : 'false');
      formData.append('is_special_offer', productEditForm.is_special_offer ? 'true' : 'false');
      if (productEditImageFile) {
        formData.append('image', productEditImageFile);
      }

      const response = await fetch(`${config.API_BASE_URL}products/admin/${productEditForm.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'แก้ไขสินค้าไม่สำเร็จ');
      }

      await loadProducts();
      setEditingProduct(null);
      setProductEditForm({
        id: null,
        name: '',
        description: '',
        price: '',
        category: '',
        unit_label: 'ชิ้น',
        custom_unit_label: '',
        unit_detail: '',
        image: '',
        stock_quantity: '',
        is_available: true,
        is_special_offer: false,
      });
      setProductEditImageFile(null);
      popup.info('แก้ไขสินค้าสำเร็จ');
    } catch (error) {
      popup.error(error.message || 'แก้ไขสินค้าไม่สำเร็จ');
    } finally {
      setSavingProductUpdate(false);
    }
  };

  const clearProductImage = async () => {
    if (!productEditForm.id) return;
    if (!(await popup.confirm('ยืนยันลบรูปสินค้านี้?', { tone: 'danger', confirmText: 'ลบรูป' }))) return;
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}products/admin/${productEditForm.id}/`, {
        method: 'PATCH',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ image: null }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'ลบรูปสินค้าไม่สำเร็จ');
      }
      setProductEditForm((prev) => ({ ...prev, image: '' }));
      setProductEditImageFile(null);
      await loadProducts();
      popup.info('ลบรูปสินค้าเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'ลบรูปสินค้าไม่สำเร็จ');
    }
  };

  const handleStaffFormChange = (e) => {
    const { name, value } = e.target;
    setStaffForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDriverFormChange = (e) => {
    const { name, value } = e.target;
    setDriverForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSavingStaff(true);
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/staff/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(staffForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ไม่สามารถเพิ่มพนักงานได้');
      }
      setStaffForm({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'store_admin',
      });
      setPersonnelCreateMode(null);
      await loadStaffMembers();
      popup.info('เพิ่มพนักงานสำเร็จ');
    } catch (error) {
      console.error('Error creating staff:', error);
      popup.error(error.message || 'เพิ่มพนักงานไม่สำเร็จ');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    setSavingDriver(true);
    try {
      const token = getAdminToken();
      const fd = new FormData();
      fd.append('username', driverForm.username);
      fd.append('password', driverForm.password);
      fd.append('first_name', driverForm.first_name || '');
      fd.append('last_name', driverForm.last_name || '');
      fd.append('email', driverForm.email || '');
      fd.append('phone_number', driverForm.phone_number);
      fd.append('license_number', driverForm.license_number);
      fd.append('vehicle_type', driverForm.vehicle_type);
      fd.append('vehicle_number', driverForm.vehicle_number);
      if (driverCreatePhoto) {
        fd.append('photo', driverCreatePhoto);
      }
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/drivers/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ไม่สามารถเพิ่มคนขับได้');
      }
      setDriverForm({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        license_number: '',
        vehicle_type: '',
        vehicle_number: '',
      });
      setDriverCreatePhoto(null);
      setPersonnelCreateMode(null);
      await loadDrivers();
      loadStats();
      popup.info('เพิ่มคนขับสำเร็จ');
    } catch (error) {
      console.error('Error creating driver:', error);
      popup.error(error.message || 'เพิ่มคนขับไม่สำเร็จ');
    } finally {
      setSavingDriver(false);
    }
  };

  const deleteStaff = async (staff) => {
    if (!(await popup.confirm(`ต้องการลบพนักงาน "${staff.username}" ใช่หรือไม่?`, { tone: 'danger', confirmText: 'ลบพนักงาน' }))) {
      return;
    }
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/staff/${staff.id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ลบพนักงานไม่สำเร็จ');
      }
      await loadStaffMembers();
    } catch (error) {
      console.error('Error deleting staff:', error);
      popup.error(error.message || 'ลบพนักงานไม่สำเร็จ');
    }
  };

  const startEditStaff = (staff) => {
    setEditingStaff(staff.id);
    setStaffEditForm({
      id: staff.id,
      username: staff.username || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      email: staff.email || '',
      role: staff.role || 'store_admin',
      password: '',
    });
  };

  const saveEditStaff = async (e) => {
    e.preventDefault();
    if (!staffEditForm.id) return;
    setSavingStaffUpdate(true);
    try {
      const token = getAdminToken();
      const payload = {
        username: staffEditForm.username,
        first_name: staffEditForm.first_name,
        last_name: staffEditForm.last_name,
        email: staffEditForm.email,
      };
      if (canManageStaff) {
        payload.role = staffEditForm.role;
      }
      if (staffEditForm.password) {
        payload.password = staffEditForm.password;
      }
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/staff/${staffEditForm.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'แก้ไขพนักงานไม่สำเร็จ');
      }
      await loadStaffMembers();
      setEditingStaff(null);
      setStaffEditForm({
        id: null,
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'store_admin',
        password: '',
      });
      popup.info(data.message || 'แก้ไขพนักงานสำเร็จ');
    } catch (error) {
      popup.error(error.message || 'แก้ไขพนักงานไม่สำเร็จ');
    } finally {
      setSavingStaffUpdate(false);
    }
  };

  const startEditDriver = (driver) => {
    setEditingDriver(driver.id);
    setDriverEditPhoto(null);
    setDriverEditClearPhoto(false);
    setDriverEditForm({
      id: driver.id,
      username: driver.username || '',
      first_name: driver.first_name || '',
      last_name: driver.last_name || '',
      email: driver.email || '',
      phone_number: driver.phone_number || '',
      license_number: driver.license_number || '',
      vehicle_type: driver.vehicle_type || '',
      vehicle_number: driver.vehicle_number || '',
      is_available: Boolean(driver.is_available),
      password: '',
    });
  };

  const saveEditDriver = async (e) => {
    e.preventDefault();
    if (!driverEditForm.id) return;
    setSavingDriverUpdate(true);
    try {
      const token = getAdminToken();
      const fd = new FormData();
      fd.append('username', driverEditForm.username);
      fd.append('first_name', driverEditForm.first_name || '');
      fd.append('last_name', driverEditForm.last_name || '');
      fd.append('email', driverEditForm.email || '');
      fd.append('phone_number', driverEditForm.phone_number);
      fd.append('license_number', driverEditForm.license_number);
      fd.append('vehicle_type', driverEditForm.vehicle_type);
      fd.append('vehicle_number', driverEditForm.vehicle_number);
      fd.append('is_available', driverEditForm.is_available ? 'true' : 'false');
      if (driverEditForm.password) {
        fd.append('password', driverEditForm.password);
      }
      if (driverEditPhoto) {
        fd.append('photo', driverEditPhoto);
      }
      if (driverEditClearPhoto) {
        fd.append('clear_photo', 'true');
      }
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/drivers/${driverEditForm.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: fd,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'แก้ไขคนขับไม่สำเร็จ');
      }
      await loadDrivers();
      setEditingDriver(null);
      setDriverEditPhoto(null);
      setDriverEditClearPhoto(false);
      setDriverEditForm({
        id: null,
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        license_number: '',
        vehicle_type: '',
        vehicle_number: '',
        is_available: true,
        password: '',
      });
      popup.info(data.message || 'แก้ไขคนขับสำเร็จ');
    } catch (error) {
      popup.error(error.message || 'แก้ไขคนขับไม่สำเร็จ');
    } finally {
      setSavingDriverUpdate(false);
    }
  };

  const deleteDriver = async (driver) => {
    if (!(await popup.confirm(`ต้องการลบคนขับ "${driver.username}" ใช่หรือไม่?`, { tone: 'danger', confirmText: 'ลบคนขับ' }))) {
      return;
    }
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/drivers/${driver.id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'ลบคนขับไม่สำเร็จ');
      }
      await loadDrivers();
      loadStats();
    } catch (error) {
      console.error('Error deleting driver:', error);
      popup.error(error.message || 'ลบคนขับไม่สำเร็จ');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-content">
        {activeTab === 'orders' && (
          <div className="orders-table">
            {ordersCustomerIdFilter ? (
              <div
                style={{
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: '#eaf7ef',
                  borderRadius: 8,
                  border: '1px solid #c5e8d5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.92rem', color: '#14532d' }}>
                  แสดงเฉพาะออเดอร์ของลูกค้ารหัส #{ordersCustomerIdFilter}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/admin/orders')}
                >
                  แสดงออเดอร์ทั้งหมด
                </button>
              </div>
            ) : null}
            <div style={{ padding: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="form-input"
                style={{ minWidth: '280px' }}
                placeholder="ค้นหาเลขคำสั่งซื้อ (เช่น SP20260428001) หรือลูกค้า"
                value={ordersSearchDraft}
                onChange={(e) => setOrdersSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setOrdersSearch(ordersSearchDraft);
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={() => setOrdersSearch(ordersSearchDraft)}
              >
                ค้นหา
              </button>
              {(ordersSearch || ordersSearchDraft || ordersCustomerIdFilter) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setOrdersSearchDraft('');
                    setOrdersSearch('');
                    if (ordersCustomerIdFilter) {
                      navigate('/admin/orders');
                    }
                  }}
                >
                  ล้าง
                </button>
              )}
            </div>
            <table>
              <thead>
                <tr>
                  <th>หมายเลขคำสั่งซื้อ</th>
                  <th>ลูกค้า</th>
                  <th>สินค้า</th>
                  <th>จำนวนเงิน</th>
                  <th>สถานะ</th>
                  <th>คนขับ</th>
                  <th>สลิป</th>
                </tr>
              </thead>
              <tbody>
                {orders.length > 0 ? (
                  orders.map(order => (
                    <tr
                      key={order.id}
                      className="order-row-clickable"
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                    >
                      <td>
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="btn-secondary"
                          style={{ textDecoration: 'none', display: 'inline-block', padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {order.order_number || `#${order.id}`}
                        </Link>
                      </td>
                      <td>
                        {order.customer ? (
                          <Link
                            to={`/admin/customers/${order.customer}`}
                            className="btn-secondary"
                            style={{ textDecoration: 'none', display: 'inline-block', padding: '4px 8px', fontSize: '0.8rem' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.customer_name || `ลูกค้า #${order.customer}`}
                          </Link>
                        ) : (
                          order.customer_name || 'N/A'
                        )}
                      </td>
                      <td>{Array.isArray(order.items) ? order.items.length : (order.items_count || 0)} รายการ</td>
                      <td>฿{order.total_amount || 0}</td>
                      <td>
                        <span className={`status status-${order.status}`}>
                          {order.status_display || order.status}
                        </span>
                      </td>
                      <td>
                        <div className="slip-cell">
                          <span className="muted">
                            {order?.driver_assignment?.driver_name || 'ยังไม่มอบหมาย'}
                          </span>
                          {order?.driver_assignment?.status_display && (
                            <span className="status status-delivering">{order.driver_assignment.status_display}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {order.payment_method === 'promptpay' ? (
                          <div className="slip-cell">
                            <span className={`status status-${order.payment_slip_status || 'pending'}`}>
                              {order.payment_slip_status_display || order.payment_slip_status || 'รอสลิป'}
                            </span>
                            <span className="muted">{order.payment_slip_url ? 'มีสลิปแล้ว' : 'ยังไม่มีสลิป'}</span>
                          </div>
                        ) : (
                          <span className="muted">ไม่ต้องใช้สลิป</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                      ยังไม่มีคำสั่งซื้อ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <ApiPaginationBar
              count={ordersTotalCount}
              page={ordersPage}
              pageSize={ADMIN_ORDERS_PAGE_SIZE}
              onPageChange={setOrdersPage}
            />
          </div>
        )}

        {activeTab === 'products' && (
          <div className="products-section">
            <div className="personnel-create-actions" style={{ marginBottom: '12px' }}>
              <button type="button" className="btn-primary" onClick={() => navigate('/admin/products/new')}>
                ➕ เพิ่มสินค้าใหม่
              </button>
            </div>

            <div className="products-manage-table">
              <h3>จัดการสต็อกสินค้า</h3>
              <p className="products-row-click-hint" style={{ margin: '0 0 12px', color: '#666', fontSize: '14px' }}>
                คลิกที่แถวสินค้า (ยกเว้นช่องสต็อก) เพื่อเปิดหน้าแก้ไข
              </p>
              {products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  ยังไม่มีสินค้า
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อสินค้า</th>
                      <th>หมวดหมู่</th>
                      <th>หน่วย</th>
                      <th>ราคา</th>
                      <th>พร้อมขาย</th>
                      <th>จอง</th>
                      <th>สต็อก</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr
                        key={product.id}
                        className="admin-product-row"
                        onClick={() => navigate(`/admin/products/${product.id}/edit`)}
                        title="คลิกเพื่อแก้ไขสินค้า"
                      >
                        <td>{product.name}</td>
                        <td>{product.category_name || '-'}</td>
                        <td>{product.unit_label || 'ชิ้น'}{product.unit_detail ? ` (${product.unit_detail})` : ''}</td>
                        <td>฿{Number(product.price || 0).toLocaleString()}</td>
                        <td>{Number(product.available_quantity ?? ((product.stock_quantity || 0) - (product.reserved_quantity || 0)))}</td>
                        <td>{Number(product.reserved_quantity || 0)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="stock-editor">
                            <input
                              type="number"
                              min="0"
                              value={stockDrafts[product.id] ?? String(product.stock_quantity ?? 0)}
                              onChange={(e) => handleStockDraftChange(product.id, e.target.value)}
                              className="stock-input"
                            />
                            <button
                              type="button"
                              onClick={() => saveStockQuantity(product)}
                              className="stock-save-btn"
                            >
                              บันทึก
                            </button>
                          </div>
                        </td>
                        <td>
                          {product.is_available ? 'พร้อมขาย' : 'ปิดขาย'}
                          {product.is_low_stock ? ' · ใกล้หมด' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <ApiPaginationBar
                count={productsTotalCount}
                page={productsPage}
                pageSize={ADMIN_PRODUCTS_PAGE_SIZE}
                onPageChange={setProductsPage}
              />
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="products-section">
            <form className="product-form" onSubmit={handleCreateCategory}>
              <h3>เพิ่มหมวดหมู่สินค้า</h3>
              <div className="product-form-grid category-form-grid">
                <input
                  name="name"
                  value={categoryForm.name}
                  onChange={handleCategoryInputChange}
                  placeholder="ชื่อหมวดหมู่"
                  required
                />
                <input
                  name="description"
                  value={categoryForm.description}
                  onChange={handleCategoryInputChange}
                  placeholder="คำอธิบายหมวดหมู่ (ไม่บังคับ)"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={savingCategory}>
                {savingCategory ? 'กำลังบันทึก...' : '➕ เพิ่มหมวดหมู่'}
              </button>
            </form>

            {editingCategory && (
              <div className="personnel-card">
                <h3>แก้ไขหมวดหมู่</h3>
                <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#666' }}>
                  รายการหมวดหมู่ด้านล่างถูกซ่อนระหว่างแก้ไข — กดยกเลิกเพื่อกลับ
                </p>
                <form className="personnel-form" onSubmit={saveEditCategory}>
                  <input
                    value={categoryEditForm.name}
                    onChange={(e) => setCategoryEditForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="ชื่อหมวดหมู่"
                    required
                  />
                  <input
                    value={categoryEditForm.description}
                    onChange={(e) => setCategoryEditForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="คำอธิบายหมวดหมู่ (ไม่บังคับ)"
                  />
                  <div className="personnel-form-actions">
                    <button type="submit" className="btn-primary" disabled={savingCategoryUpdate}>
                      {savingCategoryUpdate ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingCategory(null)}>
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
            )}

            {!editingCategory && (
              <div className="products-manage-table">
                <h3>รายการหมวดหมู่</h3>
                {categories.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px' }}>ยังไม่มีหมวดหมู่</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>ชื่อหมวดหมู่</th>
                        <th>คำอธิบาย</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.id}>
                          <td>{category.name}</td>
                          <td>{category.description || '-'}</td>
                          <td className="product-actions-cell">
                            <button onClick={() => startEditCategory(category)}>แก้ไข</button>
                            <button className="danger" onClick={() => deleteCategory(category)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="drivers-section">
            <div className="personnel-create-actions">
              {canManageStaff && showStaffSection && (
                <button type="button" className="btn-primary" onClick={() => setPersonnelCreateMode('staff')}>
                  ➕ เพิ่มพนักงาน
                </button>
              )}
              {showDriverSection && (
              <button type="button" className="btn-primary" onClick={() => setPersonnelCreateMode('driver')}>
                ➕ เพิ่มคนขับ
              </button>
              )}
              {personnelCreateMode && (
                <button type="button" className="btn-secondary" onClick={() => setPersonnelCreateMode(null)}>
                  ปิดฟอร์ม
                </button>
              )}
            </div>

            {showStaffSection && selfStaffProfile && !canManageStaff && !editingStaff && (
              <div className="personnel-card">
                <h3>ข้อมูลบัญชีของฉัน</h3>
                <p><strong>Username:</strong> {selfStaffProfile.username}</p>
                <p><strong>ชื่อ:</strong> {`${selfStaffProfile.first_name || ''} ${selfStaffProfile.last_name || ''}`.trim() || '-'}</p>
                <p><strong>อีเมล:</strong> {selfStaffProfile.email || '-'}</p>
                <p><strong>Role:</strong> {selfStaffProfile.role || '-'}</p>
                <button type="button" className="btn-primary" onClick={() => startEditStaff(selfStaffProfile)}>
                  แก้ไขข้อมูลของฉัน
                </button>
              </div>
            )}

            {showStaffSection && canManageStaff && personnelCreateMode === 'staff' && (
              <div className="personnel-card">
                <h3>เพิ่มพนักงาน</h3>
                <form className="personnel-form" onSubmit={handleCreateStaff}>
                  <input name="username" value={staffForm.username} onChange={handleStaffFormChange} placeholder="Username" required />
                  <input name="password" type="password" value={staffForm.password} onChange={handleStaffFormChange} placeholder="Password" required />
                  <input name="first_name" value={staffForm.first_name} onChange={handleStaffFormChange} placeholder="ชื่อ" />
                  <input name="last_name" value={staffForm.last_name} onChange={handleStaffFormChange} placeholder="นามสกุล" />
                  <input name="email" type="email" value={staffForm.email} onChange={handleStaffFormChange} placeholder="อีเมล" />
                  <select name="role" value={staffForm.role} onChange={handleStaffFormChange}>
                    <option value="store_admin">Store Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                  <button type="submit" className="btn-primary" disabled={savingStaff}>
                    {savingStaff ? 'กำลังบันทึก...' : 'เพิ่มพนักงาน'}
                  </button>
                </form>
              </div>
            )}

            {showStaffSection && editingStaff && (
              <div className="personnel-card">
                <h3>แก้ไขพนักงาน</h3>
                <form className="personnel-form" onSubmit={saveEditStaff}>
                  <input value={staffEditForm.username} onChange={(e) => setStaffEditForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="Username" required />
                  <input value={staffEditForm.first_name} onChange={(e) => setStaffEditForm((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="ชื่อ" />
                  <input value={staffEditForm.last_name} onChange={(e) => setStaffEditForm((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="นามสกุล" />
                  <input type="email" value={staffEditForm.email} onChange={(e) => setStaffEditForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="อีเมล" />
                  {canManageStaff ? (
                    <select value={staffEditForm.role} onChange={(e) => setStaffEditForm((prev) => ({ ...prev, role: e.target.value }))}>
                      <option value="store_admin">Store Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <input value={staffEditForm.role} disabled readOnly />
                  )}
                  <input type="password" value={staffEditForm.password} onChange={(e) => setStaffEditForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="รหัสผ่านใหม่ (ถ้าไม่เปลี่ยนให้เว้นว่าง)" />
                  <div className="personnel-form-actions">
                    <button type="submit" className="btn-primary" disabled={savingStaffUpdate}>
                      {savingStaffUpdate ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setEditingStaff(null)}>
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showDriverSection && personnelCreateMode === 'driver' && (
              <div className="personnel-card">
                <h3>เพิ่มคนขับ</h3>
                <form className="personnel-form" onSubmit={handleCreateDriver}>
                  <input name="username" value={driverForm.username} onChange={handleDriverFormChange} placeholder="Username" required />
                  <input name="password" type="password" value={driverForm.password} onChange={handleDriverFormChange} placeholder="Password" required />
                  <input name="first_name" value={driverForm.first_name} onChange={handleDriverFormChange} placeholder="ชื่อ" />
                  <input name="last_name" value={driverForm.last_name} onChange={handleDriverFormChange} placeholder="นามสกุล" />
                  <input name="email" type="email" value={driverForm.email} onChange={handleDriverFormChange} placeholder="อีเมล" />
                  <input name="phone_number" value={driverForm.phone_number} onChange={handleDriverFormChange} placeholder="เบอร์โทร" required />
                  <input name="license_number" value={driverForm.license_number} onChange={handleDriverFormChange} placeholder="เลขใบขับขี่" required />
                  <input name="vehicle_type" value={driverForm.vehicle_type} onChange={handleDriverFormChange} placeholder="ประเภทรถ" required />
                  <input name="vehicle_number" value={driverForm.vehicle_number} onChange={handleDriverFormChange} placeholder="ทะเบียนรถ" required />
                  <label style={{ display: 'block', fontSize: '0.88rem', color: '#555' }}>
                    รูปประจำตัว (ไม่บังคับ)
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'block', marginTop: 6 }}
                      onChange={(e) => setDriverCreatePhoto(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button type="submit" className="btn-primary" disabled={savingDriver}>
                    {savingDriver ? 'กำลังบันทึก...' : 'เพิ่มคนขับ'}
                  </button>
                </form>
              </div>
            )}

            {showDriverSection && editingDriver && (
              <div className="personnel-card">
                <h3>แก้ไขคนขับ</h3>
                <form className="personnel-form" onSubmit={saveEditDriver}>
                  {(() => {
                    const row = drivers.find((d) => d.id === editingDriver);
                    const showPrev = row?.photo_url && !driverEditClearPhoto;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        {showPrev ? (
                          <img src={row.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e3e9e7' }} />
                        ) : (
                          <span
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: '50%',
                              background: '#00b14f',
                              color: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '1.1rem',
                            }}
                          >
                            {(row?.full_name || row?.username || '?').charAt(0)}
                          </span>
                        )}
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          {showPrev ? 'รูปปัจจุบัน' : 'ยังไม่มีรูป — ใช้ตัวอักษรแทน'}
                        </div>
                      </div>
                    );
                  })()}
                  <label style={{ display: 'block', fontSize: '0.88rem', color: '#555' }}>
                    เปลี่ยนรูป (ไม่บังคับ)
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'block', marginTop: 6 }}
                      onChange={(e) => {
                        setDriverEditPhoto(e.target.files?.[0] || null);
                        setDriverEditClearPhoto(false);
                      }}
                    />
                  </label>
                  {drivers.find((d) => d.id === editingDriver)?.photo_url ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={driverEditClearPhoto}
                        onChange={(e) => {
                          setDriverEditClearPhoto(e.target.checked);
                          if (e.target.checked) setDriverEditPhoto(null);
                        }}
                      />
                      ลบรูปเดิม (กลับเป็นแบบตัวอักษร)
                    </label>
                  ) : null}
                  <input value={driverEditForm.username} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="Username" required />
                  <input value={driverEditForm.first_name} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, first_name: e.target.value }))} placeholder="ชื่อ" />
                  <input value={driverEditForm.last_name} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, last_name: e.target.value }))} placeholder="นามสกุล" />
                  <input type="email" value={driverEditForm.email} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="อีเมล" />
                  <input value={driverEditForm.phone_number} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, phone_number: e.target.value }))} placeholder="เบอร์โทร" required />
                  <input value={driverEditForm.license_number} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, license_number: e.target.value }))} placeholder="เลขใบขับขี่" required />
                  <input value={driverEditForm.vehicle_type} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, vehicle_type: e.target.value }))} placeholder="ประเภทรถ" required />
                  <input value={driverEditForm.vehicle_number} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, vehicle_number: e.target.value }))} placeholder="ทะเบียนรถ" required />
                  <label>
                    <input
                      type="checkbox"
                      checked={driverEditForm.is_available}
                      onChange={(e) => setDriverEditForm((prev) => ({ ...prev, is_available: e.target.checked }))}
                    />
                    ว่างรับงาน
                  </label>
                  <input type="password" value={driverEditForm.password} onChange={(e) => setDriverEditForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="รหัสผ่านใหม่ (ถ้าไม่เปลี่ยนให้เว้นว่าง)" />
                  <div className="personnel-form-actions">
                    <button type="submit" className="btn-primary" disabled={savingDriverUpdate}>
                      {savingDriverUpdate ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingDriver(null);
                        setDriverEditPhoto(null);
                        setDriverEditClearPhoto(false);
                      }}
                    >
                      ยกเลิก
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="personnel-tables">
              {showStaffSection && (
              <div className="personnel-table">
                <h3>รายการพนักงาน</h3>
                {editingStaff || personnelCreateMode === 'staff' ? (
                  <div className="empty-state">กำลังเพิ่มหรือแก้ไขพนักงาน — บันทึกหรือยกเลิกเพื่อกลับมาดูรายการ</div>
                ) : !canManageStaff ? (
                  <div className="empty-state">บัญชีพนักงานดูได้เฉพาะผู้ดูแลระดับสูง</div>
                ) : staffMembers.length === 0 ? (
                  <div className="empty-state">ยังไม่มีพนักงาน</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>ชื่อ</th>
                        <th>Role</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffMembers.map((staff) => (
                        <tr key={staff.id}>
                          <td>{staff.username}</td>
                          <td>{`${staff.first_name || ''} ${staff.last_name || ''}`.trim() || '-'}</td>
                          <td>{staff.role}</td>
                          <td>
                            <button onClick={() => startEditStaff(staff)}>แก้ไข</button>
                            <button className="danger" onClick={() => deleteStaff(staff)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              )}

              {showDriverSection && (
              <div className="personnel-table">
                <h3>รายการคนขับ</h3>
                {editingDriver || personnelCreateMode === 'driver' ? (
                  <div className="empty-state">กำลังเพิ่มหรือแก้ไขคนขับ — บันทึกหรือยกเลิกเพื่อกลับมาดูรายการ</div>
                ) : drivers.length === 0 ? (
                  <div className="empty-state">ยังไม่มีคนขับ</div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>ชื่อ</th>
                        <th>เบอร์</th>
                        <th>ทะเบียนรถ</th>
                        <th>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((driver) => (
                        <tr key={driver.id}>
                          <td>{driver.username}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {driver.photo_url ? (
                                <img src={driver.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                              ) : (
                                <span
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: '#00b14f',
                                    color: '#fff',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {(driver.full_name || driver.username || '?').charAt(0)}
                                </span>
                              )}
                              <span>{driver.full_name || '-'}</span>
                            </div>
                          </td>
                          <td>{driver.phone_number || '-'}</td>
                          <td>{driver.vehicle_number || '-'}</td>
                          <td>
                            <button onClick={() => startEditDriver(driver)}>แก้ไข</button>
                            <button className="danger" onClick={() => deleteDriver(driver)}>ลบ</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

