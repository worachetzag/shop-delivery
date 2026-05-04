import L from 'leaflet';
import './mapMarkers.css';

/** รถส่งของแบบบรรจุ — เติมล้อให้อ่านง่ายในขนาดเล็ก */
const DELIVERY_TRUCK_SVG =
  '<svg class="map-marker-delivery-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' +
  '<g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M2.5 17.25V11h8.75v6.25H2.5z"/>' +
  '<path d="M11.25 12.75h3.1l3.35-3.4H19.2c.55 0 1 .45 1 1v5.65h-9V12.75z"/>' +
  '<circle cx="7.1" cy="18.35" r="1.75" fill="currentColor" stroke="none"/>' +
  '<circle cx="17.5" cy="18.35" r="1.75" fill="currentColor" stroke="none"/>' +
  '</g></svg>';

/** ไอคอนรถส่งของสำหรับตำแหน่งคนขับ */
export function createDeliveryVehicleMarkerIcon() {
  return L.divIcon({
    className: 'map-marker-delivery-root',
    html: `<div class="map-marker-delivery-inner" aria-hidden="true">${DELIVERY_TRUCK_SVG}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -40],
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
