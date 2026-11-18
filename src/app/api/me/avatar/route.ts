import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { accountAvatar, getCurrentUser } from '@/lib/supabase-server';

const BUCKET = 'shop-assets';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function ownPath(url: unknown, userId: string) {
  if (typeof url !== 'string') return null;
  const path = url.split(`/${BUCKET}/`)[1]?.split('?')[0];
  // ลบได้เฉพาะไฟล์ในโฟลเดอร์รูปโปรไฟล์ของผู้ใช้คนนี้
  return path && decodeURIComponent(path).startsWith(`avatars/${userId}/`) ? decodeURIComponent(path) : null;
}

// อัปโหลดรูปโปรไฟล์: ครอปเป็นสี่เหลี่ยม 256px PNG และตัดข้อมูล EXIF ออก
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'กรุณาเลือกไฟล์รูปภาพ (JPG หรือ PNG)' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 5 MB' }, { status: 400 });

  let png: Buffer;
  try {
    const sharp = (await import('sharp')).default;
    png = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'เปิดไฟล์รูปไม่ได้ ลองใช้ JPG หรือ PNG' }, { status: 400 });
  }

  const path = `avatars/${user.id}/${Date.now()}.png`;
  const { error: upError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, png, { contentType: 'image/png', cacheControl: '31536000' });
  if (upError) return NextResponse.json({ error: upError.message }, { status: 500 });

  const url = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const old = ownPath(user.user_metadata?.custom_avatar_url, user.id);
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, custom_avatar_url: url },
  });
  if (error || !data.user) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: error?.message ?? 'บันทึกไม่สำเร็จ' }, { status: 500 });
  }
  if (old) await supabaseAdmin.storage.from(BUCKET).remove([old]);
  return NextResponse.json({ avatar: url, customAvatar: true });
}

// ลบรูปที่อัปโหลดเอง (กลับไปใช้รูปจาก Google/LINE ถ้ามี)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const old = ownPath(user.user_metadata?.custom_avatar_url, user.id);
  const meta = { ...user.user_metadata, custom_avatar_url: null };
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: meta });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'ลบไม่สำเร็จ' }, { status: 500 });
  if (old) await supabaseAdmin.storage.from(BUCKET).remove([old]);
  return NextResponse.json({ avatar: accountAvatar(data.user), customAvatar: false });
}
