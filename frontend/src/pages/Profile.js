import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AddressPicker from '../components/AddressPicker';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import './Profile.css';

/** แปลงพิกัดจาก API (string/Decimal) เป็นตัวเลข — ใช้ก่อน .toFixed() / ส่ง backend */
function parseCoord(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

const Profile = () => {
  const popup = usePopup();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const shouldCompletePhone = queryParams.get('complete') === 'phone';
  const fromCheckout = queryParams.get('from') === 'checkout';
  const [userProfile, setUserProfile] = useState({
    displayName: '',
    email: '',
    phone: '',
    pictureUrl: null
  });
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [newAddress, setNewAddress] = useState({
    name: '',
    address: '',
    district: '',
    province: '',
    postalCode: '',
    latitude: null,
    longitude: null,
    isDefault: false
  });
  const section = queryParams.get('section') || 'menu';

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
    // Load user profile from Django
    const loadUserProfile = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
          headers: token ? { Authorization: `Token ${token}` } : {},
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Profile data:', data); // Debug
          
          // ดึงข้อมูลจาก user_info (nested object)
          const userInfo = data.user_info || {};
          const first_name = userInfo.first_name || '';
          const last_name = userInfo.last_name || '';
          const fullName = (first_name + ' ' + last_name).trim() || userInfo.username || '';
          
          setUserProfile({
            displayName: fullName,
            email: userInfo.email || '',
            phone: data.phone_number || '',
            pictureUrl: data.picture_url || null
          });
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
          // Not logged in, redirect to login
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
    if (qp.get('complete') === 'phone') {
      setEditing(true);
    }
  }, [location.search]);

  /** จากหน้าชำระเงิน: เปิดหมวดที่อยู่ + ฟอร์มเพิ่มที่อยู่ทันที */
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    setNewAddress(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLocationSelect = (lat, lon) => {
    setNewAddress(prev => ({
      ...prev,
      latitude: parseCoord(lat),
      longitude: parseCoord(lon),
    }));
  };

  const handleAddressSelect = (addressData) => {
    // กรอกที่อยู่ที่ได้จาก reverse geocoding อัตโนมัติ
    setNewAddress(prev => ({
      ...prev,
      address: addressData.address,
      district: addressData.district,
      province: addressData.province,
      postalCode: addressData.postalCode
    }));
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${config.API_BASE_URL}accounts/api-profile/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          phone_number: userProfile.phone,
        })
      });
      
      if (response.ok) {
        popup.info('บันทึกข้อมูลสำเร็จ');
        setEditing(false);
      } else {
        popup.error('ไม่สามารถบันทึกข้อมูลได้');
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
          'Authorization': `Token ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify({
          label: newAddress.name,
          recipient_name: userProfile.displayName,
          phone_number: userProfile.phone,
          address_line: newAddress.address,
          district: newAddress.district,
          province: newAddress.province,
          postal_code: newAddress.postalCode,
          latitude: parseCoord(newAddress.latitude),
          longitude: parseCoord(newAddress.longitude),
          is_default: newAddress.isDefault,
        })
      });

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
      setAddresses(prev => {
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
        isDefault: false
      });
      setShowAddAddress(false);
      setEditingAddressId(null);
      if (fromCheckout) {
        navigate('/customer/checkout');
      }
    } catch (error) {
      console.error('Error saving address:', error);
      popup.error('เกิดข้อผิดพลาดในการบันทึกที่อยู่: ' + error.message);
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
      setAddresses(prev => prev.filter(addr => addr.id !== id));
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
      setAddresses(prev => prev.map(addr => ({
        ...addr,
        isDefault: addr.id === id
      })));
    } catch (error) {
      popup.error(error.message);
    }
  };

  const handleDataExport = () => {
    // TODO: Implement data export
    popup.info('กำลังส่งออกข้อมูล...');
  };

  const handleDeleteAccount = async () => {
    if (await popup.confirm('คุณต้องการลบบัญชีหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้', { tone: 'danger', confirmText: 'ลบบัญชี' })) {
      // TODO: Implement account deletion
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

  return (
    <div className="profile-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">โปรไฟล์ของฉัน</h1>
          <p className="page-subtitle">จัดการข้อมูลส่วนตัวและที่อยู่</p>
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
              <strong style={{ display: 'block', marginBottom: '6px' }}>กรอกข้อมูลก่อนยืนยันคำสั่งซื้อ</strong>
              <p style={{ margin: '0 0 12px', fontSize: '0.95rem', color: '#374151' }}>
                โปรดตรวจสอบ <strong>ชื่อ เบอร์โทร</strong> ในข้อมูลส่วนตัว และเพิ่ม <strong>ที่อยู่จัดส่ง</strong> อย่างน้อย 1 รายการ
                แล้วกลับไปหน้าชำระเงิน
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/customer/checkout')}>
                กลับไปยืนยันคำสั่งซื้อ
              </button>
            </div>
          )}
          {shouldCompletePhone && !userProfile.phone && (
            <p className="page-subtitle" style={{ color: '#d97706', marginTop: '8px' }}>
              กรุณากรอกเบอร์โทรศัพท์ก่อนใช้งานระบบต่อ
            </p>
          )}
        </div>

        <div className="profile-content">
          {section === 'menu' && (
            <div className="profile-section profile-menu-list">
              <button className="profile-menu-item" type="button" onClick={() => goSection('personal')}>
                <div>
                  <p className="profile-menu-title">ข้อมูลส่วนตัว</p>
                  <p className="profile-menu-subtitle">ชื่อ อีเมล เบอร์โทร</p>
                </div>
                <span>›</span>
              </button>
              <button className="profile-menu-item" type="button" onClick={() => goSection('addresses')}>
                <div>
                  <p className="profile-menu-title">ที่อยู่จัดส่ง</p>
                  <p className="profile-menu-subtitle">ดู/เพิ่ม/แก้ไข/ตั้งค่าที่อยู่หลัก</p>
                </div>
                <span>›</span>
              </button>
              <button className="profile-menu-item" type="button" onClick={() => goSection('account')}>
                <div>
                  <p className="profile-menu-title">การจัดการบัญชี</p>
                  <p className="profile-menu-subtitle">ส่งออกข้อมูล และลบบัญชี</p>
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
                className="btn btn-outline btn-sm"
                onClick={() => setEditing(!editing)}
              >
                {editing ? 'ยกเลิก' : 'แก้ไข'}
              </button>
            </div>

            <div className="profile-card">
              <div className="profile-avatar">
                {userProfile.pictureUrl ? (
                  <img 
                    src={userProfile.pictureUrl} 
                    alt={userProfile.displayName}
                    className="avatar-image"
                  />
                ) : (
                  <span className="avatar-text">
                    {userProfile.displayName.charAt(0)}
                  </span>
                )}
              </div>

              {!editing ? (
                <div className="profile-display">
                  <p><strong>ชื่อ-นามสกุล</strong><br />{userProfile.displayName || '—'}</p>
                  <p><strong>อีเมล</strong><br />{userProfile.email || '—'}</p>
                  <p><strong>เบอร์โทรศัพท์</strong><br />{userProfile.phone || '—'}</p>
                </div>
              ) : (
                <div className="profile-form customer-form-stack">
                  <div className="form-group">
                    <label className="form-label">ชื่อ-นามสกุล</label>
                    <input
                      type="text"
                      name="displayName"
                      value={userProfile.displayName}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">อีเมล</label>
                    <input
                      type="email"
                      name="email"
                      value={userProfile.email}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      name="phone"
                      value={userProfile.phone}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-primary"
                      onClick={handleSaveProfile}
                    >
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
              <h3 className="section-title">ที่อยู่จัดส่ง</h3>
              {!showAddAddress && (
                <button
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
                <p className="form-hint" style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#666' }}>
                  กด «ยกเลิก» เพื่อกลับไปดูรายการที่อยู่
                </p>
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
                  <p className="form-hint" style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#666' }}>
                    คลิกบนแผนที่ ใช้ปุ่ม 📍 ตำแหน่งปัจจุบัน หรือค้นหาที่อยู่
                  </p>
                  <div style={{ marginBottom: '20px' }}>
                    <AddressPicker
                      onLocationSelect={handleLocationSelect}
                      onAddressSelect={handleAddressSelect}
                      initialLat={parseCoord(newAddress.latitude) ?? 13.7563}
                      initialLon={parseCoord(newAddress.longitude) ?? 100.5018}
                    />
                    {parseCoord(newAddress.latitude) != null && parseCoord(newAddress.longitude) != null && (
                      <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                        ✅ พิกัดที่เลือก: {parseCoord(newAddress.latitude).toFixed(6)}, {parseCoord(newAddress.longitude).toFixed(6)}
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
                  <button 
                    className="btn btn-primary"
                    onClick={handleAddAddress}
                  >
                    {editingAddressId ? 'บันทึกการแก้ไข' : 'เพิ่มที่อยู่'}
                  </button>
                  <button 
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
                        {address.isDefault && (
                          <span className="default-badge">หลัก</span>
                        )}
                      </h4>
                      <div className="address-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleEditAddress(address)}
                        >
                          แก้ไข
                        </button>
                        {!address.isDefault && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleSetDefaultAddress(address.id)}
                          >
                            ตั้งเป็นหลัก
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteAddress(address.id)}
                        >
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
                <button 
                  className="btn btn-outline"
                  onClick={handleDataExport}
                >
                  ส่งออก
                </button>
              </div>

              <div className="action-card">
                <div className="action-icon">🗑️</div>
                <div className="action-content">
                  <h4>ลบบัญชี</h4>
                  <p>ลบบัญชีและข้อมูลทั้งหมด</p>
                </div>
                <button 
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                >
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

