import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { cartService } from '../services/api';
import { displayProductLineName } from '../utils/helpers';
import { PLACEHOLDER_IMAGES, pickLineItemImage } from '../utils/media';
import CustomerInlineBack from '../components/CustomerInlineBack';
import './Checkout.css';

const FALLBACK_IMAGE = PLACEHOLDER_IMAGES.md;

function pickItemImage(item) {
  return pickLineItemImage(item, FALLBACK_IMAGE);
}

/** ตรวจข้อมูลจัดส่ง + ชำระเงินก่อนยืนยันคำสั่งซื้อ */
function checkoutShippingIssues(shippingInfo, paymentMethod) {
  const issues = [];
  if (!(shippingInfo.name || '').trim()) issues.push('ชื่อผู้รับ');
  const digits = (shippingInfo.phone || '').replace(/\D/g, '');
  if (digits.length < 9) issues.push('เบอร์โทร (อย่างน้อย 9 หลัก)');
  if (!(shippingInfo.address || '').trim()) issues.push('ที่อยู่จัดส่ง');
  if (!(shippingInfo.district || '').trim()) issues.push('อำเภอ/เขต');
  if (!(shippingInfo.province || '').trim()) issues.push('จังหวัด');
  if (!/^\d{5}$/.test((shippingInfo.postalCode || '').trim())) issues.push('รหัสไปรษณีย์ 5 หลัก');
  // ระบบคำนวณค่าส่งตามระยะทาง ต้องมีพิกัดปลายทาง
  if (shippingInfo.latitude == null || shippingInfo.longitude == null) {
    issues.push('ไม่พบพิกัดที่อยู่ (รอให้ระบบคำนวณค่าส่งก่อน)');
  }
  if (!paymentMethod) issues.push('วิธีชำระเงิน');
  return issues;
}

/** ตรวจที่อยู่ที่บันทึกไว้ (ใช้เมื่อส่งออเดอร์ด้วย customer_address_id) */
function savedAddressIssues(addr) {
  const issues = [];
  if (!addr) issues.push('เลือกที่อยู่จัดส่ง');
  if (addr) {
    if (!(addr.recipient_name || '').trim()) issues.push('ชื่อผู้รับในที่อยู่ที่บันทึก');
    const digits = (addr.phone_number || '').replace(/\D/g, '');
    if (digits.length < 9) issues.push('เบอร์โทรในที่อยู่ที่บันทึก');
    if (!(addr.address_line || '').trim()) issues.push('ที่อยู่ในที่อยู่ที่บันทึก');
    if (!(addr.district || '').trim()) issues.push('อำเภอ/เขตในที่อยู่ที่บันทึก');
    if (!(addr.province || '').trim()) issues.push('จังหวัดในที่อยู่ที่บันทึก');
    if (!/^\d{5}$/.test((addr.postal_code || '').trim())) issues.push('รหัสไปรษณีย์ 5 หลักในที่อยู่ที่บันทึก');
    if (addr.latitude == null || addr.longitude == null) issues.push('ที่อยู่ที่บันทึกนี้ยังไม่มีพิกัดสำหรับค่าส่ง');
  }
  return issues;
}

const Checkout = () => {
  const popup = usePopup();
  const navigate = useNavigate();
  const shippingSectionRef = useRef(null);
  const [cartItems, setCartItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  /** true = แสดงฟอร์มกรอกเต็ม; false = เลือกจาก dropdown แล้วแสดงแค่สรุป */
  const [manualShippingEntry, setManualShippingEntry] = useState(true);
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    phone: '',
    address: '',
    district: '',
    province: '',
    postalCode: '',
    latitude: null,
    longitude: null,
  });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState('');
  const [deliveryFeeEstimate, setDeliveryFeeEstimate] = useState(null);
  const [deliveryDistanceEstimateKm, setDeliveryDistanceEstimateKm] = useState(null);
  const [loadingDeliveryFeeEstimate, setLoadingDeliveryFeeEstimate] = useState(false);
  const [deliveryFeeError, setDeliveryFeeError] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState(null);
  const [promptPayInfo, setPromptPayInfo] = useState(null);
  const [selectedSlipFile, setSelectedSlipFile] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  /** หลังส่งสลิปสำเร็จ — ปิดปุ่มก่อน redirect กันกดซ้ำ */
  const [paymentSlipSubmitted, setPaymentSlipSubmitted] = useState(false);

  const applyAddressToShipping = (address) => {
    if (!address) return;
    setShippingInfo((prev) => ({
      ...prev,
      name: address.recipient_name || prev.name,
      phone: address.phone_number || prev.phone,
      address: address.address_line || prev.address,
      district: address.district || prev.district,
      province: address.province || prev.province,
      postalCode: address.postal_code || prev.postalCode,
      latitude: address.latitude ?? prev.latitude,
      longitude: address.longitude ?? prev.longitude,
    }));
  };

  const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (Number(v) * Math.PI) / 180;
    const R = 6371.0;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
    return R * c;
  };

  const toFiniteNumberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const [storeOrigin, setStoreOrigin] = useState({ latitude: null, longitude: null });

  const geocodeAddressForCheckout = async (addr) => {
    const token = localStorage.getItem('auth_token');
    const payload = {
      address_line: addr?.address,
      district: addr?.district,
      province: addr?.province,
      postal_code: addr?.postalCode,
    };

    const response = await fetch(`${config.API_BASE_URL}accounts/geocode-address/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || data?.detail || 'ไม่สามารถหาพิกัดได้');
    }
    return data;
  };

  useEffect(() => {
    const loadStoreLocation = async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}orders/store-location/`, {
          method: 'GET',
          headers: { 'ngrok-skip-browser-warning': 'true' },
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        const payload = data?.store_location || data || {};
        setStoreOrigin({
          latitude: toFiniteNumberOrNull(payload.latitude),
          longitude: toFiniteNumberOrNull(payload.longitude),
        });
      } catch (e) {
        setStoreOrigin({ latitude: null, longitude: null });
      }
    };
    loadStoreLocation();
  }, []);

  // กรณี "กรอกที่อยู่เอง" ให้หาพิกัด (lat/lng) อัตโนมัติเพื่อคำนวณค่าส่งตามระยะทาง
  useEffect(() => {
    if (!manualShippingEntry) return;

    if (shippingInfo?.latitude != null && shippingInfo?.longitude != null) return;

    const pc = (shippingInfo?.postalCode || '').trim();
    const canQuery =
      (shippingInfo?.address || '').trim().length > 0 &&
      (shippingInfo?.district || '').trim().length > 0 &&
      (shippingInfo?.province || '').trim().length > 0 &&
      /^\d{5}$/.test(pc);

    if (!canQuery) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      setGeocoding(true);
      setGeocodingError(null);
      try {
        const data = await geocodeAddressForCheckout({
          address: shippingInfo.address,
          district: shippingInfo.district,
          province: shippingInfo.province,
          postalCode: shippingInfo.postalCode,
        });
        if (cancelled) return;
        setShippingInfo((prev) => ({
          ...prev,
          latitude: data?.latitude != null ? Number(data.latitude) : prev.latitude,
          longitude: data?.longitude != null ? Number(data.longitude) : prev.longitude,
        }));
      } catch (e) {
        if (cancelled) return;
        setGeocodingError(e?.message || 'ไม่สามารถหาพิกัดได้');
      } finally {
        if (cancelled) return;
        setGeocoding(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    manualShippingEntry,
    shippingInfo?.address,
    shippingInfo?.district,
    shippingInfo?.province,
    shippingInfo?.postalCode,
    shippingInfo?.latitude,
    shippingInfo?.longitude,
  ]);

  useEffect(() => {
    // Load cart items from API
    const loadCartItems = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const data = await cartService.getCart();
        const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
        const transformedItems = items.map((item) => ({
          id: item.id,
          productId: item.product_id || item.product?.id,
          name: displayProductLineName(item),
          price: Number(item.product?.price || item.price || 0),
          unitLabel: item.product?.unit_label || item.unit_label || 'ชิ้น',
          unitDetail: item.product?.unit_detail || item.unit_detail || '',
          image: pickItemImage(item),
          quantity: Number(item.quantity || 1),
          category: item.product?.category?.name || item.category || 'ทั่วไป',
        }));
        setCartItems(transformedItems);

        // Prefill shipping data from saved customer profile (if available)
        const profileResponse = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
          method: 'GET',
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          const firstName = profile?.user_info?.first_name || '';
          const lastName = profile?.user_info?.last_name || '';
          const fallbackName = profile?.user_info?.username || '';
          const fullName = `${firstName} ${lastName}`.trim() || fallbackName;

          setShippingInfo((prev) => ({
            ...prev,
            name: prev.name || fullName,
            phone: prev.phone || (profile?.phone_number || ''),
            address: prev.address || (profile?.address || ''),
          }));
        }

        const addressResponse = await fetch(`${config.API_BASE_URL}accounts/addresses/`, {
          method: 'GET',
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
        });
        if (addressResponse.ok) {
          const addressData = await addressResponse.json();
          const list = Array.isArray(addressData)
            ? addressData
            : (Array.isArray(addressData?.results) ? addressData.results : []);
          setAddresses(list);
          const defaultAddress = list.find((addr) => addr.is_default) || list[0];
          if (defaultAddress) {
            setSelectedAddressId(String(defaultAddress.id));
            applyAddressToShipping(defaultAddress);
            setManualShippingEntry(false);
          } else {
            setManualShippingEntry(true);
          }
        } else {
          setManualShippingEntry(true);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading cart:', error);
        setCartItems([]);
        setLoading(false);
      }
    };

    loadCartItems();
  }, []);

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateShipping = () => {
    if (deliveryFeeEstimate == null) return null;
    return deliveryFeeEstimate;
  };

  const calculateTotal = () => {
    const shipping = calculateShipping();
    return calculateSubtotal() + (shipping == null ? 0 : shipping);
  };

  useEffect(() => {
    const originLat = toFiniteNumberOrNull(storeOrigin?.latitude);
    const originLng = toFiniteNumberOrNull(storeOrigin?.longitude);
    const destinationLat = toFiniteNumberOrNull(shippingInfo?.latitude);
    const destinationLng = toFiniteNumberOrNull(shippingInfo?.longitude);

    setDeliveryFeeEstimate(null);
    setDeliveryDistanceEstimateKm(null);
    setDeliveryFeeError(null);
    setLoadingDeliveryFeeEstimate(false);

    if (originLat == null || originLng == null) {
      setDeliveryFeeError('ยังไม่ได้ตั้งค่าพิกัดร้านสำหรับคำนวณค่าส่ง');
      return;
    }
    if (destinationLat == null || destinationLng == null) {
      setDeliveryFeeError(
        geocoding
          ? null
          : 'ยังไม่มีพิกัดที่อยู่จัดส่งสำหรับคำนวณค่าส่ง'
      );
      return;
    }
    const distanceKm = haversineDistanceKm(
      originLat,
      originLng,
      destinationLat,
      destinationLng
    );

    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
      setDeliveryFeeEstimate(0);
      setDeliveryDistanceEstimateKm(0);
      return;
    }

    // เรียก backend เพื่อคำนวณค่าจัดส่งตาม tier (DB-configurable)
    let cancelled = false;
    setLoadingDeliveryFeeEstimate(true);

    (async () => {
      try {
        const response = await fetch(`${config.API_BASE_URL}logistics/calculate-fee/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
          body: JSON.stringify({ distance: Number(distanceKm.toFixed(2)) }),
        });
        if (!response.ok) throw new Error('calculate-fee failed');
        const data = await response.json();
        if (cancelled) return;
        setDeliveryFeeEstimate(Number(data?.delivery_fee ?? 0));
        setDeliveryDistanceEstimateKm(Number(data?.distance ?? distanceKm));
        setDeliveryFeeError(null);
      } catch (e) {
        if (cancelled) return;
        setDeliveryFeeEstimate(null);
        setDeliveryDistanceEstimateKm(null);
        setDeliveryFeeError('คำนวณค่าส่งไม่สำเร็จ กรุณาลองใหม่');
      } finally {
        if (!cancelled) setLoadingDeliveryFeeEstimate(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    storeOrigin?.latitude,
    storeOrigin?.longitude,
    shippingInfo?.latitude,
    shippingInfo?.longitude,
    geocoding,
  ]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setShippingInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectAddress = (e) => {
    const nextId = e.target.value;
    setSelectedAddressId(nextId);
    if (!nextId) {
      setManualShippingEntry(true);
      return;
    }
    setManualShippingEntry(false);
    const selected = addresses.find((addr) => String(addr.id) === String(nextId));
    applyAddressToShipping(selected);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (createdOrderId) {
      return;
    }

    const selectedSavedAddress = selectedAddressId
      ? addresses.find((a) => String(a.id) === String(selectedAddressId))
      : null;
    const useSavedAddressFlow =
      addresses.length > 0 &&
      selectedSavedAddress &&
      !manualShippingEntry;

    let issues;
    if (!selectedSavedAddress) {
      issues = ['กรุณาเลือกที่อยู่จัดส่งก่อนยืนยันคำสั่งซื้อ'];
    } else {
      issues = [];
    }
    if (useSavedAddressFlow) {
      issues = [...issues, ...savedAddressIssues(selectedSavedAddress)];
      if (!paymentMethod) issues = [...issues, 'วิธีชำระเงิน'];
    } else {
      issues = [...issues, ...checkoutShippingIssues(shippingInfo, paymentMethod)];
    }
    if (deliveryFeeEstimate == null) {
      issues = [
        ...issues,
        deliveryFeeError || 'รอให้ระบบคำนวณค่าส่งให้เสร็จก่อน',
      ];
    }

    if (issues.length) {
      popup.error(`ข้อมูลยังไม่ครบ: ${issues.join(' · ')}`);
      const goProfile = await popup.confirm(
        'ต้องการไปหน้าโปรไฟล์เพื่อกรอกชื่อ เบอร์โทร และที่อยู่จัดส่งหรือไม่?',
        {
          title: 'ยืนยันคำสั่งซื้อ',
          confirmText: 'ไปหน้าโปรไฟล์',
          cancelText: 'ปิด',
          tone: 'primary',
        },
      );
      if (goProfile) {
        navigate('/customer/profile?from=checkout');
      } else {
        shippingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');

      const selectedSaved = selectedAddressId
        ? addresses.find((a) => String(a.id) === String(selectedAddressId))
        : null;
      const useSaved =
        addresses.length > 0 &&
        selectedSaved &&
        !manualShippingEntry;

      let orderData;
      if (useSaved) {
        const recipient =
          (selectedSaved.recipient_name || '').trim() || shippingInfo.name || '';
        orderData = {
          order_type: 'delivery',
          payment_method: paymentMethod,
          customer_address_id: Number(selectedAddressId),
          delivery_notes: recipient ? `ผู้รับ: ${recipient}` : '',
          items: cartItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        };
      } else {
        const fullAddress = [shippingInfo.address, shippingInfo.district, shippingInfo.province, shippingInfo.postalCode]
          .filter(Boolean)
          .join(' ');
        orderData = {
          order_type: 'delivery',
          payment_method: paymentMethod,
          delivery_address: fullAddress,
          delivery_phone: shippingInfo.phone,
          delivery_notes: `ผู้รับ: ${shippingInfo.name}`,
          delivery_latitude: shippingInfo.latitude,
          delivery_longitude: shippingInfo.longitude,
          items: cartItems.map((item) => ({
            product_id: item.productId,
            quantity: item.quantity,
          })),
        };
      }

      const response = await fetch(`${config.API_BASE_URL}orders/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Order created:', result);
        const orderId = result?.order_id;
        const orderNumber = result?.order_number || (orderId ? `#${orderId}` : '');
        try {
          localStorage.removeItem('products_cart_quantities');
        } catch (error) {
          // ignore local storage errors
        }

        if (paymentMethod === 'promptpay') {
          if (!orderId) {
            throw new Error('ไม่พบเลขคำสั่งซื้อสำหรับสร้าง QR');
          }
          setCreatedOrderId(orderId);
          setCreatedOrderNumber(orderNumber);
          const qrResponse = await fetch(`${config.API_BASE_URL}orders/${orderId}/promptpay-qr/`, {
            method: 'POST',
            headers: {
              Authorization: `Token ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
            credentials: 'include',
          });
          const qrData = await qrResponse.json();
          if (!qrResponse.ok) {
            throw new Error(qrData?.error || qrData?.detail || 'สร้าง QR ไม่สำเร็จ');
          }
          setPromptPayInfo(qrData);
          return;
        }

        window.location.href = '/customer/orders';
      } else {
        const error = await response.json();
        throw new Error(error.detail || error.error || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ');
      }
    } catch (error) {
      console.error('Error submitting order:', error);
      popup.error('เกิดข้อผิดพลาดในการสั่งซื้อ: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadSlip = async () => {
    if (!createdOrderId || !selectedSlipFile || uploadingSlip || paymentSlipSubmitted) {
      return;
    }
    setUploadingSlip(true);
    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      formData.append('payment_slip', selectedSlipFile);
      const response = await fetch(`${config.API_BASE_URL}orders/${createdOrderId}/payment-slip/`, {
        method: 'POST',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'อัปโหลดสลิปไม่สำเร็จ');
      }
      setPaymentSlipSubmitted(true);
      popup.info('ส่งสลิปเรียบร้อย รอแอดมินตรวจสอบการชำระเงิน');
      window.location.href = '/customer/orders';
    } catch (error) {
      popup.error(error.message || 'อัปโหลดสลิปไม่สำเร็จ');
    } finally {
      setUploadingSlip(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="checkout-page">
        <div className="container">
          <div className="empty-cart">
            <h2>ไม่มีสินค้าในตะกร้า</h2>
            <Link to="/customer/products" className="btn btn-primary">
              ไปเลือกสินค้า
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const selectedSavedAddress = selectedAddressId
    ? addresses.find((a) => String(a.id) === String(selectedAddressId))
    : null;
  const useSavedAddressFlow =
    addresses.length > 0 &&
    selectedSavedAddress &&
    !manualShippingEntry;
  const hasDeliveryFee = deliveryFeeEstimate != null && !deliveryFeeError && !loadingDeliveryFeeEstimate;
  const canSubmitOrder = Boolean(paymentMethod)
    && Boolean(selectedSavedAddress)
    && hasDeliveryFee
    && !submitting
    && !createdOrderId;

  return (
    <div className="checkout-page">
      <div className="container">
        <CustomerInlineBack />
        <div className="page-header">
          <h1 className="page-title">ยืนยันคำสั่งซื้อ</h1>
          <p className="page-subtitle">ตรวจสอบข้อมูลการสั่งซื้อ</p>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form" noValidate>
          <div className="checkout-content">
            {/* Order Summary */}
            <div className="order-summary">
              <h3 className="section-title">สรุปคำสั่งซื้อ</h3>
              
              <div className="order-items">
                {cartItems.map(item => (
                  <div key={item.id} className="order-item">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="item-image"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                    <div className="item-details">
                      <h4 className="item-name">{item.name}</h4>
                      <p className="item-category">{item.category}</p>
                      <p className="item-quantity">จำนวน: {item.quantity} {item.unitLabel}{item.unitDetail ? ` (${item.unitDetail})` : ''}</p>
                    </div>
                    <div className="item-price">
                      {formatPrice(item.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="order-totals">
                <div className="total-row">
                  <span>ยอดรวมสินค้า:</span>
                  <span>{formatPrice(calculateSubtotal())}</span>
                </div>
                <div className="total-row">
                  <span>ค่าจัดส่ง:</span>
                  <span>
                    {deliveryFeeEstimate == null ? (
                      <span className="free-shipping">
                        {deliveryFeeError || geocodingError
                          ? (deliveryFeeError || geocodingError)
                          : geocoding
                            ? 'กำลังหาพิกัด...'
                            : loadingDeliveryFeeEstimate
                              ? 'กำลังคำนวณ...'
                              : 'รอข้อมูลที่อยู่'}
                      </span>
                    ) : calculateShipping() === 0 ? (
                      <span className="free-shipping">ฟรี</span>
                    ) : (
                      formatPrice(calculateShipping())
                    )}
                  </span>
                </div>
                <div className="total-row total-amount">
                  <span>ยอดรวมทั้งสิ้น:</span>
                  <span>{formatPrice(calculateTotal())}</span>
                </div>
              </div>
            </div>

            {/* Shipping Information */}
            <div className="shipping-info" ref={shippingSectionRef}>
              <h3 className="section-title">ข้อมูลการจัดส่ง</h3>

              <div className="address-book customer-form-stack">
                <div className="address-book-header">
                  <label className="form-label">เลือกที่อยู่ที่บันทึกไว้</label>
                  <Link
                    to="/customer/profile?section=addresses&from=checkout&add=1"
                    className="btn btn-outline btn-sm"
                  >
                    เพิ่มที่อยู่ในโปรไฟล์
                  </Link>
                </div>
                <p className="address-checkout-hint">
                  เพิ่มที่อยู่พร้อมแผนที่ได้ที่โปรไฟล์ — หลังบันทึกจะกลับมาหน้านี้อัตโนมัติ
                </p>
                {addresses.length > 0 ? (
                  <select
                    className="form-input"
                    value={selectedAddressId}
                    onChange={handleSelectAddress}
                  >
                    <option value="">— กรุณาเลือกที่อยู่จัดส่ง —</option>
                    {addresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {(addr.label || 'ที่อยู่')} - {addr.address_line}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="address-empty">ยังไม่มีที่อยู่ — กด «เพิ่มที่อยู่ในโปรไฟล์» ด้านบน</p>
                )}
              </div>

              {useSavedAddressFlow ? (
                <div className="saved-address-summary">
                  <p className="saved-address-summary-title">ใช้ที่อยู่ที่เลือก</p>
                  <p><strong>ชื่อผู้รับ:</strong> {selectedSavedAddress.recipient_name || '—'}</p>
                  <p><strong>เบอร์โทร:</strong> {selectedSavedAddress.phone_number || '—'}</p>
                  <p><strong>ที่อยู่:</strong> {selectedSavedAddress.address_line || '—'}</p>
                  <p>
                    <strong>อำเภอ/จังหวัด:</strong>{' '}
                    {[selectedSavedAddress.district, selectedSavedAddress.province].filter(Boolean).join(' ') || '—'}
                  </p>
                  <p><strong>รหัสไปรษณีย์:</strong> {selectedSavedAddress.postal_code || '—'}</p>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm saved-address-edit-btn"
                    onClick={() => setManualShippingEntry(true)}
                  >
                    กรอกหรือแก้ไขที่อยู่เอง
                  </button>
                </div>
              ) : (
                <div className="saved-address-summary">
                  <p className="saved-address-summary-title">ยังไม่ได้เลือกที่อยู่จัดส่ง</p>
                  <p>กรุณาเพิ่มที่อยู่ใหม่ หรือเลือกที่อยู่ที่บันทึกไว้ก่อนสั่งซื้อ</p>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="payment-method">
              <h3 className="section-title">วิธีการชำระเงิน</h3>
              
              <div className="payment-options">
                <label className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="promptpay"
                    checked={paymentMethod === 'promptpay'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-info">
                    <div className="payment-icon">📱</div>
                    <div>
                      <h4>QR Code</h4>
                      <p>ชำระผ่านการสแกน QR</p>
                    </div>
                  </div>
                </label>

                <label className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-info">
                    <div className="payment-icon">💳</div>
                    <div>
                      <h4>ชำระปลายทาง</h4>
                      <p>ชำระเงินเมื่อได้รับสินค้า</p>
                    </div>
                  </div>
                </label>
              </div>

              {createdOrderId && paymentMethod === 'promptpay' && (
                <div className="promptpay-box">
                  <h4>สแกนเพื่อชำระเงิน</h4>
                  <p>คำสั่งซื้อ {createdOrderNumber || `#${createdOrderId}`}</p>
                  <p>พร้อมเพย์: {promptPayInfo?.promptpay_number || '-'}</p>
                  <p>ยอดชำระ: {formatPrice(Number(promptPayInfo?.amount || calculateTotal()))}</p>
                  {promptPayInfo?.qr_image ? (
                    <img src={promptPayInfo.qr_image} alt="PromptPay QR Code" className="promptpay-qr-image" />
                  ) : (
                    <p>ไม่สามารถแสดง QR Code ได้</p>
                  )}

                  <div className="slip-upload">
                    <label className="form-label">อัปโหลดสลิปยืนยันการชำระเงิน</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="form-input"
                      disabled={uploadingSlip || paymentSlipSubmitted}
                      onChange={(e) => setSelectedSlipFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!selectedSlipFile || uploadingSlip || paymentSlipSubmitted}
                      onClick={handleUploadSlip}
                    >
                      {paymentSlipSubmitted
                        ? 'ส่งสลิปแล้ว'
                        : uploadingSlip
                          ? 'กำลังอัปโหลด...'
                          : 'ยืนยันการชำระด้วยสลิป'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="checkout-actions">
            {!createdOrderId ? (
              <>
                <Link to="/customer/cart" className="btn btn-secondary">
                  กลับไปแก้ไขตะกร้า
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!canSubmitOrder}
                >
                  {submitting ? 'กำลังดำเนินการ...' : 'ยืนยันคำสั่งซื้อ'}
                </button>
              </>
            ) : (
              <Link to="/customer/orders" className="btn btn-secondary">
                ดูคำสั่งซื้อของฉัน
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;

