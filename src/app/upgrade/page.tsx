'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import { Logo } from '@/components/logo';
import { PLAN_NAMES, PLAN_RANK, type Billing, type Plan } from '@/lib/plans';

type PaidPlan = Exclude<Plan, 'free'>;
type Payment = {
  id: string;
  plan: PaidPlan;
  billing: Billing;
  amount: number;
  status: 'pending' | 'paid' | 'rejected';
  note: string | null;
  period_end: string | null;
  created_at: string;
};
type Info = {
  prices: Record<PaidPlan, Record<Billing, number>>;
  promptpay: string | null;
  autoVerify: boolean;
  current: { plan: Plan; expires_at: string | null };
  payments: Payment[];
};

const PERKS: Record<PaidPlan, string[]> = {
  pro: ['สินค้าและออเดอร์ไม่จำกัด', 'แจ้งเตือนออเดอร์ผ่าน LINE', 'ลบลายน้ำ PayBio', 'เก็บสลิปถาวร 5 GB', 'ส่งออก CSV ย้อนหลัง 3 เดือน'],
  business: ['ทุกอย่างใน Pro', 'Webhook เข้าระบบของคุณ', 'เชื่อมโดเมนของตนเอง', 'สีแบรนด์เอง', 'เก็บสลิป 20 GB'],
};

const baht = (n: number) => '฿' + Number(n).toLocaleString('th-TH');
const day = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'medium' });

const STATUS = {
  paid: { label: 'ชำระแล้ว', Icon: CheckCircle2, style: 'text-brand-400 bg-brand-500/10 border-brand-500/20' },
  pending: { label: 'รอตรวจสอบ', Icon: Clock, style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  rejected: { label: 'ไม่ผ่าน', Icon: XCircle, style: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
} as const;

function Upgrade() {
  const router = useRouter();
  const params = useSearchParams();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<PaidPlan>(params.get('plan') === 'business' ? 'business' : 'pro');
  const [billing, setBilling] = useState<Billing>(params.get('billing') === 'yearly' ? 'yearly' : 'monthly');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Payment | null>(null);

  useEffect(() => {
    fetch('/api/billing', { cache: 'no-store' }).then(async (res) => {
      if (res.status === 401) {
        router.replace('/login?mode=signup');
        return;
      }
      const data = await res.json();
      if (!res.ok) setError(data.error || 'โหลดข้อมูลไม่สำเร็จ');
      else setInfo(data);
    });
  }, [router]);

  const amount = info ? info.prices[plan][billing] : 0;
  const qr = useMemo(() => (info?.promptpay && amount ? generatePayload(info.promptpay, { amount }) : ''), [info, amount]);
  const current = info?.current.plan ?? 'free';
  const lowerThanCurrent = PLAN_RANK[current] > PLAN_RANK[plan];
  const renewing = current === plan;

  const submit = async () => {
    if (!file) {
      setError('กรุณาแนบรูปสลิปโอนเงิน');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('plan', plan);
      body.append('billing', billing);
      body.append('slip', file);
      const res = await fetch('/api/billing', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งสลิปไม่สำเร็จ');
      setResult(data.payment);
      setFile(null);
      setInfo((prev) =>
        prev && { ...prev, current: data.current ?? prev.current, payments: [data.payment, ...prev.payments] }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งสลิปไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!info) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        {error || 'กำลังโหลด...'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-ink">
      <header className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" aria-label="PayBio หน้าแรก">
          <Logo size="sm" />
        </Link>
        <Link href="/manage" className="text-sm text-slate-400 hover:text-ink inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> กลับไปจัดการร้าน
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-16 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">อัปเกรดแพ็กเกจ</h1>
          <p className="text-sm text-slate-400 mt-1">
            แพ็กเกจปัจจุบัน: <span className="text-ink font-medium">{PLAN_NAMES[current]}</span>
            {current !== 'free' && info.current.expires_at && ` · ใช้ได้ถึง ${day(info.current.expires_at)}`}
            {current !== 'free' && !info.current.expires_at && ' · ไม่มีวันหมดอายุ'}
          </p>
        </div>

        {result && (
          <div className={`border rounded-2xl p-4 flex gap-3 ${STATUS[result.status].style}`}>
            {(() => {
              const S = STATUS[result.status];
              return <S.Icon className="w-6 h-6 shrink-0" />;
            })()}
            <div className="text-sm">
              <p className="font-semibold">
                {result.status === 'paid'
                  ? `เปิด ${PLAN_NAMES[result.plan]} เรียบร้อย${result.period_end ? ` ใช้ได้ถึง ${day(result.period_end)}` : ''}`
                  : result.status === 'pending'
                    ? 'ได้รับสลิปแล้ว รอตรวจสอบ'
                    : 'สลิปไม่ผ่านการตรวจ'}
              </p>
              {result.note && <p className="text-slate-300 mt-0.5">{result.note}</p>}
              {result.status === 'pending' && <p className="text-slate-400 mt-0.5">แอดมินจะเปิดแพ็กเกจให้หลังตรวจยอดเงิน</p>}
            </div>
          </div>
        )}

        {/* เลือกแพ็กเกจ */}
        <div className="grid sm:grid-cols-2 gap-3">
          {(['pro', 'business'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlan(p)}
              className={`text-left rounded-2xl border p-4 transition cursor-pointer ${
                plan === p ? 'border-brand-500 bg-brand-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600'
              }`}
            >
              <p className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" /> {PLAN_NAMES[p]}
              </p>
              <p className="text-xl font-bold mt-1">
                {baht(info.prices[p][billing])}
                <span className="text-xs font-normal text-slate-400"> / {billing === 'yearly' ? 'ปี' : 'เดือน'}</span>
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                {PERKS[p].map((perk) => (
                  <li key={perk}>✓ {perk}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <div className="inline-grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-sm">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                billing === b ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-ink'
              }`}
            >
              {b === 'monthly' ? 'รายเดือน' : 'รายปี (ประหยัด 2 เดือน)'}
            </button>
          ))}
        </div>

        {/* ชำระเงิน */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          {!info.promptpay ? (
            <p className="text-sm text-amber-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> ระบบยังไม่เปิดรับชำระค่าแพ็กเกจ กรุณาติดต่อผู้ดูแล
            </p>
          ) : lowerThanCurrent ? (
            <p className="text-sm text-slate-300">
              ร้านใช้ {PLAN_NAMES[current]} อยู่ ซึ่งสูงกว่า {PLAN_NAMES[plan]} — เลือก {PLAN_NAMES[current]} เพื่อต่ออายุ
            </p>
          ) : (
            <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-start">
              <div className="bg-white p-3 rounded-2xl text-center mx-auto">
                <QRCodeCanvas value={qr} size={180} marginSize={1} />
                <p className="text-gray-700 text-xs mt-1 font-semibold">{baht(amount)}</p>
              </div>
              <div className="space-y-3 text-sm">
                <p className="font-semibold">
                  {renewing ? 'ต่ออายุ' : 'อัปเกรดเป็น'} {PLAN_NAMES[plan]} · {billing === 'yearly' ? '1 ปี' : '30 วัน'}
                </p>
                <ol className="list-decimal pl-5 space-y-1 text-slate-300 text-xs">
                  <li>สแกน QR ด้วยแอปธนาคาร ยอด {baht(amount)} จะขึ้นให้อัตโนมัติ</li>
                  <li>ตรวจชื่อผู้รับว่าเป็น PayBio แล้วโอน</li>
                  <li>แนบสลิปด้านล่าง {info.autoVerify ? 'ระบบตรวจกับธนาคารและเปิดแพ็กเกจให้ทันที' : 'แอดมินจะตรวจและเปิดแพ็กเกจให้'}</li>
                </ol>
                {renewing && info.current.expires_at && (
                  <p className="text-xs text-slate-400">นับต่อจากวันหมดอายุเดิม ({day(info.current.expires_at)}) ไม่เสียวันที่เหลือ</p>
                )}
                {!renewing && current !== 'free' && (
                  <p className="text-xs text-amber-400">เปลี่ยนเป็น {PLAN_NAMES[plan]} เริ่มนับจากวันนี้</p>
                )}

                <label
                  htmlFor="billing-slip"
                  className={`block border-2 border-dashed rounded-xl p-3 cursor-pointer transition text-center ${
                    file ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-700 hover:border-brand-500/50'
                  }`}
                >
                  <input
                    id="billing-slip"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setError('');
                    }}
                  />
                  <UploadCloud className="w-5 h-5 text-slate-400 mx-auto" />
                  <span className="block text-xs mt-1">{file ? file.name : 'แนบรูปสลิปโอนเงิน'}</span>
                </label>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 font-semibold rounded-xl cursor-pointer"
                >
                  {submitting ? 'กำลังตรวจสลิป...' : `ยืนยันการชำระ ${baht(amount)}`}
                </button>
              </div>
            </div>
          )}
        </div>

        {info.payments.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">ประวัติการชำระ</p>
            <ul className="divide-y divide-slate-800 text-xs">
              {info.payments.map((p) => {
                const S = STATUS[p.status];
                return (
                  <li key={p.id} className="py-2.5 flex items-center gap-3">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm">
                        {PLAN_NAMES[p.plan]} {p.billing === 'yearly' ? 'รายปี' : 'รายเดือน'} · {baht(p.amount)}
                      </span>
                      <span className="block text-slate-500">
                        {day(p.created_at)}
                        {p.status === 'paid' && p.period_end && ` · ใช้ได้ถึง ${day(p.period_end)}`}
                        {p.status !== 'paid' && p.note && ` · ${p.note}`}
                      </span>
                    </span>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${S.style}`}>
                      <S.Icon className="w-3 h-3" /> {S.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <Upgrade />
    </Suspense>
  );
}
