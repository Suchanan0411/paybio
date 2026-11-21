import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Logo } from '@/components/logo';

export default function NotFound() {
  return (
    <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4 text-center">
      <Link href="/" aria-label="PayBio หน้าแรก" className="mb-8">
        <Logo />
      </Link>
      <SearchX className="w-12 h-12 text-slate-500 mb-4" />
      <h1 className="text-2xl font-bold">ไม่พบหน้าที่คุณต้องการ</h1>
      <p className="text-sm text-slate-400 mt-2 max-w-sm">
        ลิงก์อาจพิมพ์ผิด ร้านค้าอาจเปลี่ยนชื่อลิงก์ หรือหน้านี้ถูกลบไปแล้ว
      </p>
      <div className="flex gap-2 mt-6">
        <Link
          href="/"
          className="text-white px-4 py-2 btn-primary rounded-xl text-sm font-semibold transition"
        >
          กลับหน้าแรก
        </Link>
        <Link
          href="/login?mode=signup"
          className="px-4 py-2 border border-slate-700 hover:border-slate-500 rounded-xl text-sm transition"
        >
          เปิดร้านของคุณเอง
        </Link>
      </div>
    </div>
  );
}
