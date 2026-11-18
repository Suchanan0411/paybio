-- ให้ผู้ดูแลระบบระงับร้านค้าได้
-- suspended_at เป็น null = ร้านเปิดตามปกติ, มีค่า = ถูกระงับตั้งแต่เวลานั้น
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text;
