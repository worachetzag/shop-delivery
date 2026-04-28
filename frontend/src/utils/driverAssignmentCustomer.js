/** ข้อความแสดงชื่อลูกค้าจาก payload งานคนขับ */
export function assignmentCustomerLabel(assignment) {
  if (!assignment) return '—';
  const full = (assignment.customer_name || '').trim();
  if (full) return full;
  return (assignment.customer_username || '').trim() || '—';
}

/** เบอร์ติดต่อ: ใช้เบอร์จัดส่งก่อน แล้วค่อยเบอร์ในโปรไฟล์ลูกค้า */
export function assignmentContactPhone(assignment) {
  if (!assignment) return '';
  const d = (assignment.delivery_phone || '').trim();
  if (d) return d;
  return (assignment.customer_phone || '').trim();
}
