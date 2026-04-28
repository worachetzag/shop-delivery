import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { assignmentContactPhone, assignmentCustomerLabel } from '../utils/driverAssignmentCustomer';
import './DriverDashboard.css';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);

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

  return (
    <div className="driver-dashboard-page">
      <h1>งานของคนขับ</h1>
      <p>อัปเดตสถานะการจัดส่งให้ลูกค้าและแอดมินติดตามได้แบบเรียลไทม์</p>

      <div className="driver-assignment-list">
        {assignments.length === 0 ? (
          <div className="driver-empty">ยังไม่มีงานที่ได้รับมอบหมาย</div>
        ) : (
          assignments.map((assignment) => (
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
              </div>
              <div className="driver-assignment-row driver-assignment-total-row">
                <span>ยอดรวม: ฿{Number(assignment.order_total_amount || 0).toLocaleString()}</span>
              </div>
              <div className="driver-next-step">
                ขั้นตอนถัดไป: {getNextAction(assignment.status)?.label || 'ไม่มี (งานเสร็จแล้ว)'}
              </div>
              <div className="driver-open-job-hint">กดเพื่อเข้างานนี้</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DriverDashboard;
