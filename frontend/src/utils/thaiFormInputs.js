/** ตัวเลขล้วน — ใช้กับเบอร์ไทย / เลขบัตรประชาชน */

export function digitsOnly(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** เบอร์โทรไทยในฟอร์ม 10 หลัก (เช่น 0812345678) */
export function clampPhoneTen(raw) {
  return digitsOnly(raw).slice(0, 10);
}

/** เลขบัตรประชาชน 13 หลัก */
export function clampCitizenThirteen(raw) {
  return digitsOnly(raw).slice(0, 13);
}

/** แสดงเป็น 089-123-4567 */
export function formatMobileTenDisplay(rawDigitsOrMixed) {
  const d = clampPhoneTen(rawDigitsOrMixed);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * แสดงเป็น x-xxxx-xxxxx-xx-x (ตามจำนวนหลักที่กรอก)
 * @see https://en.wikipedia.org/wiki/Thai_identity_card
 */
export function formatCitizenThirteenDisplay(rawDigitsOrMixed) {
  const d = clampCitizenThirteen(rawDigitsOrMixed);
  if (!d) return '';
  if (d.length <= 1) return d;
  if (d.length <= 5) return `${d[0]}-${d.slice(1)}`;
  if (d.length <= 10) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5)}`;
  if (d.length <= 12) return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10)}`;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}
