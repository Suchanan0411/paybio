import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/site-shell';
import { Logo } from '@/components/logo';
import { Pricing } from '@/components/pricing';

export const metadata: Metadata = {
  title: 'แพ็กเกจและราคา · PayBio',
  description: 'เปรียบเทียบแพ็กเกจ Free, Pro Merchant และ Business Studio ของ PayBio',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-ink">
      <header className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" aria-label="PayBio หน้าแรก">
          <Logo size="sm" />
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="px-3 py-1.5 text-slate-300 hover:text-ink transition">
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/login?mode=signup"
            className="text-white px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 rounded-lg font-semibold transition"
          >
            สมัครฟรี
          </Link>
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-10 pb-20">
        <h1 className="text-center text-3xl sm:text-4xl font-bold">แพ็กเกจและราคา</h1>
        <p className="text-center text-slate-400 mt-3 mb-10">
          ทุกแพ็กเกจไม่หักค่าคอมมิชชัน เงินเข้าพร้อมเพย์ของคุณเต็มจำนวน
        </p>
        <Pricing />
      </main>

      <SiteFooter />
    </div>
  );
}
