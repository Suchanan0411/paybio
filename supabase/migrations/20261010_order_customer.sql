-- ข้อมูลผู้สั่งซื้อและจำนวนสินค้าในคำสั่งซื้อ
alter table public.orders
  add column if not exists product_id uuid references public.products (id) on delete set null,
  add column if not exists quantity integer not null default 1,
  add column if not exists customer_name text,
  add column if not exists customer_contact text,
  add column if not exists note text;

notify pgrst, 'reload schema';
