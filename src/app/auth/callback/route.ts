import { NextResponse } from 'next/server';
import { createSupabaseServerClient, postAuthPath } from '@/lib/supabase-server';

// ปลายทางหลังเข้าสู่ระบบด้วย Google หรือกดยืนยันอีเมล
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  // code = OAuth / PKCE, token_hash = ลิงก์ในอีเมล (magic link, รีเซ็ตรหัสผ่าน) ที่ใช้ได้ครั้งเดียว
  if (code || (tokenHash && (type === 'magiclink' || type === 'recovery' || type === 'email'))) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as 'magiclink' | 'recovery' | 'email' });
    if (!error && data.user) {
      // ยอมรับเฉพาะ path ภายในเว็บ เพื่อป้องกัน open redirect
      const target = next?.startsWith('/') && !next.startsWith('//') ? next : await postAuthPath(data.user);
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  const reason = searchParams.get('error_description') ?? 'ไม่สามารถยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง';
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
