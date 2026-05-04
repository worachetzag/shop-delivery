import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import { cartService } from '../services/api';
import { displayProductLineName, saveImageToDevice } from '../utils/helpers';
import { PLACEHOLDER_IMAGES, pickLineItemImage } from '../utils/media';
import CustomerInlineBack from '../components/CustomerInlineBack';
import AddressPicker from '../components/AddressPicker';
import { clampPhoneTen, formatMobileTenDisplay } from '../utils/thaiFormInputs';
import { getServiceHoursStatus } from '../utils/serviceHours';
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
  if (digits.length !== 10) issues.push('เบอร์โทรผู้รับ 10 หลัก');
  if (!(shippingInfo.address || '').trim()) issues.push('ที่อยู่จัดส่ง');
  if (!(shippingInfo.district || '').trim()) issues.push('อำเภอ/เขต');
  if (!(shippingInfo.province || '').trim()) issues.push('จังหวัด');
  if (!/^\d{5}$/.test((shippingInfo.postalCode || '').trim())) issues.push('รหัสไปรษณีย์ 5 หลัก');
  // ระบบคำนวณค่าส่งตามระยะทาง ต้องมีพิกัดปลายทาง
  if (shippingInfo.latitude == null || shippingInfo.longitude == null) {
    issues.push('ปักหมุดบนแผนที่ หรือกรอกที่อยู่ให้ครบเพื่อให้มีพิกัดคำนวณค่าส่ง');
  }
  if (!paymentMethod) issues.push('วิธีชำระเงิน');
  return issues;
}

/** ตรวจเมื่อเลือกรับที่ร้าน — ไม่ต้องมีที่อยู่จัดส่ง */
function checkoutPickupIssues(shippingInfo, paymentMethod) {
  const issues = [];
  if (!(shippingInfo.name || '').trim()) issues.push('ชื่อผู้มารับ');
  const digits = (shippingInfo.phone || '').replace(/\D/g, '');
  if (digits.length !== 10) issues.push('เบอร์โทรติดต่อ 10 หลัก');
  if (!paymentMethod) issues.push('วิธีชำระเงิน');
  return issues;
}

const Checkout = () => {
  const popup = usePopup();
  const navigate = useNavigate();
  const shippingSectionRef = useRef(null);
  const [cartItems, setCartItems] = useState([]);
  const [shippingInfo, setShippingInfo] = useState({
    name: '',
    phone: '',
    address: '',
    district: '',
    province: '',
    postalCode: '',
    latitude: null,
    longitude: null,
    notes: '',
  });
  /** 'delivery' | 'pickup' */
  const [fulfillmentMode, setFulfillmentMode] = useState('delivery');
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
  const [storeListing, setStoreListing] = useState({ name: '', address: '' });
  /** จาก GET orders/store-location/ — ใช้บังคับช่วงเปิดรับคำสั่ง */
  const [serviceHours, setServiceHours] = useState(null);
  /** รีเฟรชสถานะเปิด/ปิดทุกนาที (ข้ามเที่ยงคืน) */
  const [hoursTick, setHoursTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setHoursTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

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
        setStoreListing({
          name: (payload.name || '').trim(),
          address: (payload.address || '').trim(),
        });
        setServiceHours(payload.service_hours ?? data?.service_hours ?? null);
      } catch (e) {
        setStoreOrigin({ latitude: null, longitude: null });
        setStoreListing({ name: '', address: '' });
      }
    };
    loadStoreLocation();
  }, []);

  // จัดส่ง: หาพิกัดจากที่อยู่ที่กรอกในหน้านี้ (กรอกใหม่ทุกครั้ง — ไม่ดึงจากโปรไฟล์)
  useEffect(() => {
    if (fulfillmentMode !== 'delivery') return;

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
    fulfillmentMode,
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
            phone: prev.phone || clampPhoneTen(String(profile?.phone_number || '')),
          }));
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
    if (fulfillmentMode === 'pickup') {
      setDeliveryFeeEstimate(0);
      setDeliveryDistanceEstimateKm(null);
      setDeliveryFeeError(null);
      setLoadingDeliveryFeeEstimate(false);
      return undefined;
    }

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
    fulfillmentMode,
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
    let v = value;
    if (name === 'phone') v = clampPhoneTen(value);
    if (name === 'postalCode') v = String(value || '').replace(/\D/g, '').slice(0, 5);
    setShippingInfo((prev) => ({
      ...prev,
      [name]: v,
    }));
  };

  const handleDeliveryMapLocation = (lat, lon) => {
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return;
    setShippingInfo((prev) => ({
      ...prev,
      latitude: la,
      longitude: lo,
    }));
    setGeocodingError(null);
  };

  const handleDeliveryMapAddress = (addressData) => {
    if (!addressData || typeof addressData !== 'object') return;
    setShippingInfo((prev) => ({
      ...prev,
      address: (addressData.address && String(addressData.address).trim()) || prev.address,
      district: (addressData.district && String(addressData.district).trim()) || prev.district,
      province: (addressData.province && String(addressData.province).trim()) || prev.province,
      postalCode: addressData.postalCode
        ? String(addressData.postalCode).replace(/\D/g, '').slice(0, 5)
        : prev.postalCode,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (createdOrderId) {
      return;
    }

    let issues = [];
    if (fulfillmentMode === 'pickup') {
      issues = [...checkoutPickupIssues(shippingInfo, paymentMethod)];
    } else {
      issues = [...checkoutShippingIssues(shippingInfo, paymentMethod)];
    }

    if (fulfillmentMode === 'delivery' && deliveryFeeEstimate == null) {
      issues.push(deliveryFeeError || 'รอให้ระบบคำนวณค่าส่งให้เสร็จก่อน');
    }

    const submitMode = fulfillmentMode === 'pickup' ? 'pickup' : 'delivery';
    const submitHours = getServiceHoursStatus(serviceHours, submitMode);
    if (!submitHours.open && submitHours.message) {
      issues.push(submitHours.message);
    }

    if (issues.length) {
      popup.error(`ข้อมูลยังไม่ครบ: ${issues.join(' · ')}`);
      const goProfile = await popup.confirm(
        fulfillmentMode === 'pickup'
          ? 'ต้องการไปหน้าโปรไฟล์เพื่อกรอกชื่อและเบอร์โทรหรือไม่?'
          : 'ต้องการไปหน้าโปรไฟล์เพื่อแก้ชื่อหรือเบอร์ในบัญชีหรือไม่? (ที่อยู่จัดส่งกรอกในหน้านี้ทุกครั้ง)',
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

      let orderData;
      if (fulfillmentMode === 'pickup') {
        const storeLine = ['รับที่ร้าน', storeListing.name, storeListing.address].filter(Boolean).join(' — ');
        const noteParts = [];
        if ((shippingInfo.name || '').trim()) noteParts.push(`ผู้มารับ: ${(shippingInfo.name || '').trim()}`);
        if ((shippingInfo.notes || '').trim()) noteParts.push((shippingInfo.notes || '').trim());
        orderData = {
          order_type: 'pickup',
          payment_method: paymentMethod,
          delivery_address: storeLine || 'รับที่ร้าน',
          delivery_phone: clampPhoneTen(shippingInfo.phone),
          delivery_notes: noteParts.join(' · ') || 'รับสินค้าที่ร้าน',
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
          delivery_phone: clampPhoneTen(shippingInfo.phone),
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
        const error = await response.json().catch(() => ({}));
        let msg =
          (typeof error.detail === 'string' && error.detail) ||
          error.error ||
          (Array.isArray(error.non_field_errors) && error.non_field_errors[0]) ||
          (Array.isArray(error.detail) && error.detail[0]);
        if (!msg && error.order_type) {
          msg = Array.isArray(error.order_type) ? error.order_type[0] : error.order_type;
        }
        throw new Error(msg || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ');
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

  const handleDownloadPromptPayQr = async () => {
    if (!promptPayInfo?.qr_image || !createdOrderId) {
      popup.error('ไม่พบรูป QR สำหรับบันทึก');
      return;
    }
    try {
      const result = await saveImageToDevice(
        promptPayInfo.qr_image,
        `promptpay-order-${createdOrderId}.png`,
      );
      if (result.method === 'aborted') {
        return;
      }
      popup.info('บันทึก QR ลงเครื่องเรียบร้อย');
    } catch (error) {
      popup.error(error.message || 'บันทึกรูป QR ไม่สำเร็จ');
    }
  };

  const fulfillmentServiceMode = fulfillmentMode === 'pickup' ? 'pickup' : 'delivery';
  const hoursStatus = useMemo(
    () => getServiceHoursStatus(serviceHours, fulfillmentServiceMode),
    [serviceHours, fulfillmentServiceMode, hoursTick],
  );

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
          <CustomerInlineBack />
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

  const hasDeliveryFeeReady =
    fulfillmentMode === 'pickup'
      ? true
      : deliveryFeeEstimate != null && !deliveryFeeError && !loadingDeliveryFeeEstimate;

  const canSubmitOrder =
    Boolean(paymentMethod) &&
    hasDeliveryFeeReady &&
    !submitting &&
    !createdOrderId &&
    hoursStatus.open;

  return (
    <div className="checkout-page">
      <div className="container">
        <CustomerInlineBack />
        <div className="page-header">
          <h1 className="page-title">ยืนยันคำสั่งซื้อ</h1>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form" noValidate>
          <div className="checkout-content">
            <div className="checkout-fulfillment customer-form-stack">
              <h3 className="section-title">วิธีรับสินค้า</h3>
              <div className="checkout-fulfillment-toggle" role="group" aria-label="เลือกจัดส่งหรือรับที่ร้าน">
                <button
                  type="button"
                  className={fulfillmentMode === 'delivery' ? 'is-active' : ''}
                  onClick={() => setFulfillmentMode('delivery')}
                >
                  จัดส่งถึงบ้าน
                </button>
                <button
                  type="button"
                  className={fulfillmentMode === 'pickup' ? 'is-active' : ''}
                  onClick={() => setFulfillmentMode('pickup')}
                >
                  รับที่ร้าน
                </button>
              </div>
              {!hoursStatus.open && hoursStatus.message ? (
                <div className="checkout-hours-alert" role="alert">
                  {hoursStatus.message}
                </div>
              ) : null}
            </div>

            {/* Order Summary */}
            <div className="order-summary">
              <h3 className="section-title">สรุปคำสั่งซื้อ</h3>
              
              <div className="checkout-summary-list">
                {cartItems.map((item) => (
                  <div key={item.id} className="checkout-summary-line">
                    <img
                      className="checkout-summary-thumb"
                      src={pickItemImage(item)}
                      alt={displayProductLineName(item)}
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                    <div className="checkout-summary-line-main">
                      <span className="checkout-summary-line-name">
                        {displayProductLineName(item)}
                      </span>
                      {item.category ? (
                        <span className="checkout-summary-line-cat">{item.category}</span>
                      ) : null}
                    </div>
                    <div className="checkout-summary-line-right">
                      <span className="checkout-summary-line-total">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                      <span className="checkout-summary-line-meta">
                        x{item.quantity} · {formatPrice(item.price)} /{' '}
                        {item.unitLabel || item.unit_label || 'ชิ้น'}
                        {(item.unitDetail || item.unit_detail)
                          ? ` (${item.unitDetail || item.unit_detail})`
                          : ''}
                      </span>
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
                  <span>{fulfillmentMode === 'pickup' ? 'ค่าจัดส่ง (รับที่ร้าน):' : 'ค่าจัดส่ง:'}</span>
                  <span>
                    {fulfillmentMode === 'pickup' ? (
                      <span className="free-shipping">ไม่มี</span>
                    ) : deliveryFeeEstimate == null ? (
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

            {/* Shipping / pickup */}
            <div className="shipping-info" ref={shippingSectionRef}>
              <h3 className="section-title">
                {fulfillmentMode === 'pickup' ? 'ข้อมูลผู้มารับที่ร้าน' : 'ข้อมูลการจัดส่ง'}
              </h3>

              {fulfillmentMode === 'pickup' ? (
                <div className="pickup-panel customer-form-stack">
                  <div className="pickup-store-card">
                    <strong>{storeListing.name || 'ร้าน'}</strong>
                    {storeListing.address ? (
                      <p className="pickup-store-address">{storeListing.address}</p>
                    ) : (
                      <p className="muted pickup-store-address">ยังไม่มีที่อยู่ร้านในระบบ</p>
                    )}
                  </div>
                  <label className="form-label">ชื่อผู้มารับ</label>
                  <input
                    name="name"
                    type="text"
                    className="form-input"
                    value={shippingInfo.name}
                    onChange={handleInputChange}
                    placeholder="ชื่อ–นามสกุล"
                    autoComplete="name"
                  />
                  <label className="form-label">เบอร์โทรติดต่อ (10 หลัก)</label>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    className="form-input"
                    maxLength={12}
                    value={formatMobileTenDisplay(shippingInfo.phone)}
                    onChange={handleInputChange}
                    placeholder="0812345678"
                    autoComplete="tel"
                  />
                  <label className="form-label">หมายเหตุถึงร้าน (ไม่บังคับ)</label>
                  <input
                    name="notes"
                    type="text"
                    className="form-input"
                    value={shippingInfo.notes}
                    onChange={handleInputChange}
                    placeholder="เช่น จะไปรับช่วงบ่าย"
                  />
                </div>
              ) : (
                <div className="delivery-each-order-panel customer-form-stack">
                  <label className="form-label">ชื่อผู้รับ</label>
                  <input
                    name="name"
                    type="text"
                    className="form-input"
                    value={shippingInfo.name}
                    onChange={handleInputChange}
                    placeholder="ชื่อ–นามสกุล"
                    autoComplete="name"
                  />

                  <label className="form-label">เบอร์โทรผู้รับ (10 หลัก)</label>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    className="form-input"
                    maxLength={12}
                    value={formatMobileTenDisplay(shippingInfo.phone)}
                    onChange={handleInputChange}
                    placeholder="0812345678"
                    autoComplete="tel"
                  />

                  <label className="form-label">ปักหมุดจุดจัดส่ง</label>
                  <div className="checkout-delivery-map-wrap">
                    <AddressPicker
                      onLocationSelect={handleDeliveryMapLocation}
                      onAddressSelect={handleDeliveryMapAddress}
                      initialLat={
                        toFiniteNumberOrNull(shippingInfo.latitude)
                        ?? toFiniteNumberOrNull(storeOrigin.latitude)
                        ?? 13.7563
                      }
                      initialLon={
                        toFiniteNumberOrNull(shippingInfo.longitude)
                        ?? toFiniteNumberOrNull(storeOrigin.longitude)
                        ?? 100.5018
                      }
                      autoLocateOnMount={
                        toFiniteNumberOrNull(shippingInfo.latitude) == null
                        || toFiniteNumberOrNull(shippingInfo.longitude) == null
                      }
                    />
                  </div>

                  <label className="form-label">ที่อยู่จัดส่ง (เลขที่ ถนน ซอย)</label>
                  <textarea
                    name="address"
                    className="form-textarea"
                    rows={3}
                    value={shippingInfo.address}
                    onChange={handleInputChange}
                    placeholder="ระบุที่อยู่จัดส่งครั้งนี้"
                  />

                  <label className="form-label">อำเภอ/เขต</label>
                  <input
                    name="district"
                    type="text"
                    className="form-input"
                    value={shippingInfo.district}
                    onChange={handleInputChange}
                  />

                  <label className="form-label">จังหวัด</label>
                  <input
                    name="province"
                    type="text"
                    className="form-input"
                    value={shippingInfo.province}
                    onChange={handleInputChange}
                  />

                  <label className="form-label">รหัสไปรษณีย์ 5 หลัก</label>
                  <input
                    name="postalCode"
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    value={shippingInfo.postalCode}
                    onChange={handleInputChange}
                    maxLength={5}
                  />

                  {(geocoding || geocodingError) && (
                    <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.88rem' }}>
                      {geocoding ? 'กำลังหาพิกัดจากที่อยู่เพื่อคำนวณค่าส่ง…' : geocodingError}
                    </p>
                  )}
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
                    <h4>QR Code</h4>
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
                    <h4>ชำระปลายทาง</h4>
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
                    <>
                      <img src={promptPayInfo.qr_image} alt="PromptPay QR Code" className="promptpay-qr-image" />
                      <div style={{ marginTop: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleDownloadPromptPayQr}
                        >
                          บันทึก QR ลงเครื่อง
                        </button>
                      </div>
                    </>
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

