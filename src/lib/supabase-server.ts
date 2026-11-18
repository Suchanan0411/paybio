import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
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

// ชื่อ/รูปที่แสดงของบัญชี: ค่าที่ผู้ใช้แก้เอง (display_name, custom_avatar_url) มาก่อน
// แยก key จาก full_name / avatar_url เพราะ Google/LINE เขียนทับ 2 ค่านั้นทุกครั้งที่ล็อกอิน
type Meta = Record<string, unknown> | undefined;
const metaStr = (m: Meta, k: string) => (typeof m?.[k] === 'string' && (m[k] as string).trim() ? (m[k] as string) : null);

export function accountName(user: Pick<User, 'user_metadata'>) {
  const m = user.user_metadata as Meta;
  return metaStr(m, 'display_name') ?? metaStr(m, 'full_name') ?? metaStr(m, 'name');
}

export function accountAvatar(user: Pick<User, 'user_metadata'>) {
  const m = user.user_metadata as Meta;
  return metaStr(m, 'custom_avatar_url') ?? metaStr(m, 'avatar_url');
}

// ผู้ดูแลระบบ: กำหนดผ่าน app_metadata.role ซึ่งแก้ได้เฉพาะ service role (ผู้ใช้ตั้งเองไม่ได้)
export function isAdmin(user: User | null | undefined) {
  return user?.app_metadata?.role === 'admin';
}

// หน้าที่ควรไปต่อหลังเข้าสู่ระบบ: admin → แผงผู้ดูแล, ยังไม่มีร้าน → ลงทะเบียนร้าน, มีแล้ว → จัดการร้าน
export async function postAuthPath(user: User) {
  if (isAdmin(user)) return '/admin';
  return (await getShopByUserId(user.id)) ? '/manage' : '/register';
}
