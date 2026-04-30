import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { customerShouldShowBackButton, getCustomerBackPath } from '../utils/customerNavigation';
import './CustomerInlineBack.css';

/** ปุ่มกลับใน flow ของหน้า — ไม่ดันเลย์เอาต์แบบ fixed / padding ทั้ง main */
const CustomerInlineBack = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  if (!customerShouldShowBackButton(location.pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      className={`customer-inline-back ${className}`.trim()}
      onClick={() => navigate(getCustomerBackPath(location.pathname))}
    >
      ← กลับ
    </button>
  );
};

export default CustomerInlineBack;
