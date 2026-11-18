'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN_NAMES, type Plan } from '@/lib/plans';
import { adminFetch, card, formatDate } from './shared';

export type AuditEntry = {
  id: number;
  created_at: string;
  admin_email: string | null;
  action: 'shop.suspend' | 'shop.unsuspend' | 'shop.plan';
  shop_id: string | null;
  shop_name?: string | null;
  details: {
    reason?: string | null;
    previous_reason?: string | null;
    from?: { plan: string; expires_at: string | null };
    to?: { plan: string; expires_at: string | null };
    note?: string | null;
  };
};

const planText = (p?: { plan: string; expires_at: string | null }) =>
  p
    ? `${PLAN_NAMES[p.plan as Plan] ?? p.plan}${
        p.expires_at ? ` (ถึง ${new Date(p.expires_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })})` : ''
      }`
    : '-';

// ข้อความอธิบายแต่ละรายการในประวัติ
export function describeAudit(e: AuditEntry) {
  switch (e.action) {
    case 'shop.suspend':
      return { title: 'ระงับร้าน', detail: e.details.reason ? `เหตุผล: ${e.details.reason}` : null, tone: 'text-rose-400' };
    case 'shop.unsuspend':
      return { title: 'ยกเลิกการระงับ', detail: null, tone: 'text-brand-400' };
    case 'shop.plan':
      return {
        title: `เปลี่ยนแพ็กเกจ ${planText(e.details.from)} → ${planText(e.details.to)}`,
        detail: e.details.note ? `หมายเหตุ: ${e.details.note}` : null,
        tone: 'text-amber-400',
      };
    default:
      return { title: e.action, detail: null, tone: 'text-slate-300' };
  }
}

export function AuditList({ entries, showShop = true }: { entries: AuditEntry[]; showShop?: boolean }) {
  if (entries.length === 0) return <p className="p-6 text-center text-xs text-slate-500">ยังไม่มีประวัติ</p>;
  return (
    <ul className="divide-y divide-slate-800">
      {entries.map((e) => {
        const d = describeAudit(e);
        return (
          <li key={e.id} className="p-4 text-sm flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
            <span className="text-xs text-slate-500 sm:w-40 shrink-0">{formatDate(e.created_at)}</span>
            <span className="flex-1 min-w-0">
              <span className={`font-medium ${d.tone}`}>{d.title}</span>
              {showShop && e.shop_id && (
                <>
                  {' · '}
                  <Link href={`/admin/shops/${e.shop_id}`} className="hover:text-brand-400">
                    {e.shop_name ?? 'ร้านที่ถูกลบ'}
                  </Link>
                </>
              )}
              {d.detail && <span className="block text-xs text-slate-400 mt-0.5 break-words">{d.detail}</span>}
            </span>
            <span className="text-xs text-slate-500 shrink-0">{e.admin_email ?? '-'}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ประวัติการทำงานของแอดมินทั้งระบบ
export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ entries: AuditEntry[] }>('/api/admin/audit').then(
      (r) => setEntries(r.entries),
      (err) => setError(err.message)
    );
  }, []);

  if (error) return <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>;
  if (!entries) return <p className="text-sm text-slate-400">กำลังโหลด...</p>;
  return (
    <div className={`${card} overflow-hidden`}>
      <AuditList entries={entries} />
    </div>
  );
}
