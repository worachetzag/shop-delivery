import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import config from '../config';

const ADMIN_ROLES = ['admin', 'store_admin', 'super_admin'];
const DRIVER_ROLES = ['driver'];

const ProtectedRoute = ({ children, requireAdmin = false, requireDriver = false, redirectTo = '/customer/login' }) => {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const verifyAuth = async () => {
      const urlParams = new URLSearchParams(location.search);
      const tokenFromUrl = urlParams.get('token');
      const adminToken = localStorage.getItem('admin_token');
      const existingToken = requireAdmin ? (adminToken || localStorage.getItem('auth_token')) : localStorage.getItem('auth_token');
      const token = existingToken || tokenFromUrl;

      if (!token) {
        setIsAuthenticated(false);
        setIsChecking(false);
        return;
      }

      if (!existingToken && tokenFromUrl) {
        if (requireAdmin) {
          localStorage.setItem('admin_token', tokenFromUrl);
        } else {
          localStorage.setItem('auth_token', tokenFromUrl);
        }
      }

      try {
        const userRole = localStorage.getItem('user_role') || '';
        if (!requireAdmin && !requireDriver && DRIVER_ROLES.includes(userRole)) {
          // Driver should not access customer-only protected pages.
          setIsAuthenticated(true);
          setIsChecking(false);
          return;
        }

        let response;
        if (requireAdmin) {
          const userRole = localStorage.getItem('user_role');
          if (!ADMIN_ROLES.includes(userRole || '')) {
            setIsAuthenticated(false);
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
          const userRole = localStorage.getItem('user_role');
          if (!DRIVER_ROLES.includes(userRole || '')) {
            setIsAuthenticated(false);
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
          // Validate customer token with authenticated cart endpoint.
          response = await fetch(`${config.API_BASE_URL}orders/cart/`, {
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
          } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('username');
          }
          setIsAuthenticated(false);
          setIsChecking(false);
          return;
        }

        setIsAuthenticated(true);
      } catch (error) {
        if (requireAdmin) {
          localStorage.removeItem('admin_token');
        } else {
          localStorage.removeItem('auth_token');
        }
        localStorage.removeItem('user_role');
        localStorage.removeItem('username');
        setIsAuthenticated(false);
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
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  const userRole = localStorage.getItem('user_role');
  if (!requireAdmin && !requireDriver && DRIVER_ROLES.includes(userRole || '')) {
    return <Navigate to="/driver/dashboard" replace state={{ from: location }} />;
  }
  if (!requireAdmin && !requireDriver && ADMIN_ROLES.includes(userRole || '')) {
    return <Navigate to="/admin/orders" replace state={{ from: location }} />;
  }
  if (requireAdmin && !ADMIN_ROLES.includes(userRole || '')) {
    if (DRIVER_ROLES.includes(userRole || '')) {
      return <Navigate to="/driver/dashboard" replace state={{ from: location }} />;
    }
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }
  if (requireDriver && !DRIVER_ROLES.includes(userRole || '')) {
    if (ADMIN_ROLES.includes(userRole || '')) {
      return <Navigate to="/admin/orders" replace state={{ from: location }} />;
    }
    return <Navigate to="/driver/login" replace state={{ from: location }} />;
  }

  return children;
};

export default ProtectedRoute;
