/**
 * ราคาก่อนลดจาก API (`compare_at_price`) — ใช้เมื่อมากกว่าราคาขายจริง
 * @returns {number|null}
 */
export function getProductCompareAtPrice(product) {
  if (!product || product.compare_at_price == null || product.compare_at_price === '') return null;
  const compare = Number(product.compare_at_price);
  const sale = Number(product.price);
  if (!Number.isFinite(compare) || !Number.isFinite(sale) || compare <= sale) return null;
  return compare;
}
