'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Users,
  Receipt,
  RefreshCw,
  LogOut,
  ExternalLink,
  Search,
  ShieldCheck,
  Image as ImageIcon,
  X,
  Ban,
  CircleCheck,
  BarChart3,
  ShieldAlert,
  History,
  Wallet,
  Settings2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';
import type { Plan } from '@/lib/plans';
import { AuditTab } from './audit-tab';
import { ReportsTab } from './reports-tab';
import { SlipsTab } from './slips-tab';
import { BillingTab } from './billing-tab';
import { card, formatBaht, formatDate, PlanBadge, STATUS_LABEL, STATUS_STYLE, td, th } from './shared';

type Stats = { shops: number; suspended: number; users: number; orders: number; pending: number; paid_total: number };
type ShopRow = {
  id: string;
  shop_name: string;
  slug: string;
  promptpay_number: string;
  created_at: string;
  plan: Plan;
  plan_raw: string;
  plan_expires_at: string | null;
  custom_domain: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  owner_email: string | null;
  product_count: number;
  order_count: number;
  pending_count: number;
  paid_total: number;
};
type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  provider: string;
  is_admin: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  shop_name: string | null;
};
type OrderRow = {
  id: string;
  order_number: string;
  item_title: string;
  amount: number;
  slip_url: string | null;
  status: 'pending' | 'paid' | 'rejected';
  created_at: string;
  shop_name: string | null;
};
type AdminData = { stats: Stats; shops: ShopRow[]; users: UserRow[]; orders: OrderRow[] };
type Tab = 'overview' | 'shops' | 'users' | 'orders' | 'billing' | 'reports' | 'slips' | 'audit';

const TABS: { key: Tab; label: string; Icon: typeof Store }[] = [
  { key: 'overview', label: 'ภาพรวม', Icon: LayoutDashboard },
  { key: 'shops', label: 'ร้านค้า', Icon: Store },
  { key: 'users', label: 'ผู้ใช้', Icon: Users },
  { key: 'orders', label: 'คำสั่งซื้อ', Icon: Receipt },
  { key: 'billing', label: 'ค่าแพ็กเกจ', Icon: Wallet },
  { key: 'reports', label: 'รายงาน', Icon: BarChart3 },
  { key: 'slips', label: 'สลิปน่าสงสัย', Icon: ShieldAlert },
  { key: 'audit', label: 'ประวัติแอดมิน', Icon: History },
];

// แท็บที่มีช่องค้นหา (กรองข้อมูลจาก /api/admin)
const SEARCHABLE: Tab[] = ['shops', 'users', 'orders'];

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<AdminData | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ShopRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [savingSuspend, setSavingSuspend] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin', { cache: 'no-store' });
    if (res.status === 401) {
      router.replace('/login');
      return;
    }
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ');
    setData(json);
    setError(null);
  }, [router]);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/me', { cache: 'no-store' });
        if (me.ok) setEmail((await me.json()).user?.email ?? null);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setRefreshing(false);
    }
  };

  const openSuspend = (shop: ShopRow) => {
    setSuspendTarget(shop);
    setSuspendReason('');
    setSuspendError(null);
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    const suspend = !suspendTarget.suspended_at;
    setSavingSuspend(true);
    setSuspendError(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_id: suspendTarget.id, suspended: suspend, reason: suspendReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'บันทึกไม่สำเร็จ');

      setData((prev) =>
        prev && {
          ...prev,
          stats: { ...prev.stats, suspended: prev.stats.suspended + (suspend ? 1 : -1) },
          shops: prev.shops.map((s) =>
            s.id === suspendTarget.id
              ? { ...s, suspended_at: json.shop.suspended_at, suspended_reason: json.shop.suspended_reason }
              : s
          ),
        }
      );
      setSuspendTarget(null);
    } catch (err) {
      setSuspendError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingSuspend(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        กำลังโหลดแผงผู้ดูแลระบบ...
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4 text-center">
        <ShieldCheck className="w-10 h-10 text-slate-500 mb-3" />
        <h1 className="text-xl font-bold">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="text-sm text-slate-400 mt-1 mb-5">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
        <div className="flex gap-2">
          <Link href="/manage" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium">
            ไปหน้าจัดการร้าน
          </Link>
          <button onClick={handleLogout} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm cursor-pointer">
            ออกจากระบบ
          </button>
        </div>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const match = (...fields: (string | null | undefined)[]) =>
    !q || fields.some((f) => f?.toLowerCase().includes(q));

  const shops = data?.shops.filter((s) => match(s.shop_name, s.slug, s.owner_email)) ?? [];
  const users = data?.users.filter((u) => match(u.email, u.name, u.shop_name, u.provider)) ?? [];
  const orders = data?.orders.filter((o) => match(o.order_number, o.item_title, o.shop_name)) ?? [];

  const stats = data
    ? [
        { label: 'ร้านค้าทั้งหมด', value: data.stats.shops.toLocaleString('th-TH') },
        { label: 'ร้านที่ถูกระงับ', value: data.stats.suspended.toLocaleString('th-TH'), accent: 'text-rose-400' },
        { label: 'ผู้ใช้ทั้งหมด', value: data.stats.users.toLocaleString('th-TH') },
        { label: 'คำสั่งซื้อทั้งหมด', value: data.stats.orders.toLocaleString('th-TH') },
        { label: 'รอตรวจสอบสลิป', value: data.stats.pending.toLocaleString('th-TH'), accent: 'text-amber-400' },
        { label: 'ยอดชำระแล้วรวม', value: formatBaht(data.stats.paid_total), accent: 'text-brand-400' },
      ]
    : [];

  const shopsTable = (rows: ShopRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400 bg-slate-800/40">
          <tr>
            <th className={th}>ร้านค้า</th>
            <th className={th}>เจ้าของ</th>
            <th className={th}>สถานะ</th>
            <th className={th}>แพ็กเกจ</th>
            <th className={`${th} text-right`}>สินค้า</th>
            <th className={`${th} text-right`}>คำสั่งซื้อ</th>
            <th className={`${th} text-right`}>ยอดชำระแล้ว</th>
            <th className={th}>สร้างเมื่อ</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-slate-800/30">
              <td className={td}>
                <Link href={`/admin/shops/${s.id}`} className="font-medium hover:text-brand-400">
                  {s.shop_name}
                </Link>
                <p className="text-xs text-slate-500 font-mono">/{s.slug}</p>
              </td>
              <td className={`${td} text-xs`}>
                {s.owner_email ?? <span className="text-slate-500">ไม่มีเจ้าของ</span>}
              </td>
              <td className={td}>
                {s.suspended_at ? (
                  <span
                    title={s.suspended_reason ? `เหตุผล: ${s.suspended_reason}` : undefined}
                    className="text-xs px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/30"
                  >
                    ถูกระงับ
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-brand-500/10 text-brand-400 border-brand-500/30">
                    เปิดอยู่
                  </span>
                )}
              </td>
              <td className={td}>
                <PlanBadge plan={s.plan} planRaw={s.plan_raw} expiresAt={s.plan_expires_at} />
                {s.custom_domain && <p className="text-[10px] text-slate-500 font-mono mt-1">{s.custom_domain}</p>}
              </td>
              <td className={`${td} text-right`}>{s.product_count}</td>
              <td className={`${td} text-right`}>
                {s.order_count}
                {s.pending_count > 0 && <span className="ml-1 text-xs text-amber-400">({s.pending_count} รอ)</span>}
              </td>
              <td className={`${td} text-right font-semibold text-brand-400`}>{formatBaht(s.paid_total)}</td>
              <td className={`${td} text-xs text-slate-400`}>{formatDate(s.created_at)}</td>
              <td className={td}>
                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={`/admin/shops/${s.id}`}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-brand-400"
                  >
                    <Settings2 className="w-3.5 h-3.5" /> จัดการ
                  </Link>
                  <Link
                    href={`/${s.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline"
                  >
                    หน้าร้าน <ExternalLink className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => openSuspend(s)}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                      s.suspended_at
                        ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                        : 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                    }`}
                  >
                    {s.suspended_at ? <CircleCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                    {s.suspended_at ? 'ยกเลิกระงับ' : 'ระงับ'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ไม่พบร้านค้า</p>}
    </div>
  );

  const ordersTable = (rows: OrderRow[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400 bg-slate-800/40">
          <tr>
            <th className={th}>รหัส</th>
            <th className={th}>ร้านค้า</th>
            <th className={th}>สินค้า</th>
            <th className={`${th} text-right`}>ยอด</th>
            <th className={th}>สถานะ</th>
            <th className={th}>วันที่</th>
            <th className={th}>สลิป</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-slate-800/30">
              <td className={`${td} font-mono text-xs`}>{o.order_number}</td>
              <td className={td}>{o.shop_name ?? <span className="text-slate-500">ร้านตัวอย่าง</span>}</td>
              <td className={td}>{o.item_title}</td>
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
                    onClick={() => setPreviewUrl(`/api/orders/slip?id=${o.id}`)}
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
      {rows.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ไม่พบคำสั่งซื้อ</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-ink">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="PayBio หน้าแรก">
              <Logo size="sm" />
            </Link>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="hidden sm:block text-xs text-slate-400 truncate">{email}</span>
            <button
              onClick={handleLogout}
              title="ออกจากระบบ"
              className="p-2 rounded-lg text-slate-400 hover:text-ink hover:bg-slate-800 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">แผงผู้ดูแลระบบ</h1>
            <p className="text-sm text-slate-400 mt-1">ภาพรวมร้านค้า ผู้ใช้ คำสั่งซื้อ รายงาน และประวัติการดูแลระบบ</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-xl border border-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> รีเฟรช
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>
        )}

        <nav className="flex gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 min-w-fit flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                tab === key ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-ink hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </nav>

        {SEARCHABLE.includes(tab) && (
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        )}

        {tab === 'overview' && data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {stats.map((s) => (
                <div key={s.label} className={`${card} p-4`}>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold mt-1 ${s.accent ?? ''}`}>{s.value}</p>
                </div>
              ))}
            </div>
            <div className={`${card} overflow-hidden`}>
              <div className="p-4 border-b border-slate-800 font-semibold text-sm flex justify-between">
                <span>คำสั่งซื้อล่าสุด</span>
                <button onClick={() => setTab('orders')} className="text-xs text-brand-400 hover:underline cursor-pointer">
                  ดูทั้งหมด
                </button>
              </div>
              {ordersTable(data.orders.slice(0, 5))}
            </div>
            <div className={`${card} overflow-hidden`}>
              <div className="p-4 border-b border-slate-800 font-semibold text-sm flex justify-between">
                <span>ร้านค้าล่าสุด</span>
                <button onClick={() => setTab('shops')} className="text-xs text-brand-400 hover:underline cursor-pointer">
                  ดูทั้งหมด
                </button>
              </div>
              {shopsTable(data.shops.slice(0, 5))}
            </div>
          </>
        )}

        {tab === 'shops' && <div className={`${card} overflow-hidden`}>{shopsTable(shops)}</div>}

        {tab === 'orders' && <div className={`${card} overflow-hidden`}>{ordersTable(orders)}</div>}

        {tab === 'reports' && <ReportsTab />}

        {tab === 'slips' && <SlipsTab onPreview={setPreviewUrl} />}

        {tab === 'billing' && <BillingTab onPreview={setPreviewUrl} />}

        {tab === 'audit' && <AuditTab />}

        {tab === 'users' && (
          <div className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400 bg-slate-800/40">
                  <tr>
                    <th className={th}>ผู้ใช้</th>
                    <th className={th}>เข้าสู่ระบบด้วย</th>
                    <th className={th}>ร้านค้า</th>
                    <th className={th}>สมัครเมื่อ</th>
                    <th className={th}>เข้าใช้ล่าสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30">
                      <td className={td}>
                        <p className="font-medium flex items-center gap-1.5">
                          {u.name || u.email}
                          {u.is_admin && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              Admin
                            </span>
                          )}
                        </p>
                        {u.name && <p className="text-xs text-slate-500">{u.email}</p>}
                      </td>
                      <td className={`${td} text-xs capitalize`}>{u.provider}</td>
                      <td className={td}>{u.shop_name ?? <span className="text-xs text-slate-500">-</span>}</td>
                      <td className={`${td} text-xs text-slate-400`}>{formatDate(u.created_at)}</td>
                      <td className={`${td} text-xs text-slate-400`}>{formatDate(u.last_sign_in_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className="p-6 text-center text-xs text-slate-500">ไม่พบผู้ใช้</p>}
            </div>
          </div>
        )}
      </main>

      {suspendTarget && (
        <div
          onClick={() => !savingSuspend && setSuspendTarget(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div onClick={(e) => e.stopPropagation()} className={`${card} p-6 max-w-sm w-full`}>
            {suspendTarget.suspended_at ? (
              <>
                <h3 className="text-base font-bold">ยกเลิกการระงับร้าน?</h3>
                <p className="text-sm text-slate-400 mt-2">
                  <span className="text-ink font-medium">{suspendTarget.shop_name}</span> จะกลับมาแสดงหน้าร้านและรับคำสั่งซื้อได้ตามปกติ
                </p>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold">ระงับร้าน {suspendTarget.shop_name}?</h3>
                <p className="text-sm text-slate-400 mt-2">
                  หน้าร้านจะแสดงว่าปิดให้บริการชั่วคราว ลูกค้าสั่งซื้อไม่ได้ และเจ้าของร้านจะเห็นแจ้งเตือนในหน้าจัดการร้าน
                </p>
                <label className="block text-xs text-slate-400 mt-4 mb-1">เหตุผล (เจ้าของร้านจะเห็น)</label>
                <textarea
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="เช่น ขายสินค้าผิดเงื่อนไข"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none"
                />
              </>
            )}

            {suspendError && <p className="mt-3 text-xs text-red-400">{suspendError}</p>}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setSuspendTarget(null)}
                disabled={savingSuspend}
                className="px-4 py-2 rounded-xl text-sm bg-slate-800 hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmSuspend}
                disabled={savingSuspend}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 cursor-pointer ${
                  suspendTarget.suspended_at ? 'bg-brand-500 hover:bg-brand-600' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {savingSuspend ? 'กำลังบันทึก...' : suspendTarget.suspended_at ? 'ยกเลิกระงับ' : 'ระงับร้าน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <div onClick={(e) => e.stopPropagation()} className={`${card} p-4 max-w-md w-full relative`}>
            <button onClick={() => setPreviewUrl(null)} className="absolute top-3 right-3 text-slate-400 hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-semibold mb-3">สลิปการโอนเงิน</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="สลิปการโอนเงิน" className="w-full max-h-[70vh] object-contain rounded-lg bg-slate-950" />
          </div>
        </div>
      )}
    </div>
  );
}
