import L from 'leaflet';
import './mapMarkers.css';

/** SVG สกูตเตอร์ — ไม่พึ่งฟอนต์ emoji */
const MOTORBIKE_SVG =
  '<svg class="map-marker-motorbike-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' +
  '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="7.5" cy="16.5" r="3"/>' +
  '<circle cx="16.5" cy="16.5" r="3"/>' +
  '<path d="M7.5 16.5 10 10h3l1.5 6.5M10 10 8.5 7h5L16 10"/>' +
  '</g></svg>';

/** ไอคอนรถมอเตอร์ไซค์ / สกูตเตอร์สำหรับตำแหน่งคนขับ */
export function createMotorbikeMarkerIcon() {
  return L.divIcon({
    className: 'map-marker-motorbike-root',
    html: `<div class="map-marker-motorbike-inner" aria-hidden="true">${MOTORBIKE_SVG}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -36],
  });
}

function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/"/g, '').trim();
}

/** จุดรับของ — รูปโปรไฟล์ลูกค้า (LINE) หรือตัวอักษรแรกของชื่อ */
export function createCustomerPhotoMarkerIcon(photoUrl, displayName) {
  const safeUrl = sanitizeUrl(photoUrl);
  const letterSource = (displayName || '?').trim();
  const letter = letterSource ? letterSource.charAt(0).toUpperCase() : '?';
  const inner = safeUrl
    ? `<img class="map-marker-customer-img" src="${safeUrl}" alt="" referrerpolicy="no-referrer" loading="lazy" />`
    : `<span class="map-marker-customer-letter">${letter}</span>`;

  return L.divIcon({
    className: 'map-marker-customer-root',
    html: `<div class="map-marker-customer-inner">${inner}</div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -44],
  });
}
