import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { accountName, isAdmin } from '@/lib/supabase-server';
import { PLAN_NAMES, planOf } from '@/lib/plans';
import { listAllUsers, logAdminAction, requireAdmin } from '@/lib/admin';

type Order = {
  id: string;
  order_number: string;
  item_title: string;
  amount: number;
  slip_url: string | null;
  status: string;
  profile_id: string | null;
  created_at: string;
};

type OrderStats = { profile_id: string | null; order_count: number; pending_count: number; paid_total: number };

// ข้อมูลภาพรวมทั้งระบบสำหรับผู้ดูแล: ร้านค้า ผู้ใช้ และคำสั่งซื้อ
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  // รายการออเดอร์แสดง 1,000 รายการล่าสุด แต่ตัวเลขสรุปมาจาก admin_order_stats ซึ่งนับครบทุกออเดอร์
  const [profilesRes, productsRes, ordersRes, statsRes, users] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('products').select('id, profile_id'),
    supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false }).limit(1000),
    supabaseAdmin.rpc('admin_order_stats'),
    listAllUsers(),
  ]);

  const error = profilesRes.error ?? productsRes.error ?? ordersRes.error ?? statsRes.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const profiles = profilesRes.data ?? [];
  const products = productsRes.data ?? [];
  const orders = (ordersRes.data ?? []) as Order[];
  const orderStats = (statsRes.data ?? []) as OrderStats[];
  const statsByShop = new Map(orderStats.map((s) => [s.profile_id, s]));

  const emailById = new Map(users.map((u) => [u.id, u.email ?? null]));
  const shopByUser = new Map(profiles.filter((p) => p.user_id).map((p) => [p.user_id, p]));
  const shopNameById = new Map(profiles.map((p) => [p.id, p.shop_name]));

  const shops = profiles.map((p) => {
    const st = statsByShop.get(p.id);
    return {
      id: p.id,
      shop_name: p.shop_name,
      slug: p.slug,
      promptpay_number: p.promptpay_number,
      created_at: p.created_at,
      plan: planOf(p),
      plan_raw: p.plan ?? 'free', // แพ็กเกจที่ตั้งไว้ (อาจหมดอายุแล้ว)
      plan_expires_at: p.plan_expires_at ?? null,
      plan_note: p.plan_note ?? null,
      custom_domain: p.custom_domain ?? null,
      suspended_at: p.suspended_at ?? null,
      suspended_reason: p.suspended_reason ?? null,
      owner_email: p.user_id ? (emailById.get(p.user_id) ?? null) : null,
      product_count: products.filter((pr) => pr.profile_id === p.id).length,
      order_count: Number(st?.order_count ?? 0),
      pending_count: Number(st?.pending_count ?? 0),
      paid_total: Number(st?.paid_total ?? 0),
    };
  });

  const userRows = users
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      name: accountName(u),
      provider: u.user_metadata?.provider ?? u.app_metadata?.provider ?? 'email',
      is_admin: isAdmin(u),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      shop_name: shopByUser.get(u.id)?.shop_name ?? null,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const orderRows = orders.map((o) => ({
    ...o,
    shop_name: o.profile_id ? (shopNameById.get(o.profile_id) ?? null) : null,
  }));

  return NextResponse.json({
    stats: {
      shops: profiles.length,
      suspended: profiles.filter((p) => p.suspended_at).length,
      users: users.length,
      orders: orderStats.reduce((sum, s) => sum + Number(s.order_count), 0),
      pending: orderStats.reduce((sum, s) => sum + Number(s.pending_count), 0),
      paid_total: orderStats.reduce((sum, s) => sum + Number(s.paid_total), 0),
    },
    shops,
    users: userRows,
    orders: orderRows,
  });
}

// ระงับ / ยกเลิกระงับร้านค้า ({ suspended, reason }) หรือเปลี่ยนแพ็กเกจ ({ plan, expires_at?, note? })
// expires_at = วันที่สิ้นสุดสิทธิ์ (ISO) หรือ null = ไม่หมดอายุ — ทุกการเปลี่ยนแปลงบันทึกลง admin_audit_log
export async function PATCH(req: Request) {
  const { user, denied } = await requireAdmin();
  if (denied) return denied;

  const { shop_id, suspended, reason, plan, expires_at, note } = await req.json();
  if (!shop_id) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const { data: before } = await supabaseAdmin.from('profiles').select('*').eq('id', shop_id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'ไม่พบร้านค้านี้' }, { status: 404 });

  let changes: Record<string, string | null>;
  let action: 'shop.suspend' | 'shop.unsuspend' | 'shop.plan';
  let details: Record<string, unknown>;
  if (typeof suspended === 'boolean') {
    const why = String(reason ?? '').trim().slice(0, 500) || null;
    changes = suspended
      ? { suspended_at: new Date().toISOString(), suspended_reason: why }
      : { suspended_at: null, suspended_reason: null };
    action = suspended ? 'shop.suspend' : 'shop.unsuspend';
    details = suspended ? { reason: why } : { previous_reason: before.suspended_reason ?? null };
  } else if ((Object.keys(PLAN_NAMES) as string[]).includes(plan)) {
    let expires: string | null = null;
    if (plan !== 'free' && expires_at) {
      const t = new Date(expires_at);
      if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'วันหมดอายุต้องเป็นวันในอนาคต' }, { status: 400 });
      }
      expires = t.toISOString();
    }
    changes = { plan, plan_expires_at: expires, plan_note: String(note ?? '').trim().slice(0, 300) || null };
    action = 'shop.plan';
    details = {
      from: { plan: before.plan ?? 'free', expires_at: before.plan_expires_at ?? null },
      to: { plan, expires_at: expires },
      note: changes.plan_note,
    };
  } else {
    return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from('profiles').update(changes).eq('id', shop_id).select('*').maybeSingle();
  if (error) {
    // ยังไม่ได้รัน migration
    if (/suspended_(at|reason)|plan/.test(error.message)) {
      return NextResponse.json(
        { error: 'ฐานข้อมูลยังไม่รองรับฟีเจอร์นี้ กรุณารัน migration ใน supabase/migrations ให้ครบก่อน' },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'ไม่พบร้านค้านี้' }, { status: 404 });

  await logAdminAction(user, action, shop_id, details);
  return NextResponse.json({ shop: { ...data, plan: planOf(data), plan_raw: data.plan } });
}
