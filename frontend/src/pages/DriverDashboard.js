import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { assignmentContactPhone, assignmentCustomerLabel } from '../utils/driverAssignmentCustomer';
import './DriverDashboard.css';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const loadAssignments = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}orders/driver/assignments/?page_size=50`, {
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'โหลดงานไม่สำเร็จ');
      }
      setAssignments(Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []));
    } catch (error) {
      setAssignments([]);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const getNextAction = (currentStatus) => {
    const nextMap = {
      assigned: { status: 'accepted', label: 'รับงาน' },
      accepted: { status: 'picked_up', label: 'รับสินค้าแล้ว' },
      picked_up: { status: 'on_the_way', label: 'เริ่มนำส่ง' },
      on_the_way: { status: 'delivered', label: 'ส่งสำเร็จ' },
    };
    return nextMap[currentStatus] || null;
  };

  const {
    activeAssignments,
    doneAssignments,
    codPendingCount,
    codPendingAmount,
    codCollectedCount,
    codCollectedAmount,
  } = useMemo(() => {
    const doneSet = new Set(['delivered', 'cancelled']);
    const active = [];
    const done = [];
    let codPendingJobs = 0;
    let codPendingTotal = 0;
    let codCollectedJobs = 0;
    let codCollectedTotal = 0;
    assignments.forEach((assignment) => {
      const isDone = doneSet.has(assignment.status);
      if (isDone) {
        done.push(assignment);
      } else {
        active.push(assignment);
      }
      if (assignment.payment_method !== 'cod') return;

      if (!isDone) {
        codPendingJobs += 1;
        codPendingTotal += Number(assignment.order_total_amount || 0);
        return;
      }

      if (assignment.status === 'delivered') {
        codCollectedJobs += 1;
        codCollectedTotal += Number(assignment.order_total_amount || 0);
      }
    });
    return {
      activeAssignments: active,
      doneAssignments: done,
      codPendingCount: codPendingJobs,
      codPendingAmount: codPendingTotal,
      codCollectedCount: codCollectedJobs,
      codCollectedAmount: codCollectedTotal,
    };
  }, [assignments]);

  const visibleAssignments = activeTab === 'active' ? activeAssignments : doneAssignments;
  const filteredAssignments = useMemo(() => {
    const list = paymentFilter === 'all'
      ? visibleAssignments
      : visibleAssignments.filter((assignment) => assignment.payment_method === paymentFilter);
    const cloned = [...list];
    if (sortBy === 'amount_desc') {
      cloned.sort((a, b) => Number(b.order_total_amount || 0) - Number(a.order_total_amount || 0));
      return cloned;
    }
    if (sortBy === 'amount_asc') {
      cloned.sort((a, b) => Number(a.order_total_amount || 0) - Number(b.order_total_amount || 0));
      return cloned;
    }
    cloned.sort((a, b) => new Date(b.assigned_at || 0).getTime() - new Date(a.assigned_at || 0).getTime());
    return cloned;
  }, [visibleAssignments, paymentFilter, sortBy]);

  const openGoogleMaps = (assignment) => {
    if (assignment.delivery_latitude == null || assignment.delivery_longitude == null) return;
    const destLat = Number(assignment.delivery_latitude);
    const destLon = Number(assignment.delivery_longitude);
    const destination = `${destLat},${destLon}`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    if (isIOS) {
      const iosUrl = `comgooglemaps://?daddr=${destLat},${destLon}&directionsmode=driving`;
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

  const runtimeMeta = (assignment) => {
    const assignedAtMs = new Date(assignment.assigned_at || 0).getTime();
    if (!assignedAtMs || Number.isNaN(assignedAtMs)) {
      return { text: 'ไม่ทราบเวลาเริ่มงาน', overdue: false };
    }
    const elapsedMin = Math.max(0, Math.floor((nowMs - assignedAtMs) / 60000));
    const hours = Math.floor(elapsedMin / 60);
    const mins = elapsedMin % 60;
    const text = hours > 0 ? `${hours} ชม. ${mins} นาที` : `${mins} นาที`;
    const isDone = ['delivered', 'cancelled'].includes(assignment.status);
    // เกณฑ์ง่ายๆ: งานยังไม่เสร็จเกิน 45 นาทีขึ้นเตือน
    const overdue = !isDone && elapsedMin >= 45;
    return { text: `รับงานมาแล้ว ${text}`, overdue };
  };

  return (
    <div className="driver-dashboard-page">
      <h1>งานของคนขับ</h1>
      <p>อัปเดตสถานะการจัดส่งให้ลูกค้าและแอดมินติดตามได้แบบเรียลไทม์</p>

      <div className="driver-kpi-grid">
        <div className="driver-kpi-card">
          <div className="driver-kpi-label">งานที่กำลังดำเนินการ</div>
          <div className="driver-kpi-value">{activeAssignments.length}</div>
        </div>
        <div className="driver-kpi-card">
          <div className="driver-kpi-label">งานที่เสร็จแล้ว</div>
          <div className="driver-kpi-value">{doneAssignments.length}</div>
        </div>
        <div className="driver-kpi-card driver-kpi-card--cod">
          <div className="driver-kpi-label">งาน COD ที่ต้องเก็บเงิน</div>
          <div className="driver-kpi-value">{codPendingCount} งาน</div>
          <div className="driver-kpi-sub">คงค้าง ฿{codPendingAmount.toLocaleString()}</div>
          <div className="driver-kpi-sub">เก็บแล้ว {codCollectedCount} งาน · ฿{codCollectedAmount.toLocaleString()}</div>
        </div>
      </div>

      <div className="driver-tab-row" role="tablist" aria-label="ประเภทงานคนขับ">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'active'}
          className={`driver-tab-btn ${activeTab === 'active' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          งานที่ยังไม่ส่ง ({activeAssignments.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'done'}
          className={`driver-tab-btn ${activeTab === 'done' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('done')}
        >
          งานที่เสร็จแล้ว ({doneAssignments.length})
        </button>
      </div>

      <div className="driver-toolbar">
        <div className="driver-filter-chip-row">
          <button
            type="button"
            className={`driver-filter-chip ${paymentFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setPaymentFilter('all')}
          >
            ทุกการชำระเงิน
          </button>
          <button
            type="button"
            className={`driver-filter-chip ${paymentFilter === 'cod' ? 'is-active' : ''}`}
            onClick={() => setPaymentFilter('cod')}
          >
            เฉพาะ COD
          </button>
          <button
            type="button"
            className={`driver-filter-chip ${paymentFilter === 'promptpay' ? 'is-active' : ''}`}
            onClick={() => setPaymentFilter('promptpay')}
          >
            จ่ายแล้ว
          </button>
        </div>
        <label className="driver-sort-label">
          เรียงลำดับ
          <select
            className="driver-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="latest">ล่าสุดก่อน</option>
            <option value="amount_desc">ยอดมากไปน้อย</option>
            <option value="amount_asc">ยอดน้อยไปมาก</option>
          </select>
        </label>
      </div>

      <div className="driver-assignment-list">
        {filteredAssignments.length === 0 ? (
          <div className="driver-empty">
            {activeTab === 'active'
              ? 'ยังไม่มีงานที่ตรงกับตัวกรองในตอนนี้'
              : 'ยังไม่มีงานเสร็จที่ตรงกับตัวกรอง'}
          </div>
        ) : (
          filteredAssignments.map((assignment) => {
            const meta = runtimeMeta(assignment);
            return (
            <div
              key={assignment.id}
              className="driver-assignment-card driver-assignment-clickable"
              onClick={() => navigate(`/driver/assignments/${assignment.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/driver/assignments/${assignment.id}`);
                }
              }}
            >
              <div className="driver-assignment-row">
                <strong>คำสั่งซื้อ {assignment.order_number || `#${assignment.order}`}</strong>
                <span className="driver-status">{assignment.status_display || assignment.status}</span>
              </div>
              <div className="driver-meta-row">
                <span className={`driver-runtime-chip ${meta.overdue ? 'is-overdue' : ''}`}>
                  {meta.text}
                </span>
                {meta.overdue ? (
                  <span className="driver-sla-badge">เลยเวลา</span>
                ) : (
                  <span className="driver-sla-badge is-ok">ตามเวลา</span>
                )}
              </div>
              <div className="driver-customer-block" onClick={(e) => e.stopPropagation()}>
                <div className="driver-customer-line">
                  <strong>ลูกค้า:</strong> {assignmentCustomerLabel(assignment)}
                </div>
                {assignment.order_type_display && (
                  <div className="driver-customer-line muted-small">
                    <strong>ประเภท:</strong> {assignment.order_type_display}
                  </div>
                )}
                {(() => {
                  const tel = assignmentContactPhone(assignment);
                  return tel ? (
                    <div className="driver-customer-line">
                      <strong>โทร:</strong>{' '}
                      <a href={`tel:${tel.replace(/\s/g, '')}`} className="driver-tel-link">
                        {tel}
                      </a>
                    </div>
                  ) : (
                    <div className="driver-customer-line muted-small">ยังไม่มีเบอร์ติดต่อในระบบ</div>
                  );
                })()}
                <div className="driver-customer-line">
                  <strong>ที่อยู่จัดส่ง:</strong> {assignment.delivery_address || '—'}
                </div>
                {(assignment.delivery_notes || '').trim() ? (
                  <div className="driver-customer-line driver-customer-notes">
                    <strong>หมายเหตุ:</strong> {assignment.delivery_notes}
                  </div>
                ) : null}
                <div className="driver-customer-line">
                  <div className={`driver-payment-banner ${assignment.payment_method === 'cod' ? 'is-cod' : 'is-paid'}`}>
                    <div className="driver-payment-title">สถานะการเก็บเงิน</div>
                    {assignment.payment_method === 'cod' ? (
                      <div className="driver-payment-value">
                        ต้องเก็บเงินจากลูกค้า ฿{Number(assignment.order_total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    ) : (
                      <div className="driver-payment-value">
                        ไม่ต้องเก็บเงิน (ลูกค้าชำระแล้ว · {assignment.payment_method_display || 'โอนเงิน'})
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="driver-assignment-row driver-assignment-total-row">
                <span>ยอดรวม: ฿{Number(assignment.order_total_amount || 0).toLocaleString()}</span>
              </div>
              <div className="driver-next-step">
                ขั้นตอนถัดไป: {getNextAction(assignment.status)?.label || 'ไม่มี (งานเสร็จแล้ว)'}
              </div>
              <div className="driver-quick-actions" onClick={(e) => e.stopPropagation()}>
                {(() => {
                  const tel = assignmentContactPhone(assignment);
                  return tel ? (
                    <button
                      type="button"
                      className="driver-quick-btn"
                      onClick={() => window.location.assign(`tel:${tel.replace(/\s/g, '')}`)}
                    >
                      โทรลูกค้า
                    </button>
                  ) : null;
                })()}
                {assignment.delivery_latitude != null && assignment.delivery_longitude != null ? (
                  <button
                    type="button"
                    className="driver-quick-btn"
                    onClick={() => openGoogleMaps(assignment)}
                  >
                    นำทาง
                  </button>
                ) : null}
                <button
                  type="button"
                  className="driver-quick-btn driver-quick-btn--primary"
                  onClick={() => navigate(`/driver/assignments/${assignment.id}`)}
                >
                  เปิดรายละเอียด
                </button>
              </div>
            </div>
          );
          })
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
