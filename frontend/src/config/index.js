/** ตัดท้าย /api หรือ /api/ ออก เพื่อได้ origin ของ backend (เช่น ngrok หรือโดเมนจริง) */
function backendOriginFromApiUrl(apiUrl) {
  if (!apiUrl || typeof apiUrl !== 'string') return '';
  const trimmed = apiUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/api')) return trimmed.slice(0, -4);
  if (trimmed.endsWith('/api/')) return trimmed.replace(/\/api\/$/, '');
  return trimmed;
}

// ค่า default สำหรับ local dev (webpack dev server + Django local)
const localApiBase = 'http://localhost:8000/api/';
const localBackendBase = 'http://localhost:8000';

const envApiBase = process.env.REACT_APP_API_BASE_URL || '';
const envLiffBase = process.env.REACT_APP_LIFF_ENDPOINT_URL || '';
let derivedLiffFromApi = backendOriginFromApiUrl(envApiBase);
// กรณี API เป็น path สัมพัทธ์ เช่น /api/ โหลดจากโฮสต์เดียวกับหน้าเว็บ
if (
  !derivedLiffFromApi &&
  envApiBase.startsWith('/') &&
  typeof window !== 'undefined'
) {
  derivedLiffFromApi = window.location.origin;
}

// ถ้าไม่ตั้ง env: production ให้ยิง API ที่ origin เดียวกัน (/api/), dev ค่อย fallback localhost
const sameOriginApiBase =
  typeof window !== 'undefined' ? `${window.location.origin}/api/` : '';
const sameOriginLiffBase = typeof window !== 'undefined' ? window.location.origin : '';
const isProdBuild = process.env.REACT_APP_ENVIRONMENT === 'production';

/** ชื่อร้านและข้อความแบรนด์ (แสดงในเว็บ / แอดมิน) */
export const BRANDING = {
  storeName: 'ซำสูงพาณิชย์',
  /** ไตเติลแท็บเบราว์เซอร์ — ลูกค้า */
  customerPageTitle: 'ซำสูงพาณิชย์ — สั่งซื้อออนไลน์',
};

const resolvedApiBase = envApiBase || (isProdBuild ? sameOriginApiBase : localApiBase);
const resolvedLiffBase =
  envLiffBase || derivedLiffFromApi || (isProdBuild ? sameOriginLiffBase : localBackendBase);

// Environment Configuration
const config = {
  // API Configuration
  API_BASE_URL: resolvedApiBase,
  API_TIMEOUT: parseInt(process.env.REACT_APP_API_TIMEOUT) || 10000,
  API_RETRY_ATTEMPTS: parseInt(process.env.REACT_APP_API_RETRY_ATTEMPTS) || 3,
  
  // LINE LIFF Configuration
  LIFF_ID: process.env.REACT_APP_LIFF_ID || '2008347227-Bd7D38KD',
  LINE_CHANNEL_ID: process.env.REACT_APP_LINE_CHANNEL_ID || 'your-channel-id',
  LIFF_ENDPOINT_URL: resolvedLiffBase,
  LIFF_SCOPE: process.env.REACT_APP_LIFF_SCOPE || 'profile,openid',
  
  // Environment
  ENVIRONMENT: process.env.REACT_APP_ENVIRONMENT || 'development',
  
  // Feature Flags
  ENABLE_PAYMENT: process.env.REACT_APP_ENABLE_PAYMENT === 'true',
  ENABLE_TRACKING: process.env.REACT_APP_ENABLE_TRACKING === 'true',
  ENABLE_NOTIFICATIONS: process.env.REACT_APP_ENABLE_NOTIFICATIONS === 'true',
  
  // Device Detection
  isMobile: () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  
  isIOS: () => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },
  
  isAndroid: () => {
    if (typeof window === 'undefined') return false;
    return /Android/.test(navigator.userAgent);
  },
  
  isDesktop: () => {
    if (typeof window === 'undefined') return true;
    return !config.isMobile();
  },
  
  // Screen Size Detection
  getScreenSize: () => {
    if (typeof window === 'undefined') return 'desktop';
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  },
  
  // Breakpoints
  BREAKPOINTS: {
    mobile: 768,
    tablet: 1024,
    desktop: 1200
  },

  BRANDING,
};

export default config;


