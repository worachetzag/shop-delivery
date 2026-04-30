import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LineLoginButton, { redirectToShopLineOAuth } from '../components/LineLoginButton';
import config from '../config';
import CustomerInlineBack from '../components/CustomerInlineBack';
import './Login.css';

function getGlobalLiff() {
  if (typeof window === 'undefined') return null;
  return window.liff || null;
}

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const res = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            credentials: 'include',
          });
          if (cancelled) return;
          if (res.ok) {
            navigate('/customer', { replace: true });
            return;
          }
          // token ค้าง/หมดอายุ: ล้างเพื่อไม่ให้ติดลูปเข้า-ออกหน้า login
          localStorage.removeItem('auth_token');
          localStorage.removeItem('username');
          localStorage.removeItem('user_role');
        }

        const liff = getGlobalLiff();
        if (!liff) throw new Error('LIFF SDK not loaded');
        await liff.init({ liffId: config.LIFF_ID });
        if (cancelled) return;
        if (liff.isInClient() && liff.isLoggedIn()) {
          redirectToShopLineOAuth();
        }
      } catch {
        /* ไม่ได้อยู่ใน LINE / LIFF ไม่พร้อม — แสดงปุ่มตามปกติ */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="login-page">
      <div className="container">
        <CustomerInlineBack />
        <div className="login-card">
          <h2>เข้าสู่ระบบ</h2>
          <p className="login-subtitle">
            ใช้บัญชี LINE เพื่อเข้าใช้งานแอปลูกค้า (ไม่ใช่รหัสผ่านของเว็บร้าน)
          </p>
          <p className="login-browser-hint">
            ถ้าเปิดจาก Safari หรือ Chrome แล้วเห็นหน้าอีเมลของ LINE — นั่นคือการเข้าบัญชี LINE ในเบราว์เซอร์
            แนะนำให้แตะ <strong>เข้าสู่ระบบด้วยแอป LINE</strong> ด้านล่างของหน้านั้น
            หรือเปิดลิงก์ร้านจากแชทใน LINE เพื่อให้เข้าผ่านแอป LINE โดยตรง
          </p>
          <div className="login-action">
            <LineLoginButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;



