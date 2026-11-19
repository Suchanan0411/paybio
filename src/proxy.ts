import { NextResponse, type NextRequest } from 'next/server';
import { isAppHost } from '@/lib/app-hosts';
import { planOf } from '@/lib/plans';

// โดเมนของตนเอง (Business Studio): shop.example.com/ → แสดงหน้าร้าน /<slug>
export async function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (!host || isAppHost(host)) {
    // ลิงก์ในอีเมลใช้ไม่ได้ (หมดอายุ/ใช้ไปแล้ว): Supabase ส่งกลับมาที่ Site URL พร้อม ?error=...
    // พาไปหน้าเข้าสู่ระบบพร้อมข้อความภาษาไทย แทนที่จะค้างที่หน้าแรกเฉยๆ
    const params = request.nextUrl.searchParams;
    const code = params.get('error_code');
    if (code || params.get('error_description')) {
      const message =
        code === 'otp_expired'
          ? 'ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว (ถ้าขอลิงก์หลายครั้ง ให้ใช้ลิงก์จากอีเมลฉบับล่าสุด) กรุณาขอลิงก์ใหม่'
          : `ยืนยันตัวตนไม่สำเร็จ: ${params.get('error_description') ?? code}`;
      const login = new URL('/login', request.url);
      login.searchParams.set('error', message);
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

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
