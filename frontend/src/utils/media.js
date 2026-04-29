import config from '../config';

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

  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const backendBase = config.LIFF_ENDPOINT_URL || config.API_BASE_URL || '';
  try {
    const base = new URL(backendBase, window.location.origin);
    return new URL(url, `${base.origin}/`).toString();
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

