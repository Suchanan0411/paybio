import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';

// แก้ไขข้อมูลร้านค้าของผู้ใช้
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const body = await req.json();
  const shop_name = String(body.shop_name ?? '').trim();
  const promptpay_number = String(body.promptpay_number ?? '').replace(/[\s-]/g, '');
  const bio = String(body.bio ?? '').trim();

  if (!shop_name) {
    return NextResponse.json({ error: 'กรุณากรอกชื่อร้านค้า' }, { status: 400 });
  }
  if (!/^(\d{10}|\d{13}|\d{15})$/.test(promptpay_number)) {
    return NextResponse.json(
      { error: 'พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ shop_name, promptpay_number, bio })
    .eq('id', shop.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shop: data });
}
