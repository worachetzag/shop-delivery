import L from 'leaflet';
import deliveryMarkerAssetUrl from '../assets/delivery-marker.svg';
import './mapMarkers.css';

function escapeAttr(url) {
  return String(url ?? '').replace(/"/g, '').trim();
}

/** ไอคอนคนขับบนแผนที่ — ใช้ artwork delivery.svg (ใน repo เป็น assets/delivery-marker.svg) */
export function createDeliveryVehicleMarkerIcon() {
  const src = escapeAttr(deliveryMarkerAssetUrl);
  return L.divIcon({
    className: 'map-marker-delivery-root',
    html:
      `<div class="map-marker-delivery-inner" aria-hidden="true">` +
      `<img class="map-marker-delivery-img" src="${src}" alt="" draggable="false" decoding="async" />` +
      `</div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -44],
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
