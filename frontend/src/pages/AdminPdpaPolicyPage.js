import React, { useCallback, useEffect, useMemo, useState } from 'react';
import config from '../config';
import AdminPdpaRichTextEditor from '../components/AdminPdpaRichTextEditor';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import { useAdminBreadcrumbSegment } from '../context/AdminBreadcrumbContext';
import { usePopup } from '../components/PopupProvider';
import './AdminDashboard.css';
import './AdminStoreSettingsPage.css';
import './AdminPdpaPolicyPage.css';

const defaultForm = () => ({
  version: '1.0',
  title: 'นโยบายความเป็นส่วนตัว (PDPA)',
  content: '<p><br></p>',
  effective_date: new Date().toISOString().slice(0, 10),
  is_active: true,
});

const AdminPdpaPolicyPage = () => {
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policies, setPolicies] = useState([]);
  /** 'list' | 'form' */
  const [mode, setMode] = useState('list');
  /** null = สร้างใหม่, ตัวเลข = แก้ id นั้น */
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [editorMountKey, setEditorMountKey] = useState(0);

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  const loadPolicies = useCallback(async () => {
    const token = getToken();
    const response = await fetch(`${config.API_BASE_URL}pdpa/admin/privacy-policy/`, {
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      credentials: 'include',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `โหลดรายการไม่สำเร็จ (${response.status})`);
    }
    setPolicies(Array.isArray(data.policies) ? data.policies : []);
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        await loadPolicies();
      } catch (err) {
        if (!alive) return;
        popup.error(err.message || 'โหลดนโยบายไม่สำเร็จ');
        setPolicies([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [loadPolicies, popup]);

  const goFormCreate = () => {
    const nextVersion = suggestNextVersion(policies);
    setEditingId(null);
    setForm({
      ...defaultForm(),
      version: nextVersion,
      is_active: true,
    });
    setEditorMountKey((k) => k + 1);
    setMode('form');
  };

  const goFormEdit = async (id) => {
    setMode('form');
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(`${config.API_BASE_URL}pdpa/admin/privacy-policy/${id}/`, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `โหลดฉบับไม่สำเร็จ (${response.status})`);
      }
      const p = data.policy;
      if (!p) throw new Error('ไม่พบข้อมูลนโยบาย');
      setEditingId(id);
      setForm({
        version: p.version ?? '1.0',
        title: p.title ?? '',
        content: p.content && String(p.content).trim() ? p.content : '<p><br></p>',
        effective_date: p.effective_date || defaultForm().effective_date,
        is_active: Boolean(p.is_active),
      });
      setEditorMountKey((k) => k + 1);
    } catch (err) {
      popup.error(err.message || 'โหลดไม่สำเร็จ');
      setMode('list');
    } finally {
      setLoading(false);
    }
  };

  const goList = () => {
    setMode('list');
    setEditingId(null);
    setForm(defaultForm());
  };

  const copyBodyFromActive = () => {
    const active = policies.find((p) => p.is_active);
    if (!active || !active.content) {
      popup.info('ยังไม่มีฉบับที่เปิดใช้งานหรือไม่มีเนื้อหา');
      return;
    }
    setForm((f) => ({ ...f, content: active.content }));
    setEditorMountKey((k) => k + 1);
    popup.info('คัดลอกเนื้อหาจากฉบับที่ใช้งานแล้ว — โปรดปรับเวอร์ชันและวันที่มีผลก่อนบันทึก');
  };

  const submit = async (e) => {
    e.preventDefault();
    const title = String(form.title || '').trim();
    if (!title) {
      popup.error('กรุณากรอกหัวข้อนโยบาย');
      return;
    }
    if (!form.effective_date) {
      popup.error('กรุณาเลือกวันที่มีผลบังคับใช้');
      return;
    }
    setSaving(true);
    try {
      const token = getToken();
      const payload = {
        version: String(form.version || '1.0').trim() || '1.0',
        title,
        content: form.content || '',
        effective_date: form.effective_date,
        is_active: Boolean(form.is_active),
      };
      const isEdit = editingId != null;
      const url = isEdit
        ? `${config.API_BASE_URL}pdpa/admin/privacy-policy/${editingId}/`
        : `${config.API_BASE_URL}pdpa/admin/privacy-policy/`;
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const firstErr =
          data && typeof data === 'object' && !data.error
            ? Object.values(data).flat().filter(Boolean).join(' ')
            : null;
        throw new Error(data.error || firstErr || `บันทึกไม่สำเร็จ (${response.status})`);
      }
      popup.success(data.message || (isEdit ? 'บันทึกนโยบายแล้ว' : 'สร้างเวอร์ชันใหม่แล้ว'));
      await loadPolicies();
      goList();
    } catch (error) {
      popup.error(error.message || 'บันทึกนโยบายไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const formTitle = editingId != null ? `แก้ไขนโยบาย (ID ${editingId})` : 'สร้างเวอร์ชันใหม่';

  const pdpaBreadcrumbTail = useMemo(() => {
    if (mode !== 'form') return null;
    if (editingId != null) {
      const v = (form.version || '').trim();
      return v ? `แก้ไขเวอร์ชัน ${v}` : 'แก้ไขนโยบาย';
    }
    return 'สร้างเวอร์ชันใหม่';
  }, [mode, editingId, form.version]);

  useAdminBreadcrumbSegment(1, pdpaBreadcrumbTail);

  return (
    <AdminPageShell
      header={(
        <AdminPageHeader title="นโยบาย PDPA" />
      )}
    >
        <div className="store-settings-page store-settings-page--embedded">
          {loading && mode === 'list' ? (
            <div className="store-settings-loading">กำลังโหลดข้อมูล...</div>
          ) : null}

          {mode === 'list' && !loading ? (
            <section className="store-settings-card admin-pdpa-versions">
              <h2 className="store-settings-card__title">รายการเวอร์ชัน</h2>
              <p className="store-settings-card__hint">
                เรียงจากวันที่มีผลล่าสุด — ไม่ลบฉบับเก่าเพื่อให้สอดคล้องกับประวัติความยินยอม
              </p>
              <div className="admin-toolbar-row">
                <span className="admin-toolbar-primary-action">
                  <button type="button" className="btn-primary" onClick={goFormCreate}>
                    ➕ สร้างเวอร์ชันใหม่
                  </button>
                </span>
              </div>
              {policies.length === 0 ? (
                <p className="admin-pdpa-versions__empty">ยังไม่มีนโยบาย — กด «สร้างเวอร์ชันใหม่» เพื่อเพิ่มฉบับแรก</p>
              ) : (
                <div className="admin-pdpa-versions-table-wrap">
                  <table className="admin-pdpa-versions-table">
                    <thead>
                      <tr>
                        <th>เวอร์ชัน</th>
                        <th>หัวข้อ</th>
                        <th>มีผล</th>
                        <th>สถานะ</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {policies.map((p) => (
                        <tr key={p.id}>
                          <td>{p.version}</td>
                          <td>{p.title}</td>
                          <td>{p.effective_date}</td>
                          <td>
                            {p.is_active ? (
                              <span className="admin-pdpa-badge admin-pdpa-badge--on">ใช้งาน</span>
                            ) : (
                              <span className="admin-pdpa-badge admin-pdpa-badge--off">ไม่ใช้งาน</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              onClick={() => goFormEdit(p.id)}
                            >
                              แก้ไข
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {mode === 'form' ? (
            <form className="store-settings-form" onSubmit={submit}>
              <div className="admin-toolbar-row">
                <button type="button" className="btn-outline btn-sm" onClick={goList} disabled={saving}>
                  ← กลับรายการ
                </button>
                <strong className="admin-pdpa-form-toolbar__title">{formTitle}</strong>
              </div>

              {loading ? (
                <div className="store-settings-loading">กำลังโหลด...</div>
              ) : (
                <>
                  <section className="store-settings-card">
                    <h2 className="store-settings-card__title">ข้อมูลนโยบาย</h2>
                    <p className="store-settings-card__hint">
                      เมื่อเปิดใช้งานฉบับนี้ ระบบจะปิดใช้งานฉบับอื่นโดยอัตโนมัติ — ลูกค้าที่ยังไม่ยอมรับฉบับใหม่จะเห็นป๊อปอัปขอความยินยอม
                    </p>
                    <div className="store-settings-row-2">
                      <div className="store-settings-field">
                        <label className="form-label" htmlFor="pdpa-version">
                          เวอร์ชัน
                        </label>
                        <input
                          id="pdpa-version"
                          className="form-control"
                          value={form.version}
                          onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                          placeholder="เช่น 2.0"
                        />
                      </div>
                      <div className="store-settings-field">
                        <label className="form-label" htmlFor="pdpa-effective">
                          วันที่มีผลบังคับใช้
                        </label>
                        <input
                          id="pdpa-effective"
                          type="date"
                          className="form-control"
                          value={form.effective_date}
                          onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="store-settings-field" style={{ marginTop: 12 }}>
                      <label className="form-label" htmlFor="pdpa-title">
                        หัวข้อ
                      </label>
                      <input
                        id="pdpa-title"
                        className="form-control"
                        value={form.title}
                        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      />
                    </div>
                    <label className="store-settings-checkbox" htmlFor="pdpa-active" style={{ marginTop: 14 }}>
                      <input
                        id="pdpa-active"
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      />
                      <span>ใช้งานนโยบายนี้ (ลูกค้าจะเห็นฉบับที่เปิดใช้งานผ่าน API สาธารณะ)</span>
                    </label>
                  </section>

                  <section className="store-settings-card">
                    <h2 className="store-settings-card__title">เนื้อหา</h2>
                    {editingId == null ? (
                      <div className="admin-toolbar-row">
                        <span className="admin-toolbar-primary-action">
                          <button type="button" className="btn-outline btn-sm" onClick={copyBodyFromActive}>
                            คัดลอกเนื้อหาจากฉบับที่ใช้งาน
                          </button>
                        </span>
                      </div>
                    ) : null}
                    <p className="store-settings-card__hint">
                      จัดรูปแบบจากแถบเครื่องมือ — บันทึกเป็น HTML
                    </p>
                    <AdminPdpaRichTextEditor
                      key={editorMountKey}
                      initialHtml={form.content}
                      onChange={(html) => setForm((f) => ({ ...f, content: html }))}
                      placeholder="พิมพ์เนื้อหานโยบายที่นี่..."
                    />
                  </section>

                  <div className="store-settings-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                      {saving ? 'กำลังบันทึก...' : editingId != null ? 'บันทึกการแก้ไข' : 'สร้างเวอร์ชัน'}
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : null}
        </div>
    </AdminPageShell>
  );
};

/** แนะนำเวอร์ชันถัดไปแบบง่ายจากรายการที่มี */
function suggestNextVersion(list) {
  if (!list.length) return '1.0';
  const nums = list
    .map((p) => parseFloat(String(p.version || '').replace(',', '.'), 10))
    .filter((n) => !Number.isNaN(n));
  if (nums.length) {
    const max = Math.max(...nums);
    return String(Math.floor(max) === max ? max + 1 : Math.round((max + 0.1) * 10) / 10);
  }
  return '1.0';
}

export default AdminPdpaPolicyPage;
