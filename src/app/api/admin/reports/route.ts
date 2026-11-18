import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PLAN_NAMES, planOf, type Plan } from '@/lib/plans';
import { requireAdmin } from '@/lib/admin';

type Daily = { day: string; orders: number; paid_orders: number; paid_amount: number; new_shops: number };
type OrderStats = { profile_id: string | null; order_count: number; paid_total: number };

// รายงานภาพรวม: สถิติรายวัน (เวลาไทย), สัดส่วนแพ็กเกจ, ร้านยอดขายสูงสุด — ?days=7|30|90
export async function GET(req: Request) {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const requested = Number(new URL(req.url).searchParams.get('days'));
  const days = [7, 30, 90].includes(requested) ? requested : 30;

  const [daily, profiles, stats] = await Promise.all([
    supabaseAdmin.rpc('admin_daily_stats', { p_days: days }),
    supabaseAdmin.from('profiles').select('id, shop_name, slug, plan, plan_expires_at'),
    supabaseAdmin.rpc('admin_order_stats'),
  ]);
  const error = daily.error ?? profiles.error ?? stats.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shops = profiles.data ?? [];
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const topShops = ((stats.data ?? []) as OrderStats[])
    .filter((s) => s.profile_id && shopById.has(s.profile_id))
    .map((s) => {
      const shop = shopById.get(s.profile_id!)!;
      return {
        id: shop.id,
        shop_name: shop.shop_name,
        slug: shop.slug,
        plan: planOf(shop),
        order_count: Number(s.order_count),
        paid_total: Number(s.paid_total),
      };
    })
    .sort((a, b) => b.paid_total - a.paid_total || b.order_count - a.order_count)
    .slice(0, 10);

  return NextResponse.json({
    days,
    daily: ((daily.data ?? []) as Daily[]).map((d) => ({
      day: d.day,
      orders: Number(d.orders),
      paid_orders: Number(d.paid_orders),
      paid_amount: Number(d.paid_amount),
      new_shops: Number(d.new_shops),
    })),
    plans: (Object.keys(PLAN_NAMES) as Plan[]).map((plan) => ({ plan, shops: shops.filter((s) => planOf(s) === plan).length })),
    topShops,
  });
}
