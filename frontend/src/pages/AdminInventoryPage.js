import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { ADMIN_SECTION_LABELS } from '../utils/adminNavTitles';
import './AdminDashboard.css';
import './AdminStoreSettingsPage.css';

const MOV_ORDERINGS = new Set(['-created_at', 'created_at', 'id', '-id', 'quantity_change', '-quantity_change', 'movement_type', '-movement_type']);
const PO_ORDERINGS = new Set([
  '-created_at',
  'created_at',
  'id',
  '-id',
  'updated_at',
  '-updated_at',
  'status',
  '-status',
  'reference',
  '-reference',
  'expected_date',
  '-expected_date',
]);

const AdminInventoryPage = ({ section = 'all' }) => {
  const popup = usePopup();
  const navigate = useNavigate();
  const token = useMemo(() => localStorage.getItem('admin_token') || localStorage.getItem('auth_token'), []);
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementOrdering, setMovementOrdering] = useState('-created_at');
  const [debouncedMovementSearch, setDebouncedMovementSearch] = useState('');
  const [poListSearch, setPoListSearch] = useState('');
  const [poListOrdering, setPoListOrdering] = useState('-created_at');
  const [debouncedPoListSearch, setDebouncedPoListSearch] = useState('');
  const [adjustForm, setAdjustForm] = useState({ product_id: '', quantity_change: '', note: '', reference: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '' });
  const [poForm, setPoForm] = useState({
    supplier: '',
    notes: '',
    items: [{ product: '', ordered_quantity: '', unit_cost: '' }],
  });

  const authHeaders = useMemo(
    () => ({
      Authorization: `Token ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    }),
    [token],
  );

  useEffect(() => {
    const id = setTimeout(() => setDebouncedMovementSearch(movementSearch.trim()), 350);
    return () => clearTimeout(id);
  }, [movementSearch]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedPoListSearch(poListSearch.trim()), 350);
    return () => clearTimeout(id);
  }, [poListSearch]);

  const loadAll = useCallback(async () => {
    setLoadingPage(true);
    try {
      const movParams = new URLSearchParams({ page_size: '50' });
      const mq = debouncedMovementSearch;
      if (mq) movParams.set('search', mq);
      const movOrd = MOV_ORDERINGS.has(movementOrdering) ? movementOrdering : '-created_at';
      if (movOrd !== '-created_at') movParams.set('ordering', movOrd);

      const poParams = new URLSearchParams({ page_size: '30' });
      const pq = debouncedPoListSearch;
      if (pq) poParams.set('search', pq);
      const poOrd = PO_ORDERINGS.has(poListOrdering) ? poListOrdering : '-created_at';
      if (poOrd !== '-created_at') poParams.set('ordering', poOrd);

      const [overviewRes, productsRes, movementsRes, suppliersRes, poRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}products/admin/inventory/overview/`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/?page_size=500`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/inventory/movements/?${movParams}`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/inventory/suppliers/`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/?${poParams}`, { headers: authHeaders, credentials: 'include' }),
      ]);
      setOverview(await overviewRes.json());
      const productsJson = await productsRes.json();
      const movementsJson = await movementsRes.json();
      const suppliersJson = await suppliersRes.json();
      const poJson = await poRes.json();
      setProducts(productsJson.results || productsJson || []);
      setMovements(movementsJson.results || movementsJson || []);
      setSuppliers(suppliersJson.results || suppliersJson || []);
      setPurchaseOrders(poJson.results || poJson || []);
    } catch (error) {
      popup.error('โหลดข้อมูลสต็อกไม่สำเร็จ');
    } finally {
      setLoadingPage(false);
    }
  }, [authHeaders, debouncedMovementSearch, movementOrdering, debouncedPoListSearch, poListOrdering, popup]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const submitAdjustment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/movements/`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          product_id: Number(adjustForm.product_id),
          quantity_change: Number(adjustForm.quantity_change),
          note: adjustForm.note,
          reference: adjustForm.reference,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'ปรับสต็อกไม่สำเร็จ');
      setAdjustForm({ product_id: '', quantity_change: '', note: '', reference: '' });
      popup.info('บันทึกการปรับสต็อกแล้ว');
      loadAll();
    } catch (error) {
      popup.error(error.message);
    }
  };

  const submitSupplier = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/suppliers/`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(supplierForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'เพิ่มผู้จำหน่ายไม่สำเร็จ');
      setSupplierForm({ name: '', contact_name: '', phone: '' });
      loadAll();
    } catch (error) {
      popup.error(error.message);
    }
  };

  const submitPurchaseOrder = async (e) => {
    e.preventDefault();
    try {
      const lines = (poForm.items || [])
        .map((line) => ({
          product: Number(line.product),
          ordered_quantity: Number(line.ordered_quantity),
          received_quantity: 0,
          unit_cost: Number(line.unit_cost || 0),
        }))
        .filter((line) => line.product > 0 && line.ordered_quantity > 0);
      if (!lines.length) throw new Error('กรุณาระบุรายการสินค้า');
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          supplier: poForm.supplier ? Number(poForm.supplier) : null,
          notes: poForm.notes,
          status: 'approved',
          items: lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'สร้างใบสั่งซื้อไม่สำเร็จ');
      setPoForm({
        supplier: '',
        notes: '',
        items: [{ product: '', ordered_quantity: '', unit_cost: '' }],
      });
      popup.info('สร้างใบสั่งซื้อแล้ว');
      loadAll();
    } catch (error) {
      popup.error(error.message);
    }
  };

  const updatePoItem = (idx, key, value) => {
    setPoForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    }));
  };

  const addPoItemRow = () => {
    setPoForm((prev) => ({
      ...prev,
      items: [...prev.items, { product: '', ordered_quantity: '', unit_cost: '' }],
    }));
  };

  const removePoItemRow = (idx) => {
    setPoForm((prev) => {
      const next = prev.items.filter((_, i) => i !== idx);
      return {
        ...prev,
        items: next.length ? next : [{ product: '', ordered_quantity: '', unit_cost: '' }],
      };
    });
  };

  const receiveAll = async (po) => {
    try {
      const payloadItems = (po.items || [])
        .map((item) => ({
          item_id: item.id,
          receive_quantity: Number(item.ordered_quantity || 0) - Number(item.received_quantity || 0),
        }))
        .filter((item) => item.receive_quantity > 0);
      if (!payloadItems.length) {
        popup.info('ใบสั่งซื้อนี้รับเข้าครบแล้ว');
        return;
      }
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/${po.id}/receive/`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'รับเข้าไม่สำเร็จ');
      popup.info(`รับเข้า ${po.reference} แล้ว`);
      loadAll();
    } catch (error) {
      popup.error(error.message);
    }
  };

  const goToMovementSource = (movement) => {
    const sourceType = String(movement?.source_type || '').toLowerCase();
    const sourceId = String(movement?.source_id || '').trim();
    if (!sourceType || !sourceId) return;

    if (sourceType === 'order') {
      // source_id ใน movement เก็บเป็นเลขออเดอร์ เช่น SP20260430001
      navigate(`/admin/orders?q=${encodeURIComponent(sourceId)}`);
      return;
    }
    if (sourceType === 'purchase_order') {
      navigate(`/admin/inventory/purchase-orders?q=${encodeURIComponent(sourceId)}`);
    }
  };

  const visibleMovements = useMemo(
    () => movements.filter((m) => String(m?.movement_type || '').toLowerCase() !== 'sale_reserve'),
    [movements]
  );

  /** แสดงชื่อผู้ทำเฉพาะปรับสต็อกมือ / PO / รับเข้า — รายการจากออเดอร์ขายไม่แสดง (ตามเดิม) */
  const movementStaffLabel = (m) => {
    const t = String(m?.movement_type || '');
    const st = String(m?.source_type || '').toLowerCase();
    if (t.startsWith('sale_') || st === 'order') {
      return null;
    }
    const label = String(m?.actor_display || m?.actor_name || '').trim();
    return label || null;
  };

  const invHeading =
    section === 'all'
      ? 'จัดการสต็อก'
      : ADMIN_SECTION_LABELS.inventory[section] || 'จัดการสต็อก';

  if (loadingPage) {
    return (
      <AdminPageShell
        header={<AdminPageHeader title={invHeading} />}
      />
    );
  }

  return (
    <AdminPageShell
      header={<AdminPageHeader title={invHeading} />}
    >
      {(section === 'all' || section === 'overview') && (
      <div className="admin-stats" style={{ marginBottom: 16 }}>
        <div className="stat-card"><h3>{overview?.total_products || 0}</h3><p>จำนวนสินค้า</p></div>
        <div className="stat-card"><h3>{overview?.total_on_hand || 0}</h3><p>คงเหลือในคลัง</p></div>
        <div className="stat-card"><h3>{overview?.total_reserved || 0}</h3><p>จองจากออเดอร์</p></div>
        <div className="stat-card pending"><h3>{overview?.low_stock_count || 0}</h3><p>สต็อกต่ำ</p></div>
      </div>
      )}

      {(section === 'all' || section === 'adjustments') && (
      <section className="store-settings-card" style={{ marginBottom: 20 }}>
        <h2 className="store-settings-card__title">ปรับสต็อกด้วยมือ</h2>
        <form className="store-settings-form" onSubmit={submitAdjustment}>
          <div className="store-settings-stack">
            <div className="store-settings-field">
              <label className="form-label" htmlFor="inv-adjust-product">สินค้า</label>
              <select
                id="inv-adjust-product"
                className="form-input"
                value={adjustForm.product_id}
                onChange={(e) => setAdjustForm((p) => ({ ...p, product_id: e.target.value }))}
                required
              >
                <option value="">เลือกสินค้า</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (คงเหลือ {p.available_quantity ?? p.stock_quantity})</option>
                ))}
              </select>
            </div>
            <div className="store-settings-field">
              <label className="form-label" htmlFor="inv-adjust-qty">จำนวน (+ เพิ่ม / - ลด)</label>
              <input
                id="inv-adjust-qty"
                className="form-input"
                type="number"
                value={adjustForm.quantity_change}
                onChange={(e) => setAdjustForm((p) => ({ ...p, quantity_change: e.target.value }))}
                required
              />
            </div>
            <div className="store-settings-row-2">
              <input className="form-input" placeholder="Reference" value={adjustForm.reference} onChange={(e) => setAdjustForm((p) => ({ ...p, reference: e.target.value }))} />
              <input className="form-input" placeholder="หมายเหตุ" value={adjustForm.note} onChange={(e) => setAdjustForm((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="store-settings-btn-row">
              <button type="submit" className="btn-primary">บันทึกปรับสต็อก</button>
            </div>
          </div>
        </form>
      </section>
      )}

      {(section === 'all' || section === 'suppliers') && (
      <section className="store-settings-card" style={{ marginBottom: 20 }}>
        <h2 className="store-settings-card__title">ผู้จำหน่าย</h2>
        <form className="store-settings-form" onSubmit={submitSupplier}>
          <div className="store-settings-stack">
            <div className="store-settings-field">
              <label className="form-label" htmlFor="inv-supplier-name">ชื่อผู้จำหน่าย</label>
              <input id="inv-supplier-name" className="form-input" value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="store-settings-row-2">
              <input className="form-input" placeholder="ผู้ติดต่อ" value={supplierForm.contact_name} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_name: e.target.value }))} />
              <input className="form-input" placeholder="เบอร์โทร" value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="store-settings-btn-row">
              <button type="submit" className="btn-primary">เพิ่มผู้จำหน่าย</button>
            </div>
          </div>
        </form>
      </section>
      )}

      {(section === 'all' || section === 'purchase-orders') && (
      <section className="store-settings-card" style={{ marginBottom: 20 }}>
        <h2 className="store-settings-card__title">ใบสั่งซื้อล่าสุด</h2>
        <div className="admin-toolbar-row">
          <input
            type="search"
            className="form-input"
            placeholder="ค้นหาเลข PO หมายเหตุ ชื่อผู้จำหน่าย"
            value={poListSearch}
            onChange={(e) => setPoListSearch(e.target.value)}
            aria-label="ค้นหาใบสั่งซื้อ"
          />
          <label className="admin-toolbar-ordering">
            <span className="muted">เรียง</span>
            <select
              className="form-input"
              value={poListOrdering}
              onChange={(e) => setPoListOrdering(e.target.value)}
              aria-label="เรียงใบสั่งซื้อ"
            >
              <option value="-created_at">สร้างล่าสุดก่อน</option>
              <option value="created_at">สร้างเก่าสุดก่อน</option>
              <option value="-updated_at">อัปเดตล่าสุดก่อน</option>
              <option value="updated_at">อัปเดตเก่าสุดก่อน</option>
              <option value="reference">เลขอ้างอิง A → Z</option>
              <option value="-reference">เลขอ้างอิง Z → A</option>
              <option value="status">สถานะ (ตามระบบ)</option>
              <option value="-status">สถานะ (กลับด้าน)</option>
              <option value="expected_date">กำหนดรับ (ตามระบบ)</option>
              <option value="-expected_date">กำหนดรับ (กลับด้าน)</option>
            </select>
          </label>
          {(poListSearch || debouncedPoListSearch || poListOrdering !== '-created_at') && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPoListSearch('');
                setDebouncedPoListSearch('');
                setPoListOrdering('-created_at');
              }}
            >
              ล้าง
            </button>
          )}
        </div>
        <div className="admin-data-table-wrap">
          <table className="admin-data-table">
          <thead>
            <tr><th>PO</th><th>ผู้จำหน่าย</th><th>สถานะ</th><th>รายการ</th><th>จัดการ</th></tr>
          </thead>
          <tbody>
            {purchaseOrders.map((po) => (
              <tr key={po.id}>
                <td>{po.reference}</td>
                <td>{po.supplier_name || '-'}</td>
                <td>{po.status_display || po.status}</td>
                <td>{(po.items || []).length}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigate(`/admin/inventory/purchase-orders/${po.id}`)}
                    >
                      ดูรายละเอียด
                    </button>
                    <button type="button" className="stock-save-btn" onClick={() => receiveAll(po)}>
                      รับเข้าคงค้างทั้งหมด
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      )}

      {(section === 'all' || section === 'purchase-orders') && (
      <section className="store-settings-card" style={{ marginBottom: 20 }}>
        <h2 className="store-settings-card__title">สร้างใบสั่งซื้อ (PO)</h2>
        <form className="store-settings-form" onSubmit={submitPurchaseOrder}>
          <div className="store-settings-stack">
            <div className="store-settings-field">
              <label className="form-label" htmlFor="inv-po-supplier">ผู้จำหน่าย (ถ้ามี)</label>
              <select id="inv-po-supplier" className="form-input" value={poForm.supplier} onChange={(e) => setPoForm((p) => ({ ...p, supplier: e.target.value }))}>
                <option value="">ไม่ระบุผู้จำหน่าย</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="store-settings-stack" style={{ gap: 'var(--space-3)' }}>
              {(poForm.items || []).map((item, idx) => (
                <div key={`po-item-${idx}`} className="admin-po-item-row">
                  <select
                    className="form-input"
                    value={item.product}
                    onChange={(e) => updatePoItem(idx, 'product', e.target.value)}
                    required
                  >
                    <option value="">เลือกสินค้า</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    placeholder="จำนวน"
                    value={item.ordered_quantity}
                    onChange={(e) => updatePoItem(idx, 'ordered_quantity', e.target.value)}
                    required
                  />
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="ต้นทุน/หน่วย"
                    value={item.unit_cost}
                    onChange={(e) => updatePoItem(idx, 'unit_cost', e.target.value)}
                  />
                  <button type="button" className="btn-secondary" onClick={() => removePoItemRow(idx)}>
                    ลบ
                  </button>
                </div>
              ))}
            </div>
            <div className="store-settings-btn-row">
              <button type="button" className="btn-outline" onClick={addPoItemRow}>+ เพิ่มรายการสินค้า</button>
            </div>
            <input className="form-input" placeholder="หมายเหตุ" value={poForm.notes} onChange={(e) => setPoForm((p) => ({ ...p, notes: e.target.value }))} />
            <div className="store-settings-btn-row">
              <button type="submit" className="btn-primary">สร้างใบสั่งซื้อ</button>
            </div>
          </div>
        </form>
      </section>
      )}

      {(section === 'all' || section === 'movements') && (
      <section className="store-settings-card">
        <h2 className="store-settings-card__title">ประวัติการเคลื่อนไหวสต็อก</h2>
        <div className="admin-toolbar-row">
          <input
            type="search"
            className="form-input"
            placeholder="ค้นหาสินค้า อ้างอิง หมายเหตุ ที่มา"
            value={movementSearch}
            onChange={(e) => setMovementSearch(e.target.value)}
            aria-label="ค้นหาประวัติสต็อก"
          />
          <label className="admin-toolbar-ordering">
            <span className="muted">เรียง</span>
            <select
              className="form-input"
              value={movementOrdering}
              onChange={(e) => setMovementOrdering(e.target.value)}
              aria-label="เรียงประวัติสต็อก"
            >
              <option value="-created_at">เวลาล่าสุดก่อน</option>
              <option value="created_at">เวลาเก่าสุดก่อน</option>
              <option value="-id">รหัสมากสุดก่อน</option>
              <option value="id">รหัสน้อยสุดก่อน</option>
              <option value="quantity_change">จำนวนเปลี่ยน (ตามระบบ)</option>
              <option value="-quantity_change">จำนวนเปลี่ยน (กลับด้าน)</option>
              <option value="movement_type">ประเภท (ตามระบบ)</option>
              <option value="-movement_type">ประเภท (กลับด้าน)</option>
            </select>
          </label>
          {(movementSearch || debouncedMovementSearch || movementOrdering !== '-created_at') && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setMovementSearch('');
                setDebouncedMovementSearch('');
                setMovementOrdering('-created_at');
              }}
            >
              ล้าง
            </button>
          )}
        </div>
        <div className="admin-data-table-wrap">
          <table className="admin-data-table">
          <thead>
            <tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th>ผู้ทำรายการ</th><th>จำนวน</th><th>ก่อน/หลัง</th><th>ที่มา</th></tr>
          </thead>
          <tbody>
            {visibleMovements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.created_at).toLocaleString('th-TH')}</td>
                <td>{m.product_name}</td>
                <td>{m.movement_label}</td>
                <td>{movementStaffLabel(m) ?? '—'}</td>
                <td>{m.quantity_change}</td>
                <td>{m.quantity_before} / {m.quantity_after}</td>
                <td>
                  {m.source_type || '-'} {m.source_id || ''}
                  {String(m.source_type || '').toLowerCase() === 'order' && String(m.source_id || '').trim() ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginLeft: 8, padding: '2px 8px', fontSize: '0.78rem' }}
                      onClick={() => goToMovementSource(m)}
                    >
                      เปิดออเดอร์
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
      )}
    </AdminPageShell>
  );
};

export default AdminInventoryPage;

