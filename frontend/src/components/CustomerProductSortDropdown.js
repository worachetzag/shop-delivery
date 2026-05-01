import React, { useEffect, useId, useRef, useState } from 'react';
import './CustomerProductSortDropdown.css';

/**
 * @param {{ value: string, label: string, hint?: string }[]} options
 * @param {string} value
 * @param {(next: string) => void} onChange
 * @param {string} [labelText]
 * @param {string} [className] — เช่น customer-sort--compact
 */
function CustomerProductSortDropdown({ options, value, onChange, labelText = 'เรียงตาม', className = '' }) {
  const reactId = useId().replace(/:/g, '');
  const labelId = `customer-sort-label-${reactId}`;
  const valueSpanId = `customer-sort-value-${reactId}`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const list = Array.isArray(options) && options.length > 0 ? options : [];
  const current = list.find((o) => o.value === value) || list[0];
  const displayLabel = current?.label ?? '';

  return (
    <div className={`customer-sort ${className}`.trim()}>
      <div className="customer-sort-inner">
        <span className="customer-sort-caption" id={labelId}>
          {labelText}
        </span>
        <div className="customer-sort-dropdown" ref={rootRef}>
          <button
            type="button"
            className="btn btn-outline customer-sort-trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby={`${labelId} ${valueSpanId}`}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="customer-sort-trigger-label" id={valueSpanId}>
              {displayLabel}
            </span>
            <span className="customer-sort-trigger-chevron" aria-hidden>
              {open ? '▴' : '▾'}
            </span>
          </button>
          {open ? (
            <ul className="customer-sort-menu" role="listbox" aria-labelledby={labelId}>
              {list.map((opt) => (
                <li key={opt.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === opt.value}
                    className={`customer-sort-option${value === opt.value ? ' is-active' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="customer-sort-option-label">{opt.label}</span>
                    {opt.hint ? <span className="customer-sort-option-hint">{opt.hint}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CustomerProductSortDropdown;
