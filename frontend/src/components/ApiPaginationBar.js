import React from 'react';
import './ApiPaginationBar.css';

/**
 * แบ่งหน้าแบบ DRF { count, next, previous, results }
 * @param {number} count - จำนวนทั้งหมด
 * @param {number} page - หน้าปัจจุบัน (1-based)
 * @param {number} pageSize
 * @param {(p: number) => void} onPageChange
 */
function ApiPaginationBar({ count = 0, page = 1, pageSize = 20, onPageChange, className = '' }) {
  const totalPages = Math.max(1, Math.ceil(Number(count || 0) / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = count === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, count);

  if (count <= pageSize && page <= 1) {
    return null;
  }

  return (
    <div className={`api-pagination-bar ${className}`.trim()}>
      <span className="api-pagination-info">
        แสดง {from}–{to} จาก {count} รายการ
      </span>
      <div className="api-pagination-actions">
        <button
          type="button"
          className="api-pagination-btn"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          ก่อนหน้า
        </button>
        <span className="api-pagination-page">
          หน้า {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="api-pagination-btn"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}

export default ApiPaginationBar;
