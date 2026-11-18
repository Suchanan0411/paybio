// โดเมนของตัว PayBio เอง (ไม่ใช่โดเมนของร้าน) — เพิ่มโดเมนจริงตอน deploy ผ่าน APP_HOSTS=paybio.me,www.paybio.me
export function isAppHost(host: string) {
  const name = host.toLowerCase().replace(/:\d+$/, '');
  const extra = (process.env.APP_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return (
    name === 'localhost' ||
    name === '127.0.0.1' ||
    name === '[::1]' ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(name) ||
    name.endsWith('.vercel.app') ||
    name === 'paybio.me' ||
    name.endsWith('.paybio.me') ||
    extra.includes(name)
  );
}
