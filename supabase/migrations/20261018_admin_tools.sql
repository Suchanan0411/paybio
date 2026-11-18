-- เครื่องมือผู้ดูแลระบบ: สิทธิ์แพ็กเกจแบบมีวันหมดอายุ, ประวัติการทำงานของแอดมิน, รายงาน, สลิปน่าสงสัย

-- แพ็กเกจที่แอดมินให้แบบมีกำหนด (null = ไม่หมดอายุ) — หมดอายุแล้วระบบถือว่าเป็น Free (src/lib/plans.ts)
alter table public.profiles
  add column if not exists plan_expires_at timestamptz,
  add column if not exists plan_note text;

-- ประวัติการทำงานของแอดมิน (ระงับร้าน, เปลี่ยนแพ็กเกจ ฯลฯ)
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id uuid,
  admin_email text,
  action text not null,
  shop_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb
);
alter table public.admin_audit_log enable row level security;
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_shop_idx on public.admin_audit_log (shop_id, created_at desc);

-- สถิติรายวันตามเวลาไทย p_days วันล่าสุด (รวมวันนี้)
create or replace function public.admin_daily_stats(p_days int)
returns table (day date, orders bigint, paid_orders bigint, paid_amount numeric, new_shops bigint)
language sql
stable
as $$
  with days as (
    select generate_series(
      (now() at time zone 'Asia/Bangkok')::date - (p_days - 1),
      (now() at time zone 'Asia/Bangkok')::date,
      interval '1 day'
    )::date as day
  ),
  o as (
    select (created_at at time zone 'Asia/Bangkok')::date as day,
      count(*) as orders,
      count(*) filter (where status = 'paid') as paid_orders,
      coalesce(sum(amount) filter (where status = 'paid'), 0) as paid_amount
    from public.orders
    where created_at >= now() - make_interval(days => p_days + 1)
    group by 1
  ),
  s as (
    select (created_at at time zone 'Asia/Bangkok')::date as day, count(*) as new_shops
    from public.profiles
    where created_at >= now() - make_interval(days => p_days + 1)
    group by 1
  )
  select d.day, coalesce(o.orders, 0), coalesce(o.paid_orders, 0), coalesce(o.paid_amount, 0), coalesce(s.new_shops, 0)
  from days d
  left join o using (day)
  left join s using (day)
  order by d.day;
$$;

-- ออเดอร์ที่สลิปน่าสงสัย: ผลตรวจไม่ผ่าน/ควรตรวจซ้ำ, ไฟล์สลิปซ้ำ หรือเลขอ้างอิงซ้ำกับออเดอร์อื่น (ทั้งระบบ ข้ามร้าน)
create or replace function public.admin_suspicious_orders(p_limit int default 200)
returns table (id uuid, dup_file boolean, dup_ref boolean)
language sql
stable
as $$
  with refs as (
    select o.id, o.slip_hash,
      coalesce(o.slip_check -> 'qr' ->> 'ref', o.slip_check -> 'extracted' ->> 'ref') as ref,
      o.slip_check ->> 'verdict' as verdict,
      o.created_at
    from public.orders o
  ),
  flagged as (
    select r.id, r.created_at,
      (r.slip_hash is not null and exists (select 1 from refs x where x.slip_hash = r.slip_hash and x.id <> r.id)) as dup_file,
      (r.ref is not null and exists (select 1 from refs x where x.ref = r.ref and x.id <> r.id)) as dup_ref,
      r.verdict
    from refs r
  )
  select f.id, f.dup_file, f.dup_ref
  from flagged f
  where f.dup_file or f.dup_ref or f.verdict in ('fail', 'warn')
  order by f.created_at desc
  limit p_limit;
$$;

revoke execute on function public.admin_daily_stats(int) from public, anon, authenticated;
revoke execute on function public.admin_suspicious_orders(int) from public, anon, authenticated;

notify pgrst, 'reload schema';
