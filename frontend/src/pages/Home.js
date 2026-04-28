import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { productsService } from '../services/api';
import './Home.css';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch featured products from API
    const fetchFeaturedProducts = async () => {
      try {
        const response = await productsService.getProducts({
          special_offer: 'true',
          page_size: 48,
        });
        console.log('API Response:', response); // Debug log
        const products = response.results || response || [];
        setFeaturedProducts(Array.isArray(products) ? products : []);
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
      <div className="loading">
        กำลังโหลดสินค้าแนะนำ...
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
              ยินดีต้อนรับสู่ Samsung Panich Delivery
            </h1>
            <p className="hero-subtitle">
              สั่งซื้อสินค้า Samsung ผ่าน LINE ได้ง่ายๆ พร้อมบริการจัดส่งถึงบ้าน
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
                <ProductCard key={product.id} product={product} />
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
