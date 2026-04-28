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

  const isActivePath = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const groupTitleStyle = {
    fontSize: '0.72rem',
    opacity: 0.85,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    margin: '6px 0 2px',
    padding: '0 2px',
  };
  const subLinkStyle = (active) => ({
    color: 'white',
    textDecoration: 'none',
    padding: '8px 10px',
    borderRadius: '5px',
    fontSize: '0.9rem',
    background: active ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.08)',
  });

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
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' }}>
          <Link
            to="/admin/orders"
            style={subLinkStyle(isActivePath('/admin/orders'))}
          >
            คำสั่งซื้อ
          </Link>
          <Link
            to="/admin/products"
            style={subLinkStyle(isActivePath('/admin/products'))}
          >
            สินค้า
          </Link>
          <Link
            to="/admin/categories"
            style={subLinkStyle(isActivePath('/admin/categories'))}
          >
            หมวดหมู่
          </Link>

          <div style={groupTitleStyle}>บุคลากร</div>
          <Link to="/admin/personnel/staff" style={subLinkStyle(isActivePath('/admin/personnel/staff'))}>พนักงาน</Link>
          <Link to="/admin/personnel/drivers" style={subLinkStyle(isActivePath('/admin/personnel/drivers'))}>คนขับ</Link>

          <div style={groupTitleStyle}>ตั้งค่าร้าน</div>
          <Link to="/admin/store-settings/store" style={subLinkStyle(isActivePath('/admin/store-settings/store'))}>ข้อมูลร้าน</Link>
          <Link to="/admin/store-settings/location" style={subLinkStyle(isActivePath('/admin/store-settings/location'))}>พิกัดร้าน</Link>
          <Link to="/admin/store-settings/payment" style={subLinkStyle(isActivePath('/admin/store-settings/payment'))}>PromptPay</Link>
          <Link to="/admin/store-settings/hours" style={subLinkStyle(isActivePath('/admin/store-settings/hours'))}>เวลาทำการ</Link>

          <div style={groupTitleStyle}>จัดการสต็อก</div>
          <Link to="/admin/inventory/overview" style={subLinkStyle(isActivePath('/admin/inventory/overview'))}>ภาพรวม</Link>
          <Link to="/admin/inventory/adjustments" style={subLinkStyle(isActivePath('/admin/inventory/adjustments'))}>ปรับสต็อก</Link>
          <Link to="/admin/inventory/suppliers" style={subLinkStyle(isActivePath('/admin/inventory/suppliers'))}>ผู้จำหน่าย</Link>
          <Link to="/admin/inventory/purchase-orders" style={subLinkStyle(isActivePath('/admin/inventory/purchase-orders'))}>ใบสั่งซื้อ (PO)</Link>
          <Link to="/admin/inventory/movements" style={subLinkStyle(isActivePath('/admin/inventory/movements'))}>ประวัติสต็อก</Link>

          {showAuditLog ? (
            <Link
              to="/admin/audit-log"
              style={subLinkStyle(isActivePath('/admin/audit-log'))}
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

