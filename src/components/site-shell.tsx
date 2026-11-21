import Link from 'next/link';
import { Logo } from '@/components/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-800 py-6 px-4 text-center text-xs text-slate-500 space-y-2">
      <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/pricing" className="hover:text-ink transition">แพ็กเกจและราคา</Link>
        <Link href="/demo" className="hover:text-ink transition">ทดลองใช้</Link>
        <Link href="/terms" className="hover:text-ink transition">ข้อกำหนดการใช้งาน</Link>
        <Link href="/privacy" className="hover:text-ink transition">นโยบายความเป็นส่วนตัว</Link>
      </nav>
      <p>PayBio · รับเงินพร้อมเพย์ผ่านลิงก์ใน Bio</p>
    </footer>
  );
}

export function SiteHeader() {
  return (
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
          className="text-white px-3.5 py-1.5 btn-primary rounded-lg font-semibold transition"
        >
          สมัครฟรี
        </Link>
      </nav>
    </header>
  );
}

// โครงหน้าเอกสาร (ข้อกำหนด / นโยบาย)
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: { heading: string; body: (string | string[])[] }[];
}) {
  return (
    <div className="min-h-screen text-ink flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 pt-8 pb-20">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-xs text-slate-500 mt-2">ปรับปรุงล่าสุด {updated}</p>
        <div className="mt-8 space-y-8">
          {sections.map((s, i) => (
            <section key={s.heading}>
              <h2 className="text-lg font-semibold mb-2">
                {i + 1}. {s.heading}
              </h2>
              <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
                {s.body.map((b, j) =>
                  Array.isArray(b) ? (
                    <ul key={j} className="list-disc pl-5 space-y-1">
                      {b.map((li) => (
                        <li key={li}>{li}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={j}>{b}</p>
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
