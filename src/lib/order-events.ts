import { supabaseAdmin } from '@/lib/supabase';

export type OrderEvent = { kind: string; label: string; detail: string | null; created_at: string };

// บันทึกประวัติที่ลูกค้าเห็นบนหน้าติดตาม (ไม่ throw — ถ้าบันทึกไม่ได้ ออเดอร์ยังอัปเดตตามปกติ)
export async function addOrderEvents(orderId: string, events: { kind: string; label: string; detail?: string | null }[]) {
  if (!events.length) return;
  const { error } = await supabaseAdmin
    .from('order_events')
    .insert(events.map((e) => ({ order_id: orderId, kind: e.kind, label: e.label, detail: e.detail ?? null })));
  if (error) console.error('[order-events] insert failed', error.message);
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('order_events')
    .select('kind, label, detail, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) {
    console.error('[order-events] query failed', error.message);
    return [];
  }
  return data ?? [];
}
