import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';

// IP ของผู้เรียก (Vercel และ reverse proxy ใส่ไว้ใน x-forwarded-for / x-real-ip)
export function clientIp(req: Request) {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}

/**
 * นับครั้งในฐานข้อมูล (ใช้ร่วมกันทุกเซิร์ฟเวอร์) คืน true เมื่อเกิน max ครั้งใน windowSeconds
 * ถ้าฐานข้อมูลขัดข้องจะไม่บล็อก เพื่อไม่ให้ลูกค้าจริงสั่งซื้อไม่ได้
 */
export async function rateLimited(action: string, id: string, max: number, windowSeconds: number) {
  const key = createHash('sha256').update(`${action}:${id}`).digest('hex');
  const { data, error } = await supabaseAdmin.rpc('rate_limit_hit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error('rate_limit_hit failed:', error.message);
    return false;
  }
  return data === true;
}
