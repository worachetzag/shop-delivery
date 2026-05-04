import axios from 'axios';
import config from '../config';

// API Configuration
const API_BASE_URL = config.API_BASE_URL;
const API_TIMEOUT = config.API_TIMEOUT;

/** ไม่ redirect ไปหน้า login เมื่อ 401 จาก endpoint เหล่านี้ (รหัสผ่านผิด / สมัคร ฯลฯ) */
const UNAUTHENTICATED_401_PATH_FRAGMENTS = [
  '/accounts/login/',
  '/accounts/register/',
  '/accounts/admin/login/',
  '/accounts/driver/login/',
];

/**
 * แปลง Axios error เป็น object { error?, detail?, status? } — idempotent ถ้า reject มาแล้ว
 */
export function normalizeApiError(error) {
  if (error != null && typeof error === 'object' && !('response' in error) && !('config' in error)) {
    if ('error' in error || 'detail' in error || 'non_field_errors' in error) {
      return error;
    }
  }
  const data = error?.response?.data;
  if (data && typeof data === 'object') return data;
  const st = error?.response?.status;
  if (st === 401) return { error: 'กรุณาเข้าสู่ระบบ', status: 401 };
  if (st === 403) return { error: 'ไม่มีสิทธิ์เข้าถึง', status: 403 };
  if (error?.code === 'ECONNABORTED') return { error: 'การเชื่อมต่อหมดเวลา' };
  const msg = typeof error?.message === 'string' ? error.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
  return { error: msg };
}

function shouldSessionRedirectOn401(error) {
  if (error?.response?.status !== 401) return false;
  const url = error.config?.url || '';
  return !UNAUTHENTICATED_401_PATH_FRAGMENTS.some((frag) => url.includes(frag));
}

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Skip ngrok warning
  },
});

// Request interceptor
api.interceptors.request.use(
  (req) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      req.headers.Authorization = `Token ${token}`;
    }
    return req;
  },
  (error) => Promise.reject(normalizeApiError(error))
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (shouldSessionRedirectOn401(error)) {
      localStorage.removeItem('auth_token');
      window.location.href = '/customer/login';
    }
    return Promise.reject(normalizeApiError(error));
  }
);

// API Services — ผิดพลาดถูกแปลงที่ interceptor แล้ว
export const authService = {
  register: async (userData) => {
    const response = await api.post('/accounts/register/', userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post('/accounts/login/', credentials);
    const { token } = response.data;
    localStorage.setItem('auth_token', token);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/accounts/profile/');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/accounts/profile/', profileData);
    return response.data;
  },

  exportData: async () => {
    const response = await api.get('/accounts/data-export/');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
  },
};

export const productsService = {
  getProducts: async (params = {}) => {
    const response = await api.get('/products/', { params });
    return response.data;
  },

  getProduct: async (id) => {
    const response = await api.get(`/products/${id}/`);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/products/categories/');
    return response.data;
  },

  getHomePromotions: async () => {
    const response = await api.get('/products/home-promotions/');
    return response.data;
  },

  searchProducts: async (query, filters = {}) => {
    const params = { search: query, ...filters };
    const response = await api.get('/products/search/', { params });
    return response.data;
  },
};

export const ordersService = {
  createOrder: async (orderData) => {
    const response = await api.post('/orders/', orderData);
    return response.data;
  },

  getOrders: async (params = {}) => {
    const response = await api.get('/orders/list/', { params });
    return response.data;
  },

  getOrder: async (id) => {
    const response = await api.get(`/customer/orders/${id}/`);
    return response.data;
  },

  updateOrderStatus: async (id, status) => {
    const response = await api.put(`/customer/orders/${id}/status/`, { status });
    return response.data;
  },

  cancelOrder: async (id) => {
    const response = await api.post(`/orders/${id}/cancel-awaiting-payment-proof/`);
    return response.data;
  },
};

export const cartService = {
  addToCart: async (productId, quantity = 1) => {
    const response = await api.post('/orders/cart/add/', {
      product_id: productId,
      quantity,
    });
    return response.data;
  },

  getCart: async () => {
    const response = await api.get('/orders/cart/');
    return response.data;
  },

  updateCartItem: async (itemId, quantity) => {
    const response = await api.put('/orders/cart/update/', {
      product_id: itemId,
      quantity,
    });
    return response.data;
  },

  removeFromCart: async (itemId) => {
    const response = await api.delete(`/orders/cart/${itemId}/`);
    return response.data;
  },

  clearCart: async () => {
    const response = await api.delete('/orders/cart/clear/');
    return response.data;
  },
};

export const paymentsService = {
  createPromptPayQR: async (orderId, amount) => {
    const response = await api.post('/payments/promptpay/', {
      order_id: orderId,
      amount,
    });
    return response.data;
  },

  createTrueMoneyQR: async (orderId, amount) => {
    const response = await api.post('/payments/truemoney/', {
      order_id: orderId,
      amount,
    });
    return response.data;
  },

  createRabbitQR: async (orderId, amount) => {
    const response = await api.post('/payments/rabbit/', {
      order_id: orderId,
      amount,
    });
    return response.data;
  },

  createSCBEasyQR: async (orderId, amount) => {
    const response = await api.post('/payments/scb-easy/', {
      order_id: orderId,
      amount,
    });
    return response.data;
  },

  verifyPayment: async (paymentId) => {
    const response = await api.get(`/payments/${paymentId}/verify/`);
    return response.data;
  },
};

export const logisticsService = {
  calculateShippingFee: async (addressData) => {
    const response = await api.post('/logistics/calculate-fee/', addressData);
    return response.data;
  },

  getDriverAssignments: async (driverId) => {
    const response = await api.get(`/logistics/driver/${driverId}/assignments/`);
    return response.data;
  },

  updateDeliveryStatus: async (assignmentId, status, location = null) => {
    const response = await api.put(`/logistics/driver/assignments/${assignmentId}/update/`, {
      status,
      location,
    });
    return response.data;
  },

  getTrackingInfo: async (trackingNumber) => {
    const response = await api.get(`/logistics/tracking/${trackingNumber}/`);
    return response.data;
  },
};

export const pdpaService = {
  getPrivacyPolicy: async () => {
    const response = await api.get('/pdpa/privacy-policy/');
    return response.data;
  },

  getConsent: async () => {
    const response = await api.get('/pdpa/consent/');
    return response.data;
  },

  updateConsent: async (consentData) => {
    const response = await api.post('/pdpa/consent/', consentData);
    return response.data;
  },

  getPdpaConsentStatus: async () => {
    const response = await api.get('/pdpa/consent/status/');
    return response.data;
  },

  getConsentSummary: async () => {
    const response = await api.get('/pdpa/consent/summary/');
    return response.data;
  },

  recordPrivacyPolicyConsent: async (privacyPolicyId) => {
    const response = await api.post('/pdpa/consent/', {
      consent_type: 'privacy_policy',
      is_given: true,
      privacy_policy: privacyPolicyId,
    });
    return response.data;
  },

  recordPrivacyPolicyDecline: async (privacyPolicyId) => {
    const response = await api.post('/pdpa/consent/', {
      consent_type: 'privacy_policy',
      is_given: false,
      privacy_policy: privacyPolicyId,
    });
    return response.data;
  },

  withdrawPrivacyConsent: async () => {
    const response = await api.post('/pdpa/consent/withdraw-privacy/');
    return response.data;
  },

  withdrawMarketingConsent: async () => {
    const response = await api.post('/pdpa/consent/withdraw-marketing/');
    return response.data;
  },
};

export default api;
