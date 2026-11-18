'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN_NAMES, type Plan } from '@/lib/plans';
import { BarChart } from './bar-chart';
import { adminFetch, card, formatBaht, formatDay, td, th } from './shared';

type Report = {
  days: number;
  daily: { day: string; orders: number; paid_orders: number; paid_amount: number; new_shops: number }[];
  plans: { plan: Plan; shops: number }[];
  topShops: { id: string; shop_name: string; slug: string; plan: Plan; order_count: number; paid_total: number }[];
};

const RANGES = [7, 30, 90] as const;

export function ReportsTab() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Report>(`/api/admin/reports?days=${days}`).then(
      (r) => {
        setReport(r);
        setError(null);
      },
      (err) => setError(err.message)
    );
  }, [days]);

  if (error) return <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>;
  if (!report) return <p className="text-sm text-slate-400">กำลังโหลดรายงาน...</p>;

  const series = (key: 'orders' | 'paid_amount' | 'new_shops') => report.daily.map((d) => ({ label: formatDay(d.day), value: d[key] }));
  const sum = (key: 'orders' | 'paid_orders' | 'paid_amount' | 'new_shops') => report.daily.reduce((s, d) => s + d[key], 0);
  const totalShops = report.plans.reduce((s, p) => s + p.shops, 0);
  const tiles = [
    { label: `ออเดอร์ ${days} วัน`, value: sum('orders').toLocaleString('th-TH') },
    { label: 'ชำระแล้ว', value: sum('paid_orders').toLocaleString('th-TH') },
    { label: 'ยอดชำระแล้ว', value: formatBaht(sum('paid_amount')) },
    { label: 'ร้านสมัครใหม่', value: sum('new_shops').toLocaleString('th-TH') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit" role="group" aria-label="ช่วงเวลา">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setDays(r)}
            aria-pressed={days === r}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
              days === r ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-ink hover:bg-slate-800'
            }`}
          >
            {r} วัน
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} p-4`}>
            <p className="text-xs text-slate-400">{t.label}</p>
            <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <BarChart title="ออเดอร์ต่อวัน" data={series('orders')} />
        <BarChart title="ยอดชำระแล้วต่อวัน" data={series('paid_amount')} format={formatBaht} />
        <BarChart title="ร้านสมัครใหม่ต่อวัน" data={series('new_shops')} />

        <div className={`${card} p-4`}>
          <p className="text-sm font-semibold">ร้านค้าตามแพ็กเกจ</p>
          <ul className="mt-4 space-y-3">
            {report.plans.map((p) => (
              <li key={p.plan} className="text-xs">
                <div className="flex justify-between mb-1">
                  <span>{PLAN_NAMES[p.plan]}</span>
                  <span className="tabular-nums text-slate-400">
                    {p.shops.toLocaleString('th-TH')} ร้าน ({totalShops ? Math.round((p.shops / totalShops) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${totalShops ? (p.shops / totalShops) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 mt-4">นับตามแพ็กเกจที่ใช้งานได้จริง (สิทธิ์ที่หมดอายุแล้วนับเป็น Free)</p>
        </div>
      </div>

      <div className={`${card} overflow-hidden`}>
        <div className="p-4 border-b border-slate-800 font-semibold text-sm">ร้านยอดขายสูงสุด (ทั้งหมด)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-400 bg-slate-800/40">
              <tr>
                <th className={th}>#</th>
                <th className={th}>ร้านค้า</th>
                <th className={th}>แพ็กเกจ</th>
                <th className={`${th} text-right`}>คำสั่งซื้อ</th>
                <th className={`${th} text-right`}>ยอดชำระแล้ว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {report.topShops.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className={`${td} text-slate-500`}>{i + 1}</td>
                  <td className={td}>
                    <Link href={`/admin/shops/${s.id}`} className="font-medium hover:text-brand-400">
                      {s.shop_name}
                    </Link>
                  </td>
                  <td className={`${td} text-xs`}>{PLAN_NAMES[s.plan]}</td>
                  <td className={`${td} text-right tabular-nums`}>{s.order_count.toLocaleString('th-TH')}</td>
                  <td className={`${td} text-right tabular-nums font-semibold text-brand-400`}>{formatBaht(s.paid_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.topShops.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ยังไม่มีคำสั่งซื้อ</p>}
        </div>
      </div>
    </div>
  );
}
