# Samsung Panich Delivery System - Makefile

.PHONY: help install setup run test clean migrate makemigrations createsuperuser shell

# Default target
help:
	@echo "Samsung Panich Delivery System - Available Commands:"
	@echo ""
	@echo "  install     - Install Python dependencies"
	@echo "  setup       - Complete setup (install + migrate + createsuperuser)"
	@echo "  run         - Run development server"
	@echo "  test        - Run tests"
	@echo "  clean       - Clean temporary files"
	@echo "  migrate     - Run database migrations"
	@echo "  makemigrations - Create database migrations"
	@echo "  createsuperuser - Create Django superuser"
	@echo "  shell       - Open Django shell"
	@echo "  frontend    - Setup frontend dependencies"
	@echo "  frontend-dev - Run frontend development server"
	@echo "  dev         - Run both backend and frontend together"
	@echo "  dev-simple  - Run both backend and frontend (with output)"
	@echo ""

# Install Python dependencies
install:
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt

# Complete setup
setup: install migrate createsuperuser
	@echo "Setup complete! You can now run 'make run' to start the server."

# Run development server
run:
	@echo "Starting Django development server..."
	cd shop_delivery && python manage.py runserver

# Run tests
test:
	@echo "Running tests..."
	cd shop_delivery && python manage.py test

# Clean temporary files
clean:
	@echo "Cleaning temporary files..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type f -name "*.log" -delete
	find . -type f -name ".DS_Store" -delete

# Database migrations
migrate:
	@echo "Running database migrations..."
	cd shop_delivery && python manage.py migrate

# Create migrations
makemigrations:
	@echo "Creating database migrations..."
	cd shop_delivery && python manage.py makemigrations

# Create superuser
createsuperuser:
	@echo "Creating Django superuser..."
	cd shop_delivery && python manage.py createsuperuser

# Django shell
shell:
	@echo "Opening Django shell..."
	cd shop_delivery && python manage.py shell

# Frontend setup
frontend:
	@echo "Setting up frontend dependencies..."
	cd frontend && npm install

# Frontend development server
frontend-dev:
	@echo "Starting frontend development server..."
	cd frontend && npm run dev

# Run both backend and frontend together
dev:
	@echo "Starting both Backend and Frontend servers..."
	@./run_dev.sh

# Run both backend and frontend (simple version with output)
dev-simple:
	@echo "Starting both Backend and Frontend servers (with output)..."
	@./run_dev_simple.sh

# Full development setup
dev-setup: setup frontend
	@echo "Full development setup complete!"
	@echo "Backend: make run"
	@echo "Frontend: make frontend-dev"

# Production setup
prod-setup: install migrate
	@echo "Production setup complete!"
	@echo "Remember to set DEBUG=False and configure production settings."

# Check code quality
lint:
	@echo "Checking code quality..."
	cd shop_delivery && python -m flake8 .
	cd shop_delivery && python -m black --check .

# Format code
format:
	@echo "Formatting code..."
	cd shop_delivery && python -m black .

# Security check
security:
	@echo "Running security checks..."
	cd shop_delivery && python -m bandit -r .

# Documentation
docs:
	@echo "Generating documentation..."
	cd shop_delivery && python -m sphinx-build -b html docs docs/_build/html

# Backup database
backup:
	@echo "Backing up database..."
	cd shop_delivery && python manage.py dumpdata > backup_$(shell date +%Y%m%d_%H%M%S).json

# Restore database
restore:
	@echo "Restoring database..."
	cd shop_delivery && python manage.py loaddata backup_*.json

# Docker setup
docker-build:
	@echo "Building Docker image..."
	docker build -t samsung-panich-delivery .

# Docker run
docker-run:
	@echo "Running Docker container..."
	docker run -p 8000:8000 samsung-panich-delivery

# Docker compose
docker-compose-up:
	@echo "Starting Docker Compose..."
	docker-compose up -d

# Docker compose down
docker-compose-down:
	@echo "Stopping Docker Compose..."
	docker-compose down

# Show project status
status:
	@echo "Samsung Panich Delivery System Status:"
	@echo "======================================"
	@echo "Backend API: ✅ 100% Complete"
	@echo "Database Models: ✅ 100% Complete"
	@echo "Authentication: ✅ 100% Complete"
	@echo "PDPA Compliance: ✅ 100% Complete"
	@echo "Payment Integration: ✅ 100% Complete"
	@echo "Frontend Setup: ✅ 100% Complete"
	@echo "LINE LIFF Integration: ⏳ Ready for Development"
	@echo ""
	@echo "Next Steps:"
	@echo "1. Frontend Development - พัฒนา React Components"
	@echo "2. LINE LIFF Integration - เชื่อมต่อกับ LINE Platform"
	@echo "3. Store Admin Dashboard - พัฒนา Web Dashboard"
	@echo "4. Testing & Deployment - ทดสอบและ Deploy"



