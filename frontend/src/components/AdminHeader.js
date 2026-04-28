import React, { useEffect, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import config from '../config';

const AdminHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username] = useState(localStorage.getItem('username') || 'Admin');
  const [isCompact, setIsCompact] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  const showAuditLog = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const role = localStorage.getItem('user_role') || '';
    if (localStorage.getItem('admin_can_view_audit') === '1') return true;
    return ['super_admin', 'admin'].includes(role);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      padding: '16px 14px',
      boxShadow: '2px 0 16px rgba(0,0,0,0.14)',
      position: 'fixed',
      top: 0,
      left: 0,
      right: isCompact ? 0 : 'auto',
      bottom: isCompact ? 'auto' : 0,
      width: isCompact ? 'auto' : 240,
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        flexDirection: isCompact ? 'row' : 'column',
        height: '100%',
        gap: 14,
        alignItems: isCompact ? 'center' : 'stretch',
      }}>
        <Link to="/admin/orders" style={{ color: 'white', textDecoration: 'none', marginBottom: 8 }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>
            👨‍💼 Admin Dashboard
          </h1>
        </Link>
        
        <nav style={{ display: 'flex', flexDirection: isCompact ? 'row' : 'column', gap: '10px', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <Link 
            to="/admin/orders" 
            style={{ 
              color: 'white', 
              textDecoration: 'none',
              padding: '10px 12px',
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
              padding: '10px 12px',
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
              padding: '10px 12px',
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
              padding: '10px 12px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/personnel') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            บุคลากร
          </Link>
          <Link
            to="/admin/store-settings"
            style={{
              color: 'white',
              textDecoration: 'none',
              padding: '10px 12px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/store-settings') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            ตั้งค่าร้าน
          </Link>
          <Link
            to="/admin/inventory"
            style={{
              color: 'white',
              textDecoration: 'none',
              padding: '10px 12px',
              borderRadius: '5px',
              background: location.pathname.startsWith('/admin/inventory') ? 'rgba(255,255,255,0.2)' : 'transparent'
            }}
          >
            สต็อกครบวงจร
          </Link>
          {showAuditLog ? (
            <Link
              to="/admin/audit-log"
              style={{
                color: 'white',
                textDecoration: 'none',
                padding: '10px 12px',
                borderRadius: '5px',
                background: location.pathname.startsWith('/admin/audit-log') ? 'rgba(255,255,255,0.2)' : 'transparent'
              }}
            >
              ประวัติพนักงาน
            </Link>
          ) : null}
          <div style={{ opacity: 0.8, paddingTop: isCompact ? 0 : 8, borderTop: isCompact ? 'none' : '1px solid rgba(255,255,255,0.2)', marginTop: isCompact ? 0 : 8 }}>
            {username}
          </div>
        </nav>
        <div style={{ marginTop: isCompact ? 0 : 'auto' }}>
          <button 
            onClick={handleLogout}
            style={{
              width: isCompact ? 'auto' : '100%',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '5px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;

