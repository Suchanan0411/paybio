import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'shop-assets';

// path ของไฟล์รูปสินค้าใน bucket — คืนค่าเฉพาะไฟล์ในโฟลเดอร์ของร้านนี้ (กันลบไฟล์ของร้านอื่น)
export function productImagePath(url: string | null | undefined, shopId: string) {
  const raw = url?.split(`/${BUCKET}/`)[1]?.split('?')[0];
  const path = raw ? decodeURIComponent(raw) : null;
  return path && path.startsWith(`products/${shopId}/`) ? path : null;
}

// ไม่ throw: ไฟล์ค้างไม่กี่ KB ไม่ควรทำให้การแก้สินค้าล้มเหลว
export async function removeProductImage(url: string | null | undefined, shopId: string) {
  const path = productImagePath(url, shopId);
  if (!path) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error('[product-image] remove failed', error.message);
}
