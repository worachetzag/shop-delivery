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

if [[ "${PRESERVE_STORE_SETTINGS}" == "1" ]]; then
  echo "กำลังสำรองค่าตั้งค่าร้าน..."
  python3 manage.py dumpdata orders.StoreLocation orders.DeliveryFeeTier logistics.ServiceHours --indent 2 > "${BACKUP_FILE}" || echo "[]" > "${BACKUP_FILE}"
fi

echo "กำลังล้างข้อมูลทั้งหมด..."
python3 manage.py flush --no-input

echo "กำลังรัน migrate ให้ schema ล่าสุด..."
python3 manage.py migrate --no-input

if [[ "${SEED_DEMO:-1}" == "1" ]]; then
  echo "กำลัง seed ข้อมูลเดโม..."
  python3 manage.py seed_grocery_demo --refresh-images
fi

if [[ "${PRESERVE_STORE_SETTINGS}" == "1" && -s "${BACKUP_FILE}" ]]; then
  echo "กำลังกู้คืนค่าตั้งค่าร้าน..."
  python3 manage.py loaddata "${BACKUP_FILE}" >/dev/null || true
fi

echo "เสร็จแล้ว: ล้างข้อมูลเทสเรียบร้อย (คงค่าตั้งค่าร้านไว้)"
