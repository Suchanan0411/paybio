# PayBio

หน้าร้านแบบ link-in-bio สำหรับร้านค้าออนไลน์รายย่อย ลูกค้าเลือกสินค้า สแกน QR พร้อมเพย์ที่คำนวณยอดให้อัตโนมัติ แล้วแนบสลิป ระบบตรวจสลิปให้ และร้านค้าอนุมัติออเดอร์ได้จากแผงควบคุม พร้อมรับแจ้งเตือนทาง LINE

รายละเอียดสถาปัตยกรรม ฐานข้อมูล ขั้นตอนการสั่งซื้อ และมาตรการความปลอดภัย อยู่ที่ [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## ความสามารถหลัก

- **หน้าร้าน** `/[slug]` — สินค้าพร้อมรูป QR พร้อมเพย์ตามยอด แนบสลิป และธีมหน้าร้าน
- **ติดตามออเดอร์** `/order/[token]` — ลูกค้าดูสถานะ การจัดส่ง และเลขพัสดุ ค้นหาออเดอร์ย้อนหลังได้ที่ `/order`
- **ตรวจสลิป** — ตรวจสลิปซ้ำ (SHA-256 และเลขอ้างอิง) อ่าน QR บนสลิป และตรวจกับธนาคารผ่าน SlipOK (ถ้าตั้งค่า)
- **จัดการร้าน** `/manage` — สินค้า ออเดอร์ อนุมัติ/ปฏิเสธ ส่งออก CSV แจ้งเตือน LINE, Webhook และโดเมนของร้าน
- **แพ็กเกจ** Free / Pro / Business — ชำระผ่านพร้อมเพย์ที่ `/upgrade` (ดู `src/lib/plans.ts`)
- **ผู้ดูแลระบบ** `/admin` — ร้านค้า รายงาน สลิปน่าสงสัย ค่าแพ็กเกจ และประวัติการทำงานของแอดมิน

## เทคโนโลยี

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage) · LINE Login / Messaging API · SlipOK · Resend

> Next.js 16 มีการเปลี่ยนแปลงจากเวอร์ชันก่อนหน้า ก่อนแก้โค้ดให้อ่านคู่มือใน `node_modules/next/dist/docs/` (ดู [AGENTS.md](AGENTS.md))

## เริ่มต้นใช้งาน

ต้องมี Node.js 20 ขึ้นไป และโปรเจกต์ Supabase

```bash
npm install
```

สร้างไฟล์ `.env.local` แล้วใส่ค่าตามตารางด้านล่าง

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | เชื่อม Supabase ฝั่งเบราว์เซอร์ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | เชื่อม Supabase ฝั่งเซิร์ฟเวอร์ (ห้ามเปิดเผย) |
| `SUPABASE_DB_URL` | ✓ | รัน migration |
| `NEXT_PUBLIC_APP_URL` | ตอน deploy | ที่อยู่เว็บจริง ใช้สร้างลิงก์ในอีเมลและ LINE (ว่าง = `http://localhost:3000`) |
| `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET` | | LINE Login |
| `LINE_MESSAGING_CHANNEL_SECRET`, `LINE_MESSAGING_ACCESS_TOKEN` | | LINE OA แจ้งเตือนออเดอร์ |
| `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID` | | ตรวจสลิปกับข้อมูลธนาคาร |
| `SLIPOK_PLANS` | | จำกัดแพ็กเกจที่ใช้ SlipOK เช่น `pro,business` (ว่าง = ทุกแพ็กเกจ) |
| `ANTHROPIC_API_KEY` | | AI อ่านยอดเงินจากรูปสลิป |
| `RESEND_API_KEY`, `EMAIL_FROM` | | อีเมลแจ้งลูกค้า |
| `PAYBIO_PROMPTPAY` | | พร้อมเพย์ที่ PayBio ใช้รับค่าแพ็กเกจ (ว่าง = ปิดรับชำระ) |

### ฐานข้อมูล

รันไฟล์ใน `supabase/migrations/` ตามลำดับวันที่ในชื่อไฟล์ (ส่งหลายไฟล์ในคำสั่งเดียวได้)

```bash
node --env-file=.env.local scripts/migrate.mjs supabase/migrations/<ไฟล์>.sql
```

สร้างบัญชีทดสอบ (แอดมิน 1 บัญชี และเจ้าของร้านพร้อมสินค้าตัวอย่าง 1 บัญชี) รันซ้ำได้ ระบบจะตั้งรหัสผ่านใหม่ให้

```bash
node --env-file=.env.local scripts/seed-test-accounts.mjs
```

### รันเซิร์ฟเวอร์

```bash
npm run dev     # http://localhost:3000
npm run build   # build สำหรับ production
npm run start
npm run lint
```

## โครงสร้างโปรเจกต์

```
src/
  app/            หน้าเว็บ (App Router) และ API ใน app/api
  components/     คอมโพเนนต์ที่ใช้ร่วมกัน
  lib/            แพ็กเกจ ตรวจสลิป แจ้งเตือน Supabase client
  types/          type ที่ใช้ร่วมกัน
  proxy.ts        รองรับโดเมนของร้าน
supabase/migrations/   SQL migration
scripts/               migration และสร้างบัญชีทดสอบ
docs/ARCHITECTURE.md   เอกสารออกแบบระบบ
```

## Deploy

1. ใส่ตัวแปรทั้งหมดบนโฮสต์ (เช่น Vercel) และตั้ง `NEXT_PUBLIC_APP_URL` เป็นโดเมนจริง
2. เพิ่มโดเมนจริงใน Redirect URL ของ Supabase Auth, Google และ LINE Login
3. ตั้ง Webhook URL ของ LINE OA เป็น `https://<โดเมน>/api/line/webhook`

ข้อจำกัดที่ทราบอยู่ในหัวข้อ 8 ของ [ARCHITECTURE.md](docs/ARCHITECTURE.md)
