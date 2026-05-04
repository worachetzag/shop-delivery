import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { Link } from 'react-router-dom';
import { productsService } from '../services/api';
import { resolveMediaUrl } from '../utils/media';
import '../pages/Home.css';

/** โปรโมชั่นหน้าแรก: หน่วงก่อนเลื่อนไปสไลด์ถัดไป */
const HOME_PROMO_AUTO_ADVANCE_MS = 5500;
/** ถ้ามีสไลด์มากกว่านี้ ใช้ตัวเลขแทนจุดด้านล่าง */
const PROMO_MAX_DOT_INDICATORS = 4;

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

function HomePromotionBannerLink({ url, className, children }) {
  const u = (url || '').trim();
  if (!u) {
    return (
      <div className={`${className || ''} home-dynamic-promo-banner-link--static`.trim()}>
        {children}
      </div>
    );
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
              loading="eager"
              decoding="async"
              fetchPriority="high"
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

/**
 * แบนโปรโมชั่นชุดเดียวกับหน้าแรก — ใช้ในหน้าสินค้าและอื่น ๆ
 */
export default function CustomerHomePromotionsBanner({
  sectionClassName = 'home-dynamic-promotions home-product-section',
}) {
  const [homePromotions, setHomePromotions] = useState([]);
  const [promoSlideIndex, setPromoSlideIndex] = useState(0);
  const [promoHoverPaused, setPromoHoverPaused] = useState(false);
  const [promoSwipePaused, setPromoSwipePaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const promoScrollRef = useRef(null);
  const skipPromoScrollSyncRef = useRef(false);
  const promoApplyScrollRef = useRef(false);
  const promoSwipeIdleTimerRef = useRef(null);

  const promoIdsKey = useMemo(() => homePromotions.map((p) => p.id).join(','), [homePromotions]);
  const promoLoopSlides = useMemo(() => {
    if (homePromotions.length <= 1) return homePromotions;
    const first = homePromotions[0];
    const last = homePromotions[homePromotions.length - 1];
    return [last, ...homePromotions, first];
  }, [homePromotions]);

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
    const promoCount = homePromotions.length;
    if (promoCount <= 1) return;
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
    if (best === 0) {
      const lastReal = root.children[promoCount];
      if (lastReal) {
        skipPromoScrollSyncRef.current = true;
        root.scrollTo({ left: lastReal.offsetLeft, behavior: 'auto' });
        window.requestAnimationFrame(() => {
          skipPromoScrollSyncRef.current = false;
        });
      }
      setPromoSlideIndex(promoCount - 1);
      return;
    }
    if (best === promoCount + 1) {
      const firstReal = root.children[1];
      if (firstReal) {
        skipPromoScrollSyncRef.current = true;
        root.scrollTo({ left: firstReal.offsetLeft, behavior: 'auto' });
        window.requestAnimationFrame(() => {
          skipPromoScrollSyncRef.current = false;
        });
      }
      setPromoSlideIndex(0);
      return;
    }
    const logical = best - 1;
    setPromoSlideIndex((prev) => (prev === logical ? prev : logical));
  }, [homePromotions.length]);

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
    const child = root.children[promoSlideIndex + 1];
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

  if (homePromotions.length === 0) return null;

  return (
    <section
      className={sectionClassName}
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
                  {promoLoopSlides.map((p, idx) => (
                    <div key={`${p.id}-${idx}`} className="home-dynamic-promo-scroll-slide">
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
  );
}
