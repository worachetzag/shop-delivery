import React from 'react';
import LineLoginButton from '../components/LineLoginButton';

const Login = () => {
  return (
    <div className="login-page" style={{ padding: '20px', maxWidth: '400px', margin: '0 auto' }}>
      <h2>เข้าสู่ระบบด้วย LINE</h2>
      <p style={{ color: '#666', margin: '10px 0 20px' }}>
        ระบบนี้รองรับการเข้าสู่ระบบผ่าน LINE LIFF เท่านั้น
      </p>

      <div style={{ marginBottom: '20px' }}>
        <LineLoginButton />
      </div>
    </div>
  );
};

export default Login;



