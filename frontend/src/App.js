import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import Header from './components/Header';
import CustomerViewportChrome from './components/CustomerViewportChrome';
import AdminHeader from './components/AdminHeader';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Tracking from './pages/Tracking';
import Profile from './pages/Profile';
import Login from './pages/Login';
import DriverLogin from './pages/DriverLogin';
import DriverDashboard from './pages/DriverDashboard';
import DriverAssignmentDetail from './pages/DriverAssignmentDetail';
import AdminLogin from './pages/AdminLogin';
import AdminOrdersPage from './pages/AdminOrdersPage';
import AdminProductsPage from './pages/AdminProductsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminHomePromotionsPage from './pages/AdminHomePromotionsPage';
import AdminCustomersPage from './pages/AdminCustomersPage';
import AdminCustomerDetailPage from './pages/AdminCustomerDetailPage';
import AdminPersonnelStaffPage from './pages/AdminPersonnelStaffPage';
import AdminPersonnelDriversPage from './pages/AdminPersonnelDriversPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';
import AdminOrderDetail from './pages/AdminOrderDetail';
import AdminProductFormPage from './pages/AdminProductFormPage';
import AdminStoreSettingsPage from './pages/AdminStoreSettingsPage';
import AdminInventoryPage from './pages/AdminInventoryPage';
import AdminPurchaseOrderDetailPage from './pages/AdminPurchaseOrderDetailPage';
import AdminOverviewPage from './pages/AdminOverviewPage';
import { PopupProvider } from './components/PopupProvider';
import config from './config';
import {
  LIFF_PAGE_ROUTES,
  resolveCustomerDeepLink,
  stripCustomerRoutingParams,
} from './utils/customerDeepLink';
import './App.css';

/** Navigate ที่เก็บ ?query และ #hash — LINE เปิดที่ / หรือ /liff พร้อม ?page= ไม่ให้หายไประหว่าง redirect */
function NavigatePreserveSearch({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${to}${search || ''}${hash || ''}`} replace />;
}

/** LIFF URL `https://liff.line.me/<id>/<segment>` — segment แปลงเป็นหน้าลูกค้า */
function LiffSegmentNavigate() {
  const { segment } = useParams();
  const loc = useLocation();
  const key = (segment || '').trim().toLowerCase();
  const toBase = LIFF_PAGE_ROUTES[key] || '/customer';
  return <Navigate to={`${toBase}${loc.search}${loc.hash || ''}`} replace />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isAdminLoginRoute = location.pathname === '/admin/login';
  const isDriverLoginRoute = location.pathname === '/driver/login';
  const showAdminChrome = isAdminPage && !isAdminLoginRoute;
  const isDriverPage = location.pathname.startsWith('/driver');
  const showDriverChrome = isDriverPage && !isDriverLoginRoute;
  const showCustomerChrome = !isAdminPage && !isDriverPage;
  const appRoleClass = isAdminPage
    ? 'app-role-admin'
    : (isDriverPage ? 'app-role-mobile app-role-driver' : 'app-role-mobile');
  const [routeLoading, setRouteLoading] = useState(false);
  const previousPathRef = useRef(location.pathname + location.search);

  /** Rich Menu / LIFF: ?page=, liff.state, hash #page=, ?next= */
  useLayoutEffect(() => {
    const dest = resolveCustomerDeepLink(location.pathname, location.search, location.hash, {
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      navigationAgeMs: typeof performance !== 'undefined' ? performance.now() : Infinity,
    });
    if (!dest) return;

    try {
      const nextUrl = new URL(dest, window.location.origin);
      const curUrl = new URL(`${location.pathname}${location.search}`, window.location.origin);
      if (nextUrl.pathname === curUrl.pathname && nextUrl.search === curUrl.search) return;
    } catch {
      const current = `${location.pathname}${location.search}`;
      if (dest === current) return;
    }
    navigate(dest, { replace: true });
  }, [location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const username = params.get('username');
    const userRoleFromUrl = params.get('user_role');
    const loginStatus = params.get('login');

    if (!token && !loginStatus) {
      return;
    }

    if (token) {
      localStorage.setItem('auth_token', token);
    }
    if (username) {
      localStorage.setItem('username', username);
    }
    if (userRoleFromUrl) {
      localStorage.setItem('user_role', userRoleFromUrl);
    }

    // Clean auth query params from URL after handling callback data.
    params.delete('token');
    params.delete('username');
    params.delete('user_role');
    params.delete('login');
    stripCustomerRoutingParams(params);
    const cleanedSearch = params.toString();
    const nextPath = `${location.pathname}${cleanedSearch ? `?${cleanedSearch}` : ''}`;

    if (loginStatus === 'success') {
      navigate(nextPath === '/' ? '/customer' : nextPath, { replace: true });
      return;
    }

    navigate(nextPath, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    /* หน้าคนขับใช้ sessionStorage แยกแท็บ — อย่าเด้งจาก user_role แอดมินใน localStorage */
    if (location.pathname.startsWith('/driver')) {
      return;
    }

    const userRole = localStorage.getItem('user_role') || '';
    const token = localStorage.getItem('auth_token') || localStorage.getItem('admin_token');
    if (!token || !userRole) return;

    if (userRole === 'driver' && !location.pathname.startsWith('/driver')) {
      navigate('/driver/dashboard', { replace: true });
      return;
    }

    if (['admin', 'store_admin', 'super_admin'].includes(userRole) && !location.pathname.startsWith('/admin')) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    /**
     * ลูกค้า: เด้งกลับร้านเฉพาะ path ที่ไม่ใช่หน้าลูกค้า
     * ห้ามบล็อก /liff/*, /products, /cart — ไม่งั้น LIFF/Rich Menu เปิดมาแล้วโดน replace เป็น /customer ก่อน Route จะ redirect
     */
    if (userRole === 'customer') {
      const p = location.pathname;
      const customerFacing =
        p.startsWith('/customer')
        || p.startsWith('/login')
        || p.startsWith('/liff')
        || p.startsWith('/products')
        || p === '/cart'
        || p === '/checkout'
        || p === '/orders'
        || p.startsWith('/orders/')
        || p === '/profile'
        || p.startsWith('/tracking/');
      if (!customerFacing) {
        navigate('/customer', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  /** ลูกค้าที่ล็อกอินแล้วแต่ยังไม่กรอกโปรไฟล์ครบ — จำกัดอยู่หน้าโปรไฟล์ / login */
  useEffect(() => {
    let cancelled = false;
    if (location.pathname.startsWith('/driver')) {
      return;
    }
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role') || '';
    if (!token) return;
    if (['admin', 'store_admin', 'super_admin', 'driver'].includes(role)) return;

    const path = location.pathname;
    const inCustomerShop = path.startsWith('/customer') || path.startsWith('/products');
    if (!inCustomerShop) return;
    if (path.startsWith('/customer/profile') || path === '/customer/login') return;

    (async () => {
      try {
        const res = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
          method: 'GET',
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.profile_completed === false) {
          navigate('/customer/profile?section=personal&complete=required', { replace: true });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, navigate]);

  useEffect(() => {
    const nextPath = location.pathname + location.search;
    if (previousPathRef.current === nextPath) return;
    previousPathRef.current = nextPath;
    setRouteLoading(true);
    const timer = setTimeout(() => setRouteLoading(false), 250);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);
  
  return (
    <div className={`App ${appRoleClass}${isAdminLoginRoute ? ' admin-login-layout' : ''}${isDriverLoginRoute ? ' driver-login-layout' : ''}`}>
      {showAdminChrome ? (
        <AdminHeader />
      ) : showCustomerChrome ? (
        <>
          <Header hideCustomerTopBar />
          <CustomerViewportChrome />
        </>
      ) : showDriverChrome ? (
        <Header hideCustomerTopBar hideDriverTopBar />
      ) : null}
      {routeLoading && (
        <div className="route-loading-overlay" aria-live="polite" aria-label="กำลังเปลี่ยนหน้า">
          <div className="route-loading-spinner" />
        </div>
      )}
      <main className="main-content">
        <Routes>
          {/* Customer Routes (canonical) */}
          <Route path="/" element={<NavigatePreserveSearch to="/customer" />} />
          <Route path="/liff" element={<NavigatePreserveSearch to="/customer" />} />
          <Route path="/liff/:segment" element={<LiffSegmentNavigate />} />
          <Route path="/customer" element={<Home />} />
          <Route path="/customer/products" element={<Products />} />
          <Route path="/customer/products/:productId" element={<ProductDetail />} />
          <Route
            path="/customer/cart"
            element={(
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/customer/checkout"
            element={(
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/customer/orders"
            element={(
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/customer/orders/:orderId"
            element={(
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/customer/tracking/:orderId"
            element={(
              <ProtectedRoute>
                <Tracking />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/customer/profile"
            element={(
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            )}
          />
          <Route path="/customer/login" element={<Login />} />

          {/* Legacy customer URLs -> canonical */}
          <Route path="/products" element={<NavigatePreserveSearch to="/customer/products" />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/cart" element={<NavigatePreserveSearch to="/customer/cart" />} />
          <Route path="/checkout" element={<NavigatePreserveSearch to="/customer/checkout" />} />
          <Route path="/orders" element={<NavigatePreserveSearch to="/customer/orders" />} />
          <Route
            path="/orders/:orderId"
            element={(
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/tracking/:orderId"
            element={(
              <ProtectedRoute>
                <Tracking />
              </ProtectedRoute>
            )}
          />
          <Route path="/profile" element={<NavigatePreserveSearch to="/customer/profile" />} />
          <Route path="/login" element={<NavigatePreserveSearch to="/customer/login" />} />
          
          {/* Driver Routes */}
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route
            path="/driver/dashboard"
            element={(
              <ProtectedRoute requireDriver redirectTo="/driver/login">
                <DriverDashboard />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/driver/assignments/:assignmentId"
            element={(
              <ProtectedRoute requireDriver redirectTo="/driver/login">
                <DriverAssignmentDetail />
              </ProtectedRoute>
            )}
          />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminOverviewPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/orders"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminOrdersPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/products"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminProductsPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/categories"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminCategoriesPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/home-promotions"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminHomePromotionsPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/customers"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminCustomersPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/customers/:customerId"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminCustomerDetailPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/personnel"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <Navigate to="/admin/personnel/staff" replace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/personnel/staff"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminPersonnelStaffPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/personnel/drivers"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminPersonnelDriversPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <Navigate to="/admin/store-settings/store" replace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings/store"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminStoreSettingsPage section="store" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings/location"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <Navigate to="/admin/store-settings/store" replace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings/payment"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminStoreSettingsPage section="payment" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings/delivery-fees"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminStoreSettingsPage section="delivery-fees" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings/hours"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminStoreSettingsPage section="hours" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <Navigate to="/admin/inventory/overview" replace />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory/overview"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminInventoryPage section="overview" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory/adjustments"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminInventoryPage section="adjustments" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory/suppliers"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminInventoryPage section="suppliers" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory/purchase-orders"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminInventoryPage section="purchase-orders" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory/movements"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminInventoryPage section="movements" />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/inventory/purchase-orders/:poId"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminPurchaseOrderDetailPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/audit-log"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminAuditLogPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/orders/:orderId"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminOrderDetail />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/orders/:orderId/tracking"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <Tracking />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/products/new"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminProductFormPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/products/:productId/edit"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminProductFormPage />
              </ProtectedRoute>
            )}
          />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <PopupProvider>
      <Router>
        <AppContent />
      </Router>
    </PopupProvider>
  );
}

export default App;



