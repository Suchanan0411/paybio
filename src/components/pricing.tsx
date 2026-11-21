'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { PLAN_PRICES } from '@/lib/plans';
import { LiquidIndicator } from '@/components/liquid-indicator';

type Billing = 'monthly' | 'yearly';

const PLANS = [
  {
    key: 'free',
    name: 'Free Tier',
    tagline: 'ฟรีตลอดชีพ',
    monthly: 0,
    yearly: 0,
    cta: 'เริ่มต้นฟรี',
    highlights: ['สินค้าสูงสุด 3 ชิ้น', 'ออเดอร์สูงสุด 50 รายการ/เดือน', 'ตรวจสลิปกับธนาคารอัตโนมัติ'],
  },
  {
    key: 'pro',
    name: 'Pro Merchant',
    tagline: 'สำหรับร้านที่ขายจริงจัง',
    monthly: PLAN_PRICES.pro.monthly,
    yearly: PLAN_PRICES.pro.yearly,
    cta: 'เลือก Pro',
    popular: true,
    highlights: ['สินค้าและออเดอร์ไม่จำกัด', 'แจ้งเตือนออเดอร์ผ่าน LINE', 'ลบลายน้ำ PayBio'],
  },
  {
    key: 'business',
    name: 'Business Studio',
    tagline: 'สำหรับแบรนด์และทีม',
    monthly: PLAN_PRICES.business.monthly,
    yearly: PLAN_PRICES.business.yearly,
    cta: 'เลือก Business',
    highlights: ['เชื่อมโดเมนของตนเอง', 'Webhook ส่งออเดอร์เข้าระบบของคุณ', 'Custom Theme สีแบรนด์ของคุณเอง'],
  },
] as const;

// true = มี, false = ไม่มี, string = รายละเอียด (ขึ้นต้น ✓/✕ ได้)
type Cell = boolean | string;

const FEATURES: { label: string; values: [Cell, Cell, Cell] }[] = [
  { label: 'ค่าคอมมิชชันต่อออเดอร์', values: ['0% ฟรี', '0% ฟรี', '0% ฟรี'] },
  { label: 'จำนวนสินค้า/บริการบน Bio', values: ['สูงสุด 3 ชิ้น', 'ไม่จำกัด (Unlimited)', 'ไม่จำกัด (Unlimited)'] },
  { label: 'จำนวนออเดอร์รับต่อเดือน', values: ['สูงสุด 50 ออเดอร์', 'ไม่จำกัด', 'ไม่จำกัด'] },
  {
    label: 'Dynamic PromptPay QR',
    values: ['มี (คำนวณยอดอัตโนมัติ)', 'มี (คำนวณยอดอัตโนมัติ)', 'มี (คำนวณยอดอัตโนมัติ)'],
  },
  { label: 'พื้นที่เก็บรูปสลิป', values: ['100 MB (~30 วัน)', '5 GB (เก็บถาวร)', '20 GB (เก็บถาวร)'] },
  {
    label: 'แจ้งเตือนออเดอร์ผ่าน LINE',
    values: [false, '✓ แจ้งเตือนผ่าน LINE OA ทันที', '✓ LINE OA + Webhook ไปยังระบบของคุณ'],
  },
  {
    label: 'แจ้งเตือนในเว็บ (แผงร้าน)',
    values: ['✓ ออเดอร์ใหม่ + ผลตรวจสลิป', '✓ ออเดอร์ใหม่ + ผลตรวจสลิป', '✓ ออเดอร์ใหม่ + ผลตรวจสลิป'],
  },
  {
    // ยืนยันกับธนาคารผ่าน SlipOK (src/lib/slipok.ts) — ทุกแพ็กเกจเมื่อ SLIPOK_PLANS ว่าง
    label: 'ระบบตรวจสลิปโอนเงิน',
    values: [
      'ยืนยันกับธนาคาร: ยอดเงิน ผู้รับ สลิปปลอม/ซ้ำ',
      'ยืนยันกับธนาคาร: ยอดเงิน ผู้รับ สลิปปลอม/ซ้ำ',
      'ยืนยันกับธนาคาร + ตรวจจับไฟล์สลิปซ้ำ (แม้ถ่ายรูปใหม่หรือครอป)',
    ],
  },
  {
    label: 'การปรับแต่ง Theme & สี',
    values: ['สีมาตรฐาน (Dark/Light)', 'เลือกสี Palette & ฟอนต์ได้', 'Custom Theme: กำหนดสีแบรนด์เองได้ทุกสี + ฟอนต์'],
  },
  { label: 'ลบลายน้ำ "Powered by PayBio"', values: ['✕ มีลายน้ำ', '✓ ลบลายน้ำได้', '✓ ลบลายน้ำได้'] },
  {
    label: 'Custom Domain (โดเมนตัวเอง)',
    values: ['✕ (paybio.me/shop)', '✕ (paybio.me/shop)', '✓ เชื่อมโดเมนของตนเองได้'],
  },
  {
    label: 'ส่งออกรายงานยอดขาย (CSV/Excel)',
    values: [false, '✓ ส่งออกได้ย้อนหลัง 3 เดือน', '✓ ส่งออกได้ไม่จำกัดช่วงเวลา'],
  },
];

function CellValue({ value }: { value: Cell }) {
  const yes = value === true || (typeof value === 'string' && value.startsWith('✓'));
  const no = value === false || (typeof value === 'string' && value.startsWith('✕'));
  const text = typeof value === 'string' ? value.replace(/^[✓✕]\s*/, '') : value ? 'มี' : 'ไม่มี';

  if (no) {
    return (
      <span className="inline-flex items-start gap-1.5 text-slate-500">
        <X className="w-4 h-4 shrink-0 mt-0.5" />
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-start gap-1.5 text-slate-300">
      {yes && <Check className="w-4 h-4 shrink-0 mt-0.5 text-brand-400" />}
      {text}
    </span>
  );
}

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

export function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly');
  const [compare, setCompare] = useState(1); // ตารางเทียบบนมือถือ: เริ่มที่ Pro

  return (
    <div>
      <div className="flex justify-center mb-8">
        <div role="tablist" className="liquid-host inline-flex p-1 glass rounded-xl text-sm">
          <LiquidIndicator active={billing} />
          {(
            [
              ['monthly', 'รายเดือน'],
              ['yearly', 'รายปี'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={billing === key}
              data-active={billing === key}
              onClick={() => setBilling(key)}
              className={`px-4 py-1.5 rounded-lg font-medium transition-colors duration-300 cursor-pointer ${
                billing === key ? 'text-white' : 'text-slate-400 hover:text-ink'
              }`}
            >
              {label}
              {key === 'yearly' && (
                <span className={`ml-1.5 text-xs ${billing === key ? 'text-white/80' : 'text-brand-400'}`}>
                  ประหยัด 2 เดือน
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const price = billing === 'monthly' ? plan.monthly : plan.yearly;
          const popular = 'popular' in plan && plan.popular;
          return (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-2xl p-6 border ${
                popular ? 'bg-brand-500/10 border-brand-500/50' : 'glass'
              }`}
            >
              {popular && (
                <span className="absolute -top-3 left-6 text-xs font-semibold text-white bg-brand-500 px-2.5 py-0.5 rounded-full">
                  ยอดนิยม
                </span>
              )}
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="text-sm text-slate-400">{plan.tagline}</p>
              <p className="mt-4">
                <span className="text-3xl font-bold">{price === 0 ? 'ฟรี' : baht(price)}</span>
                {price > 0 && (
                  <span className="text-sm text-slate-400"> / {billing === 'monthly' ? 'เดือน' : 'ปี'}</span>
                )}
              </p>
              <p className="text-xs text-slate-500 h-4 mt-1">
                {price > 0 && billing === 'yearly' && `เฉลี่ย ${baht(Math.round(plan.yearly / 12))} / เดือน`}
                {price === 0 && 'ไม่ต้องใช้บัตรเครดิต'}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-300 flex-1">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-brand-400" />
                    {h}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.key === 'free' ? '/login?mode=signup' : `/upgrade?plan=${plan.key}&billing=${billing}`}
                className={`mt-6 text-center px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  popular
                    ? 'text-white btn-primary'
                    : 'bg-slate-800 hover:bg-slate-700 text-ink'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <h3 className="mt-14 mb-4 text-lg font-bold text-center">เปรียบเทียบสิทธิประโยชน์</h3>

      {/* มือถือ: เลือกแพ็กเกจทีละแบบ แล้วแสดงสิทธิ์เป็นรายการ (ตารางกว้างเกินจอ) */}
      <div className="md:hidden">
        <div role="tablist" className="liquid-host grid grid-cols-3 gap-1 p-1 glass rounded-xl text-xs mb-3">
          <LiquidIndicator active={PLANS[compare].key} />
          {PLANS.map((plan, i) => (
            <button
              key={plan.key}
              role="tab"
              aria-selected={compare === i}
              data-active={compare === i}
              onClick={() => setCompare(i)}
              className={`py-2 rounded-lg font-semibold transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                compare === i ? 'text-white' : 'text-slate-400'
              }`}
            >
              {plan.name.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="font-semibold">{PLANS[compare].name}</p>
            <p className="text-xs text-slate-500">
              {PLANS[compare].monthly === 0
                ? 'ฟรีตลอดชีพ'
                : `${baht(PLANS[compare].monthly)} / เดือน หรือ ${baht(PLANS[compare].yearly)} / ปี`}
            </p>
          </div>
          <dl className="divide-y divide-slate-800 text-sm">
            {FEATURES.map((f) => (
              <div key={f.label} className="px-4 py-3">
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className="mt-0.5">
                  <CellValue value={f.values[compare]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* จอใหญ่: ตารางเทียบครบทั้ง 3 แพ็กเกจ */}
      <div className="hidden md:block overflow-x-auto rounded-2xl glass">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold text-slate-400 w-[28%]">คุณสมบัติ (Features)</th>
              {PLANS.map((plan) => (
                <th
                  key={plan.key}
                  className={`px-4 py-3 font-semibold ${'popular' in plan ? 'text-brand-400' : ''}`}
                >
                  {plan.name}
                  <span className="block text-xs font-normal text-slate-500">
                    {plan.monthly === 0
                      ? 'ฟรีตลอดชีพ'
                      : `${baht(plan.monthly)} / เดือน หรือ ${baht(plan.yearly)} / ปี`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.label} className="border-t border-slate-800 align-top">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {f.label}
                </th>
                {f.values.map((v, i) => (
                  <td key={i} className={`px-4 py-3 ${i === 1 ? 'bg-brand-500/5' : ''}`}>
                    <CellValue value={v} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
