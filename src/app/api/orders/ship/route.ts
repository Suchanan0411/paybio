import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { addOrderEvents } from '@/lib/order-events';
import { sendCustomerEmail } from '@/lib/customer-email';
import { FULFILLMENT_LABEL, carrierOf } from '@/lib/order-stages';

const MAX_ITEMS = 200;

// ใส่เลขพัสดุทีละหลายออเดอร์ แล้วเปลี่ยนเป็น "จัดส่งแล้ว" พร้อมแจ้งลูกค้า
// body: { items: [{ id, carrier, tracking_number }] }
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i: Record<string, unknown>) => ({
      id: String(i?.id ?? ''),
      carrier: String(i?.carrier ?? '').trim().slice(0, 30),
      tracking_number: String(i?.tracking_number ?? '').trim().slice(0, 60),
    }))
    .filter((i: { id: string; tracking_number: string }) => i.id && i.tracking_number);
  if (items.length === 0) return NextResponse.json({ error: 'กรุณาใส่เลขพัสดุอย่างน้อย 1 รายการ' }, { status: 400 });
  if (items.length > MAX_ITEMS) return NextResponse.json({ error: `ทำได้ครั้งละไม่เกิน ${MAX_ITEMS} รายการ` }, { status: 400 });
  for (const i of items) {
    if (!carrierOf(i.carrier)) return NextResponse.json({ error: 'กรุณาเลือกบริษัทขนส่ง' }, { status: 400 });
  }

  const { data: current, error: readError } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('profile_id', shop.id)
    .in('id', items.map((i: { id: string }) => i.id));
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  const paid = new Set((current ?? []).filter((o) => o.status === 'paid').map((o) => o.id));
  const valid = items.filter((i: { id: string }) => paid.has(i.id));
  if (valid.length === 0) return NextResponse.json({ error: 'ไม่พบออเดอร์ที่ชำระแล้วในรายการนี้' }, { status: 400 });

  const now = new Date().toISOString();
  const results = await Promise.all(
    valid.map((i: { id: string; carrier: string; tracking_number: string }) =>
      supabaseAdmin
        .from('orders')
        .update({ fulfillment: 'shipped', carrier: i.carrier, tracking_number: i.tracking_number, status_updated_at: now })
        .eq('id', i.id)
        .eq('profile_id', shop.id)
        .select()
        .single()
    )
  );
  const failed = results.find((r) => r.error);
  const saved = results.map((r) => r.data).filter(Boolean);

  // หลังตอบกลับ: บันทึกประวัติบนหน้าติดตาม แล้วแจ้งลูกค้าทางอีเมล (ถ้ากรอกไว้)
  after(async () => {
    for (const order of saved) {
      await addOrderEvents(order.id, [
        { kind: 'fulfillment', label: FULFILLMENT_LABEL.shipped },
        { kind: 'tracking', label: 'เพิ่มเลขพัสดุ', detail: `${carrierOf(order.carrier)?.label ?? ''} ${order.tracking_number}`.trim() },
      ]);
      await sendCustomerEmail(shop.shop_name, order, FULFILLMENT_LABEL.shipped);
    }
  });

  return NextResponse.json({
    orders: saved,
    skipped: items.length - valid.length,
    error: failed?.error?.message,
  });
}
