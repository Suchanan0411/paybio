-- แพ็กเกจร้านค้า + โดเมนของตนเอง + ผลตรวจสลิป
-- (รวมคอลัมน์ระงับร้านไว้ด้วย รันไฟล์นี้ไฟล์เดียวได้เลย)
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists plan text not null default 'free',
  add column if not exists custom_domain text;

do $$ begin
  alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'pro', 'business'));
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_custom_domain_key on public.profiles (lower(custom_domain));

alter table public.orders
  add column if not exists slip_hash text,
  add column if not exists slip_check jsonb;

create index if not exists orders_slip_hash_idx on public.orders (slip_hash);
create index if not exists orders_slip_ref_idx on public.orders ((slip_check -> 'extracted' ->> 'ref'));

notify pgrst, 'reload schema';
