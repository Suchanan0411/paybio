import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_LIMITS, PLAN_NAMES, planOf } from '@/lib/plans';
import { removeProductImage } from '@/lib/product-image';

async function currentShop() {
  const user = await getCurrentUser();
  return user ? getShopByUserId(user.id) : null;
}

const unauthorized = () =>
  NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });

// รายการสินค้าของร้านผู้ใช้
export async function GET() {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('profile_id', shop.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

// เพิ่มสินค้า
export async function POST(req: Request) {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const body = await req.json();
  const name = String(body.name ?? '').trim();
  const price = Number(body.price);

  if (!name || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าและราคาที่มากกว่า 0' }, { status: 400 });
  }

  const plan = planOf(shop);
  const maxProducts = PLAN_LIMITS[plan].maxProducts;
  if (Number.isFinite(maxProducts)) {
    const { count } = await supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', shop.id);
    if ((count ?? 0) >= maxProducts) {
      return NextResponse.json(
        { error: `แพ็กเกจ ${PLAN_NAMES[plan]} เพิ่มสินค้าได้สูงสุด ${maxProducts} ชิ้น อัปเกรดเป็น Pro เพื่อเพิ่มได้ไม่จำกัด` },
        { status: 403 }
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({ profile_id: shop.id, name, price })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

// แก้ไขชื่อ/ราคาสินค้า (ออเดอร์เดิมเก็บชื่อและยอดไว้แล้ว จึงไม่กระทบ)
export async function PATCH(req: Request) {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const body = await req.json();
  const id = String(body.id ?? '');
  const name = String(body.name ?? '').trim();
  const price = Number(body.price);

  if (!id || !name || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'กรุณากรอกชื่อสินค้าและราคาที่มากกว่า 0' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .update({ name, price })
    .eq('id', id)
    .eq('profile_id', shop.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'ไม่พบสินค้านี้ในร้านของคุณ' }, { status: 404 });
  return NextResponse.json({ product: data });
}

// ลบสินค้า
export async function DELETE(req: Request) {
  const shop = await currentShop();
  if (!shop) return unauthorized();

  const { id } = await req.json();
  const { data, error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', id)
    .eq('profile_id', shop.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'ไม่พบสินค้านี้ในร้านของคุณ' }, { status: 404 });
  await removeProductImage(data.image_url, shop.id);
  return NextResponse.json({ success: true });
}
