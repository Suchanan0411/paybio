import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, isAdmin } from '@/lib/supabase-server';

// ตรวจสิทธิ์ผู้ดูแล: { user } เมื่อผ่าน, { denied } เป็น Response เมื่อไม่ผ่าน
export async function requireAdmin(): Promise<{ user: User; denied?: undefined } | { user?: undefined; denied: Response }> {
  const user = await getCurrentUser();
  if (!user) return { denied: NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 }) };
  if (!isAdmin(user)) return { denied: NextResponse.json({ error: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ' }, { status: 403 }) };
  return { user };
}

export type AdminAction = 'shop.suspend' | 'shop.unsuspend' | 'shop.plan';

// บันทึกประวัติการทำงานของแอดมิน (ไม่ throw: การกระทำหลักสำเร็จไปแล้ว)
export async function logAdminAction(user: User, action: AdminAction, shopId: string | null, details: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from('admin_audit_log')
    .insert({ admin_id: user.id, admin_email: user.email ?? null, action, shop_id: shopId, details });
  if (error) console.error('[admin] audit log failed', error.message);
}

// อีเมลของผู้ใช้ทั้งหมด (Supabase คืนครั้งละไม่เกิน 1,000 คน)
export async function listAllUsers() {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}
