import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { getOaBasicId, lineMessagingConfigured, pushMessage } from '@/lib/line-messaging';
import { orderLineText } from '@/lib/order-notify';

// รหัสเชื่อม LINE: 8 ตัวจากชุดที่ไม่มีตัวที่สับสนกัน (0/O, 1/I/L) — 31^8 ≈ 8.5×10^11 แบบ เดาไม่ได้
const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LINK_CODE_LENGTH = 8;

const LINK_MINUTES = 15;

async function requireShop() {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 }) };
  if (!PLAN_LIMITS[planOf(shop)].lineNotify) {
    return { error: NextResponse.json({ error: 'แจ้งเตือนผ่าน LINE ใช้ได้ตั้งแต่แพ็กเกจ Pro Merchant' }, { status: 403 }) };
  }
  if (!lineMessagingConfigured()) {
    return { error: NextResponse.json({ error: 'ระบบยังไม่ได้ตั้งค่า LINE OA กรุณาติดต่อผู้ดูแล' }, { status: 503 }) };
  }
  return { shop };
}

// สถานะการเชื่อมต่อ + รหัสที่ยังไม่หมดอายุ + LINE ID ของ OA
export async function GET() {
  const { shop, error } = await requireShop();
  if (error) return error;
  const active = shop.line_link_expires_at && new Date(shop.line_link_expires_at) > new Date();
  return NextResponse.json({
    connected: !!shop.line_user_id,
    code: active ? shop.line_link_code : null,
    expires_at: active ? shop.line_link_expires_at : null,
    oa_id: await getOaBasicId(),
  });
}

// { action: 'link' } สร้างรหัสเชื่อมต่อ, { action: 'test' } ส่งข้อความทดสอบ
export async function POST(req: Request) {
  const { shop, error } = await requireShop();
  if (error) return error;
  const { action } = await req.json().catch(() => ({}));

  if (action === 'test') {
    if (!shop.line_user_id) return NextResponse.json({ error: 'ยังไม่ได้เชื่อมต่อ LINE' }, { status: 400 });
    try {
      const sample = orderLineText(shop, {
        id: 'test',
        order_number: 'PB-TEST01',
        item_title: 'สินค้าตัวอย่าง × 1',
        amount: 199,
        customer_name: 'ลูกค้าตัวอย่าง',
        customer_contact: '08x-xxx-xxxx',
        status: 'pending',
        created_at: new Date().toISOString(),
      });
      await pushMessage(shop.line_user_id, [{ type: 'text', text: '🔔 ข้อความทดสอบจาก PayBio\n\n' + sample }]);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[line] test push failed', err);
      return NextResponse.json({ error: 'ส่งไม่สำเร็จ ตรวจว่ายังเป็นเพื่อนกับ LINE OA ของ PayBio อยู่' }, { status: 502 });
    }
  }

  if (action !== 'link') return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const code = Array.from({ length: LINK_CODE_LENGTH }, () => LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]).join('');
  const expires = new Date(Date.now() + LINK_MINUTES * 60_000).toISOString();
  const { error: dbError } = await supabaseAdmin
    .from('profiles')
    .update({ line_link_code: code, line_link_expires_at: expires })
    .eq('id', shop.id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  return NextResponse.json({ connected: !!shop.line_user_id, code, expires_at: expires, oa_id: await getOaBasicId() });
}

// ยกเลิกการเชื่อมต่อ
export async function DELETE() {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ line_user_id: null, line_link_code: null, line_link_expires_at: null })
    .eq('id', shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
