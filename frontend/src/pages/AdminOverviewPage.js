import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import config from '../config';

const AdminOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    total_revenue: 0,
    active_drivers: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
        const response = await fetch(`${config.API_BASE_URL}orders/admin/stats/`, {
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            total_orders: Number(data.total_orders || 0),
            pending_orders: Number(data.pending_orders || 0),
            total_revenue: Number(data.total_revenue || 0),
            active_drivers: Number(data.active_drivers || 0),
          });
        }
      } catch (error) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="admin-dashboard" style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>แอดมินร้านค้า</h1>
      <p style={{ marginTop: 0, color: '#666', marginBottom: 16 }}>ภาพรวมระบบและทางลัดการจัดการ</p>

      <div className="admin-stats" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <h3>{loading ? '...' : stats.total_orders}</h3>
          <p>คำสั่งซื้อทั้งหมด</p>
        </div>
        <div className="stat-card pending">
          <h3>{loading ? '...' : stats.pending_orders}</h3>
          <p>รอจัดเตรียม</p>
        </div>
        <div className="stat-card revenue">
          <h3>{loading ? '...' : `฿${stats.total_revenue.toLocaleString()}`}</h3>
          <p>รายได้รวม</p>
        </div>
        <div className="stat-card">
          <h3>{loading ? '...' : stats.active_drivers}</h3>
          <p>คนขับพร้อมงาน</p>
        </div>
      </div>

      <div className="products-manage-table">
        <h3>ทางลัด</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/admin/orders">จัดการคำสั่งซื้อ</Link>
          <Link className="btn btn-secondary" to="/admin/products">จัดการสินค้า</Link>
          <Link className="btn btn-secondary" to="/admin/personnel/staff">บุคลากร</Link>
          <Link className="btn btn-secondary" to="/admin/store-settings/store">ตั้งค่าร้าน</Link>
          <Link className="btn btn-secondary" to="/admin/inventory/overview">จัดการสต็อก</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminOverviewPage;

