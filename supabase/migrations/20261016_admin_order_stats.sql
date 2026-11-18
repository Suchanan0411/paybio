-- สรุปออเดอร์ต่อร้านสำหรับหน้าแอดมิน (นับครบทุกออเดอร์ ไม่จำกัด 1,000 แถว) — profile_id null = ร้านตัวอย่างเดิม
create or replace function public.admin_order_stats()
returns table (profile_id uuid, order_count bigint, pending_count bigint, paid_total numeric)
language sql
stable
as $$
  select
    profile_id,
    count(*),
    count(*) filter (where status = 'pending'),
    coalesce(sum(amount) filter (where status = 'paid'), 0)
  from public.orders
  group by profile_id;
$$;

revoke execute on function public.admin_order_stats() from public, anon, authenticated;

notify pgrst, 'reload schema';
