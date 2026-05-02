/**
 * เซสชันคนขับเก็บใน sessionStorage — แยกจากแอดมิน/ลูกค้า (localStorage)
 * sessionStorage แยกตามแท็บใน Chrome → เปิดแท็บแอดมิน + แท็บคนขับพร้อมกันได้
 */
export const DRIVER_TOKEN_KEY = 'driver_auth_token';
export const DRIVER_ROLE_KEY = 'driver_user_role';
export const DRIVER_USERNAME_KEY = 'driver_username';

export function setDriverSession({ token, role = 'driver', username = '' }) {
  sessionStorage.setItem(DRIVER_TOKEN_KEY, token);
  sessionStorage.setItem(DRIVER_ROLE_KEY, role);
  if (username) sessionStorage.setItem(DRIVER_USERNAME_KEY, username);
}

export function clearDriverSession() {
  sessionStorage.removeItem(DRIVER_TOKEN_KEY);
  sessionStorage.removeItem(DRIVER_ROLE_KEY);
  sessionStorage.removeItem(DRIVER_USERNAME_KEY);
}

export function getDriverToken() {
  return sessionStorage.getItem(DRIVER_TOKEN_KEY);
}

export function getDriverRole() {
  return sessionStorage.getItem(DRIVER_ROLE_KEY) || '';
}
