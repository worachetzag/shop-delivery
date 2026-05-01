import React from 'react';

/** SVG การ์ตูนเรียบง่ายสำหรับแถบหมวดหมู่ — view เดียวกันทุกตัว */
function S({ children }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      {children}
    </svg>
  );
}

const illustrations = {
  all: (
    <S>
      <path
        d="M10 16h28l-3 19H13L10 16z"
        fill="#FFE08A"
        stroke="#E8A838"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 16l-2.5-6h7" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="38" r="3.8" fill="#64748B" />
      <circle cx="30" cy="38" r="3.8" fill="#64748B" />
      <circle cx="18" cy="38" r="1.4" fill="#CBD5E1" />
      <circle cx="30" cy="38" r="1.4" fill="#CBD5E1" />
    </S>
  ),
  icecream: (
    <S>
      <path d="M18 38l6-26 6 26c0 4-12 4-12 0z" fill="#F4D7A6" stroke="#C49A6C" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 14c0-5.5 4.5-10 10-10s10 4.5 10 10v6H14v-6z" fill="#FFB8CE" stroke="#E879A8" strokeWidth="2" />
      <ellipse cx="24" cy="12" rx="3" ry="2" fill="#FFF5F8" opacity="0.9" />
    </S>
  ),
  bakery: (
    <S>
      <path
        d="M12 28c2-12 22-12 24 0v6c0 3-24 3-24 0v-6z"
        fill="#E8C89E"
        stroke="#B8956A"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M15 22c3-8 15-8 18 0" stroke="#B8956A" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      <path d="M17 26h14" stroke="#B8956A" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </S>
  ),
  dairy: (
    <S>
      <path d="M18 12h12l2 26H16l2-26z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 12l3-6h8l3 6" fill="#BFDBFE" stroke="#60A5FA" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 22h6" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 28h6" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
    </S>
  ),
  bento: (
    <S>
      <rect x="10" y="14" width="28" height="22" rx="4" fill="#FECACA" stroke="#F87171" strokeWidth="2" />
      <path d="M10 26h28" stroke="#F87171" strokeWidth="1.8" />
      <path d="M24 26V36" stroke="#F87171" strokeWidth="1.8" />
      <circle cx="17" cy="20" r="3.5" fill="#FDE68A" />
      <rect x="27" y="29" width="8" height="5" rx="1" fill="#86EFAC" />
    </S>
  ),
  snacks: (
    <S>
      <path d="M14 18l10-8 10 8v18c0 3-20 3-20 0V18z" fill="#FCA5A5" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 22l12 12M30 22L18 34" stroke="#FFF" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      <circle cx="24" cy="14" r="2.5" fill="#FDE047" />
    </S>
  ),
  drinks: (
    <S>
      <path d="M30 10v6h-4v-6" stroke="#64748B" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 18h16l-2 22H18l-2-22z" fill="#67E8F9" stroke="#0891B2" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 14v4" stroke="#F472B6" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="24" cy="18" rx="8" ry="2" fill="#22D3EE" opacity="0.35" />
    </S>
  ),
  produce: (
    <S>
      <circle cx="24" cy="26" r="11" fill="#FCA5A5" stroke="#EF4444" strokeWidth="2" />
      <path d="M24 15c-2 4-8 6-10 10 12-2 14-8 14-10 0 3-2 8-4 10z" fill="#86EFAC" stroke="#22C55E" strokeWidth="1.8" strokeLinejoin="round" />
      <ellipse cx="20" cy="24" rx="2" ry="3" fill="#FECDD3" opacity="0.7" transform="rotate(-20 20 24)" />
    </S>
  ),
  garden: (
    <S>
      <path d="M14 38h20v-4H14v4z" fill="#C4A484" stroke="#8B6914" strokeWidth="2" />
      <path d="M24 34V18" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 22c-6-2-8-10-4-14 2 6 4 10 4 14z" fill="#86EFAC" stroke="#16A34A" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M24 24c6-1 10-8 8-13-4 4-7 9-8 13z" fill="#4ADE80" stroke="#16A34A" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="24" cy="16" r="2" fill="#FDE047" />
    </S>
  ),
  dryfood: (
    <S>
      <path d="M12 28c2-10 22-10 24 0v8H12v-8z" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 30c4 2 12 2 16 0" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 18l6-5M34 22l5-7" stroke="#92400E" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 22c2-4 3-6 6-8" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </S>
  ),
  household: (
    <S>
      <path d="M18 14h12l4 22H14l4-22z" fill="#BFDBFE" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 14v-4a4 4 0 018 0v4" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
      <path d="M30 12l4-4M33 15l4-3" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
    </S>
  ),
  frozen: (
    <S>
      <rect x="14" y="18" width="20" height="18" rx="3" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="2" />
      <path d="M14 26h20M24 18v18" stroke="#7DD3FC" strokeWidth="1.6" />
      <path d="M16 18l16 18M32 18L16 36" stroke="#BAE6FD" strokeWidth="1.2" opacity="0.8" />
      <circle cx="34" cy="12" r="2" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.2" />
      <path d="M34 10v4M32 12h4" stroke="#38BDF8" strokeWidth="1.2" strokeLinecap="round" />
    </S>
  ),
  seafood: (
    <S>
      <path
        d="M10 24c6-8 18-10 26-4-4 6-14 10-22 8-2 3-6 4-8 2 1-3 3-5 4-6z"
        fill="#FDBA74"
        stroke="#EA580C"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="22" r="2" fill="#1E293B" />
      <path d="M12 26c-2-1-3-3-2-5" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
    </S>
  ),
  health: (
    <S>
      <rect x="14" y="16" width="20" height="18" rx="9" fill="#FECDD3" stroke="#EC4899" strokeWidth="2" />
      <path d="M24 20v10M19 25h10" stroke="#FFF" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="24" cy="12" r="4" fill="#FDA4AF" stroke="#FB7185" strokeWidth="1.8" />
    </S>
  ),
  'misc-cart': (
    <S>
      <path d="M12 18h24l-2 18H14L12 18z" fill="#BBF7D0" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 18l-2-5h6" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 14h12" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
    </S>
  ),
  'misc-box': (
    <S>
      <path d="M10 20l14-8 14 8v18H10V20z" fill="#FDE68A" stroke="#CA8A04" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 20l14 8 14-8M24 28v12" stroke="#CA8A04" strokeWidth="1.8" />
      <path d="M16 24l16 8" stroke="#FBBF24" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </S>
  ),
  'misc-sparkle': (
    <S>
      <path d="M24 8l2.5 8 8 2.5-8 2.5L24 29l-2.5-8-8-2.5 8-2.5L24 8z" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="36" cy="14" r="2.5" fill="#FBCFE8" stroke="#EC4899" strokeWidth="1.2" />
      <circle cx="12" cy="32" r="2" fill="#A5F3FC" stroke="#0891B2" strokeWidth="1.2" />
    </S>
  ),
  'misc-seed': (
    <S>
      <path d="M24 36c-6-8-6-18 0-22 6 4 6 14 0 22z" fill="#86EFAC" stroke="#16A34A" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 14v8" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M18 20c4-4 12-4 16 0" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" />
    </S>
  ),
  'misc-jar': (
    <S>
      <path d="M16 18h16v20H16V18z" fill="#FEF9C3" stroke="#CA8A04" strokeWidth="2" strokeLinejoin="round" />
      <path d="M18 14h12v4H18v-4z" fill="#EAB308" stroke="#CA8A04" strokeWidth="1.8" />
      <path d="M20 26c2 3 8 3 10 0" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
    </S>
  ),
  'misc-juice': (
    <S>
      <path d="M14 14h20l-1 26H15L14 14z" fill="#FDBA74" stroke="#EA580C" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 14h16" stroke="#EA580C" strokeWidth="2" />
      <circle cx="24" cy="28" r="5" fill="#FFF7ED" opacity="0.5" />
      <path d="M28 10v6" stroke="#F472B6" strokeWidth="2.5" strokeLinecap="round" />
    </S>
  ),
  'misc-grain': (
    <S>
      <path d="M12 30c2-8 22-8 24 0v6H12v-6z" fill="#FFFBEB" stroke="#D97706" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 26c4 2 12 2 16 0" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="22" r="1.8" fill="#FDE68A" />
      <circle cx="24" cy="20" r="1.8" fill="#FDE68A" />
      <circle cx="28" cy="22" r="1.8" fill="#FDE68A" />
    </S>
  ),
};

/**
 * @param {{ variant: string }} props — จาก getCategoryIllustrationVariant หรือ 'all' สำหรับปุ่มทั้งหมด
 */
export default function CategoryIllustration({ variant }) {
  const node = illustrations[variant] || illustrations['misc-cart'];
  return <span className="category-illustration">{node}</span>;
}
