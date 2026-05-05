import React from 'react';
import './AdminPageHeader.css';

/**
 * หัวเรื่องหน้าแอดมินให้โทนเดียวกัน — title ควรตรงเมนู (หรือเมนูย่อย)
 */
function AdminPageHeader({
  title,
  subtitle,
  leading = null,
  actions = null,
  children = null,
  className = '',
}) {
  const rootClass = ['admin-page-header', className].filter(Boolean).join(' ');
  return (
    <header className={rootClass}>
      <div className="admin-page-header__top">
        {leading ? <div className="admin-page-header__leading">{leading}</div> : null}
        <div className="admin-page-header__main">
          <h1 className="admin-page-header__title">{title}</h1>
          {subtitle ? <p className="admin-page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
      </div>
      {children ? <div className="admin-page-header__children">{children}</div> : null}
    </header>
  );
}

export default AdminPageHeader;
