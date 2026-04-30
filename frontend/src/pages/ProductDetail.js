import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productsService, cartService } from '../services/api';
import { usePopup } from '../components/PopupProvider';
import { PLACEHOLDER_IMAGES, pickProductImage } from '../utils/media';
import { formatBahtAmount } from '../utils/formatPrice';
import { peekCustomerListingScrollRestore } from '../utils/listingScrollRestore';
import './ProductDetail.css';

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [cartQty, setCartQty] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);

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
        const relatedResponse = await productsService.getProducts({
          category_id: resolveCategoryId(productData),
          page_size: 24,
          ordering: 'name',
        }).catch(() => ({ results: [] }));
        const relatedList = Array.isArray(relatedResponse?.results)
          ? relatedResponse.results
          : (Array.isArray(relatedResponse) ? relatedResponse : []);
        const filtered = relatedList.filter((item) => Number(item.id) !== numericProductId).slice(0, 18);
        setRelatedProducts(filtered);

        const items = Array.isArray(cartData?.items) ? cartData.items : [];
        const line = items.find((item) => Number(item.product_id || item.id) === numericProductId);
        setCartQty(Number(line?.quantity || 0));
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

  const stock = Number(product?.stock_quantity || 0);
  const outOfStock = Math.max(0, stock - Number(cartQty || 0)) <= 0;

  const updateQty = async (nextQty) => {
    if (!product) return;
    if (nextQty < 0 || nextQty > stock) return;
    setSubmitting(true);
    try {
      if (nextQty === 0) {
        await cartService.updateCartItem(product.id, 0);
      } else if (cartQty === 0) {
        await cartService.addToCart(product.id, nextQty);
      } else {
        await cartService.updateCartItem(product.id, nextQty);
      }
      setCartQty(nextQty);
    } catch (error) {
      popup.error(error?.error || 'ไม่สามารถอัปเดตตะกร้าได้');
    } finally {
      setSubmitting(false);
    }
  };

  /** Primary CTA: add one piece then return to previous listing scroll position */
  const handlePrimaryAddToCart = async () => {
    if (!product || submitting || outOfStock) return;
    const nextQty = cartQty + 1;
    if (nextQty > stock) return;
    setSubmitting(true);
    try {
      if (cartQty === 0) {
        await cartService.addToCart(product.id, nextQty);
      } else {
        await cartService.updateCartItem(product.id, nextQty);
      }
      setCartQty(nextQty);
      const backToListing = peekCustomerListingScrollRestore();
      if (backToListing?.path) {
        navigate(backToListing.path);
      } else {
        navigate(-1);
      }
    } catch (error) {
      popup.error(error?.error || 'ไม่สามารถอัปเดตตะกร้าได้');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">กำลังโหลดข้อมูลสินค้า...</div>;
  }

  if (!product) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <div className="product-detail-empty">
            <h2>ไม่พบสินค้า</h2>
            <Link to="/customer/products" className="btn btn-primary">กลับไปหน้าสินค้า</Link>
          </div>
        </div>
      </div>
    );
  }

  const cartLineDisplayAmount =
    Number(product.price || 0) * Math.max(Number(cartQty || 0), 1);

  return (
    <div className="product-detail-page">
      <div className="container">
        <div className="product-detail-breadcrumb">
          <Link to="/customer/products">สินค้า</Link>
          <span>/</span>
          <span>{product.name}</span>
        </div>

        <div className="product-detail-card">
          <div className="product-detail-image-wrap">
            <img
              src={pickProductImage(product, PLACEHOLDER_IMAGES.xl)}
              alt={product.name}
              className="product-detail-image"
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER_IMAGES.xl;
              }}
            />
          </div>

          <div className="product-detail-info">
            <h1>{product.name}</h1>
            {!!resolveCategoryLabel(product) && (
              <p className="product-detail-category">หมวดหมู่: {resolveCategoryLabel(product)}</p>
            )}
            <p className="product-detail-price">
              <span className="product-detail-price-value">{formatBahtAmount(product.price)}</span>
              <span className="product-detail-price-unit"> บาท</span>
              {(product.unit_label || product.unit_detail) && (
                <span className="product-detail-price-meta">
                  {' '}/ {product.unit_label || 'ชิ้น'}
                  {product.unit_detail ? ` (${product.unit_detail})` : ''}
                </span>
              )}
            </p>
            <p className="product-detail-stock-note">
              จำนวนสินค้ามีการเปลี่ยนแปลง ตามจำนวนคงเหลือของร้าน
            </p>
            <p className={`product-detail-stock ${outOfStock ? 'out' : ''}`}>
              {outOfStock ? 'สินค้าหมด' : 'พร้อมสั่งซื้อ'}
            </p>
            <p className="product-detail-description">{product.description || 'ไม่มีรายละเอียดสินค้า'}</p>

            <div className="product-detail-actions">
              <div className="product-detail-qty">
                <button type="button" disabled={submitting || cartQty <= 0} onClick={() => updateQty(cartQty - 1)}>-</button>
                <span>{cartQty}</span>
                <button type="button" disabled={submitting || outOfStock} onClick={() => updateQty(cartQty + 1)}>+</button>
              </div>
              <button
                type="button"
                className="btn btn-primary product-detail-add-cart-btn"
                disabled={submitting || outOfStock}
                onClick={handlePrimaryAddToCart}
              >
                ใส่ตะกร้า {formatBahtAmount(cartLineDisplayAmount)} บาท
              </button>
              <Link to="/customer/cart" className="btn btn-outline">ไปตะกร้า</Link>
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
              {relatedProducts.map((item) => (
                <Link key={item.id} to={`/customer/products/${item.id}`} className="related-product-card">
                  <div className="related-product-image-wrap">
                    {item.is_special_offer && (
                      <span className="related-product-badge">ราคาพิเศษ</span>
                    )}
                    <img
                      src={pickProductImage(item, PLACEHOLDER_IMAGES.lg)}
                      alt={item.name}
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER_IMAGES.lg;
                      }}
                    />
                  </div>
                  <div className="related-product-info">
                    <div className="related-product-name">{item.name}</div>
                    <div className="related-product-price">
                      <span className="related-product-price-value">{formatBahtAmount(item.price)}</span>
                      <span className="related-product-price-unit"> บาท</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
