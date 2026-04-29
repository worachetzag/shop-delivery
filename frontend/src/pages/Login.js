import React from 'react';
import LineLoginButton from '../components/LineLoginButton';
import './Login.css';

const Login = () => {
  return (
    <div className="login-page">
      <div className="container">
        <div className="login-card">
          <h2>เข้าสู่ระบบ</h2>
          <p className="login-subtitle">
            ใช้บัญชี LINE เพื่อเข้าใช้งานแอปลูกค้า
          </p>
          <div className="login-action">
        <LineLoginButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;



