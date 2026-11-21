'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Image as ImageIcon, XCircle } from 'lucide-react';
import { PLAN_NAMES, type Plan } from '@/lib/plans';
import { adminFetch, card, formatBaht, formatDate, td, th } from './shared';

type PlanPayment = {
  id: string;
  shop_id: string;
  shop_name: string | null;
  shop_slug: string | null;
  plan: Plan;
  billing: 'monthly' | 'yearly';
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  note: string | null;
  bank: { amount: number; datetime: string | null; receiver_name: string | null; receiver_proxy: string | null; ref: string } | null;
  slip_url: string | null;
  period_end: string | null;
  reviewed_by: string | null;
  created_at: string;
};

const STATUS = {
  pending: { label: 'รอตรวจ', Icon: Clock, style: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  paid: { label: 'ชำระแล้ว', Icon: CheckCircle2, style: 'bg-brand-500/10 text-brand-400 border-brand-500/30' },
  rejected: { label: 'ไม่ผ่าน', Icon: XCircle, style: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
} as const;

// การชำระค่าแพ็กเกจของร้าน: อนุมัติ/ปฏิเสธรายการที่ระบบตรวจอัตโนมัติไม่ได้
export function BillingTab({ onPreview }: { onPreview: (url: string) => void }) {
  const [payments, setPayments] = useState<PlanPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<{ payments: PlanPayment[] }>('/api/admin/billing').then(
      (r) => setPayments(r.payments),
      (err) => setError(err.message)
    );
  }, []);
  useEffect(load, [load]);

  const review = async (p: PlanPayment, action: 'approve' | 'reject') => {
    const msg =
      action === 'approve'
        ? `ยืนยันว่าเงิน ${formatBaht(p.amount)} เข้าบัญชีแล้ว และเปิด ${PLAN_NAMES[p.plan]} ให้ ${p.shop_name ?? 'ร้านนี้'}?`
        : 'เหตุผลที่ปฏิเสธ (ร้านจะเห็นข้อความนี้)';
    let note: string | null = null;
    if (action === 'approve') {
      if (!window.confirm(msg)) return;
    } else {
      note = window.prompt(msg, 'ไม่พบยอดเงินเข้าบัญชี');
      if (note === null) return;
    }
    setBusy(p.id);
    try {
      await adminFetch('/api/admin/billing', { method: 'PATCH', body: JSON.stringify({ id: p.id, action, note }) });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>;
  if (!payments) return <p className="text-sm text-slate-400">กำลังโหลด...</p>;
  if (payments.length === 0) return <p className="text-sm text-slate-400">ยังไม่มีการชำระค่าแพ็กเกจ</p>;

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead className="bg-slate-800/40 text-slate-400 text-xs">
          <tr>
            <th className={th}>วันที่</th>
            <th className={th}>ร้าน</th>
            <th className={th}>แพ็กเกจ</th>
            <th className={th}>ยอด</th>
            <th className={th}>ผลตรวจธนาคาร</th>
            <th className={th}>สถานะ</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => {
            const S = STATUS[p.status];
            return (
              <tr key={p.id} className="border-t border-slate-800 align-top">
                <td className={`${td} text-xs text-slate-400`}>{formatDate(p.created_at)}</td>
                <td className={td}>
                  <Link href={`/admin/shops/${p.shop_id}`} className="hover:text-brand-400">
                    {p.shop_name ?? '-'}
                  </Link>
                  {p.shop_slug && <span className="block text-[11px] text-slate-500 font-mono">/{p.shop_slug}</span>}
                </td>
                <td className={td}>
                  {PLAN_NAMES[p.plan]}
                  <span className="block text-[11px] text-slate-500">{p.billing === 'yearly' ? 'รายปี' : 'รายเดือน'}</span>
                </td>
                <td className={`${td} font-semibold`}>{formatBaht(p.amount)}</td>
                <td className={`${td} text-xs whitespace-normal min-w-56`}>
                  {p.bank ? (
                    <span className="text-slate-300">
                      ยอด {formatBaht(p.bank.amount)}
                      {p.bank.datetime && ` · ${formatDate(p.bank.datetime)}`}
                      <span className="block text-slate-500">
                        ผู้รับ {[p.bank.receiver_name, p.bank.receiver_proxy].filter(Boolean).join(' · ') || '-'} · อ้างอิง {p.bank.ref}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500">ไม่มีข้อมูลธนาคาร</span>
                  )}
                  {p.note && <span className="block text-amber-400 mt-0.5">{p.note}</span>}
                </td>
                <td className={td}>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${S.style}`}>
                    <S.Icon className="w-3 h-3" /> {S.label}
                  </span>
                  {p.status === 'paid' && p.period_end && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">ถึง {new Date(p.period_end).toLocaleDateString('th-TH')}</span>
                  )}
                  {p.reviewed_by && <span className="block text-[11px] text-slate-500">โดย {p.reviewed_by === 'auto' ? 'ระบบ' : p.reviewed_by}</span>}
                </td>
                <td className={`${td} text-right space-x-1.5`}>
                  {p.slip_url && (
                    <button
                      onClick={() => onPreview(p.slip_url!)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs cursor-pointer"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> สลิป
                    </button>
                  )}
                  {p.status === 'pending' && (
                    <>
                      <button
                        onClick={() => review(p, 'approve')}
                        disabled={busy === p.id}
                        className="text-white px-2.5 py-1 rounded-lg btn-primary text-xs font-medium disabled:opacity-50 cursor-pointer"
                      >
                        อนุมัติ
                      </button>
                      <button
                        onClick={() => review(p, 'reject')}
                        disabled={busy === p.id}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/80 hover:text-white text-xs disabled:opacity-50 cursor-pointer"
                      >
                        ปฏิเสธ
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
