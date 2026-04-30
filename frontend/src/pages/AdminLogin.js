import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';
import './AdminLogin.css';

const AdminLogin = () => {
  const popup = usePopup();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${config.LIFF_ENDPOINT_URL}/accounts/admin/login/`, {
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
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('username', data.username);
        if (data.can_view_staff_audit) {
          localStorage.setItem('admin_can_view_audit', '1');
        } else {
          localStorage.removeItem('admin_can_view_audit');
        }
        
        // อย่าใช้ redirect_url จาก backend ตรงๆ — Django ใช้ FRONTEND_URL (มักเป็น localhost) ทำให้โดนเด้งไปโฮสต์ผิดเมื่อเปิดผ่าน ngrok
        let path = '/admin/dashboard';
        if (data.redirect_url) {
          try {
            path = new URL(data.redirect_url).pathname || path;
          } catch (_) {
            /* ignore */
          }
        }
        navigate(path);
      } else {
        const errorData = await response.json();
        popup.error(errorData.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
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
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h2 className="admin-login-title">
          เข้าสู่ระบบแอดมิน · {config.BRANDING.storeName}
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div className="admin-login-field">
            <label className="admin-login-label">ชื่อผู้ใช้:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="admin-login-input"
            />
          </div>
          
          <div className="admin-login-field">
            <label className="admin-login-label">รหัสผ่าน:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="admin-login-input"
            />
          </div>
          
          <button
            type="submit"
            className="admin-login-submit"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;

