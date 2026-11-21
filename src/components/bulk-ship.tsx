'use client';

import { useRef, useState } from 'react';
import { ScanLine, Truck, X } from 'lucide-react';
import { CARRIERS } from '@/lib/order-stages';

type ShipOrder = { id: string; order_number: string; customer_name?: string | null; item_title: string; carrier?: string | null; tracking_number?: string | null };

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

// ใส่เลขพัสดุทีละหลายออเดอร์: พิมพ์หรือยิงบาร์โค้ดต่อกันได้ (กด Enter = ไปช่องถัดไป)
export function BulkShipDialog<T extends ShipOrder>({
  orders,
  onClose,
  onSaved,
  notify,
}: {
  orders: T[];
  onClose: () => void;
  onSaved: (orders: T[]) => void;
  notify: (kind: 'ok' | 'error', text: string) => void;
}) {
  const [carrier, setCarrier] = useState(orders.find((o) => o.carrier)?.carrier ?? '');
  const [numbers, setNumbers] = useState<Record<string, string>>(
    Object.fromEntries(orders.map((o) => [o.id, o.tracking_number ?? '']))
  );
  const [saving, setSaving] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const filled = orders.filter((o) => numbers[o.id]?.trim()).length;

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/orders/ship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: orders.map((o) => ({ id: o.id, carrier, tracking_number: numbers[o.id] ?? '' })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      onSaved(data.orders);
      notify(
        data.error ? 'error' : 'ok',
        data.error ? `บันทึกได้ ${data.orders.length} รายการ บางรายการไม่สำเร็จ: ${data.error}` : `จัดส่งแล้ว ${data.orders.length} รายการ ลูกค้าเห็นเลขพัสดุในหน้าติดตาม`
      );
      onClose();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="glass glass-dialog rounded-2xl p-5 w-full max-w-lg space-y-4 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start gap-2">
          <p className="font-semibold flex items-center gap-1.5 flex-1">
            <Truck className="w-4 h-4 text-brand-400" /> ใส่เลขพัสดุ ({orders.length} ออเดอร์)
          </p>
          <button type="button" onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-ink cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="bulk-carrier" className="text-xs text-slate-400 block mb-1">
            บริษัทขนส่ง (ใช้กับทุกรายการ)
          </label>
          <select id="bulk-carrier" required value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
            <option value="">เลือกขนส่ง</option>
            {CARRIERS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <ScanLine className="w-3.5 h-3.5" /> พิมพ์หรือยิงบาร์โค้ดเลขพัสดุทีละกล่อง กด Enter เพื่อไปรายการถัดไป ช่องที่เว้นว่างจะข้ามไป
        </p>

        <div className="space-y-2 overflow-y-auto flex-1 -mx-1 px-1">
          {orders.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2">
              <span className="w-36 shrink-0 text-xs">
                <span className="block font-mono font-semibold">{o.order_number}</span>
                <span className="block text-slate-500 truncate">{o.customer_name || o.item_title}</span>
              </span>
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                aria-label={`เลขพัสดุ ${o.order_number}`}
                autoFocus={i === 0}
                maxLength={60}
                placeholder="เลขพัสดุ"
                value={numbers[o.id] ?? ''}
                onChange={(e) => setNumbers((n) => ({ ...n, [o.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && i < orders.length - 1) {
                    e.preventDefault();
                    inputs.current[i + 1]?.focus();
                  }
                }}
                className={`${inputClass} font-mono`}
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving || filled === 0}
          className="text-white w-full py-2.5 btn-primary disabled:opacity-50 text-sm font-semibold rounded-xl cursor-pointer"
        >
          {saving ? 'กำลังบันทึก...' : `บันทึกและแจ้งลูกค้า (${filled} รายการ)`}
        </button>
      </form>
    </div>
  );
}
