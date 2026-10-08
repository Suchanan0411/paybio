import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient, postAuthPath } from '@/lib/supabase-server';
import { SOCIAL_PROVIDERS, STATE_COOKIE, accountEmail, callbackUrl } from '@/lib/social-oauth';

// รับ code จาก LINE แล้วสร้าง session ของ Supabase ให้ผู้ใช้
export async function GET(req: NextRequest, ctx: RouteContext<'/auth/social/[provider]/callback'>) {
  const { provider } = await ctx.params;
  const { origin, searchParams } = new URL(req.url);
  const fail = (msg: string) => {
    const res = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  const config = SOCIAL_PROVIDERS[provider];
  if (!config?.clientId || !config.clientSecret) return fail('ไม่รองรับผู้ให้บริการนี้');

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code) return fail(`ยกเลิกการเชื่อมต่อ ${config.label}`);
  if (!state || req.cookies.get(STATE_COOKIE)?.value !== `${provider}:${state}`) {
    return fail('การยืนยันตัวตนหมดอายุ กรุณาลองใหม่อีกครั้ง');
  }

  try {
    const profile = await config.fetchProfile({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: callbackUrl(origin, provider),
    });
    const email = accountEmail(provider, profile);

    // สร้างบัญชีครั้งแรก (ถ้ามีบัญชีอีเมลนี้อยู่แล้วจะข้ามไป)
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: profile.name,
        avatar_url: profile.avatar,
        provider,
        provider_id: profile.id,
      },
    });
    if (createError && createError.code !== 'email_exists') throw createError;

    // ออก magic link ฝั่ง Server แล้วยืนยันทันที เพื่อให้ได้ session ใน cookie
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkError) throw linkError;

    const supabase = await createSupabaseServerClient();
    const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (verifyError || !session.user) throw verifyError ?? new Error('เข้าสู่ระบบไม่สำเร็จ');

    const target = await postAuthPath(session.user.id);
    console.info(`[social-callback:${provider}] signed in user ${session.user.id} -> ${target}`);
    const res = NextResponse.redirect(`${origin}${target}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error(`[social-callback:${provider}] failed:`, err);
    return fail(err instanceof Error ? err.message : `เชื่อมต่อ ${config.label} ไม่สำเร็จ`);
  }
}
