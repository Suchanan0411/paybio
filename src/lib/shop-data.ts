import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { shopClosedReason } from '@/lib/order-limits';
import { planOf } from '@/lib/plans';

export type PublicShop = {
  id: string;
  slug: string;
  shop_name: string;
  bio: string | null;
  promptpay_number: string;
  promptpay_qr_url: string | null; // รูป QR ที่ร้านอัปโหลดเอง
  plan: string | null;
  theme: unknown;
  suspended: boolean;
  closedReason: string | null; // รับออเดอร์ใหม่ไม่ได้ (ครบโควตา/พื้นที่สลิปเต็ม)
};
export type PublicProduct = { id: string; name: string; price: number; image_url?: string | null };

// ข้อมูลหน้าร้านที่เปิดเผยต่อสาธารณะ (ไม่ส่ง user_id / เหตุผลการระงับ ไปให้ลูกค้า)
export const getPublicShop = cache(async (slug: string) => {
  const { data: shop } = await supabaseAdmin.from('profiles').select('*').eq('slug', slug).maybeSingle();
  if (!shop) return null;

  const [{ data: products }, closedReason] = await Promise.all([
    supabaseAdmin.from('products').select('id, name, price, image_url').eq('profile_id', shop.id).order('created_at', { ascending: false }),
    shop.suspended_at ? null : shopClosedReason(shop),
  ]);

  return {
    shop: {
      id: shop.id,
      slug: shop.slug,
      shop_name: shop.shop_name,
      bio: shop.bio,
      promptpay_number: shop.promptpay_number,
      promptpay_qr_url: shop.promptpay_qr_url ?? null,
      plan: planOf(shop), // แพ็กเกจที่ใช้งานได้จริง (หมดอายุแล้ว = free)
      theme: shop.theme ?? null,
      suspended: !!shop.suspended_at,
      closedReason,
    } satisfies PublicShop,
    products: (products ?? []).map((p) => ({ ...p, price: Number(p.price) })) as PublicProduct[],
  };
});
