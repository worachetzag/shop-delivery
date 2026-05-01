import React from 'react';
import config from '../config';

/** OAuth ไป Django เพื่อแลก Token ของร้าน — next = path หลังล็อกอิน (เช่น /customer/orders/12) */
export function redirectToShopLineOAuth(nextPath) {
  const raw =
    typeof nextPath === 'string' && nextPath.trim()
      ? nextPath.trim().startsWith('/')
        ? nextPath.trim()
        : `/${nextPath.trim()}`
      : '/customer';
  const q = encodeURIComponent(raw);
  window.location.href = `${config.LIFF_ENDPOINT_URL}/accounts/line/login/?next=${q}`;
}

function getGlobalLiff() {
  if (typeof window === 'undefined') return null;
  return window.liff || null;
}

function normalizeShopPath(pathish) {
  if (typeof pathish !== 'string' || !pathish.trim()) return '/customer';
  const t = pathish.trim();
  return t.startsWith('/') ? t : `/${t}`;
}

const LineLoginButton = ({ lineLoginNext }) => {
  const resolveRedirectUri = () => {
    const path =
      typeof lineLoginNext === 'string' && lineLoginNext.trim()
        ? normalizeShopPath(lineLoginNext)
        : `${window.location.pathname}${window.location.search}`;
    return `${window.location.origin}${path}`;
  };

  const handleLineLogin = async () => {
    try {
      const liff = getGlobalLiff();
      if (!liff) throw new Error('LIFF SDK not loaded');
      await liff.init({ liffId: config.LIFF_ID });
      // ใน LINE WebView: ให้ LIFF login ก่อน — มักไม่โผล่หน้าอีเมล/รหัสผ่านเหมือนเปิดใน Safari
      if (liff.isInClient() && !liff.isLoggedIn()) {
        liff.login({ redirectUri: resolveRedirectUri() });
        return;
      }
    } catch {
      /* เปิดนอก LINE หรือยังไม่ได้ตั้ง LIFF_ID — ไป OAuth แบบเดิม */
    }
    redirectToShopLineOAuth(lineLoginNext ? normalizeShopPath(lineLoginNext) : '/customer');
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
