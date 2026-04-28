import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cartService } from '../services/api';
import { displayProductLineName } from '../utils/helpers';
import { PLACEHOLDER_IMAGES, resolveMediaUrl } from '../utils/media';
import './Cart.css';

const Cart = () => {
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load cart items from API
    const loadCartItems = async () => {
      try {
        const response = await cartService.getCart();
        setCartItems(response.items || response);
        setLoading(false);
      } catch (error) {
        console.error('Error loading cart:', error);
        setLoading(false);
      }
    };

    loadCartItems();
  }, []);

  const updateQuantity = async (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }
    
    try {
      await cartService.updateCartItem(itemId, newQuantity);
      setCartItems(items =>
        items.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (error) {
      console.error('Error updating cart item:', error);
    }
  };

  const removeItem = async (itemId) => {
    try {
      await cartService.removeFromCart(itemId);
      setCartItems(items => items.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Error removing cart item:', error);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const totalItemCount = () => {
    return cartItems.reduce((total, item) => total + Number(item.quantity || 0), 0);
  };

  const calculateShipping = () => {
    const subtotal = calculateSubtotal();
    return subtotal >= 5000 ? 0 : 100; // Free shipping over 5000 THB
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateShipping();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="loading">
        กำลังโหลดตะกร้าสินค้า...
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="container">
          <div className="page-header">
            <h1 className="page-title">ตะกร้าสินค้า</h1>
          </div>
          
          <div className="empty-cart">
            <div className="empty-cart-icon">🛒</div>
            <h3>ตะกร้าสินค้าว่างเปล่า</h3>
            <p>เริ่มต้นการช้อปปิ้งของคุณ</p>
            <Link to="/customer/products" className="btn btn-primary">
              ดูสินค้า
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">ตะกร้าสินค้า</h1>
          <p className="page-subtitle">ตรวจสอบสินค้าในตะกร้าของคุณ</p>
          <div className="cart-header-actions">
            <Link to="/customer/checkout" className="btn btn-primary">
              ไปหน้าชำระเงิน
            </Link>
          </div>
        </div>

        <div className="cart-content">
          <div className="cart-items">
            {cartItems.map(item => (
              <div key={item.id} className="cart-item">
                <div className="item-image">
                  <img 
                    src={resolveMediaUrl(item.image, PLACEHOLDER_IMAGES.md)}
                    alt={displayProductLineName(item)}
                    onError={(e) => {
                      e.target.src = PLACEHOLDER_IMAGES.md;
                    }}
                  />
                </div>
                
                <div className="item-details">
                  <h3 className="item-name">{displayProductLineName(item)}</h3>
                  <p className="item-category">{item.category}</p>
                  <p className="item-price">
                    {formatPrice(item.price)} / {item.unit_label || 'ชิ้น'}{item.unit_detail ? ` (${item.unit_detail})` : ''}
                  </p>
                </div>
                
                <div className="item-quantity">
                  <button 
                    className="quantity-btn"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  >
                    -
                  </button>
                  <span className="quantity">{item.quantity}</span>
                  <button 
                    className="quantity-btn"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                
                <div className="item-total">
                  <p className="total-price">{formatPrice(item.price * item.quantity)}</p>
                </div>
                
                <div className="item-actions">
                  <button 
                    className="remove-btn"
                    onClick={() => removeItem(item.id)}
                    title="ลบสินค้า"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-summary">
            <div className="summary-card">
              <h3 className="summary-title">สรุปคำสั่งซื้อ</h3>

              <div className="summary-meta">
                <span>{cartItems.length} รายการ</span>
                <span>{totalItemCount()} ชิ้น</span>
              </div>

              <div className="summary-items">
                {cartItems.map((item) => (
                  <div key={item.id} className="summary-item-row">
                    <div className="summary-item-name">{displayProductLineName(item)}</div>
                    <div className="summary-item-detail">
                      <span>x{item.quantity} {item.unit_label || 'ชิ้น'}</span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="summary-row">
                <span>ยอดรวมสินค้า:</span>
                <span>{formatPrice(calculateSubtotal())}</span>
              </div>
              
              <div className="summary-row">
                <span>ค่าจัดส่ง:</span>
                <span>
                  {calculateShipping() === 0 ? (
                    <span className="free-shipping">ฟรี</span>
                  ) : (
                    formatPrice(calculateShipping())
                  )}
                </span>
              </div>
              
              {calculateSubtotal() < 5000 && (
                <div className="shipping-notice">
                  <small>
                    ซื้อเพิ่ม {formatPrice(5000 - calculateSubtotal())} 
                    เพื่อรับการจัดส่งฟรี
                  </small>
                </div>
              )}
              
              <div className="summary-row total-row">
                <span>ยอดรวมทั้งสิ้น:</span>
                <span className="total-amount">{formatPrice(calculateTotal())}</span>
              </div>
              
              <div className="checkout-actions">
                <Link to="/customer/checkout" className="btn btn-primary btn-full">
                  ดำเนินการสั่งซื้อ
                </Link>
                <Link to="/customer/products" className="btn btn-outline btn-full">
                  ซื้อสินค้าเพิ่ม
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;
