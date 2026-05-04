import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import CustomerCategoryStrip from '../components/CustomerCategoryStrip';
import { productsService, cartService } from '../services/api';
import './Products.css';
import { usePopup } from '../components/PopupProvider';
import { useRestoreCustomerListingScroll } from '../utils/listingScrollRestore';
import CustomerProductSortDropdown from '../components/CustomerProductSortDropdown';
import CustomerServiceHoursStrip from '../components/CustomerServiceHoursStrip';
import CustomerFloatingCart from '../components/CustomerFloatingCart';
import { PRODUCT_SORT_OPTIONS_STANDARD, apiOrderingForSortKey } from '../utils/productSort';

const PAGE_SIZE = 12;
const SKELETON_CARD_COUNT = 8;

function ProductsTrustStrip() {
  return (
    <div className="products-trust-strip">
      <div className="products-trust-strip__item">
        <span className="products-trust-strip__glyph" aria-hidden>🛒</span>
        <span className="products-trust-strip__label">เลือกง่ายในหน้าเดียว</span>
      </div>
      <div className="products-trust-strip__item">
        <span className="products-trust-strip__glyph" aria-hidden>📦</span>
        <span className="products-trust-strip__label">จัดส่งถึงที่พัก</span>
      </div>
      <div className="products-trust-strip__item">
        <span className="products-trust-strip__glyph" aria-hidden>💳</span>
        <span className="products-trust-strip__label">ชำระเงินปลอดภัย</span>
      </div>
    </div>
  );
}

function ProductsResultsHeading({ id }) {
  return (
    <header className="products-results-head">
      <h2 id={id} className="products-results-head__title">
        สินค้าในร้าน
      </h2>
      <p className="products-results-head__hint">
        เลื่อนลงเพื่อโหลดสินค้าเพิ่ม — แตะการ์ดเพื่อขยายรายละเอียด
      </p>
    </header>
  );
}

const Products = () => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const onSaleOnly = searchParams.get('on_sale') === 'true';
  const featuredOnly = searchParams.get('featured') === 'true';
  const categoryIdFromUrl = searchParams.get('category_id') || '';
  useRestoreCustomerListingScroll(location);
  const popup = usePopup();
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

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState('name-asc');
  const [cartQuantities, setCartQuantities] = useState(readCartCache);
  const [cartLineItems, setCartLineItems] = useState([]);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [listReady, setListReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  /** ไม่ใช้ pagination ใน URL — ลบพารามิเตอร์ page เก่า */
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (!sp.has('page')) return prev;
        sp.delete('page');
        return sp;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const fetchGenerationRef = useRef(0);
  const nextPageRef = useRef(2);
  const loadingMoreLockRef = useRef(false);
  const loadMoreRef = useRef(() => {});
  const sentinelRef = useRef(null);

  const categoryStripHref = useCallback(
    (categoryId) => {
      const next = new URLSearchParams(searchParams);
      if (categoryId) next.set('category_id', categoryId);
      else next.delete('category_id');
      const qs = next.toString();
      return qs ? `/customer/products?${qs}` : '/customer/products';
    },
    [searchParams],
  );

  /** ทั้งหมด | ลดราคา | แนะนำ — เก็บ category_id จาก URL ไว้ */
  const setQuickFilter = useCallback(
    (mode) => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          sp.delete('page');
          if (mode === 'all') {
            sp.delete('on_sale');
            sp.delete('featured');
          } else if (mode === 'sale') {
            sp.set('on_sale', 'true');
            sp.delete('featured');
          } else if (mode === 'featured') {
            sp.set('featured', 'true');
            sp.delete('on_sale');
          }
          return sp;
        },
        { replace: true },
      );
    },
    [setSearchParams],
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

  const buildProductParams = useCallback(
    (pageNum) => {
      const ordering = apiOrderingForSortKey(sortBy);
      const params = { page: pageNum, page_size: PAGE_SIZE, ordering };
      if (categoryIdFromUrl) params.category_id = categoryIdFromUrl;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (onSaleOnly) params.on_sale = 'true';
      if (featuredOnly) params.featured = 'true';
      return params;
    },
    [sortBy, categoryIdFromUrl, debouncedSearch, onSaleOnly, featuredOnly],
  );

  useEffect(() => {
    let cancelled = false;
    const gen = ++fetchGenerationRef.current;
    nextPageRef.current = 2;
    setLoading(true);
    setHasMore(false);

    (async () => {
      try {
        const productsResponse = await productsService.getProducts(buildProductParams(1));
        if (cancelled || gen !== fetchGenerationRef.current) return;

        const list = productsResponse.results || productsResponse;
        const arr = Array.isArray(list) ? list : [];
        setProducts(arr);
        setHasMore(Boolean(productsResponse.next));
      } catch (error) {
        console.error('Error fetching products:', error);
        if (!cancelled && gen === fetchGenerationRef.current) {
          setProducts([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled && gen === fetchGenerationRef.current) {
          setLoading(false);
          setListReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryIdFromUrl, debouncedSearch, sortBy, onSaleOnly, featuredOnly, buildProductParams]);

  const loadMoreProducts = useCallback(async () => {
    if (!hasMore || loading || loadingMoreLockRef.current) return;
    const gen = fetchGenerationRef.current;
    const pageNum = nextPageRef.current;
    loadingMoreLockRef.current = true;
    setLoadingMore(true);
    try {
      const productsResponse = await productsService.getProducts(buildProductParams(pageNum));
      if (gen !== fetchGenerationRef.current) return;

      const list = productsResponse.results || productsResponse;
      const arr = Array.isArray(list) ? list : [];
      setProducts((prev) => [...prev, ...arr]);
      setHasMore(Boolean(productsResponse.next));
      nextPageRef.current = pageNum + 1;
    } catch (error) {
      console.error('Error loading more products:', error);
      popup.error(typeof error === 'string' ? error : 'โหลดสินค้าเพิ่มไม่สำเร็จ');
    } finally {
      loadingMoreLockRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, buildProductParams, popup]);

  loadMoreRef.current = loadMoreProducts;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return undefined;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        loadMoreRef.current();
      },
      { root: null, rootMargin: '280px', threshold: 0 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, products.length]);

  const syncCartQuantities = async () => {
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
  };

  useEffect(() => {
    syncCartQuantities();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('products_cart_quantities', JSON.stringify(cartQuantities));
    } catch (error) {
      // Ignore storage write errors.
    }
  }, [cartQuantities]);

  const handleIncreaseQuantity = async (product) => {
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

  const handleDecreaseQuantity = async (product) => {
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

  if (!listReady) {
    return (
      <div className="products-page">
        <div className="container">
          <header className="products-hero">
            <div className="products-hero__inner">
              <h1 className="products-hero__title">สินค้าทั้งหมด</h1>
              <p className="products-hero__subtitle">
                เลือกหมวดหมู่ ค้นหา หรือกรองโปรโมชัน — แตะการ์ดเพื่อดูรายละเอียด
              </p>
            </div>
          </header>
          <CustomerServiceHoursStrip compact />
          <ProductsTrustStrip />
          <div className="results-section">
            <ProductsResultsHeading id="products-list-heading" />
            <div className="products-grid">
              {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
                <div key={`products-skeleton-${index}`} className="product-card-skeleton" aria-hidden="true">
                  <div className="product-card-skeleton-image" />
                  <div className="product-card-skeleton-body">
                    <div className="product-card-skeleton-line name" />
                    <div className="product-card-skeleton-line price" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="container">
        <header className="products-hero">
          <div className="products-hero__inner">
            <h1 className="products-hero__title">สินค้าทั้งหมด</h1>
            <p className="products-hero__subtitle">
              เลือกหมวดหมู่ ค้นหา หรือกรองโปรโมชัน — แตะการ์ดเพื่อดูรายละเอียด
            </p>
          </div>
        </header>

        <CustomerServiceHoursStrip compact />
        <ProductsTrustStrip />

        <div className="filters-section">
          <div className="filters-section__label">ค้นหาและกรอง</div>
          <div className="search-box">
            <span className="products-search-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM21 21l-4.35-4.35"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <input
              type="search"
              enterKeyHint="search"
              placeholder="ค้นหาชื่อสินค้า..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input products-search-input"
              aria-label="ค้นหาสินค้า"
            />
          </div>

          <div className="products-quick-filters" role="group" aria-label="กรองสินค้า">
            <button
              type="button"
              className={`products-filter-chip ${!onSaleOnly && !featuredOnly ? 'is-active' : ''}`}
              onClick={() => setQuickFilter('all')}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              className={`products-filter-chip products-filter-chip--sale ${onSaleOnly ? 'is-active' : ''}`}
              onClick={() => setQuickFilter('sale')}
            >
              ลดราคา
            </button>
            <button
              type="button"
              className={`products-filter-chip products-filter-chip--featured ${featuredOnly ? 'is-active' : ''}`}
              onClick={() => setQuickFilter('featured')}
            >
              แนะนำ
            </button>
          </div>

          {categories.length > 0 ? (
            <CustomerCategoryStrip
              categories={categories}
              showSeeAllLink={false}
              showAllTile
              selectedCategoryId={categoryIdFromUrl}
              resolveHref={categoryStripHref}
              headingId="products-category-strip-heading"
              noOuterContainer
            />
          ) : null}

          <div className="filters filters-sort-only">
            <CustomerProductSortDropdown
              options={PRODUCT_SORT_OPTIONS_STANDARD}
              value={sortBy}
              onChange={setSortBy}
            />
          </div>
        </div>

        <div className="results-section">
          <ProductsResultsHeading id="products-list-heading" />
          {loading && products.length === 0 ? (
            <div className="products-loading-inline" aria-live="polite">
              <div className="products-loading-inline__dots" aria-hidden>
                <span className="products-loading-inline__dot" />
                <span className="products-loading-inline__dot" />
                <span className="products-loading-inline__dot" />
              </div>
              <span className="products-loading-inline__text">กำลังโหลดสินค้า</span>
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="products-grid">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} listingOnly />
                ))}
              </div>
              {loadingMore ? (
                <div className="products-loading-more" role="status" aria-live="polite">
                  <div className="products-loading-inline__dots" aria-hidden>
                    <span className="products-loading-inline__dot" />
                    <span className="products-loading-inline__dot" />
                    <span className="products-loading-inline__dot" />
                  </div>
                  <span className="products-loading-more__text">กำลังโหลดเพิ่ม…</span>
                </div>
              ) : null}
              {hasMore ? <div ref={sentinelRef} className="products-infinite-sentinel" aria-hidden /> : null}
            </>
          ) : (
            <div className="no-results">
              <div className="no-results-card">
                <div className="no-results-icon" aria-hidden>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM21 21l-4.35-4.35"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="no-results-title">ยังไม่พบสินค้า</h3>
                <p className="no-results-hint">ลองเปลี่ยนคำค้นหา เลือกหมวดอื่น หรือกด «ทั้งหมด»</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <CustomerFloatingCart
        cartLineItems={cartLineItems}
        cartQuantities={cartQuantities}
        showCartSummary={showCartSummary}
        setShowCartSummary={setShowCartSummary}
        onIncreaseQuantity={handleIncreaseQuantity}
        onDecreaseQuantity={handleDecreaseQuantity}
      />
    </div>
  );
};

export default Products;
