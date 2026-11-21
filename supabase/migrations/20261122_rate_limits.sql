-- จำกัดจำนวนครั้งต่อช่วงเวลา (ใช้ร่วมกันทุกเซิร์ฟเวอร์ แทนตัวนับในหน่วยความจำ)
-- key เป็น SHA-256 ของ "ชื่อการกระทำ + IP" ไม่เก็บ IP จริง
create table if not exists public.rate_limits (
  key text primary key,
  hits int not null,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;

-- นับครั้งแบบ atomic คืน true เมื่อเกินจำนวนที่กำหนดในช่วงเวลานั้น
create or replace function public.rate_limit_hit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (key, hits, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    hits = case when r.reset_at <= now() then 1 else r.hits + 1 end,
    reset_at = case when r.reset_at <= now() then excluded.reset_at else r.reset_at end
  returning hits into v_hits;

  -- ล้างแถวที่หมดอายุเป็นครั้งคราว ไม่ให้ตารางโตเรื่อยๆ
  if random() < 0.01 then
    delete from public.rate_limits where reset_at < now() - interval '1 hour';
  end if;

  return v_hits > p_max;
end;
$$;

-- เรียกได้เฉพาะ service role
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
