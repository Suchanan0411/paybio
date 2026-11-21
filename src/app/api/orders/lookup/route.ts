import { NextResponse } from 'next/server';
import { findOrderTokens } from '@/lib/order-track';
import { clientIp, rateLimited } from '@/lib/rate-limit';

// ค้นหาคำสั่งซื้อด้วยเลขออเดอร์ + เบอร์โทร / LINE ID / อีเมลที่ใช้ตอนสั่ง
// จำกัด 10 ครั้ง / 10 นาทีต่อ IP กันการไล่เดาเลขออเดอร์ + เบอร์
export async function POST(req: Request) {
  if (await rateLimited('order-lookup', clientIp(req), 10, 10 * 60)) {
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
