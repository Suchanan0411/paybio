import { PLAN_NAMES, type Plan } from '@/lib/plans';

// ตัวช่วยที่ใช้ร่วมกันในหน้าผู้ดูแลระบบ

export type OrderStatus = 'pending' | 'paid' | 'rejected';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'รอตรวจสอบ',
  paid: 'ชำระแล้ว',
  rejected: 'ปฏิเสธ',
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  paid: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
  rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
};

export function formatBaht(value: number) {
  return '฿' + Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDay(value: string) {
  return new Date(value).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
}

export const card = 'glass rounded-2xl';
export const th = 'text-left font-medium px-4 py-3 whitespace-nowrap';
export const td = 'px-4 py-3 whitespace-nowrap';
export const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ'), { status: res.status });
  return json as T;
}

// แพ็กเกจ + วันหมดอายุ (ถ้าแอดมินให้แบบมีกำหนด)
export function PlanBadge({ plan, planRaw, expiresAt }: { plan: Plan; planRaw?: string; expiresAt?: string | null }) {
  const expired = !!planRaw && planRaw !== plan;
  return (
    <span className="inline-flex flex-col">
      <span className="text-xs font-medium">{PLAN_NAMES[plan]}</span>
      {expired ? (
        <span className="text-[10px] text-rose-400">สิทธิ์ {PLAN_NAMES[planRaw as Plan] ?? planRaw} หมดอายุแล้ว</span>
      ) : (
        expiresAt && (
          <span className="text-[10px] text-amber-400">
            ถึง {new Date(expiresAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
          </span>
        )
      )}
    </span>
  );
}
