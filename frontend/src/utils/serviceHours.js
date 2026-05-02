/**
 * เทียบช่วงเวลาทำการร้านกับเวลาประเทศไทย (ให้สอดคล้องกับ backend TIME_ZONE=Asia/Bangkok)
 */

function parseTimeToMinutes(str) {
  if (str == null || str === '') return null;
  const parts = String(str).trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function getBangkokMinutesSinceMidnight() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  let hour = 0;
  let minute = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    if (p.type === 'hour') hour = parseInt(p.value, 10) || 0;
    if (p.type === 'minute') minute = parseInt(p.value, 10) || 0;
  }
  return hour * 60 + minute;
}

function formatHmFromApi(timeStr) {
  const m = parseTimeToMinutes(timeStr);
  if (m == null) return '';
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * @param {Record<string, { start_time?: string, end_time?: string, is_active?: boolean }>|null|undefined} serviceHours
 * @param {'pickup'|'delivery'} mode
 * @returns {{ open: boolean, message: string|null }}
 */
export function getServiceHoursStatus(serviceHours, mode) {
  if (!serviceHours || typeof serviceHours !== 'object') {
    return { open: true, message: null };
  }
  const row = serviceHours[mode];
  if (!row) {
    return { open: true, message: null };
  }
  if (row.is_active === false) {
    const label = mode === 'pickup' ? 'รับที่ร้าน' : 'จัดส่งถึงบ้าน';
    return {
      open: false,
      message: `ขณะนี้ร้านปิดรับคำสั่งแบบ${label} ชั่วคราว`,
    };
  }
  const startM = parseTimeToMinutes(row.start_time);
  const endM = parseTimeToMinutes(row.end_time);
  if (startM == null || endM == null) {
    return { open: true, message: null };
  }
  if (startM === endM) {
    return { open: true, message: null };
  }
  const nowM = getBangkokMinutesSinceMidnight();
  let open;
  if (startM < endM) {
    open = nowM >= startM && nowM <= endM;
  } else {
    open = nowM >= startM || nowM <= endM;
  }
  if (open) {
    return { open: true, message: null };
  }
  const label = mode === 'pickup' ? 'รับที่ร้าน' : 'จัดส่งถึงบ้าน';
  const st = formatHmFromApi(row.start_time);
  const et = formatHmFromApi(row.end_time);
  return {
    open: false,
    message: `ยังไม่อยู่ในช่วงเวลาเปิดรับคำสั่งแบบ${label} (เปิดรับ ${st}–${et} น. ตามเวลาประเทศไทย)`,
  };
}
