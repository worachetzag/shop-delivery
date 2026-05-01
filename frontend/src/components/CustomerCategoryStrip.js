import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import { getCategoryAccentHue, getCategoryEmoji } from '../utils/categoryVisual';
import { resolveMediaUrl } from '../utils/media';
import fastFoodLottie from '../assets/lottie/fast-food.json';
import './CustomerCategoryStrip.css';

const ALL_TILE_HUE = 162;
const ALL_TILE_EMOJI = '🛒';

function pickCategoryIconUrl(category) {
  if (!category || typeof category !== 'object') return '';
  const candidates = [
    category.icon_image,
    category.icon_url,
    category.image,
    category.image_url,
    category.thumbnail,
  ];
  const hit = candidates.find((value) => {
    if (!value) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    return typeof value === 'object' && typeof value.url === 'string' && value.url.trim().length > 0;
  });
  if (!hit) return '';
  return resolveMediaUrl(hit, '');
}

function isSnackCategoryName(name) {
  return /ขนม|snack|candy/i.test(String(name || ''));
}

function defaultResolveHref(categoryId) {
  if (!categoryId) return '/customer/products';
  return `/customer/products?category_id=${encodeURIComponent(categoryId)}`;
}

/**
 * @param {{ id: string|number, name: string }[]} categories
 * @param {boolean} [showSeeAllLink=true]
 * @param {string} [seeAllHref='/customer/products']
 * @param {boolean} [showAllTile=false] — ปุ่ม "ทั้งหมด" (ใช้หน้ารายการสินค้า)
 * @param {string} [selectedCategoryId=''] — ไฮไลต์หมวดที่เลือก (เมื่อมี showAllTile / resolveHref)
 * @param {(categoryId: string | null) => string} [resolveHref] — null = ทั้งหมด; ถ้าไม่ส่งใช้ลิงก์มาตรฐาน
 * @param {string} [headingId='customer-category-strip-heading']
 * @param {boolean} [noOuterContainer=false] — ไม่ห่อด้วย `.container` (ใช้เมื่ออยู่ใน container ของหน้าอยู่แล้ว)
 */
function CustomerCategoryStrip({
  categories = [],
  showSeeAllLink = true,
  seeAllHref = '/customer/products',
  showAllTile = false,
  selectedCategoryId = '',
  resolveHref,
  headingId = 'customer-category-strip-heading',
  noOuterContainer = false,
}) {
  const sorted = useMemo(
    () =>
      [...categories]
        .filter((c) => c && c.id != null)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th')),
    [categories],
  );

  const hrefFor = resolveHref || defaultResolveHref;

  if (sorted.length === 0) return null;

  const sel = selectedCategoryId === '' || selectedCategoryId == null ? '' : String(selectedCategoryId);

  const inner = (
    <>
      <header className="customer-category-strip-head">
        <h2 id={headingId} className="customer-category-strip-title">
          หมวดหมู่สินค้า
        </h2>
        {showSeeAllLink ? (
          <Link to={seeAllHref} className="customer-category-strip-see-all">
            ดูทั้งหมด
            <span className="customer-category-strip-chevron" aria-hidden>
              ›
            </span>
          </Link>
        ) : null}
      </header>
      <div className="customer-category-strip-scroll" role="list">
        {showAllTile ? (
          <Link
            role="listitem"
            key="__all__"
            to={hrefFor(null)}
            className={`customer-category-strip-item${sel === '' ? ' is-active' : ''}`}
          >
            <span
              className="customer-category-strip-icon-wrap"
              style={{ '--category-accent-hue': ALL_TILE_HUE }}
              aria-hidden
            >
              <span className="customer-category-strip-icon">{ALL_TILE_EMOJI}</span>
            </span>
            <span className="customer-category-strip-label">ทั้งหมด</span>
          </Link>
        ) : null}
        {sorted.map((cat) => {
          const cid = String(cat.id);
          const iconUrl = pickCategoryIconUrl(cat);
          const showSnackLottie = isSnackCategoryName(cat.name);
          return (
            <Link
              role="listitem"
              key={cat.id}
              to={hrefFor(cid)}
              className={`customer-category-strip-item${sel !== '' && sel === cid ? ' is-active' : ''}`}
            >
              <span
                className={`customer-category-strip-icon-wrap${iconUrl ? ' has-image' : ''}`}
                style={{
                  '--category-accent-hue': getCategoryAccentHue(cat.id),
                }}
                aria-hidden
              >
                <span className="customer-category-strip-icon">
                  {showSnackLottie ? (
                    <Lottie
                      animationData={fastFoodLottie}
                      loop
                      autoplay
                      className="customer-category-strip-lottie"
                      aria-hidden
                    />
                  ) : iconUrl ? (
                    <img src={iconUrl} alt="" className="customer-category-strip-icon-image" loading="lazy" />
                  ) : (
                    getCategoryEmoji(cat.name, cat.id)
                  )}
                </span>
              </span>
              <span className="customer-category-strip-label">{cat.name}</span>
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <section className="customer-category-strip" aria-labelledby={headingId}>
      {noOuterContainer ? inner : <div className="container">{inner}</div>}
    </section>
  );
}

export default CustomerCategoryStrip;
