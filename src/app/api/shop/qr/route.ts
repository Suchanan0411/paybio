import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { readSlipQr } from '@/lib/slip-qr';

const BUCKET = 'shop-assets';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function currentShop() {
  const user = await getCurrentUser();
  return user ? getShopByUserId(user.id) : null;
}

const unauthorized = () =>
  NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });

function assetPath(url: string | null | undefined) {
  const path = url?.split(`/${BUCKET}/`)[1];
  return path ? decodeURIComponent(path.split('?')[0]) : null;
}

async function removeOld(url: string | null | undefined) {
  const path = assetPath(url);
  if (path) await supabaseAdmin.storage.from(BUCKET).remove([path]);
}

// อัปโหลดรูป QR พร้อมเพย์ของร้าน: ต้องอ่าน QR ได้ และเป็น QR รับเงินมาตรฐาน EMVCo (Thai QR)
export async function POST(req: Request) {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูปภาพ (JPG หรือ PNG)' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5 MB' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const found = await readSlipQr(bytes).catch(() => null);
  if (!found) {
    return NextResponse.json(
      { error: 'อ่าน QR ในรูปไม่ได้ ลองใช้รูปที่ชัดขึ้น หรือครอปให้เห็น QR เต็มกรอบ' },
      { status: 400 }
    );
  }
  if (!found.text.startsWith('000201')) {
    return NextResponse.json(
      { error: 'QR ในรูปไม่ใช่ QR รับเงินพร้อมเพย์ / Thai QR กรุณาใช้ QR รับเงินจากแอปธนาคาร' },
      { status: 400 }
    );
  }

  // แปลงเป็น PNG ขนาดพอดี และตัดข้อมูล EXIF (เช่น ตำแหน่งที่ถ่าย) ออก
  const sharp = (await import('sharp')).default;
  const png = await sharp(Buffer.from(bytes))
    .rotate()
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const path = `${shop.id}/promptpay-${Date.now()}.png`;
  const { error: upError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', cacheControl: '31536000', upsert: false });
  if (upError) return NextResponse.json({ error: upError.message }, { status: 500 });

  const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await supabaseAdmin.from('profiles').update({ promptpay_qr_url: url }).eq('id', shop.id);
  if (error) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await removeOld(shop.promptpay_qr_url);
  return NextResponse.json({ promptpay_qr_url: url });
}

// ลบรูป QR ของร้าน (หน้าร้านกลับไปใช้ QR ที่ระบบสร้างตามยอดอย่างเดียว)
export async function DELETE() {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const { error } = await supabaseAdmin.from('profiles').update({ promptpay_qr_url: null }).eq('id', shop.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await removeOld(shop.promptpay_qr_url);
  return NextResponse.json({ promptpay_qr_url: null });
}
