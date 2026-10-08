import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client ฝั่ง Frontend (เบราว์เซอร์) — เก็บ session ไว้ใน cookie เพื่อให้ฝั่ง Server อ่าน session เดียวกันได้
export const supabase: SupabaseClient =
  typeof window !== 'undefined'
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

// Client ฝั่ง Server (สร้างเฉพาะเมื่อทำงานบน Server เพื่อป้องกัน Error บนเบราว์เซอร์)
export const supabaseAdmin: SupabaseClient =
  typeof window === 'undefined'
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : (null as unknown as SupabaseClient);
