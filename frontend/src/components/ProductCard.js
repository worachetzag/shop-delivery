import React from 'react';
import { Link } from 'react-router-dom';
import { cartService } from '../services/api';
import { usePopup } from './PopupProvider';
import './ProductCard.css';

const ProductCard = ({
  product,
  cartQuantity = 0,
  onAddToCart,
  onIncreaseQuantity,
  onDecreaseQuantity,
  showCartInfo = true,
}) => {
  const popup = usePopup();
  const stockQuantity = Number(product.stock_quantity || 0);
  const remainingStock = Math.max(0, stockQuantity - Number(cartQuantity || 0));
  const isOutOfStock = remainingStock <= 0;
  const hasInCart = cartQuantity > 0;

  const formatPrice = (price) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAddToCart) {
      onAddToCart(product);
      return;
    }
    try {
      await cartService.addToCart(product.id, 1);
      popup.success('เพิ่มสินค้าในตะกร้าแล้ว');
    } catch (error) {
      console.error('Add to cart failed:', error);
      popup.error(error?.error || 'ไม่สามารถเพิ่มสินค้าในตะกร้าได้');
    }
  };

  const handleIncrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onIncreaseQuantity) {
      onIncreaseQuantity(product);
    }
  };

  const handleDecrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDecreaseQuantity) {
      onDecreaseQuantity(product);
    }
  };

  return (
    <div className="product-card">
      <Link to={`/products/${product.id}`} className="product-link">
        <div className="product-image-container">
          <img 
            src={product.image} 
            alt={product.name}
            className="product-image"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/300x200/f8f9fa/6c757d?text=No+Image';
            }}
          />
          {product.category && (
            <span className="product-category">{product.category}</span>
          )}
        </div>
        
        <div className="product-info">
          <h3 className="product-name">{product.name}</h3>
          <p className="product-description">{product.description}</p>
          <div className="product-price">
            {formatPrice(product.price)} / {product.unit_label || 'ชิ้น'}
            {product.unit_detail ? ` (${product.unit_detail})` : ''}
          </div>
          <div className={`product-stock ${isOutOfStock ? 'out' : ''}`}>
            {isOutOfStock ? 'สินค้าหมด' : `คงเหลือ ${remainingStock} ${product.unit_label || 'ชิ้น'}`}
          </div>
        </div>
      </Link>
      
      <div className="product-actions">
        {showCartInfo && hasInCart && (
          <div className="cart-status">
            <span className="cart-icon">🛒</span>
            <span>ใส่แล้ว {cartQuantity} ชิ้น</span>
          </div>
        )}

        {showCartInfo && hasInCart && (
          <div className="cart-qty-editor">
            <button className="qty-btn" onClick={handleDecrease}>-</button>
            <span className="qty-value">{cartQuantity}</span>
            <button
              className="qty-btn"
              onClick={handleIncrease}
              disabled={remainingStock <= 0}
            >
              +
            </button>
          </div>
        )}

        <button 
          className="btn btn-primary btn-sm"
          onClick={handleAddToCart}
          disabled={isOutOfStock}
        >
          {isOutOfStock ? 'สินค้าหมด' : (showCartInfo && hasInCart) ? 'เพิ่มอีก 1 ชิ้น' : 'เพิ่มในตะกร้า'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;

