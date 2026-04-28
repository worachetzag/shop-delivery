import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import config from '../config';

const AdminHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username] = useState(localStorage.getItem('username') || 'Admin');
  const showAuditLog = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const role = localStorage.getItem('user_role') || '';
    if (localStorage.getItem('admin_can_view_audit') === '1') return true;
    return ['super_admin', 'admin'].includes(role);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      const adminToken = localStorage.getItem('admin_token');
      const authToken = localStorage.getItem('auth_token');
      await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
      
      localStorage.removeItem('admin_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('username');
      if (adminToken && authToken && adminToken === authToken) {
        localStorage.removeItem('auth_token');
      }
      navigate('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '15px 30px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <Link to="/admin/orders" style={{ color: 'white', textDecoration: 'none' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>
            👨‍💼 Admin Dashboard
          </h1>
        </Link>
        
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link 
            to="/admin/orders" 
            style={{ 
              color: 'white', 
              textDecoration: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/orders') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            คำสั่งซื้อ
          </Link>
          <Link
            to="/admin/products"
            style={{
              color: 'white',
              textDecoration: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/products') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            สินค้า
          </Link>
          <Link
            to="/admin/categories"
            style={{
              color: 'white',
              textDecoration: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/categories') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            หมวดหมู่
          </Link>
          <Link
            to="/admin/personnel"
            style={{
              color: 'white',
              textDecoration: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/personnel') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            บุคลากร
          </Link>
          {showAuditLog ? (
            <Link
              to="/admin/audit-log"
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '8px 15px',
                borderRadius: '5px',
                background: location.pathname.startsWith('/admin/audit-log') ? 'rgba(255,255,255,0.2)' : 'transparent'
              }}
            >
              ประวัติพนักงาน
            </Link>
          ) : null}
          <span style={{ opacity: 0.7 }}>|</span>
          <span style={{ opacity: 0.9 }}>{username}</span>
          <button 
            onClick={handleLogout}
            style={{
              padding: '8px 15px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '5px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            ออกจากระบบ
          </button>
        </nav>
      </div>
    </header>
  );
};

export default AdminHeader;

