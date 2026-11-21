import Link from 'next/link';
import { SiteFooter } from '@/components/site-shell';
import { Store, QrCode, Receipt, ArrowRight, ShieldCheck, Smartphone, Link2 } from 'lucide-react';
import { GoogleIcon, LineIcon } from '@/components/onboarding';
import { Logo } from '@/components/logo';
import { Pricing } from '@/components/pricing';

const STEPS = [
  {
    Icon: Smartphone,
    title: 'สร้างบัญชี',
    text: 'สมัครด้วยอีเมล หรือเชื่อมต่อ Google หรือ LINE ได้ในคลิกเดียว',
  },
  {
    Icon: Store,
    title: 'ลงทะเบียนร้านค้า',
    text: 'ตั้งชื่อร้าน ลิงก์ร้าน และเบอร์พร้อมเพย์ที่ใช้รับเงิน',
  },
  {
    Icon: Receipt,
    title: 'จัดการร้านค้า',
    text: 'เพิ่มสินค้า ตรวจสลิป และอนุมัติคำสั่งซื้อจากหน้าเดียว',
  },
];

const FEATURES = [
  { Icon: Link2, title: 'ลิงก์เดียวใส่ Bio', text: 'หน้าร้าน paybio.me/ชื่อร้าน พร้อมแชร์ใน Instagram, TikTok, LINE' },
  { Icon: QrCode, title: 'QR พร้อมเพย์อัตโนมัติ', text: 'สร้าง QR ตามราคาสินค้า ลูกค้าสแกนจ่ายได้ทันที ไม่มีค่าธรรมเนียม' },
  { Icon: ShieldCheck, title: 'ตรวจสลิปง่าย', text: 'ลูกค้าแนบสลิป ร้านกดอนุมัติหรือปฏิเสธได้ในแผงควบคุม' },
];

export default function Home() {
  return (
    <div className="min-h-screen text-ink">
      <header className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" aria-label="PayBio หน้าแรก">
          <Logo size="sm" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm shrink-0">
          <Link href="/pricing" className="hidden sm:inline whitespace-nowrap px-3 py-1.5 text-slate-300 hover:text-ink transition">
            ราคา
          </Link>
          <Link href="/login" className="whitespace-nowrap px-2.5 sm:px-3 py-1.5 text-slate-300 hover:text-ink transition">
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/login?mode=signup"
            className="whitespace-nowrap text-white px-3 sm:px-3.5 py-1.5 btn-primary rounded-lg font-semibold transition"
          >
            สมัครฟรี
          </Link>
        </nav>
      </header>

      <main>
        <section className="max-w-3xl mx-auto px-4 pt-16 pb-20 text-center">
          <span className="inline-block text-xs font-medium text-brand-400 bg-brand-500/10 border border-brand-500/20 px-3 py-1 rounded-full">
            รับเงินผ่านพร้อมเพย์ ด้วยลิงก์เดียว
          </span>
          <h1 className="mt-5 text-[1.85rem] sm:text-5xl font-bold leading-tight text-balance">
            เปิดร้านออนไลน์ใน Bio
            <br />
            <span className="text-brand-400">รับเงินพร้อมเพย์ได้ทันที</span>
          </h1>
          <p className="mt-5 text-slate-400 text-base sm:text-lg">
            สร้างหน้าร้าน แสดง QR พร้อมเพย์ตามราคาสินค้า และตรวจสลิปลูกค้าได้ในที่เดียว ไม่ต้องมีเว็บไซต์
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="text-white inline-flex items-center justify-center gap-2 px-6 py-3 btn-primary rounded-xl font-semibold shadow-lg shadow-brand-500/20 transition"
            >
              เริ่มต้นสร้างร้านค้า <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center px-6 py-3 glass hover:bg-slate-800 rounded-xl font-medium text-slate-300 transition"
            >
              ดูร้านตัวอย่าง
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 text-xs text-slate-500">
            <span>เชื่อมต่อด้วย</span>
            <GoogleIcon className="w-5 h-5" />
            <LineIcon className="w-5 h-5" />
            <span>หรืออีเมล</span>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-20">
          <h2 className="text-center text-2xl font-bold mb-8">เริ่มขายได้ใน 3 ขั้นตอน</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li key={title} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <Icon className="w-4.5 h-4.5 text-brand-400" />
                  </span>
                  <span className="text-xs text-slate-500 font-mono">ขั้นตอนที่ {i + 1}</span>
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-slate-400 mt-1">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title}>
              <Icon className="w-6 h-6 text-brand-400 mb-3" />
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-slate-400 mt-1">{text}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="max-w-5xl mx-auto px-4 pb-20 scroll-mt-8">
          <h2 className="text-center text-2xl font-bold">แพ็กเกจและราคา</h2>
          <p className="text-center text-slate-400 mt-2 mb-8">ทุกแพ็กเกจไม่หักค่าคอมมิชชัน เงินเข้าพร้อมเพย์ของคุณเต็มจำนวน</p>
          <Pricing />
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="bg-linear-to-br from-brand-500/20 to-slate-900 border border-brand-500/30 rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold">พร้อมเปิดร้านแล้วหรือยัง?</h2>
            <p className="text-slate-300 mt-2">เริ่มต้นฟรีตลอดชีพ ไม่หักค่าคอมมิชชัน</p>
            <Link
              href="/login?mode=signup"
              className="text-white mt-6 inline-flex items-center gap-2 px-6 py-3 btn-primary rounded-xl font-semibold transition"
            >
              สร้างบัญชีฟรี <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
