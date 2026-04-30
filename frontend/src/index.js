import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import config from './config';
import './index.css';

if (typeof document !== 'undefined' && config?.BRANDING?.customerPageTitle) {
  document.title = config.BRANDING.customerPageTitle;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

