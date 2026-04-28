import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config';
import { usePopup } from '../components/PopupProvider';

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
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
          👨‍💼 เข้าสู่ระบบแอดมินร้านค้า
        </h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666' }}>ชื่อผู้ใช้:</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#666' }}>รหัสผ่าน:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px'
              }}
            />
          </div>
          
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: 'bold',
              marginBottom: '15px'
            }}
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
          <p>สำหรับลูกค้า</p>
          <button 
            onClick={() => navigate('/customer/login')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#00B900',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            เข้าสู่ระบบลูกค้า
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

