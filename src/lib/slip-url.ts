import { supabaseAdmin } from '@/lib/supabase';
import { slipPath } from '@/lib/slip-storage';

// ลิงก์ชั่วคราวสำหรับเปิดรูปสลิป (Bucket payment-slips เป็น private)
export async function signedSlipUrl(url: string | null | undefined, expiresIn: number) {
  const path = slipPath(url);
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from('payment-slips').createSignedUrl(path, expiresIn);
  if (error) console.error('[slip-url] sign failed', error.message);
  return data?.signedUrl ?? null;
}
