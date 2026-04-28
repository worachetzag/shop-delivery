#!/bin/bash

# Samsung Panich Delivery - Simple Development Server Script
# รันทั้ง Backend และ Frontend พร้อมกัน (แสดง output ทั้งสอง)

set -e

# สีสำหรับ output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/shop_delivery"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_DIR="$(cd "$FRONTEND_DIR" && pwd)"  # Resolve to absolute path
VENV_DIR="$SCRIPT_DIR/venv"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}กำลังหยุด servers...${NC}"
    # Kill by port to be sure
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    # Kill webpack processes
    pkill -f "webpack.*dev" 2>/dev/null || true
    # Kill Django processes
    pkill -f "manage.py runserver" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}Servers หยุดแล้ว${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Check if virtual environment exists
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment ไม่พบ กำลังสร้าง...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory ไม่พบ!${NC}"
    exit 1
fi

# Print header
echo -e "${GREEN}"
echo "=========================================="
echo "🚀 Samsung Panich Delivery System"
echo "   Development Server (with logs)"
echo "=========================================="
echo -e "${NC}"

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8000 ถูกใช้งานอยู่แล้ว${NC}"
    echo -e "${YELLOW}กำลังหยุด process เดิม...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 ถูกใช้งานอยู่แล้ว${NC}"
    echo -e "${YELLOW}กำลังหยุด process เดิม...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start Backend Server in background (output will show in terminal)
echo -e "${BLUE}🔙 กำลังเริ่ม Backend Server (Django)...${NC}"
cd "$BACKEND_DIR"
python manage.py runserver &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait a bit for backend to start
sleep 2

# Start Frontend Server in background (output will show in terminal)
echo -e "${BLUE}🔜 กำลังเริ่ม Frontend Server (React)...${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

echo -e "${GREEN}"
echo "=========================================="
echo "✅ Servers กำลังรัน..."
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://127.0.0.1:8000"
echo "👤 Admin:    http://127.0.0.1:8000/admin"
echo ""
echo "📋 Logs ด้านล่าง (กด Ctrl+C เพื่อหยุด)"
echo "=========================================="
echo -e "${NC}"

# Wait for all background jobs (output will be mixed but visible)
wait
