import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminBreadcrumbOverrides } from '../context/AdminBreadcrumbContext';
import { buildAdminBreadcrumbs } from '../utils/adminBreadcrumbs';
import './AdminBreadcrumb.css';

function applyOverrides(base, overrides) {
  if (!overrides || typeof overrides !== 'object') return base;
  const keys = Object.keys(overrides)
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => b - a);

  let row = base;
  keys.forEach((fromEnd) => {
    const label = overrides[String(fromEnd)];
    if (!label || row.length === 0) return;
    const idx = row.length - fromEnd;
    if (idx >= 0 && idx < row.length) {
      row = row.map((item, i) => (i === idx ? { ...item, label } : item));
    }
  });
  return row;
}

function AdminBreadcrumb() {
  const { pathname } = useLocation();
  const overrides = useAdminBreadcrumbOverrides();

  const items = useMemo(() => {
    const base = buildAdminBreadcrumbs(pathname);
    return applyOverrides(base, overrides);
  }, [pathname, overrides]);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav className="admin-breadcrumb" aria-label="เส้นทางในแผงแอดมิน">
      <ol className="admin-breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="admin-breadcrumb__item">
              {item.to && !isLast ? (
                <Link className="admin-breadcrumb__link" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span className="admin-breadcrumb__current" aria-current="page">
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span className="admin-breadcrumb__sep" aria-hidden>
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default AdminBreadcrumb;
