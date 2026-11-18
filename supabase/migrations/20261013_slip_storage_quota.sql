-- โควตาพื้นที่เก็บรูปสลิปตามแพ็กเกจ: เก็บขนาดไฟล์ไว้ในออเดอร์ และฟังก์ชันรวมพื้นที่ที่ร้านใช้อยู่
alter table public.orders
  add column if not exists slip_size bigint;

-- เติมขนาดไฟล์ให้ออเดอร์เก่าจากข้อมูลใน Storage
update public.orders o
set slip_size = (s.metadata ->> 'size')::bigint
from storage.objects s
where o.slip_size is null
  and o.slip_url is not null
  and s.bucket_id = 'payment-slips'
  and o.slip_url like '%/payment-slips/' || s.name;

create index if not exists orders_profile_slip_idx on public.orders (profile_id, created_at) where slip_url is not null;

create or replace function public.shop_slip_usage(p_profile_id uuid)
returns bigint
language sql
stable
as $$
  select coalesce(sum(slip_size), 0)::bigint
  from public.orders
  where profile_id = p_profile_id and slip_url is not null;
$$;

revoke execute on function public.shop_slip_usage(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';
