import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import config from '../config';
import { displayProductLineName } from '../utils/helpers';
import { PLACEHOLDER_IMAGES, pickLineItemImage } from '../utils/media';
import { usePopup } from '../components/PopupProvider';
import CustomerInlineBack from '../components/CustomerInlineBack';
import './OrderDetail.css';

const OrderDetail = () => {
  const popup = usePopup();
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlipFile, setSelectedSlipFile] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [deletingSlip, setDeletingSlip] = useState(false);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState('');
  const [promptPayInfo, setPromptPayInfo] = useState(null);
  const [loadingPromptPayQr, setLoadingPromptPayQr] = useState(false);
  const [receiptSlipOpen, setReceiptSlipOpen] = useState(false);

  const fetchOrder = useCallback(async ({ silent = false } = {}) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}orders/${orderId}/`, {
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        if (!silent) {
          throw new Error('ไม่พบคำสั่งซื้อ');
        }
        return;
      }
      const data = await response.json();
      setOrder(data);
    } catch (error) {
      if (!silent) {
        setOrder(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    fetchOrder();
  }, [orderId, fetchOrder]);

  /** แอดมินยืนยันสลิปแล้ว — ลูกค้าต้องเห็นใบเสร็จทันทีหลังข้อมูลอัปเดต (โหลดครั้งเดียวไม่พอ) */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchOrder({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [fetchOrder]);

  /** รอสถานะสลิปจากแอดมิน — ดึงซ้ำเป็นระยะจน verified หรือยกเลิก */
  useEffect(() => {
    if (!order) return;
    if (String(order.payment_method || '').toLowerCase() !== 'promptpay') return;
    if (String(order.payment_slip_status || '').toLowerCase() === 'verified') return;
    if (order.status === 'cancelled') return;

    const t = setInterval(() => fetchOrder({ silent: true }), 12000);
    return () => clearInterval(t);
  }, [
    order?.id,
    order?.payment_method,
    order?.payment_slip_status,
    order?.status,
    fetchOrder,
  ]);

  useEffect(() => {
    if (!receiptSlipOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setReceiptSlipOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receiptSlipOpen]);

  useEffect(() => {
    if (!receiptSlipOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [receiptSlipOpen]);

  useEffect(() => {
    let objectUrl = '';
    const loadSlipPreview = async () => {
      if (!order?.payment_slip_url) {
        setSlipPreviewUrl('');
        return;
      }
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(order.payment_slip_url, {
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (!response.ok) throw new Error('โหลดรูปสลิปไม่สำเร็จ');
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setSlipPreviewUrl(objectUrl);
      } catch (error) {
        setSlipPreviewUrl(order.payment_slip_url);
      }
    };
    loadSlipPreview();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [order?.payment_slip_url]);

  const formatPrice = (price) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(price || 0));
  const formatDate = (dateString) => new Date(dateString).toLocaleString('th-TH');
  const hasSlip = Boolean(order?.payment_slip_url);
  const pm = String(order?.payment_method || '').toLowerCase();
  const slipSt = String(order?.payment_slip_status || '').toLowerCase();
  const isPromptPayOrder = pm === 'promptpay';
  const slipVerified = slipSt === 'verified';
  const slipNotRequired = slipSt === 'not_required';
  const canUploadSlip = isPromptPayOrder
    && !hasSlip
    && !slipVerified
    && !slipNotRequired
    && !['delivered', 'cancelled'].includes(order?.status);
  const canDeleteSlip = isPromptPayOrder
    && hasSlip
    && !slipVerified
    && !['delivered', 'cancelled'].includes(order?.status);
  const canShowPromptPayQr = isPromptPayOrder
    && !hasSlip
    && !['delivered', 'cancelled'].includes(order?.status)
    && !slipVerified
    && !slipNotRequired;
  const receiptReady = Boolean(order) && (
    (isPromptPayOrder && slipVerified)
    || (!isPromptPayOrder && order.status === 'delivered')
  );
  const receiptIssuedAt = order?.payment_verified_at || (order?.status === 'delivered' ? order?.updated_at : null);
  const receiptNo = order?.order_number ? `${order.order_number}-R` : `RCPT-${order?.id || ''}`;
  const customerName = (order?.customer_name || '').trim() || 'ลูกค้า';

  const loadPromptPayQr = async () => {
    if (!order?.id || !canShowPromptPayQr) {
      setPromptPayInfo(null);
      return;
    }
    setLoadingPromptPayQr(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}orders/${order.id}/promptpay-qr/`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'โหลด QR พร้อมเพย์ไม่สำเร็จ');
      }
      setPromptPayInfo(data);
    } catch (error) {
      setPromptPayInfo(null);
      popup.error(error.message || 'โหลด QR พร้อมเพย์ไม่สำเร็จ');
    } finally {
      setLoadingPromptPayQr(false);
    }
  };

  useEffect(() => {
    loadPromptPayQr();
  }, [order?.id, canShowPromptPayQr]);

  const handleDownloadQr = async () => {
    if (!promptPayInfo?.qr_image || !order?.id) {
      popup.error('ไม่พบรูป QR สำหรับดาวน์โหลด');
      return;
    }
    try {
      const response = await fetch(promptPayInfo.qr_image, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!response.ok) {
        throw new Error('ดาวน์โหลดรูป QR ไม่สำเร็จ');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `promptpay-order-${order.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      popup.info('บันทึก QR ลงเครื่องเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'ดาวน์โหลดรูป QR ไม่สำเร็จ');
    }
  };

  const handleUploadSlip = async () => {
    if (!selectedSlipFile || !order || uploadingSlip) {
      if (!uploadingSlip && !selectedSlipFile) {
        popup.info('กรุณาเลือกไฟล์สลิปก่อน');
      }
      return;
    }
    setUploadingSlip(true);
    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('payment_slip', selectedSlipFile);

      const response = await fetch(`${config.API_BASE_URL}orders/${order.id}/payment-slip/`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'ngrok-skip-browser-warning': 'true',
        },
        body: formData,
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'อัปโหลดสลิปไม่สำเร็จ');
      }

      setOrder((prev) => ({
        ...prev,
        payment_slip_status: data?.payment_slip_status || 'uploaded',
        payment_slip_status_display: data?.payment_slip_status_display || prev?.payment_slip_status_display,
        payment_slip_url: data?.payment_slip_url || prev?.payment_slip_url,
        payment_slip_uploaded_at: data?.payment_slip_uploaded_at || prev?.payment_slip_uploaded_at,
      }));
      setSelectedSlipFile(null);
      popup.info(data?.message || 'ส่งสลิปเรียบร้อยแล้ว');
    } catch (error) {
      popup.error(error.message || 'อัปโหลดสลิปไม่สำเร็จ');
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleDeleteSlip = async () => {
    if (!order) return;
    if (!(await popup.confirm('ยืนยันลบสลิปนี้เพื่ออัปโหลดใหม่?', { tone: 'danger', confirmText: 'ลบสลิป' }))) return;
    setDeletingSlip(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}orders/${order.id}/payment-slip/`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'ลบสลิปไม่สำเร็จ');
      }
      setOrder((prev) => ({
        ...prev,
        payment_slip_status: data?.payment_slip_status || 'pending',
        payment_slip_status_display: data?.payment_slip_status_display || 'รออัปโหลด',
        payment_slip_url: null,
        payment_slip_uploaded_at: null,
        payment_verified_at: null,
      }));
      setSelectedSlipFile(null);
      setSlipPreviewUrl('');
      popup.info(data?.message || 'ลบสลิปเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'ลบสลิปไม่สำเร็จ');
    } finally {
      setDeletingSlip(false);
    }
  };

  if (loading) return <div className="loading">กำลังโหลดรายละเอียดคำสั่งซื้อ...</div>;

  if (!order) {
    return (
      <div className="orders-page">
        <div className="container">
          <CustomerInlineBack />
          <div className="empty-orders">
            <h3>ไม่พบคำสั่งซื้อ</h3>
            <Link to="/customer/orders" className="btn btn-primary">กลับหน้าคำสั่งซื้อ</Link>
          </div>
        </div>
      </div>
    );
  }

  const itemsSubtotalSum = (order.items || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  const displaySubtotal =
    order.subtotal != null && order.subtotal !== ''
      ? Number(order.subtotal)
      : itemsSubtotalSum;

  const itemPieces = (order.items || []).reduce((s, item) => s + Number(item.quantity || 0), 0);
  const slipDateLine = (() => {
    const d = new Date(receiptIssuedAt || order.created_at);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  })();

  return (
    <div className="orders-page">
      <div className="container">
        <CustomerInlineBack className="order-detail-no-print" />
        <div className="page-header order-detail-no-print">
          <h1 className="page-title">คำสั่งซื้อ {order.order_number || `#${order.id}`}</h1>
        </div>

        <div className="order-card order-detail-no-print">
          <div className="detail-meta">
            <p><strong>หมายเลขคำสั่งซื้อ:</strong> {order.order_number || `#${order.id}`}</p>
            <p><strong>วันที่สั่งซื้อ:</strong> {formatDate(order.created_at)}</p>
            <p><strong>วิธีชำระเงิน:</strong> {order.payment_method_display || order.payment_method}</p>
            <p><strong>ประเภทคำสั่งซื้อ:</strong> {order.order_type_display || '—'}</p>
            <p>
              <strong>{order.order_type === 'pickup' ? 'การรับสินค้า / ที่อยู่ร้าน:' : 'ที่อยู่จัดส่ง:'}</strong>{' '}
              {order.delivery_address || '-'}
            </p>
            <p><strong>เบอร์โทรติดต่อ:</strong> {order.delivery_phone || '-'}</p>
            {order.payment_method === 'promptpay' && (
              <p><strong>สถานะสลิป:</strong> {order.payment_slip_status_display || order.payment_slip_status}</p>
            )}
            {order.driver_assignment && order.order_type !== 'pickup' && (
              <>
                <p><strong>คนขับ:</strong> {order.driver_assignment.driver_name || '-'}</p>
                <p><strong>สถานะจัดส่ง:</strong> {order.driver_assignment.status_display || order.driver_assignment.status}</p>
              </>
            )}
          </div>

          {canUploadSlip && (
            <div className="slip-upload-box">
              <p><strong>อัปโหลดสลิปย้อนหลัง</strong></p>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingSlip}
                onChange={(e) => setSelectedSlipFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleUploadSlip}
                disabled={uploadingSlip || !selectedSlipFile}
              >
                {uploadingSlip ? 'กำลังอัปโหลด...' : 'ส่งสลิป'}
              </button>
            </div>
          )}

          {canShowPromptPayQr && (
            <div className="slip-upload-box">
              <p><strong>QR พร้อมเพย์สำหรับชำระเงิน</strong></p>
              {loadingPromptPayQr ? (
                <p className="upload-hint">กำลังโหลด QR...</p>
              ) : promptPayInfo?.qr_image ? (
                <>
                  <p><strong>พร้อมเพย์:</strong> {promptPayInfo.promptpay_number || '-'}</p>
                  <p><strong>ยอดชำระ:</strong> {formatPrice(Number(promptPayInfo.amount || order?.total_amount || 0))}</p>
                  <img
                    src={promptPayInfo.qr_image}
                    alt="promptpay-qr"
                    className="promptpay-qr-image"
                  />
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={loadPromptPayQr}>
                      โหลด QR ใหม่
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadQr}>
                      บันทึก QR ลงเครื่อง
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className="btn btn-outline btn-sm" onClick={loadPromptPayQr}>
                  โหลด QR อีกครั้ง
                </button>
              )}
            </div>
          )}

          {order.payment_method === 'promptpay' && hasSlip && (
            <div className="slip-upload-box">
              <p><strong>สลิปที่อัปโหลด</strong></p>
              <img
                src={slipPreviewUrl || order.payment_slip_url}
                alt="payment-slip"
                className="slip-preview-image"
              />
              {canDeleteSlip && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeleteSlip}
                  disabled={deletingSlip}
                >
                  {deletingSlip ? 'กำลังลบ...' : 'ลบสลิปเพื่ออัปใหม่'}
                </button>
              )}
            </div>
          )}

          <div className="order-items order-detail-items">
            {(order.items || []).map((item) => (
              <div key={item.id} className="order-item order-detail-item-row">
                <img
                  src={pickLineItemImage(item, PLACEHOLDER_IMAGES.sm)}
                  alt=""
                  className="order-detail-thumb"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER_IMAGES.sm;
                  }}
                />
                <div className="item-details">
                  <h4 className="item-name">{displayProductLineName(item)}</h4>
                  <p className="item-quantity">จำนวน: {item.quantity}</p>
                </div>
                <div className="item-price">{formatPrice(Number(item.price) * Number(item.quantity))}</div>
              </div>
            ))}
          </div>

          <div className="order-footer order-detail-footer">
            <div className="order-detail-price-summary" aria-label="สรุปราคา">
              <div className="order-detail-price-row">
                <span>ราคาสินค้า</span>
                <strong>{formatPrice(displaySubtotal)}</strong>
              </div>
              <div className="order-detail-price-row">
                <span>{order.order_type === 'pickup' ? 'ค่าจัดส่ง (รับที่ร้าน)' : 'ค่าจัดส่ง'}</span>
                <strong>{formatPrice(order.delivery_fee)}</strong>
              </div>
              <div className="order-detail-price-row order-detail-price-row--total">
                <span>ราคารวม</span>
                <strong>{formatPrice(order.total_amount)}</strong>
              </div>
            </div>
            <div className="order-footer-actions">
              {order.driver_assignment && !['delivered', 'cancelled'].includes(order.status) && (
                <Link to={`/customer/tracking/${order.id}`} className="btn btn-primary btn-sm">ติดตามคนขับ</Link>
              )}
              <Link to="/customer/orders" className="btn btn-secondary btn-sm">กลับหน้าคำสั่งซื้อ</Link>
            </div>
          </div>
        </div>

        <div className="order-card receipt-card order-detail-no-print">
          <div className="receipt-header">
            <h2 className="receipt-title">ใบเสร็จรับเงิน</h2>
            <span className={`receipt-status ${receiptReady ? 'ready' : 'pending'}`}>
              {receiptReady ? 'ออกใบเสร็จแล้ว' : 'ยังไม่พร้อมออกใบเสร็จ'}
            </span>
          </div>

          {receiptReady && (
            <button
              type="button"
              className="btn btn-primary receipt-slip-open-btn"
              onClick={() => setReceiptSlipOpen(true)}
            >
              ดูใบเสร็จ
            </button>
          )}
        </div>

        {receiptSlipOpen && receiptReady && (
          <div
            className="receipt-slip-backdrop"
            role="presentation"
            onClick={() => setReceiptSlipOpen(false)}
          >
            <div
              className="receipt-slip-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="receipt-slip-heading"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="receipt-slip-close"
                aria-label="ปิด"
                onClick={() => setReceiptSlipOpen(false)}
              >
                ×
              </button>

              <div className="receipt-slip-paper">
                <p id="receipt-slip-heading" className="receipt-slip-store">
                  {config.BRANDING.storeName}
                </p>
                <p className="receipt-slip-doc-title">ใบเสร็จรับเงิน</p>
                <div className="receipt-slip-datetime">{slipDateLine}</div>
                <div className="receipt-slip-ref">
                  <span>เลขที่ใบเสร็จ {receiptNo}</span>
                  <span>ออเดอร์ {order.order_number || `#${order.id}`}</span>
                </div>

                <div className="receipt-slip-divider" />

                <p className="receipt-slip-section-label">รายการสินค้า</p>
                <ul className="receipt-slip-lines">
                  {(order.items || []).map((item) => (
                    <li key={`slip-${item.id}`}>
                      <span className="receipt-slip-line-name">
                        {item.quantity} {displayProductLineName(item)}
                      </span>
                      <span className="receipt-slip-line-price">
                        {formatPrice(Number(item.price) * Number(item.quantity))}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="receipt-slip-divider dashed" />

                <div className="receipt-slip-net">
                  <span>ยอดสุทธิ {itemPieces} ชิ้น</span>
                  <strong>{formatPrice(order.total_amount)}</strong>
                </div>

                <div className="receipt-slip-pay-row">
                  <span>{order.payment_method_display || order.payment_method}</span>
                  <span>{formatPrice(order.total_amount)}</span>
                </div>

                <div className="receipt-slip-rows-compact">
                  <div><span>ค่าสินค้า</span><span>{formatPrice(order.subtotal)}</span></div>
                  <div><span>ค่าจัดส่ง</span><span>{formatPrice(order.delivery_fee)}</span></div>
                  <div className="emph"><span>รวมสุทธิ</span><span>{formatPrice(order.total_amount)}</span></div>
                </div>

                <div className="receipt-slip-divider" />

                <div className="receipt-slip-customer">
                  <span>ลูกค้า</span>
                  <span>{customerName}</span>
                </div>

                <div className="receipt-slip-zigzag" aria-hidden />
              </div>

              <div className="receipt-slip-modal-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm receipt-slip-close-action"
                  onClick={() => setReceiptSlipOpen(false)}
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetail;
