import React, { useCallback, useEffect, useState } from 'react';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import { resolveMediaUrl } from '../utils/media';
import './AdminDashboard.css';
import './AdminStoreSettingsPage.css';

const HOME_PROMO_ORDERINGS = new Set([
  'sort_order',
  '-sort_order',
  'id',
  '-id',
  'title',
  '-title',
  'created_at',
  '-created_at',
  'is_active',
  '-is_active',
  'updated_at',
  '-updated_at',
]);

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
  const [listSearchDraft, setListSearchDraft] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [listOrdering, setListOrdering] = useState('sort_order');

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
      const params = new URLSearchParams();
      const q = listSearch.trim();
      if (q) params.set('search', q);
      const ord = HOME_PROMO_ORDERINGS.has(listOrdering) ? listOrdering : 'sort_order';
      if (ord !== 'sort_order') params.set('ordering', ord);
      const qs = params.toString();
      const res = await fetch(`${config.API_BASE_URL}products/admin/home-promotions/${qs ? `?${qs}` : ''}`, {
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
  }, [popup, listSearch, listOrdering]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    load();
  }, [load]);

  const applyListSearch = () => setListSearch(listSearchDraft.trim());

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
    <AdminPageShell
      header={(
        <AdminPageHeader
          title="โปรหน้าแรก"
          subtitle="อัปโหลดรูปแบนเนอร์ได้ — ลูกค้าคลิกที่รูปแล้วไปตามที่เลือกด้านล่าง (หมวดสินค้า / สินค้าแนะนำ / ลดราคา / หน้ารวมสินค้า / สินค้ารายการเดียว)"
        />
      )}
    >
        <section className="store-settings-card" style={{ marginBottom: '1.25rem' }}>
          <h2 className="store-settings-card__title">{editingId ? 'แก้ไขการ์ด' : 'เพิ่มการ์ดใหม่'}</h2>
          <form className="store-settings-form" onSubmit={handleSubmit}>
            <div className="store-settings-stack">
          <div className="store-settings-field">
            <label className="form-label" htmlFor="home-promo-banner-file">
              รูปแบนเนอร์ (แนะนำแนวนอน)
            </label>
            <input
              id="home-promo-banner-file"
              name="banner_image_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="form-input"
              onChange={handleChange}
              style={{ padding: '8px 10px' }}
            />
          </div>
          {form.banner_image_file ? (
            <p className="store-settings-field__hint" style={{ color: '#15803d', marginTop: -4 }}>
              เลือกไฟล์ใหม่แล้ว — จะแทนที่เมื่อบันทึก
            </p>
          ) : null}
          {editingId ? (
            <label className="store-settings-checkbox">
              <input
                name="remove_banner_image"
                type="checkbox"
                checked={form.remove_banner_image}
                onChange={handleChange}
              />
              <span>ลบรูปแบนเนอร์เดิม (ใช้การ์ดข้อความแทน)</span>
            </label>
          ) : null}

          <input
            name="title"
            className="form-input"
            value={form.title}
            onChange={handleChange}
            placeholder="หัวข้อ — ไม่บังคับถ้ามีรูปแบนเนอร์ (ใช้เป็น alt ถ้ากรอก)"
          />
          <textarea
            name="description"
            className="form-textarea"
            value={form.description}
            onChange={handleChange}
            placeholder="คำอธิบายใต้แบนเนอร์ (ไม่บังคับ)"
            rows={2}
          />

          <div className="store-settings-field">
            <label className="form-label" htmlFor="home-promo-link-target">
              เมื่อคลิกแบนเนอร์ไปที่
            </label>
            <select
              id="home-promo-link-target"
              name="link_target"
              value={form.link_target}
              onChange={handleChange}
              className="form-input"
            >
              {LINK_TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {form.link_target === 'category' ? (
            <div className="store-settings-field">
              <label className="form-label" htmlFor="home-promo-category">
                เลือกหมวดหมู่
              </label>
              <select
                id="home-promo-category"
                name="link_category_id"
                value={form.link_category_id}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="">— เลือก —</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {form.link_target === 'product' ? (
            <div className="store-settings-field">
              <label className="form-label" htmlFor="home-promo-product">
                เลือกสินค้า (ชื่อในระบบ)
              </label>
              <select
                id="home-promo-product"
                name="link_product_id"
                value={form.link_product_id}
                onChange={handleChange}
                required
                className="form-input"
                style={{ maxHeight: 220 }}
              >
                <option value="">— เลือก —</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    #{p.id} · {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {form.link_target === 'custom' ? (
            <input
              name="link_url"
              className="form-input"
              value={form.link_url}
              onChange={handleChange}
              placeholder="ลิงก์ เช่น /customer/products หรือ https://…"
              required
            />
          ) : null}

          <div className="store-settings-row-2">
            <input
              name="link_label"
              className="form-input"
              value={form.link_label}
              onChange={handleChange}
              placeholder="ข้อความปุ่มใต้การ์ด (ไม่บังคับ)"
            />
            <input
              name="icon"
              className="form-input"
              value={form.icon}
              onChange={handleChange}
              placeholder="ไม่มีรูป: emoji เช่น 🎉"
            />
          </div>
          <input
            name="sort_order"
            type="number"
            min={0}
            className="form-input"
            value={form.sort_order}
            onChange={handleChange}
            placeholder="ลำดับ (เลขน้อยขึ้นก่อน)"
          />
          <label className="store-settings-checkbox">
            <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} />
            <span>แสดงบนหน้าแรก</span>
          </label>
          <div className="store-settings-btn-row">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มการ์ด'}
            </button>
            {editingId ? (
              <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                ยกเลิกแก้ไข
              </button>
            ) : null}
          </div>
            </div>
          </form>
        </section>

        <div className="admin-toolbar-row">
          <input
            type="search"
            className="form-input"
            placeholder="ค้นหาหัวข้อ คำอธิบาย ป้ายลิงก์…"
            value={listSearchDraft}
            onChange={(e) => setListSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyListSearch();
            }}
            aria-label="ค้นหาการ์ดโปรโมชั่น"
          />
          <button type="button" className="btn-primary" onClick={applyListSearch}>
            ค้นหา
          </button>
          <label className="admin-toolbar-ordering">
            <span className="muted">เรียงตาม</span>
            <select
              className="form-input"
              value={listOrdering}
              onChange={(e) => setListOrdering(e.target.value)}
              aria-label="เรียงลำดับการ์ด"
            >
              <option value="sort_order">ลำดับแสดง (น้อยขึ้นก่อน)</option>
              <option value="-sort_order">ลำดับแสดง (มากขึ้นก่อน)</option>
              <option value="-id">เพิ่มล่าสุดก่อน (รหัสมากสุดก่อน)</option>
              <option value="id">เพิ่มเก่าสุดก่อน</option>
              <option value="title">หัวข้อ A → Z</option>
              <option value="-title">หัวข้อ Z → A</option>
              <option value="-created_at">สร้างเมื่อ — ใหม่สุดก่อน</option>
              <option value="created_at">สร้างเมื่อ — เก่าสุดก่อน</option>
              <option value="-is_active">เปิดใช้ก่อน</option>
              <option value="is_active">ปิดใช้ก่อน</option>
              <option value="-updated_at">แก้ล่าสุดก่อน</option>
              <option value="updated_at">แก้เก่าสุดก่อน</option>
            </select>
          </label>
          {(listSearch || listSearchDraft || listOrdering !== 'sort_order') && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setListSearchDraft('');
                setListSearch('');
                setListOrdering('sort_order');
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {loading ? (
          <p className="muted">กำลังโหลด...</p>
        ) : items.length === 0 ? (
          <p className="muted">ยังไม่มีการ์ด — เพิ่มด้านบน</p>
        ) : (
          <div className="admin-data-table-wrap">
            <table className="admin-data-table">
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
    </AdminPageShell>
  );
};

export default AdminHomePromotionsPage;
