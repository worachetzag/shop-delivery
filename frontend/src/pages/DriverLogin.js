import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import './DriverLogin.css';

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
    <div className="driver-login-page">
      <div className="driver-login-card">
      <h2 className="driver-login-title">เข้าสู่ระบบคนขับรถส่ง</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="driver-login-field">
          <label className="driver-login-label">ชื่อผู้ใช้:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            className="driver-login-input"
          />
        </div>
        
        <div className="driver-login-field">
          <label className="driver-login-label">รหัสผ่าน:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="driver-login-input"
          />
        </div>
        
        <button
          type="submit"
          className="driver-login-submit"
        >
          เข้าสู่ระบบ
        </button>
      </form>
      </div>
    </div>
  );
};

export default DriverLogin;

