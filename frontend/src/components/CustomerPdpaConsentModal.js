import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { pdpaService } from '../services/api';
import { usePopup } from './PopupProvider';
import './CustomerPdpaConsentModal.css';

const SCROLL_END_EPS = 10;

function sanitizePolicyHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['style', 'class', 'target', 'rel'],
  });
}

/**
 * ลูกค้าที่ล็อกอิน: แสดงนโยบาย PDPA จนกว่าจะยอมรับ
 * ต้องเลื่อนอ่านจนสุดก่อนติ๊กยอมรับได้
 */
export default function CustomerPdpaConsentModal() {
  const location = useLocation();
  const popup = usePopup();
  const [open, setOpen] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + SCROLL_END_EPS) {
      setReadToEnd(true);
      return;
    }
    setReadToEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END_EPS);
  }, []);

  useLayoutEffect(() => {
    if (!open || !policy) return;
    setReadToEnd(false);
    setAgreed(false);
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    const raf = requestAnimationFrame(() => {
      checkScrollEnd();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, policy?.id, policy?.content, checkScrollEnd]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => checkScrollEnd());
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, policy?.id, checkScrollEnd]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => checkScrollEnd();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [open, checkScrollEnd]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const role = localStorage.getItem('user_role') || '';
    if (!token || role !== 'customer') {
      setOpen(false);
      setPolicy(null);
      return;
    }
    if (location.pathname === '/customer/login' || location.pathname === '/login') {
      setOpen(false);
      setPolicy(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await pdpaService.getPdpaConsentStatus();
        if (cancelled) return;
        if (data.requires_consent && data.policy) {
          setPolicy(data.policy);
          setOpen(true);
        } else {
          setOpen(false);
          setPolicy(null);
        }
      } catch {
        if (!cancelled) {
          setOpen(false);
          setPolicy(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const onScrollBody = () => {
    checkScrollEnd();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!policy?.id || !readToEnd || !agreed) return;
    setSubmitting(true);
    try {
      await pdpaService.recordPrivacyPolicyConsent(policy.id);
      setOpen(false);
      setPolicy(null);
      popup.success('ยอมรับนโยบายความเป็นส่วนตัวแล้ว');
    } catch (err) {
      let msg = 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
      if (typeof err === 'string') {
        msg = err;
      } else if (err && typeof err === 'object') {
        if (err.error) msg = err.error;
        else if (err.detail) msg = String(err.detail);
        else {
          const flat = Object.values(err).flat().filter((x) => typeof x === 'string');
          if (flat.length) msg = flat.join(' ');
        }
      }
      popup.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === 'undefined' || !open || !policy) {
    return null;
  }

  const safeHtml = sanitizePolicyHtml(policy.content);
  const canCheck = readToEnd;

  return createPortal(
    <div
      className="customer-pdpa-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-pdpa-title"
    >
      <form className="customer-pdpa-dialog" onSubmit={handleSubmit}>
        <div className="customer-pdpa-dialog__head">
          <h2 id="customer-pdpa-title" className="customer-pdpa-dialog__title">
            {policy.title || 'นโยบายความเป็นส่วนตัว'}
          </h2>
          {policy.version ? (
            <p className="customer-pdpa-dialog__meta">เวอร์ชัน {policy.version}</p>
          ) : null}
        </div>

        <div
          className="customer-pdpa-dialog__scroll"
          ref={scrollRef}
          onScroll={onScrollBody}
        >
          <p className="customer-pdpa-dialog__scroll-hint">
            {readToEnd
              ? 'อ่านครบแล้ว — สามารถติ๊กยอมรับด้านล่างได้'
              : 'กรุณาเลื่อนอ่านจนสุด จึงจะติ๊ก “ยอมรับ” ได้'}
          </p>
          <div
            className="customer-pdpa-dialog__content"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </div>

        <div className="customer-pdpa-dialog__foot">
          <label
            className={`customer-pdpa-consent-row${canCheck ? '' : ' customer-pdpa-consent-row--disabled'}`}
          >
            <input
              type="checkbox"
              checked={agreed}
              disabled={!canCheck}
              onChange={(ev) => setAgreed(ev.target.checked)}
            />
            <span>ข้าพเจ้าได้อ่านและยอมรับนโยบายความเป็นส่วนตัวตามข้างต้น</span>
          </label>
          <button
            type="submit"
            className="customer-pdpa-submit"
            disabled={!readToEnd || !agreed || submitting}
          >
            {submitting ? 'กำลังบันทึก...' : 'ยอมรับและดำเนินการต่อ'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
