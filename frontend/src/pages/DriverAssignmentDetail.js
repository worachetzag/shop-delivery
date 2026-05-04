import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { assignmentContactPhone, assignmentCustomerLabel } from '../utils/driverAssignmentCustomer';
import { createCustomerPhotoMarkerIcon, createDeliveryVehicleMarkerIcon } from '../utils/mapMarkers';
import { PLACEHOLDER_IMAGES, pickLineItemImage } from '../utils/media';
import 'leaflet/dist/leaflet.css';
import './DriverDashboard.css';

const DriverAssignmentDetail = () => {
  const popup = usePopup();
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationText, setLocationText] = useState('');
  const [saving, setSaving] = useState(false);
  const [routePath, setRoutePath] = useState([]);
  const [routeMeta, setRouteMeta] = useState(null);
  const gpsIntervalRef = useRef(null);
  const gpsUpdatingRef = useRef(false);
  const formatPrice = (value) => `฿${Number(value || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const loadAssignment = async () => {
    try {
      const token =
        typeof window !== 'undefined' ? sessionStorage.getItem('driver_auth_token') : null;
      const response = await fetch(`${config.API_BASE_URL}orders/driver/assignments/${assignmentId}/`, {
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.detail || data?.error || 'โหลดข้อมูลงานไม่สำเร็จ');
      }
      setAssignment(data);
      setLocationText(data?.current_location_text || '');
    } catch (error) {
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignment();
  }, [assignmentId]);

  const canTransition = (currentStatus, targetStatus) => {
    const transitionMap = {
      assigned: ['accepted', 'cancelled'],
      accepted: ['picked_up', 'cancelled'],
      picked_up: ['on_the_way', 'cancelled'],
      on_the_way: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: [],
    };
    if (currentStatus === targetStatus) return true;
    return (transitionMap[currentStatus] || []).includes(targetStatus);
  };

  const getNextAction = (currentStatus) => {
    const nextMap = {
      assigned: { status: 'accepted', label: 'รับงาน' },
      accepted: { status: 'picked_up', label: 'รับสินค้าแล้ว' },
      picked_up: { status: 'on_the_way', label: 'เริ่มนำส่ง' },
      on_the_way: { status: 'delivered', label: 'ส่งสำเร็จ' },
    };
    return nextMap[currentStatus] || null;
  };

  const updateStatus = async (status, coords = null, options = {}) => {
    if (!assignment) return;
    const { withSaving = true, silentError = false } = options;
    if (withSaving) setSaving(true);
    try {
      const token =
        typeof window !== 'undefined' ? sessionStorage.getItem('driver_auth_token') : null;
      const payload = {
        status,
        current_location_text: locationText || '',
      };
      if (coords) {
        payload.current_latitude = coords.latitude;
        payload.current_longitude = coords.longitude;
      }

      const response = await fetch(`${config.API_BASE_URL}orders/driver/assignments/${assignment.id}/status/`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'อัปเดตสถานะไม่สำเร็จ');
      }
      setAssignment(data?.assignment || assignment);
      setLocationText(data?.assignment?.current_location_text || locationText);
    } catch (error) {
      if (!silentError) {
        popup.error(error.message || 'อัปเดตสถานะไม่สำเร็จ');
      }
    } finally {
      if (withSaving) setSaving(false);
    }
  };

  const updateCurrentGps = async ({ status = 'on_the_way', silent = false } = {}) => {
    if (!navigator.geolocation || !assignment) {
      if (!silent) popup.info('อุปกรณ์ไม่รองรับการระบุตำแหน่ง');
      return false;
    }

    if (gpsUpdatingRef.current) return false;
    gpsUpdatingRef.current = true;
    if (!silent) setSaving(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        });
      });
      await updateStatus(status, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }, { withSaving: false, silentError: silent });
      return true;
    } catch (error) {
      if (!silent) {
        popup.error('ไม่สามารถเข้าถึงตำแหน่งได้');
      }
      return false;
    } finally {
      gpsUpdatingRef.current = false;
      if (!silent) setSaving(false);
    }
  };

  const handleNextAction = async () => {
    if (!nextAction) return;
    if (nextAction.status !== 'on_the_way') {
      await updateStatus(nextAction.status);
      return;
    }
    const sentGps = await updateCurrentGps({ status: 'on_the_way', silent: false });
    if (!sentGps) {
      await updateStatus('on_the_way');
    }
  };

  useEffect(() => {
    if (assignment?.status !== 'on_the_way') {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      return;
    }

    // Kick off immediate GPS sync when entering on_the_way.
    updateCurrentGps({ status: 'on_the_way', silent: true });

    if (!gpsIntervalRef.current) {
      gpsIntervalRef.current = setInterval(() => {
        updateCurrentGps({ status: 'on_the_way', silent: true });
      }, 15000);
    }

    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
    };
  }, [assignment?.status]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (
        !assignment
        || assignment.status !== 'on_the_way'
        || assignment.current_latitude == null
        || assignment.current_longitude == null
        || assignment.delivery_latitude == null
        || assignment.delivery_longitude == null
      ) {
        setRoutePath([]);
        setRouteMeta(null);
        return;
      }
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${assignment.current_longitude},${assignment.current_latitude};${assignment.delivery_longitude},${assignment.delivery_latitude}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        const firstRoute = data?.routes?.[0];
        const coords = firstRoute?.geometry?.coordinates || [];
        setRoutePath(coords.map((pair) => [pair[1], pair[0]]));
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
  }, [assignment]);

  const driverMapIcon = useMemo(() => createDeliveryVehicleMarkerIcon(), []);

  const customerLabelForMap = assignment ? assignmentCustomerLabel(assignment) : '';
  const customerMapIcon = useMemo(
    () =>
      createCustomerPhotoMarkerIcon(
        assignment?.customer_photo_url,
        customerLabelForMap,
      ),
    [assignment?.customer_photo_url, customerLabelForMap],
  );

  const formatRouteSummary = (meta) => {
    if (!meta) return '';
    const km = Number(meta.distanceKm || 0).toFixed(1);
    const min = Math.max(1, Math.round(Number(meta.durationMin || 0)));
    return `ระยะทางประมาณ ${km} กม. · ใช้เวลาประมาณ ${min} นาที`;
  };

  const openGoogleMapsNavigation = () => {
    if (!assignment?.delivery_latitude || !assignment?.delivery_longitude) {
      popup.info('ยังไม่มีพิกัดปลายทางสำหรับนำทาง');
      return;
    }
    const destLat = Number(assignment.delivery_latitude);
    const destLon = Number(assignment.delivery_longitude);
    const destination = `${destLat},${destLon}`;
    const hasOrigin = assignment.current_latitude != null && assignment.current_longitude != null;
    const origin = hasOrigin
      ? `&origin=${Number(assignment.current_latitude)},${Number(assignment.current_longitude)}`
      : '';
    const webUrl = `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`;

    // มือถือคนขับ: พยายามเปิดแอปแผนที่โดยตรงก่อน ลดโอกาสเด้งแท็บใหม่ใน Chrome
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    if (isIOS) {
      const iosUrl = hasOrigin
        ? `comgooglemaps://?saddr=${Number(assignment.current_latitude)},${Number(assignment.current_longitude)}&daddr=${destLat},${destLon}&directionsmode=driving`
        : `comgooglemaps://?daddr=${destLat},${destLon}&directionsmode=driving`;
      window.location.assign(iosUrl);
      setTimeout(() => window.location.assign(webUrl), 900);
      return;
    }

    if (isAndroid) {
      const androidUrl = `google.navigation:q=${destLat},${destLon}&mode=d`;
      window.location.assign(androidUrl);
      setTimeout(() => window.location.assign(webUrl), 900);
      return;
    }

    window.location.assign(webUrl);
  };

  if (loading) {
    return <div className="loading">กำลังโหลดงานจัดส่ง...</div>;
  }

  if (!assignment) {
    return (
      <div className="driver-dashboard-page">
        <div className="driver-empty">
          ไม่พบงานนี้ หรือคุณไม่มีสิทธิ์เข้าถึง
          <div style={{ marginTop: '10px' }}>
            <Link to="/driver/dashboard" className="btn btn-secondary btn-sm">กลับหน้างานคนขับ</Link>
          </div>
        </div>
      </div>
    );
  }

  const nextAction = getNextAction(assignment.status);
  const contactTel = assignmentContactPhone(assignment);
  const telHref = contactTel ? contactTel.replace(/\s/g, '') : '';
  const hasDriverPosition = assignment.current_latitude != null && assignment.current_longitude != null;
  const hasDeliveryPosition = assignment.delivery_latitude != null && assignment.delivery_longitude != null;
  const isCompletedJob = ['delivered', 'cancelled'].includes(assignment.status);
  const showMap = !isCompletedJob && (hasDriverPosition || hasDeliveryPosition);
  const isCodPayment = assignment.payment_method === 'cod';

  return (
    <div className="driver-dashboard-page">
      <h1>จัดการงานจัดส่ง #{assignment.order}</h1>
      <div className="driver-assignment-card">
        <div className="driver-assignment-row">
          <strong>สถานะงาน:</strong>
          <span className="driver-status">{assignment.status_display || assignment.status}</span>
        </div>
        <div className="driver-customer-block">
          <h3 className="driver-customer-heading">ข้อมูลลูกค้า / จัดส่ง</h3>
          <div className="driver-customer-line">
            <strong>ชื่อลูกค้า:</strong> {assignmentCustomerLabel(assignment)}
          </div>
          {assignment.order_type_display && (
            <div className="driver-customer-line muted-small">
              <strong>ประเภทคำสั่งซื้อ:</strong> {assignment.order_type_display}
            </div>
          )}
          {contactTel ? (
            <div className="driver-customer-line">
              <strong>เบอร์โทรติดต่อ:</strong>{' '}
              <a href={`tel:${telHref}`} className="driver-tel-link">
                {contactTel}
              </a>
              <span className="muted-small"> (กดโทรได้)</span>
            </div>
          ) : (
            <div className="driver-customer-line muted-small">ยังไม่มีเบอร์ติดต่อในระบบ</div>
          )}
          <div className="driver-customer-line">
            <strong>ที่อยู่จัดส่ง:</strong>
            <div className="driver-address-text">{assignment.delivery_address || '—'}</div>
          </div>
          {(assignment.delivery_notes || '').trim() ? (
            <div className="driver-customer-line driver-customer-notes">
              <strong>หมายเหตุ:</strong> {assignment.delivery_notes}
            </div>
          ) : null}
          <div className={`driver-payment-banner ${isCodPayment ? 'is-cod' : 'is-paid'}`}>
            <div className="driver-payment-title">สถานะการเก็บเงิน</div>
            {isCodPayment ? (
              <div className="driver-payment-value">
                ต้องเก็บเงินจากลูกค้า {formatPrice(assignment.order_total_amount)}
              </div>
            ) : (
              <div className="driver-payment-value">
                ไม่ต้องเก็บเงิน (ลูกค้าชำระแล้ว · {assignment.payment_method_display || 'โอนเงิน'})
              </div>
            )}
          </div>
        </div>
        {showMap && (
          <div className="driver-map-wrap">
            <MapContainer
              center={
                hasDriverPosition
                  ? [Number(assignment.current_latitude), Number(assignment.current_longitude)]
                  : [Number(assignment.delivery_latitude), Number(assignment.delivery_longitude)]
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
                <Marker
                  position={[Number(assignment.current_latitude), Number(assignment.current_longitude)]}
                  icon={driverMapIcon}
                >
                  <Popup>ตำแหน่งคนขับ</Popup>
                </Marker>
              )}
              {hasDeliveryPosition && (
                <Marker
                  position={[Number(assignment.delivery_latitude), Number(assignment.delivery_longitude)]}
                  icon={customerMapIcon}
                >
                  <Popup>
                    จุดรับของ (ลูกค้า)
                    {customerLabelForMap && customerLabelForMap !== '—' ? (
                      <>
                        <br />
                        {customerLabelForMap}
                      </>
                    ) : null}
                  </Popup>
                </Marker>
              )}
              {hasDriverPosition && hasDeliveryPosition && (
                <Polyline
                  positions={routePath.length > 1
                    ? routePath
                    : [
                      [Number(assignment.current_latitude), Number(assignment.current_longitude)],
                      [Number(assignment.delivery_latitude), Number(assignment.delivery_longitude)],
                    ]}
                  pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.85 }}
                />
              )}
            </MapContainer>
            <div className="route-legend">
              <span>ไอคอนรถส่งของ: คนขับ</span>
              <span>รูปโปรไฟล์ / วงแดง: จุดลูกค้า</span>
              <span>เส้นสีน้ำเงิน: เส้นทางตามถนน</span>
            </div>
            {hasDriverPosition && hasDeliveryPosition && routeMeta && (
              <small className="driver-location-time">{formatRouteSummary(routeMeta)}</small>
            )}
          </div>
        )}
        <div className="driver-order-items">
          <h3 className="driver-customer-heading">รายการสินค้าในออเดอร์</h3>
          {Array.isArray(assignment.order_items) && assignment.order_items.length > 0 ? (
            <div className="driver-order-item-list">
              {assignment.order_items.map((item) => (
                <div key={item.id} className="driver-order-item-row">
                  <img
                    src={pickLineItemImage(item, PLACEHOLDER_IMAGES.sm)}
                    alt={item.product_name || 'item-image'}
                    className="driver-order-item-image"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER_IMAGES.sm;
                    }}
                  />
                  <div className="driver-order-item-meta">
                    <div className="driver-order-item-name">
                      {item.product_name || `สินค้า #${item.product_id}`} x{item.quantity}
                    </div>
                  </div>
                  <div className="driver-order-item-price">{formatPrice(item.total_price)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted-small">ยังไม่มีรายละเอียดรายการสินค้า</div>
          )}
        </div>
        <div className="driver-assignment-row">
          <span>ยอดรวมออเดอร์: {formatPrice(assignment.order_total_amount)}</span>
        </div>
        <div className="driver-next-step">
          ขั้นตอนถัดไป: {nextAction?.label || 'ไม่มี (งานเสร็จแล้ว)'}
        </div>

        <div className="driver-actions">
          {nextAction && (
            <button
              className="btn-primary"
              onClick={handleNextAction}
              disabled={saving}
            >
              {saving ? 'กำลังบันทึก...' : nextAction.label}
            </button>
          )}
          {assignment.status === 'on_the_way' && (
            <button onClick={updateCurrentGps} disabled={saving}>
              อัปเดตพิกัด
            </button>
          )}
          {hasDeliveryPosition && (
            <button type="button" onClick={openGoogleMapsNavigation} disabled={saving}>
              เปิด Google Maps
            </button>
          )}
          {contactTel && (
            <button type="button" onClick={() => window.location.assign(`tel:${telHref}`)} disabled={saving}>
              โทรหาลูกค้า
            </button>
          )}
          {canTransition(assignment.status, 'cancelled') && (
            <button className="danger" onClick={() => updateStatus('cancelled')} disabled={saving}>
              ยกเลิกงาน
            </button>
          )}
          <Link to="/driver/dashboard" className="btn btn-secondary btn-sm">
            กลับหน้างานคนขับ
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DriverAssignmentDetail;
