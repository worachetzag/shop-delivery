import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminPageShell from '../components/AdminPageShell';
import { usePopup } from '../components/PopupProvider';
import config from '../config';
import { useAdminBreadcrumbTail } from '../context/AdminBreadcrumbContext';
import './AdminDashboard.css';

const AdminPurchaseOrderDetailPage = () => {
  const popup = usePopup();
  const { poId } = useParams();
  const token = useMemo(() => localStorage.getItem('admin_token') || localStorage.getItem('auth_token'), []);
  const [loading, setLoading] = useState(true);
  const [receiving, setReceiving] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState(null);

  useAdminBreadcrumbTail(purchaseOrder?.reference ? String(purchaseOrder.reference) : null);

  const authHeaders = {
    Authorization: `Token ${token}`,
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  };

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/${poId}/`, {
        headers: authHeaders,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'โหลดรายละเอียดใบสั่งซื้อไม่สำเร็จ');
      setPurchaseOrder(data);
    } catch (error) {
      popup.error(error.message || 'โหลดรายละเอียดใบสั่งซื้อไม่สำเร็จ');
      setPurchaseOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [poId]);

  const receiveAll = async () => {
    if (!purchaseOrder) return;
    const payloadItems = (purchaseOrder.items || [])
      .map((item) => ({
        item_id: item.id,
        receive_quantity: Number(item.ordered_quantity || 0) - Number(item.received_quantity || 0),
      }))
      .filter((item) => item.receive_quantity > 0);
    if (!payloadItems.length) {
      popup.info('ใบสั่งซื้อนี้รับเข้าครบแล้ว');
      return;
    }
    setReceiving(true);
    try {
      const res = await fetch(`${config.API_BASE_URL}products/admin/inventory/purchase-orders/${purchaseOrder.id}/receive/`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ items: payloadItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'รับเข้าไม่สำเร็จ');
      popup.info(`รับเข้า ${purchaseOrder.reference} แล้ว`);
      loadDetail();
    } catch (error) {
      popup.error(error.message || 'รับเข้าไม่สำเร็จ');
    } finally {
      setReceiving(false);
    }
  };

  if (loading) {
    return (
      <AdminPageShell
        header={<AdminPageHeader title="ใบสั่งซื้อ (PO)" subtitle="กำลังโหลดรายละเอียด..." />}
      />
    );
  }

  if (!purchaseOrder) {
    return (
      <AdminPageShell
        header={(
          <AdminPageHeader
            title="ใบสั่งซื้อ (PO)"
            subtitle="ไม่พบข้อมูลใบสั่งซื้อ"
          />
        )}
      />
    );
  }

  return (
    <AdminPageShell
      header={(
        <AdminPageHeader
          title="ใบสั่งซื้อ (PO)"
          subtitle={purchaseOrder.reference ? `เลขอ้างอิง ${purchaseOrder.reference}` : null}
          actions={(
            <button type="button" className="btn btn-primary" onClick={receiveAll} disabled={receiving}>
              {receiving ? 'กำลังรับเข้า...' : 'รับเข้าคงค้างทั้งหมด'}
            </button>
          )}
        />
      )}
    >
      <div className="products-manage-table" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p><strong>เลขใบสั่งซื้อ:</strong> {purchaseOrder.reference || '-'}</p>
          <p><strong>ผู้จำหน่าย:</strong> {purchaseOrder.supplier_name || '-'}</p>
          <p><strong>สถานะ:</strong> {purchaseOrder.status_display || purchaseOrder.status || '-'}</p>
          <p><strong>หมายเหตุ:</strong> {purchaseOrder.notes || '-'}</p>
        </div>
      </div>

      <div className="products-manage-table">
        <h3>รายการสินค้าในใบสั่งซื้อ</h3>
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
            {(purchaseOrder.items || []).map((item) => {
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
      </div>
    </AdminPageShell>
  );
};

export default AdminPurchaseOrderDetailPage;

