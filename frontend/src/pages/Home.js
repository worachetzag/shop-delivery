import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CategoryChipsRow from '../components/CategoryChipsRow';
import CustomerProductSortDropdown from '../components/CustomerProductSortDropdown';
import CustomerCategoryStrip from '../components/CustomerCategoryStrip';
import config from '../config';
import { productsService } from '../services/api';
import { useRestoreCustomerListingScroll } from '../utils/listingScrollRestore';
import { resolveMediaUrl } from '../utils/media';
import {
  PRODUCT_SORT_OPTIONS_STANDARD,
  PRODUCT_SORT_OPTION_CREATED_DESC,
  PRODUCT_SORT_OPTION_DISCOUNT_DESC,
  apiOrderingForSortKey,
  isDiscountDescSort,
} from '../utils/productSort';
import './Home.css';

/** จำนวนสินค้าที่แสดงต่อหมวดในหน้าแรก — ให้ลูกค้ากดดูทั้งหมดในหน้ารายการสินค้า */
const HOME_SECTION_PREVIEW_COUNT = 4;
/** โหลดชุดใหญ่พอสำหรับเรียงลดราคาในฝั่งลูกค้า แล้วค่อยตัดเหลือ HOME_SECTION_PREVIEW_COUNT */
const PROMO_SORT_POOL_PAGE_SIZE = 24;

const HOME_FEATURED_SORT_OPTIONS = [PRODUCT_SORT_OPTION_CREATED_DESC, ...PRODUCT_SORT_OPTIONS_STANDARD];
const HOME_PROMO_SORT_OPTIONS = [PRODUCT_SORT_OPTION_DISCOUNT_DESC, ...PRODUCT_SORT_OPTIONS_STANDARD];
const SKELETON_CARD_COUNT = HOME_SECTION_PREVIEW_COUNT;
/** โปรโมชั่นหน้าแรก: หน่วงก่อนเลื่อนไปสไลด์ถัดไป */
const HOME_PROMO_AUTO_ADVANCE_MS = 5500;

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

/** ถ้ามีสไลด์มากกว่านี้ ใช้ตัวเลขแทนจุดด้านล่าง — กันแถบจุดยาวเกิน */
const PROMO_MAX_DOT_INDICATORS = 4;

/** คลิกที่แบนเนอร์แล้วไปตามลิงก์ที่แอดมินตั้ง (ภายในแอปหรือภายนอก) */
function HomePromotionBannerLink({ url, className, children }) {
  const u = (url || '').trim();
  if (!u) {
    return <div className={`${className || ''} home-dynamic-promo-banner-link--static`.trim()}>{children}</div>;
  }
  const internal = u.startsWith('/') && !u.startsWith('//');
  if (internal) {
    return (
      <Link to={u} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={u} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function HomePromotionSlide({ promotion: p }) {
  const hasBanner = Boolean(p.banner_image);
  return (
    <article
      className={`home-dynamic-promo-card${hasBanner ? ' home-dynamic-promo-card--banner' : ' home-dynamic-promo-card--no-banner'}`}
    >
      {hasBanner ? (
        <>
          <HomePromotionBannerLink url={p.link_url} className="home-dynamic-promo-banner-link">
            <img
              src={resolveMediaUrl(p.banner_image)}
              alt={p.title || 'โปรโมชั่น'}
              className="home-dynamic-promo-banner-img"
              loading="lazy"
            />
          </HomePromotionBannerLink>
          {(p.title || p.description) ? (
            <div className="home-dynamic-promo-banner-meta">
              {p.title ? <h3 className="home-dynamic-promo-banner-heading">{p.title}</h3> : null}
              {p.description ? <p className="home-dynamic-promo-desc">{p.description}</p> : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="home-dynamic-promo-text-panel">
          {p.icon ? <div className="home-dynamic-promo-icon" aria-hidden>{p.icon}</div> : null}
          <h3 className="home-dynamic-promo-title">{p.title}</h3>
          {p.description ? <p className="home-dynamic-promo-desc">{p.description}</p> : null}
          <HomePromotionCta url={p.link_url} label={p.link_label} className="home-dynamic-promo-cta" />
        </div>
      )}
    </article>
  );
}

const Home = () => {
  const location = useLocation();
  useRestoreCustomerListingScroll(location);

  const [categories, setCategories] = useState([]);
  const [homePromotions, setHomePromotions] = useState([]);
  const [featuredCategory, setFeaturedCategory] = useState('');
  const [promoCategory, setPromoCategory] = useState('');
  const [featuredSort, setFeaturedSort] = useState('created-desc');
  const [promoSort, setPromoSort] = useState('discount-desc');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [promoProducts, setPromoProducts] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [promoLoading, setPromoLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [promoSlideIndex, setPromoSlideIndex] = useState(0);
  /** หยุด autoplay ช่วงโฟกัส/เมาส์บนพื้นที่โปร */
  const [promoHoverPaused, setPromoHoverPaused] = useState(false);
  /** หยุด autoplay ช่วงผู้ใช้เลื่อนด้วยนิ้ว/ล้อ — เลิกเลื่อนแล้วจะปิดอัตโนมัติหลัง idle */
  const [promoSwipePaused, setPromoSwipePaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const promoScrollRef = useRef(null);
  const skipPromoScrollSyncRef = useRef(false);
  /** true = ครั้งถัดไปที่โปรโมชั่นเปลี่ยนสไลด์ให้เลื่อนโดยโปรแกรม (autoplay / จุด / โหลดรายการใหม่) — ไม่ใช้เมื่อผู้ใช้เลื่อนมือ */
  const promoApplyScrollRef = useRef(false);
  const promoSwipeIdleTimerRef = useRef(null);

  const promoIdsKey = useMemo(() => homePromotions.map((p) => p.id).join(','), [homePromotions]);

  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (!mq) return undefined;
    setPrefersReducedMotion(mq.matches);
    const fn = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    promoApplyScrollRef.current = true;
    setPromoSlideIndex(0);
  }, [promoIdsKey]);

  useEffect(() => {
    return () => {
      if (promoSwipeIdleTimerRef.current) window.clearTimeout(promoSwipeIdleTimerRef.current);
    };
  }, []);

  const syncPromoSlideIndexFromScroll = useCallback(() => {
    const root = promoScrollRef.current;
    if (!root || skipPromoScrollSyncRef.current) return;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i];
      const d = Math.abs(el.offsetLeft - root.scrollLeft);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setPromoSlideIndex((prev) => (prev === best ? prev : best));
  }, []);

  const schedulePromoSwipeIdleResume = useCallback(() => {
    if (promoSwipeIdleTimerRef.current) window.clearTimeout(promoSwipeIdleTimerRef.current);
    promoSwipeIdleTimerRef.current = window.setTimeout(() => {
      promoSwipeIdleTimerRef.current = null;
      setPromoSwipePaused(false);
    }, 780);
  }, []);

  const handlePromoScroll = useCallback(() => {
    if (skipPromoScrollSyncRef.current) return;
    setPromoSwipePaused(true);
    schedulePromoSwipeIdleResume();
    window.requestAnimationFrame(syncPromoSlideIndexFromScroll);
  }, [schedulePromoSwipeIdleResume, syncPromoSlideIndexFromScroll]);

  const handlePromoTouchStart = useCallback(() => {
    setPromoSwipePaused(true);
    if (promoSwipeIdleTimerRef.current) {
      window.clearTimeout(promoSwipeIdleTimerRef.current);
      promoSwipeIdleTimerRef.current = null;
    }
  }, []);

  const handlePromoWheelHorizontal = useCallback(
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      handlePromoTouchStart();
    },
    [handlePromoTouchStart],
  );

  useEffect(() => {
    const root = promoScrollRef.current;
    if (!root || homePromotions.length <= 1) return undefined;
    if (!promoApplyScrollRef.current) return undefined;
    promoApplyScrollRef.current = false;
    const child = root.children[promoSlideIndex];
    if (!child) return undefined;
    skipPromoScrollSyncRef.current = true;
    root.scrollTo({
      left: child.offsetLeft,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
    const ms = prefersReducedMotion ? 80 : 520;
    const tid = window.setTimeout(() => {
      skipPromoScrollSyncRef.current = false;
    }, ms);
    return () => window.clearTimeout(tid);
  }, [promoSlideIndex, homePromotions.length, prefersReducedMotion, promoIdsKey]);

  useEffect(() => {
    if (homePromotions.length <= 1 || promoHoverPaused || promoSwipePaused || prefersReducedMotion) {
      return undefined;
    }
    const t = window.setInterval(() => {
      promoApplyScrollRef.current = true;
      setPromoSlideIndex((i) => (i + 1) % homePromotions.length);
    }, HOME_PROMO_AUTO_ADVANCE_MS);
    return () => window.clearInterval(t);
  }, [homePromotions.length, promoHoverPaused, promoSwipePaused, prefersReducedMotion, promoIdsKey]);

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
        const ordering = apiOrderingForSortKey(featuredSort);
        const params = {
          featured: 'true',
          page_size: HOME_SECTION_PREVIEW_COUNT,
          ordering,
        };
        if (featuredCategory) params.category_id = featuredCategory;

        const featuredResponse = await productsService.getProducts(params);
        if (cancelled) return;

        let products = featuredResponse.results || featuredResponse || [];
        products = Array.isArray(products) ? products : [];

        if (!featuredCategory && products.length === 0) {
          const fallbackResponse = await productsService.getProducts({
            page_size: HOME_SECTION_PREVIEW_COUNT,
            ordering,
          });
          if (cancelled) return;
          const fallbackList = fallbackResponse.results || fallbackResponse || [];
          products = Array.isArray(fallbackList) ? fallbackList : [];
        }

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

      <CustomerCategoryStrip categories={categories} />

      {homePromotions.length > 0 && (
        <section
          className="home-dynamic-promotions home-product-section"
          role="region"
          aria-roledescription="carousel"
          aria-label="โปรโมชั่นและข่าวสาร"
        >
          <div className="container">
            <h2 className="section-title">โปรโมชั่น &amp; ข่าวสาร</h2>
            <div
              className="home-dynamic-promo-carousel"
              onMouseEnter={() => setPromoHoverPaused(true)}
              onMouseLeave={() => setPromoHoverPaused(false)}
              onFocusCapture={() => setPromoHoverPaused(true)}
              onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setPromoHoverPaused(false);
              }}
            >
              {homePromotions.length === 1 ? (
                <div className="home-dynamic-promo-grid home-dynamic-promo-grid--single">
                  <HomePromotionSlide promotion={homePromotions[0]} />
                </div>
              ) : (
                <>
                  <div className="home-dynamic-promo-carousel-viewport home-dynamic-promo-carousel-viewport--scroll">
                    <div
                      ref={promoScrollRef}
                      className="home-dynamic-promo-scroll"
                      onScroll={handlePromoScroll}
                      onTouchStart={handlePromoTouchStart}
                      onWheel={handlePromoWheelHorizontal}
                      role="presentation"
                    >
                      {homePromotions.map((p) => (
                        <div key={p.id} className="home-dynamic-promo-scroll-slide">
                          <HomePromotionSlide promotion={p} />
                        </div>
                      ))}
                    </div>
                  </div>
                  {homePromotions.length <= PROMO_MAX_DOT_INDICATORS ? (
                    <div className="home-dynamic-promo-dots" role="tablist" aria-label="เลือกโปรโมชั่น">
                      {homePromotions.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          role="tab"
                          aria-selected={i === promoSlideIndex}
                          aria-label={`โปรโมชั่น ${i + 1} จาก ${homePromotions.length}`}
                          className={`home-dynamic-promo-dot${i === promoSlideIndex ? ' is-active' : ''}`}
                          onClick={() => {
                            if (promoSwipeIdleTimerRef.current) {
                              window.clearTimeout(promoSwipeIdleTimerRef.current);
                              promoSwipeIdleTimerRef.current = null;
                            }
                            setPromoSwipePaused(false);
                            promoApplyScrollRef.current = true;
                            setPromoSlideIndex(i);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="home-dynamic-promo-slide-counter" aria-live="polite">
                      {promoSlideIndex + 1} / {homePromotions.length}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

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
    </div>
  );
};

export default Home;
