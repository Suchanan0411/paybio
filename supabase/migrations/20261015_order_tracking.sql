-- ลิงก์ติดตามสถานะออเดอร์สำหรับลูกค้า (เดาไม่ได้ ต่างจากเลขออเดอร์ PB-xxxxxx)
alter table public.orders
  add column if not exists track_token uuid not null default gen_random_uuid();

create unique index if not exists orders_track_token_key on public.orders (track_token);

notify pgrst, 'reload schema';
