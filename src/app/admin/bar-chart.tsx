'use client';

import { useState } from 'react';

// กราฟแท่งชุดเดียว (หนึ่งแกน): แท่งบาง ปลายมน มีช่องว่างระหว่างแท่ง, hover แสดงค่า และมีตารางข้อมูลสำหรับอ่านค่าแบบละเอียด
export function BarChart({
  title,
  data,
  format = (v) => v.toLocaleString('th-TH'),
}: {
  title: string;
  data: { label: string; value: number }[];
  format?: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const shown = active != null ? data[active] : null;
  const tickEvery = Math.ceil(data.length / 5);

  return (
    <figure className="glass rounded-2xl p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-slate-400 tabular-nums">
          {shown ? `${shown.label}: ${format(shown.value)}` : `รวม ${format(total)}`}
        </span>
      </figcaption>

      <div className="mt-4 flex gap-2">
        {/* แกน y: ค่าสูงสุดและศูนย์ */}
        <div className="flex flex-col justify-between text-[10px] text-slate-500 tabular-nums text-right w-12 shrink-0 h-40">
          <span>{format(max)}</span>
          <span>0</span>
        </div>
        <div className="flex-1 min-w-0">
          <div
            role="img"
            aria-label={`${title}: รวม ${format(total)}`}
            className="h-40 flex items-end gap-[2px] border-b border-slate-700 border-t border-t-slate-800/60"
            onMouseLeave={() => setActive(null)}
          >
            {data.map((d, i) => (
              <div
                key={d.label + i}
                onMouseEnter={() => setActive(i)}
                className="flex-1 h-full flex items-end cursor-default"
                title={`${d.label}: ${format(d.value)}`}
              >
                <div
                  className={`w-full rounded-t-[4px] transition-colors ${active === i ? 'bg-brand-400' : 'bg-brand-500'}`}
                  style={{ height: max > 0 ? `${(d.value / max) * 100}%` : 0, minHeight: d.value > 0 ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          {/* ป้ายแกน x: วางตามกึ่งกลางแท่ง ไม่ถูกตัดแม้แท่งแคบ */}
          <div className="relative h-4 mt-1.5 text-[10px] text-slate-500" aria-hidden="true">
            {data.map((d, i) =>
              i % tickEvery === 0 || i === data.length - 1 ? (
                <span
                  key={d.label + i}
                  className="absolute whitespace-nowrap -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
                  style={{ left: `${((i + 0.5) / data.length) * 100}%` }}
                >
                  {d.label}
                </span>
              ) : null
            )}
          </div>
        </div>
      </div>

      <details className="mt-3 text-xs">
        <summary className="text-slate-400 cursor-pointer hover:text-ink">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y divide-slate-800">
            {data.map((d, i) => (
              <tr key={d.label + i}>
                <td className="py-1 text-slate-400">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
