import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_PRICES, planOf } from '@/lib/plans';
import { slipHash } from '@/lib/slip-check';
import { slipokEnabled } from '@/lib/slipok';
import {
  bankRefUsed,
  billingPromptpay,
  grantPaidPlan,
  isBilling,
  isPaidPlan,
  purchaseBlock,
  slipHashUsed,
  verifyPlanSlip,
} from '@/lib/billing';

const MAX_SLIP_BYTES = 10 * 1024 * 1024;

async function currentShop() {
  const user = await getCurrentUser();
  return user ? getShopByUserId(user.id) : null;
}

const unauthorized = () => NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });

// ข้อมูลหน้าอัปเกรด: ราคา พร้อมเพย์ที่ต้องโอน แพ็กเกจปัจจุบัน และประวัติการชำระ
export async function GET() {
  const shop = await currentShop();
  if (!shop) return unauthorized();
  const { data: payments } = await supabaseAdmin
    .from('plan_payments')
    .select('id, plan, billing, amount, status, note, period_start, period_end, created_at')
    .eq('shop_id', shop.id)
    .order('created_at', { ascending: false })
    .limit(20);
  return NextResponse.json({
    prices: PLAN_PRICES,
    promptpay: billingPromptpay(),
    autoVerify: slipokEnabled('business'),
    current: { plan: planOf(shop), expires_at: shop.plan_expires_at ?? null },
    payments: payments ?? [],
  });
}

// ชำระค่าแพ็กเกจ: multipart { plan, billing, slip }
export async function POST(req: Request) {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const payTo = billingPromptpay();
  if (!payTo) return NextResponse.json({ error: 'ระบบยังไม่เปิดรับชำระค่าแพ็กเกจ กรุณาติดต่อผู้ดูแล' }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const plan = form?.get('plan');
  const billing = form?.get('billing');
  const file = form?.get('slip');
  if (!isPaidPlan(plan) || !isBilling(billing)) return NextResponse.json({ error: 'แพ็กเกจไม่ถูกต้อง' }, { status: 400 });
  if (!(file instanceof File) || !file.type.startsWith('image/') || file.size === 0 || file.size > MAX_SLIP_BYTES) {
    return NextResponse.json({ error: 'กรุณาแนบรูปสลิป (ไฟล์รูปภาพไม่เกิน 10 MB)' }, { status: 400 });
  }

  const blocked = purchaseBlock(shop, plan);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

  const amount = PLAN_PRICES[plan][billing];
  const bytes = await file.arrayBuffer();
  const hash = slipHash(bytes);
  if (await slipHashUsed(hash)) {
    return NextResponse.json({ error: 'สลิปนี้เคยใช้ชำระค่าแพ็กเกจแล้ว' }, { status: 400 });
  }

  const verdict = await verifyPlanSlip(bytes, amount, payTo);
  if (verdict.bank && (await bankRefUsed(verdict.bank.ref))) {
    return NextResponse.json({ error: 'สลิปนี้เคยใช้ชำระค่าแพ็กเกจแล้ว' }, { status: 400 });
  }

  // เก็บสลิปไว้ให้แอดมินตรวจย้อนหลัง (bucket private)
  const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').slice(0, 5);
  const slipPath = `billing/${shop.id}/${Date.now()}.${ext}`;
  const { error: upError } = await supabaseAdmin.storage
    .from('payment-slips')
    .upload(slipPath, Buffer.from(bytes), { contentType: file.type });
  if (upError) return NextResponse.json({ error: 'อัปโหลดสลิปไม่สำเร็จ: ' + upError.message }, { status: 500 });

  const { data: payment, error } = await supabaseAdmin
    .from('plan_payments')
    .insert({
      shop_id: shop.id,
      plan,
      billing,
      amount,
      status: verdict.status === 'paid' ? 'pending' : verdict.status, // paid ถูกตั้งตอนเปิดแพ็กเกจสำเร็จ
      slip_path: slipPath,
      slip_hash: hash,
      bank_ref: verdict.bank?.ref ?? null,
      bank: verdict.bank,
      note: verdict.note,
      ...(verdict.status === 'rejected' ? { reviewed_by: 'auto', reviewed_at: new Date().toISOString() } : {}),
    })
    .select('id, plan, billing, amount, status, note, period_start, period_end, created_at')
    .single();
  if (error) {
    await supabaseAdmin.storage.from('payment-slips').remove([slipPath]);
    // unique index ของ bank_ref: ส่งสลิปเดียวกันพร้อมกันสองครั้ง
    const dup = /plan_payments_bank_ref_uidx|duplicate key/.test(error.message);
    return NextResponse.json({ error: dup ? 'สลิปนี้เคยใช้ชำระค่าแพ็กเกจแล้ว' : error.message }, { status: dup ? 400 : 500 });
  }

  if (verdict.status === 'paid') {
    try {
      const { start, end } = await grantPaidPlan({ shop, paymentId: payment.id, plan, billing, reviewer: { id: null, email: 'auto' } });
      return NextResponse.json({
        payment: { ...payment, status: 'paid', period_start: start.toISOString(), period_end: end.toISOString() },
        current: { plan, expires_at: end.toISOString() },
      });
    } catch (err) {
      console.error('[billing] grant failed', err);
      await supabaseAdmin.from('plan_payments').update({ note: 'ชำระเงินแล้ว แต่เปิดแพ็กเกจไม่สำเร็จ — รอแอดมิน' }).eq('id', payment.id);
      return NextResponse.json({ payment: { ...payment, note: 'ชำระเงินแล้ว รอแอดมินเปิดแพ็กเกจ' }, current: null });
    }
  }
  return NextResponse.json({ payment, current: null });
}
