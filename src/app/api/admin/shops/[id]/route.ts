import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { requireAdmin } from '@/lib/admin';
import { slipStorage } from '@/lib/slip-storage';
import { monthlyOrdersFull } from '@/lib/order-limits';
import { accountName } from '@/lib/supabase-server';

type OrderStats = { profile_id: string | null; order_count: number; pending_count: number; paid_total: number };

// รายละเอียดร้านสำหรับผู้ดูแล: เจ้าของ สินค้า ออเดอร์ล่าสุด พื้นที่สลิป การแจ้งเตือน และประวัติที่แอดมินทำกับร้านนี้
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const { data: shop } = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!shop) return NextResponse.json({ error: 'ไม่พบร้านค้านี้' }, { status: 404 });

  const [owner, products, orders, stats, audit, storage, quotaFull] = await Promise.all([
    shop.user_id ? supabaseAdmin.auth.admin.getUserById(shop.user_id) : null,
    supabaseAdmin.from('products').select('id, name, price, created_at').eq('profile_id', id).order('created_at', { ascending: false }),
    supabaseAdmin
      .from('orders')
      .select('id, order_number, item_title, amount, status, created_at, slip_url, slip_check, customer_name')
      .eq('profile_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin.rpc('admin_order_stats'),
    supabaseAdmin.from('admin_audit_log').select('*').eq('shop_id', id).order('created_at', { ascending: false }).limit(50),
    slipStorage(shop),
    monthlyOrdersFull(shop),
  ]);

  const st = ((stats.data ?? []) as OrderStats[]).find((s) => s.profile_id === id);
  const plan = planOf(shop);
  const user = owner?.data.user;

  return NextResponse.json({
    shop: {
      id: shop.id,
      shop_name: shop.shop_name,
      slug: shop.slug,
      bio: shop.bio,
      promptpay_number: shop.promptpay_number,
      created_at: shop.created_at,
      plan,
      plan_raw: shop.plan ?? 'free',
      plan_expires_at: shop.plan_expires_at ?? null,
      plan_note: shop.plan_note ?? null,
      custom_domain: shop.custom_domain ?? null,
      suspended_at: shop.suspended_at ?? null,
      suspended_reason: shop.suspended_reason ?? null,
      line_connected: !!shop.line_user_id,
      webhook_url: shop.order_webhook_url ?? null,
    },
    owner: user
      ? {
          email: user.email ?? null,
          name: accountName(user),
          provider: user.user_metadata?.provider ?? user.app_metadata?.provider ?? 'email',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
        }
      : null,
    stats: {
      order_count: Number(st?.order_count ?? 0),
      pending_count: Number(st?.pending_count ?? 0),
      paid_total: Number(st?.paid_total ?? 0),
      product_count: products.data?.length ?? 0,
      max_products: Number.isFinite(PLAN_LIMITS[plan].maxProducts) ? PLAN_LIMITS[plan].maxProducts : null,
      monthly_quota_full: quotaFull,
    },
    storage,
    products: products.data ?? [],
    orders: orders.data ?? [],
    audit: audit.data ?? [],
  });
}
