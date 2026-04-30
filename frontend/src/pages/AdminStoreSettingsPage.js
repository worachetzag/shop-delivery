import React, { useEffect, useState } from 'react';
import config from '../config';
import { usePopup } from '../components/PopupProvider';

const emptyHours = {
  pickup: { start_time: '08:00', end_time: '20:00', is_active: true },
  delivery: { start_time: '08:00', end_time: '20:00', is_active: true },
};

const defaultDeliveryFeeTiers = [
  { threshold_km: 3, fee_amount: 0 },
  { threshold_km: 5, fee_amount: 20 },
  { threshold_km: 10, fee_amount: 35 },
  { threshold_km: '', fee_amount: 50 }, // แถวสุดท้าย (ช่วงสุดท้าย) เว้น threshold
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

          // backend ส่ง threshold_km เป็น number หรือ null; frontend เก็บเป็น string สำหรับ input
          const mapped = tiers
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((t) => ({
              threshold_km: t.threshold_km === null || t.threshold_km === undefined ? '' : t.threshold_km,
              fee_amount: t.fee_amount ?? 0,
            }));

          // ให้มีแถวสุดท้ายแบบ open-ended เสมอ
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
      const payload = {
        store_location: {
          ...form.store_location,
          latitude: form.store_location.latitude === '' ? null : form.store_location.latitude,
          longitude: form.store_location.longitude === '' ? null : form.store_location.longitude,
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

  const sectionStyle = {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
  };

  const fieldGridStyle = {
    display: 'grid',
    gap: 12,
  };

  const sectionTitleStyle = { margin: '0 0 4px 0' };
  const sectionHintStyle = { marginTop: 0, marginBottom: 12, color: '#6b7280', fontSize: 14 };

  const setTierField = (idx, key, value) => {
    setForm((prev) => {
      const next = [...prev.delivery_fee_tiers];
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, delivery_fee_tiers: next };
    });
  };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '16px' }}>
      <h2 style={{ marginBottom: 6 }}>ตั้งค่าร้าน</h2>
      <p style={{ marginTop: 0, color: '#666' }}>
        จัดการข้อมูลร้านแบบแยกหมวด เพื่อให้ตั้งค่าได้ชัดเจนว่าแต่ละส่วนใช้ทำอะไร
      </p>
      {loading ? (
        <div>กำลังโหลดข้อมูล...</div>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          {(section === 'all' || section === 'store') && (
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}>1) ข้อมูลร้าน</h3>
            <p style={sectionHintStyle}>ข้อมูลพื้นฐานที่ลูกค้าเห็นหน้าร้านและในคำสั่งซื้อ</p>
            <div style={fieldGridStyle}>
              <input
                value={form.store_location.name}
                onChange={(e) => onLocationChange('name', e.target.value)}
                placeholder="ชื่อร้าน"
              />
              <textarea
                value={form.store_location.address}
                onChange={(e) => onLocationChange('address', e.target.value)}
                placeholder="ที่อยู่ร้าน"
                rows={3}
              />
            </div>
          </section>
          )}

          {(section === 'all' || section === 'location') && (
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}>2) พิกัดร้าน</h3>
            <p style={sectionHintStyle}>ใช้สำหรับคำนวณระยะทาง/ค่าส่ง และแสดงตำแหน่งบนแผนที่</p>
            <div style={fieldGridStyle}>
              <input
                value={form.store_location.latitude}
                onChange={(e) => onLocationChange('latitude', e.target.value)}
                placeholder="ละติจูด (เช่น 13.756331)"
              />
              <input
                value={form.store_location.longitude}
                onChange={(e) => onLocationChange('longitude', e.target.value)}
                placeholder="ลองจิจูด (เช่น 100.501762)"
              />
            </div>
          </section>
          )}

          {(section === 'all' || section === 'payment') && (
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}>3) การชำระเงิน (PromptPay)</h3>
            <p style={sectionHintStyle}>ใช้สร้าง QR รับเงินจากลูกค้า</p>
            <div style={fieldGridStyle}>
              <input
                value={form.store_location.promptpay_number}
                onChange={(e) => onLocationChange('promptpay_number', e.target.value)}
                placeholder="เบอร์พร้อมเพย์ร้าน (เช่น 0812345678)"
              />
            </div>
          </section>
          )}

          {(section === 'all' || section === 'hours') && (
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}>4) เวลาทำการ</h3>
            <p style={sectionHintStyle}>กำหนดช่วงเวลาเปิดรับคำสั่งซื้อแยกตามประเภทบริการ</p>
            {['pickup', 'delivery'].map((type) => (
              <div key={type} style={{ marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 12 }}>
                <strong>{type === 'pickup' ? 'รับสินค้าเองที่ร้าน' : 'จัดส่งถึงบ้าน'}</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
                  <label>
                    เริ่ม
                    <input
                      type="time"
                      value={form.service_hours[type].start_time}
                      onChange={(e) => onHoursChange(type, 'start_time', e.target.value)}
                    />
                  </label>
                  <label>
                    สิ้นสุด
                    <input
                      type="time"
                      value={form.service_hours[type].end_time}
                      onChange={(e) => onHoursChange(type, 'end_time', e.target.value)}
                    />
                  </label>
                </div>
                <label style={{ display: 'inline-flex', marginTop: 8, alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!form.service_hours[type].is_active}
                    onChange={(e) => onHoursChange(type, 'is_active', e.target.checked)}
                  />
                  เปิดใช้งาน
                </label>
              </div>
            ))}
          </section>
          )}

          {(section === 'all' || section === 'delivery-fees') && (
            <section style={sectionStyle}>
              <h3 style={sectionTitleStyle}>5) ค่าส่งตามระยะทาง</h3>
              <p style={sectionHintStyle}>
                ตั้งเป็นหลายบรรทัดแบบ “ไม่เกิน X กม.” และแถวสุดท้ายเป็น “มากกว่า” (เว้นช่องระยะทางเป็นค่าว่าง)
              </p>

              <div style={{ display: 'grid', gap: 12 }}>
                {form.delivery_fee_tiers.map((tier, idx) => {
                  const isLast = idx === form.delivery_fee_tiers.length - 1;
                  return (
                    <div
                      key={`tier-${idx}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isLast ? '1fr 140px' : '1fr 140px 60px',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 6 }}>
                        <label style={{ fontWeight: 700, fontSize: 14 }}>
                          {isLast
                            ? 'ช่วงสุดท้าย (มากกว่า)'
                            : `ไม่เกิน ${tier.threshold_km === '' ? '—' : tier.threshold_km} กม.`}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={tier.threshold_km}
                          disabled={isLast}
                          placeholder={isLast ? 'เว้นว่าง' : 'เช่น 5'}
                          onChange={(e) => setTierField(idx, 'threshold_km', e.target.value === '' ? '' : e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gap: 6 }}>
                        <label style={{ fontWeight: 700, fontSize: 14 }}>ค่าส่ง (บาท)</label>
                        <input
                          type="number"
                          step="1"
                          value={tier.fee_amount}
                          placeholder="เช่น 20"
                          onChange={(e) => setTierField(idx, 'fee_amount', e.target.value === '' ? 0 : e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>

                      {!isLast && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            setForm((prev) => {
                              const next = [...prev.delivery_fee_tiers];
                              if (next.length <= 2) return prev; // อย่างน้อย 1 finite + 1 open-ended
                              next.splice(idx, 1);
                              return { ...prev, delivery_fee_tiers: next };
                            });
                          }}
                          title="ลบช่วง"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  );
                })}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setForm((prev) => {
                        const next = [...prev.delivery_fee_tiers];
                        const openEnded = next[next.length - 1];
                        const newTier = { threshold_km: '', fee_amount: 0 };
                        next.splice(next.length - 1, 0, newTier);
                        return { ...prev, delivery_fee_tiers: next };
                      });
                    }}
                  >
                    เพิ่มช่วง
                  </button>
                </div>
              </div>
            </section>
          )}

          <div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งค่า'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AdminStoreSettingsPage;
