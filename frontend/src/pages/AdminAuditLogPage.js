import React, { useEffect, useState, useCallback } from 'react';
import config from '../config';
import ApiPaginationBar from '../components/ApiPaginationBar';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import { usePopup } from '../components/PopupProvider';
import './AdminDashboard.css';

const PAGE_SIZE = 20;

const AUDIT_ORDERINGS = new Set(['-created_at', 'created_at', 'id', '-id', 'action', '-action', 'ip_address', '-ip_address']);

function formatDetail(detail) {
  if (!detail || typeof detail !== 'object') return '—';
  try {
    // ไม่ซ้ำ action_label_th ที่แสดงในคอลัมน์การกระทำแล้ว
    const { action_label_th: _a, ...rest } = detail;
    const keys = Object.keys(rest);
    if (keys.length === 0) return '—';
    const s = JSON.stringify(rest);
    return s.length > 220 ? `${s.slice(0, 217)}…` : s;
  } catch {
    return '—';
  }
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

const AdminAuditLogPage = () => {
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [ordering, setOrdering] = useState('-created_at');

  const load = useCallback(async (p = 1) => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const base = `${config.API_BASE_URL}accounts/admin/audit-log/`;
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('page_size', String(PAGE_SIZE));
      const q = searchApplied.trim();
      if (q) params.set('search', q);
      const ord = AUDIT_ORDERINGS.has(ordering) ? ordering : '-created_at';
      if (ord !== '-created_at') params.set('ordering', ord);
      const fullUrl = `${base}?${params.toString()}`;

      const res = await fetch(fullUrl, {
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (res.status === 403) {
        popup.error('ไม่มีสิทธิ์ดูประวัติ — เฉพาะเจ้าของร้าน (super_admin / admin)');
        setRows([]);
        setCount(0);
        return;
      }
      if (!res.ok) throw new Error('load failed');
      const data = await res.json();
      if (Array.isArray(data)) {
        setRows(data);
        setCount(data.length);
      } else {
        setRows(data.results || []);
        setCount(typeof data.count === 'number' ? data.count : (data.results || []).length);
      }
      setPage(p);
    } catch (e) {
      console.error(e);
      popup.error('โหลดประวัติไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [popup, searchApplied, ordering]);

  useEffect(() => {
    load(1);
  }, [load]);

  const submitSearch = (e) => {
    e.preventDefault();
    setSearchApplied(searchDraft.trim());
  };

  return (
    <AdminPageShell
      narrow
      header={(
        <AdminPageHeader
          title="ประวัติพนักงาน"
          subtitle="บันทึกล็อกอิน/ออกจากระบบแอดมิน การตั้งค่าร้าน (พิกัด เวลา ค่าส่ง) การเพิ่มหรือแก้ไขสินค้าและหมวดหมู่ แบนเนอร์/โปรหน้าแรก ผู้จำหน่ายและใบสั่งซื้อ ปรับสต็อกมือ การเปลี่ยนสถานะคำสั่งซื้อ การตรวจสลิป การมอบหมายคนขับ การเพิ่ม/แก้ไข/ลบบัญชีพนักงานและคนขับ — เห็นได้เฉพาะเจ้าของร้าน"
        />
      )}
    >
      <form
        onSubmit={submitSearch}
        style={{
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          className="form-input"
          style={{ minWidth: 260, flex: '1 1 220px', padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' }}
          placeholder="ค้นหาในสรุป การกระทำ ผู้ทำ IP เป้าหมาย…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <button type="submit" className="btn-primary" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
          ค้นหา
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: '#555' }}>เรียงตาม</span>
          <select
            value={ordering}
            onChange={(e) => setOrdering(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ccc' }}
            aria-label="เรียงประวัติ"
          >
            <option value="-created_at">เวลาล่าสุดก่อน</option>
            <option value="created_at">เวลาเก่าสุดก่อน</option>
            <option value="-id">รหัสมากสุดก่อน</option>
            <option value="id">รหัสน้อยสุดก่อน</option>
            <option value="action">การกระทำ (ตามระบบ)</option>
            <option value="-action">การกระทำ (กลับด้าน)</option>
            <option value="ip_address">IP (ตามระบบ)</option>
            <option value="-ip_address">IP (กลับด้าน)</option>
          </select>
        </label>
        {(searchApplied || searchDraft || ordering !== '-created_at') && (
          <button
            type="button"
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #bbb', background: '#fff', cursor: 'pointer' }}
            onClick={() => {
              setSearchDraft('');
              setSearchApplied('');
              setOrdering('-created_at');
            }}
          >
            ล้าง
          </button>
        )}
      </form>

      {loading ? (
        <p>กำลังโหลด...</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '13px',
                background: '#fff',
              }}
            >
              <thead>
                <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #ddd' }}>เวลา</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #ddd' }}>ผู้ทำ</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #ddd' }}>การกระทำ</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #ddd' }}>สรุป</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #ddd' }}>รายละเอียด</th>
                  <th style={{ padding: '10px 8px', borderBottom: '1px solid #ddd' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatTime(row.created_at)}</td>
                      <td style={{ padding: '8px' }}>{row.actor_username || '—'}</td>
                      <td style={{ padding: '8px' }}>{row.action_display || row.action}</td>
                      <td style={{ padding: '8px', maxWidth: '280px' }}>{row.summary || '—'}</td>
                      <td style={{ padding: '8px', maxWidth: '200px', wordBreak: 'break-all', color: '#666' }}>
                        {formatDetail(row.detail)}
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{row.ip_address || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ApiPaginationBar
            count={count}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => load(p)}
          />
        </>
      )}
    </AdminPageShell>
  );
};

export default AdminAuditLogPage;
