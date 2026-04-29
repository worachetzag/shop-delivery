import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import config from '../config';
import { displayProductLineName } from '../utils/helpers';
import { PLACEHOLDER_IMAGES, resolveMediaUrl } from '../utils/media';
import 'leaflet/dist/leaflet.css';
import './Tracking.css';

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
            driver: data.driver || {
              name: 'กำลังรอการมอบหมาย',
              phone: null,
              vehicle: null
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
              image: resolveMediaUrl(item.product?.image || item.image, PLACEHOLDER_IMAGES.sm)
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
    if (trackingInfo?.driver?.phone) {
      window.open(`tel:${trackingInfo.driver.phone}`);
    }
  };

  const openGoogleMapsNavigation = () => {
    if (trackingInfo?.deliveryLatitude == null || trackingInfo?.deliveryLongitude == null) {
      return;
    }
    const destination = `${trackingInfo.deliveryLatitude},${trackingInfo.deliveryLongitude}`;
    const hasOrigin = trackingInfo.currentLatitude != null && trackingInfo.currentLongitude != null;
    const origin = hasOrigin
      ? `&origin=${trackingInfo.currentLatitude},${trackingInfo.currentLongitude}`
      : '';
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
        <div className="page-header">
          <h1 className="page-title">ติดตามการจัดส่ง</h1>
          <p className="page-subtitle">คำสั่งซื้อ {trackingInfo.trackingNumber}</p>
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

          <div className="driver-info">
            <h3 className="section-title">ข้อมูลคนขับ</h3>
            <div className="driver-card">
              <div className="driver-avatar">
                <span>{trackingInfo.driver.name.charAt(0)}</span>
              </div>
              <div className="driver-details">
                <h4 className="driver-name">{trackingInfo.driver.name}</h4>
                <p className="driver-vehicle">{trackingInfo.driver.vehicle}</p>
                <p className="driver-location">{trackingInfo.currentLocation}</p>
              </div>
              <div className="driver-actions">
                <button 
                  className="btn btn-primary btn-compact"
                  onClick={callDriver}
                >
                  📞 โทรหา
                </button>
                {hasDeliveryDestination && (
                  <button
                    className="btn btn-secondary btn-compact"
                    onClick={openGoogleMapsNavigation}
                    type="button"
                  >
                    นำทาง Google Maps
                  </button>
                )}
              </div>
            </div>
            {shouldShowMap && (
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
                  {hasDriverPosition && (
                    <CircleMarker center={[trackingInfo.currentLatitude, trackingInfo.currentLongitude]} radius={10} pathOptions={{ color: '#00B900' }}>
                      <Popup>
                        {trackingInfo.driver?.name || 'คนขับ'}<br />
                        {trackingInfo.currentLocation}
                      </Popup>
                    </CircleMarker>
                  )}
                  {hasDeliveryDestination && (
                    <CircleMarker center={[trackingInfo.deliveryLatitude, trackingInfo.deliveryLongitude]} radius={9} pathOptions={{ color: '#ef4444' }}>
                      <Popup>ตำแหน่งลูกค้า (ปลายทาง)</Popup>
                    </CircleMarker>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tracking;

