import { NextResponse, type NextRequest } from 'next/server';
import { SOCIAL_PROVIDERS, STATE_COOKIE, callbackUrl } from '@/lib/social-oauth';

// เริ่ม OAuth: พาผู้ใช้ไปหน้าอนุญาตของ LINE
export async function GET(req: NextRequest, ctx: RouteContext<'/auth/social/[provider]'>) {
  const { provider } = await ctx.params;
  const { origin } = new URL(req.url);
  const config = SOCIAL_PROVIDERS[provider];

  if (!config) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('ไม่รองรับผู้ให้บริการนี้')}`);
  }
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(`ยังไม่ได้ตั้งค่าการเชื่อมต่อ ${config.label} บนเซิร์ฟเวอร์`)}`
    );
  }

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(
    config.authorizeUrl({ clientId: config.clientId, redirectUri: callbackUrl(origin, provider), state })
  );
  res.cookies.set(STATE_COOKIE, `${provider}:${state}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https'),
    path: '/',
    maxAge: 600,
  });
  return res;
}
