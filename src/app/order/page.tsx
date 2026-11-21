'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Search } from 'lucide-react';
import { Logo } from '@/components/logo';

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500 transition';

// ค้นหาคำสั่งซื้อ สำหรับลูกค้าที่ทำลิงก์ติดตามหาย
export default function FindOrderPage() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState('');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: orderNumber, contact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ค้นหาไม่สำเร็จ');
      router.push(`/order/${data.tokens[0]}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4">
      <Link href="/" aria-label="PayBio หน้าแรก" className="mb-6">
        <Logo />
      </Link>
      <form onSubmit={submit} className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">ค้นหาคำสั่งซื้อ</h1>
          <p className="text-sm text-slate-400 mt-1">ดูสถานะคำสั่งซื้อและเลขพัสดุ ใช้ข้อมูลเดียวกับที่กรอกตอนสั่งซื้อ</p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="order-number" className="text-xs text-slate-300 font-medium block mb-1.5">
            เลขคำสั่งซื้อ
          </label>
          <input
            id="order-number"
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            placeholder="PB-7K3QX9MD"
            pattern="\s*[Pp][Bb]-[0-9A-Za-z]{4,10}\s*"
            title="เลขคำสั่งซื้อขึ้นต้นด้วย PB- ตามด้วยตัวอักษรและตัวเลข"
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label htmlFor="contact" className="text-xs text-slate-300 font-medium block mb-1.5">
            เบอร์โทร / LINE ID / อีเมล ที่ใช้ตอนสั่ง
          </label>
          <input
            id="contact"
            required
            minLength={4}
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="เช่น 0812345678"
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="text-white w-full py-3 btn-primary disabled:opacity-50 font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Search className="w-4 h-4" /> {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
        </button>
        <p className="text-[11px] text-slate-500 text-center">
          เลขคำสั่งซื้ออยู่ในหน้าจอหลังส่งสลิป และในอีเมลยืนยัน (ถ้ากรอกอีเมลไว้)
        </p>
      </form>
    </div>
  );
}
