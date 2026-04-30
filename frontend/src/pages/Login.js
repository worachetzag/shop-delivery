import React, { useEffect } from 'react';
import LineLoginButton, { redirectToShopLineOAuth } from '../components/LineLoginButton';
import config from '../config';
import './Login.css';

const Login = () => {
  useEffect(() => {
    if (localStorage.getItem('auth_token')) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const liff = (await import('liff')).default;
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
  }, []);

  return (
    <div className="login-page">
      <div className="container">
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



