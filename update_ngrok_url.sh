#!/bin/bash
# Helper script to update ngrok URLs in configuration files

NGROK_URL="$1"

if [ -z "$NGROK_URL" ]; then
    echo "Usage: $0 <ngrok-url>"
    exit 1
fi

# Extract domain from URL (remove https://)
NGROK_DOMAIN=$(echo "$NGROK_URL" | sed 's|https\?://||')

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_DIR="$(cd "$FRONTEND_DIR" && pwd 2>/dev/null)" || FRONTEND_DIR="$SCRIPT_DIR/frontend"
BACKEND_SETTINGS="$SCRIPT_DIR/shop_delivery/shop_delivery/settings.py"
BACKEND_VIEWS="$SCRIPT_DIR/shop_delivery/accounts/views.py"
FRONTEND_CONFIG="$FRONTEND_DIR/src/config/index.js"

# Backup files (only if backup doesn't exist)
if [ ! -f "$BACKEND_SETTINGS.bak" ]; then
    cp "$BACKEND_SETTINGS" "$BACKEND_SETTINGS.bak" 2>/dev/null || true
fi
if [ ! -f "$BACKEND_VIEWS.bak" ]; then
    cp "$BACKEND_VIEWS" "$BACKEND_VIEWS.bak" 2>/dev/null || true
fi
if [ -f "$FRONTEND_CONFIG" ] && [ ! -f "$FRONTEND_CONFIG.bak" ]; then
    cp "$FRONTEND_CONFIG" "$FRONTEND_CONFIG.bak" 2>/dev/null || true
fi

# Update backend settings.py using Python for precise editing
if [ -f "$BACKEND_SETTINGS" ]; then
python3 << PYTHON_SCRIPT
import re

settings_file = "$BACKEND_SETTINGS"
ngrok_domain = "$NGROK_DOMAIN"
ngrok_url = "$NGROK_URL"

with open(settings_file, 'r') as f:
    lines = f.readlines()

new_lines = []
i = 0
allowed_hosts_domain_added = False
cors_urls_added = False
csrf_urls_added = False

while i < len(lines):
    line = lines[i]
    
    # Update ALLOWED_HOSTS - remove old ngrok domains, add new one
    if re.search(r"'[^']+\.ngrok(-free)?\.app',", line) or re.search(r"'[^']+\.ngrok\.io',", line):
        # Skip this line (remove old domain)
        i += 1
        continue
    elif re.search(r"'\.ngrok-free\.app',.*#.*ngrok subdomain", line):
        # Insert new domain before this line (only once)
        if not allowed_hosts_domain_added:
            new_lines.append(f"    '{ngrok_domain}',\n")
            allowed_hosts_domain_added = True
        new_lines.append(line)
        i += 1
        continue
    
    # Update CORS_ALLOWED_ORIGINS - remove old ngrok URLs
    if re.search(r'"https://[^"]+\.ngrok(-free)?\.app",', line) or re.search(r'"https://[^"]+\.ngrok\.io",', line):
        i += 1
        continue
    if re.search(r'"http://[^"]+\.ngrok(-free)?\.app",', line) or re.search(r'"http://[^"]+\.ngrok\.io",', line):
        i += 1
        continue
    # Add new URLs after https://liff.line.me (only once)
    if '"https://liff.line.me",' in line:
        new_lines.append(line)
        if not cors_urls_added:
            new_lines.append(f'    "https://{ngrok_domain}",\n')
            new_lines.append(f'    "http://{ngrok_domain}",  # HTTP fallback\n')
            cors_urls_added = True
        i += 1
        continue
    
    # Update CSRF_TRUSTED_ORIGINS - remove old ngrok URLs
    if re.search(r"'https://[^']+\.ngrok(-free)?\.app',", line) or re.search(r"'https://[^']+\.ngrok\.io',", line):
        i += 1
        continue
    if re.search(r"'http://[^']+\.ngrok(-free)?\.app',", line) or re.search(r"'http://[^']+\.ngrok\.io',", line):
        i += 1
        continue
    # Add new URLs before https://liff.line.me (only once)
    if "'https://liff.line.me'," in line:
        if not csrf_urls_added:
            new_lines.append(f"    'https://{ngrok_domain}',\n")
            new_lines.append(f"    'http://{ngrok_domain}',\n")
            csrf_urls_added = True
        new_lines.append(line)
        i += 1
        continue
    
    new_lines.append(line)
    i += 1

with open(settings_file, 'w') as f:
    f.writelines(new_lines)

# Fix any double protocol issues (safety check)
with open(settings_file, 'r') as f:
    content = f.read()

# Fix double protocol issues
content = re.sub(r'\"http://https://', '\"https://', content)
content = re.sub(r'\"https://https://', '\"https://', content)
content = re.sub(r\"'http://https://\", \"'https://\", content)
content = re.sub(r\"'https://https://\", \"'https://\", content)

with open(settings_file, 'w') as f:
    f.write(content)

PYTHON_SCRIPT
fi

# Update backend views.py - redirect_uri
if [ -f "$BACKEND_VIEWS" ]; then
    sed -i '' "s|redirect_uri = \"https://[^\"]*\.ngrok-free\.app/accounts/line/login/callback/\"|redirect_uri = \"$NGROK_URL/accounts/line/login/callback/\"|g" "$BACKEND_VIEWS"
fi

# Update frontend config/index.js
if [ -f "$FRONTEND_CONFIG" ]; then
python3 << PYTHON_SCRIPT
import re

config_file = "$FRONTEND_CONFIG"
ngrok_url = "$NGROK_URL"

with open(config_file, 'r') as f:
    content = f.read()

# Update API_BASE_URL - replace ngrok URL in the default value
content = re.sub(
    r"API_BASE_URL: process\.env\.REACT_APP_API_BASE_URL \|\| 'https://[^']*\.ngrok(?:-free)?\.app/api/'",
    f"API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '{ngrok_url}/api/'",
    content
)
content = re.sub(
    r"API_BASE_URL: process\.env\.REACT_APP_API_BASE_URL \|\| 'https://[^']*\.ngrok\.io/api/'",
    f"API_BASE_URL: process.env.REACT_APP_API_BASE_URL || '{ngrok_url}/api/'",
    content
)

# Update LIFF_ENDPOINT_URL - replace ngrok URL in the default value
content = re.sub(
    r"LIFF_ENDPOINT_URL: process\.env\.REACT_APP_LIFF_ENDPOINT_URL \|\| 'https://[^']*\.ngrok(?:-free)?\.app'",
    f"LIFF_ENDPOINT_URL: process.env.REACT_APP_LIFF_ENDPOINT_URL || '{ngrok_url}'",
    content
)
content = re.sub(
    r"LIFF_ENDPOINT_URL: process\.env\.REACT_APP_LIFF_ENDPOINT_URL \|\| 'https://[^']*\.ngrok\.io'",
    f"LIFF_ENDPOINT_URL: process.env.REACT_APP_LIFF_ENDPOINT_URL || '{ngrok_url}'",
    content
)

with open(config_file, 'w') as f:
    f.write(content)

PYTHON_SCRIPT
fi

# Update all hardcoded ngrok URLs in frontend files
if [ -d "$FRONTEND_DIR" ]; then
    echo "🔄 กำลังอัปเดต hardcoded ngrok URLs ใน frontend files..."
    
    # Update in src directory (JS/JSX files)
    if [ -d "$FRONTEND_DIR/src" ]; then
        find "$FRONTEND_DIR/src" -type f \( -name "*.js" -o -name "*.jsx" \) -exec sed -E -i '' "s|https?://[^\"']*\.ngrok-free\.app|$NGROK_URL|g" {} \; 2>/dev/null
        find "$FRONTEND_DIR/src" -type f \( -name "*.js" -o -name "*.jsx" \) -exec sed -E -i '' "s|https?://[^\"']*\.ngrok\.io|$NGROK_URL|g" {} \; 2>/dev/null
    fi
    
    # Update webpack.config.js
    if [ -f "$FRONTEND_DIR/webpack.config.js" ]; then
        sed -E -i '' "s|https?://[^\"']*\.ngrok-free\.app|$NGROK_URL|g" "$FRONTEND_DIR/webpack.config.js" 2>/dev/null
        sed -E -i '' "s|https?://[^\"']*\.ngrok\.io|$NGROK_URL|g" "$FRONTEND_DIR/webpack.config.js" 2>/dev/null
    fi
    
    echo "✅ อัปเดต hardcoded URLs ใน frontend แล้ว"
fi

echo "✅ Updated ngrok URLs to: $NGROK_URL"
