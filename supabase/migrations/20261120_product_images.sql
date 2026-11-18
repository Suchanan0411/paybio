-- รูปสินค้าบนหน้าร้าน (เก็บใน bucket สาธารณะ shop-assets โฟลเดอร์ products/<shop id>/)
alter table public.products add column if not exists image_url text;

-- รูปสินค้าเก็บเป็น WebP (เล็กกว่า PNG มากสำหรับรูปถ่าย) — เพิ่มชนิดไฟล์ที่ bucket รับ
update storage.buckets
set allowed_mime_types = array['image/png', 'image/webp']
where id = 'shop-assets';
