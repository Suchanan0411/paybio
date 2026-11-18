import { supabaseAdmin } from '@/lib/supabase';
import { PLAN_LIMITS, planOf } from '@/lib/plans';

const BUCKET = 'payment-slips';

type SlipRow = { id: string; slip_url: string | null; slip_size: number | null; status: string };

export type SlipStorage = { used: number; limit: number; retentionDays: number | null };

// ชื่อไฟล์ใน Bucket จาก public URL ของสลิป
export function slipPath(url: string | null | undefined) {
  const path = url?.split(`/${BUCKET}/`)[1];
  return path ? decodeURIComponent(path) : null;
}

// พื้นที่สลิปที่ร้านใช้อยู่ (ไบต์) — null = ฐานข้อมูลยังไม่ได้รัน migration โควตา
export async function slipUsage(shopId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc('shop_slip_usage', { p_profile_id: shopId });
  if (error) {
    console.error('[slip-storage] usage unavailable', error.message);
    return null;
  }
  return Number(data) || 0;
}

// ลบไฟล์สลิปออกจาก Storage แล้วล้างลิงก์ในออเดอร์ (ตัวออเดอร์และผลตรวจสลิปยังอยู่)
async function deleteSlips(rows: SlipRow[]) {
  if (rows.length === 0) return true;
  const paths = rows.map((r) => slipPath(r.slip_url)).filter((p): p is string => !!p);
  if (paths.length > 0) {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
    if (error) {
      console.error('[slip-storage] remove failed', error.message);
      return false;
    }
  }
  const { error } = await supabaseAdmin
    .from('orders')
    .update({ slip_url: null })
    .in('id', rows.map((r) => r.id));
  if (error) console.error('[slip-storage] clear slip_url failed', error.message);
  return !error;
}

// แพ็กเกจที่มีอายุเก็บสลิป: ลบสลิปที่เก่ากว่ากำหนด
export async function purgeExpiredSlips(shop: { id: string; plan?: string | null }) {
  const days = PLAN_LIMITS[planOf(shop)].slipRetentionDays;
  if (days == null) return;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, slip_url, slip_size, status')
    .eq('profile_id', shop.id)
    .not('slip_url', 'is', null)
    .lt('created_at', cutoff)
    .limit(500);
  if (error) return console.error('[slip-storage] purge query failed', error.message);
  await deleteSlips(data ?? []);
}

export async function slipStorage(shop: { id: string; plan?: string | null }): Promise<SlipStorage | null> {
  const used = await slipUsage(shop.id);
  if (used == null) return null;
  const limits = PLAN_LIMITS[planOf(shop)];
  return { used, limit: limits.slipStorageBytes, retentionDays: limits.slipRetentionDays };
}

// แพ็กเกจเก็บถาวร: พื้นที่ไม่พอสำหรับสลิปใหม่ขนาด incoming ไบต์ (Free ไม่บล็อก ใช้ trimSlips แทน)
export async function slipQuotaBlocked(shop: { id: string; plan?: string | null }, incoming: number) {
  const storage = await slipStorage(shop);
  return !!storage && storage.retentionDays == null && storage.used + incoming > storage.limit;
}

// หลังบันทึกออเดอร์ใหม่สำเร็จ (แพ็กเกจที่มีอายุเก็บ เช่น Free):
// ลบสลิปหมดอายุ แล้วถ้ายังเกินพื้นที่ ลบสลิปเก่าสุดของออเดอร์ที่ร้านตรวจแล้ว (ไม่แตะสลิปที่ยังรอตรวจ และออเดอร์ keepOrderId)
export async function trimSlips(shop: { id: string; plan?: string | null }, keepOrderId: string) {
  if (PLAN_LIMITS[planOf(shop)].slipRetentionDays == null) return;
  await purgeExpiredSlips(shop);
  const storage = await slipStorage(shop);
  if (!storage) return;
  let excess = storage.used - storage.limit;
  if (excess <= 0) return;

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id, slip_url, slip_size, status')
    .eq('profile_id', shop.id)
    .neq('status', 'pending')
    .neq('id', keepOrderId)
    .not('slip_url', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1000);
  if (error) return console.error('[slip-storage] oldest query failed', error.message);
  const victims: SlipRow[] = [];
  for (const row of data ?? []) {
    if (excess <= 0) break;
    victims.push(row);
    excess -= Number(row.slip_size) || 0;
  }
  await deleteSlips(victims);
}
