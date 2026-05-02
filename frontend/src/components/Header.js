import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import config from '../config';
import { popupNotify } from './PopupProvider';
import {
  BottomNavWatermarkCart,
  BottomNavWatermarkHome,
  BottomNavWatermarkLogin,
  BottomNavWatermarkOrders,
  BottomNavWatermarkProducts,
  BottomNavWatermarkProfile,
} from './CustomerBottomNavWatermarkIcons';
import { clearDriverSession, getDriverRole, getDriverToken } from '../utils/driverAuth';
import './Header.css';

/** โพลสรุปออเดอร์ลูกค้า — ป้ายเมนู + toast เฉพาะเมื่อมีงานติดตามเพิ่ม (ไม่แจ้งทุกครั้งที่ร้านเปลี่ยนสถานะ) */
const CUSTOMER_ORDER_ATTENTION_POLL_MS = 18000;

const Header = ({ hideCustomerTopBar = false, hideDriverTopBar = false }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [customerAttentionCount, setCustomerAttentionCount] = useState(0);
  const customerAttentionBaselineRef = useRef(false);
  const prevCustomerAttentionCountRef = useRef(null);
  const location = useLocation();
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    const checkLoginStatus = async () => {
      const driverMode = location.pathname.startsWith('/driver');
      const token = driverMode ? getDriverToken() : localStorage.getItem('auth_token');
      const role = driverMode ? getDriverRole() : localStorage.getItem('user_role') || '';
      if (!token) {
        setIsLoggedIn(false);
        setUserProfile(null);
        return;
      }
      try {
        const authCheckUrl = role === 'driver'
          ? `${config.API_BASE_URL}orders/driver/assignments/`
          : `${config.API_BASE_URL}orders/cart/`;

        const authResponse = await fetch(authCheckUrl, {
          credentials: 'include',
          headers: {
            Authorization: `Token ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!authResponse.ok) {
          setIsLoggedIn(false);
          setUserProfile(null);
          return;
        }

        if (role === 'driver') {
          const username =
            (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('driver_username')) ||
            localStorage.getItem('username') ||
            'คนขับ';
          setIsLoggedIn(true);
          setUserProfile({
            displayName: username,
            pictureUrl: null,
          });
          return;
        }

        const profileResponse = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
          credentials: 'include',
          headers: {
            Authorization: `Token ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        const data = profileResponse.ok ? await profileResponse.json() : {};
        const userInfo = data.user_info || {};

        setIsLoggedIn(true);
        setUserProfile({
          displayName: [userInfo.first_name, userInfo.last_name].filter(Boolean).join(' ').trim() || userInfo.username || 'ผู้ใช้',
          pictureUrl: data.picture_url,
        });
      } catch (error) {
        console.error('Error checking login status:', error);
        setIsLoggedIn(false);
        setUserProfile(null);
      }
    };

    checkLoginStatus();
  }, [location.pathname, location.search]);

  useEffect(() => {
    const driverMode = location.pathname.startsWith('/driver');
    const customerZone = location.pathname.startsWith('/customer');
    const token = localStorage.getItem('auth_token');
    if (
      driverMode
      || !customerZone
      || !token
      || location.pathname.startsWith('/customer/login')
    ) {
      customerAttentionBaselineRef.current = false;
      prevCustomerAttentionCountRef.current = null;
      setCustomerAttentionCount(0);
      return undefined;
    }

    let cancelled = false;

    const pollAttention = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch(`${config.API_BASE_URL}orders/customer/attention-summary/`, {
          credentials: 'include',
          headers: {
            Authorization: `Token ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        if (cancelled) return;
        if (res.status === 403) {
          setCustomerAttentionCount(0);
          return;
        }
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const cnt = Number(data.attention_count || 0);
        setCustomerAttentionCount(cnt);

        if (!customerAttentionBaselineRef.current) {
          customerAttentionBaselineRef.current = true;
          prevCustomerAttentionCountRef.current = cnt;
          return;
        }

        const prevCnt = prevCustomerAttentionCountRef.current ?? cnt;
        const onCheckout = location.pathname.startsWith('/customer/checkout');
        if (!onCheckout && cnt > prevCnt) {
          popupNotify(`มีคำสั่งซื้อที่ติดตามเพิ่ม ${cnt - prevCnt} รายการ`, {
            type: 'info',
            duration: 5200,
          });
        }
        prevCustomerAttentionCountRef.current = cnt;
      } catch {
        /* ignore */
      }
    };

    pollAttention();
    const intervalId = window.setInterval(pollAttention, CUSTOMER_ORDER_ATTENTION_POLL_MS);
    const onVisibility = () => {
      if (!document.hidden) pollAttention();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    const driverMode = location.pathname.startsWith('/driver');
    const role = driverMode ? getDriverRole() : localStorage.getItem('user_role') || '';
    try {
      await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      if (driverMode || role === 'driver') {
        clearDriverSession();
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('username');
      }
      setIsLoggedIn(false);
      setUserProfile(null);
      window.location.href = driverMode || role === 'driver' ? '/driver/login' : '/customer/login';
    }
  };

  const isMobileView = isMobile || isTablet;
  const isActive = (path) => location.pathname === path;
  const isActiveGroup = (paths) => paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const isCustomerHomeActive =
    location.pathname === '/customer' || location.pathname === '/customer/';
  const isCustomerProductsActive =
    location.pathname === '/customer/products' || location.pathname.startsWith('/customer/products/');
  const isDriverMode = location.pathname.startsWith('/driver');
  const showTopMenu = !isMobileView && isDriverMode;
  const shouldHideTopBar =
    (hideCustomerTopBar && !isDriverMode) || (hideDriverTopBar && isDriverMode);

  return (
    <header className={`header${shouldHideTopBar ? ' header--topless' : ''}`}>
      {!shouldHideTopBar && (
        <div className="header-content">
          <Link to={isDriverMode ? '/driver/dashboard' : '/customer'} className="logo">
            <span className="logo-icon" aria-hidden="true">SP</span>
            <span className="logo-text">{config.BRANDING.storeName}</span>
          </Link>

          {showTopMenu && (
            <nav className="nav-menu">
              {isDriverMode ? (
                <Link to="/driver/dashboard" className={isActiveGroup(['/driver/dashboard', '/driver/assignments']) ? 'active' : ''}>งานของคนขับ</Link>
              ) : (
                <>
                  <Link to="/customer" className={isCustomerHomeActive ? 'active' : ''}>หน้าแรก</Link>
                  <Link to="/customer/products" className={isCustomerProductsActive ? 'active' : ''}>สินค้า</Link>
                  <Link
                    to="/customer/orders"
                    className={`${isActive('/customer/orders') ? 'active' : ''} nav-menu-link--badged`.trim()}
                    aria-label={
                      customerAttentionCount > 0
                        ? `คำสั่งซื้อ — ติดตาม ${customerAttentionCount} รายการ`
                        : 'คำสั่งซื้อ'
                    }
                  >
                    <span>คำสั่งซื้อ</span>
                    {customerAttentionCount > 0 ? (
                      <span className="customer-nav-menu-badge" aria-hidden>
                        {customerAttentionCount > 99 ? '99+' : customerAttentionCount}
                      </span>
                    ) : null}
                  </Link>
                  <Link to="/customer/orders" className={isActiveGroup(['/customer/tracking', '/customer/orders']) ? 'active' : ''}>ติดตาม</Link>
                </>
              )}
            </nav>
          )}

          <div className="user-info">
            {isLoggedIn ? (
              <>
                {!isMobileView && !isDriverMode && (
                  <Link to="/customer/cart" className="cart-link">ตะกร้า</Link>
                )}
                {isDriverMode ? (
                  !isMobileView && <span className="cart-link">โหมดคนขับ</span>
                ) : (
                  <Link to="/customer/profile" className="user-avatar">
                    {userProfile?.pictureUrl ? (
                      <img src={userProfile.pictureUrl} alt={userProfile.displayName} className="avatar-image" />
                    ) : (
                      <span>{userProfile?.displayName?.charAt(0) || 'U'}</span>
                    )}
                  </Link>
                )}
                {!isMobileView && (
                  <button onClick={handleLogout} className="logout-chip">ออก</button>
                )}
              </>
            ) : (
              <Link to="/customer/login" className="btn btn-outline">เข้าสู่ระบบ</Link>
            )}
          </div>
        </div>
      )}

      <nav
        className={`liff-bottom-nav ${!isDriverMode ? 'force-show liff-bottom-nav--customer' : ''}${isDriverMode ? ' liff-bottom-nav--driver' : ''}`}
      >
          {isDriverMode ? (
            <>
              <Link to="/driver/dashboard" className={isActiveGroup(['/driver/dashboard', '/driver/assignments']) ? 'active' : ''}>
                <span>🚚</span>
                <small>งานส่ง</small>
              </Link>
              {isLoggedIn ? (
                <button type="button" onClick={handleLogout} className="logout-chip">
                  ออก
                </button>
              ) : (
                <Link to="/driver/login" className={isActive('/driver/login') ? 'active' : ''}>
                  <span>🔐</span>
                  <small>ล็อกอิน</small>
                </Link>
              )}
            </>
          ) : (
            <>
              <Link to="/customer" className={isCustomerHomeActive ? 'active' : ''}>
                <span className="liff-bottom-nav-customer-icon" aria-hidden>
                  <BottomNavWatermarkHome />
                </span>
                <span className="liff-bottom-nav-customer-label">หน้าแรก</span>
              </Link>
              <Link to="/customer/products" className={isCustomerProductsActive ? 'active' : ''}>
                <span className="liff-bottom-nav-customer-icon" aria-hidden>
                  <BottomNavWatermarkProducts />
                </span>
                <span className="liff-bottom-nav-customer-label">สินค้า</span>
              </Link>
              <Link to="/customer/cart" className={isActive('/customer/cart') ? 'active' : ''}>
                <span className="liff-bottom-nav-customer-icon" aria-hidden>
                  <BottomNavWatermarkCart />
                </span>
                <span className="liff-bottom-nav-customer-label">ตะกร้า</span>
              </Link>
              <Link
                to="/customer/orders"
                className={isActiveGroup(['/customer/orders', '/customer/tracking']) ? 'active' : ''}
                aria-label={
                  customerAttentionCount > 0
                    ? `ออเดอร์ — มีคำสั่งซื้อที่ติดตาม ${customerAttentionCount} รายการ`
                    : 'ออเดอร์'
                }
              >
                <span className="liff-bottom-nav-customer-icon-wrap">
                  <span className="liff-bottom-nav-customer-icon" aria-hidden>
                    <BottomNavWatermarkOrders />
                  </span>
                  {customerAttentionCount > 0 ? (
                    <span className="customer-bottom-nav-badge" aria-hidden>
                      {customerAttentionCount > 99 ? '99+' : customerAttentionCount}
                    </span>
                  ) : null}
                </span>
                <span className="liff-bottom-nav-customer-label">ออเดอร์</span>
              </Link>
              <Link
                to={isLoggedIn ? '/customer/profile' : '/customer/login'}
                className={isActiveGroup(['/customer/profile', '/customer/login']) ? 'active' : ''}
              >
                <span className="liff-bottom-nav-customer-icon" aria-hidden>
                  {isLoggedIn ? <BottomNavWatermarkProfile /> : <BottomNavWatermarkLogin />}
                </span>
                <span className="liff-bottom-nav-customer-label">{isLoggedIn ? 'โปรไฟล์' : 'ล็อกอิน'}</span>
              </Link>
            </>
          )}
      </nav>
    </header>
  );
};

export default Header;
