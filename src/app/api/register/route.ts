import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนลงทะเบียนร้านค้า' }, { status: 401 });
    }

    if (await getShopByUserId(user.id)) {
      return NextResponse.json({ error: 'บัญชีนี้มีร้านค้าอยู่แล้ว' }, { status: 409 });
    }

    const body = await req.json();
    const shop_name = String(body.shop_name ?? '').trim();
    const slug = String(body.slug ?? '').toLowerCase().trim();
    const promptpay_number = String(body.promptpay_number ?? '').replace(/[\s-]/g, '');
    const bio = String(body.bio ?? '').trim();

    if (!shop_name || !slug || !promptpay_number) {
      return NextResponse.json(
        { error: 'กรุณากรอกชื่อร้าน, ลิงก์ URL และเบอร์พร้อมเพย์ให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9ก-๙]+(?:-[a-z0-9ก-๙]+)*$/.test(slug)) {
      return NextResponse.json(
        { error: 'ลิงก์ร้านค้าใช้ได้เฉพาะตัวอักษร ตัวเลข และขีด (-) เท่านั้น' },
        { status: 400 }
      );
    }

    if (!/^(\d{10}|\d{13}|\d{15})$/.test(promptpay_number)) {
      return NextResponse.json(
        { error: 'พร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก' },
        { status: 400 }
      );
    }

    // ตรวจสอบ slug ซ้ำ
    const { data: existingShop } = await supabaseAdmin
      .from('profiles')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (existingShop) {
      return NextResponse.json(
        { error: 'ชื่อ URL (slug) นี้มีผู้ใช้งานแล้ว กรุณาเลือกชื่ออื่น' },
        { status: 400 }
      );
    }

    // บันทึกข้อมูลร้านค้าลงตาราง profiles
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .insert({ shop_name, slug, promptpay_number, bio, user_id: user.id })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server Error' }, { status: 500 });
  }
}
