import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { isAppHost } from '@/lib/app-hosts';

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// ตั้ง / ลบโดเมนของตนเอง (เฉพาะ Business Studio)
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  const shop = user ? await getShopByUserId(user.id) : null;
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }
  if (!PLAN_LIMITS[planOf(shop)].customDomain) {
    return NextResponse.json({ error: 'โดเมนของตนเองใช้ได้เฉพาะแพ็กเกจ Business Studio' }, { status: 403 });
  }

  const body = await req.json();
  const domain = String(body.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');

  if (domain && (!DOMAIN_RE.test(domain) || isAppHost(domain))) {
    return NextResponse.json({ error: 'รูปแบบโดเมนไม่ถูกต้อง เช่น shop.example.com' }, { status: 400 });
  }

  if (domain) {
    const { data: taken } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('custom_domain', domain)
      .neq('id', shop.id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json({ error: 'โดเมนนี้ถูกใช้กับร้านอื่นแล้ว' }, { status: 409 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ custom_domain: domain || null })
    .eq('id', shop.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ shop: data });
}
