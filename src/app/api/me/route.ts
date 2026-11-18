import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';
import { accountAvatar, accountName, getCurrentUser, getShopByUserId, isAdmin } from '@/lib/supabase-server';

function account(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: accountName(user),
    avatar: accountAvatar(user),
    // รูปจาก Google/LINE (ใช้ตอนลบรูปที่อัปโหลดเอง)
    providerAvatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    customAvatar: !!user.user_metadata?.custom_avatar_url,
    provider: user.user_metadata?.provider ?? user.app_metadata?.provider ?? 'email',
    isAdmin: isAdmin(user),
  };
}

// ข้อมูลผู้ใช้ที่ล็อกอินอยู่ และร้านค้าของผู้ใช้ (ถ้ามี)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, shop: null }, { status: 401 });
  }

  const shop = await getShopByUserId(user.id);
  return NextResponse.json({ user: account(user), shop });
}

// แก้ชื่อที่แสดงของบัญชี
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return NextResponse.json({ error: 'กรุณากรอกชื่อ' }, { status: 400 });
  if (name.length > 60) return NextResponse.json({ error: 'ชื่อยาวได้ไม่เกิน 60 ตัวอักษร' }, { status: 400 });

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, display_name: name },
  });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'บันทึกไม่สำเร็จ' }, { status: 500 });
  return NextResponse.json({ user: account(data.user) });
}
