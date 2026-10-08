import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';

const ORDER_STATUSES = ['pending', 'paid', 'rejected'];

// ร้านค้าของผู้ใช้ที่ล็อกอินอยู่ (ใช้ตรวจสิทธิ์จัดการคำสั่งซื้อ)
async function currentShop() {
  const user = await getCurrentUser();
  return user ? getShopByUserId(user.id) : null;
}

// รายการคำสั่งซื้อของร้านค้าผู้ใช้
export async function GET() {
  const shop = await currentShop();
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('profile_id', shop.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data });
}

// อนุมัติ / ปฏิเสธคำสั่งซื้อ
export async function PATCH(req: Request) {
  const shop = await currentShop();
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const { id, status } = await req.json();
  if (!id || !ORDER_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', id)
    .eq('profile_id', shop.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อนี้ในร้านของคุณ' }, { status: 404 });
  }
  return NextResponse.json({ order: data });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('slip') as File | null;
    const itemTitle = (formData.get('item_title') as string) || 'สินค้าทั่วไป';
    const amount = Number(formData.get('amount')) || 0;
    const profileId = (formData.get('profile_id') as string) || null;
    const orderNumber = `PB-${Date.now().toString().slice(-6)}`;

    let slipUrl = null;

    // อัปโหลดไฟล์สลิปเข้า Bucket 'payment-slips'
    if (file && file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderNumber}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('payment-slips')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json({ error: 'Storage Error: ' + uploadError.message }, { status: 500 });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('payment-slips')
        .getPublicUrl(fileName);

      slipUrl = urlData.publicUrl;
    }

    // บันทึกลงตาราง orders
    const { data: orderData, error: dbError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        item_title: itemTitle,
        amount: amount,
        slip_url: slipUrl,
        status: 'pending',
        profile_id: profileId,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: 'Database Error: ' + dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: orderData });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server Error' }, { status: 500 });
  }
}