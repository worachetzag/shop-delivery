/**
 * เส้นทางย้อนที่ใช้บ่อยเมื่อไม่พึ่ง history.back (เช่นเปิดลิงก์ตรง)
 */
export function getCustomerBackPath(pathname) {
  if (!pathname || !pathname.startsWith('/customer')) {
    return '/customer';
  }
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1 || pathname === '/customer') {
    return '/customer';
  }

  const sec = segments[1];

  if (sec === 'products' && segments.length >= 3) {
    return '/customer/products';
  }
  if (sec === 'products') {
    return '/customer';
  }
  if (sec === 'cart') {
    return '/customer/products';
  }
  if (sec === 'checkout') {
    return '/customer/cart';
  }
  if (sec === 'orders' && segments.length >= 3) {
    return '/customer/orders';
  }
  if (sec === 'orders') {
    return '/customer';
  }
  if (sec === 'tracking') {
    return '/customer/orders';
  }
  if (sec === 'profile') {
    return '/customer';
  }
  if (sec === 'login') {
    return '/customer';
  }

  return '/customer';
}

export function customerShouldShowBackButton(pathname) {
  if (!pathname.startsWith('/customer')) return false;
  return pathname !== '/customer' && pathname !== '/customer/';
}
