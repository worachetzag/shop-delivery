#!/usr/bin/env bash
# แปลงไฟล์ HTML เป็น PDF ด้วย Chrome (ใช้ในเครื่องเท่านั้น — ไม่ commit HTML/PDF)
# ตัวอย่าง:
#   ./scripts/export-flow-docs-pdf.sh ~/Desktop/flow.html
# ผลลัพธ์ไปที่ docs/private/<ชื่อไฟล์>.pdf

set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${ROOT}/docs/private"
mkdir -p "$OUT"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <file.html> [file2.html ...]" >&2
  exit 1
fi

for f in "$@"; do
  abs="$(python3 -c "import os,sys; print(os.path.abspath(sys.argv[1]))" "$f")"
  base="$(basename "$f" .html)"
  pdf="${OUT}/${base}.pdf"
  echo "Writing ${pdf}"
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$pdf" "file://${abs}"
done
