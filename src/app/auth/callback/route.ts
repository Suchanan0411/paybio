import { NextResponse } from 'next/server';
import { createSupabaseServerClient, postAuthPath } from '@/lib/supabase-server';

// ปลายทางหลังเข้าสู่ระบบด้วย Google หรือกดยืนยันอีเมล
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // ยอมรับเฉพาะ path ภายในเว็บ เพื่อป้องกัน open redirect
      const target = next?.startsWith('/') && !next.startsWith('//') ? next : await postAuthPath(data.user.id);
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  const reason = searchParams.get('error_description') ?? 'ไม่สามารถยืนยันตัวตนได้ กรุณาลองใหม่อีกครั้ง';
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
}
