import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import AdminHeader from './components/AdminHeader';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Products from './pages/Products';
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
import AdminPersonnelPage from './pages/AdminPersonnelPage';
import AdminAuditLogPage from './pages/AdminAuditLogPage';
import AdminOrderDetail from './pages/AdminOrderDetail';
import AdminProductFormPage from './pages/AdminProductFormPage';
import AdminStoreSettingsPage from './pages/AdminStoreSettingsPage';
import { PopupProvider } from './components/PopupProvider';
import './App.css';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isDriverPage = location.pathname.startsWith('/driver');
  const appRoleClass = isAdminPage ? 'app-role-admin' : (isDriverPage || location.pathname.startsWith('/customer') ? 'app-role-mobile' : 'app-role-mobile');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const username = params.get('username');
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

    if (loginStatus === 'success') {
      navigate('/customer', { replace: true });
      return;
    }

    // Clean auth query params from URL after handling callback data.
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const userRole = localStorage.getItem('user_role') || '';
    const token = localStorage.getItem('auth_token') || localStorage.getItem('admin_token');
    if (!token || !userRole) return;

    if (userRole === 'driver' && !location.pathname.startsWith('/driver')) {
      navigate('/driver/dashboard', { replace: true });
      return;
    }

    if (['admin', 'store_admin', 'super_admin'].includes(userRole) && !location.pathname.startsWith('/admin')) {
      navigate('/admin/orders', { replace: true });
      return;
    }

    if (
      userRole === 'customer'
      && !location.pathname.startsWith('/customer')
      && !location.pathname.startsWith('/login')
    ) {
      navigate('/customer', { replace: true });
    }
  }, [location.pathname, navigate]);
  
  return (
    <div className={`App ${appRoleClass}`}>
      {isAdminPage ? <AdminHeader /> : <Header />}
      <main className="main-content">
        <Routes>
          {/* Customer Routes (canonical) */}
          <Route path="/" element={<Navigate to="/customer" replace />} />
          <Route path="/customer" element={<Home />} />
          <Route path="/customer/products" element={<Products />} />
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
          <Route path="/products" element={<Navigate to="/customer/products" replace />} />
          <Route path="/cart" element={<Navigate to="/customer/cart" replace />} />
          <Route path="/checkout" element={<Navigate to="/customer/checkout" replace />} />
          <Route path="/orders" element={<Navigate to="/customer/orders" replace />} />
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
          <Route path="/profile" element={<Navigate to="/customer/profile" replace />} />
          <Route path="/login" element={<Navigate to="/customer/login" replace />} />
          
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
                <Navigate to="/admin/orders" replace />
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
            path="/admin/personnel"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminPersonnelPage />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/admin/store-settings"
            element={(
              <ProtectedRoute requireAdmin redirectTo="/admin/login">
                <AdminStoreSettingsPage />
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



