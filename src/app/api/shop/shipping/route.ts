import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { parseShippingInput } from '@/lib/shipping';

// บันทึกวิธีจัดส่ง ค่าส่ง และข้อมูลผู้ส่ง (ใช้ได้ทุกแพ็กเกจ)
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const shipping = parseShippingInput(await req.json().catch(() => null));
  if (typeof shipping === 'string') return NextResponse.json({ error: shipping }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('profiles').update({ shipping }).eq('id', shop.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shop: data });
}
