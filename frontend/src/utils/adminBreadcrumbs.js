/**
 * เส้นทาง breadcrumb แอดมิน — ชื่อให้สอดคล้องเมนู (AdminHeader)
 * ค่า to ของรายการสุดท้ายเป็น undefined = หน้าปัจจุบัน (ไม่เป็นลิงก์)
 */

function crumb(label, to) {
  return to === undefined ? { label } : { label, to };
}

/** @param {string} pathname */
export function buildAdminBreadcrumbs(pathname) {
  const p = (pathname || '').replace(/\/$/, '') || '/admin';

  const home = crumb('หน้าหลัก', '/admin/dashboard');

  if (p === '/admin' || p === '/admin/dashboard') {
    return [home, crumb('ภาพรวม')];
  }

  if (p === '/admin/orders') {
    return [home, crumb('คำสั่งซื้อ')];
  }

  const orderDetail = p.match(/^\/admin\/orders\/(\d+)$/);
  if (orderDetail) {
    const id = orderDetail[1];
    return [home, crumb('คำสั่งซื้อ', '/admin/orders'), crumb(`ออเดอร์ #${id}`)];
  }

  const orderTracking = p.match(/^\/admin\/orders\/(\d+)\/tracking$/);
  if (orderTracking) {
    const id = orderTracking[1];
    return [
      home,
      crumb('คำสั่งซื้อ', '/admin/orders'),
      crumb(`ออเดอร์ #${id}`, `/admin/orders/${id}`),
      crumb('ติดตามคนขับ'),
    ];
  }

  if (p === '/admin/products') {
    return [home, crumb('สินค้า')];
  }

  if (p === '/admin/products/new') {
    return [home, crumb('สินค้า', '/admin/products'), crumb('เพิ่มสินค้าใหม่')];
  }

  const prodEdit = p.match(/^\/admin\/products\/(\d+)\/edit$/);
  if (prodEdit) {
    const id = prodEdit[1];
    return [home, crumb('สินค้า', '/admin/products'), crumb(`แก้ไขสินค้า #${id}`)];
  }

  if (p === '/admin/categories') {
    return [home, crumb('หมวดหมู่')];
  }

  if (p === '/admin/home-promotions') {
    return [home, crumb('โปรหน้าแรก')];
  }

  if (p === '/admin/customers') {
    return [home, crumb('ลูกค้า')];
  }

  const cust = p.match(/^\/admin\/customers\/(\d+)$/);
  if (cust) {
    const id = cust[1];
    return [home, crumb('ลูกค้า', '/admin/customers'), crumb(`ลูกค้า #${id}`)];
  }

  if (p === '/admin/personnel' || p === '/admin/personnel/staff') {
    return [home, crumb('บุคลากร', '/admin/personnel'), crumb('พนักงาน')];
  }

  if (p === '/admin/personnel/drivers') {
    return [home, crumb('บุคลากร', '/admin/personnel'), crumb('คนขับ')];
  }

  const storeBase = '/admin/store-settings/store';

  if (p === '/admin/store-settings') {
    return [home, crumb('ตั้งค่าร้าน', storeBase), crumb('ข้อมูลร้าน')];
  }

  if (p === '/admin/store-settings/store' || p === '/admin/store-settings/location') {
    return [home, crumb('ตั้งค่าร้าน', storeBase), crumb('ข้อมูลร้าน')];
  }

  if (p === '/admin/store-settings/payment') {
    return [home, crumb('ตั้งค่าร้าน', storeBase), crumb('PromptPay')];
  }

  if (p === '/admin/store-settings/delivery-fees') {
    return [home, crumb('ตั้งค่าร้าน', storeBase), crumb('ค่าส่งตามระยะทาง')];
  }

  if (p === '/admin/store-settings/hours') {
    return [home, crumb('ตั้งค่าร้าน', storeBase), crumb('เวลาทำการ')];
  }

  if (p === '/admin/store-settings/pdpa') {
    return [home, crumb('ตั้งค่าร้าน', storeBase), crumb('นโยบาย PDPA')];
  }

  const invRoot = '/admin/inventory/overview';

  if (p === '/admin/inventory' || p === '/admin/inventory/overview') {
    return [home, crumb('จัดการสต็อก', invRoot), crumb('ภาพรวมคลัง')];
  }

  if (p === '/admin/inventory/adjustments') {
    return [home, crumb('จัดการสต็อก', invRoot), crumb('ปรับสต็อก')];
  }

  if (p === '/admin/inventory/suppliers') {
    return [home, crumb('จัดการสต็อก', invRoot), crumb('ผู้จำหน่าย')];
  }

  if (p === '/admin/inventory/purchase-orders') {
    return [home, crumb('จัดการสต็อก', invRoot), crumb('ใบสั่งซื้อ (PO)')];
  }

  const poDetail = p.match(/^\/admin\/inventory\/purchase-orders\/(\d+)$/);
  if (poDetail) {
    const id = poDetail[1];
    return [
      home,
      crumb('จัดการสต็อก', invRoot),
      crumb('ใบสั่งซื้อ (PO)', '/admin/inventory/purchase-orders'),
      crumb(`รายละเอียด PO #${id}`),
    ];
  }

  if (p === '/admin/inventory/movements') {
    return [home, crumb('จัดการสต็อก', invRoot), crumb('ประวัติสต็อก')];
  }

  if (p === '/admin/audit-log') {
    return [home, crumb('ประวัติพนักงาน')];
  }

  /* fallback — หน้าแอดมินที่ไม่ได้ขึ้นทะเบียน */
  return [home, crumb('แอดมิน')];
}
