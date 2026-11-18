import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';
import type { SlipCheck } from '@/lib/slip-check';

type Flag = { id: string; dup_file: boolean; dup_ref: boolean };

// ออเดอร์ที่สลิปน่าสงสัยทั้งระบบ: ผลตรวจไม่ผ่าน/ควรตรวจซ้ำ, ไฟล์สลิปซ้ำ, เลขอ้างอิงซ้ำ (รวมข้ามร้าน)
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { data: flagged, error } = await supabaseAdmin.rpc('admin_suspicious_orders', { p_limit: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const flags = new Map(((flagged ?? []) as Flag[]).map((f) => [f.id, f]));
  if (flags.size === 0) return NextResponse.json({ orders: [] });

  const { data: orders, error: e2 } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, item_title, amount, status, created_at, slip_url, slip_check, customer_name, profiles(shop_name, slug)')
    .in('id', [...flags.keys()])
    .order('created_at', { ascending: false });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  return NextResponse.json({
    orders: (orders ?? []).map(({ profiles, slip_check, ...o }) => {
      const shop = (Array.isArray(profiles) ? profiles[0] : profiles) as { shop_name: string; slug: string } | null;
      const check = slip_check as SlipCheck | null;
      const flag = flags.get(o.id)!;
      return {
        ...o,
        shop_name: shop?.shop_name ?? null,
        verdict: check?.verdict ?? null,
        problems: (check?.checks ?? []).filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => c.detail ?? c.label),
        ref: check?.qr?.ref ?? check?.extracted?.ref ?? null,
        dup_file: flag.dup_file,
        dup_ref: flag.dup_ref,
      };
    }),
  });
}
