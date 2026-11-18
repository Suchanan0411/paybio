-- ติดตามการจัดส่งสำหรับลูกค้า: ขั้นตอนหลังชำระเงิน เลขพัสดุ ข้อความจากร้าน อีเมลลูกค้า และประวัติสถานะ
alter table public.orders
  add column if not exists fulfillment text check (fulfillment in ('preparing', 'shipped', 'delivered')),
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists shop_message text,
  add column if not exists customer_email text,
  add column if not exists status_updated_at timestamptz;

-- ค้นหาออเดอร์ด้วยเลขออเดอร์ (หน้า "ค้นหาคำสั่งซื้อ")
create index if not exists orders_order_number_idx on public.orders (order_number);

-- ประวัติที่ลูกค้าเห็นบนหน้าติดตาม (ไทม์ไลน์)
create table if not exists public.order_events (
  id bigserial primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null, -- created | status | fulfillment | tracking | message
  label text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

-- เข้าถึงผ่าน service role เท่านั้น (ไม่มี policy ให้ anon / authenticated)
alter table public.order_events enable row level security;
