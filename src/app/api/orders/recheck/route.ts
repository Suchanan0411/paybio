import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { planOf } from '@/lib/plans';
import { checkSlip, slipHash } from '@/lib/slip-check';
import { slipPath } from '@/lib/slip-storage';

// ตรวจสลิปของออเดอร์ซ้ำ (เช่น ออเดอร์ก่อนเปิดใช้ AI หรืออัปเกรดแพ็กเกจแล้ว)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const { id } = await req.json().catch(() => ({}));
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', String(id ?? ''))
    .eq('profile_id', shop.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อนี้ในร้านของคุณ' }, { status: 404 });

  const path = slipPath(order.slip_url);
  if (!path) {
    const error = order.slip_hash ? 'ไฟล์สลิปของออเดอร์นี้ถูกลบตามอายุการเก็บแล้ว' : 'คำสั่งซื้อนี้ไม่มีสลิป';
    return NextResponse.json({ error }, { status: 400 });
  }

  const { data: blob, error: dlError } = await supabaseAdmin.storage.from('payment-slips').download(path);
  if (dlError || !blob) return NextResponse.json({ error: 'โหลดรูปสลิปไม่สำเร็จ' }, { status: 500 });

  const bytes = await blob.arrayBuffer();
  const hash = slipHash(bytes);
  const result = await checkSlip({
    plan: planOf(shop),
    bytes,
    hash,
    expectedAmount: Number(order.amount),
    orderId: order.id,
    orderCreatedAt: order.created_at,
    shopId: shop.id,
    promptpayNumber: shop.promptpay_number,
  });

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ slip_check: result, slip_hash: hash })
    .eq('id', order.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
