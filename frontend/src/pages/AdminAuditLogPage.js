import React, { useEffect, useState, useCallback } from 'react';
import config from '../config';
import ApiPaginationBar from '../components/ApiPaginationBar';
import { usePopup } from '../components/PopupProvider';

const PAGE_SIZE = 20;

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

  const load = useCallback(async (p = 1) => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const base = `${config.API_BASE_URL}accounts/admin/audit-log/`;
      const sep = base.includes('?') ? '&' : '?';
      const fullUrl = `${base}${sep}page=${p}&page_size=${PAGE_SIZE}`;

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
  }, [popup]);

  useEffect(() => {
    load(1);
  }, [load]);

  return (
    <div style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto', marginTop: '72px' }}>
      <h2 style={{ marginBottom: '8px' }}>📋 ประวัติการทำงาน</h2>
      <p style={{ color: '#555', marginBottom: '20px', lineHeight: 1.5 }}>
        บันทึกล็อกอิน/ออกจากระบบแอดมิน การเพิ่มหรือแก้ไขสินค้าและหมวดหมู่ การเปลี่ยนสถานะคำสั่งซื้อ
        การตรวจสลิป การมอบหมายคนขับ และการเพิ่ม/แก้ไข/ลบบัญชีพนักงาน — เห็นได้เฉพาะเจ้าของร้าน
      </p>

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
    </div>
  );
};

export default AdminAuditLogPage;
