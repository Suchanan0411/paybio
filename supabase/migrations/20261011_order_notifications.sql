-- แจ้งเตือนออเดอร์ผ่าน LINE OA (Pro ขึ้นไป) และ Webhook (Business)
alter table public.profiles
  add column if not exists line_user_id text,
  add column if not exists line_link_code text,
  add column if not exists line_link_expires_at timestamptz,
  add column if not exists order_webhook_url text,
  add column if not exists order_webhook_secret text;

create index if not exists profiles_line_link_code_idx on public.profiles (line_link_code);
create index if not exists profiles_line_user_id_idx on public.profiles (line_user_id);

notify pgrst, 'reload schema';
