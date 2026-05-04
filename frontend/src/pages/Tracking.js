import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import config from '../config';
import { displayProductLineName } from '../utils/helpers';
import { PLACEHOLDER_IMAGES, pickLineItemImage } from '../utils/media';
import 'leaflet/dist/leaflet.css';
import CustomerInlineBack from '../components/CustomerInlineBack';
import { AdminBackLink } from '../components/AdminBackButton';
import { createCustomerPhotoMarkerIcon, createMotorbikeMarkerIcon } from '../utils/mapMarkers';
import './Tracking.css';

/** ไอคอนรถส่งของในการ์ดคนขับ — ไม่ใช้รูปโปรไฟล์ */
function DriverDeliveryAvatarGlyph() {
  return (
    <svg
      className="driver-delivery-svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden={true}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 15V9h11v6H2z" />
        <path d="M13 11h5l4 4v6h-3" />
        <circle cx="7.5" cy="18.5" r="2" />
        <circle cx="17.5" cy="18.5" r="2" />
      </g>
    </svg>
  );
}

/** เมื่อมีทั้งพิกัดคนขับและจุดรับของ — ซูมกรอบให้เห็นทั้งสองหมุด (และเส้นทางถ้ามี) */
function TrackingMapFitBoth({
  active,
  driverLat,
  driverLng,
  deliveryLat,
  deliveryLng,
  routePositions,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !active
      || driverLat == null
      || driverLng == null
      || deliveryLat == null
      || deliveryLng == null
    ) {
      return;
    }
    const da = Number(driverLat);
    const db = Number(driverLng);
    const ca = Number(deliveryLat);
    const cb = Number(deliveryLng);
    if ([da, db, ca, cb].some((n) => Number.isNaN(n))) return;

    const bounds = L.latLngBounds([da, db], [ca, cb]);

    if (Array.isArray(routePositions) && routePositions.length > 0) {
      routePositions.forEach((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return;
        const lat = Number(pt[0]);
        const lng = Number(pt[1]);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) bounds.extend([lat, lng]);
      });
    }

    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [52, 52], maxZoom: 17 });
    };

    requestAnimationFrame(fit);
    const retry = window.setTimeout(fit, 200);
    return () => window.clearTimeout(retry);
  }, [map, active, driverLat, driverLng, deliveryLat, deliveryLng, routePositions]);

  return null;
}

const Tracking = () => {
  const { orderId } = useParams();
  const location = useLocation();
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routePath, setRoutePath] = useState([]);
  const [routeMeta, setRouteMeta] = useState(null);
  const isAdminTracking = location.pathname.startsWith('/admin/');

  useEffect(() => {
    let intervalId = null;

    const fetchTrackingInfo = async () => {
      try {
        if (!orderId) {
          setLoading(false);
          return;
        }

        const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
        const response = await fetch(`${config.API_BASE_URL}orders/${orderId}/driver-tracking/`, {
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Tracking data:', data);
          
          const transformedTrackingInfo = {
            orderId: data.order_id,
            trackingNumber: data.order_number || `#${data.order_id}`,
            status: data.order_status,
            currentLocation: data.current_location_text || 'กำลังจัดส่ง',
            currentLatitude: data.current_latitude !== null && data.current_latitude !== undefined ? Number(data.current_latitude) : null,
            currentLongitude: data.current_longitude !== null && data.current_longitude !== undefined ? Number(data.current_longitude) : null,
            deliveryLatitude: data.delivery_latitude !== null && data.delivery_latitude !== undefined ? Number(data.delivery_latitude) : null,
            deliveryLongitude: data.delivery_longitude !== null && data.delivery_longitude !== undefined ? Number(data.delivery_longitude) : null,
            lastLocationAt: data.last_location_at,
            customerPhotoUrl: data.customer_photo_url || null,
            customerName: (data.customer_name || '').trim(),
            driver: data.driver || {
              name: 'กำลังรอการมอบหมาย',
              phone: null,
              vehicle: null,
              photo_url: null,
            },
            timeline: (data.timeline || []).map((item) => ({
              status: item.code,
              title: item.title,
              description: item.current ? 'กำลังดำเนินการ' : (item.completed ? 'ดำเนินการแล้ว' : 'รอดำเนินการ'),
              completed: item.completed,
              current: item.current,
              timestamp: null,
            })),
            items: (data.items || []).map(item => ({
              id: item.id,
              name: displayProductLineName(item),
              price: item.price || 0,
              quantity: item.quantity,
              image: pickLineItemImage(item, PLACEHOLDER_IMAGES.sm)
            })) || []
          };
          
          setTrackingInfo(transformedTrackingInfo);
        } else {
          console.log('Tracking info not found');
          setTrackingInfo(null);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching tracking info:', error);
        setTrackingInfo(null);
        setLoading(false);
      }
    };

    fetchTrackingInfo();
    intervalId = setInterval(fetchTrackingInfo, 15000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [orderId]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (
        !trackingInfo
        || trackingInfo.status !== 'delivering'
        || trackingInfo.currentLatitude == null
        || trackingInfo.currentLongitude == null
        || trackingInfo.deliveryLatitude == null
        || trackingInfo.deliveryLongitude == null
      ) {
        setRoutePath([]);
        setRouteMeta(null);
        return;
      }

      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${trackingInfo.currentLongitude},${trackingInfo.currentLatitude};${trackingInfo.deliveryLongitude},${trackingInfo.deliveryLatitude}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        const firstRoute = data?.routes?.[0];
        const coords = firstRoute?.geometry?.coordinates || [];
        const latLng = coords.map((pair) => [pair[1], pair[0]]);
        setRoutePath(Array.isArray(latLng) ? latLng : []);
        setRouteMeta(
          firstRoute
            ? {
              distanceKm: Number(firstRoute.distance || 0) / 1000,
              durationMin: Number(firstRoute.duration || 0) / 60,
            }
            : null
        );
      } catch (error) {
        setRoutePath([]);
        setRouteMeta(null);
      }
    };
    fetchRoute();
  }, [trackingInfo]);

  const driverMapIcon = useMemo(() => createMotorbikeMarkerIcon(), []);

  const customerMapIcon = useMemo(
    () =>
      createCustomerPhotoMarkerIcon(
        trackingInfo?.customerPhotoUrl,
        trackingInfo?.customerName,
      ),
    [trackingInfo?.customerPhotoUrl, trackingInfo?.customerName],
  );

  const formatRouteSummary = (meta) => {
    if (!meta) return '';
    const km = Number(meta.distanceKm || 0).toFixed(1);
    const min = Math.max(1, Math.round(Number(meta.durationMin || 0)));
    return `ระยะทางประมาณ ${km} กม. · ใช้เวลาประมาณ ${min} นาที`;
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'รอดำเนินการ',
      'preparing': 'กำลังเตรียมสินค้า',
      'ready': 'พร้อมส่ง',
      'delivering': 'กำลังจัดส่ง',
      'delivered': 'จัดส่งแล้ว'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'pending': '#6c757d',
      'preparing': '#ffc107',
      'ready': '#0d6efd',
      'delivering': '#00B900',
      'delivered': '#28a745'
    };
    return colorMap[status] || '#6c757d';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const callDriver = () => {
    const phone = (trackingInfo?.driver?.phone || '').trim();
    if (!phone) return;
    window.location.assign(`tel:${phone.replace(/\s/g, '')}`);
  };

  if (loading) {
    return (
      <div className="loading">
        กำลังโหลดข้อมูลการติดตาม...
      </div>
    );
  }

  if (!trackingInfo) {
    return (
      <div className="tracking-page">
        <div className="container">
          {isAdminTracking ? (
            <div style={{ marginBottom: 12 }}>
              <AdminBackLink
                to={orderId ? `/admin/orders/${orderId}` : '/admin/orders'}
                ariaLabel="รายละเอียดคำสั่งซื้อ"
              />
            </div>
          ) : (
            <CustomerInlineBack />
          )}
          <div className="error-state">
            <div className="error-icon">❌</div>
            <h3>ไม่พบข้อมูลการติดตาม</h3>
            <p>หมายเลขติดตามไม่ถูกต้องหรือไม่มีอยู่</p>
          </div>
        </div>
      </div>
    );
  }

  const isDeliveryCompleted = trackingInfo.status === 'delivered';
  const hasDriverPosition = trackingInfo.currentLatitude !== null
    && trackingInfo.currentLongitude !== null;
  const hasDeliveryDestination = trackingInfo.deliveryLatitude !== null && trackingInfo.deliveryLongitude !== null;
  const shouldShowMap = !isDeliveryCompleted && (hasDriverPosition || hasDeliveryDestination);
  const shouldShowRoute = trackingInfo.status === 'delivering' && hasDriverPosition && hasDeliveryDestination;

  return (
    <div className={`tracking-page ${isAdminTracking ? 'admin-tracking-page' : ''}`}>
      <div className="container">
        {isAdminTracking ? (
          <div style={{ marginBottom: 12 }}>
            <AdminBackLink
              to={orderId ? `/admin/orders/${orderId}` : '/admin/orders'}
              ariaLabel="รายละเอียดคำสั่งซื้อ"
            />
          </div>
        ) : (
          <CustomerInlineBack />
        )}
        <div className="page-header">
          <h1 className="page-title">ติดตามการจัดส่ง</h1>
        </div>

        <div className="tracking-content">
          <div className="order-summary">
            <h3 className="section-title">สถานะคำสั่งซื้อ</h3>
            <div className="order-info">
              <p><strong>หมายเลข:</strong> {trackingInfo.trackingNumber}</p>
              <p>
                <strong>สถานะ:</strong>
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(trackingInfo.status) }}
                >
                  {getStatusText(trackingInfo.status)}
                </span>
              </p>
              <p><strong>คนขับ:</strong> {trackingInfo.driver?.name || '-'}</p>
              {!!trackingInfo.driver?.phone && <p><strong>โทร:</strong> {trackingInfo.driver.phone}</p>}
            </div>
          </div>

          {shouldShowMap && (
            <div className="tracking-map-section">
              <h3 className="section-title">แผนที่ติดตาม</h3>
              <p className="tracking-map-hint">
                ไอคอนรถจักรยานยนต์สีเขียว = คนขับ · วงกลมรูปลูกค้า = จุดรับของ
              </p>
              <div className="driver-map-wrap">
                <MapContainer
                  center={
                    shouldShowRoute
                      ? [
                        (trackingInfo.currentLatitude + trackingInfo.deliveryLatitude) / 2,
                        (trackingInfo.currentLongitude + trackingInfo.deliveryLongitude) / 2,
                      ]
                      : hasDriverPosition
                        ? [trackingInfo.currentLatitude, trackingInfo.currentLongitude]
                        : [trackingInfo.deliveryLatitude, trackingInfo.deliveryLongitude]
                  }
                  zoom={15}
                  scrollWheelZoom
                  className="driver-map"
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <TrackingMapFitBoth
                    active={hasDriverPosition && hasDeliveryDestination}
                    driverLat={trackingInfo.currentLatitude}
                    driverLng={trackingInfo.currentLongitude}
                    deliveryLat={trackingInfo.deliveryLatitude}
                    deliveryLng={trackingInfo.deliveryLongitude}
                    routePositions={
                      shouldShowRoute && routePath.length > 1 ? routePath : undefined
                    }
                  />
                  {hasDriverPosition && (
                    <Marker
                      position={[trackingInfo.currentLatitude, trackingInfo.currentLongitude]}
                      icon={driverMapIcon}
                    >
                      <Popup>
                        {trackingInfo.driver?.name || 'คนขับ'}
                        <br />
                        {trackingInfo.currentLocation}
                      </Popup>
                    </Marker>
                  )}
                  {hasDeliveryDestination && (
                    <Marker
                      position={[trackingInfo.deliveryLatitude, trackingInfo.deliveryLongitude]}
                      icon={customerMapIcon}
                    >
                      <Popup>
                        จุดรับของ (ลูกค้า)
                        {trackingInfo.customerName ? (
                          <>
                            <br />
                            {trackingInfo.customerName}
                          </>
                        ) : null}
                      </Popup>
                    </Marker>
                  )}
                  {shouldShowRoute && (
                    <Polyline
                      positions={routePath.length > 1
                        ? routePath
                        : [
                          [trackingInfo.currentLatitude, trackingInfo.currentLongitude],
                          [trackingInfo.deliveryLatitude, trackingInfo.deliveryLongitude],
                        ]}
                      pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }}
                    />
                  )}
                </MapContainer>
                {trackingInfo.lastLocationAt && (
                  <small className="driver-location-time">
                    อัปเดตล่าสุด: {formatDate(trackingInfo.lastLocationAt)}
                  </small>
                )}
                {shouldShowRoute && routeMeta && (
                  <small className="driver-location-time">{formatRouteSummary(routeMeta)}</small>
                )}
                {!hasDriverPosition && (
                  <small className="driver-location-time">
                    ยังไม่ได้รับพิกัด GPS จากคนขับ (ให้คนขับกด "อัปเดตพิกัด" ในหน้าคนขับ)
                  </small>
                )}
              </div>
            </div>
          )}

          <div className="driver-info">
            <h3 className="section-title">ข้อมูลคนขับ</h3>
            <div className="driver-card">
              <div className="driver-avatar driver-avatar--delivery" title="พนักงานจัดส่ง">
                <DriverDeliveryAvatarGlyph />
              </div>
              <div className="driver-details">
                <h4 className="driver-name">{trackingInfo.driver.name}</h4>
                <p className="driver-vehicle">{trackingInfo.driver.vehicle}</p>
                <p className="driver-location">{trackingInfo.currentLocation}</p>
              </div>
              {!!trackingInfo.driver?.phone && (
                <div className="driver-actions">
                  <button
                    className="btn btn-primary btn-compact"
                    type="button"
                    onClick={callDriver}
                  >
                    📞 โทรหาคนขับ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tracking;

