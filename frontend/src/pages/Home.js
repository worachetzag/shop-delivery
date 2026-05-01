import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CategoryChipsRow from '../components/CategoryChipsRow';
import config from '../config';
import { productsService } from '../services/api';
import { useRestoreCustomerListingScroll } from '../utils/listingScrollRestore';
import './Home.css';

const SKELETON_CARD_COUNT = 6;
const SECTION_PAGE_SIZE = 24;

/** เรียงสินค้าลดราคา: % ส่วนลดสูงก่อน แล้วตามราคาขาย */
function discountSortWeight(product) {
  const cmp = product.compare_at_price != null ? Number(product.compare_at_price) : NaN;
  const sale = Number(product.price ?? 0);
  if (Number.isFinite(cmp) && cmp > sale && sale >= 0) {
    return (cmp - sale) / cmp;
  }
  if (product.is_special_offer) {
    return 0.0001;
  }
  return 0;
}

function sortPromoProducts(list) {
  return [...list].sort((a, b) => {
    const diff = discountSortWeight(b) - discountSortWeight(a);
    if (Math.abs(diff) > 1e-12) return diff;
    return Number(a.price ?? 0) - Number(b.price ?? 0);
  });
}

function HomePromotionCta({ url, label, className }) {
  const text = (label && label.trim()) || 'ดูเพิ่มเติม';
  if (!url || !url.trim()) return null;
  const u = url.trim();
  const internal = u.startsWith('/') && !u.startsWith('//');
  if (internal) {
    return (
      <Link to={u} className={className}>
        {text}
      </Link>
    );
  }
  return (
    <a href={u} className={className} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
}

const Home = () => {
  const location = useLocation();
  useRestoreCustomerListingScroll(location);

  const [categories, setCategories] = useState([]);
  const [homePromotions, setHomePromotions] = useState([]);
  const [featuredCategory, setFeaturedCategory] = useState('');
  const [promoCategory, setPromoCategory] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [promoProducts, setPromoProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [promoLoading, setPromoLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  const quickCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => c && c.id != null)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'))
        .slice(0, 8),
    [categories],
  );

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
      try {
        const raw = await productsService.getHomePromotions();
        if (cancelled) return;
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
        setHomePromotions(list);
      } catch (error) {
        console.error('Error fetching home promotions:', error);
        if (!cancelled) setHomePromotions([]);
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
        const params = {
          featured: 'true',
          page_size: SECTION_PAGE_SIZE,
          ordering: '-created_at',
        };
        if (featuredCategory) params.category_id = featuredCategory;

        const featuredResponse = await productsService.getProducts(params);
        if (cancelled) return;

        let products = featuredResponse.results || featuredResponse || [];
        products = Array.isArray(products) ? products : [];

        if (!featuredCategory && products.length === 0) {
          const fallbackResponse = await productsService.getProducts({
            page_size: 12,
            ordering: '-created_at',
          });
          if (cancelled) return;
          const fallbackList = fallbackResponse.results || fallbackResponse || [];
          products = Array.isArray(fallbackList) ? fallbackList : [];
        }

        setFeaturedProducts(products);
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
  }, [featuredCategory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPromoLoading(true);
      try {
        const params = {
          on_sale: 'true',
          page_size: SECTION_PAGE_SIZE,
          ordering: '-created_at',
        };
        if (promoCategory) params.category_id = promoCategory;

        const res = await productsService.getProducts(params);
        if (cancelled) return;

        let products = res.results || res || [];
        products = Array.isArray(products) ? products : [];
        setPromoProducts(sortPromoProducts(products));
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
  }, [promoCategory]);

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
            <p className="hero-subtitle">
              สั่งซื้อสินค้าผ่าน LINE ได้สะดวก พร้อมบริการจัดส่งถึงบ้าน
            </p>
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

      {quickCategories.length > 0 && (
        <section className="home-category-quick" aria-label="เลือกหมวดยอดนิยม">
          <div className="container">
            <p className="home-category-quick-label">เลือกหมวดยอดนิยม</p>
            <div className="home-category-quick-scroll">
              {quickCategories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/customer/products?category_id=${encodeURIComponent(String(cat.id))}`}
                  className="home-category-quick-pill"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {homePromotions.length > 0 && (
        <section className="home-dynamic-promotions home-product-section">
          <div className="container">
            <h2 className="section-title">โปรโมชั่น &amp; ข่าวสาร</h2>
            <p className="home-section-hint">ประกาศ โปรโมชั่น และข่าวสารจากทางร้าน</p>
            <div className="home-dynamic-promo-grid">
              {homePromotions.map((p) => (
                <article key={p.id} className="home-dynamic-promo-card">
                  {p.icon ? <div className="home-dynamic-promo-icon" aria-hidden>{p.icon}</div> : null}
                  <h3 className="home-dynamic-promo-title">{p.title}</h3>
                  {p.description ? <p className="home-dynamic-promo-desc">{p.description}</p> : null}
                  <HomePromotionCta
                    url={p.link_url}
                    label={p.link_label}
                    className="home-dynamic-promo-cta"
                  />
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="featured-products home-product-section">
        <div className="container">
          <h2 className="section-title">สินค้าแนะนำ</h2>
          <p className="home-section-hint">สินค้าที่ร้านเลือกให้โชว์บนหน้าแรก — เลือกหมวดเพื่อดูเฉพาะกลุ่มนั้น</p>
          <div className="home-chips-panel">
            <CategoryChipsRow
              categories={categories}
              value={featuredCategory}
              onChange={setFeaturedCategory}
              ariaLabel="หมวดหมู่ — สินค้าแนะนำ"
              fadeBg="#ffffff"
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
          <p className="home-section-hint">
            เรียงโดยสัดส่วนส่วนลดจากราคาก่อนลดก่อน — สินค้าที่มีป้ายราคาพิเศษอยู่ท้ายแถวเมื่อไม่มีราคาก่อนลด
          </p>
          <div className="home-chips-panel">
            <CategoryChipsRow
              categories={categories}
              value={promoCategory}
              onChange={setPromoCategory}
              ariaLabel="หมวดหมู่ — ราคาพิเศษและลดราคา"
              fadeBg="#ffffff"
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
    </div>
  );
};

export default Home;
