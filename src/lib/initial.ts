// ตัวอักษรแรกสำหรับรูปโปรไฟล์/โลโก้แทนรูป
// ภาษาไทย: ข้ามสระหน้า (เ แ โ ใ ไ) และใช้เฉพาะพยัญชนะ ไม่เอาวรรณยุกต์/สระบนล่าง เช่น "เจ้าของ" → "จ", "ร้าน" → "ร"
const LEADING_VOWELS = /^[เ-ไ]+/;
const THAI_CONSONANT = /^[ก-ฮ]/;

export function initialOf(...names: (string | null | undefined)[]) {
  const name = names.find((n) => n && n.trim())?.trim() ?? '';
  const text = name.replace(LEADING_VOWELS, '') || name;
  if (!text) return '?';
  if (THAI_CONSONANT.test(text)) return text[0];
  const [first] = new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text);
  return (first?.segment ?? '?').toUpperCase();
}
