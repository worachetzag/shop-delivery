/**
 * ชื่อหน้าให้ตรงเมนูแอดมิน (เดียวกับ AdminHeader.js)
 */

export const ADMIN_SECTION_LABELS = {
  inventory: {
    overview: 'ภาพรวมคลัง',
    adjustments: 'ปรับสต็อก',
    suppliers: 'ผู้จำหน่าย',
    'purchase-orders': 'ใบสั่งซื้อ (PO)',
    movements: 'ประวัติสต็อก',
  },
  store: {
    store: 'ข้อมูลร้าน',
    payment: 'PromptPay',
    'delivery-fees': 'ค่าส่งตามระยะทาง',
    hours: 'เวลาทำการ',
  },
};

/** ชื่อเมนูหลักตามแท็บใน AdminDashboard (legacy unified component) */
export function adminDashboardTabTitle(activeTab, forcedSubsection) {
  if (activeTab === 'orders') return 'คำสั่งซื้อ';
  if (activeTab === 'products') return 'สินค้า';
  if (activeTab === 'categories') return 'หมวดหมู่';
  if (activeTab === 'drivers') {
    return forcedSubsection === 'staff' ? 'พนักงาน' : 'คนขับ';
  }
  return '';
}
