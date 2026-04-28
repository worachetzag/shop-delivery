import config from '../config';

export const PLACEHOLDER_IMAGES = {
  sm: 'https://via.placeholder.com/80x80/f8f9fa/6c757d?text=No+Image',
  md: 'https://via.placeholder.com/100x100/f8f9fa/6c757d?text=No+Image',
  lg: 'https://via.placeholder.com/300x200/f8f9fa/6c757d?text=No+Image',
  xl: 'https://via.placeholder.com/600x400/f8f9fa/6c757d?text=No+Image',
};

export function resolveMediaUrl(rawUrl, fallback = PLACEHOLDER_IMAGES.md) {
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;
  if (/^(https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  const backendBase = config.LIFF_ENDPOINT_URL || config.API_BASE_URL || '';
  try {
    const base = new URL(backendBase, window.location.origin);
    return new URL(rawUrl, `${base.origin}/`).toString();
  } catch (error) {
    return rawUrl;
  }
}

