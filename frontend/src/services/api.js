import axios from 'axios';
import config from '../config';

// API Configuration
const API_BASE_URL = config.API_BASE_URL;
const API_TIMEOUT = config.API_TIMEOUT;
const API_RETRY_ATTEMPTS = config.API_RETRY_ATTEMPTS;

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
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('auth_token');
      window.location.href = '/customer/login';
    }
    return Promise.reject(error);
  }
);

// API Services
export const authService = {
  // Register new user
  register: async (userData) => {
    try {
      const response = await api.post('/accounts/register/', userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Login user
  login: async (credentials) => {
    try {
      const response = await api.post('/accounts/login/', credentials);
      const { token } = response.data;
      localStorage.setItem('auth_token', token);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get user profile
  getProfile: async () => {
    try {
      const response = await api.get('/accounts/profile/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await api.put('/accounts/profile/', profileData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Export user data
  exportData: async () => {
    try {
      const response = await api.get('/accounts/data-export/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('auth_token');
  }
};

export const productsService = {
  // Get all products
  getProducts: async (params = {}) => {
    try {
      const response = await api.get('/products/', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get product by ID
  getProduct: async (id) => {
    try {
      const response = await api.get(`/products/${id}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get categories
  getCategories: async () => {
    try {
      const response = await api.get('/products/categories/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  /** การ์ดโปรโมชั่นหน้าแรก (ตั้งค่าใน Django admin → โปรโมชั่นหน้าแรก) */
  getHomePromotions: async () => {
    try {
      const response = await api.get('/products/home-promotions/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Search products
  searchProducts: async (query, filters = {}) => {
    try {
      const params = { search: query, ...filters };
      const response = await api.get('/products/search/', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export const ordersService = {
  // Create new order
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/orders/', orderData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get user orders
  getOrders: async (params = {}) => {
    try {
      const response = await api.get('/orders/list/', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get order by ID
  getOrder: async (id) => {
    try {
      const response = await api.get(`/customer/orders/${id}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update order status
  updateOrderStatus: async (id, status) => {
    try {
      const response = await api.put(`/customer/orders/${id}/status/`, { status });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Cancel order
  cancelOrder: async (id) => {
    try {
      const response = await api.post(`/customer/orders/${id}/cancel/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export const cartService = {
  // Add item to cart
  addToCart: async (productId, quantity = 1) => {
    try {
      const response = await api.post('/orders/cart/add/', {
        product_id: productId,
        quantity
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get cart items
  getCart: async () => {
    try {
      const response = await api.get('/orders/cart/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update cart item quantity
  updateCartItem: async (itemId, quantity) => {
    try {
      const response = await api.put('/orders/cart/update/', {
        product_id: itemId,
        quantity,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Remove item from cart
  removeFromCart: async (itemId) => {
    try {
      const response = await api.delete(`/orders/cart/${itemId}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Clear cart
  clearCart: async () => {
    try {
      const response = await api.delete('/orders/cart/clear/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export const paymentsService = {
  // Create PromptPay QR
  createPromptPayQR: async (orderId, amount) => {
    try {
      const response = await api.post('/payments/promptpay/', {
        order_id: orderId,
        amount
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create TrueMoney QR
  createTrueMoneyQR: async (orderId, amount) => {
    try {
      const response = await api.post('/payments/truemoney/', {
        order_id: orderId,
        amount
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create Rabbit QR
  createRabbitQR: async (orderId, amount) => {
    try {
      const response = await api.post('/payments/rabbit/', {
        order_id: orderId,
        amount
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create SCB Easy QR
  createSCBEasyQR: async (orderId, amount) => {
    try {
      const response = await api.post('/payments/scb-easy/', {
        order_id: orderId,
        amount
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Verify payment
  verifyPayment: async (paymentId) => {
    try {
      const response = await api.get(`/payments/${paymentId}/verify/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export const logisticsService = {
  // Calculate shipping fee
  calculateShippingFee: async (addressData) => {
    try {
      const response = await api.post('/logistics/calculate-fee/', addressData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get driver assignments
  getDriverAssignments: async (driverId) => {
    try {
      const response = await api.get(`/logistics/driver/${driverId}/assignments/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update delivery status
  updateDeliveryStatus: async (assignmentId, status, location = null) => {
    try {
      const response = await api.put(`/logistics/driver/assignments/${assignmentId}/update/`, {
        status,
        location
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get tracking info
  getTrackingInfo: async (trackingNumber) => {
    try {
      const response = await api.get(`/logistics/tracking/${trackingNumber}/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export const pdpaService = {
  // Get privacy policy
  getPrivacyPolicy: async () => {
    try {
      const response = await api.get('/pdpa/privacy-policy/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get consent status
  getConsent: async () => {
    try {
      const response = await api.get('/pdpa/consent/');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update consent
  updateConsent: async (consentData) => {
    try {
      const response = await api.post('/pdpa/consent/', consentData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default api;
