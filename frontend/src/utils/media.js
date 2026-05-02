import config from '../config';

/**
 * Origin ของ backend ที่เก็บไฟล์ /media/ — ใช้จาก API_BASE_URL เท่านั้น
 * (ห้ามใช้ LIFF_ENDPOINT_URL: ถ้าเป็น liff.line.me การต่อ path /media/... จะพัง แต่รูปสินค้าที่ได้ absolute URL จาก API ยังดูปกติ)
 */
function backendOriginForMediaUrls() {
  const api = config.API_BASE_URL || '';
  if (!api) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  if (api.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  const trimmed = api.replace(/\/+$/, '');
  let withoutApi = trimmed;
  if (trimmed.endsWith('/api')) withoutApi = trimmed.slice(0, -4);
  else if (trimmed.endsWith('/api/')) withoutApi = trimmed.replace(/\/api\/$/, '');
  try {
    return new URL(withoutApi).origin;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
}

/**
 * บังคับให้ทุก URL ภายใต้ /media/ ใช้ origin เดียวกับ API (จาก REACT_APP_API_BASE_URL)
 * แก้ 404 เมื่อ JSON มี absolute URL จากโฮสต์ผิด หรือต่อ path บนโดเมนหน้าเว็บคนละตัวกับ backend
 */
function normalizeMediaUrlForApiOrigin(input) {
  const s = String(input || '').trim();
  if (!s) return s;
  try {
    const origin = backendOriginForMediaUrls();
    let pathname = '';
    let search = '';
    let hash = '';

    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      pathname = u.pathname;
      search = u.search;
      hash = u.hash;
      if (!pathname.startsWith('/media/')) {
        return s;
      }
      return `${origin}${pathname}${search}${hash}`;
    }
    if (s.startsWith('//')) {
      const u = new URL(`https:${s}`);
      pathname = u.pathname;
      search = u.search;
      hash = u.hash;
      if (!pathname.startsWith('/media/')) {
        return s;
      }
      return `${origin}${pathname}${search}${hash}`;
    }
    if (s.startsWith('/media/')) {
      return new URL(s, `${origin}/`).toString();
    }
    return s;
  } catch {
    return s;
  }
}

export const PLACEHOLDER_IMAGES = {
  sm: 'https://via.placeholder.com/80x80/f8f9fa/6c757d?text=No+Image',
  md: 'https://via.placeholder.com/100x100/f8f9fa/6c757d?text=No+Image',
  lg: 'https://via.placeholder.com/300x200/f8f9fa/6c757d?text=No+Image',
  xl: 'https://via.placeholder.com/600x400/f8f9fa/6c757d?text=No+Image',
};

/** รับได้ทั้งสตริง URL หรืออ็อบเจ็กต์ `{ url }` จาก serializer */
export function resolveMediaUrl(rawUrl, fallback = PLACEHOLDER_IMAGES.md) {
  let url = '';
  if (!rawUrl) return fallback;
  if (typeof rawUrl === 'string') url = rawUrl.trim();
  else if (typeof rawUrl === 'object' && typeof rawUrl.url === 'string') url = rawUrl.url.trim();
  if (!url) return fallback;

  url = normalizeMediaUrlForApiOrigin(url);
  if (!url) return fallback;

  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const origin = backendOriginForMediaUrls();
  try {
    return new URL(url, `${origin}/`).toString();
  } catch (error) {
    return url;
  }
}

/** รูปจากข้อมูลสินค้า (หน้ารายการสินค้า / รายละเอียด) */
export function pickProductImage(product, fallback = PLACEHOLDER_IMAGES.md) {
  if (!product) return fallback;
  const candidates = [
    product.image,
    product.image_url,
    product.thumbnail,
    product.cover_image,
  ];
  const hit = candidates.find((value) => {
    if (!value) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object' && typeof value.url === 'string') return value.url.trim().length > 0;
    return false;
  });
  if (!hit) return fallback;
  return resolveMediaUrl(hit, fallback);
}

/** รูปจากบรรทัดออเดอร์ / ตะกร้า — ครอบคลุมหลายรูปแบบจาก API */
export function pickLineItemImage(lineItem, fallback = PLACEHOLDER_IMAGES.md) {
  if (!lineItem) return fallback;
  const candidates = [
    lineItem.product_image,
    lineItem.product?.image,
    lineItem.product?.image_url,
    lineItem.product?.thumbnail,
    lineItem.image_url,
    lineItem.image,
  ];
  const hit = candidates.find((value) => {
    if (!value) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'object' && typeof value.url === 'string') return value.url.trim().length > 0;
    return false;
  });
  if (!hit) return fallback;
  return resolveMediaUrl(hit, fallback);
}

