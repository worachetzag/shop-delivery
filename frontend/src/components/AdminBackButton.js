import React from 'react';
import { Link } from 'react-router-dom';
import './AdminBackButton.css';

function BackChevron() {
  return (
    <svg
      className="admin-back-btn__svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** ปุ่มย้อนแบบไอคอนลูกศร — ไม่แสดงคำว่า «กลับ» */
export function AdminBackLink({ to, ariaLabel, className = '', style }) {
  return (
    <Link
      to={to}
      className={`admin-back-btn${className ? ` ${className}` : ''}`}
      style={style}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <BackChevron />
    </Link>
  );
}

export function AdminBackButton({ onClick, ariaLabel, className = '', style }) {
  return (
    <button
      type="button"
      className={`admin-back-btn${className ? ` ${className}` : ''}`}
      style={style}
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <BackChevron />
    </button>
  );
}
