import React, { useCallback, useEffect, useState } from 'react';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { AdminBackLink } from '../components/AdminBackButton';
import './AdminDashboard.css';

const emptyForm = () => ({
  title: '',
  description: '',
  link_label: '',
  link_url: '',
  icon: '',
  sort_order: 0,
  is_active: true,
});

const AdminHomePromotionsPage = () => {
  const popup = usePopup();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/home-promotions/`, {
        headers: {
          Authorization: `Token ${getToken()}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('โหลดรายการไม่สำเร็จ');
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      popup.error(e.message || 'โหลดไม่สำเร็จ');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [popup]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      title: row.title || '',
      description: row.description || '',
      link_label: row.link_label || '',
      link_url: row.link_url || '',
      icon: row.icon || '',
      sort_order: Number(row.sort_order ?? 0),
      is_active: Boolean(row.is_active),
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      popup.info('กรุณากรอกหัวข้อ');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim(),
        link_label: form.link_label.trim(),
        link_url: form.link_url.trim(),
        icon: form.icon.trim(),
        sort_order: parseInt(String(form.sort_order), 10) || 0,
        is_active: Boolean(form.is_active),
      };
      const url = editingId
        ? `${config.API_BASE_URL}products/admin/home-promotions/${editingId}/`
        : `${config.API_BASE_URL}products/admin/home-promotions/`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Token ${getToken()}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      let errData = {};
      try {
        errData = await res.json();
      } catch {
        errData = {};
      }
      if (!res.ok) {
        const msg =
          (typeof errData === 'object' && errData && (errData.detail || errData.error)) ||
          'บันทึกไม่สำเร็จ';
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      popup.info(editingId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มการ์ดแล้ว');
      resetForm();
      await load();
    } catch (err) {
      popup.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (
      !(await popup.confirm(`ลบการ์ด «${row.title}»?`, {
        tone: 'danger',
        confirmText: 'ลบ',
      }))
    ) {
      return;
    }
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/home-promotions/${row.id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${getToken()}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('ลบไม่สำเร็จ');
      popup.info('ลบแล้ว');
      if (editingId === row.id) resetForm();
      await load();
    } catch (err) {
      popup.error(err.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-content">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 14,
          }}
        >
          <AdminBackLink to="/admin/dashboard" ariaLabel="ภาพรวมแอดมิน" />
          <h2 style={{ margin: 0 }}>โปรโมชั่นหน้าแรกลูกค้า</h2>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
          การ์ดในมุม «โปรโมชั่น &amp; ข่าวสาร» บนหน้าแรกลูกค้า ลำดับเลขน้อยขึ้นก่อน ลิงก์ภายในเช่น{' '}
          <code style={{ fontSize: '0.8rem' }}>/customer/products?on_sale=true</code> หรือ{' '}
          <code style={{ fontSize: '0.8rem' }}>/customer/products?featured=true</code>
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            background: '#fafafa',
            display: 'grid',
            gap: 10,
          }}
        >
          <h3 style={{ margin: 0 }}>{editingId ? 'แก้ไขการ์ด' : 'เพิ่มการ์ดใหม่'}</h3>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="หัวข้อ *"
            required
            style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
          />
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="คำอธิบาย (ไม่บังคับ)"
            rows={2}
            style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              name="link_label"
              value={form.link_label}
              onChange={handleChange}
              placeholder="ข้อความปุ่ม เช่น ดูสินค้า"
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
            <input
              name="link_url"
              value={form.link_url}
              onChange={handleChange}
              placeholder="ลิงก์ เช่น /customer/products"
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              name="icon"
              value={form.icon}
              onChange={handleChange}
              placeholder="emoji ไอคอน เช่น 🎉"
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
            <input
              name="sort_order"
              type="number"
              min={0}
              value={form.sort_order}
              onChange={handleChange}
              placeholder="ลำดับ"
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
            แสดงบนหน้าแรก
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มการ์ด'}
            </button>
            {editingId ? (
              <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                ยกเลิกแก้ไข
              </button>
            ) : null}
          </div>
        </form>

        {loading ? (
          <p>กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p style={{ color: '#64748b' }}>ยังไม่มีการ์ด — เพิ่มด้านบน</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>ไอคอน</th>
                  <th>หัวข้อ</th>
                  <th>ลิงก์</th>
                  <th>แสดง</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sort_order}</td>
                    <td>{row.icon || '—'}</td>
                    <td>{row.title}</td>
                    <td style={{ fontSize: '0.78rem', maxWidth: 220, wordBreak: 'break-all' }}>
                      {row.link_url || '—'}
                    </td>
                    <td>{row.is_active ? 'ใช่' : 'ไม่'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn-secondary" onClick={() => startEdit(row)}>
                        แก้ไข
                      </button>{' '}
                      <button type="button" className="btn-secondary" onClick={() => handleDelete(row)}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminHomePromotionsPage;
