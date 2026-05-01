import React, { useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AddressPicker from '../components/AddressPicker';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import {
  digitsOnly,
  clampPhoneTen,
  clampCitizenThirteen,
  formatMobileTenDisplay,
  formatCitizenThirteenDisplay,
} from '../utils/thaiFormInputs';
import './Profile.css';

/** แปลงพิกัดจาก API (string/Decimal) เป็นตัวเลข — ใช้ก่อน .toFixed() / ส่ง backend */
function parseCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function isValidThaiCitizenId(raw) {
  const str = digitsOnly(raw);
  if (str.length !== 13) return false;
  let t = 0;
  for (let i = 0; i < 12; i += 1) t += parseInt(str[i], 10) * (13 - i);
  return ((11 - (t % 11)) % 10) === parseInt(str[12], 10);
}

/** วันเดือนปี พ.ศ. → สตริง YYYY-MM-DD (ค.ศ.) สำหรับ API */
function bePartsToIso(day, month, yearBe) {
  const d = parseInt(String(day).trim(), 10);
  const m = parseInt(String(month).trim(), 10);
  const yBe = parseInt(String(yearBe).trim(), 10);
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(yBe)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const yAd = yBe - 543;
  const dt = new Date(yAd, m - 1, d);
  if (dt.getFullYear() !== yAd || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${yAd}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isoToBeParts(iso) {
  if (!iso || typeof iso !== 'string') return { day: '', month: '', yearBe: '' };
  const [y, m, d] = iso.split('-');
  const yNum = parseInt(y, 10);
  const mNum = parseInt(m, 10);
  const dNum = parseInt(d, 10);
  if (!yNum || !mNum || !dNum) return { day: '', month: '', yearBe: '' };
  return { day: String(dNum), month: String(mNum), yearBe: String(yNum + 543) };
}

function maskIdCard(raw) {
  const s = digitsOnly(raw);
  if (s.length !== 13) return s ? `${s.slice(0, 4)}…` : '—';
  return `${s.slice(0, 3)}-xxxxx-xx-${s.slice(11)}`;
}

function recipientDisplayName(personal) {
  return [personal.firstName, personal.lastName].filter(Boolean).join(' ').trim();
}

function validatePersonalFields(personal) {
  const issues = [];
  if (!(personal.firstName || '').trim()) issues.push('ชื่อ');
  if (!(personal.lastName || '').trim()) issues.push('นามสกุล');
  const id = digitsOnly(personal.idCard);
  if (id.length !== 13) issues.push('เลขบัตรประชาชน 13 หลัก');
  else if (!isValidThaiCitizenId(id)) issues.push('เลขบัตรประชาชนไม่ถูกต้อง');
  const iso = bePartsToIso(personal.birthDay, personal.birthMonth, personal.birthYearBE);
  if (!iso) issues.push('วันเกิด (พ.ศ.) ให้ถูกต้อง');
  if (!(personal.address || '').trim()) issues.push('ที่อยู่ตามบัตร/ติดต่อ');
  const ph = clampPhoneTen(personal.phone);
  if (ph.length !== 10) issues.push('เบอร์โทร 10 หลัก (เช่น 0812345678)');
  return { issues, iso };
}

const emptyPersonal = () => ({
  firstName: '',
  lastName: '',
  idCard: '',
  birthDay: '',
  birthMonth: '',
  birthYearBE: '',
  address: '',
  phone: '',
});

const Profile = () => {
  const popup = usePopup();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const fromCheckout = queryParams.get('from') === 'checkout';
  const forceCompleteHint =
    queryParams.get('complete') === 'required' || queryParams.get('complete') === 'phone';

  const [personal, setPersonal] = useState(emptyPersonal());
  const [pictureUrl, setPictureUrl] = useState(null);
  const [profileCompleted, setProfileCompleted] = useState(true);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const phoneInputRef = useRef(null);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState({
    name: '',
    address: '',
    district: '',
    province: '',
    postalCode: '',
    latitude: null,
    longitude: null,
    isDefault: false,
  });
  const section = queryParams.get('section') || 'menu';

  const displayNameOneLine = recipientDisplayName(personal) || 'ผู้ใช้';

  const goSection = (nextSection) => {
    const params = new URLSearchParams(location.search);
    if (nextSection === 'menu') {
      params.delete('section');
    } else {
      params.set('section', nextSection);
    }
    navigate({ pathname: '/customer/profile', search: params.toString() ? `?${params.toString()}` : '' });
  };

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const ui = data.user_info || {};
          const be = isoToBeParts(data.date_of_birth || '');
          setPersonal({
            firstName: ui.first_name || '',
            lastName: ui.last_name || '',
            idCard: clampCitizenThirteen(String(data.id_card_number || '')),
            birthDay: be.day,
            birthMonth: be.month,
            birthYearBE: be.yearBe,
            address: data.address || '',
            phone: clampPhoneTen(String(data.phone_number || '')),
          });
          setPictureUrl(data.picture_url || null);
          setProfileCompleted(Boolean(data.profile_completed));

          const addrRes = await fetch(`${config.API_BASE_URL}accounts/addresses/`, {
            headers: token ? { Authorization: `Token ${token}` } : {},
            credentials: 'include',
          });
          if (addrRes.ok) {
            const addrData = await addrRes.json();
            const addrList = Array.isArray(addrData)
              ? addrData
              : (Array.isArray(addrData?.results) ? addrData.results : []);
            setAddresses(addrList.map((addr) => ({
              id: addr.id,
              name: addr.label || 'ที่อยู่',
              address: addr.address_line || '',
              district: addr.district || '',
              province: addr.province || '',
              postalCode: addr.postal_code || '',
              latitude: parseCoord(addr.latitude),
              longitude: parseCoord(addr.longitude),
              isDefault: Boolean(addr.is_default),
            })));
          }
        } else {
          window.location.href = '/customer/login';
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        window.location.href = '/customer/login';
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    if (qp.get('complete') === 'phone' || qp.get('complete') === 'required') {
      setEditing(true);
    }
  }, [location.search]);

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    if (qp.get('section') === 'addresses' && qp.get('add') === '1') {
      setEditingAddressId(null);
      setShowAddAddress(true);
      setNewAddress({
        name: '',
        address: '',
        district: '',
        province: '',
        postalCode: '',
        latitude: null,
        longitude: null,
        isDefault: false,
      });
    }
  }, [location.search]);

  const handlePersonalChange = (name, value) => {
    setPersonal((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setNewAddress((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleLocationSelect = (lat, lon) => {
    setNewAddress((prev) => ({
      ...prev,
      latitude: parseCoord(lat),
      longitude: parseCoord(lon),
    }));
  };

  const handleAddressSelect = (addressData) => {
    setNewAddress((prev) => ({
      ...prev,
      address: addressData.address,
      district: addressData.district,
      province: addressData.province,
      postalCode: addressData.postalCode,
    }));
  };

  const handleSaveProfile = async () => {
    const { issues, iso } = validatePersonalFields(personal);
    if (issues.length) {
      popup.error(`กรุณากรอกให้ครบ: ${issues.join(' · ')}`);
      setEditing(true);
      window.requestAnimationFrame(() => {
        phoneInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({
          first_name: (personal.firstName || '').trim(),
          last_name: (personal.lastName || '').trim(),
          id_card_number: clampCitizenThirteen(personal.idCard),
          date_of_birth: iso,
          address: (personal.address || '').trim(),
          phone_number: clampPhoneTen(personal.phone),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        const row = payload?.data || {};
        const ui = row.user_info || {};
        const be = isoToBeParts(row.date_of_birth || iso);
        setPersonal({
          firstName: ui.first_name || personal.firstName,
          lastName: ui.last_name || personal.lastName,
          idCard: clampCitizenThirteen(String(row.id_card_number || personal.idCard)),
          birthDay: be.day,
          birthMonth: be.month,
          birthYearBE: be.yearBe,
          address: row.address ?? personal.address,
          phone: clampPhoneTen(String(row.phone_number ?? personal.phone)),
        });
        setProfileCompleted(Boolean(row.profile_completed));
        setPictureUrl(row.picture_url ?? pictureUrl);
        popup.info('บันทึกข้อมูลสำเร็จ');
        setEditing(false);
        if (fromCheckout) {
          navigate('/customer/checkout');
        }
      } else {
        popup.error(payload?.error || 'ไม่สามารถบันทึกข้อมูลได้');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      popup.error('เกิดข้อผิดพลาด');
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.name || !newAddress.address) {
      popup.info('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (parseCoord(newAddress.latitude) == null || parseCoord(newAddress.longitude) == null) {
      popup.info('กรุณาเลือกตำแหน่งบนแผนที่');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token') || new URLSearchParams(window.location.search).get('token');
      const isEditing = Boolean(editingAddressId);
      const response = await fetch(
        isEditing
          ? `${config.API_BASE_URL}accounts/addresses/${editingAddressId}/`
          : `${config.API_BASE_URL}accounts/addresses/`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Token ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
          credentials: 'include',
          body: JSON.stringify({
            label: newAddress.name,
            recipient_name: recipientDisplayName(personal) || displayNameOneLine,
            phone_number: personal.phone,
            address_line: newAddress.address,
            district: newAddress.district,
            province: newAddress.province,
            postal_code: newAddress.postalCode,
            latitude: parseCoord(newAddress.latitude),
            longitude: parseCoord(newAddress.longitude),
            is_default: newAddress.isDefault,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.detail || errorData?.error || 'บันทึกไม่สำเร็จ');
      }

      const saved = await response.json();
      popup.info('บันทึกที่อยู่สำเร็จ');
      const normalized = {
        id: saved.id,
        name: saved.label || 'ที่อยู่',
        address: saved.address_line || '',
        district: saved.district || '',
        province: saved.province || '',
        postalCode: saved.postal_code || '',
        latitude: parseCoord(saved.latitude),
        longitude: parseCoord(saved.longitude),
        isDefault: Boolean(saved.is_default),
      };
      setAddresses((prev) => {
        let nextList = isEditing
          ? prev.map((a) => (a.id === normalized.id ? normalized : a))
          : [normalized, ...prev];
        if (normalized.isDefault) {
          nextList = nextList.map((a) => ({ ...a, isDefault: a.id === normalized.id }));
        }
        return nextList;
      });
      setNewAddress({
        name: '',
        address: '',
        district: '',
        province: '',
        postalCode: '',
        latitude: null,
        longitude: null,
        isDefault: false,
      });
      setShowAddAddress(false);
      setEditingAddressId(null);
      if (fromCheckout) {
        navigate('/customer/checkout');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      popup.error(`เกิดข้อผิดพลาดในการบันทึกที่อยู่: ${error.message}`);
    }
  };

  const handleEditAddress = (address) => {
    setEditingAddressId(address.id);
    setShowAddAddress(true);
    setNewAddress({
      name: address.name || '',
      address: address.address || '',
      district: address.district || '',
      province: address.province || '',
      postalCode: address.postalCode || '',
      latitude: parseCoord(address.latitude),
      longitude: parseCoord(address.longitude),
      isDefault: Boolean(address.isDefault),
    });
  };

  const handleDeleteAddress = async (id) => {
    if (!(await popup.confirm('คุณต้องการลบที่อยู่นี้หรือไม่?', { tone: 'danger', confirmText: 'ลบที่อยู่' }))) return;
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}accounts/addresses/${id}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('ลบที่อยู่ไม่สำเร็จ');
      }
      setAddresses((prev) => prev.filter((addr) => addr.id !== id));
    } catch (error) {
      popup.error(error.message);
    }
  };

  const handleSetDefaultAddress = async (id) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}accounts/addresses/${id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({ is_default: true }),
      });
      if (!response.ok) {
        throw new Error('ตั้งค่าเริ่มต้นไม่สำเร็จ');
      }
      setAddresses((prev) => prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      })));
    } catch (error) {
      popup.error(error.message);
    }
  };

  const handleDataExport = () => {
    popup.info('กำลังส่งออกข้อมูล...');
  };

  const handleDeleteAccount = async () => {
    if (await popup.confirm('คุณต้องการลบบัญชีหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้', { tone: 'danger', confirmText: 'ลบบัญชี' })) {
      popup.info('กำลังลบบัญชี...');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        กำลังโหลดข้อมูลโปรไฟล์...
      </div>
    );
  }

  if (!profileCompleted) {
    return (
      <div className="profile-page">
        <div className="container">
          <div className="page-header">
            <h1 className="page-title">ยืนยันข้อมูลส่วนตัว</h1>
            {forceCompleteHint && (
              <p className="page-subtitle" style={{ color: '#d97706', marginTop: '8px' }}>
                กรอกให้ครบก่อนสั่งซื้อ
              </p>
            )}
          </div>

          <div className="profile-section profile-section-personal customer-form-stack" style={{ marginTop: '8px' }}>
            <div className="profile-card">
              <div className="profile-avatar">
                {pictureUrl ? (
                  <img src={pictureUrl} alt="" className="avatar-image" />
                ) : (
                  <span className="avatar-text">
                    {(personal.firstName || personal.lastName || '?').charAt(0)}
                  </span>
                )}
              </div>

              <label className="form-label">ชื่อ</label>
              <input
                type="text"
                className="form-input"
                value={personal.firstName}
                onChange={(e) => handlePersonalChange('firstName', e.target.value)}
                autoComplete="given-name"
              />

              <label className="form-label">นามสกุล</label>
              <input
                type="text"
                className="form-input"
                value={personal.lastName}
                onChange={(e) => handlePersonalChange('lastName', e.target.value)}
                autoComplete="family-name"
              />

              <label className="form-label">เลขบัตรประชาชน (13 หลัก)</label>
              <input
                type="tel"
                inputMode="numeric"
                className="form-input"
                autoComplete="off"
                placeholder="x-xxxx-xxxxx-xx-x"
                maxLength={17}
                value={formatCitizenThirteenDisplay(personal.idCard)}
                onChange={(e) => handlePersonalChange('idCard', clampCitizenThirteen(e.target.value))}
              />

              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
                <legend className="form-label" style={{ padding: 0, marginBottom: '8px' }}>
                  วันเกิด (พ.ศ.)
                </legend>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    className="form-input"
                    style={{ flex: '1 1 72px', minWidth: '64px' }}
                    placeholder="วัน"
                    value={personal.birthDay}
                    onChange={(e) => handlePersonalChange('birthDay', e.target.value)}
                  />
                  <input
                    type="number"
                    className="form-input"
                    style={{ flex: '1 1 72px', minWidth: '64px' }}
                    placeholder="เดือน"
                    value={personal.birthMonth}
                    onChange={(e) => handlePersonalChange('birthMonth', e.target.value)}
                  />
                  <input
                    type="number"
                    className="form-input"
                    style={{ flex: '2 1 100px', minWidth: '96px' }}
                    placeholder="ปี พ.ศ."
                    value={personal.birthYearBE}
                    onChange={(e) => handlePersonalChange('birthYearBE', e.target.value)}
                  />
                </div>
              </fieldset>

              <label className="form-label">ที่อยู่ตามบัตรประชาชน / ติดต่อ</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={personal.address}
                onChange={(e) => handlePersonalChange('address', e.target.value)}
                placeholder="เลขที่ ถนน ซอย แขวง ตำบล ฯลฯ"
              />

              <label className="form-label">เบอร์โทรศัพท์ (10 หลัก)</label>
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                className="form-input"
                autoComplete="tel"
                placeholder="0812345678"
                maxLength={12}
                value={formatMobileTenDisplay(personal.phone)}
                onChange={(e) => handlePersonalChange('phone', clampPhoneTen(e.target.value))}
              />

              <div className="form-actions">
                <button type="button" className="btn btn-primary" onClick={handleSaveProfile}>
                  บันทึกและเข้าใช้งาน
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">โปรไฟล์ของฉัน</h1>
          {fromCheckout && (
            <div
              style={{
                marginTop: '16px',
                padding: '14px 16px',
                background: '#eff6ff',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                textAlign: 'left',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '10px' }}>กลับไปยืนยันคำสั่งซื้อ</strong>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/customer/checkout')}>
                ไปหน้าชำระเงิน
              </button>
            </div>
          )}
        </div>

        <div className="profile-content">
          {section === 'menu' && (
            <div className="profile-section profile-menu-list">
              <button className="profile-menu-item" type="button" onClick={() => goSection('personal')}>
                <div>
                  <p className="profile-menu-title">ข้อมูลส่วนตัว</p>
                </div>
                <span>›</span>
              </button>
              <button className="profile-menu-item" type="button" onClick={() => goSection('addresses')}>
                <div>
                  <p className="profile-menu-title">ที่อยู่อ้างอิง</p>
                </div>
                <span>›</span>
              </button>
              <button className="profile-menu-item" type="button" onClick={() => goSection('account')}>
                <div>
                  <p className="profile-menu-title">การจัดการบัญชี</p>
                </div>
                <span>›</span>
              </button>
            </div>
          )}

          {section === 'personal' && (
            <div className="profile-section profile-section-personal">
              <div className="profile-subpage-head">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => goSection('menu')}>
                  ← กลับ
                </button>
              </div>
              <div className="section-header">
                <h3 className="section-title">ข้อมูลส่วนตัว</h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? 'ยกเลิก' : 'แก้ไข'}
                </button>
              </div>

              <div className="profile-card">
                <div className="profile-avatar">
                  {pictureUrl ? (
                    <img
                      src={pictureUrl}
                      alt={displayNameOneLine}
                      className="avatar-image"
                    />
                  ) : (
                    <span className="avatar-text">
                      {(displayNameOneLine || '?').charAt(0)}
                    </span>
                  )}
                </div>

                {!editing ? (
                  <div className="profile-display">
                    <p>
                      <strong>ชื่อ</strong>
                      <br />
                      {personal.firstName || '—'}
                    </p>
                    <p>
                      <strong>นามสกุล</strong>
                      <br />
                      {personal.lastName || '—'}
                    </p>
                    <p>
                      <strong>เลขบัตรประชาชน</strong>
                      <br />
                      {maskIdCard(personal.idCard)}
                    </p>
                    <p>
                      <strong>วันเกิด (พ.ศ.)</strong>
                      <br />
                      {[personal.birthDay, personal.birthMonth, personal.birthYearBE].every(Boolean)
                        ? `${personal.birthDay}/${personal.birthMonth}/${personal.birthYearBE}`
                        : '—'}
                    </p>
                    <p>
                      <strong>ที่อยู่ตามบัตร/ติดต่อ</strong>
                      <br />
                      {(personal.address || '').trim() ? personal.address : '—'}
                    </p>
                    <p>
                      <strong>เบอร์โทรศัพท์</strong>
                      <br />
                      {formatMobileTenDisplay(personal.phone) || '—'}
                    </p>
                  </div>
                ) : (
                  <div className="profile-form customer-form-stack">
                    <div className="form-group">
                      <label className="form-label">ชื่อ</label>
                      <input
                        type="text"
                        className="form-input"
                        value={personal.firstName}
                        onChange={(e) => handlePersonalChange('firstName', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">นามสกุล</label>
                      <input
                        type="text"
                        className="form-input"
                        value={personal.lastName}
                        onChange={(e) => handlePersonalChange('lastName', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">เลขบัตรประชาชน (13 หลัก)</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        className="form-input"
                        placeholder="x-xxxx-xxxxx-xx-x"
                        maxLength={17}
                        value={formatCitizenThirteenDisplay(personal.idCard)}
                        onChange={(e) => handlePersonalChange('idCard', clampCitizenThirteen(e.target.value))}
                      />
                    </div>
                    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                      <legend className="form-label" style={{ padding: 0 }}>วันเกิด (พ.ศ.)</legend>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                        <input
                          type="number"
                          className="form-input"
                          style={{ flex: '1 1 72px' }}
                          placeholder="วัน"
                          value={personal.birthDay}
                          onChange={(e) => handlePersonalChange('birthDay', e.target.value)}
                        />
                        <input
                          type="number"
                          className="form-input"
                          style={{ flex: '1 1 72px' }}
                          placeholder="เดือน"
                          value={personal.birthMonth}
                          onChange={(e) => handlePersonalChange('birthMonth', e.target.value)}
                        />
                        <input
                          type="number"
                          className="form-input"
                          style={{ flex: '2 1 100px' }}
                          placeholder="ปี พ.ศ."
                          value={personal.birthYearBE}
                          onChange={(e) => handlePersonalChange('birthYearBE', e.target.value)}
                        />
                      </div>
                    </fieldset>
                    <div className="form-group">
                      <label className="form-label">ที่อยู่ตามบัตรประชาชน / ติดต่อ</label>
                      <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.88rem' }}>
                        ไม่ใช่ที่อยู่จัดส่ง
                      </p>
                      <textarea
                        className="form-textarea"
                        rows={4}
                        value={personal.address}
                        onChange={(e) => handlePersonalChange('address', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">เบอร์โทรศัพท์ (10 หลัก)</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        className="form-input"
                        ref={phoneInputRef}
                        placeholder="0812345678"
                        maxLength={12}
                        value={formatMobileTenDisplay(personal.phone)}
                        onChange={(e) => handlePersonalChange('phone', clampPhoneTen(e.target.value))}
                      />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="btn btn-primary" onClick={handleSaveProfile}>
                        บันทึก
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'addresses' && (
            <div className="addresses-section">
              <div className="profile-subpage-head">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => goSection('menu')}>
                  ← กลับ
                </button>
              </div>
              <div className="section-header">
                <h3 className="section-title">ที่อยู่อ้างอิง</h3>
                {!showAddAddress && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingAddressId(null);
                      setShowAddAddress(true);
                    }}
                  >
                    เพิ่มที่อยู่
                  </button>
                )}
              </div>

              {showAddAddress && (
                <div className="add-address-form customer-form-stack">
                  <h4>{editingAddressId ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'}</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ชื่อที่อยู่</label>
                      <input
                        type="text"
                        name="name"
                        value={newAddress.name}
                        onChange={handleAddressInputChange}
                        className="form-input"
                        placeholder="เช่น บ้าน, ที่ทำงาน"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">เลือกตำแหน่งบนแผนที่</label>
                      <div style={{ marginBottom: '20px' }}>
                        <AddressPicker
                          onLocationSelect={handleLocationSelect}
                          onAddressSelect={handleAddressSelect}
                          initialLat={parseCoord(newAddress.latitude) ?? 13.7563}
                          initialLon={parseCoord(newAddress.longitude) ?? 100.5018}
                        />
                        {parseCoord(newAddress.latitude) != null && parseCoord(newAddress.longitude) != null && (
                          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                            ✅ พิกัดที่เลือก: {parseCoord(newAddress.latitude).toFixed(6)},{' '}
                            {parseCoord(newAddress.longitude).toFixed(6)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">ที่อยู่</label>
                    <textarea
                      name="address"
                      value={newAddress.address}
                      onChange={handleAddressInputChange}
                      className="form-textarea"
                      rows="3"
                      placeholder="เลขที่ ถนน ซอย"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">อำเภอ/เขต</label>
                      <input
                        type="text"
                        name="district"
                        value={newAddress.district}
                        onChange={handleAddressInputChange}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">จังหวัด</label>
                      <input
                        type="text"
                        name="province"
                        value={newAddress.province}
                        onChange={handleAddressInputChange}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">รหัสไปรษณีย์</label>
                      <input
                        type="text"
                        name="postalCode"
                        value={newAddress.postalCode}
                        onChange={handleAddressInputChange}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="btn btn-primary" onClick={handleAddAddress}>
                      {editingAddressId ? 'บันทึกการแก้ไข' : 'เพิ่มที่อยู่'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowAddAddress(false);
                        setEditingAddressId(null);
                      }}
                    >
                      ยกเลิก · กลับไปรายการที่อยู่
                    </button>
                  </div>
                </div>
              )}

              {!showAddAddress && (
                <div className="addresses-list">
                  {addresses.map((address) => (
                    <div key={address.id} className="address-card">
                      <div className="address-header">
                        <h4 className="address-name">
                          {address.name}
                          {address.isDefault && <span className="default-badge">หลัก</span>}
                        </h4>
                        <div className="address-actions">
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleEditAddress(address)}>
                            แก้ไข
                          </button>
                          {!address.isDefault && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleSetDefaultAddress(address.id)}>
                              ตั้งเป็นหลัก
                            </button>
                          )}
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteAddress(address.id)}>
                            ลบ
                          </button>
                        </div>
                      </div>
                      <div className="address-details">
                        <p>{address.address}</p>
                        <p>{address.district} {address.province} {address.postalCode}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {section === 'account' && (
            <div className="account-actions-section">
              <div className="profile-subpage-head">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => goSection('menu')}>
                  ← กลับ
                </button>
              </div>
              <h3 className="section-title">การจัดการบัญชี</h3>

              <div className="action-cards">
                <div className="action-card">
                  <div className="action-icon">📤</div>
                  <div className="action-content">
                    <h4>ส่งออกข้อมูล</h4>
                    <p>ดาวน์โหลดข้อมูลส่วนตัวของคุณ</p>
                  </div>
                  <button type="button" className="btn btn-outline" onClick={handleDataExport}>
                    ส่งออก
                  </button>
                </div>

                <div className="action-card">
                  <div className="action-icon">🗑️</div>
                  <div className="action-content">
                    <h4>ลบบัญชี</h4>
                    <p>ลบบัญชีและข้อมูลทั้งหมด</p>
                  </div>
                  <button type="button" className="btn btn-danger" onClick={handleDeleteAccount}>
                    ลบบัญชี
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
