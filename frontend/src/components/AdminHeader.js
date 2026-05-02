import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import config from '../config';
import { popupNotify } from './PopupProvider';
import './AdminHeader.css';

const COMPACT_MEDIA = '(max-width: 1024px)';
/** โพลสถานะออเดอร์ฝั่งแอดมิน — ใกล้เรียลไทม์โดยไม่ต้อง WebSocket */
const ADMIN_ORDER_ALERT_POLL_MS = 14000;

function navLinkClass(active) {
  return active ? 'admin-nav-link admin-nav-link--active' : 'admin-nav-link';
}

function OrdersNavLink({ isActivePath, pendingOrders, slipsAwaiting }) {
  const urgent = Number(pendingOrders || 0) + Number(slipsAwaiting || 0);
  const badge =
    urgent > 0 ? (
      <span className="admin-nav-badge" aria-hidden>
        {urgent > 99 ? '99+' : urgent}
      </span>
    ) : null;
  return (
    <Link
      to="/admin/orders"
      className={`${navLinkClass(isActivePath('/admin/orders'))} admin-nav-link--with-badge`.trim()}
    >
      <span className="admin-nav-link__label">คำสั่งซื้อ</span>
      {badge}
    </Link>
  );
}

function AdminNavSections({
  isActivePath,
  openGroup,
  toggleGroup,
  showAuditLog,
  pendingOrders,
  slipsAwaiting,
}) {
  return (
    <>
      <Link to="/admin/dashboard" className={navLinkClass(isActivePath('/admin/dashboard'))}>
        ภาพรวม
      </Link>
      <OrdersNavLink
        isActivePath={isActivePath}
        pendingOrders={pendingOrders}
        slipsAwaiting={slipsAwaiting}
      />
      <Link to="/admin/products" className={navLinkClass(isActivePath('/admin/products'))}>
        สินค้า
      </Link>
      <Link to="/admin/categories" className={navLinkClass(isActivePath('/admin/categories'))}>
        หมวดหมู่
      </Link>
      <Link to="/admin/home-promotions" className={navLinkClass(isActivePath('/admin/home-promotions'))}>
        โปรหน้าแรก
      </Link>
      <Link to="/admin/customers" className={navLinkClass(isActivePath('/admin/customers'))}>
        ลูกค้า
      </Link>

      <div className="admin-nav-section-label">บุคลากร</div>
      <div>
        <button
          type="button"
          className={`admin-nav-group-btn${openGroup === 'personnel' ? ' admin-nav-group-btn--open' : ''}`}
          onClick={() => toggleGroup('personnel')}
        >
          บุคลากร {openGroup === 'personnel' ? '▾' : '▸'}
        </button>
        {openGroup === 'personnel' && (
          <div className="admin-nav-submenu">
            <Link to="/admin/personnel/staff" className={navLinkClass(isActivePath('/admin/personnel/staff'))}>พนักงาน</Link>
            <Link to="/admin/personnel/drivers" className={navLinkClass(isActivePath('/admin/personnel/drivers'))}>คนขับ</Link>
          </div>
        )}
      </div>

      <div className="admin-nav-section-label">ตั้งค่าร้าน</div>
      <div>
        <button
          type="button"
          className={`admin-nav-group-btn${openGroup === 'store' ? ' admin-nav-group-btn--open' : ''}`}
          onClick={() => toggleGroup('store')}
        >
          ตั้งค่าร้าน {openGroup === 'store' ? '▾' : '▸'}
        </button>
        {openGroup === 'store' && (
          <div className="admin-nav-submenu">
            <Link to="/admin/store-settings/store" className={navLinkClass(isActivePath('/admin/store-settings/store'))}>ข้อมูลร้าน</Link>
            <Link to="/admin/store-settings/payment" className={navLinkClass(isActivePath('/admin/store-settings/payment'))}>PromptPay</Link>
            <Link to="/admin/store-settings/delivery-fees" className={navLinkClass(isActivePath('/admin/store-settings/delivery-fees'))}>ค่าส่งตามระยะทาง</Link>
            <Link to="/admin/store-settings/hours" className={navLinkClass(isActivePath('/admin/store-settings/hours'))}>เวลาทำการ</Link>
          </div>
        )}
      </div>

      <div className="admin-nav-section-label">จัดการสต็อก</div>
      <div>
        <button
          type="button"
          className={`admin-nav-group-btn${openGroup === 'inventory' ? ' admin-nav-group-btn--open' : ''}`}
          onClick={() => toggleGroup('inventory')}
        >
          จัดการสต็อก {openGroup === 'inventory' ? '▾' : '▸'}
        </button>
        {openGroup === 'inventory' && (
          <div className="admin-nav-submenu">
            <Link to="/admin/inventory/overview" className={navLinkClass(isActivePath('/admin/inventory/overview'))}>ภาพรวม</Link>
            <Link to="/admin/inventory/adjustments" className={navLinkClass(isActivePath('/admin/inventory/adjustments'))}>ปรับสต็อก</Link>
            <Link to="/admin/inventory/suppliers" className={navLinkClass(isActivePath('/admin/inventory/suppliers'))}>ผู้จำหน่าย</Link>
            <Link to="/admin/inventory/purchase-orders" className={navLinkClass(isActivePath('/admin/inventory/purchase-orders'))}>ใบสั่งซื้อ (PO)</Link>
            <Link to="/admin/inventory/movements" className={navLinkClass(isActivePath('/admin/inventory/movements'))}>ประวัติสต็อก</Link>
          </div>
        )}
      </div>

      {showAuditLog ? (
        <Link to="/admin/audit-log" className={navLinkClass(isActivePath('/admin/audit-log'))}>
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
  const [pendingOrders, setPendingOrders] = useState(0);
  const [slipsAwaiting, setSlipsAwaiting] = useState(0);
  const statsBaselineRef = useRef(false);
  const prevPendingRef = useRef(null);
  const prevSlipsRef = useRef(null);
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

  /** โพลคำสั่งซื้อรอดำเนินการ + สลิปรอตรวจ — แจ้ง toast เมื่อตัวเลขเพิ่มขึ้น */
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const onAdminApp =
      location.pathname.startsWith('/admin') && !location.pathname.startsWith('/admin/login');
    if (!token || !onAdminApp) {
      statsBaselineRef.current = false;
      prevPendingRef.current = null;
      prevSlipsRef.current = null;
      return undefined;
    }

    let cancelled = false;

    const fetchStats = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const response = await fetch(`${config.API_BASE_URL}orders/admin/stats/`, {
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!response.ok || cancelled) return;
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        const nextPending = Number(data.pending_orders || 0);
        const nextSlips = Number(data.slips_awaiting_review || 0);
        setPendingOrders(nextPending);
        setSlipsAwaiting(nextSlips);

        if (!statsBaselineRef.current) {
          statsBaselineRef.current = true;
          prevPendingRef.current = nextPending;
          prevSlipsRef.current = nextSlips;
          return;
        }

        const prevP = prevPendingRef.current ?? nextPending;
        const prevS = prevSlipsRef.current ?? nextSlips;
        const deltaP = nextPending - prevP;
        const deltaS = nextSlips - prevS;

        if (deltaP > 0 || deltaS > 0) {
          const parts = [];
          if (deltaP > 0) {
            parts.push(`มีคำสั่งซื้อใหม่ ${deltaP} รายการ (รอดำเนินการ)`);
          }
          if (deltaS > 0) {
            parts.push(`มีสลิปโอนเงินรอตรวจ ${deltaS} รายการ`);
          }
          popupNotify(parts.join(' · '), { type: 'info', duration: 6500 });
        }

        prevPendingRef.current = nextPending;
        prevSlipsRef.current = nextSlips;
      } catch {
        /* ignore */
      }
    };

    fetchStats();
    const id = window.setInterval(fetchStats, ADMIN_ORDER_ALERT_POLL_MS);
    const onVis = () => {
      if (!document.hidden) fetchStats();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
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

  const navProps = useMemo(() => ({
    isActivePath,
    openGroup,
    toggleGroup,
    showAuditLog,
    pendingOrders,
    slipsAwaiting,
  }), [
    isActivePath,
    openGroup,
    toggleGroup,
    showAuditLog,
    pendingOrders,
    slipsAwaiting,
  ]);

  const ordersAttentionCount = pendingOrders + slipsAwaiting;

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
              className={`admin-header__menu-btn${ordersAttentionCount > 0 ? ' admin-header__menu-btn--attention' : ''}`}
              aria-expanded={menuOpen}
              aria-controls="admin-nav-drawer"
              aria-label={
                menuOpen
                  ? 'ปิดเมนู'
                  : ordersAttentionCount > 0
                    ? `เปิดเมนู — มีคำสั่งซื้อ/สลิปรอดำเนินการรวม ${ordersAttentionCount} รายการ`
                    : 'เปิดเมนู'
              }
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="admin-header__menu-icon" aria-hidden>{menuOpen ? '✕' : '☰'}</span>
            </button>
            <Link to="/admin/dashboard" className="admin-header__brand-compact">
              <h1 className="admin-header__brand-title-compact">{config.BRANDING.storeName}</h1>
            </Link>
            <button type="button" className="admin-header__logout-compact" onClick={handleLogout}>
              ออกจากระบบ
            </button>
          </div>
        ) : (
          <div className="admin-header__shell">
            <Link to="/admin/dashboard" className="admin-header__brand-desktop">
              <h1>แดชบอร์ดแอดมิน · {config.BRANDING.storeName}</h1>
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
