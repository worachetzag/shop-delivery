/** ตัวเลือกเรียงสินค้าฝั่งลูกค้า — ใช้ร่วมหน้ารายการและหน้าแรก */

export const PRODUCT_SORT_OPTIONS_STANDARD = [
  { value: 'name-asc', label: 'ชื่อ A→Z', hint: 'เรียงชื่อจากน้อยไปมาก' },
  { value: 'name-desc', label: 'ชื่อ Z→A', hint: 'เรียงชื่อจากมากไปน้อย' },
  { value: 'price-low', label: 'ราคา ↑ ต่ำ→สูง', hint: 'ถูกไปแพง' },
  { value: 'price-high', label: 'ราคา ↓ สูง→ต่ำ', hint: 'แพงไปถูก' },
];

/** หน้าแรก — สินค้าแนะนำ (ค่าเริ่มต้นเดิม ≈ ordering -created_at) */
export const PRODUCT_SORT_OPTION_CREATED_DESC = {
  value: 'created-desc',
  label: 'ใหม่ล่าสุดก่อน',
  hint: 'เพิ่งเพิ่มในระบบล่าสุดก่อน',
};

/** หน้าแรก — โซนลดราคา (ค่าเริ่มต้นเดิม = เรียงตาม % ส่วนลดในฝั่ง client) */
export const PRODUCT_SORT_OPTION_DISCOUNT_DESC = {
  value: 'discount-desc',
  label: 'ส่วนลดมากสุดก่อน',
  hint: 'เปอร์เซ็นต์ลดจากราคาก่อนลดสูงก่อน',
};

/** คีย์เรียงสำหรับให้สินค้าที่มีสต็อกขึ้นก่อนรายการที่หมด (ใช้ร่วมเรียงฝั่ง client หลังดึงชุดใหญ่) */
export function availabilitySortKey(product) {
  const avail = Number(
    product?.available_quantity ??
      Math.max(0, Number(product?.stock_quantity || 0) - Number(product?.reserved_quantity || 0)),
  );
  return avail > 0 ? 0 : 1;
}

/** มีจำนวนพร้อมขาย > 0 */
export function isProductInStock(product) {
  return availabilitySortKey(product) === 0;
}

/** พารามิเตอร์ `ordering` สำหรับ API — `discount-desc` โหลดชุดแล้วเรียงฝั่ง client */
export function apiOrderingForSortKey(sortKey) {
  const map = {
    'name-asc': 'name',
    'name-desc': '-name',
    'price-low': 'price',
    'price-high': '-price',
    'created-desc': '-created_at',
    'discount-desc': '-created_at',
  };
  return map[sortKey] || 'name';
}

export function isDiscountDescSort(sortKey) {
  return sortKey === 'discount-desc';
}
