import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import config from '../config';
import ApiPaginationBar from '../components/ApiPaginationBar';
import { usePopup } from '../components/PopupProvider';
import './AdminDashboard.css';

const PAGE_SIZE = 20;

function formatBaht(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

const AdminCustomersPage = () => {
  const popup = usePopup();
  const token = useMemo(() => localStorage.getItem('admin_token') || localStorage.getItem('auth_token'), []);
  const [page, setPage] = useState(1);
  const [draftQ, setDraftQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState({ results: [], count: 0 });

  const authHeaders = useMemo(
    () => ({
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    }),
    [token],
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (appliedQ.trim()) params.set('q', appliedQ.trim());
      const res = await fetch(`${config.API_BASE_URL}accounts/admin/customers/?${params}`, {
        headers: authHeaders,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || 'โหลดรายการลูกค้าไม่สำเร็จ');
      }
      setPayload({
        results: Array.isArray(data.results) ? data.results : [],
        count: typeof data.count === 'number' ? data.count : 0,
      });
    } catch (e) {
      popup.error(e.message || 'โหลดรายการลูกค้าไม่สำเร็จ');
      setPayload({ results: [], count: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, appliedQ, authHeaders]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const submitSearch = (e) => {
    e.preventDefault();
    setAppliedQ(draftQ.trim());
    setPage(1);
  };

  const rows = payload.results;

  return (
    <div className="admin-dashboard" style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '1.35rem' }}>ลูกค้า</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '0.92rem' }}>
          ดูข้อมูลผู้ใช้ที่ลงทะเบียนเป็นลูกค้า จำนวนออเดอร์ และยอดสะสม (ออเดอร์ที่จัดส่งสำเร็จ)
        </p>
      </div>

      <div className="admin-content">
        <form
          onSubmit={submitSearch}
          style={{ padding: '12px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <input
            type="search"
            className="form-input"
            style={{ minWidth: 260, flex: '1 1 220px' }}
            placeholder="ค้นหา ชื่อ อีเมล username หรือเบอร์โทร"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            ค้นหา
          </button>
          {(appliedQ || draftQ) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setDraftQ('');
                setAppliedQ('');
                setPage(1);
              }}
            >
              ล้าง
            </button>
          )}
        </form>

        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>ลูกค้า</th>
                <th>ติดต่อ</th>
                <th>สมัครเมื่อ</th>
                <th>จำนวนออเดอร์</th>
                <th>ยอดซื้อสะสม (ส่งแล้ว)</th>
                <th>ออเดอร์ล่าสุด</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">กำลังโหลด...</div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">ไม่พบลูกค้า</div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const u = row.user_info || {};
                  const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || '—';
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{name}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          @{u.username || '—'}
                        </div>
                      </td>
                      <td>
                        <div>{row.phone_number || '—'}</div>
                        {u.email ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {u.email}
                          </div>
                        ) : null}
                      </td>
                      <td>{formatWhen(row.created_at)}</td>
                      <td>{row.order_count ?? 0}</td>
                      <td>{formatBaht(row.total_spent_delivered)}</td>
                      <td>{formatWhen(row.last_order_at)}</td>
                      <td>
                        <Link className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }} to={`/admin/customers/${row.id}`}>
                          รายละเอียด
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <ApiPaginationBar
          count={payload.count}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          className=""
        />
      </div>
    </div>
  );
};

export default AdminCustomersPage;
