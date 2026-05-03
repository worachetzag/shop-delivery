import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cartService } from '../services/api';
import { usePopup } from './PopupProvider';
import { PLACEHOLDER_IMAGES, pickProductImage } from '../utils/media';
import { formatBahtAmount } from '../utils/formatPrice';
import { getProductCompareAtPrice } from '../utils/productPricing';
import { captureListingScrollBeforeProductDetail } from '../utils/listingScrollRestore';
import './ProductCard.css';

const ProductCard = ({
  product,
  cartQuantity = 0,
  onAddToCart,
  onIncreaseQuantity,
  onDecreaseQuantity,
  showCartInfo = true,
  /** Browse-only tile: tap opens detail; no quick add / cart controls */
  listingOnly = false,
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
    if (!isControlled) return;
    setLocalCartQuantity(Number(cartQuantity || 0));
  }, [cartQuantity, isControlled]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasEntered(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (listingOnly || isControlled) return;
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
  }, [listingOnly, isControlled, product.id]);

  const effectiveCartQuantity = isControlled ? Number(cartQuantity || 0) : Number(localCartQuantity || 0);
  const stockQuantity = Number(product.stock_quantity || 0);
  const availableQty = Number(
    product.available_quantity ??
      Math.max(0, stockQuantity - Number(product.reserved_quantity || 0)),
  );
  const remainingStock = Math.max(0, availableQty - effectiveCartQuantity);
  const isOutOfStock = remainingStock <= 0;
  const hasInCart = effectiveCartQuantity > 0;
  const compareAtPrice = getProductCompareAtPrice(product);

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
    if (listingOnly) return;
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
    if (listingOnly) return;
    e.preventDefault();
    e.stopPropagation();
    if (onIncreaseQuantity) {
      onIncreaseQuantity(product);
      return;
    }
    const nextQty = effectiveCartQuantity + 1;
    if (nextQty > availableQty) return;
    cartService
      .updateCartItem(product.id, nextQty)
      .then(() => setLocalCartQuantity(nextQty))
      .catch(() => popup.error('ไม่สามารถอัปเดตจำนวนสินค้าได้'));
  };

  const handleDecrease = (e) => {
    if (listingOnly) return;
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

  const showCartChrome = !listingOnly && showCartInfo;

  const prepListingDetailNavigation = listingOnly ? captureListingScrollBeforeProductDetail : undefined;

  return (
    <div
      className={`product-card ${listingOnly ? 'product-card--browse' : ''} ${hasEntered ? 'is-entered' : ''}`}
    >
      <div className="product-image-container">
        <Link
          to={`/customer/products/${product.id}`}
          className="product-image-link"
          onClick={prepListingDetailNavigation}
        >
          <img
            src={pickProductImage(product, PLACEHOLDER_IMAGES.md)}
            alt={product.name}
            className="product-image"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = PLACEHOLDER_IMAGES.md;
            }}
          />
        </Link>
        {listingOnly && compareAtPrice != null && (
          <span className="product-special-badge">ลดราคา</span>
        )}
        {listingOnly && product.is_low_stock && availableQty > 0 && (
          <span className="product-low-stock-badge">สินค้าใกล้หมด</span>
        )}
        {!listingOnly && (
          <button
            className="product-image-add-btn"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            type="button"
          >
            {isOutOfStock ? 'หมด' : '+ ตะกร้า'}
          </button>
        )}
      </div>

      <Link
        to={`/customer/products/${product.id}`}
        className="product-link"
        onClick={prepListingDetailNavigation}
      >
        <div className="product-info">
          <h3 className="product-name" title={product.name}>{product.name}</h3>
          {!listingOnly && categoryLabel && (
            <p className="product-category-inline">• {categoryLabel}</p>
          )}
          {!listingOnly && <p className="product-description">{product.description}</p>}
          <div className={`product-price ${listingOnly ? 'product-price--browse' : ''}`}>
            {listingOnly ? (
              compareAtPrice != null ? (
                <div className="product-price-rows">
                  <div className="product-price-row">
                    <span className="product-price-caption">จาก</span>{' '}
                    <span className="product-price-compare-at">{formatBahtAmount(compareAtPrice)}</span>
                    <span className="product-price-unit product-price-unit--muted"> บาท</span>
                  </div>
                  <div className="product-price-row">
                    <span className="product-price-caption">เหลือ</span>{' '}
                    <span className="product-price-value product-price-value--sale">{formatBahtAmount(product.price)}</span>
                    <span className="product-price-unit"> บาท</span>
                  </div>
                </div>
              ) : (
                <>
                  <span className="product-price-value">{formatBahtAmount(product.price)}</span>
                  <span className="product-price-unit"> บาท</span>
                </>
              )
            ) : compareAtPrice != null ? (
              <span className="product-price-stack">
                <span className="product-price-compare-at">{formatPrice(compareAtPrice)}</span>
                <span className="product-price-current">{formatPrice(product.price)}</span>
              </span>
            ) : (
              formatPrice(product.price)
            )}
          </div>
          {!listingOnly && (
            <div className={`product-stock ${isOutOfStock ? 'out' : ''}`}>
              {isOutOfStock
                ? 'สินค้าหมด'
                : product.is_low_stock && availableQty > 0
                  ? 'สินค้าใกล้หมด · พร้อมสั่งซื้อ'
                  : 'พร้อมสั่งซื้อ'}
            </div>
          )}
        </div>
      </Link>
      
      {!listingOnly && (
        <div className="product-actions">
          <div className={`cart-meta-area ${showCartChrome ? '' : 'is-collapsed'}`}>
            {showCartChrome && hasInCart && (
              <div className="cart-status">
                <span className="cart-icon">🛒</span>
                <span>ในตะกร้า {effectiveCartQuantity} ชิ้น</span>
              </div>
            )}

            {showCartChrome && hasInCart && (
              <div className="cart-qty-editor">
                <button type="button" className="qty-btn" onClick={handleDecrease}>-</button>
                <span className="qty-value">{effectiveCartQuantity}</span>
                <button
                  type="button"
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
      )}
    </div>
  );
};

export default ProductCard;

