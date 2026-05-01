import React, { useCallback, useEffect, useState } from 'react';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { AdminBackLink } from '../components/AdminBackButton';
import { resolveMediaUrl } from '../utils/media';
import './AdminDashboard.css';

const LINK_TARGET_OPTIONS = [
  { value: 'none', label: 'ไม่มีลิงก์ (แสดงประกาศอย่างเดียว)' },
  { value: 'shop', label: 'ไปหน้ารวมสินค้าทั้งหมด' },
  { value: 'featured', label: 'ไปหมวดสินค้าแนะนำ' },
  { value: 'on_sale', label: 'ไปหมวดสินค้าลดราคา' },
  { value: 'category', label: 'ไปสินค้าตามหมวดที่เลือก' },
  { value: 'product', label: 'ไปหน้ารายละเอียดสินค้าเดียว' },
  { value: 'custom', label: 'ลิงก์กำหนดเอง (สำหรับผู้ใช้ขั้นสูง)' },
];

const emptyForm = () => ({
  title: '',
  description: '',
  link_target: 'none',
  link_category_id: '',
  link_product_id: '',
  link_label: '',
  link_url: '',
  icon: '',
  sort_order: 0,
  is_active: true,
  banner_image_file: null,
  remove_banner_image: false,
});

function buildPayload(form) {
  const payload = {
    title: form.title.trim(),
    description: form.description.trim(),
    link_target: form.link_target,
    link_label: form.link_label.trim(),
    link_url: form.link_target === 'custom' ? form.link_url.trim() : '',
    icon: form.icon.trim(),
    sort_order: parseInt(String(form.sort_order), 10) || 0,
    is_active: Boolean(form.is_active),
  };

  if (form.link_target === 'category') {
    payload.link_category = form.link_category_id ? Number(form.link_category_id) : null;
    payload.link_product = null;
  } else if (form.link_target === 'product') {
    payload.link_product = form.link_product_id ? Number(form.link_product_id) : null;
    payload.link_category = null;
  } else {
    payload.link_category = null;
    payload.link_product = null;
  }

  return payload;
}

const AdminHomePromotionsPage = () => {
  const popup = usePopup();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  const loadMeta = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}products/categories/`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
          credentials: 'include',
        }),
        fetch(`${config.API_BASE_URL}products/admin/?page=1&page_size=500&stock_filter=all&ordering=name`, {
          headers: {
            Authorization: `Token ${getToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        }),
      ]);
      if (catRes.ok) {
        const d = await catRes.json();
        const raw = Array.isArray(d) ? d : d.results || [];
        setCategories(Array.isArray(raw) ? raw.sort((a, b) => String(a.name).localeCompare(String(b.name), 'th')) : []);
      }
      if (prodRes.ok) {
        const d = await prodRes.json();
        const raw = Array.isArray(d) ? d : d.results || [];
        const list = Array.isArray(raw) ? raw : [];
        list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'th'));
        setProducts(list);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
    loadMeta();
  }, [loadMeta]);

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
      link_target: row.link_target || (row.link_url ? 'custom' : 'none'),
      link_category_id: row.link_category != null ? String(row.link_category) : '',
      link_product_id: row.link_product != null ? String(row.link_product) : '',
      link_label: row.link_label || '',
      link_url: row.link_url || '',
      icon: row.icon || '',
      sort_order: Number(row.sort_order ?? 0),
      is_active: Boolean(row.is_active),
      banner_image_file: null,
      remove_banner_image: false,
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const editingRow = editingId ? items.find((r) => r.id === editingId) : null;
    const hasStoredBanner = Boolean(editingRow?.banner_image) && !form.remove_banner_image;
    const hasBanner = Boolean(form.banner_image_file instanceof File) || hasStoredBanner;
    if (!form.title.trim() && !hasBanner) {
      popup.info('กรุณากรอกหัวข้อ — หรืออัปโหลดรูปแบนเนอร์');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editingId && form.remove_banner_image) {
        payload.remove_banner_image = true;
      }

      const url = editingId
        ? `${config.API_BASE_URL}products/admin/home-promotions/${editingId}/`
        : `${config.API_BASE_URL}products/admin/home-promotions/`;
      const method = editingId ? 'PUT' : 'POST';

      const hasNewFile = form.banner_image_file instanceof File;

      let res;
      if (hasNewFile) {
        const fd = new FormData();
        fd.append('title', payload.title);
        fd.append('description', payload.description);
        fd.append('link_target', payload.link_target);
        fd.append('link_label', payload.link_label);
        fd.append('link_url', payload.link_url || '');
        fd.append('icon', payload.icon);
        fd.append('sort_order', String(payload.sort_order));
        fd.append('is_active', payload.is_active ? 'true' : 'false');
        if (payload.link_category != null) fd.append('link_category', String(payload.link_category));
        if (payload.link_product != null) fd.append('link_product', String(payload.link_product));
        if (payload.remove_banner_image) fd.append('remove_banner_image', 'true');
        fd.append('banner_image', form.banner_image_file);
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Token ${getToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
          body: fd,
        });
      } else {
        const jsonBody = { ...payload };
        if (!jsonBody.remove_banner_image) delete jsonBody.remove_banner_image;
        res = await fetch(url, {
          method,
          headers: {
            Authorization: `Token ${getToken()}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
          body: JSON.stringify(jsonBody),
        });
      }

      let errData = {};
      try {
        errData = await res.json();
      } catch {
        errData = {};
      }
      if (!res.ok) {
        const msg =
          (typeof errData === 'object' && errData && (errData.detail || errData.error || errData.link_url?.[0])) ||
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
      !(await popup.confirm(`ลบการ์ด «${(row.title || '').trim() || 'โปรโมชั่น'}»?`, {
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
    const { name, value, type, checked, files } = e.target;
    if (name === 'banner_image_file' && files && files[0]) {
      setForm((prev) => ({
        ...prev,
        banner_image_file: files[0],
        remove_banner_image: false,
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const resolvedPreviewUrl = (row) => {
    if (!row?.banner_image) return null;
    return resolveMediaUrl(row.banner_image);
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
        <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          อัปโหลด<strong>รูปแบนเนอร์</strong>ได้ — ลูกค้าคลิกที่รูปแล้วไปตามที่เลือกด้านล่าง ไม่ต้องพิมพ์ลิงก์ถ้าเลือกเมนูสำเร็จรูป
          (หมวดสินค้า / สินค้าแนะนำ / ลดราคา / หน้ารวมสินค้า / สินค้ารายการเดียว)
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
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            รูปแบนเนอร์ (แนะนำแนวนอน)
            <input
              name="banner_image_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleChange}
              style={{ display: 'block', marginTop: 6, fontSize: '0.85rem' }}
            />
          </label>
          {form.banner_image_file ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#059669' }}>เลือกไฟล์ใหม่แล้ว — จะแทนที่เมื่อบันทึก</p>
          ) : null}
          {editingId ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
              <input
                name="remove_banner_image"
                type="checkbox"
                checked={form.remove_banner_image}
                onChange={handleChange}
              />
              ลบรูปแบนเนอร์เดิม (ใช้การ์ดข้อความแทน)
            </label>
          ) : null}

          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="หัวข้อ — ไม่บังคับถ้ามีรูปแบนเนอร์ (ใช้เป็น alt ถ้ากรอก)"
            style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
          />
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="คำอธิบายใต้แบนเนอร์ (ไม่บังคับ)"
            rows={2}
            style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
          />

          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
            เมื่อคลิกแบนเนอร์ไปที่
            <select
              name="link_target"
              value={form.link_target}
              onChange={handleChange}
              style={{
                display: 'block',
                marginTop: 6,
                width: '100%',
                padding: '0.45rem 0.5rem',
                borderRadius: 8,
                border: '1px solid #d0d7e5',
                fontSize: '0.9rem',
              }}
            >
              {LINK_TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          {form.link_target === 'category' ? (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
              เลือกหมวดหมู่
              <select
                name="link_category_id"
                value={form.link_category_id}
                onChange={handleChange}
                required
                style={{
                  display: 'block',
                  marginTop: 6,
                  width: '100%',
                  padding: '0.45rem 0.5rem',
                  borderRadius: 8,
                  border: '1px solid #d0d7e5',
                }}
              >
                <option value="">— เลือก —</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {form.link_target === 'product' ? (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>
              เลือกสินค้า (ชื่อในระบบ)
              <select
                name="link_product_id"
                value={form.link_product_id}
                onChange={handleChange}
                required
                style={{
                  display: 'block',
                  marginTop: 6,
                  width: '100%',
                  padding: '0.45rem 0.5rem',
                  borderRadius: 8,
                  border: '1px solid #d0d7e5',
                  maxHeight: 220,
                }}
              >
                <option value="">— เลือก —</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.id} · {p.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {form.link_target === 'custom' ? (
            <input
              name="link_url"
              value={form.link_url}
              onChange={handleChange}
              placeholder="ลิงก์ เช่น /customer/products หรือ https://…"
              required
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input
              name="link_label"
              value={form.link_label}
              onChange={handleChange}
              placeholder="ข้อความปุ่มใต้การ์ด (ไม่บังคับ)"
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
            <input
              name="icon"
              value={form.icon}
              onChange={handleChange}
              placeholder="ไม่มีรูป: emoji เช่น 🎉"
              style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
            />
          </div>
          <input
            name="sort_order"
            type="number"
            min={0}
            value={form.sort_order}
            onChange={handleChange}
            placeholder="ลำดับ (เลขน้อยขึ้นก่อน)"
            style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #d0d7e5' }}
          />
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
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>ลำดับ</th>
                  <th>รูป</th>
                  <th>หัวข้อ</th>
                  <th>เป้าหมาย</th>
                  <th>แสดง</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.sort_order}</td>
                    <td style={{ width: 72 }}>
                      {resolvedPreviewUrl(row) ? (
                        <img
                          src={resolvedPreviewUrl(row)}
                          alt=""
                          style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 6 }}
                        />
                      ) : (
                        <span style={{ fontSize: '1.2rem' }}>{row.icon || '—'}</span>
                      )}
                    </td>
                    <td>{(row.title || '').trim() ? row.title : '—'}</td>
                    <td style={{ fontSize: '0.78rem', maxWidth: 260 }}>
                      {LINK_TARGET_OPTIONS.find((o) => o.value === row.link_target)?.label || row.link_target}
                      {row.link_target === 'category' && row.link_category ? (
                        <span style={{ color: '#64748b' }}>
                          {' '}
                          (หมวด #{row.link_category})
                        </span>
                      ) : null}
                      {row.link_target === 'product' && row.link_product ? (
                        <span style={{ color: '#64748b' }}>
                          {' '}
                          (สินค้า #{row.link_product})
                        </span>
                      ) : null}
                      {row.link_target === 'custom' && row.link_url ? (
                        <div style={{ wordBreak: 'break-all', marginTop: 4 }}>{row.link_url}</div>
                      ) : null}
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
