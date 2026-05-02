/**
 * Deep links จาก LINE Rich Menu / LIFF — path หลังล็อกอิน OAuth (ให้สอดคล้องกับ backend _sanitize_line_oauth_next)
 * @returns {string}
 */
export function sanitizeCustomerOAuthNext(raw) {
  const defaultNext = '/customer';
  if (raw == null || raw === '') return defaultNext;
  try {
    let full = typeof raw === 'string' ? decodeURIComponent(raw.trim()) : String(raw).trim();
    if (!full) return defaultNext;
    if (!full.startsWith('/')) full = `/${full}`;
    if (/^(https?:)?\/\//i.test(full)) return defaultNext;
    const [pathPart, restQuery = ''] = full.split('?');
    const base = pathPart.split('#')[0];
    if (base.includes('..')) return defaultNext;
    const lowerBase = base.toLowerCase();
    if (lowerBase === '/customer') {
      const q = restQuery.split('#')[0];
      return q ? `/customer?${q}` : '/customer';
    }
    if (lowerBase.startsWith('/customer/') && !lowerBase.startsWith('/customer/login')) {
      const q = restQuery.split('#')[0];
      return q ? `${base}?${q}` : base;
    }
    return defaultNext;
  } catch {
    return defaultNext;
  }
}

/** Rich Menu / LIFF: คีย์ ?page= (ตัวพิมพ์เล็ก) — เมื่อเปิดแค่ /customer path เต็มอาจถูก LINE ตัด */
export const LIFF_PAGE_ROUTES = {
  home: '/customer',
  shop: '/customer/products',
  products: '/customer/products',
  cart: '/customer/cart',
  checkout: '/customer/checkout',
  orders: '/customer/orders',
  tracking: '/customer/orders',
  profile: '/customer/profile',
  login: '/customer/login',
};

function getQueryParamInsensitive(searchParams, name) {
  const want = name.toLowerCase();
  for (const [k, v] of searchParams.entries()) {
    if (k.toLowerCase() === want) return v;
  }
  return null;
}

/** LINE บางครั้งใช้คีย์คลุมเครือ เช่น liff.state */
function getLiffStateRaw(searchParams) {
  return getQueryParamInsensitive(searchParams, 'liff.state');
}

function routeForPageKey(routeMap, key) {
  const k = (key || '').trim().toLowerCase();
  return k ? routeMap[k] || null : null;
}

function parseLiffStateRoute(rawState, routeMap) {
  let decoded = rawState;
  try {
    decoded = decodeURIComponent(rawState);
  } catch {
    return null;
  }

  const trimmed = decoded.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      const p =
        obj.page || obj.Page || obj.screen || obj.target;
      const fromJson = routeForPageKey(routeMap, typeof p === 'string' ? p : '');
      if (fromJson) return fromJson;
    } catch {
      /* ignore */
    }
  }

  const noHash = decoded.split('#')[0];
  const qIdx = noHash.indexOf('?');
  const pathPart = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
  let queryPart = qIdx >= 0 ? noHash.slice(qIdx + 1) : '';
  if (!queryPart && /[=]/.test(pathPart) && !pathPart.includes('/')) {
    queryPart = pathPart;
  }

  const fromQuery = routeForPageKey(
    routeMap,
    getQueryParamInsensitive(new URLSearchParams(queryPart), 'page'),
  );
  if (fromQuery) return fromQuery;

  const segments = pathPart.replace(/^\/+/, '').split('/').filter(Boolean);
  const lastSeg = segments[segments.length - 1] || '';
  const fromPath = routeForPageKey(routeMap, lastSeg);
  if (fromPath) return fromPath;

  return null;
}

function routeFromHash(hash, routeMap) {
  if (!hash || hash.length <= 1) return null;
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const qIdx = h.indexOf('?');
  const querySlice = qIdx >= 0 ? h.slice(qIdx + 1) : (h.includes('=') ? h : '');
  if (!querySlice) return null;
  const hp = new URLSearchParams(querySlice);
  return routeForPageKey(routeMap, getQueryParamInsensitive(hp, 'page'));
}

/** ลบพารามิเตอร์ที่ใช้สำหรับเปิดหน้าจาก LINE — ใช้หลัง consume deep link / OAuth callback */
export function stripCustomerRoutingParams(params) {
  for (const k of [...params.keys()]) {
    const kl = k.toLowerCase();
    if (kl === 'page' || kl === 'liff.state' || kl === 'next' || kl === 'liff.compact') {
      params.delete(k);
    }
  }
}

/**
 * รวม query string เดิม (หลังลบคีย์คำขอเปิดหน้า) เข้ากับปลายทางที่ได้จาก page/next
 */
function mergePreservedQuery(destWithoutLeadingAmbiguity, preservedSearchParams) {
  const qIdx = destWithoutLeadingAmbiguity.indexOf('?');
  const base = qIdx >= 0 ? destWithoutLeadingAmbiguity.slice(0, qIdx) : destWithoutLeadingAmbiguity;
  const destQs = qIdx >= 0 ? destWithoutLeadingAmbiguity.slice(qIdx + 1) : '';
  const merged = new URLSearchParams(destQs);
  preservedSearchParams.forEach((value, key) => {
    merged.set(key, value);
  });
  const ms = merged.toString();
  return ms ? `${base}?${ms}` : base;
}

/**
 * @returns {string|null} pathname + optional search — เต็ม relative URL หลัง resolve
 */
export function resolveCustomerDeepLink(pathname, search, hash) {
  const params = new URLSearchParams(search);

  const pageVal = getQueryParamInsensitive(params, 'page');
  const fromPage = routeForPageKey(LIFF_PAGE_ROUTES, pageVal);
  if (fromPage) {
    stripCustomerRoutingParams(params);
    const qs = params.toString();
    return qs ? `${fromPage}?${qs}` : fromPage;
  }

  const rawState = getLiffStateRaw(params);
  if (rawState) {
    const fromState = parseLiffStateRoute(rawState, LIFF_PAGE_ROUTES);
    if (fromState) {
      stripCustomerRoutingParams(params);
      const qs = params.toString();
      return qs ? `${fromState}?${qs}` : fromState;
    }
  }

  const fromHash = routeFromHash(hash, LIFF_PAGE_ROUTES);
  if (fromHash) {
    stripCustomerRoutingParams(params);
    const qs = params.toString();
    return qs ? `${fromHash}?${qs}` : fromHash;
  }

  const nextRaw = getQueryParamInsensitive(params, 'next');
  const pathNorm = pathname.replace(/\/+$/, '') || '/';
  const allowNext =
    pathNorm === '/customer'
    || pathNorm === '/liff'
    || pathNorm === '/'
    || pathNorm === '/customer/login';
  if (nextRaw && allowNext) {
    const sanitized = sanitizeCustomerOAuthNext(nextRaw);
    stripCustomerRoutingParams(params);
    return mergePreservedQuery(sanitized, params);
  }

  return null;
}
