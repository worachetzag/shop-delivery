import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useResponsive } from '../hooks/useResponsive';
import config from '../config';
import './Header.css';

const Header = ({ hideCustomerTopBar = false, hideDriverTopBar = false }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const location = useLocation();
  const { isMobile, isTablet } = useResponsive();

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = localStorage.getItem('auth_token');
      const role = localStorage.getItem('user_role') || '';
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
          const username = localStorage.getItem('username') || 'คนขับ';
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

  const handleLogout = async () => {
    const role = localStorage.getItem('user_role') || '';
    try {
      await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error logging out:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('username');
      setIsLoggedIn(false);
      setUserProfile(null);
      window.location.href = role === 'driver' ? '/driver/login' : '/customer/login';
    }
  };

  const isMobileView = isMobile || isTablet;
  const isActive = (path) => location.pathname === path;
  const isActiveGroup = (paths) => paths.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
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
                  <Link to="/customer" className={isActive('/customer') ? 'active' : ''}>หน้าแรก</Link>
                  <Link to="/customer/products" className={isActive('/customer/products') ? 'active' : ''}>สินค้า</Link>
                  <Link to="/customer/orders" className={isActive('/customer/orders') ? 'active' : ''}>คำสั่งซื้อ</Link>
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

      <nav className={`liff-bottom-nav ${!isDriverMode ? 'force-show' : ''}${isDriverMode ? ' liff-bottom-nav--driver' : ''}`}>
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
              <Link to="/customer" className={isActive('/customer') ? 'active' : ''}>
                <span>หน้าแรก</span>
              </Link>
              <Link to="/customer/products" className={isActive('/customer/products') ? 'active' : ''}>
                <span>สินค้า</span>
              </Link>
              <Link to="/customer/cart" className={isActive('/customer/cart') ? 'active' : ''}>
                <span>ตะกร้า</span>
              </Link>
              <Link to="/customer/orders" className={isActiveGroup(['/customer/orders', '/customer/tracking']) ? 'active' : ''}>
                <span>ออเดอร์</span>
              </Link>
              <Link to={isLoggedIn ? '/customer/profile' : '/customer/login'} className={isActiveGroup(['/customer/profile', '/customer/login']) ? 'active' : ''}>
                <span>{isLoggedIn ? 'โปรไฟล์' : 'ล็อกอิน'}</span>
              </Link>
            </>
          )}
      </nav>
    </header>
  );
};

export default Header;
