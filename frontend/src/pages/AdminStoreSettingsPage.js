import React, { useEffect, useState } from 'react';
import config from '../config';
import { usePopup } from '../components/PopupProvider';

const emptyHours = {
  pickup: { start_time: '08:00', end_time: '20:00', is_active: true },
  delivery: { start_time: '08:00', end_time: '20:00', is_active: true },
};

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
                <strong>{type === 'pickup' ? 'รับสินค้าเอง (Pickup)' : 'จัดส่ง (Delivery)'}</strong>
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
