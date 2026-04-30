import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cartService } from '../services/api';
import { usePopup } from './PopupProvider';
import { PLACEHOLDER_IMAGES, pickProductImage } from '../utils/media';
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
  const [hasEntered, setHasEntered] = useState(false);
  const isControlled = useMemo(
    () =>
      typeof onAddToCart === 'function' ||
      typeof onIncreaseQuantity === 'function' ||
      typeof onDecreaseQuantity === 'function',
    [onAddToCart, onIncreaseQuantity, onDecreaseQuantity]
  );
  const [localCartQuantity, setLocalCartQuantity] = useState(Number(cartQuantity || 0));

  useEffect(() => {
    if (isControlled) {
      setLocalCartQuantity(Number(cartQuantity || 0));
    }
  }, [cartQuantity, isControlled]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasEntered(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (isControlled) return;
    let cancelled = false;
    (async () => {
      try {
        const cart = await cartService.getCart();
        const items = Array.isArray(cart?.items) ? cart.items : [];
        const line = items.find((item) => Number(item.product_id || item.id) === Number(product.id));
        if (!cancelled) {
          setLocalCartQuantity(Number(line?.quantity || 0));
        }
      } catch (error) {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isControlled, product.id]);

  const effectiveCartQuantity = isControlled ? Number(cartQuantity || 0) : Number(localCartQuantity || 0);
  const stockQuantity = Number(product.stock_quantity || 0);
  const remainingStock = Math.max(0, stockQuantity - effectiveCartQuantity);
  const isOutOfStock = remainingStock <= 0;
  const hasInCart = effectiveCartQuantity > 0;
  const categoryLabel = (() => {
    if (typeof product.category_name === 'string' && product.category_name.trim()) {
      return product.category_name.trim();
    }
    if (typeof product.category === 'object' && typeof product.category?.name === 'string' && product.category.name.trim()) {
      return product.category.name.trim();
    }
    if (typeof product.category === 'string' && product.category.trim() && Number.isNaN(Number(product.category.trim()))) {
      return product.category.trim();
    }
    return '';
  })();

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
      setLocalCartQuantity((prev) => prev + 1);
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
      return;
    }
    const nextQty = effectiveCartQuantity + 1;
    if (nextQty > stockQuantity) return;
    cartService
      .updateCartItem(product.id, nextQty)
      .then(() => setLocalCartQuantity(nextQty))
      .catch(() => popup.error('ไม่สามารถอัปเดตจำนวนสินค้าได้'));
  };

  const handleDecrease = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDecreaseQuantity) {
      onDecreaseQuantity(product);
      return;
    }
    const nextQty = Math.max(0, effectiveCartQuantity - 1);
    cartService
      .updateCartItem(product.id, nextQty)
      .then(() => setLocalCartQuantity(nextQty))
      .catch(() => popup.error('ไม่สามารถอัปเดตจำนวนสินค้าได้'));
  };

  return (
    <div className={`product-card ${hasEntered ? 'is-entered' : ''}`}>
      <div className="product-image-container">
        <Link to={`/customer/products/${product.id}`} className="product-image-link">
          <img 
            src={pickProductImage(product, PLACEHOLDER_IMAGES.md)} 
            alt={product.name}
            className="product-image"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMAGES.md;
            }}
          />
        </Link>
        <button
          className="product-image-add-btn"
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          type="button"
        >
          {isOutOfStock ? 'หมด' : '+ ตะกร้า'}
        </button>
      </div>

      <Link to={`/customer/products/${product.id}`} className="product-link">
        <div className="product-info">
          <h3 className="product-name" title={product.name}>{product.name}</h3>
          {categoryLabel && (
            <p className="product-category-inline">• {categoryLabel}</p>
          )}
          <p className="product-description">{product.description}</p>
          <div className="product-price">
            {formatPrice(product.price)}
          </div>
          <div className={`product-stock ${isOutOfStock ? 'out' : ''}`}>
            {isOutOfStock ? 'สินค้าหมด' : 'พร้อมสั่งซื้อ'}
          </div>
        </div>
      </Link>
      
      <div className="product-actions">
        <div className={`cart-meta-area ${showCartInfo ? '' : 'is-collapsed'}`}>
          {showCartInfo && hasInCart && (
            <div className="cart-status">
              <span className="cart-icon">🛒</span>
              <span>ใส่แล้ว {effectiveCartQuantity} ชิ้น</span>
            </div>
          )}

          {showCartInfo && hasInCart && (
            <div className="cart-qty-editor">
              <button className="qty-btn" onClick={handleDecrease}>-</button>
              <span className="qty-value">{effectiveCartQuantity}</span>
              <button
                className="qty-btn"
                onClick={handleIncrease}
                disabled={remainingStock <= 0}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

