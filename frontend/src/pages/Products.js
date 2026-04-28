import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ApiPaginationBar from '../components/ApiPaginationBar';
import { productsService, cartService } from '../services/api';
import './Products.css';
import { usePopup } from '../components/PopupProvider';

const PAGE_SIZE = 12;

const Products = () => {
  const popup = usePopup();
  const readCartCache = () => {
    try {
      const raw = localStorage.getItem('products_cart_quantities');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const [products, setProducts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('name');
  const [cartQuantities, setCartQuantities] = useState(readCartCache);
  const [cartLineItems, setCartLineItems] = useState([]);
  const [showCartSummary, setShowCartSummary] = useState(false);
  const [listReady, setListReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, debouncedSearch, sortBy]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const categoriesResponse = await productsService.getCategories();
        if (cancelled) return;
        const raw = categoriesResponse?.results ?? categoriesResponse;
        const list = Array.isArray(raw) ? raw : [];
        setCategories([{ id: '', name: 'ทั้งหมด' }, ...list]);
      } catch (error) {
        console.error('Error fetching categories:', error);
        if (!cancelled) setCategories([{ id: '', name: 'ทั้งหมด' }]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const ordering =
          sortBy === 'price-low' ? 'price' : sortBy === 'price-high' ? '-price' : 'name';
        const params = { page, page_size: PAGE_SIZE, ordering };
        if (selectedCategory) params.category_id = selectedCategory;
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

        const productsResponse = await productsService.getProducts(params);
        if (cancelled) return;

        const list = productsResponse.results || productsResponse;
        setProducts(Array.isArray(list) ? list : []);
        setTotalCount(
          typeof productsResponse.count === 'number'
            ? productsResponse.count
            : Array.isArray(list)
              ? list.length
              : 0
        );
      } catch (error) {
        console.error('Error fetching products:', error);
        if (!cancelled) {
          setProducts([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setListReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, selectedCategory, debouncedSearch, sortBy]);

  const syncCartQuantities = async () => {
    try {
      const cartResponse = await cartService.getCart();
      const items = cartResponse.items || [];
      setCartLineItems(Array.isArray(items) ? items : []);
      const quantityMap = {};
      items.forEach((item) => {
        quantityMap[item.product_id || item.id] = Number(item.quantity || 0);
      });
      setCartQuantities(quantityMap);
    } catch (error) {
      console.error('Cart sync failed:', error);
    }
  };

  useEffect(() => {
    syncCartQuantities();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('products_cart_quantities', JSON.stringify(cartQuantities));
    } catch (error) {
      // Ignore storage write errors.
    }
  }, [cartQuantities]);

  const handleAddToCart = async (product) => {
    const currentQty = Number(cartQuantities[product.id] || 0);
    const nextQty = currentQty + 1;
    if (nextQty > Number(product.stock_quantity || 0)) {
      return;
    }

    try {
      if (currentQty > 0) {
        await cartService.updateCartItem(product.id, nextQty);
      } else {
        await cartService.addToCart(product.id, 1);
      }
      setCartQuantities((prev) => ({ ...prev, [product.id]: nextQty }));
      syncCartQuantities();
    } catch (error) {
      console.error('Error adding to cart:', error);
      popup.error(error?.error || 'ไม่สามารถเพิ่มสินค้าในตะกร้าได้');
    }
  };

  const handleIncreaseQuantity = async (product) => {
    const currentQty = Number(cartQuantities[product.id] || 0);
    const nextQty = currentQty + 1;
    if (nextQty > Number(product.stock_quantity || 0)) {
      return;
    }
    try {
      await cartService.updateCartItem(product.id, nextQty);
      setCartQuantities((prev) => ({ ...prev, [product.id]: nextQty }));
      await syncCartQuantities();
    } catch (error) {
      console.error('Error increasing quantity:', error);
      popup.error(error?.error || 'ไม่สามารถอัปเดตจำนวนสินค้าได้');
    }
  };

  const handleDecreaseQuantity = async (product) => {
    const currentQty = Number(cartQuantities[product.id] || 0);
    if (currentQty <= 0) {
      return;
    }
    const nextQty = currentQty - 1;
    try {
      await cartService.updateCartItem(product.id, nextQty);
      setCartQuantities((prev) => {
        const next = { ...prev };
        if (nextQty <= 0) {
          delete next[product.id];
        } else {
          next[product.id] = nextQty;
        }
        return next;
      });
      await syncCartQuantities();
    } catch (error) {
      console.error('Error decreasing quantity:', error);
      popup.error(error?.error || 'ไม่สามารถอัปเดตจำนวนสินค้าได้');
    }
  };

  const lineToProductStub = (line) => ({
    id: line.product_id || line.id,
    name: line.name || line.product_name,
    stock_quantity: line.stock_quantity ?? 999999,
  });

  const totalCartQuantity = Object.values(cartQuantities).reduce((sum, qty) => sum + Number(qty || 0), 0);
  const floatingLines = cartLineItems.filter((line) => Number(cartQuantities[line.product_id || line.id] || 0) > 0);

  if (!listReady) {
    return (
      <div className="loading">
        กำลังโหลดสินค้า...
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="container">
        <div className="page-header">
          <h1 className="page-title">สินค้าทั้งหมด</h1>
          <p className="page-subtitle">เลือกสินค้าที่คุณต้องการ</p>
        </div>

        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="ค้นหาสินค้า..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="filters">
            <div className="filter-group">
              <label className="form-label">หมวดหมู่:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-input"
              >
                {Array.isArray(categories) &&
                  categories.map((category) => (
                    <option key={category.id === '' ? 'all' : category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="form-label">เรียงตาม:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-input"
              >
                <option value="name">ชื่อสินค้า</option>
                <option value="price-low">ราคาต่ำ-สูง</option>
                <option value="price-high">ราคาสูง-ต่ำ</option>
              </select>
            </div>
          </div>
        </div>

        <div className="results-section">
          <div className="results-header">
            <p className="results-count">พบสินค้า {totalCount} รายการ{loading ? ' (กำลังโหลด...)' : ''}</p>
          </div>

          {loading && products.length === 0 ? (
            <div className="loading" style={{ minHeight: '120px' }}>
              กำลังโหลด...
            </div>
          ) : products.length > 0 ? (
            <>
              <div className="products-grid">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    cartQuantity={Number(cartQuantities[product.id] || 0)}
                    onAddToCart={handleAddToCart}
                    onIncreaseQuantity={handleIncreaseQuantity}
                    onDecreaseQuantity={handleDecreaseQuantity}
                    showCartInfo={false}
                  />
                ))}
              </div>
              <ApiPaginationBar
                count={totalCount}
                page={page}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          ) : (
            <div className="no-results">
              <div className="no-results-icon">🔍</div>
              <h3>ไม่พบสินค้าที่ค้นหา</h3>
              <p>ลองเปลี่ยนคำค้นหาหรือหมวดหมู่</p>
            </div>
          )}
        </div>
      </div>

      {totalCartQuantity > 0 && (
        <div className="floating-cart-wrapper">
          <button
            type="button"
            className="floating-cart-button"
            onClick={() => setShowCartSummary((prev) => !prev)}
          >
            <span className="floating-cart-icon">🛒</span>
            <span className="floating-cart-text">ในตะกร้า {totalCartQuantity} ชิ้น</span>
          </button>

          {showCartSummary && (
            <div className="floating-cart-summary">
              <div className="floating-cart-summary-title">สรุปตะกร้าสินค้า</div>
              <div className="floating-cart-items">
                {floatingLines.map((line) => {
                  const stub = lineToProductStub(line);
                  const qty = Number(cartQuantities[stub.id] || 0);
                  if (qty <= 0) return null;
                  return (
                    <div key={stub.id} className="floating-cart-item">
                      <span className="floating-cart-item-name">{stub.name}</span>
                      <div className="floating-cart-item-actions">
                        <button type="button" onClick={() => handleDecreaseQuantity(stub)}>
                          -
                        </button>
                        <span>{qty}</span>
                        <button type="button" onClick={() => handleIncreaseQuantity(stub)}>
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Link to="/customer/checkout" className="floating-checkout-link">
                ไปหน้าชำระเงิน
              </Link>
              <Link to="/customer/cart" className="floating-cart-link">
                ไปหน้าตะกร้า
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Products;
