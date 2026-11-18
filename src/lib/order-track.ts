import { supabaseAdmin } from '@/lib/supabase';
import { planOf } from '@/lib/plans';
import type { Fulfillment, OrderStatus } from '@/lib/order-stages';

export type TrackedOrder = {
  id: string; // ใช้ภายในเซิร์ฟเวอร์เท่านั้น (ดึงประวัติ) — ไม่ส่งออกทาง API
  token: string;
  order_number: string;
  item_title: string;
  quantity: number;
  amount: number;
  status: OrderStatus;
  fulfillment: Fulfillment | null;
  carrier: string | null;
  tracking_number: string | null;
  shop_message: string | null;
  created_at: string;
  updated_at: string | null;
  shop: { shop_name: string; slug: string; plan: string | null; theme: unknown } | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ข้อมูลออเดอร์ที่ลูกค้าดูได้จากลิงก์ติดตาม (ไม่มีสลิป/ข้อมูลติดต่อ/ผลตรวจสลิป)
export async function getTrackedOrders(tokens: string[]): Promise<TrackedOrder[]> {
  const valid = [...new Set(tokens.filter((t) => UUID_RE.test(t)))].slice(0, 20);
  if (valid.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(
      'id, track_token, order_number, item_title, quantity, amount, status, fulfillment, carrier, tracking_number, shop_message, created_at, status_updated_at, profiles(shop_name, slug, plan, plan_expires_at, theme)'
    )
    .in('track_token', valid);
  if (error) {
    console.error('[order-track] query failed', error.message);
    return [];
  }
  return (data ?? []).map((o) => {
    const raw = (Array.isArray(o.profiles) ? o.profiles[0] : o.profiles) as
      | (NonNullable<TrackedOrder['shop']> & { plan_expires_at: string | null })
      | null;
    const shop = raw && { shop_name: raw.shop_name, slug: raw.slug, plan: planOf(raw), theme: raw.theme };
    return {
      id: o.id,
      token: o.track_token,
      order_number: o.order_number,
      item_title: o.item_title,
      quantity: o.quantity ?? 1,
      amount: Number(o.amount),
      status: o.status,
      fulfillment: o.fulfillment ?? null,
      carrier: o.carrier ?? null,
      tracking_number: o.tracking_number ?? null,
      shop_message: o.shop_message ?? null,
      created_at: o.created_at,
      updated_at: o.status_updated_at ?? null,
      shop: shop ?? null,
    };
  });
}

// ตัดช่องว่าง/ขีด และตัวพิมพ์ เพื่อเทียบช่องทางติดต่อที่ลูกค้ากรอก (เบอร์, LINE ID, อีเมล)
const norm = (s: string) => s.toLowerCase().replace(/[\s\-().]/g, '').replace(/^line:?/, '').replace(/^@/, '');
const digits = (s: string) => s.replace(/\D/g, '');

/**
 * ค้นหาออเดอร์จากเลขออเดอร์ + ช่องทางติดต่อ/อีเมลที่ใช้ตอนสั่ง คืน track token ที่ตรงกัน
 * ต้องตรงทั้งสองอย่าง (เลขออเดอร์อย่างเดียวเดาได้ง่าย)
 */
export async function findOrderTokens(orderNumber: string, contact: string): Promise<string[]> {
  const num = orderNumber.trim().toUpperCase().replace(/\s/g, '');
  const want = norm(contact);
  if (!/^PB-\d{4,10}$/.test(num) || want.length < 4) return [];
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('track_token, customer_contact, customer_email')
    .eq('order_number', num)
    .limit(20);
  if (error) {
    console.error('[order-track] lookup failed', error.message);
    return [];
  }
  const wantDigits = digits(contact);
  return (data ?? [])
    .filter((o) => {
      const candidates = [o.customer_contact, o.customer_email].filter((v): v is string => !!v);
      return candidates.some((c) => {
        if (norm(c) === want) return true;
        // เบอร์โทรที่พิมพ์ต่างรูปแบบ (081-234-5678 / 0812345678 / +66812345678)
        const d = digits(c);
        return wantDigits.length >= 9 && d.length >= 9 && d.slice(-9) === wantDigits.slice(-9);
      });
    })
    .map((o) => o.track_token)
    .filter(Boolean);
}
