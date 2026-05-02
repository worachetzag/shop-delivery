import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { usePopup } from './PopupProvider';
import './AddressPicker.css';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function parseCoord(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const n = typeof value === 'number' ? value : parseFloat(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** ดึงรหัสไปรษณีย์ 5 หลักจากข้อความ (เช่น display_name ของ Nominatim) */
function extractPostcodeFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const segments = text.split(',').map((s) => s.trim());
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d{5}$/.test(segments[i])) return segments[i];
  }
  const all = text.match(/\b\d{5}\b/g);
  return all && all.length ? all[all.length - 1] : '';
}

/** แยกที่อยู่หลักจากผล Nominatim (รองรับไทย / OSM ที่ไม่มีเลขที่-ถนนชัด) */
function buildAddressFromNominatim(data) {
  const a = data.address || {};
  const firstNonEmpty = (keys) => {
    for (const k of keys) {
      const v = a[k];
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  };

  let streetLine = [
    [a.house_number, a.road].filter(Boolean).join(' ').trim(),
    [a.house_number, a.pedestrian].filter(Boolean).join(' ').trim(),
    a.road,
    a.pedestrian,
    a.residential,
  ]
    .map((s) => (s && String(s).trim()) || '')
    .find(Boolean);

  if (!streetLine) {
    streetLine = firstNonEmpty([
      'neighbourhood',
      'quarter',
      'suburb',
      'village',
      'hamlet',
      'city_block',
    ]);
  }

  const district = firstNonEmpty([
    'city_district',
    'district',
    'suburb',
    'county',
    'municipality',
    'quarter',
    'neighbourhood',
  ]);

  const province = firstNonEmpty([
    'state',
    'province',
    'region',
    'city',
    'town',
    'county',
  ]);

  let postalCode =
    (a.postcode && String(a.postcode).trim()) ||
    (a.postal_code && String(a.postal_code).trim()) ||
    '';
  if (!postalCode && data.display_name) {
    postalCode = extractPostcodeFromText(data.display_name);
  }

  if (!streetLine && data.display_name) {
    const chunks = data.display_name.split(',').map((s) => s.trim()).filter(Boolean);
    streetLine = chunks.slice(0, 2).join(', ');
  }

  return {
    address: streetLine || '',
    district,
    province,
    postalCode,
  };
}

/** เลื่อน/ซูมแผนที่ไปจุดที่เลือก (คลิก, ค้นหา, GPS, โหลดที่อยู่เดิม) */
function MapFlyToSelection({ lat, lon, zoom = 17 }) {
  const map = useMap();
  const prevKeyRef = useRef(null);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (prevKeyRef.current === key) return;
    const isFirst = prevKeyRef.current === null;
    prevKeyRef.current = key;
    if (isFirst) {
      map.setView([lat, lon], zoom, { animate: false });
    } else {
      map.flyTo([lat, lon], zoom, { duration: 0.45 });
    }
  }, [lat, lon, zoom, map]);

  return null;
}

/** คลิกบนแผนที่เพื่อเลือกจุด */
function MapClickSelect({ onPick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onPick(lat, lng);
    },
  });
  return null;
}

const AddressPicker = ({
  onLocationSelect,
  onAddressSelect,
  initialLat = 13.7563,
  initialLon = 100.5018,
  /** โหลดปุ๊บ ขอพิกัดอุปกรณ์แล้วย้ายหมุดมาที่ตำแหน่งผู้ใช้ (ใช้เมื่อยังไม่มีพิกัดที่บันทึกไว้) */
  autoLocateOnMount = false,
}) => {
  const popup = usePopup();
  const [selectedLat, setSelectedLat] = useState(() => parseCoord(initialLat, 13.7563));
  const [selectedLon, setSelectedLon] = useState(() => parseCoord(initialLon, 100.5018));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState('');
  const handleLocationSelectRef = useRef(null);

  useEffect(() => {
    setSelectedLat(parseCoord(initialLat, 13.7563));
    setSelectedLon(parseCoord(initialLon, 100.5018));
  }, [initialLat, initialLon]);

  // Reverse geocoding → กรอกฟอร์มที่อยู่ (ตำแหน่งปัจจุบัน / คลิกแผนที่ / ค้นหา)
  const getAddressFromCoords = useCallback(
    async (lat, lon) => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/reverse?format=json` +
          `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` +
          `&addressdetails=1&accept-language=th,en&zoom=18`;
        const response = await fetch(url, {
          headers: {
            Accept: 'application/json',
          },
        });
        if (!response.ok) return '';

        const data = await response.json();
        const parsed = buildAddressFromNominatim(data);

        if (onAddressSelect && (parsed.address || parsed.district || parsed.province || parsed.postalCode)) {
          onAddressSelect(parsed);
        }

        let summary =
          parsed.address ||
          [parsed.district, parsed.province].filter(Boolean).join(' ') ||
          (data.display_name ? data.display_name.split(',').slice(0, 3).join(', ') : '');
        if (parsed.postalCode) {
          summary = summary
            ? `${summary} · รหัสไปรษณีย์ ${parsed.postalCode}`
            : `รหัสไปรษณีย์ ${parsed.postalCode}`;
        }
        return summary;
      } catch (error) {
        console.error('Error fetching address:', error);
        return '';
      }
    },
    [onAddressSelect],
  );

  const handleLocationSelect = useCallback(
    async (lat, lon) => {
      const latN = parseCoord(lat, 13.7563);
      const lonN = parseCoord(lon, 100.5018);
      setSelectedLat(latN);
      setSelectedLon(lonN);

      const summary = await getAddressFromCoords(latN, lonN);
      setAddress(summary);

      if (onLocationSelect) {
        onLocationSelect(latN, lonN);
      }
      return summary;
    },
    [onLocationSelect, getAddressFromCoords],
  );

  handleLocationSelectRef.current = handleLocationSelect;

  useEffect(() => {
    if (!autoLocateOnMount) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const fn = handleLocationSelectRef.current;
        if (fn) {
          await fn(position.coords.latitude, position.coords.longitude);
        }
        if (!cancelled) setIsLoading(false);
      },
      () => {
        if (!cancelled) setIsLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 120000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [autoLocateOnMount]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      popup.info('เบราว์เซอร์ของคุณไม่รองรับการใช้งาน GPS');
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const summary = await handleLocationSelect(lat, lon);
        setIsLoading(false);
        if (summary) {
          popup.info('กรอกที่อยู่จากตำแหน่งปัจจุบันแล้ว — กรุณาตรวจสอบก่อนบันทึก');
        } else {
          popup.info('ได้พิกัดแล้ว แต่ดึงข้อความที่อยู่ไม่สำเร็จ — กรุณากรอกที่อยู่เอง');
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        popup.error('ไม่สามารถค้นหาตำแหน่งได้ กรุณาอนุญาตให้เข้าถึงตำแหน่ง');
        setIsLoading(false);
      }
    );
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&accept-language=th`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const mapLat = parseFloat(lat);
        const mapLon = parseFloat(lon);
        await handleLocationSelect(mapLat, mapLon);
      }
    } catch (error) {
      console.error('Error searching location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="address-picker-wrap">
      <div className="address-picker-toolbar">
        <input
          type="text"
          className="address-picker-search-input"
          placeholder="ค้นหาที่อยู่..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          aria-label="ค้นหาที่อยู่"
        />
        <button
          type="button"
          className="address-picker-tool-btn address-picker-tool-btn--gps"
          onClick={handleGetCurrentLocation}
          disabled={isLoading}
          title="ใช้ GPS หาตำแหน่งปัจจุบัน"
        >
          📍
        </button>
        <button
          type="button"
          className="address-picker-tool-btn address-picker-tool-btn--search"
          onClick={handleSearch}
          disabled={isLoading}
          title="ค้นหา"
        >
          {isLoading ? '⏳' : '🔍'}
        </button>
      </div>

      <div className="address-picker-map-shell">
        <MapContainer
          center={[selectedLat, selectedLon]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MapFlyToSelection lat={selectedLat} lon={selectedLon} zoom={17} />
        <MapClickSelect onPick={handleLocationSelect} />
        <Marker position={[selectedLat, selectedLon]}>
          <Popup>
            📍 จุดจัดส่งที่เลือก
            <br />
            Lat: {Number.isFinite(selectedLat) ? selectedLat.toFixed(6) : '—'}
            <br />
            Lon: {Number.isFinite(selectedLon) ? selectedLon.toFixed(6) : '—'}
          </Popup>
        </Marker>
        </MapContainer>
      </div>

      <div className="address-picker-footer">
        <div style={{ marginBottom: '5px' }}>
          <strong>📍 พิกัด:</strong>{' '}
        {Number.isFinite(selectedLat) ? selectedLat.toFixed(6) : '—'},{' '}
        {Number.isFinite(selectedLon) ? selectedLon.toFixed(6) : '—'}
        </div>
        {address && (
          <div style={{ color: '#00B900', fontWeight: 'bold' }}>
            🏠 {address}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressPicker;

