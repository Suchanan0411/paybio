import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';
import { grantPaidPlan, isBilling, isPaidPlan } from '@/lib/billing';

// รายการชำระค่าแพ็กเกจ (รอตรวจขึ้นก่อน) พร้อมลิงก์ดูสลิปชั่วคราว 10 นาที
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('plan_payments')
    .select('id, shop_id, plan, billing, amount, status, note, bank, slip_path, period_end, reviewed_by, reviewed_at, created_at, profiles(shop_name, slug)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const paths = rows.map((r) => r.slip_path).filter((p): p is string => !!p);
  const signed = paths.length
    ? (await supabaseAdmin.storage.from('payment-slips').createSignedUrls(paths, 600)).data ?? []
    : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const payments = rows
    .map(({ profiles, slip_path, ...p }) => {
      const shop = (Array.isArray(profiles) ? profiles[0] : profiles) as { shop_name: string; slug: string } | null;
      return { ...p, shop_name: shop?.shop_name ?? null, shop_slug: shop?.slug ?? null, slip_url: slip_path ? urlOf.get(slip_path) ?? null : null };
    })
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
  return NextResponse.json({ payments, pending: payments.filter((p) => p.status === 'pending').length });
}

// อนุมัติ (เปิดแพ็กเกจ) หรือปฏิเสธรายการที่รอตรวจ: { id, action: 'approve' | 'reject', note? }
export async function PATCH(req: Request) {
  const { user, denied } = await requireAdmin();
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '');
  const action = body.action;
  const note = String(body.note ?? '').trim().slice(0, 300) || null;
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const { data: payment } = await supabaseAdmin.from('plan_payments').select('*').eq('id', id).maybeSingle();
  if (!payment) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 });
  if (payment.status !== 'pending') return NextResponse.json({ error: 'รายการนี้ตรวจไปแล้ว' }, { status: 400 });

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('plan_payments')
      .update({ status: 'rejected', note: note ?? 'แอดมินปฏิเสธ', reviewed_by: user.email ?? 'admin', reviewed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!isPaidPlan(payment.plan) || !isBilling(payment.billing)) {
    return NextResponse.json({ error: 'ข้อมูลแพ็กเกจของรายการไม่ถูกต้อง' }, { status: 400 });
  }
  const { data: shop } = await supabaseAdmin.from('profiles').select('id, plan, plan_expires_at').eq('id', payment.shop_id).maybeSingle();
  if (!shop) return NextResponse.json({ error: 'ไม่พบร้านของรายการนี้' }, { status: 404 });

  try {
    const { end } = await grantPaidPlan({
      shop,
      paymentId: id,
      plan: payment.plan,
      billing: payment.billing,
      reviewer: { id: user.id, email: user.email ?? 'admin' },
    });
    if (note) await supabaseAdmin.from('plan_payments').update({ note }).eq('id', id);
    return NextResponse.json({ success: true, period_end: end.toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'เปิดแพ็กเกจไม่สำเร็จ' }, { status: 500 });
  }
}
