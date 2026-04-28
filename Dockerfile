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

# migrate → collectstatic → gunicorn (production)
CMD ["sh", "-c", "cd /app/shop_delivery && python manage.py migrate --noinput && python manage.py collectstatic --noinput && exec gunicorn shop_delivery.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-2}"]



