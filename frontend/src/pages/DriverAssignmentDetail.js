import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { assignmentContactPhone, assignmentCustomerLabel } from '../utils/driverAssignmentCustomer';
import './DriverDashboard.css';

const DriverAssignmentDetail = () => {
  const popup = usePopup();
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationText, setLocationText] = useState('');
  const [saving, setSaving] = useState(false);
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
