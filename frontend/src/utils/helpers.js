import { popupNotify } from '../components/PopupProvider';

// Utility functions for the storefront web app (ซำสูงพาณิชย์)

/**
 * ชื่อบรรทัดสินค้าจาก API ตะกร้า / รายการในคำสั่งซื้อ (รองรับ product_name, name, product nested)
 */
export const displayProductLineName = (item) => {
  if (!item) return 'ไม่ระบุ';
  const nested = item.product && typeof item.product === 'object' ? item.product.name : '';
  const n = (item.product_name || item.name || nested || '').trim();
  if (n) return n;
  const pid = item.product_id ?? (typeof item.product === 'number' ? item.product : item.product?.id);
  return pid != null ? `สินค้า #${pid}` : 'ไม่ระบุ';
};

// Format price to Thai Baht
export const formatPrice = (price) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB'
  }).format(price);
};

// Format date to Thai locale
export const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Format date with time
export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Validate email
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone number (Thai format)
export const validatePhone = (phone) => {
  const phoneRegex = /^(\+66|0)[0-9]{8,9}$/;
  return phoneRegex.test(phone.replace(/\s|-/g, ''));
};

// Validate postal code (Thai format)
export const validatePostalCode = (postalCode) => {
  const postalRegex = /^[0-9]{5}$/;
  return postalRegex.test(postalCode);
};

// Calculate shipping fee
export const calculateShippingFee = (subtotal) => {
  return subtotal >= 5000 ? 0 : 100;
};

// Calculate total amount
export const calculateTotal = (subtotal, shippingFee = null) => {
  const shipping = shippingFee !== null ? shippingFee : calculateShippingFee(subtotal);
  return subtotal + shipping;
};

// Generate order ID
export const generateOrderId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `ORD-${timestamp}-${random}`.toUpperCase();
};

// Generate tracking number
export const generateTrackingNumber = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `TH${timestamp}${random}`.toUpperCase();
};

// Debounce function
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Local storage helpers
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error getting from localStorage:', error);
      return null;
    }
  },

  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error setting to localStorage:', error);
      return false;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  },

  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }
};

// Session storage helpers
export const sessionStorage = {
  get: (key) => {
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error getting from sessionStorage:', error);
      return null;
    }
  },

  set: (key, value) => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error setting to sessionStorage:', error);
      return false;
    }
  },

  remove: (key) => {
    try {
      window.sessionStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from sessionStorage:', error);
      return false;
    }
  },

  clear: () => {
    try {
      window.sessionStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
      return false;
    }
  }
};

// Error handling
export const handleError = (error, defaultMessage = 'เกิดข้อผิดพลาด') => {
  console.error('Error:', error);
  
  if (error.response?.data?.message) {
    return error.response.data.message;
  } else if (error.response?.data?.error) {
    return error.response.data.error;
  } else if (error.message) {
    return error.message;
  } else {
    return defaultMessage;
  }
};

// Success message
export const showSuccess = (message) => {
  console.log('Success:', message);
  popupNotify(message, { type: 'success' });
};

// Error message
export const showError = (message) => {
  console.error('Error:', message);
  popupNotify(message, { type: 'error' });
};

// Copy to clipboard
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
};

// Download file
export const downloadFile = (data, filename, type = 'application/json') => {
  const blob = new Blob([data], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * แปลง data URL เป็น Blob (ไม่พึ่ง fetch — รองรับ data URL ยาวบนมือถือ)
 */
function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) {
    throw new Error('รูปแบบรูปไม่ถูกต้อง');
  }
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mimeMatch = /^data:([^;,]+)/i.exec(header);
  const mime = mimeMatch ? mimeMatch[1].trim() : 'image/png';
  const isBase64 = /;base64/i.test(header);
  let binary;
  if (isBase64) {
    binary = atob(body);
  } else {
    binary = decodeURIComponent(body);
  }
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * บันทึกรูปจาก data URL หรือ URL จริงลงเครื่อง
 * - มือถือ: ลอง Web Share API (เลือก “บันทึกรูป” / แอป Files)
 * - อื่นๆ: แท็ก download + Blob URL
 * @returns {{ method: 'share'|'download'|'aborted' }}
 */
export async function saveImageToDevice(imageSrc, filename = 'image.png') {
  if (!imageSrc || typeof imageSrc !== 'string') {
    throw new Error('ไม่พบรูปสำหรับบันทึก');
  }

  let blob;
  if (imageSrc.startsWith('data:')) {
    blob = dataUrlToBlob(imageSrc);
  } else {
    const response = await fetch(imageSrc, {
      headers: { 'ngrok-skip-browser-warning': 'true' },
      mode: 'cors',
    });
    if (!response.ok) {
      throw new Error('โหลดรูปไม่สำเร็จ');
    }
    blob = await response.blob();
  }

  const safeName = filename.replace(/[^\w.\-]/g, '_') || 'promptpay-qr.png';
  const mimeType = (blob.type && blob.type.startsWith('image/')) ? blob.type : 'image/png';

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], safeName, { type: mimeType });
      const payload = { files: [file], title: 'QR ชำระเงิน' };
      if (navigator.canShare(payload)) {
        await navigator.share(payload);
        return { method: 'share' };
      }
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { method: 'aborted' };
      }
      /* fall through to download */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.style.display = 'none';
    link.setAttribute('download', safeName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  return { method: 'download' };
}

// Get device info
export const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  
  return {
    isMobile,
    isIOS,
    isAndroid,
    userAgent
  };
};

// Check if LIFF is available
export const isLIFFAvailable = () => {
  return typeof window !== 'undefined' && window.liff;
};

// Format file size
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Generate random string
export const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Check if object is empty
export const isEmpty = (obj) => {
  return Object.keys(obj).length === 0;
};

// Deep clone object
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Merge objects
export const mergeObjects = (...objects) => {
  return Object.assign({}, ...objects);
};

// Capitalize first letter
export const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Convert to slug
export const toSlug = (str) => {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Parse URL parameters
export const parseUrlParams = (url = window.location.href) => {
  const params = new URLSearchParams(new URL(url).search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

// Build URL with parameters
export const buildUrl = (baseUrl, params = {}) => {
  const url = new URL(baseUrl);
  Object.keys(params).forEach(key => {
    if (params[key] !== null && params[key] !== undefined) {
      url.searchParams.set(key, params[key]);
    }
  });
  return url.toString();
};

