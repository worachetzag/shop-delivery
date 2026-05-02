import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import config from '../config';
import {
  DRIVER_ROLE_KEY,
  DRIVER_TOKEN_KEY,
  clearDriverSession,
  getDriverRole,
  getDriverToken,
} from '../utils/driverAuth';

const ADMIN_ROLES = ['admin', 'store_admin', 'super_admin'];
const DRIVER_ROLES = ['driver'];

const ProtectedRoute = ({ children, requireAdmin = false, requireDriver = false, redirectTo = '/customer/login' }) => {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  useEffect(() => {
    const verifyAuth = async () => {
      const urlParams = new URLSearchParams(location.search);
      const tokenFromUrl = urlParams.get('token');
      const adminToken = localStorage.getItem('admin_token');
      let existingToken;
      if (requireAdmin) {
        existingToken = adminToken || localStorage.getItem('auth_token');
      } else if (requireDriver) {
        existingToken = getDriverToken();
      } else {
        existingToken = localStorage.getItem('auth_token');
      }
      let token = existingToken || tokenFromUrl;

      if (!token) {
        setIsAuthenticated(false);
        setNeedsProfileCompletion(false);
        setIsChecking(false);
        return;
      }

      if (!existingToken && tokenFromUrl) {
        if (requireAdmin) {
          localStorage.setItem('admin_token', tokenFromUrl);
        } else if (requireDriver) {
          sessionStorage.setItem(DRIVER_TOKEN_KEY, tokenFromUrl);
          sessionStorage.setItem(DRIVER_ROLE_KEY, 'driver');
        } else {
          localStorage.setItem('auth_token', tokenFromUrl);
        }
      }

      try {
        const userRoleLs = localStorage.getItem('user_role') || '';
        const userRoleDriver = getDriverRole();
        if (
          !requireAdmin &&
          !requireDriver &&
          (DRIVER_ROLES.includes(userRoleLs) || DRIVER_ROLES.includes(userRoleDriver))
        ) {
          // Driver should not access customer-only protected pages.
          setIsAuthenticated(true);
          setNeedsProfileCompletion(false);
          setIsChecking(false);
          return;
        }

        let response;
        if (requireAdmin) {
          const userRole = localStorage.getItem('user_role');
          if (!ADMIN_ROLES.includes(userRole || '')) {
            setIsAuthenticated(false);
            setNeedsProfileCompletion(false);
            setIsChecking(false);
            return;
          }

          // Validate admin token with admin-only endpoint.
          response = await fetch(`${config.API_BASE_URL}products/admin/`, {
            method: 'GET',
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            credentials: 'include',
          });
        } else if (requireDriver) {
          const userRole = getDriverRole();
          if (!DRIVER_ROLES.includes(userRole || '')) {
            setIsAuthenticated(false);
            setNeedsProfileCompletion(false);
            setIsChecking(false);
            return;
          }

          // Validate driver token with driver assignments endpoint.
          response = await fetch(`${config.API_BASE_URL}orders/driver/assignments/`, {
            method: 'GET',
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            credentials: 'include',
          });
        } else {
          // Validate customer token with profile endpoint (เสถียรกว่า cart flow)
          response = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
            method: 'GET',
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            credentials: 'include',
          });
        }

        if (!response.ok) {
          if (requireAdmin) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('username');
          } else if (requireDriver) {
            clearDriverSession();
          } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('username');
          }
          setIsAuthenticated(false);
          setNeedsProfileCompletion(false);
          setIsChecking(false);
          return;
        }

        let incomplete = false;
        if (!requireAdmin && !requireDriver && !DRIVER_ROLES.includes(localStorage.getItem('user_role') || '')) {
          try {
            const profilePayload = await response.json();
            incomplete = profilePayload && profilePayload.profile_completed === false;
          } catch {
            incomplete = false;
          }
        }
        setNeedsProfileCompletion(Boolean(incomplete));
        setIsAuthenticated(true);
      } catch (error) {
        if (requireAdmin) {
          localStorage.removeItem('admin_token');
        } else if (requireDriver) {
          clearDriverSession();
        } else {
          localStorage.removeItem('auth_token');
        }
        if (!requireDriver) {
          localStorage.removeItem('user_role');
          localStorage.removeItem('username');
        }
        setIsAuthenticated(false);
        setNeedsProfileCompletion(false);
      } finally {
        setIsChecking(false);
      }
    };

    verifyAuth();
  }, [location.search, location.pathname, requireAdmin, requireDriver]);

  if (isChecking) {
    return null;
  }

  if (!isAuthenticated) {
    const withNext =
      !requireAdmin && !requireDriver
        ? `${redirectTo}${redirectTo.includes('?') ? '&' : '?'}next=${encodeURIComponent(`${location.pathname}${location.search}`)}`
        : redirectTo;
    return <Navigate to={withNext} replace state={{ from: location }} />;
  }

  const userRole =
    requireDriver ? getDriverRole() : localStorage.getItem('user_role');
  /** ตรวจผ่าน accounts/api-profile/ แล้ว — ถ้ายังไม่ครบให้จับอยู่หน้าโปรไฟล์ (ไม่พึ่ง user_role เพราะบางเซสชันอาจว่าง) */
  if (
    needsProfileCompletion
    && !requireAdmin
    && !requireDriver
    && location.pathname !== '/customer/profile'
  ) {
    return (
      <Navigate
        to="/customer/profile?section=personal&complete=required"
        replace
        state={{ from: location }}
      />
    );
  }

  const lsRole = localStorage.getItem('user_role') || '';
  if (
    !requireAdmin &&
    !requireDriver &&
    (DRIVER_ROLES.includes(lsRole) || DRIVER_ROLES.includes(getDriverRole()))
  ) {
    return <Navigate to="/driver/dashboard" replace state={{ from: location }} />;
  }
  if (!requireAdmin && !requireDriver && ADMIN_ROLES.includes(lsRole)) {
    return <Navigate to="/admin/orders" replace state={{ from: location }} />;
  }
  if (requireAdmin && !ADMIN_ROLES.includes(lsRole || '')) {
    if (DRIVER_ROLES.includes(getDriverRole())) {
      return <Navigate to="/driver/dashboard" replace state={{ from: location }} />;
    }
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  if (requireDriver && !DRIVER_ROLES.includes(userRole || '')) {
    return <Navigate to="/driver/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
