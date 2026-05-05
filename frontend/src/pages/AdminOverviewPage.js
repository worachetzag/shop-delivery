import React, { useEffect, useMemo, useState } from 'react';
import config from '../config';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import './AdminDashboard.css';

const AdminOverviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(7);
  const [stats, setStats] = useState({
    total_orders: 0,
    pending_orders: 0,
    total_revenue: 0,
    active_drivers: 0,
  });
  const [dailyTrend, setDailyTrend] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');
    const loadStats = async () => {
      setLoading(true);
      try {
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
    const loadTrend = async () => {
      setTrendLoading(true);
      try {
        const response = await fetch(`${config.API_BASE_URL}orders/list/?page_size=200`, {
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('Failed to load orders trend');
        }
        const data = await response.json();
        const list = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
        setDailyTrend(list);
      } catch (error) {
        setDailyTrend([]);
      } finally {
        setTrendLoading(false);
      }
    };
    loadStats();
    loadTrend();
  }, []);

  const chartItems = useMemo(() => {
    const revenueBaht = Math.round(Number(stats.total_revenue || 0));
    const revenueForBar =
      revenueBaht <= 0 ? 0 : Math.max(Math.round(revenueBaht / 1000), 1);
    const rows = [
      { key: 'total_orders', label: 'ออเดอร์ทั้งหมด', value: Number(stats.total_orders || 0), barScale: Number(stats.total_orders || 0), color: '#14532d' },
      { key: 'pending_orders', label: 'รอจัดเตรียม', value: Number(stats.pending_orders || 0), barScale: Number(stats.pending_orders || 0), color: '#15803d' },
      { key: 'active_drivers', label: 'คนขับพร้อมงาน', value: Number(stats.active_drivers || 0), barScale: Number(stats.active_drivers || 0), color: '#22c55e' },
      {
        key: 'revenue',
        label: 'รายได้รวม (บาท)',
        value: revenueBaht,
        barScale: revenueForBar,
        color: '#86efac',
      },
    ];
    const max = Math.max(...rows.map((item) => item.barScale), 1);
    return rows.map((item) => ({
      ...item,
      percent: Math.max(8, Math.round((item.barScale / max) * 100)),
    }));
  }, [stats]);

  const trendChartData = useMemo(() => {
    if (!Array.isArray(dailyTrend)) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: trendDays }, (_, idx) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (trendDays - 1 - idx));
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        dateText: date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
        label: trendDays === 7
          ? date.toLocaleDateString('th-TH', { weekday: 'short' })
          : date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' }),
        count: 0,
        revenue: 0,
      };
    });
    const dayMap = new Map(days.map((day) => [day.key, day]));
    dailyTrend.forEach((order) => {
      if (!order?.created_at) return;
      const created = new Date(order.created_at);
      if (Number.isNaN(created.getTime())) return;
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
      if (dayMap.has(key)) {
        dayMap.get(key).count += 1;
        dayMap.get(key).revenue += Number(order.total_amount || 0);
      }
    });
    return days;
  }, [dailyTrend, trendDays]);

  const maxTrendValue = useMemo(
    () => Math.max(...trendChartData.map((item) => item.count), 1),
    [trendChartData]
  );
  const maxTrendRevenue = useMemo(
    () => Math.max(...trendChartData.map((item) => item.revenue), 1),
    [trendChartData]
  );

  return (
    <AdminPageShell
      header={<AdminPageHeader title="ภาพรวม" subtitle="ภาพรวมระบบและข้อมูลเชิงสรุป" />}
    >
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

      <div className="products-manage-table admin-overview-chart">
        <h3>กราฟภาพรวม</h3>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          เปรียบเทียบปริมาณข้อมูลหลักแบบรวดเร็ว
        </p>
        <div className="admin-mini-chart" role="img" aria-label="กราฟสรุปข้อมูลหน้าแอดมิน">
          {chartItems.map((item) => (
            <div className="admin-mini-chart-row" key={item.key}>
              <div className="admin-mini-chart-label">{item.label}</div>
              <div className="admin-mini-chart-track">
                <div
                  className="admin-mini-chart-fill"
                  style={{
                    width: `${item.percent}%`,
                    background: item.color,
                  }}
                />
              </div>
              <div className="admin-mini-chart-value">
                {item.key === 'revenue' ? `฿${item.value.toLocaleString()}` : item.value.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="products-manage-table admin-overview-chart" style={{ marginTop: 16 }}>
        <div className="admin-trend-head">
          <h3>แนวโน้มออเดอร์</h3>
          <div className="admin-trend-filters">
            <button
              type="button"
              className={`admin-trend-filter-btn ${trendDays === 7 ? 'active' : ''}`}
              onClick={() => setTrendDays(7)}
            >
              7 วัน
            </button>
            <button
              type="button"
              className={`admin-trend-filter-btn ${trendDays === 30 ? 'active' : ''}`}
              onClick={() => setTrendDays(30)}
            >
              30 วัน
            </button>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          จำนวนคำสั่งซื้อรายวันย้อนหลัง {trendDays} วัน
        </p>
        {trendLoading ? (
          <div className="empty-state">กำลังโหลดกราฟ...</div>
        ) : trendChartData.length === 0 ? (
          <div className="empty-state">ยังไม่มีข้อมูลสำหรับแสดงกราฟ</div>
        ) : (
          <div className={`admin-trend-chart ${trendDays === 30 ? 'is-month' : ''}`} role="img" aria-label={`กราฟจำนวนออเดอร์ ${trendDays} วันล่าสุด`}>
            {trendChartData.map((item) => (
              <div
                className="admin-trend-column"
                key={item.key}
                title={`${item.dateText}\nออเดอร์: ${item.count.toLocaleString()} รายการ\nรายได้: ฿${Math.round(item.revenue).toLocaleString()}`}
              >
                <div className="admin-trend-value">{item.count}</div>
                <div className="admin-trend-bar-wrap">
                  <div
                    className="admin-trend-bar"
                    style={{ height: `${Math.max(10, Math.round((item.count / maxTrendValue) * 100))}%` }}
                  />
                  <div
                    className="admin-trend-revenue-dot"
                    style={{ bottom: `${Math.max(6, Math.round((item.revenue / maxTrendRevenue) * 100))}%` }}
                  />
                </div>
                <div className="admin-trend-label">{item.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
};

export default AdminOverviewPage;

