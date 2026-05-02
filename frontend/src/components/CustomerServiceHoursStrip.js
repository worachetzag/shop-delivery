import React, { useState, useEffect, useMemo } from 'react';
import config from '../config';
import { getServiceHoursStatus } from '../utils/serviceHours';
import './CustomerServiceHoursStrip.css';

/** ลดการยิง store-location ซ้ำเมื่อเปลี่ยนหน้า/รีเรนเดอร์ใน ~30 วินาที */
let _hoursCache = null;
let _hoursCacheAt = 0;
const HOURS_CACHE_MS = 30_000;

function hasConfiguredHours(serviceHours) {
  if (!serviceHours || typeof serviceHours !== 'object') return false;
  return Object.keys(serviceHours).length > 0;
}

/**
 * แถบแจ้งสถานะเปิด/ปิดตามเวลาทำการร้าน (รับที่ร้าน / จัดส่ง)
 * โหลดจาก GET orders/store-location/ — ถ้ายังไม่มีการตั้งค่าเวลาในระบบจะไม่แสดง
 */
const CustomerServiceHoursStrip = ({ compact = false }) => {
  const [serviceHours, setServiceHours] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [hoursTick, setHoursTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setHoursTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    if (_hoursCache != null && now - _hoursCacheAt < HOURS_CACHE_MS) {
      setServiceHours(_hoursCache);
      setLoaded(true);
      return undefined;
    }
    (async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}orders/store-location/`, {
          method: 'GET',
          headers: { 'ngrok-skip-browser-warning': 'true' },
          credentials: 'include',
        });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const payload = data?.store_location || data || {};
        const sh = payload.service_hours ?? data?.service_hours ?? null;
        _hoursCache = sh;
        _hoursCacheAt = Date.now();
        if (!cancelled) setServiceHours(sh);
      } catch {
        if (!cancelled) setServiceHours(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickupStatus = useMemo(
    () => getServiceHoursStatus(serviceHours, 'pickup'),
    [serviceHours, hoursTick],
  );
  const deliveryStatus = useMemo(
    () => getServiceHoursStatus(serviceHours, 'delivery'),
    [serviceHours, hoursTick],
  );

  if (!loaded || !hasConfiguredHours(serviceHours)) {
    return null;
  }

  if (pickupStatus.open && deliveryStatus.open) {
    return null;
  }

  return (
    <div
      className={`customer-service-hours-strip${compact ? ' customer-service-hours-strip--compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="customer-service-hours-strip__title">เวลาเปิดรับคำสั่ง</div>
      <ul className="customer-service-hours-strip__list">
        <li className={pickupStatus.open ? 'is-open' : 'is-closed'}>
          <span className="customer-service-hours-strip__label">รับที่ร้าน</span>
          <span className="customer-service-hours-strip__state">
            {pickupStatus.open ? 'เปิดรับอยู่' : pickupStatus.message}
          </span>
        </li>
        <li className={deliveryStatus.open ? 'is-open' : 'is-closed'}>
          <span className="customer-service-hours-strip__label">จัดส่งถึงบ้าน</span>
          <span className="customer-service-hours-strip__state">
            {deliveryStatus.open ? 'เปิดรับอยู่' : deliveryStatus.message}
          </span>
        </li>
      </ul>
      <p className="customer-service-hours-strip__hint">
        เวลาตามประเทศไทย — ระบบจะตรวจสอบอีกครั้งเมื่อยืนยันคำสั่งซื้อ
      </p>
    </div>
  );
};

export default CustomerServiceHoursStrip;
