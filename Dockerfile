# Samsung Panich Delivery System - Dockerfile

FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        gettext \
        curl \
        && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Create directories for logs and media
RUN mkdir -p /app/shop_delivery/logs \
    && mkdir -p /app/shop_delivery/media \
    && mkdir -p /app/shop_delivery/staticfiles

# Set permissions
RUN chmod +x /app/shop_delivery/manage.py

# Render / Docker จะส่ง PORT เข้ามา — default 8000 ตอนรันในเครื่อง
EXPOSE 8000

# migrate → optional reset/seed (preserve store settings + staff users) → collectstatic → gunicorn (production)
CMD ["sh", "-c", "cd /app/shop_delivery && if [ \"${RESET_DB_ON_START:-0}\" = \"1\" ]; then if [ \"${PRESERVE_STORE_SETTINGS_ON_RESET:-1}\" = \"1\" ]; then echo '[startup] backing up store settings before reset...'; python manage.py dumpdata orders.StoreLocation orders.DeliveryFeeTier logistics.ServiceHours > /tmp/store_settings_backup.json || echo '[]' > /tmp/store_settings_backup.json; fi; if [ \"${PRESERVE_STAFF_USERS_ON_RESET:-1}\" = \"1\" ]; then echo '[startup] backing up staff/driver/admin users before reset...'; python manage.py dumpdata auth.User accounts.UserRole accounts.DriverProfile accounts.AdminProfile accounts.LineUser > /tmp/staff_users_backup.json || echo '[]' > /tmp/staff_users_backup.json; fi; echo '[startup] RESET_DB_ON_START=1: flushing database for fresh testing...'; python manage.py flush --noinput; fi && python manage.py migrate --noinput && if [ \"${SEED_DEMO_ON_START:-0}\" = \"1\" ]; then echo '[startup] SEED_DEMO_ON_START=1: seeding demo data...'; python manage.py seed_grocery_demo --no-input --refresh-images; fi && if [ \"${RESET_DB_ON_START:-0}\" = \"1\" ] && [ \"${PRESERVE_STAFF_USERS_ON_RESET:-1}\" = \"1\" ] && [ -s /tmp/staff_users_backup.json ]; then echo '[startup] restoring staff/driver/admin users after reset...'; python manage.py loaddata /tmp/staff_users_backup.json >/dev/null || true; python manage.py shell -c \"from django.contrib.auth.models import User; from accounts.models import Customer, UserRole; keep_roles={'super_admin','admin','store_admin','driver'}; keep_ids=set(UserRole.objects.filter(role__in=keep_roles).values_list('user_id', flat=True)); keep_ids.update(User.objects.filter(is_superuser=True).values_list('id', flat=True)); User.objects.exclude(id__in=keep_ids).exclude(is_superuser=True).delete(); Customer.objects.exclude(user_id__in=keep_ids).delete(); UserRole.objects.exclude(user_id__in=keep_ids).delete()\"; fi && if [ \"${RESET_DB_ON_START:-0}\" = \"1\" ] && [ \"${PRESERVE_STORE_SETTINGS_ON_RESET:-1}\" = \"1\" ] && [ -s /tmp/store_settings_backup.json ]; then echo '[startup] restoring store settings after reset...'; python manage.py loaddata /tmp/store_settings_backup.json >/dev/null || true; fi && python manage.py collectstatic --noinput && exec gunicorn shop_delivery.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]



