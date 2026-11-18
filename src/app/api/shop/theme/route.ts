import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { parseThemeInput } from '@/lib/shop-theme';

// บันทึกธีมหน้าร้าน (ชุดสี + ฟอนต์ ตั้งแต่ Pro, สีแบรนด์เอง เฉพาะ Business)
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }
  const level = PLAN_LIMITS[planOf(shop)].theme;
  if (level === 'standard') {
    return NextResponse.json({ error: 'การเลือกชุดสีและฟอนต์ใช้ได้ตั้งแต่แพ็กเกจ Pro Merchant' }, { status: 403 });
  }

  const theme = parseThemeInput(await req.json().catch(() => null), level);
  if (typeof theme === 'string') return NextResponse.json({ error: theme }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('profiles').update({ theme }).eq('id', shop.id).select().single();
  if (error) {
    if (/theme/.test(error.message)) {
      return NextResponse.json(
        { error: 'ฐานข้อมูลยังไม่รองรับธีม กรุณารันไฟล์ supabase/migrations/20261012_shop_theme.sql ก่อน' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ shop: data });
}
