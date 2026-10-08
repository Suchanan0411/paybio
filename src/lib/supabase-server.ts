import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

// Client ฝั่ง Server ที่อ่าน/เขียน session ของผู้ใช้ผ่าน cookie (ใช้ใน Route Handler)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // จัดการกรณีที่ถูกเรียกจาก Server Component
          }
        },
      },
    }
  );
}

// ดึงผู้ใช้ที่ล็อกอินอยู่จาก cookie (null ถ้ายังไม่ล็อกอิน)
export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// ดึงร้านค้าของผู้ใช้ (null ถ้ายังไม่ได้ลงทะเบียนร้าน)
export async function getShopByUserId(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

// หน้าที่ควรไปต่อหลังเข้าสู่ระบบ: ยังไม่มีร้าน → ลงทะเบียนร้าน, มีแล้ว → จัดการร้าน
export async function postAuthPath(userId: string) {
  return (await getShopByUserId(userId)) ? '/manage' : '/register';
}
