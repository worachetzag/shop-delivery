#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/shop_delivery"

if [[ ! -f "${BACKEND_DIR}/manage.py" ]]; then
  echo "ไม่พบ manage.py ที่ ${BACKEND_DIR}"
  exit 1
fi

echo "⚠️  สคริปต์นี้จะล้างข้อมูลเทส (สินค้า/ลูกค้า/ออเดอร์ ฯลฯ)"
echo "   และจะคงค่าตั้งค่าร้านไว้ (StoreLocation/DeliveryFeeTier/ServiceHours) โดยค่าเริ่มต้น"
echo "   รวมถึงคง user กลุ่ม admin/พนักงาน/คนขับ (ลูกค้าจะถูกล้าง)"
if [[ "${FORCE_RESET:-0}" != "1" ]]; then
  read -r -p "พิมพ์ RESET เพื่อยืนยัน: " CONFIRM
  if [[ "${CONFIRM}" != "RESET" ]]; then
    echo "ยกเลิกการล้างข้อมูล"
    exit 1
  fi
fi

cd "${BACKEND_DIR}"

BACKUP_FILE="/tmp/shop_delivery_store_settings_backup.json"
PRESERVE_STORE_SETTINGS="${PRESERVE_STORE_SETTINGS:-1}"
STAFF_USERS_BACKUP_FILE="/tmp/shop_delivery_staff_users_backup.json"
PRESERVE_STAFF_USERS="${PRESERVE_STAFF_USERS:-1}"

if [[ "${PRESERVE_STORE_SETTINGS}" == "1" ]]; then
  echo "กำลังสำรองค่าตั้งค่าร้าน..."
  python3 manage.py dumpdata orders.StoreLocation orders.DeliveryFeeTier logistics.ServiceHours --indent 2 > "${BACKUP_FILE}" || echo "[]" > "${BACKUP_FILE}"
fi

if [[ "${PRESERVE_STAFF_USERS}" == "1" ]]; then
  echo "กำลังสำรอง user กลุ่มทีมงาน..."
  python3 manage.py dumpdata auth.User accounts.UserRole accounts.DriverProfile accounts.AdminProfile accounts.LineUser --indent 2 > "${STAFF_USERS_BACKUP_FILE}" || echo "[]" > "${STAFF_USERS_BACKUP_FILE}"
fi

echo "กำลังล้างข้อมูลทั้งหมด..."
python3 manage.py flush --no-input

echo "กำลังรัน migrate ให้ schema ล่าสุด..."
python3 manage.py migrate --no-input

if [[ "${SEED_DEMO:-1}" == "1" ]]; then
  echo "กำลัง seed ข้อมูลเดโม..."
  python3 manage.py seed_grocery_demo --refresh-images
fi

if [[ "${PRESERVE_STAFF_USERS}" == "1" && -s "${STAFF_USERS_BACKUP_FILE}" ]]; then
  echo "กำลังกู้คืน user กลุ่มทีมงาน..."
  python3 manage.py loaddata "${STAFF_USERS_BACKUP_FILE}" >/dev/null || true
  echo "กำลังล้าง user ลูกค้า (คงเฉพาะ admin/พนักงาน/คนขับ)..."
  python3 manage.py shell -c "from django.contrib.auth.models import User; from accounts.models import Customer, UserRole; keep_roles={'super_admin','admin','store_admin','driver'}; keep_ids=set(UserRole.objects.filter(role__in=keep_roles).values_list('user_id', flat=True)); keep_ids.update(User.objects.filter(is_superuser=True).values_list('id', flat=True)); User.objects.exclude(id__in=keep_ids).exclude(is_superuser=True).delete(); Customer.objects.exclude(user_id__in=keep_ids).delete(); UserRole.objects.exclude(user_id__in=keep_ids).delete()"
fi

if [[ "${PRESERVE_STORE_SETTINGS}" == "1" && -s "${BACKUP_FILE}" ]]; then
  echo "กำลังกู้คืนค่าตั้งค่าร้าน..."
  python3 manage.py loaddata "${BACKUP_FILE}" >/dev/null || true
fi

echo "เสร็จแล้ว: ล้างข้อมูลเทสเรียบร้อย (คงค่าร้าน + user ทีมงานไว้)"
