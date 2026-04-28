# 🚀 Samsung Panich Delivery System

ระบบจัดการการสั่งซื้อและจัดส่งสินค้าสำหรับ Samsung Panich ที่ใช้ LINE LIFF (Line Front-end Framework)

## 📋 ภาพรวม

ระบบนี้ถูกออกแบบมาเพื่อรองรับการสั่งซื้อสินค้าทั้งแบบรับเองและจัดส่ง พร้อมระบบการชำระเงินผ่าน QR Code และการติดตามสถานะการจัดส่งแบบ manual

## 🏗️ Architecture

### Backend (Django REST Framework)
- **API Base URL:** `http://127.0.0.1:8000/api/`
- **Authentication:** Token-based
- **Database:** SQLite (Development)
- **CORS:** Enabled for LIFF domains

### Frontend (React + LINE LIFF)
- **Platform:** LINE LIFF (Line Front-end Framework)
- **Framework:** React 19.2.0
- **Routing:** React Router DOM
- **HTTP Client:** Axios
- **LINE Integration:** LIFF SDK

## 🚀 Quick Start

### Backend Setup
```bash
# Clone repository
git clone <repository-url>
cd shop-delivery

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install django djangorestframework django-cors-headers pillow python-decouple openpyxl pandas qrcode

# Run migrations
cd shop_delivery
python manage.py makemigrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

### Frontend Setup
```bash
# Navigate to frontend directory (อยู่ใน repo เดียวกับ backend)
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## 📁 Project Structure

```
shop-delivery/
├── shop_delivery/           # Django project
│   ├── accounts/           # User management
│   ├── products/           # Product management
│   ├── orders/             # Order management
│   ├── payments/           # Payment management
│   ├── logistics/          # Delivery management
│   ├── pdpa/               # PDPA compliance
│   ├── line_bot/           # LINE Bot integration
│   └── liff/               # LIFF integration
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   └── public/
└── docs/                   # Documentation
```

## 🔧 Features

### ✅ Customer Features (LIFF)
- 📱 Product Catalog
- 🛒 Shopping Cart
- 📦 Order Management
- 💳 Payment Integration (PromptPay, TrueMoney, Rabbit, SCB Easy)
- 📍 Order Tracking
- 👤 Profile Management

### ✅ Driver Features (LIFF)
- 📋 Assignment Management
- 🔄 Status Updates
- 👤 Profile Management
- 🚗 Availability Management

### ✅ Store Admin Features (Web)
- 📦 Product Management
- 📋 Order Management
- 👥 Driver Management
- 💰 Payment Management
- 🔒 PDPA Compliance

## 🔗 API Endpoints

### Auth Service
- `POST /api/accounts/register/` - ลงทะเบียนลูกค้า
- `GET /api/accounts/profile/` - ดูข้อมูลโปรไฟล์
- `GET /api/accounts/data-export/` - ส่งออกข้อมูล

### Products Service
- `GET /api/products/` - รายการสินค้า
- `GET /api/products/categories/` - หมวดหมู่สินค้า

### Orders Service
- `POST /api/orders/` - สร้างคำสั่งซื้อ
- `GET /api/orders/list/` - รายการคำสั่งซื้อ
- `GET /api/orders/cart/` - ดูตะกร้าสินค้า
- `PUT /api/orders/cart/update/` - แก้ไขสินค้าในตะกร้า
- `GET /api/orders/{order_id}/tracking/` - ติดตามคำสั่งซื้อ

### Payments Service
- `POST /api/payments/promptpay/` - สร้าง QR Code PromptPay
- `POST /api/payments/truemoney/` - สร้าง QR Code TrueMoney
- `GET /api/payments/status/{transaction_id}/` - เช็คสถานะการชำระเงิน

### Logistics Service
- `POST /api/logistics/calculate-fee/` - คำนวณค่าจัดส่ง
- `GET /api/logistics/drivers/` - รายการคนขับ
- `POST /api/logistics/drivers/availability/` - อัปเดตสถานะการพร้อมใช้งาน

## 🔒 Security & Compliance

### PDPA Compliance
- ✅ Consent Management
- ✅ Data Rights (Access, Portability, Deletion)
- ✅ Audit Trail
- ✅ Privacy by Design

### Security Features
- 🔐 Token-based Authentication
- 🛡️ CORS Protection
- 📝 Audit Logging
- 🔒 Data Encryption

## 📊 Development Status

- **Backend API:** ✅ 100% Complete
- **Database Models:** ✅ 100% Complete
- **Authentication:** ✅ 100% Complete
- **PDPA Compliance:** ✅ 100% Complete
- **Payment Integration:** ✅ 100% Complete
- **Frontend Setup:** ✅ 100% Complete
- **LINE LIFF Integration:** ⏳ Ready for Development

## 🎯 Next Steps

1. **Frontend Development** - พัฒนา React Components
2. **LINE LIFF Integration** - เชื่อมต่อกับ LINE Platform
3. **Store Admin Dashboard** - พัฒนา Web Dashboard
4. **Testing & Deployment** - ทดสอบและ Deploy

## 📚 Documentation

- [SCOPE.md](SCOPE.md) - Project scope and requirements
- [API_Endpoints_Summary.md](API_Endpoints_Summary.md) - Complete API documentation
- [LINE_Integration_Guide.md](LINE_Integration_Guide.md) - LINE integration guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Development Team:** Samsung Panich Development Team
- **Issues:** Create issue in project repository
- **Documentation:** See docs/ directory

---

**Last Updated:** October 23, 2025  
**Version:** 1.0.0  
**Status:** ✅ **Backend API ครบทุกเส้นที่ Frontend ต้องการแล้ว**



