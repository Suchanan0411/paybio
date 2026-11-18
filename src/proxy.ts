import { NextResponse, type NextRequest } from 'next/server';
import { isAppHost } from '@/lib/app-hosts';
import { planOf } from '@/lib/plans';

// โดเมนของตนเอง (Business Studio): shop.example.com/ → แสดงหน้าร้าน /<slug>
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (!host || isAppHost(host)) return NextResponse.next();

  const domain = host.toLowerCase().replace(/:\d+$/, '');
  const url = new URL('/rest/v1/profiles', process.env.NEXT_PUBLIC_SUPABASE_URL);
  url.searchParams.set('select', 'slug,plan,plan_expires_at');
  url.searchParams.set('custom_domain', `eq.${domain}`);
  url.searchParams.set('limit', '1');

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const [shop] = res.ok ? ((await res.json()) as { slug: string; plan: string; plan_expires_at: string | null }[]) : [];

  if (!shop || planOf(shop) !== 'business') {
    return new NextResponse('ไม่พบร้านค้าสำหรับโดเมนนี้', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.rewrite(new URL(`/${encodeURIComponent(shop.slug)}`, request.url));
}

// ทำงานเฉพาะหน้าแรกของโดเมน (หน้าอื่น/API/ไฟล์ static ผ่านตามปกติ)
export const config = {
  matcher: '/',
};
