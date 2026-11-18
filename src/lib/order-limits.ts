import { supabaseAdmin } from '@/lib/supabase';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { slipStorage } from '@/lib/slip-storage';

type Shop = { id: string; plan?: string | null };

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // ไทยไม่มีเวลาออมแสง

// เที่ยงคืนวันที่ 1 ของเดือนนี้ตามเวลาไทย (เซิร์ฟเวอร์อาจตั้งเป็น UTC)
export function bangkokMonthStart(now = new Date()) {
  const th = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return new Date(Date.UTC(th.getUTCFullYear(), th.getUTCMonth(), 1) - BANGKOK_OFFSET_MS);
}

// แพ็กเกจที่จำกัดออเดอร์ต่อเดือน: รับครบโควตาเดือนนี้แล้วหรือยัง
export async function monthlyOrdersFull(shop: Shop) {
  const limit = PLAN_LIMITS[planOf(shop)].maxOrdersPerMonth;
  if (!Number.isFinite(limit)) return false;
  const monthStart = bangkokMonthStart().toISOString();
  const { count } = await supabaseAdmin
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', shop.id)
    .gte('created_at', monthStart);
  return (count ?? 0) >= limit;
}

// เหตุผลที่ร้านรับออเดอร์ใหม่ไม่ได้ตอนนี้ (null = รับได้) — แสดงให้ลูกค้าเห็นก่อนโอนเงิน
export async function shopClosedReason(shop: Shop): Promise<string | null> {
  const [full, storage] = await Promise.all([monthlyOrdersFull(shop), slipStorage(shop)]);
  if (full) return 'ร้านนี้รับคำสั่งซื้อครบโควตาของเดือนนี้แล้ว';
  if (storage && storage.retentionDays == null && storage.used >= storage.limit) {
    return 'ร้านนี้ปิดรับคำสั่งซื้อชั่วคราว';
  }
  return null;
}
