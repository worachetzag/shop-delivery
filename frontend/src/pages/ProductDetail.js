import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productsService, cartService } from '../services/api';
import { usePopup } from '../components/PopupProvider';
import { PLACEHOLDER_IMAGES, pickProductImage } from '../utils/media';
import { formatBahtAmount } from '../utils/formatPrice';
import { getProductCompareAtPrice } from '../utils/productPricing';
import { peekCustomerListingScrollRestore } from '../utils/listingScrollRestore';
import { displayProductLineName } from '../utils/helpers';
import CustomerInlineBack from '../components/CustomerInlineBack';
import './ProductDetail.css';

function relatedProductAvailableQty(item) {
  if (item?.available_quantity != null && item.available_quantity !== '') {
    return Math.max(0, Number(item.available_quantity));
  }
  return Math.max(0, Number(item?.stock_quantity || 0) - Number(item?.reserved_quantity || 0));
}

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  /** จำนวนที่แสดงในตัวเลือก — ถ้ายังไม่มีในตะกร้าเริ่มที่ 1 (เมื่อมีสต็อก) */
  const [qty, setQty] = useState(1);
  /** มีบรรทัดสินค้านี้ในตะกร้าแล้วหรือยัง (ใช้เลือก add vs update) */
  const [inCart, setInCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [cartPeekOpen, setCartPeekOpen] = useState(false);
  const [peekLoading, setPeekLoading] = useState(false);
  const [peekItems, setPeekItems] = useState([]);

  const resolveCategoryId = (p) => {
    if (!p) return undefined;
    if (p.category_id) return p.category_id;
    if (typeof p.category === 'object' && p.category?.id) return p.category.id;
    return undefined;
  };

  const resolveCategoryLabel = (p) => {
    if (!p?.category) return '';
    if (typeof p.category === 'string') return p.category;
    if (typeof p.category === 'object') {
      return p.category.name || '';
    }
    return '';
  };

  const numericProductId = useMemo(() => Number(productId), [productId]);

  const availStock = Number(
    product?.available_quantity ??
      Math.max(
        0,
        Number(product?.stock_quantity || 0) - Number(product?.reserved_quantity || 0),
      ),
  );

  const outOfStock = availStock <= 0;

  const persistQty = useCallback(
    async (targetQty) => {
      if (!product) return false;
      if (targetQty < 0 || targetQty > availStock) return false;
      setSubmitting(true);
      try {
        if (targetQty === 0) {
          await cartService.updateCartItem(product.id, 0);
          setInCart(false);
          setQty(availStock > 0 ? 1 : 0);
          return true;
        }
        if (!inCart) {
          await cartService.addToCart(product.id, targetQty);
          setInCart(true);
        } else {
          await cartService.updateCartItem(product.id, targetQty);
        }
        setQty(targetQty);
        return true;
      } catch (error) {
        popup.error(error?.error || 'ไม่สามารถอัปเดตตะกร้าได้');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [product, availStock, inCart, popup],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [productData, cartData] = await Promise.all([
          productsService.getProduct(numericProductId),
          cartService.getCart().catch(() => ({ items: [] })),
        ]);

        if (cancelled) return;

        setProduct(productData || null);

        const availInit =
          productData?.available_quantity != null && productData.available_quantity !== ''
            ? Math.max(0, Number(productData.available_quantity))
            : Math.max(
                0,
                Number(productData?.stock_quantity || 0) - Number(productData?.reserved_quantity || 0),
              );

        const items = Array.isArray(cartData?.items) ? cartData.items : [];
        const line = items.find((item) => Number(item.product_id || item.id) === numericProductId);
        const lineQty = Number(line?.quantity || 0);
        const hadLine = lineQty > 0;

        setInCart(hadLine);
        let nextQty = hadLine ? lineQty : availInit > 0 ? 1 : 0;
        if (nextQty > availInit) nextQty = availInit;
        if (!hadLine && availInit > 0 && nextQty < 1) nextQty = 1;
        setQty(nextQty);

        const relatedResponse = await productsService
          .getProducts({
            category_id: resolveCategoryId(productData),
            page_size: 24,
            ordering: 'name',
          })
          .catch(() => ({ results: [] }));
        const relatedList = Array.isArray(relatedResponse?.results)
          ? relatedResponse.results
          : Array.isArray(relatedResponse)
            ? relatedResponse
            : [];
        const filtered = relatedList.filter((item) => Number(item.id) !== numericProductId).slice(0, 18);
        setRelatedProducts(filtered);
      } catch (error) {
        if (!cancelled) {
          setProduct(null);
          setRelatedProducts([]);
          popup.error(error?.error || 'ไม่พบข้อมูลสินค้า');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [numericProductId, popup]);

  const openCartPeek = async () => {
    setCartPeekOpen(true);
    setPeekLoading(true);
    try {
      const data = await cartService.getCart();
      setPeekItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setPeekItems([]);
    } finally {
      setPeekLoading(false);
    }
  };

  const closeCartPeek = () => setCartPeekOpen(false);

  const peekSubtotal = peekItems.reduce(
    (sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0),
    0,
  );

  /** ปุ่มหลัก: ซิงก์จำนวนปัจจุบันเข้าตะกร้าแล้วย้อนกลับ — ไม่บวก +1 ซ้ำ */
  const handlePrimaryAddToCart = async () => {
    if (!product || submitting || outOfStock || qty <= 0) return;
    const ok = await persistQty(qty);
    if (!ok) return;
    const backToListing = peekCustomerListingScrollRestore();
    if (backToListing?.path) {
      navigate(backToListing.path);
    } else {
      navigate(-1);
    }
  };

  const bumpQty = async (delta) => {
    const next = qty + delta;
    if (next < 0 || next > availStock) return;
    await persistQty(next);
  };

  if (loading) {
    return <div className="loading">กำลังโหลดข้อมูลสินค้า...</div>;
  }

  if (!product) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <CustomerInlineBack />
          <div className="product-detail-empty">
            <h2>ไม่พบสินค้า</h2>
            <Link to="/customer/products" className="btn btn-primary">
              กลับไปหน้าสินค้า
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cartLineDisplayAmount = Number(product.price || 0) * Number(qty || 0);
  const detailCompareAt = getProductCompareAtPrice(product);

  return (
    <div className="product-detail-page">
      <div className="container">
        <CustomerInlineBack />
        <div className="product-detail-breadcrumb">
          <Link to="/customer/products">สินค้า</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <div className="product-detail-card">
          <div
            className={`product-detail-image-wrap${outOfStock ? ' product-detail-image-wrap--oos' : ''}`}
          >
            <img
              src={pickProductImage(product, PLACEHOLDER_IMAGES.xl)}
              alt={product.name}
              className={`product-detail-image${outOfStock ? ' product-detail-image--oos' : ''}`}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMAGES.xl;
              }}
            />
            {outOfStock ? (
              <div className="product-detail-oos-overlay" role="status">
                <span className="product-detail-oos-overlay__text">สินค้าจะมีเร็วๆนี้</span>
              </div>
            ) : null}
          </div>

          <div className="product-detail-info">
            <h1>{product.name}</h1>
            {!!resolveCategoryLabel(product) && (
              <p className="product-detail-category">หมวดหมู่: {resolveCategoryLabel(product)}</p>
            )}
            <p className="product-detail-price">
              {detailCompareAt != null ? (
                <>
                  <span className="product-detail-price-block">
                    <span className="product-detail-price-caption">จาก</span>{' '}
                    <span className="product-detail-price-compare">{formatBahtAmount(detailCompareAt)}</span>
                    <span className="product-detail-price-unit"> บาท</span>
                  </span>
                  <span className="product-detail-price-block">
                    <span className="product-detail-price-caption">เหลือ</span>{' '}
                    <span className="product-detail-price-value product-detail-price-value--sale">
                      {formatBahtAmount(product.price)}
                    </span>
                    <span className="product-detail-price-unit"> บาท</span>
                    {(product.unit_label || product.unit_detail) && (
                      <span className="product-detail-price-meta">
                        {' '}/ {product.unit_label || 'ชิ้น'}
                        {product.unit_detail ? ` (${product.unit_detail})` : ''}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span className="product-detail-price-amount">
                  <span className="product-detail-price-value">{formatBahtAmount(product.price)}</span>
                  <span className="product-detail-price-unit"> บาท</span>
                  {(product.unit_label || product.unit_detail) && (
                    <span className="product-detail-price-meta">
                      {' '}/ {product.unit_label || 'ชิ้น'}
                      {product.unit_detail ? ` (${product.unit_detail})` : ''}
                    </span>
                  )}
                </span>
              )}
            </p>
            <p className="product-detail-stock-note">
              จำนวนสินค้ามีการเปลี่ยนแปลง ตามจำนวนคงเหลือของร้าน
            </p>
            <p className={`product-detail-stock ${outOfStock ? 'out' : ''}`}>
              {outOfStock
                ? 'สินค้าหมด'
                : product.is_low_stock && availStock > 0
                  ? 'สินค้าใกล้หมด · พร้อมสั่งซื้อ'
                  : 'พร้อมสั่งซื้อ'}
            </p>
            <p className="product-detail-description">{product.description || 'ไม่มีรายละเอียดสินค้า'}</p>

            <div className="product-detail-actions">
              <div className="product-detail-qty">
                <button type="button" disabled={submitting || qty <= 0} onClick={() => bumpQty(-1)}>
                  −
                </button>
                <span>{qty}</span>
                <button type="button" disabled={submitting || outOfStock || qty >= availStock} onClick={() => bumpQty(1)}>
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary product-detail-add-cart-btn"
                disabled={submitting || outOfStock || qty <= 0}
                onClick={handlePrimaryAddToCart}
              >
                ใส่ตะกร้า {formatBahtAmount(cartLineDisplayAmount)} บาท
              </button>
              <button type="button" className="btn btn-outline product-detail-cart-peek-btn" onClick={openCartPeek}>
                ดูตะกร้า
              </button>
            </div>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <section className="related-products-section">
            <h2>สินค้าที่เกี่ยวข้อง</h2>
            <div
              className="related-products-scroll"
              role="region"
              aria-label="สินค้าที่เกี่ยวข้อง — เลื่อนดูด้านข้าง"
            >
              {relatedProducts.map((item) => {
                const relCmp = getProductCompareAtPrice(item);
                const relOos = relatedProductAvailableQty(item) <= 0;
                return (
                  <Link key={item.id} to={`/customer/products/${item.id}`} className="related-product-card">
                    <div
                      className={`related-product-image-wrap${relOos ? ' related-product-image-wrap--oos' : ''}`}
                    >
                      {relCmp != null && <span className="related-product-badge">ลดราคา</span>}
                      <img
                        src={pickProductImage(item, PLACEHOLDER_IMAGES.lg)}
                        alt={item.name}
                        onError={(e) => {
                          e.currentTarget.src = PLACEHOLDER_IMAGES.lg;
                        }}
                      />
                      {relOos ? (
                        <div className="related-product-oos-overlay" role="status">
                          <span className="related-product-oos-overlay__text">สินค้าจะมีเร็วๆนี้</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="related-product-info">
                      <div className="related-product-name">{item.name}</div>
                      <div className="related-product-price">
                        {relCmp != null && (
                          <span className="related-product-price-compare">{formatBahtAmount(relCmp)} </span>
                        )}
                        <span
                          className={`related-product-price-value${relCmp != null ? ' related-product-price-value--sale' : ''}`}
                        >
                          {formatBahtAmount(item.price)}
                        </span>
                        <span className="related-product-price-unit"> บาท</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {cartPeekOpen && (
        <div className="product-cart-peek-backdrop" role="presentation" onClick={closeCartPeek}>
          <div
            className="product-cart-peek-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-cart-peek-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="product-cart-peek-header">
              <h2 id="product-cart-peek-title">ตะกร้าของคุณ</h2>
              <button type="button" className="product-cart-peek-close" aria-label="ปิด" onClick={closeCartPeek}>
                ×
              </button>
            </div>
            <div className="product-cart-peek-body">
              {peekLoading ? (
                <p className="product-cart-peek-muted">กำลังโหลด...</p>
              ) : peekItems.length === 0 ? (
                <p className="product-cart-peek-muted">ยังไม่มีสินค้าในตะกร้า</p>
              ) : (
                <ul className="product-cart-peek-list">
                  {peekItems.map((line) => (
                    <li key={line.id ?? `${line.product_id}-${displayProductLineName(line)}`}>
                      <span className="product-cart-peek-name">{displayProductLineName(line)}</span>
                      <span className="product-cart-peek-meta">
                        x{Number(line.quantity || 0)} · {formatBahtAmount(Number(line.price || 0) * Number(line.quantity || 0))}{' '}
                        บาท
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!peekLoading && peekItems.length > 0 && (
                <p className="product-cart-peek-total">
                  รวม <strong>{formatBahtAmount(peekSubtotal)}</strong> บาท
                </p>
              )}
            </div>
            <div className="product-cart-peek-actions">
              <Link to="/customer/cart" className="btn btn-primary product-cart-peek-full-link" onClick={closeCartPeek}>
                ไปหน้าตะกร้าเต็ม
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
