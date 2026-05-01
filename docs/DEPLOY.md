# Deploy แบบฟรี (แนะนำสำหรับโปรเจ็กต์นี้)

โครงสร้างที่ใช้:

| ชั้น | บริการ | หมายเหตุ |
|------|---------|-----------|
| **ฐานข้อมูล** | [Neon](https://neon.tech) | PostgreSQL ฟรี tier |
| **Backend (Django)** | [Render](https://render.com) | Docker + `Dockerfile` ใน repo |
| **Frontend (React)** | [Cloudflare Pages](https://pages.cloudflare.com) | build จากโฟลเดอร์ `frontend/` |

ลำดับที่ทำจะสะดวกที่สุด: **Neon → Render → Cloudflare Pages** แล้วค่อยใส่ URL ให้ครบใน env

---

## 1) สร้าง PostgreSQL ที่ Neon

1. สมัคร / เข้า [console.neon.tech](https://console.neon.tech)
2. สร้าง Project (เลือก region ใกล้ เช่น Singapore ถ้ามี)
3. ไปที่ **Connection string** เลือก **URI** และคัดลอก  
   - จะได้คล้าย `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`
4. เก็บไว้ใช้เป็น **`DATABASE_URL`** ใน Render (ขั้นตอนถัดไป)

---

## 2) Deploy Backend บน Render

1. เข้า [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. เชื่อม GitHub และเลือก repo **`worachetzag/shop-delivery`** (หรือ repo ของคุณ)
3. ตั้งค่า:
   - **Runtime:** Docker (เลือก Dockerfile ที่รากโปรเจ็กต์)
   - **Branch:** `main`
   - **Instance type:** Free (มี cold start เมื่อไม่มีคนใช้)
4. **Environment variables** (ตัวอย่าง — ปรับ URL ให้ตรงของคุณ):

| Key | ค่า |
|-----|-----|
| `DEBUG` | `False` |
| `SECRET_KEY` | สุ่มยาวๆ (อย่าใช้ค่าในไฟล์ dev) |
| `DATABASE_URL` | วางจาก Neon |
| `FRONTEND_URL` | URL หน้าเว็บหลัง deploy Pages (ขั้นตอน 3) เช่น `https://shop-delivery.pages.dev` |
| `CORS_ALLOWED_ORIGINS_EXTRA` | URL เดียวกับ frontend เช่น `https://shop-delivery.pages.dev` |
| `CSRF_TRUSTED_ORIGINS_EXTRA` | เดียวกับแถวบน |
| `NGROK_CROSS_SITE_COOKIES` | `True` (ให้ cookie/session ข้ามโดเมนได้เมื่อ API กับ SPA คนละโดเมนและเป็น HTTPS) |
| `RESET_DB_ON_START` | **`0`** บน production เสมอ — ถ้าเป็น `1` จะ `flush` DB ทุกครั้งที่ container start และโหลดข้อมูลสำรองยาวมาก → Render ขึ้น `No open ports detected` นานจนกว่า startup จะจบ |
| `SEED_DEMO_ON_START` | **`0`** เป็นค่าปกติ — ใส่ **`1` เฉพาะครั้งเดียว** เมื่ออยากให้รัน `seed_grocery_demo` + โหลดรูป (ใช้เวลานาน) แล้วตั้งกลับเป็น `0` ทันที — อย่าปล่อย `1` ค้างเพราะทุก deploy/restart จะ seed ใหม่ทั้งก้อน |

ค่าที่ควรมีถ้าใช้ LINE / LIFF / PromptPay (ตามที่มีอยู่ในโปรเจ็กต์):

- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_LIFF_ID`, …  
  (หรือใช้ไฟล์ `line_config.env` เฉพาะบางส่วนที่โค้ดอ่านอยู่แล้ว — บน Render ใส่เป็น env จะชัดที่สุด)

5. กด **Create Web Service** แล้วรอ build เสร็จ  
6. จด URL backend เช่น `https://shop-delivery-api.onrender.com`
7. ถ้ารูปจาก seed ขึ้น 404 หลัง deploy/restart ให้ตั้ง `SEED_DEMO_ON_START=1` แล้ว deploy **หนึ่งรอบ** — พอขึ้นปกติแล้วให้ตั้งกลับเป็น `0` (ถ้าปล่อย `1` ค้าง + `RESET_DB_ON_START=1` จะเห็น log คล้าย seed หมวดสินค้ายาวๆ และ `"No open ports detected"` ค้างจนกว่า startup จะจบ)

### Shell บน Render (ครั้งแรก)

จาก Dashboard → เลือก service → **Shell** (ถ้ามี) หรือใช้ one-off deploy script:

```bash
cd shop_delivery && python manage.py createsuperuser
```

ถ้าไม่มี Shell ฟรี ให้รัน migrate/createsuperuser ผ่าน **SSH** หรือเพิ่มขั้นตอนใน CI — อย่างน้อย migration จะรันอัตโนมัติจาก `Dockerfile` CMD อยู่แล้ว

### รูปสินค้าโหลดไม่ขึ้น / 404 หลัง deploy (ข้อมูลในฐานยังอยู่)

บน Render **ดิสก์ของ container ไม่ถาวร** — โฟลเดอร์ `media/` (รูปที่อัปโหลดหรือที่คำสั่ง seed โหลดมา) **จะหายเมื่อ redeploy หรือ restart** แต่ฟิลด์ `image` ใน DB ยังชี้ path เดิม จึงเห็นรูปพัง

**อย่ารัน seed บนเครื่องตัวเองถ้า `DATABASE_URL` ชี้ production:** คำสั่งจะเขียนไฟล์ลง **โฟลเดอร์ `media/` บนเครื่องคุณ** และอัปเดตแถวใน Neon — พอเปิด URL บน Render ไฟล์ไม่ได้อยู่บน container เลยได้ **404** แม้รัน seed “สำเร็จ” แล้ว  

#### ถ้าไม่มี Render Shell / Shell เสียเงิน — ใช้วิธีนี้ได้บนฟรี (ไม่ต้องเปิด Shell)

รันโหลดรูปบน **ตัว container เดียวกับที่รันเว็บ** โดยให้คำสั่งใน `Dockerfile` ทำงานตอน **เริ่ม service**:

1. ใน Dashboard → Environment ให้ **`RESET_DB_ON_START=0`** (สำคัญ — อย่าปล่อยเป็น `1`)
2. ตั้ง **`SEED_DEMO_ON_START=1`** ชั่วคราว
3. กด **Manual Deploy** / redeploy **หนึ่งรอบ** — ระหว่าง boot จะรัน `seed_grocery_demo` (โหลดรูปลงดิสก์ของ container บน Render)
4. พอเว็บขึ้นปกติและรูปโหลดได้แล้ว ให้ตั้ง **`SEED_DEMO_ON_START=0`** กลับทันที — อย่าปล่อย `1` ค้าง (ทุก restart จะ seed ใหม่และช้ามาก)

ไม่มีค่า Shell แยก — จ่ายแค่แผน Web Service ตามที่ใช้อยู่ (ฟรีทียังอยู่ในขีดจำกัดฟรี)

#### ถ้ามี Shell (หรือ SSH เข้า container ได้)

โหลดรูปอย่างเดียวโดยไม่ต้อง redeploy:

```bash
cd shop_delivery && python manage.py seed_grocery_demo --no-input --refresh-images
```

ตรวจว่าไฟล์อยู่จริงบนดิสก์:

```bash
cd shop_delivery && python manage.py check_product_media --limit 500
```

#### ถาวร — Persistent Disk + `MEDIA_ROOT`

Mount disk ใน Render แล้วตั้ง env **`MEDIA_ROOT`** เป็น path ที่ mount — `settings.py` อ่านจาก env ได้แล้ว (รูปไม่หายทุก redeploy)

#### ถาวร (แนะนำถ้าขายจริง)

เก็บไฟล์บน object storage (S3 / Cloudflare R2) ผ่าน `django-storages` — ไม่ผูกกับดิสก์ ephemeral ของ Render

---

## 3) Deploy Frontend บน Cloudflare Pages

1. เข้า [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → Connect GitHub เลือก repo เดียวกัน  
2. ตั้งค่า build:
   - **Root directory:** `frontend`
   - **Build command:** `npm ci && npm run build`
   - **Build output directory:** `dist`
3. **Environment variables** (ตั้งก่อน build เพราะ webpack embed ค่าเหล่านี้):

| Key | ค่า |
|-----|-----|
| `REACT_APP_API_BASE_URL` | `https://<ชื่อ-service>.onrender.com/api/` |
| `REACT_APP_LIFF_ENDPOINT_URL` | `https://<ชื่อ-service>.onrender.com` |

4. Deploy แล้วจะได้ URL เช่น `https://xxx.pages.dev`
5. กลับไปที่ Render แก้ `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS_EXTRA`, `CSRF_TRUSTED_ORIGINS_EXTRA` ให้ตรง URL Pages แล้ว **Manual Deploy** รอบหนึ่ง

---

## 4) LINE Developer Console

ใน LINE Developers:

- **Webhook / LIFF Endpoint** ให้ชี้ไปที่โดเมน **HTTPS** (Render API / Pages ตามที่คุณตั้งจริง)

---

## ข้อจำกัดที่ควรรู้

- **ไฟล์อัปโหลด (สลิป / รูปสินค้า)** เก็บบนดิสก์ของ container บน Render — **ถ้า restart / redeploy อาจหาย** ถ้าต้องการถาวรควรใช้ object storage (S3 / R2) ภายหลัง  
- **แผนฟรี** มี cold start และโควต้าจำกัด เหมาะทดสอบและใช้งานเล็กๆ  
- **`SECRET_KEY`** ในโค้ด dev อย่าใช้บน production — ตั้งใน Render เท่านั้น  

---

## ไฟล์ที่เกี่ยวข้องใน repo

- `Dockerfile` — migrate + collectstatic + Gunicorn  
- `requirements.txt` — `gunicorn`, `whitenoise`, `dj-database-url`, `psycopg2-binary`  
- `shop_delivery/shop_delivery/settings.py` — อ่าน `DATABASE_URL`, `DEBUG`, CORS/CSRF extra  
- `render.yaml` — blueprint ตัวอย่าง (ถ้าใช้ Render Blueprint)
