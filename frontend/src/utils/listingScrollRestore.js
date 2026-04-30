import { useLayoutEffect } from 'react';

const STORAGE_KEY = 'customerListingScrollRestore';

/** Read captured listing path/scroll without clearing (used after add-to-cart from detail). */
export function peekCustomerListingScrollRestore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.path !== 'string') return null;
    return { path: data.path, y: Number(data.y) };
  } catch (_) {
    return null;
  }
}

/** Call before navigating from Home / Products into product detail (listing tiles only). */
export function captureListingScrollBeforeProductDetail() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        path: `${window.location.pathname}${window.location.search || ''}`,
        y: window.scrollY,
      })
    );
  } catch (_) {
    // ignore quota / private mode
  }
}

/** Restore vertical scroll after returning from detail (e.g. navigate(-1)). */
export function useRestoreCustomerListingScroll(location) {
  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const current = `${location.pathname}${location.search || ''}`;
      if (data.path !== current) return;
      sessionStorage.removeItem(STORAGE_KEY);
      const y = Number(data.y);
      requestAnimationFrame(() => {
        window.scrollTo(0, Number.isFinite(y) ? y : 0);
      });
    } catch (_) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch (_e) {
        // ignore
      }
    }
  }, [location.pathname, location.search, location.key]);
}
