import React, { useCallback, useEffect, useRef, useState } from 'react';
import './CategoryChipsRow.css';
import { CATEGORY_ALL_EMOJI, getCategoryEmoji, pickCategoryIconUrl } from '../utils/categoryVisual';

/**
 * Horizontal category pills (same interaction as customer Products page).
 * @param {{ id: string|number, name: string }[]} categories - from API (no synthetic "ทั้งหมด")
 * @param {string} value - selected category id or '' for all
 * @param {(id: string) => void} onChange
 * @param {string} [ariaLabel]
 * @param {string} [fadeBg] - CSS color for right-edge fade (match panel background)
 */
const CategoryChipsRow = ({ categories, value, onChange, ariaLabel = 'หมวดหมู่สินค้า', fadeBg }) => {
  const scrollRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [hintEnd, setHintEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 2;
    const atEnd = !overflowing || el.scrollLeft + el.clientWidth >= el.scrollWidth - 3;
    setOverflow(overflowing);
    setHintEnd(overflowing && !atEnd);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const run = () => {
      sync();
      requestAnimationFrame(sync);
    };

    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', run);

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', run);
    };
  }, [categories, sync]);

  const chips = [{ id: '', name: 'ทั้งหมด' }, ...(Array.isArray(categories) ? categories : [])];

  return (
    <div
      ref={scrollRef}
      className={`category-chips-scroll${overflow ? ' category-chips-scroll--overflowing' : ''}${hintEnd ? ' category-chips-scroll--hint-end' : ''}`}
      style={fadeBg ? { '--category-chips-fade-bg': fadeBg } : undefined}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div className="category-chips-track">
        {chips.map((category) => {
          const cid = category.id === '' || category.id == null ? '' : String(category.id);
          const active = value === cid;
          const iconUrl = cid === '' ? '' : pickCategoryIconUrl(category);
          return (
            <button
              key={cid === '' ? 'category-all' : `category-${cid}`}
              type="button"
              role="tab"
              aria-selected={active}
              className={`category-chip${active ? ' is-active' : ''}`}
              onClick={() => onChange(cid)}
            >
              <span className="category-chip-icon-wrap" aria-hidden>
                <span className="category-chip-icon">
                  {cid === '' ? (
                    CATEGORY_ALL_EMOJI
                  ) : iconUrl ? (
                    <img src={iconUrl} alt="" className="category-chip-icon-image" loading="lazy" />
                  ) : (
                    getCategoryEmoji(category.name, category.id)
                  )}
                </span>
              </span>
              <span className="category-chip-label">{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryChipsRow;
