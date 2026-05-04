import React, { useEffect, useState } from 'react';
import config from '../config';
import AdminPdpaRichTextEditor from '../components/AdminPdpaRichTextEditor';
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
  const [form, setForm] = useState(defaultForm);
  const [hasExisting, setHasExisting] = useState(false);
  /** เปลี่ยนเมื่อโหลด/รีเซ็ตเนื้อหาจาก API — ให้ตัวแก้ TipTap สร้างใหม่ตรงกับ HTML */
  const [editorMountKey, setEditorMountKey] = useState(0);

  const getToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
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
          throw new Error(data.error || `โหลดข้อมูลไม่สำเร็จ (${response.status})`);
        }
        if (!alive) return;
        if (data.policy) {
          const p = data.policy;
          setHasExisting(true);
          setForm({
            version: p.version ?? '1.0',
            title: p.title ?? '',
            content: p.content && String(p.content).trim() ? p.content : '<p><br></p>',
            effective_date: p.effective_date || defaultForm().effective_date,
            is_active: Boolean(p.is_active),
          });
        } else {
          setHasExisting(false);
          setForm(defaultForm());
        }
      } catch (err) {
        if (!alive) return;
        popup.error(err.message || 'โหลดนโยบายไม่สำเร็จ');
        setForm(defaultForm());
        setHasExisting(false);
      } finally {
        if (alive) {
          setLoading(false);
          setEditorMountKey((k) => k + 1);
        }
      }
    };
    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดครั้งเดียวเมื่อเปิดหน้า
  }, []);

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
      const response = await fetch(`${config.API_BASE_URL}pdpa/admin/privacy-policy/`, {
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
      if (!response.ok) {
        const firstErr =
          data && typeof data === 'object' && !data.error
            ? Object.values(data).flat().filter(Boolean).join(' ')
            : null;
        throw new Error(data.error || firstErr || `บันทึกไม่สำเร็จ (${response.status})`);
      }
      popup.success(data.message || 'บันทึกนโยบายแล้ว');
      setHasExisting(true);
      if (data.policy) {
        const p = data.policy;
        setForm((prev) => ({
          ...prev,
          version: p.version ?? prev.version,
          title: p.title ?? prev.title,
          content: p.content ?? prev.content,
          effective_date: p.effective_date || prev.effective_date,
          is_active: Boolean(p.is_active),
        }));
      }
    } catch (error) {
      popup.error(error.message || 'บันทึกนโยบายไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dashboard admin-pdpa-page">
      <div className="admin-content">
        <header className="admin-pdpa-page__head">
          <h1 className="admin-pdpa-page__title">นโยบายความเป็นส่วนตัว (PDPA)</h1>
          <p className="admin-pdpa-page__lede">
            แก้ไขเนื้อหาที่ลูกค้าเห็นได้เอง ใช้ตัวแก้แบบ rich text (ตัวหนา หัวข้อ รายการ ลิงก์ ฯลฯ) — บันทึกเป็น HTML
            {!hasExisting ? ' — ยังไม่มีนโยบายในระบบ กดบันทึกเพื่อสร้างฉบับแรก' : null}
          </p>
        </header>

        <div className="store-settings-page store-settings-page--embedded">
          {loading ? (
            <div className="store-settings-loading">กำลังโหลดข้อมูล...</div>
          ) : (
            <form className="store-settings-form" onSubmit={submit}>
              <section className="store-settings-card">
                <h2 className="store-settings-card__title">ข้อมูลนโยบาย</h2>
                <p className="store-settings-card__hint">
                  เวอร์ชันและวันที่มีผลช่วยให้ติดตามการเปลี่ยนแปลงได้ ปิดการใช้งานชั่วคราวได้ถ้าไม่ต้องการให้ API สาธารณะคืนฉบับนี้
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
                      placeholder="เช่น 1.0"
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
                <p className="store-settings-card__hint">
                  จัดรูปแบบจากแถบเครื่องมือด้านบน — หากต้องการคล้าย Word ให้ใช้หัวข้อ ตัวหนา รายการ และสีตามต้องการ
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
                  {saving ? 'กำลังบันทึก...' : 'บันทึกนโยบาย'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPdpaPolicyPage;
