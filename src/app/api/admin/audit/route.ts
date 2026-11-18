import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin';

// ประวัติการทำงานของแอดมิน 200 รายการล่าสุด
export async function GET() {
  const { denied } = await requireAdmin();
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('admin_audit_log')
    .select('*, profiles(shop_name, slug)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    entries: (data ?? []).map(({ profiles, ...e }) => {
      const shop = (Array.isArray(profiles) ? profiles[0] : profiles) as { shop_name: string; slug: string } | null;
      return { ...e, shop_name: shop?.shop_name ?? null };
    }),
  });
}
