'use client';

import { useState } from 'react';
import { Plus, Save, Trash2, Truck } from 'lucide-react';
import { MAX_METHODS, readShipping } from '@/lib/shipping';

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

type MethodRow = { name: string; fee: string; pickup: boolean };

const PRESETS: MethodRow[] = [
  { name: 'ส่งธรรมดา', fee: '40', pickup: false },
  { name: 'EMS / ส่งด่วน', fee: '60', pickup: false },
  { name: 'รับเองที่ร้าน', fee: '0', pickup: true },
];

// ตั้งค่าวิธีจัดส่ง ค่าส่ง และที่อยู่ผู้ส่ง (ใช้พิมพ์ใบจ่าหน้า)
export function ShippingSettings<T extends { shipping?: unknown }>({
  shop,
  onShopChange,
  notify,
}: {
  shop: T;
  onShopChange: (next: Partial<T>) => void;
  notify: (kind: 'ok' | 'error', text: string) => void;
}) {
  const initial = readShipping(shop.shipping);
  const [methods, setMethods] = useState<MethodRow[]>(
    initial?.methods.map((m) => ({ name: m.name, fee: String(m.fee), pickup: m.pickup })) ?? []
  );
  const [extra, setExtra] = useState(initial?.extra_per_item ? String(initial.extra_per_item) : '');
  const [freeOver, setFreeOver] = useState(initial?.free_over != null ? String(initial.free_over) : '');
  const [sender, setSender] = useState({
    sender_name: initial?.sender_name ?? '',
    sender_phone: initial?.sender_phone ?? '',
    sender_address: initial?.sender_address ?? '',
  });
  const [saving, setSaving] = useState(false);

  const update = (i: number, patch: Partial<MethodRow>) =>
    setMethods((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/shop/shipping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methods: methods.map((m) => ({ name: m.name, fee: m.pickup ? 0 : Number(m.fee || 0), pickup: m.pickup })),
          extra_per_item: extra ? Number(extra) : 0,
          free_over: freeOver ? Number(freeOver) : null,
          ...sender,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      onShopChange({ shipping: data.shop.shipping } as Partial<T>);
      notify('ok', 'บันทึกการจัดส่งแล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
        <Truck className="w-4 h-4 text-brand-400" /> การจัดส่งและค่าส่ง
      </div>

      <div className="space-y-2">
        <p className="text-xs text-slate-400 leading-relaxed">
          ตั้งราคาค่าส่งเอง ระบบจะบวกค่าส่งให้ลูกค้าและรวมในยอด QR อัตโนมัติ ถ้าไม่ตั้ง หน้าร้านจะทำงานแบบเดิม
          (ค่าส่งรวมในราคาสินค้าแล้ว)
        </p>
        {methods.map((m, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              aria-label="ชื่อวิธีจัดส่ง"
              required
              maxLength={40}
              placeholder="เช่น ส่งธรรมดา"
              value={m.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className={`${inputClass} min-w-0 flex-1`}
            />
            <div className="w-24 shrink-0">
              <input
                aria-label="ค่าส่ง (บาท)"
                type="number"
                min="0"
                step="0.01"
                required={!m.pickup}
                disabled={m.pickup}
                placeholder="฿"
                value={m.pickup ? '0' : m.fee}
                onChange={(e) => update(i, { fee: e.target.value })}
                className={`${inputClass} disabled:opacity-50`}
              />
            </div>
            <label className="flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap cursor-pointer">
              <input type="checkbox" checked={m.pickup} onChange={(e) => update(i, { pickup: e.target.checked })} />
              รับเอง
            </label>
            <button
              type="button"
              onClick={() => setMethods((prev) => prev.filter((_, j) => j !== i))}
              aria-label="ลบวิธีจัดส่ง"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {methods.length < MAX_METHODS && (
            <button
              type="button"
              onClick={() => setMethods((prev) => [...prev, { name: '', fee: '', pickup: false }])}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มวิธีจัดส่ง
            </button>
          )}
          {methods.length === 0 && (
            <button
              type="button"
              onClick={() => setMethods(PRESETS)}
              className="text-xs px-3 py-1.5 rounded-lg text-brand-400 hover:bg-brand-500/10 cursor-pointer"
            >
              ใช้ตัวอย่าง (ธรรมดา 40 / EMS 60 / รับเอง)
            </button>
          )}
        </div>
      </div>

      {methods.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ship-extra" className="text-xs text-slate-400 block mb-1">
              ชิ้นถัดไปบวกเพิ่มชิ้นละ (฿)
            </label>
            <input
              id="ship-extra"
              type="number"
              min="0"
              step="0.01"
              placeholder="0 = ไม่บวก"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="ship-free" className="text-xs text-slate-400 block mb-1">
              ส่งฟรีเมื่อซื้อครบ (฿)
            </label>
            <input
              id="ship-free"
              type="number"
              min="1"
              step="0.01"
              placeholder="เว้นว่าง = ไม่มี"
              value={freeOver}
              onChange={(e) => setFreeOver(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-800 pt-4">
        <p className="text-xs font-medium text-slate-300">ผู้ส่ง (พิมพ์บนใบจ่าหน้า)</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            aria-label="ชื่อผู้ส่ง"
            maxLength={100}
            placeholder="ชื่อผู้ส่ง / ชื่อร้าน"
            value={sender.sender_name}
            onChange={(e) => setSender((s) => ({ ...s, sender_name: e.target.value }))}
            className={inputClass}
          />
          <input
            aria-label="เบอร์โทรผู้ส่ง"
            maxLength={30}
            inputMode="tel"
            placeholder="เบอร์โทร"
            value={sender.sender_phone}
            onChange={(e) => setSender((s) => ({ ...s, sender_phone: e.target.value }))}
            className={inputClass}
          />
        </div>
        <textarea
          aria-label="ที่อยู่ผู้ส่ง"
          rows={2}
          maxLength={300}
          placeholder="ที่อยู่ผู้ส่ง รวมรหัสไปรษณีย์"
          value={sender.sender_address}
          onChange={(e) => setSender((s) => ({ ...s, sender_address: e.target.value }))}
          className={`${inputClass} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" /> {saving ? 'กำลังบันทึก...' : 'บันทึกการจัดส่ง'}
      </button>
    </form>
  );
}
