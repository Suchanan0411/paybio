export type Plan = 'free' | 'pro' | 'business';

export const PLAN_NAMES: Record<Plan, string> = {
  free: 'Free Tier',
  pro: 'Pro Merchant',
  business: 'Business Studio',
};

const MB = 1024 ** 2;
const GB = 1024 ** 3;

// สิทธิ์ของแต่ละแพ็กเกจ (ให้ตรงกับตารางใน components/pricing.tsx)
export const PLAN_LIMITS: Record<
  Plan,
  {
    maxProducts: number;
    maxOrdersPerMonth: number;
    watermark: boolean;
    exportMonths: number | null; // null = ส่งออกไม่ได้, Infinity = ไม่จำกัด
    customDomain: boolean;
    slipCheck: 'basic' | 'amount' | 'full';
    lineNotify: boolean;
    webhook: boolean;
    theme: 'standard' | 'palette' | 'custom';
    slipStorageBytes: number;
    slipRetentionDays: number | null; // null = เก็บถาวร
  }
> = {
  free: { maxProducts: 3, maxOrdersPerMonth: 50, watermark: true, exportMonths: null, customDomain: false, slipCheck: 'basic', lineNotify: false, webhook: false, theme: 'standard', slipStorageBytes: 100 * MB, slipRetentionDays: 30 },
  pro: { maxProducts: Infinity, maxOrdersPerMonth: Infinity, watermark: false, exportMonths: 3, customDomain: false, slipCheck: 'amount', lineNotify: true, webhook: false, theme: 'palette', slipStorageBytes: 5 * GB, slipRetentionDays: null },
  business: { maxProducts: Infinity, maxOrdersPerMonth: Infinity, watermark: false, exportMonths: Infinity, customDomain: true, slipCheck: 'full', lineNotify: true, webhook: true, theme: 'custom', slipStorageBytes: 20 * GB, slipRetentionDays: null },
};

// แพ็กเกจที่ใช้งานได้จริง: แพ็กเกจที่แอดมินให้แบบมีกำหนด (plan_expires_at) หมดอายุแล้วถือเป็น Free
export function planOf(
  shop: { plan?: string | null; plan_expires_at?: string | null } | null | undefined,
  now?: number
): Plan {
  const plan = shop?.plan;
  if (plan !== 'pro' && plan !== 'business') return 'free';
  // อ่านเวลาเฉพาะเมื่อมีวันหมดอายุ (หน้าที่ prerender ได้ เช่น /demo จะไม่แตะ Date.now)
  if (shop?.plan_expires_at && new Date(shop.plan_expires_at).getTime() <= (now ?? Date.now())) return 'free';
  return plan;
}
