import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { AdminBackButton } from '../components/AdminBackButton';
import { formatCitizenThirteenDisplay, formatMobileTenDisplay } from '../utils/thaiFormInputs';
import './AdminDashboard.css';

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

function formatDobThBe(isoDate) {
  if (!isoDate) return '—';
  const parts = String(isoDate).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return isoDate;
  const be = y + 543;
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${be} (พ.ศ.)`;
}

const AdminCustomerDetailPage = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const popup = usePopup();
  const token = useMemo(() => localStorage.getItem('admin_token') || localStorage.getItem('auth_token'), []);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    }),
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.API_BASE_URL}accounts/admin/customers/${customerId}/`, {
          headers: authHeaders,
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.detail || data?.error || 'โหลดข้อมูลลูกค้าไม่สำเร็จ');
        }
        if (!cancelled) setCustomer(data);
      } catch (e) {
        if (!cancelled) {
          popup.error(e.message || 'โหลดข้อมูลลูกค้าไม่สำเร็จ');
          setCustomer(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (customerId) load();
    return () => {
      cancelled = true;
    };
  }, [customerId, authHeaders]);

  if (loading) {
    return (
      <div className="admin-dashboard" style={{ padding: 16 }}>
        <div className="empty-state">กำลังโหลด...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="admin-dashboard" style={{ padding: 16 }}>
        <div className="empty-state">ไม่พบลูกค้า</div>
        <AdminBackButton
          ariaLabel="รายการลูกค้า"
          onClick={() => navigate('/admin/customers')}
          style={{ marginTop: 12 }}
        />
      </div>
    );
  }

  const u = customer.user_info || {};
  const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'ลูกค้า';
  const stats = customer.stats || {};
  const line = customer.line_profile;

  return (
    <div className="admin-dashboard" style={{ padding: 16 }}>
      <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <AdminBackButton ariaLabel="รายการลูกค้า" onClick={() => navigate('/admin/customers')} />
        <Link className="btn-primary" style={{ textDecoration: 'none' }} to={`/admin/orders?customer_id=${customer.id}`}>
          ดูออเดอร์ทั้งหมดของลูกค้านี้
        </Link>
      </div>

      <h1 style={{ margin: '0 0 6px 0', fontSize: '1.35rem' }}>{displayName}</h1>
      <p style={{ margin: '0 0 16px', color: '#666' }}>
        @{u.username || '—'}
        {customer.contact_email ? ` · อีเมลลูกค้า: ${customer.contact_email}` : ''}
        {!customer.contact_email && u.email ? ` · ${u.email}` : ''}
      </p>

      <div className="admin-stats" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <h3>{stats.order_count ?? 0}</h3>
          <p>ออเดอร์ทั้งหมด</p>
        </div>
        <div className="stat-card pending">
          <h3>{stats.in_progress_count ?? 0}</h3>
          <p>กำลังดำเนินการ</p>
        </div>
        <div className="stat-card revenue">
          <h3>{stats.delivered_count ?? 0}</h3>
          <p>จัดส่งสำเร็จ</p>
        </div>
        <div className="stat-card">
          <h3>{stats.cancelled_count ?? 0}</h3>
          <p>ยกเลิก</p>
        </div>
      </div>

      <div className="admin-stats" style={{ marginBottom: 16 }}>
        <div className="stat-card revenue">
          <h3 style={{ fontSize: '1.25rem' }}>{formatBaht(stats.total_spent_delivered)}</h3>
          <p>ยอดรวม (เฉพาะออเดอร์จัดส่งสำเร็จ)</p>
        </div>
        <div className="stat-card">
          <h3 style={{ fontSize: '1.25rem' }}>{formatBaht(stats.lifetime_order_total)}</h3>
          <p>ยอดรวมทุกสถานะ (สำหรับอ้างอิง)</p>
        </div>
      </div>

      <div className="admin-content" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>โปรไฟล์</h3>
        <table className="orders-table" style={{ boxShadow: 'none' }}>
          <tbody>
            <tr>
              <th style={{ width: 180 }}>สถานะโปรไฟล์</th>
              <td>
                {customer.profile_completed ? (
                  <span className="status status-delivered">ครบถ้วน</span>
                ) : (
                  <span className="status status-pending">ยังไม่ครบ</span>
                )}
              </td>
            </tr>
            <tr>
              <th style={{ width: 180 }}>เบอร์โทร</th>
              <td>{customer.phone_number ? formatMobileTenDisplay(customer.phone_number) : '—'}</td>
            </tr>
            <tr>
              <th>เลขบัตรประชาชน</th>
              <td>{customer.id_card_number ? formatCitizenThirteenDisplay(customer.id_card_number) : '—'}</td>
            </tr>
            <tr>
              <th>วันเกิด</th>
              <td>{formatDobThBe(customer.date_of_birth)}</td>
            </tr>
            <tr>
              <th style={{ verticalAlign: 'top' }}>ที่อยู่ตามโปรไฟล์</th>
              <td style={{ whiteSpace: 'pre-wrap' }}>{customer.address?.trim() ? customer.address : '—'}</td>
            </tr>
            <tr>
              <th>อีเมลติดต่อ (จากลูกค้า)</th>
              <td>{customer.contact_email || '—'}</td>
            </tr>
            <tr>
              <th>อีเมลบัญชีระบบ</th>
              <td>{u.email || '—'}</td>
            </tr>
            <tr>
              <th>สมัครเมื่อ</th>
              <td>{formatWhen(customer.created_at)}</td>
            </tr>
          </tbody>
        </table>

        {line ? (
          <div style={{ marginTop: 16 }}>
            <h3>LINE</h3>
            <p style={{ margin: '6px 0' }}>
              <strong>{line.display_name}</strong>
              <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
                ID: {line.line_user_id}
              </span>
            </p>
            {line.picture_url ? (
              <img src={line.picture_url} alt="" width={96} height={96} style={{ borderRadius: 12, objectFit: 'cover' }} />
            ) : null}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 16 }}>
            บัญชีนี้ยังไม่เชื่อมโปรไฟล์ LINE ในระบบ
          </p>
        )}
      </div>

      <div className="admin-content" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>ที่อยู่จัดส่งที่บันทึกไว้</h3>
        {Array.isArray(customer.addresses) && customer.addresses.length > 0 ? (
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {customer.addresses.map((addr) => (
              <li key={addr.id} style={{ marginBottom: 12 }}>
                <strong>{addr.label || 'ที่อยู่'}</strong>
                {addr.is_default ? (
                  <span className="status status-delivered" style={{ marginLeft: 8, fontSize: 11 }}>
                    ค่าเริ่มต้น
                  </span>
                ) : null}
                <div className="muted" style={{ fontSize: 13 }}>
                  {[addr.recipient_name, addr.phone_number].filter(Boolean).join(' · ')}
                </div>
                <div>{addr.address_line}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {[addr.district, addr.province, addr.postal_code].filter(Boolean).join(' ')}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">ยังไม่มีที่อยู่ที่บันทึกในระบบ</p>
        )}
      </div>

      <div className="admin-content">
        <h3 style={{ marginTop: 0 }}>ออเดอร์ล่าสุด</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          แสดงสูงสุด 40 รายการ — คลิกแถวเพื่อเปิดรายละเอียด
        </p>
        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>เลขที่</th>
                <th>สถานะ</th>
                <th>การชำระ</th>
                <th>ยอดรวม</th>
                <th>วันที่</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(customer.recent_orders) && customer.recent_orders.length > 0 ? (
                customer.recent_orders.map((o) => (
                  <tr
                    key={o.id}
                    className="order-row-clickable"
                    onClick={() => navigate(`/admin/orders/${o.id}`)}
                  >
                    <td>{o.order_number || `#${o.id}`}</td>
                    <td>
                      <span className={`status status-${o.status}`}>{o.status_display || o.status}</span>
                    </td>
                    <td>{o.payment_method_display || o.payment_method}</td>
                    <td>{formatBaht(o.total_amount)}</td>
                    <td>{formatWhen(o.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">ยังไม่มีออเดอร์</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCustomerDetailPage;
