import React, { useEffect, useState } from 'react';
import config from '../config';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import { usePopup } from '../components/PopupProvider';
import { ADMIN_SECTION_LABELS } from '../utils/adminNavTitles';
import './AdminDashboard.css';
import './AdminStoreSettingsPage.css';

const emptyHours = {
  pickup: { start_time: '08:00', end_time: '20:00', is_active: true },
  delivery: { start_time: '08:00', end_time: '20:00', is_active: true },
};

const defaultDeliveryFeeTiers = [
  { threshold_km: 3, fee_amount: 0 },
  { threshold_km: 5, fee_amount: 20 },
  { threshold_km: 10, fee_amount: 35 },
  { threshold_km: '', fee_amount: 50 },
];

const toInputTime = (value) => (value ? String(value).slice(0, 5) : '');

const AdminStoreSettingsPage = ({ section = 'all' }) => {
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    store_location: {
      name: '',
      address: '',
      promptpay_number: '',
      low_stock_alert_quantity: '5',
      latitude: '',
      longitude: '',
    },
    service_hours: emptyHours,
    delivery_fee_tiers: defaultDeliveryFeeTiers,
  });

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  const loadData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${config.API_BASE_URL}orders/admin/store-settings/`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`โหลดข้อมูลไม่สำเร็จ (${response.status})`);
      const data = await response.json();
      const sl = data.store_location || {};
      const sh = data.service_hours || {};
      setForm({
        store_location: {
          name: sl.name || '',
          address: sl.address || '',
          promptpay_number: sl.promptpay_number || '',
          low_stock_alert_quantity:
            sl.low_stock_alert_quantity !== undefined && sl.low_stock_alert_quantity !== null
              ? String(sl.low_stock_alert_quantity)
              : '5',
          latitude: sl.latitude ?? '',
          longitude: sl.longitude ?? '',
        },
        service_hours: {
          pickup: {
            start_time: toInputTime(sh.pickup?.start_time) || '08:00',
            end_time: toInputTime(sh.pickup?.end_time) || '20:00',
            is_active: sh.pickup?.is_active ?? true,
          },
          delivery: {
            start_time: toInputTime(sh.delivery?.start_time) || '08:00',
            end_time: toInputTime(sh.delivery?.end_time) || '20:00',
            is_active: sh.delivery?.is_active ?? true,
          },
        },
        delivery_fee_tiers: (() => {
          const tiers = Array.isArray(data.delivery_fee_tiers) ? data.delivery_fee_tiers : [];
          if (!tiers.length) return defaultDeliveryFeeTiers;

          const mapped = tiers
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((t) => ({
              threshold_km: t.threshold_km === null || t.threshold_km === undefined ? '' : t.threshold_km,
              fee_amount: t.fee_amount ?? 0,
            }));

          const hasOpenEnded = mapped.length && mapped[mapped.length - 1].threshold_km === '';
          if (!hasOpenEnded) {
            mapped.push({ threshold_km: '', fee_amount: mapped[mapped.length - 1]?.fee_amount ?? 0 });
          }
          return mapped;
        })(),
      });
    } catch (error) {
      popup.error(error.message || 'โหลดข้อมูลร้านไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onLocationChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      store_location: { ...prev.store_location, [key]: value },
    }));
  };

  const onHoursChange = (serviceType, key, value) => {
    setForm((prev) => ({
      ...prev,
      service_hours: {
        ...prev.service_hours,
        [serviceType]: { ...prev.service_hours[serviceType], [key]: value },
      },
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = getToken();
      const alertRaw = String(form.store_location.low_stock_alert_quantity ?? '').trim();
      const alertParsed = parseInt(alertRaw, 10);
      const lowStockAlertQty = Number.isFinite(alertParsed) && alertParsed >= 0 ? alertParsed : 0;

      const payload = {
        store_location: {
          ...form.store_location,
          latitude: form.store_location.latitude === '' ? null : form.store_location.latitude,
          longitude: form.store_location.longitude === '' ? null : form.store_location.longitude,
          low_stock_alert_quantity: lowStockAlertQty,
        },
        service_hours: form.service_hours,
        delivery_fee_tiers: form.delivery_fee_tiers.map((t) => ({
          threshold_km: t.threshold_km === '' ? null : t.threshold_km,
          fee_amount: t.fee_amount,
        })),
      };
      const response = await fetch(`${config.API_BASE_URL}orders/admin/store-settings/`, {
        method: 'PUT',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `บันทึกไม่สำเร็จ (${response.status})`);
      popup.success('บันทึกตั้งค่าร้านเรียบร้อย');
      await loadData();
    } catch (error) {
      popup.error(error.message || 'บันทึกตั้งค่าร้านไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const setTierField = (idx, key, value) => {
    setForm((prev) => {
      const next = [...prev.delivery_fee_tiers];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, delivery_fee_tiers: next };
    });
  };

  const heading = ADMIN_SECTION_LABELS.store[section] || 'ตั้งค่าร้าน';

  return (
    <AdminPageShell
      header={(
        <AdminPageHeader title={heading} />
      )}
    >
        <div className="store-settings-page store-settings-page--embedded">
          {loading ? (
            <div className="store-settings-loading">กำลังโหลดข้อมูล...</div>
          ) : (
            <form className="store-settings-form" onSubmit={submit}>
              {(section === 'all' || section === 'store') && (
                <section className="store-settings-card">
                  <h2 className="store-settings-card__title">ข้อมูลร้านและพิกัด</h2>
                  <p className="store-settings-card__hint">
                    ชื่อ ที่อยู่ และเกณฑ์แจ้งเตือนสต็อกที่ลูกค้าเห็นในหน้าร้านและคำสั่งซื้อ พิกัดใช้คำนวณระยะทาง/ค่าส่งและแผนที่
                  </p>
                  <div className="store-settings-stack">
                    <div className="store-settings-field">
                      <label className="form-label" htmlFor="store-settings-name">
                        ชื่อร้าน
                      </label>
                      <input
                        id="store-settings-name"
                        className="form-input"
                        value={form.store_location.name}
                        onChange={(e) => onLocationChange('name', e.target.value)}
                        placeholder="ชื่อร้าน"
                        autoComplete="organization"
                      />
                    </div>
                    <div className="store-settings-field">
                      <label className="form-label" htmlFor="store-settings-address">
                        ที่อยู่ร้าน
                      </label>
                      <textarea
                        id="store-settings-address"
                        className="form-textarea"
                        rows={4}
                        value={form.store_location.address}
                        onChange={(e) => onLocationChange('address', e.target.value)}
                        placeholder="เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                      />
                    </div>
                    <div className="store-settings-field">
                      <label className="form-label" htmlFor="store-settings-low-stock">
                        แจ้งเตือนสต็อกใกล้หมด
                      </label>
                      <p className="store-settings-field__hint">
                        ถ้าจำนวนคงเหลือหลังหักจองไม่เกินค่านี้ ระบบจะถือว่าใกล้หมด (แดงในแอดมิน / ข้อความในแอปลูกค้า)
                        — ใส่ 0 เพื่อปิดเกณฑ์ระดับร้านและใช้เฉพาะจุดเตือนต่อสินค้า
                      </p>
                      <input
                        id="store-settings-low-stock"
                        className="form-input"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={form.store_location.low_stock_alert_quantity}
                        onChange={(e) => onLocationChange('low_stock_alert_quantity', e.target.value)}
                      />
                    </div>
                    <div className="store-settings-subsection">
                      <h3 className="store-settings-subsection__title">พิกัดบนแผนที่</h3>
                      <p className="store-settings-subsection__hint">
                        ใช้สำหรับคำนวณระยะทางและค่าจัดส่ง (ว่างได้ถ้ายังไม่ใช้แผนที่)
                      </p>
                      <div className="store-settings-row-2">
                        <div className="store-settings-field">
                          <label className="form-label" htmlFor="store-settings-lat">
                            ละติจูด
                          </label>
                          <input
                            id="store-settings-lat"
                            className="form-input"
                            value={form.store_location.latitude}
                            onChange={(e) => onLocationChange('latitude', e.target.value)}
                            placeholder="เช่น 13.756331"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="store-settings-field">
                          <label className="form-label" htmlFor="store-settings-lng">
                            ลองจิจูด
                          </label>
                          <input
                            id="store-settings-lng"
                            className="form-input"
                            value={form.store_location.longitude}
                            onChange={(e) => onLocationChange('longitude', e.target.value)}
                            placeholder="เช่น 100.501762"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {(section === 'all' || section === 'payment') && (
                <section className="store-settings-card">
                  <h2 className="store-settings-card__title">การชำระเงิน (PromptPay)</h2>
                  <p className="store-settings-card__hint">ใช้สร้าง QR รับเงินจากลูกค้า</p>
                  <div className="store-settings-field">
                    <label className="form-label" htmlFor="store-settings-promptpay">
                      เบอร์พร้อมเพย์ร้าน
                    </label>
                    <input
                      id="store-settings-promptpay"
                      className="form-input"
                      value={form.store_location.promptpay_number}
                      onChange={(e) => onLocationChange('promptpay_number', e.target.value)}
                      placeholder="เช่น 0812345678"
                      inputMode="tel"
                      autoComplete="off"
                    />
                  </div>
                </section>
              )}

              {(section === 'all' || section === 'hours') && (
                <section className="store-settings-card">
                  <h2 className="store-settings-card__title">เวลาทำการ</h2>
                  <p className="store-settings-card__hint">
                    กำหนดช่วงเวลาเปิดรับคำสั่งซื้อแยกตามประเภทบริการ
                  </p>
                  {['pickup', 'delivery'].map((type) => (
                    <div key={type} className="store-settings-hours-block">
                      <span className="store-settings-hours-block__title">
                        {type === 'pickup' ? 'รับสินค้าเองที่ร้าน' : 'จัดส่งถึงบ้าน'}
                      </span>
                      <div className="store-settings-row-2">
                        <div className="store-settings-field">
                          <label className="form-label" htmlFor={`store-hours-${type}-start`}>
                            เริ่ม
                          </label>
                          <input
                            id={`store-hours-${type}-start`}
                            className="form-input"
                            type="time"
                            value={form.service_hours[type].start_time}
                            onChange={(e) => onHoursChange(type, 'start_time', e.target.value)}
                          />
                        </div>
                        <div className="store-settings-field">
                          <label className="form-label" htmlFor={`store-hours-${type}-end`}>
                            สิ้นสุด
                          </label>
                          <input
                            id={`store-hours-${type}-end`}
                            className="form-input"
                            type="time"
                            value={form.service_hours[type].end_time}
                            onChange={(e) => onHoursChange(type, 'end_time', e.target.value)}
                          />
                        </div>
                      </div>
                      <label className="store-settings-checkbox" htmlFor={`store-hours-${type}-active`}>
                        <input
                          id={`store-hours-${type}-active`}
                          type="checkbox"
                          checked={!!form.service_hours[type].is_active}
                          onChange={(e) => onHoursChange(type, 'is_active', e.target.checked)}
                        />
                        เปิดใช้งานช่วงเวลานี้
                      </label>
                    </div>
                  ))}
                </section>
              )}

              {(section === 'all' || section === 'delivery-fees') && (
                <section className="store-settings-card">
                  <h2 className="store-settings-card__title">ค่าส่งตามระยะทาง</h2>
                  <p className="store-settings-card__hint">
                    ตั้งเป็นหลายบรรทัดแบบ “ไม่เกิน X กม.” และแถวสุดท้ายเป็น “มากกว่า” (เว้นช่องระยะทางเป็นค่าว่าง)
                  </p>

                  <div className="store-settings-tiers-stack">
                    {form.delivery_fee_tiers.map((tier, idx) => {
                      const isLast = idx === form.delivery_fee_tiers.length - 1;
                      return (
                        <div key={`tier-${idx}`} className="store-settings-tier">
                          <div>
                            {isLast ? (
                              <>
                                <div className="store-settings-tier-dynamic-title">ช่วงสุดท้าย (มากกว่าระยะก่อนหน้า)</div>
                                <div className="store-settings-tier-label">ระยะทางสูงสุด (กม.)</div>
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  value={tier.threshold_km}
                                  disabled
                                  placeholder="เว้นว่าง"
                                  aria-label="ระยะทางช่วงสุดท้าย — เปิดค่าส่งแบบไม่มีเพดักมิติบนท้าย"
                                />
                              </>
                            ) : (
                              <>
                                <div className="store-settings-tier-dynamic-title">
                                  {`ไม่เกิน ${tier.threshold_km === '' ? '—' : tier.threshold_km} กม.`}
                                </div>
                                <div className="store-settings-tier-label">ระยะทางไม่เกิน (กม.)</div>
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  value={tier.threshold_km}
                                  placeholder="เช่น 5"
                                  onChange={(e) =>
                                    setTierField(idx, 'threshold_km', e.target.value === '' ? '' : e.target.value)
                                  }
                                  aria-label={`ระยะทางช่วงที่ ${idx + 1}`}
                                />
                              </>
                            )}
                          </div>

                          <div>
                            <div className="store-settings-tier-label">ค่าส่ง (บาท)</div>
                            <input
                              className="form-input"
                              type="number"
                              step="1"
                              value={tier.fee_amount}
                              placeholder="เช่น 20"
                              onChange={(e) =>
                                setTierField(idx, 'fee_amount', e.target.value === '' ? 0 : e.target.value)
                              }
                              aria-label={`ค่าส่งช่วงที่ ${idx + 1}`}
                            />
                          </div>

                          {!isLast && (
                            <div className="store-settings-tier__actions">
                              <button
                                type="button"
                                className="store-settings-tier-remove"
                                onClick={() => {
                                  setForm((prev) => {
                                    const next = [...prev.delivery_fee_tiers];
                                    if (next.length <= 2) return prev;
                                    next.splice(idx, 1);
                                    return { ...prev, delivery_fee_tiers: next };
                                  });
                                }}
                                title="ลบช่วงนี้"
                              >
                                ลบช่วง
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="store-settings-btn-row store-settings-tiers-actions-row">
                    <button
                      type="button"
                      className="btn-secondary store-settings-btn-compact"
                      onClick={() => {
                        setForm((prev) => {
                          const next = [...prev.delivery_fee_tiers];
                          const newTier = { threshold_km: '', fee_amount: 0 };
                          next.splice(next.length - 1, 0, newTier);
                          return { ...prev, delivery_fee_tiers: next };
                        });
                      }}
                    >
                      + เพิ่มช่วงระยะทาง
                    </button>
                  </div>
                </section>
              )}

              <div className="store-settings-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งค่า'}
                </button>
              </div>
            </form>
          )}
        </div>
    </AdminPageShell>
  );
};

export default AdminStoreSettingsPage;
