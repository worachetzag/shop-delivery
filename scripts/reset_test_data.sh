#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/shop_delivery"

if [[ ! -f "${BACKEND_DIR}/manage.py" ]]; then
  echo "ไม่พบ manage.py ที่ ${BACKEND_DIR}"
  exit 1
fi

echo "⚠️  สคริปต์นี้จะล้างข้อมูลทั้งหมดในฐานข้อมูล (flush) สำหรับเทส"
if [[ "${FORCE_RESET:-0}" != "1" ]]; then
  read -r -p "พิมพ์ RESET เพื่อยืนยัน: " CONFIRM
  if [[ "${CONFIRM}" != "RESET" ]]; then
    echo "ยกเลิกการล้างข้อมูล"
    exit 1
  fi
fi

cd "${BACKEND_DIR}"

echo "กำลังล้างข้อมูลทั้งหมด..."
python3 manage.py flush --no-input

echo "กำลังรัน migrate ให้ schema ล่าสุด..."
python3 manage.py migrate --no-input

if [[ "${SEED_DEMO:-1}" == "1" ]]; then
  echo "กำลัง seed ข้อมูลเดโม..."
  python3 manage.py seed_grocery_demo --refresh-images
fi

echo "เสร็จแล้ว: ฐานข้อมูลพร้อมสำหรับเริ่มเทสใหม่"
