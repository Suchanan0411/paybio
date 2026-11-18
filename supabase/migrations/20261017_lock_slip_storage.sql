-- ปิด policy "Allow all" บน bucket สลิป: เดิม anon key (ซึ่งอยู่ในเบราว์เซอร์ทุกคน) ดูรายการ/ดาวน์โหลด/อัปโหลด/เขียนทับสลิปได้
-- แอปเข้าถึงสลิปผ่าน service role ฝั่งเซิร์ฟเวอร์เท่านั้น (src/app/api/orders, src/lib/slip-*.ts) จึงไม่ต้องมี policy ให้ anon/authenticated
drop policy if exists "Allow all 5nqbos_0" on storage.objects;
drop policy if exists "Allow all 5nqbos_1" on storage.objects;
drop policy if exists "Allow all 5nqbos_2" on storage.objects;
