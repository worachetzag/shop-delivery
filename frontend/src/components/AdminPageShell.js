import React from 'react';
import './AdminPageShell.css';

/**
 * โครงหน้าแอดมินที่เหมือนกันทุกหน้า (ยกเว้น login):
 * admin-dashboard → admin-content การ์ดเดียว + AdminPageHeader ด้านบน (ถ้ามี)
 */
function AdminPageShell({
  header = null,
  children,
  className = '',
  contentClassName = '',
  narrow = false,
}) {
  const rootClass = [
    'admin-page-shell',
    'admin-dashboard',
    narrow ? 'admin-page-shell--narrow' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const innerClass = ['admin-content', 'admin-page-shell__inner', contentClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <div className={innerClass}>
        {header}
        {children}
      </div>
    </div>
  );
}

export default AdminPageShell;
