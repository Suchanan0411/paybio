-- รูป QR พร้อมเพย์ที่ร้านอัปโหลดเอง (เช่น QR ร้านค้าจากแอปธนาคาร) แสดงบนหน้าร้านให้ลูกค้าสแกน
alter table public.profiles add column if not exists promptpay_qr_url text;

-- bucket สาธารณะสำหรับไฟล์ที่ตั้งใจแสดงบนหน้าร้าน (อัปโหลด/ลบผ่าน service role เท่านั้น ไม่มี policy ให้ anon เขียน)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 2097152, array['image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
