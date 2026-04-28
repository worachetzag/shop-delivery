import React, { useEffect, useMemo, useState } from 'react';
import config from '../config';
import { usePopup } from '../components/PopupProvider';

const AdminInventoryPage = () => {
  const popup = usePopup();
  const token = useMemo(() => localStorage.getItem('admin_token') || localStorage.getItem('auth_token'), []);
  const [overview, setOverview] = useState(null);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState(null);
  const [loadingPurchaseOrderDetail, setLoadingPurchaseOrderDetail] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ product_id: '', quantity_change: '', note: '', reference: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '' });
  const [poForm, setPoForm] = useState({
    supplier: '',
    notes: '',
    items: [{ product: '', ordered_quantity: '', unit_cost: '' }],
  });

  const authHeaders = {
    Authorization: `Token ${token}`,
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  const loadAll = async () => {
    try {
      const [overviewRes, productsRes, movementsRes, suppliersRes, poRes] = await Promise.all([
        fetch(`${config.API_BASE_URL}products/admin/inventory/overview/`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/?page_size=500`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/inventory/movements/?page_size=50`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/inventory/suppliers/`, { headers: authHeaders, credentials: 'include' }),
        fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/?page_size=30`, { headers: authHeaders, credentials: 'include' }),
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
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

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

  const viewPurchaseOrderDetail = async (poId) => {
    setLoadingPurchaseOrderDetail(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/${poId}/`, {
        headers: authHeaders,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'โหลดรายละเอียดใบสั่งซื้อไม่สำเร็จ');
      setSelectedPurchaseOrder(data);
    } catch (error) {
      popup.error(error.message);
    } finally {
      setLoadingPurchaseOrderDetail(false);
    }
  };

  return (
    <div className="admin-dashboard" style={{ padding: 16 }}>
      <h1>จัดการสต็อกแบบครบวงจร</h1>
      <div className="admin-stats" style={{ marginBottom: 16 }}>
        <div className="stat-card"><h3>{overview?.total_products || 0}</h3><p>จำนวนสินค้า</p></div>
        <div className="stat-card"><h3>{overview?.total_on_hand || 0}</h3><p>คงเหลือในคลัง</p></div>
        <div className="stat-card"><h3>{overview?.total_reserved || 0}</h3><p>จองจากออเดอร์</p></div>
        <div className="stat-card pending"><h3>{overview?.low_stock_count || 0}</h3><p>สต็อกต่ำ</p></div>
      </div>

      <div className="products-section" style={{ marginBottom: 20 }}>
        <h3>ปรับสต็อกด้วยมือ</h3>
        <form className="personnel-form" onSubmit={submitAdjustment}>
          <select value={adjustForm.product_id} onChange={(e) => setAdjustForm((p) => ({ ...p, product_id: e.target.value }))} required>
            <option value="">เลือกสินค้า</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (คงเหลือ {p.available_quantity ?? p.stock_quantity})</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="จำนวน (+ เพิ่ม / - ลด)"
            value={adjustForm.quantity_change}
            onChange={(e) => setAdjustForm((p) => ({ ...p, quantity_change: e.target.value }))}
            required
          />
          <input placeholder="Reference" value={adjustForm.reference} onChange={(e) => setAdjustForm((p) => ({ ...p, reference: e.target.value }))} />
          <input placeholder="หมายเหตุ" value={adjustForm.note} onChange={(e) => setAdjustForm((p) => ({ ...p, note: e.target.value }))} />
          <button type="submit" className="btn-primary">บันทึกปรับสต็อก</button>
        </form>
      </div>

      <div className="products-section" style={{ marginBottom: 20 }}>
        <h3>ผู้จำหน่าย</h3>
        <form className="personnel-form" onSubmit={submitSupplier}>
          <input placeholder="ชื่อผู้จำหน่าย" value={supplierForm.name} onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))} required />
          <input placeholder="ผู้ติดต่อ" value={supplierForm.contact_name} onChange={(e) => setSupplierForm((p) => ({ ...p, contact_name: e.target.value }))} />
          <input placeholder="เบอร์โทร" value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} />
          <button type="submit" className="btn-primary">เพิ่มผู้จำหน่าย</button>
        </form>
      </div>

      <div className="products-section" style={{ marginBottom: 20 }}>
        <h3>สร้างใบสั่งซื้อ (PO)</h3>
        <form className="personnel-form" onSubmit={submitPurchaseOrder}>
          <select value={poForm.supplier} onChange={(e) => setPoForm((p) => ({ ...p, supplier: e.target.value }))}>
            <option value="">ไม่ระบุผู้จำหน่าย</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: 'grid', gap: 8 }}>
            {(poForm.items || []).map((item, idx) => (
              <div key={`po-item-${idx}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                <select
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
                  type="number"
                  min="1"
                  placeholder="จำนวน"
                  value={item.ordered_quantity}
                  onChange={(e) => updatePoItem(idx, 'ordered_quantity', e.target.value)}
                  required
                />
                <input
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
          <button type="button" className="btn-outline" onClick={addPoItemRow}>+ เพิ่มรายการสินค้า</button>
          <input placeholder="หมายเหตุ" value={poForm.notes} onChange={(e) => setPoForm((p) => ({ ...p, notes: e.target.value }))} />
          <button type="submit" className="btn-primary">สร้างใบสั่งซื้อ</button>
        </form>
      </div>

      <div className="products-manage-table" style={{ marginBottom: 20 }}>
        <h3>ใบสั่งซื้อล่าสุด</h3>
        <table>
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
                    <button type="button" className="btn-secondary" onClick={() => viewPurchaseOrderDetail(po.id)}>
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

      {(loadingPurchaseOrderDetail || selectedPurchaseOrder) && (
        <div className="products-manage-table" style={{ marginBottom: 20 }}>
          <h3>รายละเอียดใบสั่งซื้อ</h3>
          {loadingPurchaseOrderDetail ? (
            <p>กำลังโหลดรายละเอียด...</p>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                <p><strong>เลขใบสั่งซื้อ:</strong> {selectedPurchaseOrder?.reference || '-'}</p>
                <p><strong>ผู้จำหน่าย:</strong> {selectedPurchaseOrder?.supplier_name || '-'}</p>
                <p><strong>สถานะ:</strong> {selectedPurchaseOrder?.status_display || selectedPurchaseOrder?.status || '-'}</p>
                <p><strong>หมายเหตุ:</strong> {selectedPurchaseOrder?.notes || '-'}</p>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>สินค้า</th>
                    <th>จำนวนสั่ง</th>
                    <th>รับแล้ว</th>
                    <th>คงค้าง</th>
                    <th>ต้นทุน/หน่วย</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPurchaseOrder?.items || []).map((item) => {
                    const ordered = Number(item.ordered_quantity || 0);
                    const received = Number(item.received_quantity || 0);
                    const remaining = Math.max(0, ordered - received);
                    return (
                      <tr key={item.id}>
                        <td>{item.product_name || `สินค้า #${item.product}`}</td>
                        <td>{ordered}</td>
                        <td>{received}</td>
                        <td>{remaining}</td>
                        <td>{Number(item.unit_cost || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 12 }}>
                <button type="button" className="btn-outline" onClick={() => setSelectedPurchaseOrder(null)}>
                  ปิดรายละเอียด
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="products-manage-table">
        <h3>ประวัติการเคลื่อนไหวสต็อก</h3>
        <table>
          <thead>
            <tr><th>เวลา</th><th>สินค้า</th><th>ประเภท</th><th>จำนวน</th><th>ก่อน/หลัง</th><th>ที่มา</th></tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.created_at).toLocaleString('th-TH')}</td>
                <td>{m.product_name}</td>
                <td>{m.movement_label}</td>
                <td>{m.quantity_change}</td>
                <td>{m.quantity_before} / {m.quantity_after}</td>
                <td>{m.source_type || '-'} {m.source_id || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminInventoryPage;

