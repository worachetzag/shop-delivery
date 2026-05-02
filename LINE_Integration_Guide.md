# 📱 การใช้งาน LINE ในระบบ Samsung Panich Delivery

## 🎯 ภาพรวม
ระบบใช้ LINE ใน 3 ส่วนหลัก:
1. **LINE LIFF** - สำหรับลูกค้าและคนขับ
2. **LINE Bot** - สำหรับการแจ้งเตือน
3. **LINE Pay** - สำหรับการชำระเงิน

## 🔧 การตั้งค่า

### 1. สร้าง LINE Channel
1. เข้าไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Provider ใหม่
3. สร้าง Messaging API Channel
4. สร้าง LIFF App

### 2. ตั้งค่า Environment Variables
```bash
# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your-channel-access-token
LINE_CHANNEL_SECRET=your-channel-secret
LINE_LIFF_ID=your-liff-id

# LINE Pay
LINE_PAY_CHANNEL_ID=your-line-pay-channel-id
LINE_PAY_CHANNEL_SECRET=your-line-pay-channel-secret
LINE_PAY_MERCHANT_ID=your-line-pay-merchant-id
```

### 3. ตั้งค่า Webhook URL
- **LINE Bot Webhook:** `https://yourdomain.com/api/line/webhook/`
- **LINE Pay Webhook:** `https://yourdomain.com/api/payments/line-pay/webhook/`

## 🤖 LINE Bot Features

### การแจ้งเตือนอัตโนมัติ
- **สร้างคำสั่งซื้อ** - แจ้งลูกค้าเมื่อสร้างคำสั่งซื้อสำเร็จ
- **จัดเตรียมสินค้า** - แจ้งลูกค้าเมื่อเริ่มจัดเตรียมสินค้า
- **พร้อมรับ/ส่ง** - แจ้งลูกค้าเมื่อสินค้าพร้อม
- **กำลังจัดส่ง** - แจ้งลูกค้าเมื่อเริ่มจัดส่ง
- **จัดส่งสำเร็จ** - แจ้งลูกค้าเมื่อจัดส่งสำเร็จ
- **ชำระเงินสำเร็จ** - แจ้งลูกค้าเมื่อชำระเงินสำเร็จ
- **มอบหมายงาน** - แจ้งคนขับเมื่อได้รับมอบหมายงาน

### การโต้ตอบ
- **สวัสดี** - ตอบกลับด้วยข้อความต้อนรับ
- **สั่งซื้อ** - แสดงเมนูสั่งซื้อ
- **ติดตาม** - แสดงเมนูติดตามคำสั่งซื้อ

## 📱 LINE LIFF Features

### โฟลว์ภาพสำหรับลูกค้า (แชร์ลิงก์ได้)

หลัง deploy frontend มีหน้าเว็บนิ่งที่มีไดอะแกรมอธิบายภาพรวม (เปิดจากมือถือหรือคอมได้):

`https://<โดเมน-frontend>/line-flow.html`

ตัวอย่าง: [https://shop-delivery.pages.dev/line-flow.html](https://shop-delivery.pages.dev/line-flow.html)

**ไฟล์เดียวเปิดในเครื่องได้ (ไม่ต้องมีเน็ต):** ใน repo มี `docs/line-flow-customer-offline.html` — คัดลอกไฟล์นี้ไปให้ลูกค้าหรือส่งเป็นแนบ แล้วดับเบิลคลิกเปิดใน Chrome / Safari / Edge ได้ทันที

### สำหรับลูกค้า
- **ดูสินค้า** - ดูรายการสินค้าทั้งหมด
- **ตะกร้าสินค้า** - จัดการสินค้าในตะกร้า
- **สั่งซื้อ** - สร้างคำสั่งซื้อใหม่
- **ติดตามคำสั่งซื้อ** - ดูสถานะคำสั่งซื้อ
- **ชำระเงิน** - ชำระเงินผ่าน LINE Pay

### สำหรับคนขับ
- **รับงาน** - ดูงานที่ได้รับมอบหมาย
- **อัปเดตสถานะ** - อัปเดตสถานะการจัดส่ง
- **ติดต่อลูกค้า** - ติดต่อลูกค้าเมื่อจำเป็น

### Rich Menu / ลิงก์ LIFF (ลูกค้า)

ใน LINE WebView บางครั้ง **path หลัง LIFF ID** (เช่น `/customer/products`) ไม่ถูกส่งต่อไปยังเว็บ — ทุกปุ่มจึงเปิดมาที่หน้าแรก (`/customer`) เหมือนกัน

**แนะนำ:** ตั้งลิงก์ปุ่ม Rich Menu เป็นรูปแบบ **`?page=`** (คีย์เป็นตัวพิมพ์เล็ก):

| ปุ่ม | ตัวอย่าง LIFF URL |
|------|-------------------|
| หน้าแรก | `https://liff.line.me/<LIFF_ID>?page=home` |
| สินค้า | `https://liff.line.me/<LIFF_ID>?page=products` |
| ตะกร้า | `https://liff.line.me/<LIFF_ID>?page=cart` |
| ออเดอร์ | `https://liff.line.me/<LIFF_ID>?page=orders` |

คีย์อื่นที่แอปรองรับ: `checkout`, `tracking`, `profile`, `login`

**หมายเหตุสำคัญ:** ตามพฤติกรรม LINE (primary redirect) พารามิเตอร์หลัง `liff.line.me/...` อาจถูกย้ายไปอยู่ใน **`liff.state`** บน URL ของเว็บจริง ไม่ได้เหลือเป็น `?page=` ให้เห็นตรงๆ — แอปจึงอ่านทั้ง `page` และ **`liff.state`** (ถอดรหัสแล้วดึง `page`) ใน `App.js`

ถ้าใช้ path เต็ม (`.../customer/products`) แล้วทำงานถูกต้องในเครื่องคุณก็ใช้ต่อได้ — Rich Menu แบบ `?page=` ยังใช้ได้และควรทำงานหลังแก้ด้านบน

## 🔗 API Endpoints

### LINE Bot API
- `POST /api/line/webhook/` - รับ Webhook จาก LINE
- `POST /api/line/send-notification/` - ส่งการแจ้งเตือน
- `GET /api/line/users/` - รายการผู้ใช้งาน LINE Bot

### LINE Pay API
- `POST /api/payments/line-pay/` - สร้างการชำระเงิน LINE Pay
- `POST /api/payments/line-pay/webhook/` - รับ Webhook จาก LINE Pay

## 📋 ขั้นตอนการใช้งาน

### สำหรับลูกค้า
1. **เพิ่มเพื่อน LINE Bot** - สแกน QR Code หรือค้นหา ID
2. **เปิด LIFF** - คลิกปุ่มใน LINE Bot หรือเข้าไปที่ LIFF URL
3. **สั่งซื้อสินค้า** - เลือกสินค้าและเพิ่มในตะกร้า
4. **ชำระเงิน** - ชำระเงินผ่าน LINE Pay
5. **ติดตามคำสั่งซื้อ** - ดูสถานะผ่าน LINE Bot หรือ LIFF

### สำหรับคนขับ
1. **เพิ่มเพื่อน LINE Bot** - สแกน QR Code หรือค้นหา ID
2. **เปิด LIFF** - คลิกปุ่มใน LINE Bot หรือเข้าไปที่ LIFF URL
3. **รับงาน** - ดูงานที่ได้รับมอบหมาย
4. **อัปเดตสถานะ** - อัปเดตสถานะการจัดส่ง
5. **ติดต่อลูกค้า** - ติดต่อลูกค้าเมื่อจำเป็น

## 🔒 ความปลอดภัย

### Webhook Verification
- ใช้ X-Line-Signature header เพื่อยืนยันความถูกต้อง
- ตรวจสอบ signature ด้วย HMAC-SHA256

### Data Protection
- เก็บข้อมูลผู้ใช้งานตาม PDPA
- ไม่เก็บข้อมูลส่วนบุคคลที่ไม่จำเป็น
- มีระบบ audit log สำหรับการเข้าถึงข้อมูล

## 🚀 การ Deploy

### Production Settings
```python
# settings.py
LINE_CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
LINE_CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET')
LINE_LIFF_ID = os.getenv('LINE_LIFF_ID')
```

### SSL Certificate
- ต้องใช้ HTTPS สำหรับ Webhook
- ใช้ Let's Encrypt หรือ SSL Certificate อื่น

## 📊 Monitoring

### Logs
- บันทึกการส่งข้อความ
- บันทึกการแจ้งเตือน
- บันทึกข้อผิดพลาด

### Analytics
- จำนวนผู้ใช้งาน LINE Bot
- จำนวนการแจ้งเตือนที่ส่ง
- อัตราการตอบสนอง

## 🛠️ Troubleshooting

### ปัญหาที่พบบ่อย
1. **Webhook ไม่ทำงาน** - ตรวจสอบ URL และ SSL
2. **ข้อความไม่ส่ง** - ตรวจสอบ Access Token
3. **LIFF ไม่เปิด** - ตรวจสอบ LIFF ID และ URL

### การ Debug
```python
# เปิด debug mode
DEBUG = True

# ดู logs
tail -f logs/django.log
```

## 📞 การสนับสนุน

### ติดต่อทีมพัฒนา
- **Email:** dev@samsungpanich.com
- **LINE:** @samsungpanich-dev
- **Phone:** 02-xxx-xxxx

### เอกสารเพิ่มเติม
- [LINE Developers Documentation](https://developers.line.biz/)
- [LINE LIFF Documentation](https://developers.line.biz/en/docs/liff/)
- [LINE Pay Documentation](https://developers.line.biz/en/docs/line-pay/)

