import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_LIMITS, planOf } from '@/lib/plans';

const STATUS_LABEL: Record<string, string> = { pending: 'รอตรวจสอบ', paid: 'ชำระแล้ว', rejected: 'ปฏิเสธ' };
const VERDICT_LABEL: Record<string, string> = { pass: 'ผ่าน', warn: 'ควรตรวจซ้ำ', fail: 'ไม่ผ่าน', unchecked: 'ตรวจยอดเอง' };

// ป้องกัน CSV/Excel formula injection จากข้อความที่ลูกค้ากรอก แล้ว escape ตามรูปแบบ CSV
function csvCell(value: unknown) {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ส่งออกคำสั่งซื้อเป็น CSV (เปิดใน Excel ได้) — ?months=1|3|12|all
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const allowed = PLAN_LIMITS[planOf(shop)].exportMonths;
  if (allowed == null) {
    return NextResponse.json({ error: 'การส่งออกรายงานใช้ได้ตั้งแต่แพ็กเกจ Pro Merchant' }, { status: 403 });
  }

  const param = new URL(req.url).searchParams.get('months') ?? '1';
  const requested = param === 'all' ? Infinity : Math.max(1, Number(param) || 1);
  if (requested > allowed) {
    return NextResponse.json(
      { error: `แพ็กเกจของคุณส่งออกได้ย้อนหลังสูงสุด ${allowed} เดือน` },
      { status: 403 }
    );
  }

  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .eq('profile_id', shop.id)
    .order('created_at', { ascending: false });
  if (Number.isFinite(requested)) {
    const since = new Date();
    since.setMonth(since.getMonth() - requested);
    query = query.gte('created_at', since.toISOString());
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const header = [
    'เลขคำสั่งซื้อ',
    'วันที่',
    'สินค้า',
    'จำนวน',
    'ค่าสินค้า (บาท)',
    'ค่าส่ง (บาท)',
    'ยอดเงิน (บาท)',
    'สถานะ',
    'วิธีจัดส่ง',
    'เลขพัสดุ',
    'ชื่อผู้สั่ง',
    'ติดต่อ',
    'เบอร์ผู้รับ',
    'ที่อยู่จัดส่ง',
    'รหัสไปรษณีย์',
    'หมายเหตุ',
    'ผลตรวจสลิป',
    'ลิงก์สลิป',
  ];
  // ลิงก์สลิปชี้มาที่แอป (ต้องล็อกอินเป็นเจ้าของร้านจึงจะเปิดได้)
  const origin = new URL(req.url).origin;
  const rows = (data ?? []).map((o) => [
    o.order_number,
    o.created_at
      ? new Date(o.created_at).toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' })
      : '',
    o.item_title,
    o.quantity ?? 1,
    Number(o.subtotal ?? o.amount).toFixed(2),
    Number(o.shipping_fee ?? 0).toFixed(2),
    Number(o.amount).toFixed(2),
    STATUS_LABEL[o.status] ?? o.status,
    o.shipping_method ?? '',
    o.tracking_number ?? '',
    o.customer_name ?? '',
    o.customer_contact ?? '',
    o.ship_phone ?? '',
    o.ship_address ?? '',
    o.ship_postcode ?? '',
    o.note ?? '',
    o.slip_check ? (VERDICT_LABEL[o.slip_check.verdict] ?? '') : '',
    o.slip_url ? `${origin}/api/orders/slip?id=${o.id}` : '',
  ]);

  // BOM ให้ Excel อ่านภาษาไทยถูกต้อง
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="paybio-orders-${shop.slug.replace(/[^a-z0-9-]/g, '') || 'shop'}-${stamp}.csv"`,
    },
  });
}
