// สร้างบัญชีทดสอบ: ผู้ดูแลระบบ 1 บัญชี และเจ้าของร้าน 1 บัญชี (พร้อมร้านและสินค้าตัวอย่าง)
// รัน: node --env-file=.env.local scripts/seed-test-accounts.mjs
// รันซ้ำได้ — จะตั้งรหัสผ่านใหม่ให้บัญชีเดิม ไม่สร้างซ้ำ
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('ไม่พบ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const password = () => 'PayBio-' + randomBytes(6).toString('base64url');

async function upsertUser({ email, password, name, role }) {
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  const attrs = {
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: role ? { role } : {},
  };

  const { data, error } = existing
    ? await supabase.auth.admin.updateUserById(existing.id, attrs)
    : await supabase.auth.admin.createUser({ email, ...attrs });
  if (error) throw error;
  return data.user;
}

async function upsertShop(userId) {
  const shop = {
    user_id: userId,
    shop_name: 'ร้านทดสอบ PayBio',
    slug: 'paybio-test-shop',
    promptpay_number: '0812345678',
    bio: 'ร้านค้าสำหรับทดสอบระบบ PayBio',
  };

  const { data: existing } = await supabase.from('profiles').select('id').eq('slug', shop.slug).maybeSingle();
  const { data, error } = existing
    ? await supabase.from('profiles').update(shop).eq('id', existing.id).select().single()
    : await supabase.from('profiles').insert(shop).select().single();
  if (error) throw error;

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', data.id);
  if (!count) {
    const { error: productError } = await supabase.from('products').insert([
      { profile_id: data.id, name: 'เสื้อยืด PayBio', price: 290 },
      { profile_id: data.id, name: 'แก้วน้ำเก็บความเย็น', price: 350 },
      { profile_id: data.id, name: 'สติกเกอร์ชุดเล็ก', price: 59 },
    ]);
    if (productError) throw productError;
  }
  return data;
}

const accounts = [
  { email: 'admin@paybio.local', password: password(), name: 'ผู้ดูแลระบบ PayBio', role: 'admin' },
  { email: 'shop@paybio.local', password: password(), name: 'เจ้าของร้านทดสอบ' },
];

await upsertUser(accounts[0]);
const owner = await upsertUser(accounts[1]);
const shop = await upsertShop(owner.id);

console.log('\nสร้างบัญชีทดสอบเรียบร้อย (เข้าสู่ระบบด้วยอีเมลที่ /login)\n');
console.log(`ผู้ดูแลระบบ   ${accounts[0].email}   รหัสผ่าน: ${accounts[0].password}   → /admin`);
console.log(`เจ้าของร้าน   ${accounts[1].email}   รหัสผ่าน: ${accounts[1].password}   → /manage`);
console.log(`หน้าร้าน      /${shop.slug}\n`);
