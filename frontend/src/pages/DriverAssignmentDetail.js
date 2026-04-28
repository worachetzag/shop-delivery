import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { assignmentContactPhone, assignmentCustomerLabel } from '../utils/driverAssignmentCustomer';
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
  const gpsIntervalRef = useRef(null);
  const gpsUpdatingRef = useRef(false);

  const loadAssignment = async () => {
    try {
      const token = localStorage.getItem('auth_token');
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
      const token = localStorage.getItem('auth_token');
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
        return;
      }
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${assignment.current_longitude},${assignment.current_latitude};${assignment.delivery_longitude},${assignment.delivery_latitude}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates || [];
        setRoutePath(coords.map((pair) => [pair[1], pair[0]]));
      } catch (error) {
        setRoutePath([]);
      }
    };
    fetchRoute();
  }, [assignment]);

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
  const showMap = hasDriverPosition || hasDeliveryPosition;

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
                <CircleMarker
                  center={[Number(assignment.current_latitude), Number(assignment.current_longitude)]}
                  radius={10}
                  pathOptions={{ color: '#00B900' }}
                >
                  <Popup>ตำแหน่งคนขับ</Popup>
                </CircleMarker>
              )}
              {hasDeliveryPosition && (
                <CircleMarker
                  center={[Number(assignment.delivery_latitude), Number(assignment.delivery_longitude)]}
                  radius={9}
                  pathOptions={{ color: '#ef4444' }}
                >
                  <Popup>ตำแหน่งลูกค้า (ปลายทาง)</Popup>
                </CircleMarker>
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
              <span>จุดสีเขียว: คนขับ</span>
              <span>จุดสีแดง: ลูกค้า</span>
              <span>เส้นสีน้ำเงิน: เส้นทางตามถนน</span>
            </div>
          </div>
        )}
        <div className="driver-assignment-row">
          <span>ยอดรวมออเดอร์: ฿{Number(assignment.order_total_amount || 0).toLocaleString()}</span>
        </div>
        <div className="driver-next-step">
          ขั้นตอนถัดไป: {nextAction?.label || 'ไม่มี (งานเสร็จแล้ว)'}
        </div>

        {['picked_up', 'on_the_way'].includes(assignment.status) && (
          <input
            className="driver-location-input"
            placeholder="ตำแหน่งล่าสุด เช่น หน้าโรงเรียน..."
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
          />
        )}

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
