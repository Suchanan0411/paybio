import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { productImagePath, removeProductImage } from '@/lib/product-image';

const BUCKET = 'shop-assets';
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

async function ownProduct(productId: string) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) return { error: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 }) };
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('id, image_url')
    .eq('id', productId)
    .eq('profile_id', shop.id)
    .maybeSingle();
  if (!product) return { error: NextResponse.json({ error: 'ไม่พบสินค้านี้ในร้านของคุณ' }, { status: 404 }) };
  return { shop, product };
}

// อัปโหลดรูปสินค้า: ครอปเป็นสี่เหลี่ยมจัตุรัส 800px WebP และตัดข้อมูล EXIF (เช่น ตำแหน่งที่ถ่าย) ออก
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const productId = String(form?.get('product_id') ?? '');
  const file = form?.get('file');
  if (!productId) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG หรือ WebP)' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 8 MB' }, { status: 400 });

  const owned = await ownProduct(productId);
  if ('error' in owned) return owned.error;

  let webp: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(800, 800, { fit: 'cover', position: 'attention' })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'เปิดไฟล์รูปไม่ได้ ลองใช้ JPG หรือ PNG' }, { status: 400 });
  }

  const path = `products/${owned.shop.id}/${productId}-${Date.now()}.webp`;
  const { error: upError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000' });
  if (upError) return NextResponse.json({ error: upError.message }, { status: 500 });

  const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { data, error } = await supabaseAdmin
    .from('products')
    .update({ image_url: url })
    .eq('id', productId)
    .eq('profile_id', owned.shop.id)
    .select()
    .single();
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await removeProductImage(owned.product.image_url, owned.shop.id);
  return NextResponse.json({ product: data });
}

// ลบรูปสินค้า (กลับไปใช้ไอคอนแทนรูป)
export async function DELETE(req: Request) {
  const { product_id } = await req.json().catch(() => ({}));
  const owned = await ownProduct(String(product_id ?? ''));
  if ('error' in owned) return owned.error;

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({ image_url: null })
    .eq('id', owned.product.id)
    .eq('profile_id', owned.shop.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (productImagePath(owned.product.image_url, owned.shop.id)) await removeProductImage(owned.product.image_url, owned.shop.id);
  return NextResponse.json({ product: data });
}
