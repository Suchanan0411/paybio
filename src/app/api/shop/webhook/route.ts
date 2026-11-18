import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { sendWebhook, validateWebhookUrl } from '@/lib/order-notify';

async function requireShop() {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 }) };
  if (!PLAN_LIMITS[planOf(shop)].webhook) {
    return { error: NextResponse.json({ error: 'Webhook ใช้ได้เฉพาะแพ็กเกจ Business Studio' }, { status: 403 }) };
  }
  return { shop };
}

// ตั้ง / ลบ URL ปลายทาง ({ url: '' } = ลบ), { rotate: true } = สร้าง secret ใหม่
export async function PUT(req: Request) {
  const { shop, error } = await requireShop();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? '').trim();

  if (url) {
    const problem = await validateWebhookUrl(url);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  const secret =
    url && (body.rotate || !shop.order_webhook_secret)
      ? 'whsec_' + randomBytes(24).toString('base64url')
      : shop.order_webhook_secret;

  const { data, error: dbError } = await supabaseAdmin
    .from('profiles')
    .update({ order_webhook_url: url || null, order_webhook_secret: url ? secret : null })
    .eq('id', shop.id)
    .select()
    .single();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ shop: data });
}

// ส่ง event ทดสอบไปยัง URL ที่ตั้งไว้
export async function POST() {
  const { shop, error } = await requireShop();
  if (error) return error;
  try {
    await sendWebhook(shop, 'webhook.test', null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ส่งไม่สำเร็จ' }, { status: 502 });
  }
}
