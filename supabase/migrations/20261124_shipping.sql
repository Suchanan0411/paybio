-- ค่าจัดส่งที่ร้านตั้งเอง + ที่อยู่จัดส่งของลูกค้า + ข้อมูลผู้ส่งสำหรับพิมพ์ใบจ่าหน้า
-- profiles.shipping = null คือร้านไม่คิดค่าส่ง (ทำงานแบบเดิม)
-- รูปแบบ: { methods: [{ id, name, fee, pickup }], extra_per_item, free_over,
--          sender_name, sender_phone, sender_address }
alter table public.profiles
  add column if not exists shipping jsonb;

-- ยอดในออเดอร์: amount = subtotal + shipping_fee (ยอดที่ลูกค้าโอนจริง)
alter table public.orders
  add column if not exists subtotal numeric(12, 2),
  add column if not exists shipping_fee numeric(12, 2) not null default 0,
  add column if not exists shipping_method text,     -- ชื่อวิธีจัดส่งตอนสั่ง เช่น "EMS"
  add column if not exists shipping_pickup boolean not null default false,
  add column if not exists ship_phone text,
  add column if not exists ship_address text,
  add column if not exists ship_postcode text;

-- ออเดอร์เดิม: ยอดสินค้า = ยอดรวม (ยังไม่มีค่าส่ง)
update public.orders set subtotal = amount where subtotal is null;
