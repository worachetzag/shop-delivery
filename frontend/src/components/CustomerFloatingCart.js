import React from 'react';
import { Link } from 'react-router-dom';
import './CustomerFloatingCart.css';

function lineToProductStub(line) {
  return {
    id: line.product_id || line.id,
    name: line.name || line.product_name,
    stock_quantity: line.stock_quantity ?? 999999,
  };
}

/**
 * ปุ่มตะกร้าลอย + แผงสรุป — เหมือนหน้ารายการสินค้า (ใช้บนหน้าแรกด้วย)
 */
export default function CustomerFloatingCart({
  cartLineItems,
  cartQuantities,
  showCartSummary,
  setShowCartSummary,
  onIncreaseQuantity,
  onDecreaseQuantity,
}) {
  const totalCartQuantity = Object.values(cartQuantities).reduce(
    (sum, qty) => sum + Number(qty || 0),
    0,
  );
  const floatingLines = cartLineItems.filter(
    (line) => Number(cartQuantities[line.product_id || line.id] || 0) > 0,
  );

  if (totalCartQuantity <= 0) return null;

  return (
    <div className="floating-cart-wrapper">
      <button
        type="button"
        className="floating-cart-button"
        onClick={() => setShowCartSummary((prev) => !prev)}
      >
        <span className="floating-cart-icon">🛒</span>
        <span className="floating-cart-text">ในตะกร้า {totalCartQuantity} ชิ้น</span>
      </button>

      {showCartSummary ? (
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
                    <button type="button" onClick={() => onDecreaseQuantity(stub)}>
                      -
                    </button>
                    <span>{qty}</span>
                    <button type="button" onClick={() => onIncreaseQuantity(stub)}>
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
      ) : null}
    </div>
  );
}
