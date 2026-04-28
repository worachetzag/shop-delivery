import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';

const DriverLogin = () => {
  const popup = usePopup();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/driver/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_role', data.role || 'driver');
        navigate('/driver/dashboard');
      } else {
        const err = await response.json().catch(() => ({}));
        popup.error(err?.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (error) {
      console.error('Login error:', error);
      popup.error('เกิดข้อผิดพลาด');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="driver-login-page" style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2>เข้าสู่ระบบคนขับรถส่ง</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>ชื่อผู้ใช้:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginTop: '5px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>รหัสผ่าน:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              marginTop: '5px'
            }}
          />
        </div>
        
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#00B900',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          เข้าสู่ระบบ
        </button>
      </form>
    </div>
  );
};

export default DriverLogin;

