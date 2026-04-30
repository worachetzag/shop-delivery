import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import config from '../config';
import './AdminHeader.css';

const COMPACT_MEDIA = '(max-width: 1024px)';

function AdminNavSections({
  isActivePath,
  openGroup,
  toggleGroup,
  showAuditLog,
  subLinkStyle,
  groupTitleStyle,
  groupButtonStyle,
  submenuWrapStyle,
}) {
  return (
    <>
      <Link to="/admin/dashboard" style={subLinkStyle(isActivePath('/admin/dashboard'))}>
        ภาพรวม
      </Link>
      <Link to="/admin/orders" style={subLinkStyle(isActivePath('/admin/orders'))}>
        คำสั่งซื้อ
      </Link>
      <Link to="/admin/products" style={subLinkStyle(isActivePath('/admin/products'))}>
        สินค้า
      </Link>
      <Link to="/admin/categories" style={subLinkStyle(isActivePath('/admin/categories'))}>
        หมวดหมู่
      </Link>

      <div style={groupTitleStyle}>บุคลากร</div>
      <div>
        <button
          type="button"
          style={groupButtonStyle(openGroup === 'personnel')}
          onClick={() => toggleGroup('personnel')}
        >
          บุคลากร {openGroup === 'personnel' ? '▾' : '▸'}
        </button>
        {openGroup === 'personnel' && (
          <div style={submenuWrapStyle}>
            <Link to="/admin/personnel/staff" style={subLinkStyle(isActivePath('/admin/personnel/staff'))}>พนักงาน</Link>
            <Link to="/admin/personnel/drivers" style={subLinkStyle(isActivePath('/admin/personnel/drivers'))}>คนขับ</Link>
          </div>
        )}
      </div>

      <div style={groupTitleStyle}>ตั้งค่าร้าน</div>
      <div>
        <button
          type="button"
          style={groupButtonStyle(openGroup === 'store')}
          onClick={() => toggleGroup('store')}
        >
          ตั้งค่าร้าน {openGroup === 'store' ? '▾' : '▸'}
        </button>
        {openGroup === 'store' && (
          <div style={submenuWrapStyle}>
            <Link to="/admin/store-settings/store" style={subLinkStyle(isActivePath('/admin/store-settings/store'))}>ข้อมูลร้าน</Link>
            <Link to="/admin/store-settings/location" style={subLinkStyle(isActivePath('/admin/store-settings/location'))}>พิกัดร้าน</Link>
            <Link to="/admin/store-settings/payment" style={subLinkStyle(isActivePath('/admin/store-settings/payment'))}>PromptPay</Link>
            <Link to="/admin/store-settings/delivery-fees" style={subLinkStyle(isActivePath('/admin/store-settings/delivery-fees'))}>ค่าส่งตามระยะทาง</Link>
            <Link to="/admin/store-settings/hours" style={subLinkStyle(isActivePath('/admin/store-settings/hours'))}>เวลาทำการ</Link>
          </div>
        )}
      </div>

      <div style={groupTitleStyle}>จัดการสต็อก</div>
      <div>
        <button
          type="button"
          style={groupButtonStyle(openGroup === 'inventory')}
          onClick={() => toggleGroup('inventory')}
        >
          จัดการสต็อก {openGroup === 'inventory' ? '▾' : '▸'}
        </button>
        {openGroup === 'inventory' && (
          <div style={submenuWrapStyle}>
            <Link to="/admin/inventory/overview" style={subLinkStyle(isActivePath('/admin/inventory/overview'))}>ภาพรวม</Link>
            <Link to="/admin/inventory/adjustments" style={subLinkStyle(isActivePath('/admin/inventory/adjustments'))}>ปรับสต็อก</Link>
            <Link to="/admin/inventory/suppliers" style={subLinkStyle(isActivePath('/admin/inventory/suppliers'))}>ผู้จำหน่าย</Link>
            <Link to="/admin/inventory/purchase-orders" style={subLinkStyle(isActivePath('/admin/inventory/purchase-orders'))}>ใบสั่งซื้อ (PO)</Link>
            <Link to="/admin/inventory/movements" style={subLinkStyle(isActivePath('/admin/inventory/movements'))}>ประวัติสต็อก</Link>
          </div>
        )}
      </div>

      {showAuditLog ? (
        <Link to="/admin/audit-log" style={subLinkStyle(isActivePath('/admin/audit-log'))}>
          ประวัติพนักงาน
        </Link>
      ) : null}
    </>
  );
}

const AdminHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [username] = useState(localStorage.getItem('username') || 'Admin');
  const [isCompact, setIsCompact] = useState(
    typeof window !== 'undefined' ? window.matchMedia(COMPACT_MEDIA).matches : false,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);

  const showAuditLog = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const role = localStorage.getItem('user_role') || '';
    if (localStorage.getItem('admin_can_view_audit') === '1') return true;
    return ['super_admin', 'admin'].includes(role);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(COMPACT_MEDIA);
    const apply = () => setIsCompact(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith('/admin/personnel')) {
      setOpenGroup('personnel');
      return;
    }
    if (location.pathname.startsWith('/admin/store-settings')) {
      setOpenGroup('store');
      return;
    }
    if (location.pathname.startsWith('/admin/inventory')) {
      setOpenGroup('inventory');
      return;
    }
    setOpenGroup(null);
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen || !isCompact) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, isCompact]);

  useEffect(() => {
    if (!menuOpen || !isCompact) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, isCompact]);

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

  const isActivePath = useCallback(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname],
  );

  const toggleGroup = useCallback((name) => {
    setOpenGroup((prev) => (prev === name ? null : name));
  }, []);

  const groupTitleStyle = useMemo(() => ({
    fontSize: '0.72rem',
    opacity: 0.85,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    margin: '6px 0 2px',
    padding: '0 2px',
  }), []);

  const subLinkStyle = useCallback((active) => ({
    color: 'white',
    textDecoration: 'none',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '0.92rem',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    background: active ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.08)',
    touchAction: 'manipulation',
  }), []);

  const groupButtonStyle = useCallback((active) => ({
    color: 'white',
    textDecoration: 'none',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '0.92rem',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    minHeight: '44px',
    touchAction: 'manipulation',
    background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
  }), []);

  const submenuWrapStyle = useMemo(() => ({
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 6,
    paddingLeft: 12,
    borderLeft: '2px solid rgba(255,255,255,0.18)',
  }), []);

  const navProps = useMemo(() => ({
    isActivePath,
    openGroup,
    toggleGroup,
    showAuditLog,
    subLinkStyle,
    groupTitleStyle,
    groupButtonStyle,
    submenuWrapStyle,
  }), [
    isActivePath,
    openGroup,
    toggleGroup,
    showAuditLog,
    subLinkStyle,
    groupTitleStyle,
    groupButtonStyle,
    submenuWrapStyle,
  ]);

  const closeDrawer = useCallback(() => setMenuOpen(false), []);

  const desktopLogoutBtn = (
    <button type="button" className="admin-header__logout-full" onClick={handleLogout}>
      ออกจากระบบ
    </button>
  );

  return (
    <>
      <header
        className={`admin-header ${isCompact ? 'admin-header--compact' : 'admin-header--desktop'}`}
      >
        {isCompact ? (
          <div className="admin-header__topbar">
            <button
              type="button"
              className="admin-header__menu-btn"
              aria-expanded={menuOpen}
              aria-controls="admin-nav-drawer"
              aria-label={menuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="admin-header__menu-icon" aria-hidden>{menuOpen ? '✕' : '☰'}</span>
            </button>
            <Link to="/admin/dashboard" className="admin-header__brand-compact">
              <h1 className="admin-header__brand-title-compact">👨‍💼 Admin</h1>
            </Link>
            <button type="button" className="admin-header__logout-compact" onClick={handleLogout}>
              ออกจากระบบ
            </button>
          </div>
        ) : (
          <div className="admin-header__shell">
            <Link to="/admin/dashboard" className="admin-header__brand-desktop">
              <h1>👨‍💼 Admin Dashboard</h1>
            </Link>
            <nav className="admin-header__nav" aria-label="เมนูหลักแอดมิน">
              <AdminNavSections {...navProps} />
              <div className="admin-header__user-row">
                {username}
              </div>
            </nav>
            <div className="admin-header__logout-wrap">
              {desktopLogoutBtn}
            </div>
          </div>
        )}
      </header>

      {isCompact && menuOpen ? (
        <>
          <div
            className="admin-header__backdrop"
            aria-hidden="true"
            onClick={closeDrawer}
          />
          <aside
            id="admin-nav-drawer"
            className="admin-header__drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label="เมนูจัดการแอดมิน"
          >
            <div className="admin-header__drawer-head">
              <button
                type="button"
                className="admin-header__drawer-close"
                aria-label="ปิดเมนู"
                onClick={closeDrawer}
              >
                ✕
              </button>
              <p className="admin-header__drawer-brand">เมนูแอดมิน</p>
            </div>
            <div
              className="admin-header__drawer-scroll"
              onClick={(e) => {
                if (e.target.closest('a[href]')) closeDrawer();
              }}
            >
              <nav className="admin-header__nav" aria-label="เมนูหลักแอดมิน">
                <AdminNavSections {...navProps} />
                <div className="admin-header__user-row">{username}</div>
              </nav>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
};

export default AdminHeader;
