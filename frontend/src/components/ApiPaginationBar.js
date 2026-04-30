import React from 'react';
import './ApiPaginationBar.css';

/** เลื่อนไปจุดเริ่มเนื้อหา (หัวโซนรายการ) หลังเปลี่ยนหน้า — ใช้ต้น main-content เพื่อไม่ให้ค้างใต้ปุ่มแบ่งหน้า */
function scrollToListTop() {
  if (typeof window === 'undefined') return;
  const main = document.querySelector('.App .main-content');
  if (main) {
    const y = main.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * แบ่งหน้าแบบ DRF { count, next, previous, results }
 * @param {number} count - จำนวนทั้งหมด
 * @param {number} page - หน้าปัจจุบัน (1-based)
 * @param {number} pageSize
 * @param {(p: number) => void} onPageChange
 * @param {boolean} scrollTopOnChange - เลื่อนกลับหัวโซนรายการเมื่อเปลี่ยนหน้า (ค่าเริ่มต้น true)
 */
function ApiPaginationBar({
  count = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  className = '',
  scrollTopOnChange = true,
}) {
  const totalPages = Math.max(1, Math.ceil(Number(count || 0) / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = count === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, count);

  const go = (nextPage) => {
    onPageChange(nextPage);
    if (!scrollTopOnChange) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToListTop());
    });
  };

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
          onClick={() => go(safePage - 1)}
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
          onClick={() => go(safePage + 1)}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}

export default ApiPaginationBar;
