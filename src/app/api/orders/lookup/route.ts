import { NextResponse } from 'next/server';
import { findOrderTokens } from '@/lib/order-track';

// จำกัดจำนวนครั้งต่อ IP กันการไล่เดาเลขออเดอร์ + เบอร์ (ในหน่วยความจำของเซิร์ฟเวอร์ — พอสำหรับเซิร์ฟเวอร์เดียว)
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 10;
const tries = new Map<string, { count: number; until: number }>();

function limited(ip: string) {
  const now = Date.now();
  if (tries.size > 5000) for (const [k, v] of tries) if (v.until < now) tries.delete(k);
  const t = tries.get(ip);
  if (!t || t.until < now) {
    tries.set(ip, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  t.count++;
  return t.count > MAX_TRIES;
}

// ค้นหาคำสั่งซื้อด้วยเลขออเดอร์ + เบอร์โทร / LINE ID / อีเมลที่ใช้ตอนสั่ง
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
  if (limited(ip)) {
    return NextResponse.json({ error: 'ค้นหาบ่อยเกินไป กรุณารอ 10 นาทีแล้วลองใหม่' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const tokens = await findOrderTokens(String(body.order_number ?? ''), String(body.contact ?? ''));
  if (!tokens.length) {
    return NextResponse.json(
      { error: 'ไม่พบคำสั่งซื้อ ตรวจเลขออเดอร์ และใช้เบอร์โทร / LINE ID / อีเมลเดียวกับที่กรอกตอนสั่ง' },
      { status: 404 }
    );
  }
  return NextResponse.json({ tokens });
}
