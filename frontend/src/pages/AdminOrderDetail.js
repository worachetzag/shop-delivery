import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import config from '../config';
import { displayProductLineName } from '../utils/helpers';
import { usePopup } from '../components/PopupProvider';
import { AdminBackLink } from '../components/AdminBackButton';
import './AdminOrderDetail.css';

const AdminOrderDetail = () => {
  const popup = usePopup();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [assignmentDraft, setAssignmentDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSlip, setSavingSlip] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState('');

  const getAdminToken = () => localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const token = getAdminToken();
        const response = await fetch(`${config.API_BASE_URL}orders/${orderId}/`, {
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ');
        }
        setOrder(data);
        setAssignmentDraft(data?.driver_assignment?.driver_id ? String(data.driver_assignment.driver_id) : '');
      } catch (error) {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [orderId]);

  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const token = getAdminToken();
        const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/drivers/`, {
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('โหลดรายชื่อคนขับไม่สำเร็จ');
        }
        const data = await response.json();
        const list = data && data.results !== undefined ? data.results : data;
        setDrivers(Array.isArray(list) ? list : []);
      } catch (error) {
        setDrivers([]);
      }
    };
    loadDrivers();
  }, []);

  useEffect(() => {
    let objectUrl = '';
    const loadSlipPreview = async () => {
      if (!order?.payment_slip_url) {
        setSlipPreviewUrl('');
        return;
      }
      try {
        const token = getAdminToken();
        const response = await fetch(order.payment_slip_url, {
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error('ไม่สามารถโหลดรูปสลิปได้');
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setSlipPreviewUrl(objectUrl);
      } catch (error) {
        setSlipPreviewUrl(order.payment_slip_url);
      }
    };
    loadSlipPreview();
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [order?.payment_slip_url]);

  const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('th-TH');
  };

  const refreshOrder = async () => {
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}orders/${orderId}/`, {
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'โหลดรายละเอียดคำสั่งซื้อไม่สำเร็จ');
      }
      setOrder(data);
    } catch (error) {
      // keep current data
    }
  };

  const updateOrderStatus = async (status) => {
    if (!order || savingStatus) return;
    setSavingStatus(true);
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}orders/${order.id}/status/`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('อัปเดตสถานะไม่สำเร็จ');
      }
      await refreshOrder();
      popup.info('อัปเดตสถานะสำเร็จ');
    } catch (error) {
      popup.error(error.message || 'อัปเดตสถานะไม่สำเร็จ');
    } finally {
      setSavingStatus(false);
    }
  };

  const reviewPaymentSlip = async (decision) => {
    if (!order || savingSlip) return;
    const confirmText = decision === 'verified' ? 'ยืนยันสลิปนี้ใช่หรือไม่?' : 'ปฏิเสธสลิปนี้ใช่หรือไม่?';
    if (!(await popup.confirm(confirmText, { tone: decision === 'verified' ? 'primary' : 'danger', confirmText: decision === 'verified' ? 'ยืนยันสลิป' : 'ปฏิเสธสลิป' }))) return;
    setSavingSlip(true);
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}orders/${order.id}/payment-slip/review/`, {
        method: 'PUT',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'อัปเดตสถานะสลิปไม่สำเร็จ');
      }
      await refreshOrder();
      popup.info(data?.message || 'อัปเดตสถานะสลิปเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'อัปเดตสถานะสลิปไม่สำเร็จ');
    } finally {
      setSavingSlip(false);
    }
  };

  const assignDriver = async () => {
    if (!order || savingAssign) return;
    if (order.order_type === 'pickup') {
      popup.info('ออเดอร์มารับที่ร้านไม่ต้องมอบหมายคนขับ');
      return;
    }
    if (!assignmentDraft) {
      popup.info('กรุณาเลือกคนขับก่อนมอบหมายงาน');
      return;
    }
    setSavingAssign(true);
    try {
      const token = getAdminToken();
      const response = await fetch(`${config.API_BASE_URL}orders/${order.id}/assign-driver/`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ driver_id: Number(assignmentDraft) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'มอบหมายงานไม่สำเร็จ');
      }
      await refreshOrder();
      popup.info(data?.message || 'มอบหมายงานสำเร็จ');
    } catch (error) {
      popup.error(error.message || 'มอบหมายงานไม่สำเร็จ');
    } finally {
      setSavingAssign(false);
    }
  };

  if (loading) {
    return <div className="loading">กำลังโหลดรายละเอียดคำสั่งซื้อ...</div>;
  }

  if (!order) {
    return (
      <div className="admin-dashboard">
        <div className="admin-content">
          <p>ไม่พบคำสั่งซื้อ</p>
          <AdminBackLink to="/admin/orders" ariaLabel="รายการคำสั่งซื้อ" />
        </div>
      </div>
    );
  }

  const isOrderClosed = ['delivered', 'cancelled'].includes(order.status);
  /** แสดงปุ่มยืนยัน/ปฏิเสธเฉพาะตอนรอแอดมินตรวจ (หลังอัปโหลดแล้ว) — ไม่ให้กดซ้ำหลัง verified/rejected */
  const canReviewSlip =
    !isOrderClosed &&
    order.payment_method === 'promptpay' &&
    order.payment_slip_url &&
    order.payment_slip_status === 'uploaded';
  const isPickup = order.order_type === 'pickup';
  const hasAssignedDriver = Boolean(order?.driver_assignment?.driver_id);
  const customerId = order.customer || order.customer_id || null;
  const deliveryFee = Number(order.delivery_fee || 0);
  const orderTotal = Number(order.total_amount || 0);
  const subtotalFromOrder = Number(
    order.subtotal_amount ?? order.subtotal ?? order.items_total ?? Number.NaN
  );
  const subtotalFromItems = (order.items || []).reduce((sum, item) => {
    const lineTotal = Number(
      item.line_total ?? item.total_amount ?? item.total_price ?? Number.NaN
    );
    if (Number.isFinite(lineTotal)) return sum + lineTotal;
    return sum + (Number(item.price || 0) * Number(item.quantity || 0));
  }, 0);
  const productSubtotal = Number.isFinite(subtotalFromOrder)
    ? subtotalFromOrder
    : (subtotalFromItems > 0 ? subtotalFromItems : Math.max(orderTotal - deliveryFee, 0));

  return (
    <div className="admin-dashboard">
      <div className="admin-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <AdminBackLink to="/admin/orders" ariaLabel="รายการคำสั่งซื้อ" />
          <h2 style={{ margin: 0 }}>
            รายละเอียดคำสั่งซื้อ {order.order_number || `#${order.id}`}
          </h2>
        </div>
        <p>
          <strong>ลูกค้า:</strong>{' '}
          {customerId ? (
            <Link to={`/admin/customers/${customerId}`} className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block', padding: '2px 8px', marginLeft: 4 }}>
              {order.customer_name || `ลูกค้า #${customerId}`}
            </Link>
          ) : (
            order.customer_name || '-'
          )}
        </p>
        <p><strong>สถานะ:</strong> {order.status_display || order.status}</p>
        <p>
          <strong>การรับสินค้า:</strong>{' '}
          {order.order_type_display || (isPickup ? 'มารับที่ร้าน' : 'จัดส่งถึงบ้าน')}
        </p>
        <p><strong>วิธีชำระเงิน:</strong> {order.payment_method_display || order.payment_method}</p>
        <p><strong>ที่อยู่จัดส่ง:</strong> {order.delivery_address || '-'}</p>
        <p><strong>เบอร์โทร:</strong> {order.delivery_phone || '-'}</p>
        <p><strong>หมายเหตุ:</strong> {order.delivery_notes || '-'}</p>

        {!isOrderClosed && (
          <div className="order-detail-items">
            <strong>จัดการคำสั่งซื้อ</strong>
            <div className="product-actions-cell" style={{ marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => updateOrderStatus('preparing')}
                disabled={savingStatus || order.status !== 'pending'}
              >
                เริ่มจัดเตรียม
              </button>
              <button
                type="button"
                onClick={() => updateOrderStatus('ready')}
                disabled={savingStatus || order.status !== 'preparing'}
              >
                {isPickup ? 'พร้อมให้ลูกค้ามารับ' : 'พร้อมส่ง'}
              </button>
              {isPickup && order.status === 'ready' && (
                <button
                  type="button"
                  onClick={() => updateOrderStatus('delivered')}
                  disabled={savingStatus}
                >
                  ลูกค้ารับสินค้าแล้ว
                </button>
              )}
            </div>
          </div>
        )}

        {isPickup ? (
          <div className="order-detail-items assign-driver-section assign-driver-section--pickup-note">
            <strong className="assign-driver-section__title">คนขับ</strong>
            <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.45 }}>
              ออเดอร์มารับที่ร้าน — <strong>ไม่ต้องมอบหมายคนขับ</strong> เมื่อจัดเตรียมเสร็จให้กด
              「พร้อมให้ลูกค้ามารับ」แล้วปิดด้วย「ลูกค้ารับสินค้าแล้ว」เมื่อลูกค้ามาถึงร้าน
            </p>
          </div>
        ) : (
          <div className="order-detail-items assign-driver-section">
            <strong className="assign-driver-section__title">มอบหมายคนขับ</strong>
            <div className="assign-driver-card">
              <div className="assign-driver-current">
                <span className="assign-driver-current__label">คนขับปัจจุบัน</span>
                <div className="assign-driver-current__value">
                  {order?.driver_assignment?.driver_photo_url ? (
                    <img
                      src={order.driver_assignment.driver_photo_url}
                      alt=""
                      className="assign-driver-avatar"
                    />
                  ) : (
                    <span className="assign-driver-avatar assign-driver-avatar--fallback">D</span>
                  )}
                  <span>{order?.driver_assignment?.driver_name || 'ยังไม่มอบหมาย'}</span>
                  {order?.driver_assignment?.status_display ? (
                    <span className="assign-driver-status-chip">{order.driver_assignment.status_display}</span>
                  ) : null}
                </div>
              </div>

              {!hasAssignedDriver ? (
                <div className="assign-driver-form">
                  <label className="assign-driver-form__label" htmlFor="assign-driver-select">
                    เลือกคนขับที่พร้อมรับงาน
                  </label>
                  <div className="assign-driver-form__controls">
                    <select
                      id="assign-driver-select"
                      className="assign-driver-select"
                      value={assignmentDraft}
                      onChange={(e) => setAssignmentDraft(e.target.value)}
                    >
                      <option value="">เลือกคนขับ</option>
                      {drivers.map((driver) => (
                        <option
                          key={driver.id}
                          value={driver.id}
                          disabled={!driver.is_available || driver.has_active_assignment}
                        >
                          {driver.full_name} ({driver.vehicle_number || '-'}) - {(driver.is_available && !driver.has_active_assignment) ? 'ว่างรับงาน' : 'ติดงาน'}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="assign-driver-btn"
                      onClick={assignDriver}
                      disabled={savingAssign || !assignmentDraft}
                    >
                      {savingAssign ? 'กำลังมอบหมาย...' : 'มอบหมายงาน'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="assign-driver-note">ออเดอร์นี้มีผู้รับงานแล้ว หากต้องการเปลี่ยนคนขับให้ยกเลิกมอบหมายจากขั้นตอนจัดการคนขับก่อน</p>
              )}
            </div>
          </div>
        )}

        {order.payment_method === 'promptpay' && (
          <div className="order-detail-items">
            <strong>ข้อมูลการโอน/สลิป</strong>
            <p><strong>สถานะสลิป:</strong> {order.payment_slip_status_display || order.payment_slip_status || '-'}</p>
            <p><strong>เวลาอัปโหลดสลิป:</strong> {formatDateTime(order.payment_slip_uploaded_at)}</p>
            <p><strong>เวลายืนยันสลิป:</strong> {formatDateTime(order.payment_verified_at)}</p>
            {order.payment_slip_url ? (
              <>
                <p><strong>ไฟล์สลิป:</strong></p>
                <div style={{ marginTop: '8px' }}>
                  <img
                    src={slipPreviewUrl || order.payment_slip_url}
                    alt="payment-slip"
                    style={{ maxWidth: '360px', width: '100%', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                </div>
                {canReviewSlip && (
                  <div className="product-actions-cell" style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => reviewPaymentSlip('verified')}
                      disabled={savingSlip}
                    >
                      {savingSlip ? 'กำลังบันทึก...' : 'ยืนยันสลิป'}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => reviewPaymentSlip('rejected')}
                      disabled={savingSlip}
                    >
                      {savingSlip ? 'กำลังบันทึก...' : 'ปฏิเสธสลิป'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="muted">ยังไม่มีการอัปโหลดสลิป</p>
            )}
          </div>
        )}

        <div className="order-detail-items">
          <strong>รายการสินค้า</strong>
          {(order.items || []).length === 0 ? (
            <div className="muted">ไม่มีข้อมูลรายการสินค้า</div>
          ) : (
            <>
              {(order.items || []).map((item) => (
                <div key={item.id} className="order-detail-item-row">
                  <span>{displayProductLineName(item)} x{item.quantity}</span>
                  <span>฿{Number(item.price || 0).toLocaleString()}</span>
                </div>
              ))}
            </>
          )}
          <div className="order-detail-items-total-row">
            <span>ราคาสินค้า</span>
            <strong>฿{Number(productSubtotal || 0).toLocaleString()}</strong>
          </div>
          <div className="order-detail-items-total-row">
            <span>ราคาค่าส่ง</span>
            <strong>฿{Number(deliveryFee || 0).toLocaleString()}</strong>
          </div>
          <div className="order-detail-items-total-row is-grand-total">
            <span>ราคารวม</span>
            <strong>฿{Number(orderTotal || 0).toLocaleString()}</strong>
          </div>
        </div>

        <div style={{ marginTop: '14px' }}>
          {customerId ? (
            <Link
              to={`/admin/orders?customer_id=${customerId}`}
              className="btn btn-secondary"
              style={{ marginRight: '8px' }}
            >
              ดูออเดอร์ลูกค้าคนนี้
            </Link>
          ) : null}
          {order.driver_assignment && !['delivered', 'cancelled'].includes(order.status) && (
            <Link to={`/admin/orders/${order.id}/tracking`} className="btn btn-primary" style={{ marginRight: '8px' }}>
              ติดตามคนขับ
            </Link>
          )}
          <AdminBackLink to="/admin/orders" ariaLabel="รายการคำสั่งซื้อ" />
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetail;
