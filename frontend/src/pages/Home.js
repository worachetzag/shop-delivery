import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import config from '../config';
import { productsService } from '../services/api';
import { useRestoreCustomerListingScroll } from '../utils/listingScrollRestore';
import './Home.css';

const SKELETON_CARD_COUNT = 8;

const Home = () => {
  const location = useLocation();
  useRestoreCustomerListingScroll(location);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch featured products from API
    const fetchFeaturedProducts = async () => {
      try {
        const featuredResponse = await productsService.getProducts({
          special_offer: 'true',
          page_size: 48,
        });

        let products = featuredResponse.results || featuredResponse || [];
        products = Array.isArray(products) ? products : [];

        // fallback: ถ้าไม่มีสินค้าโปรโมชัน ให้ดึงสินค้าทั่วไปมาแสดงบนหน้าแรกแทน
        if (products.length === 0) {
          const fallbackResponse = await productsService.getProducts({
            page_size: 12,
            ordering: '-created_at',
          });
          const fallbackList = fallbackResponse.results || fallbackResponse || [];
          products = Array.isArray(fallbackList) ? fallbackList : [];
        }

        setFeaturedProducts(products);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching featured products:', error);
        setError(error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  if (loading) {
    return (
      <div className="home">
        <section className="featured-products">
          <div className="container">
            <h2 className="section-title">สินค้าแนะนำ</h2>
            <div className="products-grid">
              {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
                <div key={`home-skeleton-${index}`} className="product-card-skeleton" aria-hidden="true">
                  <div className="product-card-skeleton-image" />
                  <div className="product-card-skeleton-body">
                    <div className="product-card-skeleton-line name" />
                    <div className="product-card-skeleton-line price" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h3>เกิดข้อผิดพลาด</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>ลองใหม่</button>
      </div>
    );
  }

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              ยินดีต้อนรับสู่ร้าน{config.BRANDING.storeName}
            </h1>
            <p className="hero-subtitle">
              สั่งซื้อสินค้าผ่าน LINE ได้สะดวก พร้อมบริการจัดส่งถึงบ้าน
            </p>
            <div className="hero-actions">
              <Link to="/customer/products" className="btn btn-primary">
                ดูสินค้าทั้งหมด
              </Link>
              <Link to="/customer/orders" className="btn btn-outline">
                ติดตามคำสั่งซื้อ
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured-products">
        <div className="container">
          <h2 className="section-title">สินค้าแนะนำ</h2>
          <div className="products-grid">
            {Array.isArray(featuredProducts) && featuredProducts.length > 0 ? (
              featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} listingOnly />
              ))
            ) : (
              <p>ไม่มีสินค้าแนะนำ</p>
            )}
          </div>
          <div className="text-center mt-4">
            <Link to="/customer/products" className="btn btn-primary">
              ดูสินค้าทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      {/* Promotions */}
      <section className="promotions">
        <div className="container">
          <h2 className="section-title">โปรโมชั่นพิเศษ</h2>
          <div className="promotion-cards">
            <div className="promotion-card">
              <div className="promotion-icon">🎉</div>
              <h3>ลดราคา 20%</h3>
              <p>สำหรับสินค้า Galaxy Watch 6</p>
              <span className="promotion-code">รหัส: WATCH20</span>
            </div>
            <div className="promotion-card">
              <div className="promotion-icon">🚚</div>
              <h3>จัดส่งฟรี</h3>
              <p>สำหรับคำสั่งซื้อมากกว่า 5,000 บาท</p>
              <span className="promotion-code">รหัส: FREESHIP</span>
            </div>
            <div className="promotion-card">
              <div className="promotion-icon">💳</div>
              <h3>ผ่อน 0%</h3>
              <p>ผ่อนชำระ 12 เดือน 0% ดอกเบี้ย</p>
              <span className="promotion-code">รหัส: INSTALL0</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
