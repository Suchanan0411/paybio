// เก็บค่าแพ็กเกจ: ร้านโอนพร้อมเพย์ของ PayBio แล้วแนบสลิป → ตรวจกับธนาคาร (SlipOK) → เปิดแพ็กเกจ
import { supabaseAdmin } from '@/lib/supabase';
import { BILLING_DAYS, PLAN_NAMES, PLAN_PRICES, PLAN_RANK, planOf, type Billing, type Plan } from '@/lib/plans';
import { readSlipQr } from '@/lib/slip-qr';
import { maskedMatches, verifyWithSlipok, type BankSlip } from '@/lib/slipok';

export type PaidPlan = Exclude<Plan, 'free'>;
export type BillingShop = { id: string; plan?: string | null; plan_expires_at?: string | null };

// พร้อมเพย์ที่ PayBio ใช้รับค่าแพ็กเกจ (เบอร์ 10 / เลขบัตร 13 / e-Wallet 15 หลัก)
export function billingPromptpay() {
  const n = (process.env.PAYBIO_PROMPTPAY ?? '').replace(/\D/g, '');
  return /^(\d{10}|\d{13}|\d{15})$/.test(n) ? n : null;
}

export const isPaidPlan = (p: unknown): p is PaidPlan => p === 'pro' || p === 'business';
export const isBilling = (b: unknown): b is Billing => b === 'monthly' || b === 'yearly';

// ซื้อได้ไหม — ไม่ให้ซื้อแพ็กเกจที่ต่ำกว่าที่ใช้อยู่ (จะเสียสิทธิ์ที่เหลือ) หรือต่ออายุแพ็กเกจที่ไม่มีวันหมดอายุ
export function purchaseBlock(shop: BillingShop, plan: PaidPlan): string | null {
  const current = planOf(shop);
  if (PLAN_RANK[current] > PLAN_RANK[plan]) {
    return `ร้านใช้ ${PLAN_NAMES[current]} อยู่ ซึ่งสูงกว่า ${PLAN_NAMES[plan]} — ต่ออายุ ${PLAN_NAMES[current]} แทนได้`;
  }
  if (current === plan && !shop.plan_expires_at) return `ร้านใช้ ${PLAN_NAMES[plan]} แบบไม่มีวันหมดอายุอยู่แล้ว`;
  return null;
}

// ช่วงสิทธิ์ที่ได้: ต่ออายุแพ็กเกจเดิม = นับต่อจากวันหมดอายุ, อัปเกรด/เริ่มใหม่ = นับจากตอนนี้
export function periodFor(shop: BillingShop, plan: PaidPlan, billing: Billing, now = Date.now()) {
  const current = planOf(shop, now);
  const expires = shop.plan_expires_at ? new Date(shop.plan_expires_at).getTime() : 0;
  const start = current === plan && expires > now ? expires : now;
  return { start: new Date(start), end: new Date(start + BILLING_DAYS[billing] * 24 * 60 * 60 * 1000) };
}

export type SlipVerdict =
  | { status: 'paid'; bank: BankSlip; note: null }
  | { status: 'pending'; bank: BankSlip | null; note: string }
  | { status: 'rejected'; bank: BankSlip | null; note: string };

// ตรวจสลิปค่าแพ็กเกจ: ต้องยืนยันกับธนาคารได้ ยอดตรง และโอนเข้าพร้อมเพย์ของ PayBio
export async function verifyPlanSlip(bytes: ArrayBuffer, amount: number, payTo: string): Promise<SlipVerdict> {
  const qr = await readSlipQr(bytes).catch(() => null);
  if (qr && !qr.qr) return { status: 'rejected', bank: null, note: 'รูปนี้ไม่ใช่สลิปโอนเงิน (QR ไม่ใช่ QR ของสลิป)' };

  const result = await verifyWithSlipok(qr?.qr?.crc_ok ? { qrText: qr.text } : { image: bytes });
  if (result.status === 'invalid') return { status: 'rejected', bank: null, note: result.message };
  if (result.status === 'unavailable') {
    const wait = result.code === 1010 ? ` (ธนาคารยังไม่อัปเดต รอประมาณ ${result.retryMinutes ?? 'ไม่กี่'} นาที)` : '';
    return { status: 'pending', bank: null, note: `ตรวจกับธนาคารอัตโนมัติไม่ได้${wait} — รอแอดมินตรวจ` };
  }

  const bank = result.slip;
  if (Math.abs(bank.amount - amount) >= 0.01) {
    return { status: 'rejected', bank, note: `ยอดโอน ฿${bank.amount.toLocaleString('th-TH')} ไม่ตรงกับราคา ฿${amount.toLocaleString('th-TH')}` };
  }
  const receiver = maskedMatches(bank.receiver_proxy, payTo);
  if (receiver === false) return { status: 'rejected', bank, note: 'สลิปนี้โอนเข้าบัญชีอื่น ไม่ใช่พร้อมเพย์ของ PayBio' };

  const at = bank.datetime ? new Date(bank.datetime).getTime() : NaN;
  const ageHours = (Date.now() - at) / 3_600_000;
  if (Number.isNaN(at) || ageHours > 48) {
    return { status: 'pending', bank, note: 'สลิปเก่ากว่า 2 วันหรือไม่มีวันที่ — รอแอดมินตรวจ' };
  }
  if (receiver === null) return { status: 'pending', bank, note: 'ตรวจบัญชีผู้รับอัตโนมัติไม่ได้ — รอแอดมินตรวจ' };
  return { status: 'paid', bank, note: null };
}

// เลขอ้างอิงนี้เคยใช้จ่ายค่าแพ็กเกจแล้ว (ไม่นับที่ถูกปฏิเสธ)
export async function bankRefUsed(ref: string) {
  const { count } = await supabaseAdmin
    .from('plan_payments')
    .select('id', { count: 'exact', head: true })
    .eq('bank_ref', ref)
    .neq('status', 'rejected');
  return (count ?? 0) > 0;
}

export async function slipHashUsed(hash: string) {
  const { count } = await supabaseAdmin
    .from('plan_payments')
    .select('id', { count: 'exact', head: true })
    .eq('slip_hash', hash)
    .neq('status', 'rejected');
  return (count ?? 0) > 0;
}

/**
 * เปิดแพ็กเกจให้ร้านหลังชำระเงิน แล้วบันทึกประวัติแอดมิน (action shop.plan)
 * reviewer = 'auto' (ระบบตรวจสลิปผ่าน) หรืออีเมลแอดมินที่อนุมัติ
 */
export async function grantPaidPlan(opts: {
  shop: BillingShop;
  paymentId: string;
  plan: PaidPlan;
  billing: Billing;
  reviewer: { id: string | null; email: string };
}) {
  const { start, end } = periodFor(opts.shop, opts.plan, opts.billing);
  const note = `ชำระเงิน ${PLAN_NAMES[opts.plan]} ${opts.billing === 'yearly' ? 'รายปี' : 'รายเดือน'} ฿${PLAN_PRICES[opts.plan][opts.billing]}`;
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ plan: opts.plan, plan_expires_at: end.toISOString(), plan_note: note })
    .eq('id', opts.shop.id);
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from('plan_payments')
    .update({
      status: 'paid',
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      reviewed_by: opts.reviewer.id ? opts.reviewer.email : 'auto',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', opts.paymentId);

  const { error: logError } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: opts.reviewer.id,
    admin_email: opts.reviewer.id ? opts.reviewer.email : 'ระบบชำระเงิน (อัตโนมัติ)',
    action: 'shop.plan',
    shop_id: opts.shop.id,
    details: {
      from: { plan: planOf(opts.shop), expires_at: opts.shop.plan_expires_at ?? null },
      to: { plan: opts.plan, expires_at: end.toISOString() },
      note,
      payment_id: opts.paymentId,
    },
  });
  if (logError) console.error('[billing] audit log failed', logError.message);
  return { start, end };
}
