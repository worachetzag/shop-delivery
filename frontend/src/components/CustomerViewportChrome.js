import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './CustomerViewportChrome.css';

const FAB_THRESHOLD_PX = 260;

function scrollDocumentToTop() {
  window.scrollTo(0, 0);
  if (typeof document !== 'undefined') {
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }
}

/**
 * โหมดลูกค้า: เลื่อนบนสุดทุกครั้งที่เปลี่ยนหน้า/query และปุ่มลอยเลื่อนขึ้นเมื่อเลื่อนลง
 */
export default function CustomerViewportChrome() {
  const location = useLocation();
  const [showFab, setShowFab] = useState(false);

  useLayoutEffect(() => {
    scrollDocumentToTop();
    window.requestAnimationFrame(() => {
      const y = window.scrollY ?? document.documentElement?.scrollTop ?? 0;
      setShowFab(y > FAB_THRESHOLD_PX);
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY ?? document.documentElement?.scrollTop ?? 0;
      setShowFab(y > FAB_THRESHOLD_PX);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleFabClick = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  if (!showFab) return null;

  return (
    <button
      type="button"
      className="customer-scroll-top-fab"
      onClick={handleFabClick}
      aria-label="เลื่อนขึ้นบนสุด"
    >
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 5v14M12 5l6 6M12 5l-6 6" />
      </svg>
    </button>
  );
}
