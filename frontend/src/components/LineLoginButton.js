import React from 'react';
import config from '../config';

const LineLoginButton = () => {
  const handleLineLogin = () => {
    window.location.href = `${config.LIFF_ENDPOINT_URL}/accounts/line/login/`;
  };

  return (
    <button 
      onClick={handleLineLogin}
      className="line-login-btn"
      style={{
        backgroundColor: '#00B900',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        justifyContent: 'center'
      }}
    >
      <span>📱</span>
      เข้าสู่ระบบด้วย LINE
    </button>
  );
};

export default LineLoginButton;
