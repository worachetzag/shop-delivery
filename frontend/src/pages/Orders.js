import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import config from '../config';
import ApiPaginationBar from '../components/ApiPaginationBar';
import { usePopup } from '../components/PopupProvider';
import { PLACEHOLDER_IMAGES, pickLineItemImage } from '../utils/media';
import { displayProductLineName } from '../utils/helpers';
import './Orders.css';

const PAGE_SIZE = 10;

function canCancelAwaitingProofOrder(order) {
  return (
    order.paymentMethod === 'promptpay'
    && order.paymentSlipStatus !== 'verified'
    && !['delivered', 'cancelled'].includes(order.status)
  );
}

const Orders = () => {
  const popup = usePopup();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('page_size', String(PAGE_SIZE));
        if (filter === 'preparing') {
          params.set('status', 'preparing');
        } else if (filter === 'out_for_delivery') {
          params.set('group', 'shipping');
        } else if (filter === 'delivered') {
          params.set('status', 'delivered');
        }

        const response = await fetch(`${config.API_BASE_URL}orders/list/?${params.toString()}`, {
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const sourceOrders = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
              ? data.results
              : [];
          const transformedOrders = sourceOrders.map((order) => {
            const items = order.items || order.order_items || [];
            const firstItem = items[0] || null;
            const previewImage = firstItem ? pickLineItemImage(firstItem, PLACEHOLDER_IMAGES.sm) : PLACEHOLDER_IMAGES.sm;
            const previewLines = items.map((line) => {
              const name = displayProductLineName(line);
              const q = Number(line.quantity || 0);
              return `${name} x${q}`;
            });
            const previewThumbs = items.map((line) => pickLineItemImage(line, PLACEHOLDER_IMAGES.sm));
            return {
            id: order.id,
            orderNumber: order.order_number || `#${order.id}`,
            date: order.created_at,
            status: order.status,
            statusDisplay: order.status_display,
            paymentMethod: order.payment_method,
            paymentSlipStatus: order.payment_slip_status,
            paymentSlipStatusDisplay: order.payment_slip_status_display,
            subtotal: Number(order.subtotal || 0),
            deliveryFee: Number(order.delivery_fee || 0),
            receiptReady:
              (order.payment_method === 'promptpay' && order.payment_slip_status === 'verified')
              || (order.payment_method !== 'promptpay' && order.status === 'delivered'),
            total: Number(order.total_amount || order.total_price || 0),
            itemCount: items.length,
            totalQuantity: items.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0
            ),
            trackingNumber: order.tracking_number || null,
            previewItemName: firstItem ? displayProductLineName(firstItem) : 'ไม่มีรายการสินค้า',
            previewImage,
            previewLines,
            previewThumbs,
          };
          });
          setOrders(transformedOrders);
          setTotalCount(typeof data.count === 'number' ? data.count : transformedOrders.length);
        } else {
          setOrders([]);
          setTotalCount(0);
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setOrders([]);
        setTotalCount(0);
        setLoading(false);
      }
    };

    fetchOrders();
  }, [page, filter]);

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'รอดำเนินการ',
      confirmed: 'ยืนยันคำสั่งซื้อ',
      preparing: 'กำลังเตรียมสินค้า',
      ready: 'พร้อมจัดส่ง',
      out_for_delivery: 'กำลังจัดส่ง',
      delivering: 'กำลังจัดส่ง',
      delivered: 'จัดส่งแล้ว',
      cancelled: 'ยกเลิก',
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      pending: '#6c757d',
      confirmed: '#20c997',
      preparing: '#ffc107',
      ready: '#0d6efd',
      out_for_delivery: '#17a2b8',
      delivering: '#17a2b8',
      delivered: '#28a745',
      cancelled: '#dc3545',
    };
    return colorMap[status] || '#6c757d';
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleCancelAwaitingProof = async (orderId) => {
    if (cancellingOrderId) return;
    if (!(await popup.confirm(
      'ยกเลิกคำสั่งซื้อนี้? เมื่อยืนยันแล้วจะไม่สามารถชำระด้วยออเดอร์เดิมได้ และสต็อกที่จองไว้จะคืนเข้าร้าน (หากมี)',
      { tone: 'danger', confirmText: 'ยกเลิกออเดอร์' },
    ))) return;
    setCancellingOrderId(orderId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}orders/${orderId}/cancel-awaiting-payment-proof/`, {
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
        throw new Error(data?.error || 'ยกเลิกออเดอร์ไม่สำเร็จ');
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      setTotalCount((c) => Math.max(0, c - 1));
      popup.info(data?.message || 'ยกเลิกคำสั่งซื้อเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'ยกเลิกออเดอร์ไม่สำเร็จ');
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        กำลังโหลดคำสั่งซื้อ...
      </div>
    );
  }

  if (totalCount === 0 && page === 1) {
    const isAll = filter === 'all';
    return (
      <div className="orders-page">
        <div className="container">
          <div className="page-header">
            <h1 className="page-title">คำสั่งซื้อของฉัน</h1>
          </div>

          <div className="empty-orders">
            <div className="empty-orders-icon">📦</div>
            <h3>{isAll ? 'ยังไม่มีคำสั่งซื้อ' : 'ไม่มีคำสั่งซื้อในหมวดนี้'}</h3>
            <p>{isAll ? 'เริ่มต้นการช้อปปิ้งของคุณ' : 'ลองเลือกแท็บอื่นหรือดูทั้งหมด'}</p>
            {isAll ? (
              <Link to="/customer/products" className="btn btn-primary">
                ดูสินค้า
              </Link>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setFilter('all')}>
                ดูทั้งหมด
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">คำสั่งซื้อของฉัน</h1>
        </div>

        <div className="filter-tabs">
          <button
            type="button"
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'preparing' ? 'active' : ''}`}
            onClick={() => setFilter('preparing')}
          >
            กำลังเตรียม
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'out_for_delivery' ? 'active' : ''}`}
            onClick={() => setFilter('out_for_delivery')}
          >
            พร้อมส่ง / กำลังส่ง
          </button>
          <button
            type="button"
            className={`filter-tab ${filter === 'delivered' ? 'active' : ''}`}
            onClick={() => setFilter('delivered')}
          >
            จัดส่งแล้ว
          </button>
        </div>

        <div className="orders-list">
          {orders.map((order) => (
            <div
              key={order.id}
              className={`order-card order-card-clickable${order.status === 'cancelled' ? ' order-card--cancelled' : ''}`}
              onClick={() => navigate(`/customer/orders/${order.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/customer/orders/${order.id}`);
                }
              }}
            >
              <div className="order-header order-list-row order-card-top">
                <div className="order-info">
                  <h3 className="order-id">{order.orderNumber}</h3>
                </div>
                <p className="order-date">{formatDate(order.date)}</p>
              </div>
              <div className="order-preview-row">
                <div
                  className={`order-preview-visual ${order.itemCount > 1 ? 'order-preview-visual--multi' : ''}`}
                >
                  {order.itemCount <= 1 ? (
                    <img
                      src={order.previewImage}
                      alt={order.previewItemName}
                      className="order-preview-image"
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER_IMAGES.sm;
                      }}
                    />
                  ) : (
                    <div className={`order-preview-grid order-preview-grid--${Math.min(order.itemCount, 4)}`}>
                      {order.previewThumbs.slice(0, 4).map((src, idx) => (
                        <div
                          key={`${order.id}-thumb-${idx}`}
                          className="order-preview-cell"
                        >
                          <img
                            src={src}
                            alt=""
                            className="order-preview-cell-img"
                            onError={(e) => {
                              e.currentTarget.src = PLACEHOLDER_IMAGES.sm;
                            }}
                          />
                          {idx === 3 && order.itemCount > 4 && (
                            <div className="order-preview-more-on-grid" title={`อีก ${order.itemCount - 4} รายการ`}>
                              +{order.itemCount - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="order-preview-center">
                  {order.itemCount <= 1 ? (
                    <p className="order-preview-name">{order.previewItemName}</p>
                  ) : (
                    <>
                      {order.previewLines.slice(0, 2).map((line, idx) => (
                        <p key={`${order.id}-line-${idx}`} className="order-preview-name order-preview-line">
                          {line}
                        </p>
                      ))}
                      {order.itemCount > 2 && (
                        <p className="order-preview-extra">+ อีก {order.itemCount - 2} รายการ</p>
                      )}
                    </>
                  )}
                  <p className="order-preview-count-line">
                    {order.itemCount} รายการสินค้า
                    {order.totalQuantity > order.itemCount && (
                      <span className="order-qty-hint"> · สั่งรวม {order.totalQuantity} ชิ้น</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="order-card-under-items">
                <p className="order-price-split">
                  <span>ค่าสินค้า {formatPrice(order.subtotal)}</span>
                  <span className="order-price-split-dot">·</span>
                  <span>ค่าส่ง {formatPrice(order.deliveryFee)}</span>
                </p>
                <div className="order-meta-inline">
                  <span className="order-meta-total">รวม {formatPrice(order.total)}</span>
                  <span
                    className="status-badge order-meta-status"
                    style={{ backgroundColor: getStatusColor(order.status) }}
                  >
                    {order.statusDisplay || getStatusText(order.status)}
                  </span>
                  {order.status !== 'cancelled' && (
                    <span className={`receipt-badge ${order.receiptReady ? 'ready' : 'pending'}`}>
                      {order.receiptReady ? 'ใบเสร็จพร้อม' : 'รอออกใบเสร็จ'}
                    </span>
                  )}
                </div>
                {canCancelAwaitingProofOrder(order) && (
                  <div className="order-card-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm order-list-cancel-proof-btn"
                      disabled={cancellingOrderId === order.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelAwaitingProof(order.id);
                      }}
                    >
                      {cancellingOrderId === order.id ? 'กำลังยกเลิก...' : 'ยกเลิกออเดอร์'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="no-orders">
            <div className="no-orders-icon">🔍</div>
            <h3>ไม่พบคำสั่งซื้อในหน้านี้</h3>
            <p>ลองเปลี่ยนตัวกรองหรือเลือกหน้าถัดไป</p>
          </div>
        )}

        <ApiPaginationBar count={totalCount} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
};

export default Orders;
