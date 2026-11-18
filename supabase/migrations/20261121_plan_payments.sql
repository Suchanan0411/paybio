-- ร้านจ่ายค่าแพ็กเกจ Pro / Business ผ่านพร้อมเพย์ของ PayBio แล้วแนบสลิป
-- ระบบตรวจสลิปกับธนาคาร (SlipOK) ผ่าน = เปิดแพ็กเกจทันที, ตรวจไม่ได้ = รอแอดมินอนุมัติ
create table if not exists public.plan_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.profiles (id) on delete cascade,
  plan text not null check (plan in ('pro', 'business')),
  billing text not null check (billing in ('monthly', 'yearly')),
  amount numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  slip_path text,            -- ไฟล์ใน bucket payment-slips (private)
  slip_hash text,            -- SHA-256 กันส่งไฟล์เดิมซ้ำ
  bank_ref text,             -- เลขอ้างอิงจากธนาคาร กันใช้สลิปเดิมซ้ำ
  bank jsonb,                -- ข้อมูลจาก SlipOK (ยอด วันที่ ผู้รับ)
  note text,                 -- เหตุผลที่ตรวจไม่ผ่าน / รอตรวจ
  period_start timestamptz,  -- ช่วงสิทธิ์ที่ได้ (เมื่อ paid)
  period_end timestamptz,
  reviewed_by text,          -- 'auto' หรืออีเมลแอดมิน
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists plan_payments_shop_idx on public.plan_payments (shop_id, created_at desc);
create index if not exists plan_payments_status_idx on public.plan_payments (status, created_at desc);
-- สลิปหนึ่งใบ (เลขอ้างอิงธนาคาร) ใช้จ่ายได้ครั้งเดียว ยกเว้นรายการที่ถูกปฏิเสธ
create unique index if not exists plan_payments_bank_ref_uidx
  on public.plan_payments (bank_ref) where bank_ref is not null and status <> 'rejected';

-- เข้าถึงผ่าน service role เท่านั้น
alter table public.plan_payments enable row level security;
