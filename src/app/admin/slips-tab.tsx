'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Copy, Image as ImageIcon, XCircle } from 'lucide-react';
import { adminFetch, card, formatBaht, formatDate, STATUS_LABEL, STATUS_STYLE, td, th, type OrderStatus } from './shared';

type SuspiciousOrder = {
  id: string;
  order_number: string;
  item_title: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
  slip_url: string | null;
  customer_name: string | null;
  profile_id: string | null;
  shop_name: string | null;
  verdict: 'pass' | 'warn' | 'fail' | 'unchecked' | null;
  problems: string[];
  ref: string | null;
  dup_file: boolean;
  dup_ref: boolean;
};

// สลิปที่ระบบตรวจแล้วไม่ผ่าน/ควรตรวจซ้ำ หรือซ้ำกับออเดอร์อื่น (รวมข้ามร้าน)
export function SlipsTab({ onPreview }: { onPreview: (url: string) => void }) {
  const [orders, setOrders] = useState<SuspiciousOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ orders: SuspiciousOrder[] }>('/api/admin/slips').then(
      (r) => setOrders(r.orders),
      (err) => setError(err.message)
    );
  }, []);

  if (error) return <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>;
  if (!orders) return <p className="text-sm text-slate-400">กำลังโหลด...</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        ออเดอร์ที่ผลตรวจสลิป &quot;ไม่ผ่าน&quot; หรือ &quot;ควรตรวจซ้ำ&quot; และสลิปที่ไฟล์หรือเลขอ้างอิงซ้ำกับออเดอร์อื่น ทั้งในร้านเดียวกันและข้ามร้าน
        ใช้หาร้านหรือลูกค้าที่อาจส่งสลิปปลอมหรือสลิปเดิมซ้ำ
      </p>
      <div className={`${card} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400 bg-slate-800/40">
              <tr>
                <th className={th}>รหัส</th>
                <th className={th}>ร้านค้า</th>
                <th className={th}>ปัญหาที่พบ</th>
                <th className={`${th} text-right`}>ยอด</th>
                <th className={th}>สถานะ</th>
                <th className={th}>วันที่</th>
                <th className={th}>สลิป</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/30 align-top">
                  <td className={`${td} font-mono text-xs`}>
                    {o.order_number}
                    {o.customer_name && <p className="font-sans text-[11px] text-slate-500">{o.customer_name}</p>}
                  </td>
                  <td className={td}>
                    {o.profile_id ? (
                      <Link href={`/admin/shops/${o.profile_id}`} className="hover:text-brand-400">
                        {o.shop_name}
                      </Link>
                    ) : (
                      <span className="text-slate-500">ร้านตัวอย่าง</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs space-y-1 min-w-56">
                    {o.dup_file && (
                      <p className="flex items-center gap-1 text-rose-400">
                        <Copy className="w-3.5 h-3.5 shrink-0" /> ไฟล์สลิปเดียวกับออเดอร์อื่น
                      </p>
                    )}
                    {o.dup_ref && (
                      <p className="flex items-center gap-1 text-rose-400">
                        <Copy className="w-3.5 h-3.5 shrink-0" /> เลขอ้างอิงซ้ำ <span className="font-mono">{o.ref}</span>
                      </p>
                    )}
                    {o.problems.map((p) => (
                      <p key={p} className={`flex items-center gap-1 ${o.verdict === 'fail' ? 'text-rose-400' : 'text-amber-400'}`}>
                        {o.verdict === 'fail' ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                        {p}
                      </p>
                    ))}
                  </td>
                  <td className={`${td} text-right font-semibold`}>{formatBaht(o.amount)}</td>
                  <td className={td}>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[o.status] ?? STATUS_STYLE.pending}`}>
                      {STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className={`${td} text-xs text-slate-400`}>{formatDate(o.created_at)}</td>
                  <td className={td}>
                    {o.slip_url ? (
                      <button
                        onClick={() => onPreview(`/api/orders/slip?id=${o.id}`)}
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> ดู
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">ลบแล้ว</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ไม่พบสลิปที่น่าสงสัย</p>}
        </div>
      </div>
    </div>
  );
}
