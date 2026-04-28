#!/bin/bash

# Samsung Panich Delivery - Development Server Script
# รันทั้ง Backend และ Frontend พร้อมกัน (output แยก log files)

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
    lsof -ti:4040 | xargs kill -9 2>/dev/null || true
    # Kill webpack processes
    pkill -f "webpack.*dev" 2>/dev/null || true
    # Kill Django processes
    pkill -f "manage.py runserver" 2>/dev/null || true
    # Kill ngrok processes
    pkill -f "ngrok http" 2>/dev/null || true
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

# Check if node_modules exists
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Frontend dependencies ยังไม่ได้ติดตั้ง${NC}"
    echo -e "${BLUE}📦 กำลังติดตั้ง frontend dependencies...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    cd "$SCRIPT_DIR"
fi

# Print header
echo -e "${GREEN}"
echo "=========================================="
echo "🚀 Samsung Panich Delivery System"
echo "   Development Server"
echo "=========================================="
echo -e "${NC}"

# Check if port 8000 is already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 8000 ถูกใช้งานอยู่แล้ว${NC}"
    echo -e "${YELLOW}กำลังหยุด process เดิม...${NC}"
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Start Backend Server
echo -e "${BLUE}🔙 กำลังเริ่ม Backend Server (Django)...${NC}"
cd "$BACKEND_DIR"
python manage.py runserver > /tmp/backend_dev.log 2>&1 &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Wait a bit for backend to start
sleep 3

# Check if backend is running (check port)
BACKEND_RUNNING=false
for i in {1..10}; do
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        BACKEND_RUNNING=true
        break
    fi
    sleep 1
done

if [ "$BACKEND_RUNNING" = false ]; then
    echo -e "${RED}❌ Backend Server เริ่มไม่สำเร็จ${NC}"
    echo -e "${YELLOW}กำลังตรวจสอบ error log...${NC}"
    if [ -f /tmp/backend_dev.log ]; then
        tail -20 /tmp/backend_dev.log
    fi
    exit 1
fi

echo -e "${GREEN}✅ Backend Server เริ่มแล้ว (PID: $BACKEND_PID)${NC}"
echo -e "${GREEN}   URL: http://127.0.0.1:8000${NC}"
echo -e "${GREEN}   Admin: http://127.0.0.1:8000/admin${NC}"

# Function to start/restart frontend
start_frontend() {
    # Kill existing frontend if running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}🔄 กำลังหยุด Frontend Server เดิม...${NC}"
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        pkill -f "webpack.*dev" 2>/dev/null || true
        sleep 2
    fi
    
    # Start Frontend Server
    echo -e "${BLUE}🔜 กำลังเริ่ม Frontend Server (React)...${NC}"
    cd "$FRONTEND_DIR"
    npm run dev > /tmp/frontend_dev.log 2>&1 &
    FRONTEND_PID=$!
    cd "$SCRIPT_DIR"
    
    # Wait a bit for frontend to start
    sleep 5
    
    # Check if frontend is running (check port)
    FRONTEND_RUNNING=false
    for i in {1..10}; do
        if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            FRONTEND_RUNNING=true
            break
        fi
        sleep 1
    done
    
    if [ "$FRONTEND_RUNNING" = false ]; then
        echo -e "${RED}❌ Frontend Server เริ่มไม่สำเร็จ${NC}"
        echo -e "${YELLOW}กำลังตรวจสอบ error log...${NC}"
        if [ -f /tmp/frontend_dev.log ]; then
            tail -20 /tmp/frontend_dev.log
        fi
        return 1
    fi
    
    echo -e "${GREEN}✅ Frontend Server เริ่มแล้ว (PID: $FRONTEND_PID)${NC}"
    echo -e "${GREEN}   URL: http://localhost:3000${NC}"
    return 0
}

# Function to get active ngrok public URL
get_ngrok_url() {
    local detected=""
    for i in {1..10}; do
        detected=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | sed -n 's/.*\(https:\/\/[^"]*\.ngrok-free\.app\).*/\1/p' | sed -n '1p')
        if [ -z "$detected" ]; then
            detected=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | sed -n 's/.*\(https:\/\/[^"]*\.ngrok\.io\).*/\1/p' | sed -n '1p')
        fi
        if [ -n "$detected" ]; then
            echo "$detected"
            return 0
        fi
        sleep 1
    done
    return 1
}

# Keep Django Site domain synced with current ngrok
sync_django_site_for_allauth() {
    local ngrok_url="$1"
    local ngrok_domain
    ngrok_domain=$(echo "$ngrok_url" | sed -E 's|^https?://||')
    if [ -z "$ngrok_domain" ]; then
        return 1
    fi

    echo -e "${BLUE}🔧 Sync Django Site domain for allauth...${NC}"
    cd "$BACKEND_DIR"
    "/Users/home/Zprojects/shop-delivery/venv/bin/python" manage.py shell -c "
from django.contrib.sites.models import Site
site, _ = Site.objects.get_or_create(id=1, defaults={'domain': '$ngrok_domain', 'name': 'Shop Delivery'})
site.domain = '$ngrok_domain'
site.name = 'Shop Delivery'
site.save()
print('SITE_ID=1 domain synced to', site.domain)
" >/tmp/site_sync.log 2>&1 || true
    cd "$SCRIPT_DIR"

    if rg 'SITE_ID=1 domain synced' /tmp/site_sync.log >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Django Site synced: $ngrok_domain${NC}"
    else
        echo -e "${YELLOW}⚠️  Sync Site ไม่สำเร็จ (ดู /tmp/site_sync.log)${NC}"
    fi
}

# Function to read current frontend API base from config
get_frontend_api_base() {
    local config_file="$FRONTEND_DIR/src/config/index.js"
    if [ ! -f "$config_file" ]; then
        return 1
    fi

    local api_base
    api_base=$(sed -n "s/.*API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '\([^']*\)'.*/\1/p" "$config_file" | sed -n '1p')
    if [ -n "$api_base" ]; then
        echo "$api_base"
        return 0
    fi
    return 1
}

# Start frontend for the first time
start_frontend
FRONTEND_STARTED=$?

# Start ngrok tunnel
echo -e "${BLUE}🌐 กำลังเริ่ม ngrok tunnel...${NC}"
ngrok http 8000 --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# Wait for ngrok to start and get URL
sleep 3

# Get ngrok URL from API
NGROK_URL="$(get_ngrok_url || true)"

if [ -z "$NGROK_URL" ]; then
    echo -e "${YELLOW}⚠️  ไม่สามารถดึง ngrok URL ได้ (อาจจะต้องรอสักครู่)${NC}"
    NGROK_URL="กำลังโหลด..."
else
    # Update ngrok URLs in configuration files
    echo -e "${BLUE}🔄 กำลังอัปเดต ngrok URL ในไฟล์ config...${NC}"
    "$SCRIPT_DIR/update_ngrok_url.sh" "$NGROK_URL" > /dev/null 2>&1
    sync_django_site_for_allauth "$NGROK_URL"
    echo -e "${GREEN}✅ อัปเดต config files แล้ว${NC}"
    
    # Restart frontend to use new config
    echo -e "${BLUE}🔄 กำลัง restart Frontend Server เพื่อใช้ config ใหม่...${NC}"
    start_frontend
    FRONTEND_STARTED=$?
    
    if [ "$FRONTEND_STARTED" = 0 ]; then
        echo -e "${GREEN}✅ Frontend Server restart สำเร็จ${NC}"
        CURRENT_API_BASE="$(get_frontend_api_base || true)"
        if [ -n "$CURRENT_API_BASE" ]; then
            echo -e "${GREEN}   Frontend API Base: $CURRENT_API_BASE${NC}"
        fi
    fi
fi

echo -e "${GREEN}"
echo "=========================================="
echo "✅ Servers พร้อมใช้งานแล้ว!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://127.0.0.1:8000"
echo "👤 Admin:    http://127.0.0.1:8000/admin"
echo ""
echo "🌐 Ngrok URL (สำหรับ LINE):"
echo "   $NGROK_URL"
echo "   API: $NGROK_URL/api/"
echo "   Admin: $NGROK_URL/admin/"
CURRENT_API_BASE="$(get_frontend_api_base || true)"
if [ -n "$CURRENT_API_BASE" ]; then
    echo "🧭 Frontend API Base: $CURRENT_API_BASE"
fi
echo ""
echo "⌨️  Controls:"
echo "   r = restart frontend"
echo "   u = sync latest ngrok URL + restart frontend"
echo "   q = quit (or Ctrl+C)"
echo "=========================================="
echo -e "${NC}"

# Keyboard loop: allow quick frontend restart without stopping everything
while true; do
    # If any critical process is gone, stop all
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${RED}❌ Backend process stopped unexpectedly${NC}"
        cleanup
    fi
    if ! kill -0 "$NGROK_PID" 2>/dev/null; then
        echo -e "${RED}❌ Ngrok process stopped unexpectedly${NC}"
        cleanup
    fi

    # Non-blocking key read every 1 second
    if read -r -s -n 1 -t 1 key; then
        case "$key" in
            r|R)
                echo -e "\n${BLUE}🔄 Manual restart frontend...${NC}"
                start_frontend || echo -e "${RED}❌ Frontend restart failed${NC}"
                ;;
            u|U)
                echo -e "\n${BLUE}🔄 Sync latest ngrok URL and restart frontend...${NC}"
                NEW_NGROK_URL="$(get_ngrok_url || true)"
                if [ -z "$NEW_NGROK_URL" ]; then
                    echo -e "${YELLOW}⚠️  ไม่พบ ngrok URL ใหม่จาก API${NC}"
                else
                    NGROK_URL="$NEW_NGROK_URL"
                    "$SCRIPT_DIR/update_ngrok_url.sh" "$NGROK_URL" > /dev/null 2>&1
                    sync_django_site_for_allauth "$NGROK_URL"
                    start_frontend || echo -e "${RED}❌ Frontend restart failed${NC}"
                    echo -e "${GREEN}✅ Synced ngrok URL: $NGROK_URL${NC}"
                    CURRENT_API_BASE="$(get_frontend_api_base || true)"
                    if [ -n "$CURRENT_API_BASE" ]; then
                        echo -e "${GREEN}✅ Frontend API Base: $CURRENT_API_BASE${NC}"
                    fi
                fi
                ;;
            q|Q)
                cleanup
                ;;
        esac
    fi
done
