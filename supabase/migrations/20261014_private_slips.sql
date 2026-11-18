-- รูปสลิปมีชื่อและเลขบัญชี: ปิดการเข้าถึงแบบลิงก์สาธารณะ
-- (แอปเปิดผ่าน /api/orders/slip ซึ่งตรวจสิทธิ์แล้วส่งต่อไปยังลิงก์ชั่วคราว)
update storage.buckets set public = false where id = 'payment-slips';
