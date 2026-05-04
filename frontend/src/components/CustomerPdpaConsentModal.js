import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import config from '../config';
import { pdpaService } from '../services/api';
import { usePopup } from './PopupProvider';
import './CustomerPdpaConsentModal.css';

const SCROLL_END_EPS = 10;

/**
 * ถ้าแอดมินวางโค้ด HTML ในโหมดข้อความ ระบบอาจเก็บเป็น &lt;h2&gt;…
 * พอ render ด้วย innerHTML จะกลายเป็นข้อความที่มองเห็นเป็น <h2> ดิบ
 * ต้องถอด entity ก่อน sanitize (จับเฉพาะที่ดูเหมือนแท็กถูก escape)
 */
function normalizeEscapedMarkup(html) {
  if (!html || typeof html !== 'string') return '';
  if (!/&lt;[a-z!?/]/i.test(html)) {
    return html;
  }
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
}

function sanitizePolicyHtml(html) {
  if (!html || typeof html !== 'string') return '';
  const normalized = normalizeEscapedMarkup(html);
  return DOMPurify.sanitize(normalized, {
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
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [declining, setDeclining] = useState(false);
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
    setMarketingOptIn(false);
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
      let marketingNote = '';
      if (marketingOptIn) {
        try {
          await pdpaService.updateConsent({
            consent_type: 'marketing',
            is_given: true,
          });
        } catch {
          marketingNote =
            ' ยังบันทึกความยินยอมการตลาดไม่สำเร็จ — คุณสามารถลองอีกครั้งในหน้าโปรไฟล์ได้';
        }
      }
      setOpen(false);
      setPolicy(null);
      popup.success(`ยอมรับนโยบายความเป็นส่วนตัวแล้ว${marketingNote}`);
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

  const logoutCustomerSession = async () => {
    try {
      await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
    window.location.href = '/customer/login';
  };

  const handleDeclineAndLogout = async () => {
    if (!policy?.id) return;
    if (
      !(await popup.confirm(
        'ไม่ยอมรับนโยบายความเป็นส่วนตัว — ระบบจะบันทึกการปฏิเสธและออกจากบัญชีผู้ใช้ เพื่อใช้บริการในภายหลังคุณต้องเข้าสู่ระบบและยอมรับนโยบายใหม่',
        { tone: 'warning', confirmText: 'ไม่ยอมรับและออกจากระบบ' },
      ))
    ) {
      return;
    }
    setDeclining(true);
    try {
      await pdpaService.recordPrivacyPolicyDecline(policy.id);
      await logoutCustomerSession();
    } catch (err) {
      let msg = 'บันทึกการปฏิเสธไม่สำเร็จ กรุณาลองอีกครั้ง';
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
      setDeclining(false);
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
        </div>

        <div
          className="customer-pdpa-dialog__scroll"
          ref={scrollRef}
          onScroll={onScrollBody}
        >
          <div className="customer-pdpa-dialog__intro">
            <p>
              การให้ความยินยอมเป็นไปโดยสมัครใจ โปรดอ่านรายละเอียดด้านล่างก่อนติ๊กยอมรับ
              หากคุณเข้าสู่ระบบด้วย LINE หรือบริการบุคคลที่สามอื่น อาจมีการส่งข้อมูลบางส่วนระหว่างผู้ให้บริการ — รายละเอียดอยู่ในนโยบายด้านล่าง
            </p>
            <p>
              คุณสามารถถอนความยินยอมนโยบายความเป็นส่วนตัวได้ทุกเมื่อที่เมนูโปรไฟล์ → ส่วน «ความเป็นส่วนตัว (PDPA)»
            </p>
          </div>
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
          <label
            className={`customer-pdpa-consent-row customer-pdpa-consent-row--optional${canCheck ? '' : ' customer-pdpa-consent-row--disabled'}`}
          >
            <input
              type="checkbox"
              checked={marketingOptIn}
              disabled={!canCheck}
              onChange={(ev) => setMarketingOptIn(ev.target.checked)}
            />
            <span>
              (ไม่บังคับ) ข้าพเจ้ายินยอมให้ส่งข่าวสาร โปรโมชัน หรือข้อมูลการตลาดทางช่องทางที่ระบุในนโยบาย — แยกจากการยอมรับนโยบายความเป็นส่วนตัว
            </span>
          </label>
          {!readToEnd ? (
            <p className="customer-pdpa-hint" role="status">
              เลื่อนอ่านนโยบายในช่องด้านบนให้ครบจนสุด แล้วจึงติ๊กยอมรับนโยบาย (จำเป็น) — ช่องการตลาดเลือกได้หรือไม่ก็ได้
            </p>
          ) : null}
          {readToEnd && !agreed ? (
            <p className="customer-pdpa-hint" role="status">
              โปรดติ๊กช่อง “ข้าพเจ้าได้อ่านและยอมรับนโยบายความเป็นส่วนตัว” ก่อนกดดำเนินการต่อ — ช่องการตลาดไม่บังคับ
            </p>
          ) : null}
          <div className="customer-pdpa-dialog__actions">
            <button
              type="button"
              className="customer-pdpa-decline"
              disabled={submitting || declining}
              onClick={handleDeclineAndLogout}
            >
              {declining ? 'กำลังดำเนินการ...' : 'ไม่ยอมรับ — ออกจากระบบ'}
            </button>
            <button
              type="submit"
              className="customer-pdpa-submit"
              disabled={!readToEnd || !agreed || submitting || declining}
            >
              {submitting ? 'กำลังบันทึก...' : 'ยอมรับและดำเนินการต่อ'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
