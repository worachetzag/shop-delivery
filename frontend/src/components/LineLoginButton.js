import React from 'react';
import config from '../config';

/** OAuth ไป Django เพื่อแลก Token ของร้าน (หลัง LINE ยืนยันตัวตนแล้ว) */
export function redirectToShopLineOAuth() {
  window.location.href = `${config.LIFF_ENDPOINT_URL}/accounts/line/login/`;
}

function getGlobalLiff() {
  if (typeof window === 'undefined') return null;
  return window.liff || null;
}

const LineLoginButton = () => {
  const handleLineLogin = async () => {
    try {
      const liff = getGlobalLiff();
      if (!liff) throw new Error('LIFF SDK not loaded');
      await liff.init({ liffId: config.LIFF_ID });
      // ใน LINE WebView: ให้ LIFF login ก่อน — มักไม่โผล่หน้าอีเมล/รหัสผ่านเหมือนเปิดใน Safari
      if (liff.isInClient() && !liff.isLoggedIn()) {
        const uri = `${window.location.origin}${window.location.pathname}${window.location.search}`;
        liff.login({ redirectUri: uri });
        return;
      }
    } catch {
      /* เปิดนอก LINE หรือยังไม่ได้ตั้ง LIFF_ID — ไป OAuth แบบเดิม */
    }
    redirectToShopLineOAuth();
  };

  return (
    <button 
      onClick={handleLineLogin}
      className="line-login-btn"
      style={{
        backgroundColor: '#00B900',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        justifyContent: 'center'
      }}
    >
      <span>📱</span>
      เข้าสู่ระบบด้วย LINE
    </button>
  );
};

export default LineLoginButton;
