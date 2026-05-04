import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CategoryChipsRow from '../components/CategoryChipsRow';
import CustomerProductSortDropdown from '../components/CustomerProductSortDropdown';
import CustomerCategoryStrip from '../components/CustomerCategoryStrip';
import CustomerServiceHoursStrip from '../components/CustomerServiceHoursStrip';
import CustomerFloatingCart from '../components/CustomerFloatingCart';
import CustomerHomePromotionsBanner from '../components/CustomerHomePromotionsBanner';
import { usePopup } from '../components/PopupProvider';
import config from '../config';
import { productsService, cartService } from '../services/api';
import { useRestoreCustomerListingScroll } from '../utils/listingScrollRestore';
import {
  PRODUCT_SORT_OPTIONS_STANDARD,
  PRODUCT_SORT_OPTION_CREATED_DESC,
  PRODUCT_SORT_OPTION_DISCOUNT_DESC,
  apiOrderingForSortKey,
  availabilitySortKey,
  isDiscountDescSort,
  isProductInStock,
} from '../utils/productSort';
import './Home.css';

/** จำนวนสินค้าที่แสดงต่อหมวดในหน้าแรก — ให้ลูกค้ากดดูทั้งหมดในหน้ารายการสินค้า */
const HOME_SECTION_PREVIEW_COUNT = 4;
/** โหลดชุดใหญ่พอสำหรับเรียงลดราคาในฝั่งลูกค้า แล้วกรองหมดสต็อก ตัดเหลือ HOME_SECTION_PREVIEW_COUNT */
const PROMO_SORT_POOL_PAGE_SIZE = 48;
/** ดึงแนะนำชุดใหญ่แล้วตัดของหมดออก เพื่อให้เหลือการ์ดครบช่วงพรีวิวได้ */
const HOME_FEATURED_FETCH_POOL_SIZE = 48;

const HOME_FEATURED_SORT_OPTIONS = [PRODUCT_SORT_OPTION_CREATED_DESC, ...PRODUCT_SORT_OPTIONS_STANDARD];
const HOME_PROMO_SORT_OPTIONS = [PRODUCT_SORT_OPTION_DISCOUNT_DESC, ...PRODUCT_SORT_OPTIONS_STANDARD];
const SKELETON_CARD_COUNT = HOME_SECTION_PREVIEW_COUNT;

/** เรียงสินค้าลดราคา: % ส่วนลดจากราคาก่อนลดสูงก่อน แล้วตามราคาขาย */
function discountSortWeight(product) {
  const cmp = product.compare_at_price != null ? Number(product.compare_at_price) : NaN;
  const sale = Number(product.price ?? 0);
  if (Number.isFinite(cmp) && cmp > sale && sale >= 0) {
    return (cmp - sale) / cmp;
  }
  return 0;
}

function sortPromoProducts(list) {
  return [...list].sort((a, b) => {
    const stockDiff = availabilitySortKey(a) - availabilitySortKey(b);
    if (stockDiff !== 0) return stockDiff;
    const diff = discountSortWeight(b) - discountSortWeight(a);
    if (Math.abs(diff) > 1e-12) return diff;
    return Number(a.price ?? 0) - Number(b.price ?? 0);
  });
}

const Home = () => {
  const location = useLocation();
  useRestoreCustomerListingScroll(location);
  const popup = usePopup();

  const [categories, setCategories] = useState([]);
  const [featuredCategory, setFeaturedCategory] = useState('');
  const [promoCategory, setPromoCategory] = useState('');
  const [featuredSort, setFeaturedSort] = useState('created-desc');
  const [promoSort, setPromoSort] = useState('discount-desc');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [promoProducts, setPromoProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [promoLoading, setPromoLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const readCartCache = () => {
    try {
      const raw = localStorage.getItem('products_cart_quantities');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const [cartQuantities, setCartQuantities] = useState(readCartCache);
  const [cartLineItems, setCartLineItems] = useState([]);
  const [showCartSummary, setShowCartSummary] = useState(false);

  const syncCartQuantities = useCallback(async () => {
    try {
      const cartResponse = await cartService.getCart();
      const items = cartResponse.items || [];
      setCartLineItems(Array.isArray(items) ? items : []);
      const quantityMap = {};
      items.forEach((item) => {
        quantityMap[item.product_id || item.id] = Number(item.quantity || 0);
      });
      setCartQuantities(quantityMap);
    } catch (error) {
      console.error('Cart sync failed:', error);
    }
  }, []);

  useEffect(() => {
    syncCartQuantities();
  }, [syncCartQuantities]);

  useEffect(() => {
    try {
      localStorage.setItem('products_cart_quantities', JSON.stringify(cartQuantities));
    } catch (error) {
      // ignore
    }
  }, [cartQuantities]);

  const handleCartIncreaseQuantity = async (product) => {
    const currentQty = Number(cartQuantities[product.id] || 0);
    const nextQty = currentQty + 1;
    if (nextQty > Number(product.stock_quantity || 0)) {
      return;
    }
    try {
      await cartService.updateCartItem(product.id, nextQty);
      setCartQuantities((prev) => ({ ...prev, [product.id]: nextQty }));
      await syncCartQuantities();
    } catch (error) {
      console.error('Error increasing quantity:', error);
      popup.error(error?.error || 'ไม่สามารถอัปเดตจำนวนสินค้าได้');
    }
  };

  const handleCartDecreaseQuantity = async (product) => {
    const currentQty = Number(cartQuantities[product.id] || 0);
    if (currentQty <= 0) {
      return;
    }
    const nextQty = currentQty - 1;
    try {
      await cartService.updateCartItem(product.id, nextQty);
      setCartQuantities((prev) => {
        const next = { ...prev };
        if (nextQty <= 0) {
          delete next[product.id];
        } else {
          next[product.id] = nextQty;
        }
        return next;
      });
      await syncCartQuantities();
    } catch (error) {
      console.error('Error decreasing quantity:', error);
      popup.error(error?.error || 'ไม่สามารถอัปเดตจำนวนสินค้าได้');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const categoriesResponse = await productsService.getCategories();
        if (cancelled) return;
        const raw = categoriesResponse?.results ?? categoriesResponse;
        const list = Array.isArray(raw) ? raw : [];
        setCategories(list);
      } catch (error) {
        console.error('Error fetching categories:', error);
        if (!cancelled) setCategories([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFeaturedLoading(true);
      setPageError(null);
      try {
        const ordering = apiOrderingForSortKey(featuredSort);
        const params = {
          featured: 'true',
          page_size: HOME_FEATURED_FETCH_POOL_SIZE,
          ordering,
        };
        if (featuredCategory) params.category_id = featuredCategory;

        const featuredResponse = await productsService.getProducts(params);
        if (cancelled) return;

        let products = featuredResponse.results || featuredResponse || [];
        products = Array.isArray(products) ? products : [];

        if (!featuredCategory && products.length === 0) {
          const fallbackResponse = await productsService.getProducts({
            page_size: HOME_FEATURED_FETCH_POOL_SIZE,
            ordering,
          });
          if (cancelled) return;
          const fallbackList = fallbackResponse.results || fallbackResponse || [];
          products = Array.isArray(fallbackList) ? fallbackList : [];
        }

        products = products.filter(isProductInStock);
        setFeaturedProducts(products.slice(0, HOME_SECTION_PREVIEW_COUNT));
      } catch (error) {
        console.error('Error fetching featured products:', error);
        if (!cancelled) {
          setFeaturedProducts([]);
          setPageError(error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        }
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [featuredCategory, featuredSort]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPromoLoading(true);
      try {
        const ordering = apiOrderingForSortKey(promoSort);
        const params = {
          on_sale: 'true',
          page_size: PROMO_SORT_POOL_PAGE_SIZE,
          ordering,
        };
        if (promoCategory) params.category_id = promoCategory;

        const res = await productsService.getProducts(params);
        if (cancelled) return;

        let products = res.results || res || [];
        products = Array.isArray(products) ? products : [];
        products = products.filter(isProductInStock);
        const sliced = isDiscountDescSort(promoSort)
          ? sortPromoProducts(products).slice(0, HOME_SECTION_PREVIEW_COUNT)
          : products.slice(0, HOME_SECTION_PREVIEW_COUNT);
        setPromoProducts(sliced);
      } catch (error) {
        console.error('Error fetching promo products:', error);
        if (!cancelled) setPromoProducts([]);
      } finally {
        if (!cancelled) setPromoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [promoCategory, promoSort]);

  const renderSkeleton = (keyPrefix) => (
    <div className="products-grid">
      {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
        <div key={`${keyPrefix}-sk-${index}`} className="product-card-skeleton" aria-hidden="true">
          <div className="product-card-skeleton-image" />
          <div className="product-card-skeleton-body">
            <div className="product-card-skeleton-line name" />
            <div className="product-card-skeleton-line price" />
          </div>
        </div>
      ))}
    </div>
  );

  if (pageError && !featuredLoading) {
    return (
      <div className="error home-error-fallback">
        <h3>เกิดข้อผิดพลาด</h3>
        <p>{pageError}</p>
        <button type="button" onClick={() => window.location.reload()}>
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="home">
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              ยินดีต้อนรับสู่ร้าน{config.BRANDING.storeName}
            </h1>
            <div className="hero-actions">
              <Link to="/customer/products" className="btn btn-primary">
                ดูสินค้าทั้งหมด
              </Link>
              <Link to="/customer/orders" className="btn btn-outline">
                ติดตามคำสั่งซื้อ
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <CustomerServiceHoursStrip />
      </div>

      <CustomerCategoryStrip categories={categories} />

      <CustomerHomePromotionsBanner />

      <section className="featured-products home-product-section">
        <div className="container">
          <h2 className="section-title">สินค้าแนะนำ</h2>
          <div className="home-section-toolbar">
            <div className="home-chips-panel">
              <CategoryChipsRow
                categories={categories}
                value={featuredCategory}
                onChange={setFeaturedCategory}
                ariaLabel="หมวดหมู่ — สินค้าแนะนำ"
                fadeBg="#ffffff"
              />
            </div>
            <CustomerProductSortDropdown
              className="customer-sort--compact"
              options={HOME_FEATURED_SORT_OPTIONS}
              value={featuredSort}
              onChange={setFeaturedSort}
            />
          </div>
          {featuredLoading ? (
            renderSkeleton('feat')
          ) : (
            <div className="products-grid">
              {featuredProducts.length > 0 ? (
                featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} listingOnly />
                ))
              ) : (
                <p className="home-section-empty">ไม่มีสินค้าแนะนำในหมวดนี้</p>
              )}
            </div>
          )}
          <div className="home-section-footer home-section-footer--split">
            <Link to="/customer/products?featured=true" className="btn btn-primary">
              ดูสินค้าแนะนำทั้งหมด
            </Link>
            <Link to="/customer/products" className="btn btn-outline">
              ดูสินค้าทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      <section className="home-promo-products home-product-section">
        <div className="container">
          <h2 className="section-title">ราคาพิเศษ &amp; ลดราคา</h2>
          <div className="home-section-toolbar">
            <div className="home-chips-panel">
              <CategoryChipsRow
                categories={categories}
                value={promoCategory}
                onChange={setPromoCategory}
                ariaLabel="หมวดหมู่ — ราคาพิเศษและลดราคา"
                fadeBg="#ffffff"
              />
            </div>
            <CustomerProductSortDropdown
              className="customer-sort--compact"
              options={HOME_PROMO_SORT_OPTIONS}
              value={promoSort}
              onChange={setPromoSort}
            />
          </div>
          {promoLoading ? (
            renderSkeleton('promo')
          ) : (
            <div className="products-grid">
              {promoProducts.length > 0 ? (
                promoProducts.map((product) => (
                  <ProductCard key={`promo-${product.id}`} product={product} listingOnly />
                ))
              ) : (
                <p className="home-section-empty">ไม่มีสินค้าในหมวดนี้</p>
              )}
            </div>
          )}
          <div className="home-section-footer">
            <Link to="/customer/products?on_sale=true" className="btn btn-outline">
              ดูสินค้าลดราคาทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      <CustomerFloatingCart
        cartLineItems={cartLineItems}
        cartQuantities={cartQuantities}
        showCartSummary={showCartSummary}
        setShowCartSummary={setShowCartSummary}
        onIncreaseQuantity={handleCartIncreaseQuantity}
        onDecreaseQuantity={handleCartDecreaseQuantity}
      />
    </div>
  );
};

export default Home;
