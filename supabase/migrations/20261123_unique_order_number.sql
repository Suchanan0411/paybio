-- เลขออเดอร์ต้องไม่ซ้ำทั้งระบบ (เดิมสร้างจากเวลา วนซ้ำทุก ~17 นาที)
-- ถ้ามีเลขซ้ำอยู่แล้ว เติมท้ายด้วยลำดับให้ไม่ชนก่อนสร้าง unique index
with dup as (
  select id, row_number() over (partition by order_number order by created_at, id) as n
  from public.orders
)
update public.orders o
set order_number = o.order_number || '-' || dup.n
from dup
where o.id = dup.id and dup.n > 1;

drop index if exists public.orders_order_number_idx;
create unique index if not exists orders_order_number_uidx on public.orders (order_number);
