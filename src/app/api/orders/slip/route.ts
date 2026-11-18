import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId, isAdmin } from '@/lib/supabase-server';
import { signedSlipUrl } from '@/lib/slip-url';

// เปิดรูปสลิป (Bucket เป็น private): เฉพาะเจ้าของร้านของออเดอร์นั้น หรือผู้ดูแลระบบ — ?id=<order id>
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id') ?? '';
  let query = supabaseAdmin.from('orders').select('slip_url').eq('id', id);
  if (!isAdmin(user)) {
    const shop = await getShopByUserId(user.id);
    if (!shop) return NextResponse.json({ error: 'ไม่พบร้านค้าของคุณ' }, { status: 403 });
    query = query.eq('profile_id', shop.id);
  }
  const { data: order } = await query.maybeSingle();
  if (!order) return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อนี้' }, { status: 404 });

  const url = await signedSlipUrl(order.slip_url, 5 * 60);
  if (!url) return NextResponse.json({ error: 'ไม่มีไฟล์สลิป หรือสลิปถูกลบตามอายุการเก็บแล้ว' }, { status: 404 });
  return NextResponse.redirect(url, { headers: { 'Cache-Control': 'private, no-store' } });
}
