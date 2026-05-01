/** อิโมจิและโทนสีสำหรับหมวด — API ไม่มีรูปหมวด */
const FALLBACK_EMOJI = ['🛒', '📦', '🏷️', '✨', '🌿', '🥫', '🧃', '🍚'];

const NAME_RULES = [
  [/ไอศกรีม|ice\s*cream/i, '🍦'],
  [/เบเกอรี่|bakery|ขนมปัง|bread/i, '🥖'],
  [/นม|โยเกิร์ต|yogurt/i, '🥛'],
  [/อาหาร\s*พร้อม|พร้อม\s*ทาน|เบนโตะ/i, '🍱'],
  [/ขนม|ลูกอม|candy|snack/i, '🍿'],
  [/เครื่อง\s*ดื่ม|น้ำ\s*ดื่ม/i, '🥤'],
  [/ผัก|ผล\s*ไม้/i, '🥬'],
  [/ปุ๋ย|เกษตร|เมล็ด/i, '🌱'],
  [/อาหาร\s*แห้ง/i, '🍜'],
  [/ของ\s*ใช้|อุปโภค|ทำความสะอาด/i, '🧺'],
  [/แช่\s*แข็ง|frozen/i, '🧊'],
  [/เนื้อสัตว์|ปลา|อาหาร\s*ทะเล/i, '🐟'],
  [/สุขภาพ|ยา|วิตามิน/i, '💊'],
];

export function getCategoryEmoji(name, id) {
  const n = String(name || '').trim();
  for (const [re, emoji] of NAME_RULES) {
    if (re.test(n)) return emoji;
  }
  const key = Number(id);
  if (Number.isFinite(key)) {
    return FALLBACK_EMOJI[Math.abs(key) % FALLBACK_EMOJI.length];
  }
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h + n.charCodeAt(i) * (i + 1)) % 997;
  return FALLBACK_EMOJI[h % FALLBACK_EMOJI.length];
}

/** Hue 0–359 สำหรับพื้นหลังวงกลมนุ่มๆ */
export function getCategoryAccentHue(id) {
  const key = Number(id);
  const n = Number.isFinite(key) ? Math.abs(key) : 0;
  return (n * 47 + 142) % 360;
}
