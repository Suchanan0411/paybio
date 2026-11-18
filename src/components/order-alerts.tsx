'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellRing, X } from 'lucide-react';
import type { SlipCheck } from '@/lib/slip-check';

type AlertOrder = {
  id: string;
  order_number: string;
  item_title: string;
  amount: number;
  slip_check?: SlipCheck | null;
};

type Alert = { key: string; orderId: string; title: string; body: string; tone: 'info' | 'pass' | 'warn' | 'fail' };

const POLL_MS = 20_000;

const VERDICT: Record<SlipCheck['verdict'], { text: string; tone: Alert['tone'] }> = {
  pass: { text: '✅ สลิปผ่านการตรวจ', tone: 'pass' },
  warn: { text: '⚠️ สลิปควรตรวจซ้ำ', tone: 'warn' },
  fail: { text: '❌ สลิปไม่ผ่านการตรวจ', tone: 'fail' },
  unchecked: { text: '🔎 ตรวจยอดเงินในแอปธนาคารก่อนอนุมัติ', tone: 'info' },
};

const TONE: Record<Alert['tone'], string> = {
  info: 'border-slate-700',
  pass: 'border-brand-500/50',
  warn: 'border-amber-500/50',
  fail: 'border-rose-500/50',
};

const baht = (n: number) => `฿${Number(n).toLocaleString('th-TH')}`;

function slipAlert(o: AlertOrder): Alert {
  const check = o.slip_check!;
  const v = VERDICT[check.verdict];
  const problem = check.checks.find((c) => c.status === 'fail') ?? check.checks.find((c) => c.status === 'warn');
  return {
    key: `slip-${o.id}-${check.checked_at}`,
    orderId: o.id,
    title: `${v.text} · ${o.order_number}`,
    body: [
      check.bank ? `ยอดตามธนาคาร ${baht(check.bank.amount)}` :`${o.item_title} · ${baht(o.amount)}`,
      problem && `${problem.label}${problem.detail ? `: ${problem.detail}` : ''}`,
    ]
      .filter(Boolean)
      .join(' · '),
    tone: v.tone,
  };
}

/**
 * แจ้งเตือนในแผงร้าน (ทุกแพ็กเกจ): ดึงออเดอร์ทุก 20 วินาทีขณะเปิดหน้าอยู่
 * แจ้งเมื่อมีออเดอร์ใหม่ และเมื่อผลตรวจสลิปเสร็จ (ตรวจหลังลูกค้าส่งสลิปไม่กี่วินาที) พร้อมแจ้งเตือนบนเบราว์เซอร์ถ้าอนุญาต
 */
export function OrderAlerts<T extends AlertOrder>({
  orders,
  fetchOrders,
  onOrders,
  onOpen,
}: {
  orders: T[];
  fetchOrders: () => Promise<T[]>;
  onOrders: (orders: T[]) => void;
  onOpen: (order: T) => void;
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  // แสดงหลังโหลดข้อมูลฝั่งเบราว์เซอร์แล้วเท่านั้น จึงอ่าน Notification ตอนเริ่มได้
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  // order id → checked_at ของผลตรวจล่าสุด (ต้อง mount หลังโหลดออเดอร์ชุดแรกแล้ว จะได้ไม่แจ้งของเก่า)
  const known = useRef<Map<string, string | null> | null>(null);
  const latest = useRef(orders);

  // ออเดอร์ล่าสุดสำหรับปุ่ม "ดูสลิป" + ออเดอร์ที่ร้านกดตรวจซ้ำเองในหน้านี้ไม่ต้องแจ้งซ้ำ
  useEffect(() => {
    latest.current = orders;
    known.current ??= new Map();
    for (const o of orders) known.current.set(o.id, o.slip_check?.checked_at ?? null);
  }, [orders]);

  const push = useCallback((list: Alert[]) => {
    if (!list.length) return;
    setAlerts((prev) => [...list, ...prev.filter((a) => !list.some((n) => n.key === a.key))].slice(0, 5));
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      for (const a of list.slice(0, 3)) {
        try {
          new Notification(a.title, { body: a.body, tag: a.key, icon: '/icon.svg' });
        } catch {
          // บางเบราว์เซอร์ (มือถือ) สร้าง Notification ตรงๆ ไม่ได้
        }
      }
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden && typeof Notification !== 'undefined' && Notification.permission !== 'granted') return;
      let fresh: T[];
      try {
        fresh = await fetchOrders();
      } catch {
        return;
      }
      if (stopped) return;
      const seen = known.current ?? new Map();
      const found: Alert[] = [];
      for (const o of fresh) {
        const checkedAt = o.slip_check?.checked_at ?? null;
        if (!seen.has(o.id)) {
          // ออเดอร์ใหม่: ถ้าตรวจสลิปเสร็จแล้วแจ้งผลเลย ไม่งั้นแจ้งออเดอร์ใหม่ แล้วแจ้งผลตรวจรอบถัดไป
          found.push(
            o.slip_check
              ? { ...slipAlert(o), title: `🛒 ออเดอร์ใหม่ ${o.order_number} · ${VERDICT[o.slip_check.verdict].text}` }
              : { key: `new-${o.id}`, orderId: o.id, title: `🛒 ออเดอร์ใหม่ ${o.order_number}`, body: `${o.item_title} · ${baht(o.amount)} · กำลังตรวจสลิป...`, tone: 'info' }
          );
        } else if (checkedAt && seen.get(o.id) !== checkedAt) {
          found.push(slipAlert(o));
        }
        seen.set(o.id, checkedAt);
      }
      known.current = seen;
      if (found.length) {
        onOrders(fresh);
        push(found);
      }
    };
    const timer = setInterval(tick, POLL_MS);
    const onVisible = () => !document.hidden && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchOrders, onOrders, push]);

  const askPermission = async () => {
    if (typeof Notification === 'undefined') return;
    setPermission(await Notification.requestPermission());
  };

  return (
    <>
      {permission === 'default' && (
        <button
          type="button"
          onClick={askPermission}
          className="w-full mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-500/30 bg-brand-500/5 text-xs text-slate-300 hover:bg-brand-500/10 transition cursor-pointer"
        >
          <BellRing className="w-4 h-4 text-brand-400 shrink-0" />
          <span className="text-left">เปิดแจ้งเตือนบนเบราว์เซอร์ — รู้ทันทีเมื่อมีออเดอร์ใหม่และผลตรวจสลิป แม้สลับไปแท็บอื่น</span>
          <span className="ml-auto text-brand-400 font-semibold shrink-0">เปิด</span>
        </button>
      )}

      {alerts.length > 0 && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2" role="status" aria-live="polite">
          {alerts.map((a) => (
            <div
              key={a.key}
              className={`bg-slate-900 border ${TONE[a.tone]} rounded-xl shadow-2xl p-3 flex gap-2 items-start`}
            >
              <Bell className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <button
                type="button"
                className="text-left min-w-0 flex-1 cursor-pointer"
                onClick={() => {
                  const order = latest.current.find((o) => o.id === a.orderId);
                  if (order) onOpen(order);
                  setAlerts((prev) => prev.filter((x) => x.key !== a.key));
                }}
              >
                <p className="text-sm font-semibold text-ink">{a.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 break-words">{a.body}</p>
                <p className="text-[11px] text-brand-400 mt-1">ดูสลิป</p>
              </button>
              <button
                type="button"
                aria-label="ปิดการแจ้งเตือน"
                onClick={() => setAlerts((prev) => prev.filter((x) => x.key !== a.key))}
                className="p-1 rounded-lg text-slate-500 hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
