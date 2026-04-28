# 📱 Samsung Panich Delivery - Frontend Scope

## 🎯 ภาพรวมระบบ
ระบบ Frontend สำหรับ Samsung Panich Delivery ที่ใช้ LINE LIFF (Line Front-end Framework) เพื่อให้ลูกค้าและคนขับสามารถใช้งานผ่าน LINE App ได้โดยไม่ต้องติดตั้งแอปเพิ่ม

## 🏗️ Architecture

### Platform Architecture
- **LINE LIFF:** สำหรับลูกค้าและคนขับ (Mobile-first)
- **Web Admin Dashboard:** สำหรับแอดมินร้านค้า (Desktop)
- **LINE Bot:** สำหรับการแจ้งเตือนและโต้ตอบ

### Technology Stack
- **Frontend Framework:** React 19.2.0
- **Routing:** React Router DOM 7.9.4
- **HTTP Client:** Axios 1.12.2
- **LINE Integration:** LIFF SDK 1.2.0
- **Build Tool:** Webpack 5.102.1
- **Styling:** CSS3 + Responsive Design

## 👥 User Roles & Permissions

### 1. Customer (ลูกค้า)
- **Platform:** LINE LIFF
- **Features:**
  - ดูสินค้าและหมวดหมู่
  - จัดการตะกร้าสินค้า
  - สร้างคำสั่งซื้อ
  - ชำระเงินผ่าน LINE Pay, PromptPay, TrueMoney, Rabbit, SCB Easy
  - ติดตามคำสั่งซื้อ
  - จัดการโปรไฟล์ส่วนตัว
  - ส่งออกข้อมูลส่วนบุคคล (PDPA)

### 2. Driver (คนขับรถส่ง)
- **Platform:** LINE LIFF
- **Features:**
  - ดูงานที่ได้รับมอบหมาย
  - อัปเดตสถานะการจัดส่ง
  - ติดต่อลูกค้า
  - จัดการโปรไฟล์คนขับ

### 3. Store Admin (แอดมินร้านค้า)
- **Platform:** Web Dashboard
- **Features:**
  - จัดการสินค้าและหมวดหมู่
  - จัดการคำสั่งซื้อ
  - จัดการการจัดส่ง
  - จัดการคนขับ
  - ดูรายงานและสถิติ

### 4. Super Admin (ผู้ดูแลระบบ)
- **Platform:** Web Dashboard
- **Features:**
  - จัดการผู้ใช้งานทั้งหมด
  - จัดการระบบ PDPA
  - ดู Audit Logs
  - จัดการการตั้งค่าระบบ

## 📱 LIFF Pages & Features

### Customer Pages
1. **Home Page** (`/`)
   - แสดงสินค้าแนะนำ
   - เมนูหลัก (สั่งซื้อ, ติดตาม, ติดต่อ)
   - ข้อมูลโปรโมชั่น

2. **Products Page** (`/products`)
   - รายการสินค้าทั้งหมด
   - ฟิลเตอร์ตามหมวดหมู่
   - ค้นหาสินค้า
   - รายละเอียดสินค้า

3. **Cart Page** (`/cart`)
   - สินค้าในตะกร้า
   - แก้ไขจำนวนสินค้า
   - ลบสินค้า
   - คำนวณราคารวม

4. **Checkout Page** (`/checkout`)
   - ข้อมูลการจัดส่ง
   - เลือกวิธีการชำระเงิน
   - สรุปคำสั่งซื้อ
   - ยืนยันคำสั่งซื้อ

5. **Orders Page** (`/orders`)
   - รายการคำสั่งซื้อ
   - สถานะคำสั่งซื้อ
   - รายละเอียดคำสั่งซื้อ

6. **Tracking Page** (`/tracking`)
   - ติดตามสถานะการจัดส่ง
   - ติดต่อคนขับ
   - ดูเส้นทางการจัดส่ง

7. **Profile Page** (`/profile`)
   - ข้อมูลส่วนตัว
   - ที่อยู่จัดส่ง
   - การตั้งค่า

### Driver Pages
1. **Driver Home** (`/driver`)
   - งานที่ได้รับมอบหมาย
   - สถานะการทำงาน
   - สถิติการทำงาน

2. **Assignments** (`/driver/assignments`)
   - รายการงานจัดส่ง
   - อัปเดตสถานะ
   - ติดต่อลูกค้า

3. **Driver Profile** (`/driver/profile`)
   - ข้อมูลคนขับ
   - ข้อมูลรถ
   - การตั้งค่า

## 🔗 API Integration

### Backend API Endpoints
- **Base URL:** `http://127.0.0.1:8000/api/`
- **Authentication:** Token-based authentication
- **CORS:** Enabled for LIFF domains

### API Services
1. **Auth Service**
   - `POST /api/accounts/register/` - ลงทะเบียนลูกค้า
   - `GET /api/accounts/profile/` - ดูข้อมูลโปรไฟล์
   - `GET /api/accounts/data-export/` - ส่งออกข้อมูล

2. **Products Service**
   - `GET /api/products/` - รายการสินค้า
   - `GET /api/products/categories/` - หมวดหมู่สินค้า

3. **Orders Service**
   - `POST /api/orders/` - สร้างคำสั่งซื้อ
   - `GET /api/orders/list/` - รายการคำสั่งซื้อ
   - `POST /api/orders/cart/add/` - เพิ่มสินค้าในตะกร้า

4. **Payments Service**
   - `POST /api/payments/promptpay/` - สร้าง QR Code PromptPay
   - `POST /api/payments/truemoney/` - สร้าง QR Code TrueMoney
   - `POST /api/payments/rabbit/` - สร้าง QR Code Rabbit
   - `POST /api/payments/scb-easy/` - สร้าง QR Code SCB Easy

5. **Logistics Service**
   - `POST /api/logistics/calculate-fee/` - คำนวณค่าจัดส่ง
   - `GET /api/logistics/driver/assignments/` - งานจัดส่ง
   - `PUT /api/logistics/driver/assignments/{id}/update/` - อัปเดตสถานะ

6. **PDPA Service**
   - `GET /api/pdpa/privacy-policy/` - นโยบายความเป็นส่วนตัว
   - `GET/POST /api/pdpa/consent/` - จัดการความยินยอม

## 🎨 UI/UX Design

### Design Principles
- **Mobile-first:** ออกแบบสำหรับมือถือเป็นหลัก
- **LINE Integration:** ใช้สีและธีมของ LINE
- **User-friendly:** ใช้งานง่าย เข้าใจง่าย
- **Responsive:** รองรับหน้าจอขนาดต่างๆ

### Color Scheme
- **Primary:** #00B900 (LINE Green)
- **Secondary:** #06C755 (LINE Light Green)
- **Accent:** #FF6B6B (Red for alerts)
- **Background:** #F8F9FA (Light Gray)
- **Text:** #333333 (Dark Gray)

### Components
1. **Header Component**
   - Logo
   - Navigation menu
   - User profile

2. **Product Card Component**
   - รูปสินค้า
   - ชื่อสินค้า
   - ราคา
   - ปุ่มเพิ่มในตะกร้า

3. **Cart Item Component**
   - รูปสินค้า
   - ชื่อสินค้า
   - ราคา
   - ปุ่มแก้ไข/ลบ

4. **Order Card Component**
   - หมายเลขคำสั่งซื้อ
   - สถานะ
   - วันที่
   - ปุ่มดูรายละเอียด

5. **QR Code Component**
   - แสดง QR Code
   - ปุ่มดาวน์โหลด
   - ข้อมูลการชำระเงิน

## 🔧 Development Setup

### Prerequisites
- Node.js 14.21.3+
- npm 6.14.18+
- LINE LIFF ID

### Installation
```bash
cd frontend   # จากราก repo shop-delivery
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Environment Variables
```bash
REACT_APP_API_BASE_URL=http://127.0.0.1:8000/api/
REACT_APP_LIFF_ID=your-liff-id
REACT_APP_LINE_CHANNEL_ID=your-channel-id
```

## 📱 LIFF Configuration

### LIFF App Settings
- **LIFF ID:** `1234567890-abcdefgh`
- **Size:** Full
- **Endpoint URL:** `https://yourdomain.com/liff/`
- **Scope:** profile, openid

### LIFF Features
- **Profile Access:** รับข้อมูลโปรไฟล์จาก LINE
- **Share Target Picker:** แชร์ข้อมูลผ่าน LINE
- **External Browser:** เปิดลิงก์ภายนอก
- **Scan QR Code:** สแกน QR Code

## 🚀 Deployment

### Development Environment
- **URL:** `http://localhost:3000`
- **API:** `http://127.0.0.1:8000/api/`

### Production Environment
- **URL:** `https://yourdomain.com/liff/`
- **API:** `https://yourdomain.com/api/`
- **SSL:** Required for LIFF

### Build Process
1. **Webpack Build:** Bundle JavaScript และ CSS
2. **Asset Optimization:** Minify และ compress
3. **Static Files:** Serve จาก CDN
4. **Environment:** Production settings

## 🔒 Security & Privacy

### Data Protection
- **PDPA Compliance:** รองรับกฎหมาย PDPA
- **Data Encryption:** เข้ารหัสข้อมูลสำคัญ
- **Secure Storage:** เก็บข้อมูลอย่างปลอดภัย
- **User Consent:** ขอความยินยอมก่อนเก็บข้อมูล

### Authentication
- **LINE Login:** ใช้ LINE Account
- **Token Management:** จัดการ JWT tokens
- **Session Management:** จัดการ session
- **Logout:** ออกจากระบบอย่างปลอดภัย

## 📊 Performance & Optimization

### Performance Targets
- **First Contentful Paint:** < 2 seconds
- **Largest Contentful Paint:** < 4 seconds
- **Cumulative Layout Shift:** < 0.1
- **First Input Delay:** < 100ms

### Optimization Strategies
- **Code Splitting:** แบ่งโค้ดตามหน้า
- **Lazy Loading:** โหลดข้อมูลเมื่อจำเป็น
- **Image Optimization:** ปรับขนาดรูปภาพ
- **Caching:** ใช้ cache สำหรับข้อมูล

## 🧪 Testing

### Testing Strategy
- **Unit Tests:** ทดสอบ components
- **Integration Tests:** ทดสอบ API integration
- **E2E Tests:** ทดสอบ user flows
- **Performance Tests:** ทดสอบประสิทธิภาพ

### Testing Tools
- **Jest:** Unit testing framework
- **React Testing Library:** Component testing
- **Cypress:** E2E testing
- **Lighthouse:** Performance testing

## 📋 Development Phases

### Phase 1: Core Setup
- [x] ติดตั้ง React และ dependencies
- [x] ตั้งค่า Webpack และ Babel
- [x] สร้างโครงสร้างโปรเจค
- [ ] ตั้งค่า LIFF SDK
- [ ] สร้าง basic components

### Phase 2: Customer Features
- [ ] สร้างหน้า Home
- [ ] สร้างหน้า Products
- [ ] สร้างหน้า Cart
- [ ] สร้างหน้า Checkout
- [ ] สร้างหน้า Orders
- [ ] สร้างหน้า Tracking

### Phase 3: Driver Features
- [ ] สร้างหน้า Driver Home
- [ ] สร้างหน้า Assignments
- [ ] สร้างหน้า Driver Profile
- [ ] สร้างระบบอัปเดตสถานะ

### Phase 4: Payment Integration
- [ ] เชื่อมต่อ LINE Pay
- [ ] เชื่อมต่อ PromptPay
- [ ] เชื่อมต่อ TrueMoney
- [ ] เชื่อมต่อ Rabbit
- [ ] เชื่อมต่อ SCB Easy

### Phase 5: PDPA & Security
- [ ] สร้างหน้า Privacy Policy
- [ ] สร้างระบบ Consent Management
- [ ] สร้างหน้า Data Export
- [ ] เพิ่ม Security features

### Phase 6: Testing & Deployment
- [ ] เขียน Unit Tests
- [ ] เขียน Integration Tests
- [ ] เขียน E2E Tests
- [ ] Performance Testing
- [ ] Production Deployment

## 🎯 Success Criteria

### Functional Requirements
- ✅ ลูกค้าสามารถสั่งซื้อสินค้าผ่าน LINE LIFF
- ✅ คนขับสามารถรับงานและอัปเดตสถานะผ่าน LINE LIFF
- ✅ ระบบชำระเงินทำงานได้ถูกต้อง
- ✅ ระบบ PDPA ทำงานได้ถูกต้อง

### Non-Functional Requirements
- ✅ หน้าเว็บโหลดเร็ว (< 3 วินาที)
- ✅ รองรับมือถือได้ดี
- ✅ ใช้งานง่าย เข้าใจง่าย
- ✅ ปลอดภัยและเป็นส่วนตัว

### Business Requirements
- ✅ เพิ่มยอดขายผ่าน LINE
- ✅ ลดต้นทุนการพัฒนาแอป
- ✅ เพิ่มความสะดวกให้ลูกค้า
- ✅ ปรับปรุงประสิทธิภาพการจัดส่ง

## 📞 Support & Maintenance

### Development Team
- **Frontend Developer:** React, LIFF, UI/UX
- **Backend Developer:** Django, API, Database
- **DevOps Engineer:** Deployment, Infrastructure
- **QA Engineer:** Testing, Quality Assurance

### Maintenance
- **Bug Fixes:** แก้ไขข้อผิดพลาด
- **Feature Updates:** อัปเดตฟีเจอร์ใหม่
- **Performance Optimization:** ปรับปรุงประสิทธิภาพ
- **Security Updates:** อัปเดตความปลอดภัย

### Documentation
- **API Documentation:** Swagger/OpenAPI
- **User Manual:** คู่มือการใช้งาน
- **Developer Guide:** คู่มือสำหรับนักพัฒนา
- **Deployment Guide:** คู่มือการ deploy

---

**Last Updated:** October 23, 2025  
**Version:** 1.0.0  
**Status:** In Development



