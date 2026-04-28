# 📱 Samsung Panich Delivery - Frontend

## 🎯 ภาพรวม
Frontend สำหรับระบบ Samsung Panich Delivery ที่ใช้ LINE LIFF (Line Front-end Framework)

## 🚀 Quick Start

### การติดตั้ง
จากรากโปรเจ็กต์ `shop-delivery` (โฟลเดอร์ที่มีทั้ง backend และ frontend):

```bash
cd frontend
npm install
```

### การรัน Development Server
```bash
npm run dev
```

### การ Build สำหรับ Production
```bash
npm run build
```

## 📁 โครงสร้างโปรเจค
(`frontend/` อยู่ภายใต้ repo `shop-delivery`)

```
frontend/
├── src/
│   ├── components/     # React Components
│   ├── pages/         # Page Components
│   ├── services/      # API Services
│   ├── utils/         # Utility Functions
│   ├── App.js         # Main App Component
│   └── index.js       # Entry Point
├── public/
│   └── index.html     # HTML Template
├── webpack.config.js  # Webpack Configuration
├── package.json       # Dependencies
└── SCOPE.md          # Project Scope
```

## 🔧 Technology Stack
- **React 19.2.0** - Frontend Framework
- **React Router DOM 7.9.4** - Routing
- **Axios 1.12.2** - HTTP Client
- **LIFF SDK 1.2.0** - LINE Integration
- **Webpack 5.102.1** - Build Tool

## 📱 Features
- ✅ LINE LIFF Integration
- ✅ Responsive Design
- ✅ Product Catalog
- ✅ Shopping Cart
- ✅ Order Management
- ✅ Payment Integration
- ✅ Driver Management
- ✅ PDPA Compliance

## 🔗 API Integration
- **Backend API:** `http://127.0.0.1:8000/api/`
- **Authentication:** Token-based
- **CORS:** Enabled for LIFF domains

## 📋 Development Status
- **Phase 1:** ✅ Core Setup Complete
- **Phase 2:** 🔄 Customer Features (In Progress)
- **Phase 3:** ⏳ Driver Features (Pending)
- **Phase 4:** ⏳ Payment Integration (Pending)
- **Phase 5:** ⏳ PDPA & Security (Pending)
- **Phase 6:** ⏳ Testing & Deployment (Pending)

## 📞 Support
- **Development Team:** Samsung Panich Development Team
- **Documentation:** See SCOPE.md for detailed information
- **Issues:** Create issue in project repository

---

**Last Updated:** October 23, 2025  
**Version:** 1.0.0  
**Status:** In Development



