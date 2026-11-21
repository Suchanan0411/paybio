'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Bell,
  CircleCheck,
  ExternalLink,
  Gift,
  History,
  Image as ImageIcon,
  Package,
  Receipt,
  Store,
  User,
  Webhook,
  X,
} from 'lucide-react';
import { PLAN_NAMES, type Plan } from '@/lib/plans';
import { AuditList, type AuditEntry } from '../../audit-tab';
import {
  adminFetch,
  card,
  formatBaht,
  formatDate,
  inputClass,
  PlanBadge,
  STATUS_LABEL,
  STATUS_STYLE,
  td,
  th,
  type OrderStatus,
} from '../../shared';

type Detail = {
  shop: {
    id: string;
    shop_name: string;
    slug: string;
    bio: string | null;
    promptpay_number: string;
    created_at: string;
    plan: Plan;
    plan_raw: string;
    plan_expires_at: string | null;
    plan_note: string | null;
    custom_domain: string | null;
    suspended_at: string | null;
    suspended_reason: string | null;
    line_connected: boolean;
    webhook_url: string | null;
  };
  owner: { email: string | null; name: string | null; provider: string; created_at: string; last_sign_in_at: string | null } | null;
  stats: {
    order_count: number;
    pending_count: number;
    paid_total: number;
    product_count: number;
    max_products: number | null;
    monthly_quota_full: boolean;
  };
  storage: { used: number; limit: number; retentionDays: number | null } | null;
  products: { id: string; name: string; price: number; created_at: string }[];
  orders: {
    id: string;
    order_number: string;
    item_title: string;
    amount: number;
    status: OrderStatus;
    created_at: string;
    slip_url: string | null;
    customer_name: string | null;
    slip_check: { verdict: string } | null;
  }[];
  audit: AuditEntry[];
};

// ระยะเวลาสิทธิ์ที่ให้ (วัน) — null = ไม่หมดอายุ
const DURATIONS: { label: string; days: number | null }[] = [
  { label: '7 วัน', days: 7 },
  { label: '30 วัน', days: 30 },
  { label: '90 วัน', days: 90 },
  { label: '1 ปี', days: 365 },
  { label: 'ไม่หมดอายุ', days: null },
];

const mb = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toLocaleString('th-TH', { maximumFractionDigits: 1 })} GB`
    : `${(bytes / 1024 ** 2).toLocaleString('th-TH', { maximumFractionDigits: 1 })} MB`;

export default function ShopDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [grantPlan, setGrantPlan] = useState<Plan>('pro');
  const [grantDays, setGrantDays] = useState<number | null>(30);
  const [grantNote, setGrantNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const onLoadError = useCallback(
    (err: unknown) => {
      if ((err as { status?: number }).status === 401) return router.replace('/login');
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    },
    [router]
  );

  useEffect(() => {
    adminFetch<Detail>(`/api/admin/shops/${id}`).then(setData, onLoadError);
  }, [id, onLoadError]);

  const patch = async (body: Record<string, unknown>, done: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await adminFetch('/api/admin', { method: 'PATCH', body: JSON.stringify({ shop_id: id, ...body }) });
      setNotice(done);
      setData(await adminFetch<Detail>(`/api/admin/shops/${id}`));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const grant = () => {
    const expires = grantPlan !== 'free' && grantDays ? new Date(Date.now() + grantDays * 864e5).toISOString() : null;
    const label = `${PLAN_NAMES[grantPlan]}${expires ? ` ถึง ${new Date(expires).toLocaleDateString('th-TH', { dateStyle: 'medium' })}` : ''}`;
    patch({ plan: grantPlan, expires_at: expires, note: grantNote }, `ให้สิทธิ์ ${label} แล้ว`).then((ok) => ok && setGrantNote(''));
  };

  if (error && !data) {
    return (
      <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4 text-center gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <Link href="/admin" className="text-sm text-brand-400 hover:underline">
          กลับแผงผู้ดูแลระบบ
        </Link>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen text-slate-400 flex items-center justify-center text-sm">กำลังโหลด...</div>;
  }

  const { shop, owner, stats, storage } = data;
  const storagePct = storage ? Math.min(100, (storage.used / storage.limit) * 100) : 0;

  return (
    <div className="min-h-screen text-ink">
      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> แผงผู้ดูแลระบบ
        </Link>

        {/* หัวร้าน */}
        <div className={`${card} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold truncate">{shop.shop_name}</h1>
              {shop.suspended_at ? (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/30">ถูกระงับ</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-brand-500/10 text-brand-400 border-brand-500/30">เปิดอยู่</span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-1">
              /{shop.slug}
              {shop.custom_domain && ` · ${shop.custom_domain}`}
            </p>
            {shop.suspended_at && shop.suspended_reason && (
              <p className="text-xs text-rose-400 mt-1">เหตุผลที่ระงับ: {shop.suspended_reason}</p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href={`/${shop.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl border border-slate-700"
            >
              หน้าร้าน <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => {
                setSuspendReason('');
                setSuspendOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border cursor-pointer ${
                shop.suspended_at
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              {shop.suspended_at ? <CircleCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {shop.suspended_at ? 'ยกเลิกระงับ' : 'ระงับร้าน'}
            </button>
          </div>
        </div>

        {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}
        {notice && (
          <div className="p-3 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-xl text-sm flex justify-between">
            {notice}
            <button onClick={() => setNotice(null)} aria-label="ปิด" className="cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'ยอดชำระแล้ว', value: formatBaht(stats.paid_total), accent: 'text-brand-400' },
            { label: 'คำสั่งซื้อทั้งหมด', value: stats.order_count.toLocaleString('th-TH') },
            { label: 'รอตรวจสอบ', value: stats.pending_count.toLocaleString('th-TH'), accent: 'text-amber-400' },
            {
              label: 'สินค้า',
              value: `${stats.product_count}${stats.max_products != null ? ` / ${stats.max_products}` : ''}`,
            },
          ].map((t) => (
            <div key={t.label} className={`${card} p-4`}>
              <p className="text-xs text-slate-400">{t.label}</p>
              <p className={`text-xl sm:text-2xl font-bold mt-1 tabular-nums ${t.accent ?? ''}`}>{t.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* แพ็กเกจ + ให้สิทธิ์ */}
          <section className={`${card} p-5 space-y-4 lg:col-span-2`}>
            <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
              <Gift className="w-4 h-4 text-brand-400" /> แพ็กเกจและสิทธิ์
            </div>
            <div className="flex flex-wrap items-start gap-6 text-sm">
              <div>
                <p className="text-xs text-slate-400 mb-1">ใช้งานอยู่</p>
                <PlanBadge plan={shop.plan} planRaw={shop.plan_raw} expiresAt={shop.plan_expires_at} />
              </div>
              {shop.plan_note && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 mb-1">หมายเหตุ</p>
                  <p className="text-xs break-words">{shop.plan_note}</p>
                </div>
              )}
              {stats.monthly_quota_full && (
                <p className="text-xs text-amber-400">รับออเดอร์ครบโควตาเดือนนี้แล้ว</p>
              )}
            </div>

            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold">ให้สิทธิ์ / เปลี่ยนแพ็กเกจ</p>
              <div className="flex gap-1 flex-wrap" role="group" aria-label="แพ็กเกจ">
                {(Object.keys(PLAN_NAMES) as Plan[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setGrantPlan(p)}
                    aria-pressed={grantPlan === p}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      grantPlan === p ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {PLAN_NAMES[p]}
                  </button>
                ))}
              </div>
              {grantPlan !== 'free' && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">ระยะเวลา (หมดแล้วกลับเป็น Free อัตโนมัติ)</p>
                  <div className="flex gap-1 flex-wrap" role="group" aria-label="ระยะเวลา">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.label}
                        onClick={() => setGrantDays(d.days)}
                        aria-pressed={grantDays === d.days}
                        className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${
                          grantDays === d.days ? 'bg-slate-700 border-slate-600 text-ink' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <input
                value={grantNote}
                onChange={(e) => setGrantNote(e.target.value)}
                maxLength={300}
                placeholder="หมายเหตุ เช่น ทดลองใช้ Pro ฟรี / ร้านพาร์ทเนอร์"
                className={inputClass}
              />
              <button
                onClick={grant}
                disabled={saving}
                className="text-white px-4 py-2 btn-primary rounded-xl text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'กำลังบันทึก...' : grantPlan === 'free' ? 'เปลี่ยนเป็น Free' : `ให้สิทธิ์ ${PLAN_NAMES[grantPlan]}`}
              </button>
            </div>
          </section>

          {/* เจ้าของ + การแจ้งเตือน + พื้นที่ */}
          <section className="space-y-4">
            <div className={`${card} p-5 space-y-2 text-xs`}>
              <p className="flex items-center gap-2 font-semibold text-sm">
                <User className="w-4 h-4 text-brand-400" /> เจ้าของร้าน
              </p>
              {owner ? (
                <>
                  <p className="text-sm">{owner.name ?? owner.email}</p>
                  {owner.name && <p className="text-slate-400">{owner.email}</p>}
                  <p className="text-slate-500">
                    เข้าระบบด้วย <span className="capitalize">{owner.provider}</span> · ใช้ล่าสุด {formatDate(owner.last_sign_in_at)}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">ไม่มีเจ้าของ</p>
              )}
              <p className="text-slate-500">พร้อมเพย์ •••• {shop.promptpay_number.slice(-4)} · สร้างร้าน {formatDate(shop.created_at)}</p>
            </div>

            <div className={`${card} p-5 space-y-2 text-xs`}>
              <p className="flex items-center gap-2 font-semibold text-sm">
                <Bell className="w-4 h-4 text-brand-400" /> การแจ้งเตือน
              </p>
              <p>LINE: {shop.line_connected ? <span className="text-brand-400">เชื่อมต่อแล้ว</span> : <span className="text-slate-500">ยังไม่เชื่อม</span>}</p>
              <p className="flex items-center gap-1 min-w-0">
                <Webhook className="w-3.5 h-3.5 shrink-0" />
                {shop.webhook_url ? <span className="font-mono truncate">{shop.webhook_url}</span> : <span className="text-slate-500">ไม่มี Webhook</span>}
              </p>
            </div>

            {storage && (
              <div className={`${card} p-5 space-y-2`}>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <ImageIcon className="w-3.5 h-3.5" /> พื้นที่สลิป
                  </span>
                  <span className="font-mono">
                    {mb(storage.used)} / {mb(storage.limit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${storagePct >= 90 ? 'bg-rose-500' : storagePct >= 75 ? 'bg-amber-400' : 'bg-brand-500'}`}
                    style={{ width: `${Math.max(storagePct, storage.used > 0 ? 1 : 0)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {storage.retentionDays != null ? `เก็บ ${storage.retentionDays} วัน` : 'เก็บถาวร'}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* ออเดอร์ล่าสุด */}
        <section className={`${card} overflow-hidden`}>
          <div className="p-4 border-b border-slate-800 font-semibold text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-brand-400" /> คำสั่งซื้อล่าสุด
            <span className="text-xs font-normal text-slate-500">(สูงสุด 100 รายการ)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-400 bg-slate-800/40">
                <tr>
                  <th className={th}>รหัส</th>
                  <th className={th}>สินค้า</th>
                  <th className={th}>ผู้สั่ง</th>
                  <th className={`${th} text-right`}>ยอด</th>
                  <th className={th}>สถานะ</th>
                  <th className={th}>วันที่</th>
                  <th className={th}>สลิป</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/30">
                    <td className={`${td} font-mono text-xs`}>{o.order_number}</td>
                    <td className={td}>{o.item_title}</td>
                    <td className={`${td} text-xs`}>{o.customer_name ?? '-'}</td>
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
                          onClick={() => setPreview(`/api/orders/slip?id=${o.id}`)}
                          className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline cursor-pointer"
                        >
                          <ImageIcon className="w-3.5 h-3.5" /> ดู
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.orders.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ยังไม่มีคำสั่งซื้อ</p>}
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className={`${card} overflow-hidden`}>
            <div className="p-4 border-b border-slate-800 font-semibold text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-400" /> สินค้า
            </div>
            <ul className="divide-y divide-slate-800 text-sm">
              {data.products.map((p) => (
                <li key={p.id} className="p-4 flex justify-between gap-3">
                  <span className="truncate">{p.name}</span>
                  <span className="font-semibold text-brand-400 shrink-0">{formatBaht(p.price)}</span>
                </li>
              ))}
            </ul>
            {data.products.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ยังไม่มีสินค้า</p>}
          </section>

          <section className={`${card} overflow-hidden`}>
            <div className="p-4 border-b border-slate-800 font-semibold text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" /> ประวัติจากผู้ดูแลระบบ
            </div>
            <AuditList entries={data.audit} showShop={false} />
          </section>
        </div>
      </main>

      {suspendOpen && (
        <div
          onClick={() => !saving && setSuspendOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50"
        >
          <div onClick={(e) => e.stopPropagation()} className={`${card} glass-dialog p-6 max-w-sm w-full`}>
            <h3 className="text-base font-bold flex items-center gap-2">
              <Store className="w-4 h-4" />
              {shop.suspended_at ? 'ยกเลิกการระงับร้าน?' : `ระงับร้าน ${shop.shop_name}?`}
            </h3>
            {shop.suspended_at ? (
              <p className="text-sm text-slate-400 mt-2">ร้านจะกลับมาแสดงหน้าร้านและรับคำสั่งซื้อได้ตามปกติ</p>
            ) : (
              <>
                <p className="text-sm text-slate-400 mt-2">หน้าร้านจะแสดงว่าปิดให้บริการชั่วคราว และลูกค้าสั่งซื้อไม่ได้</p>
                <label className="block text-xs text-slate-400 mt-4 mb-1">เหตุผล (เจ้าของร้านจะเห็น)</label>
                <textarea
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="เช่น ขายสินค้าผิดเงื่อนไข"
                  className={`${inputClass} resize-none`}
                />
              </>
            )}
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setSuspendOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={() =>
                  patch(
                    { suspended: !shop.suspended_at, reason: suspendReason },
                    shop.suspended_at ? 'ยกเลิกการระงับแล้ว' : 'ระงับร้านแล้ว'
                  ).then((ok) => ok && setSuspendOpen(false))
                }
                disabled={saving}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer ${
                  shop.suspended_at ? 'btn-primary' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {saving ? 'กำลังบันทึก...' : shop.suspended_at ? 'ยกเลิกระงับ' : 'ระงับร้าน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(null)} className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div onClick={(e) => e.stopPropagation()} className={`${card} glass-dialog p-4 max-w-md w-full relative`}>
            <button onClick={() => setPreview(null)} aria-label="ปิด" className="absolute top-3 right-3 text-slate-400 hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold mb-3">สลิปการโอนเงิน</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="สลิปการโอนเงิน" className="w-full max-h-[70vh] object-contain rounded-lg bg-slate-950" />
          </div>
        </div>
      )}
    </div>
  );
}
