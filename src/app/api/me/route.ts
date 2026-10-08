import { NextResponse } from 'next/server';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';

// ข้อมูลผู้ใช้ที่ล็อกอินอยู่ และร้านค้าของผู้ใช้ (ถ้ามี)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null, shop: null }, { status: 401 });
  }

  const shop = await getShopByUserId(user.id);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar: user.user_metadata?.avatar_url ?? null,
      provider: user.user_metadata?.provider ?? user.app_metadata?.provider ?? 'email',
    },
    shop,
  });
}
