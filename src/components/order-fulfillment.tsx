'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Package, Save, Truck, X } from 'lucide-react';
import { CARRIERS, FULFILLMENTS, FULFILLMENT_LABEL, type Fulfillment, type OrderStatus } from '@/lib/order-stages';

export type FulfillmentOrder = {
  id: string;
  order_number: string;
  item_title: string;
  status: OrderStatus;
  fulfillment?: Fulfillment | null;
  carrier?: string | null;
  tracking_number?: string | null;
  shop_message?: string | null;
  customer_email?: string | null;
  track_token?: string | null;
};

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

// หน้าต่างอัปเดตการจัดส่งให้ลูกค้าเห็น: ขั้นตอน, เลขพัสดุ, ข้อความจากร้าน
export function OrderFulfillmentDialog<T extends FulfillmentOrder>({
  order,
  emailEnabled,
  onClose,
  onSaved,
  notify,
}: {
  order: T;
  emailEnabled: boolean;
  onClose: () => void;
  onSaved: (order: T) => void;
  notify: (kind: 'ok' | 'error', text: string) => void;
}) {
  const paid = order.status === 'paid';
  const [fulfillment, setFulfillment] = useState<Fulfillment | ''>(order.fulfillment ?? '');
  const [carrier, setCarrier] = useState(order.carrier ?? '');
  const [trackingNumber, setTrackingNumber] = useState(order.tracking_number ?? '');
  const [message, setMessage] = useState(order.shop_message ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Record<string, unknown> = { id: order.id, shop_message: message };
      if (paid) Object.assign(body, { fulfillment: fulfillment || null, carrier: carrier || null, tracking_number: trackingNumber });
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      onSaved(data.order);
      notify('ok', order.customer_email && emailEnabled ? 'บันทึกแล้ว และแจ้งลูกค้าทางอีเมล' : 'บันทึกแล้ว ลูกค้าเห็นในหน้าติดตาม');
      onClose();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <p className="font-semibold flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-brand-400" /> อัปเดตให้ลูกค้า · {order.order_number}
            </p>
            <p className="text-xs text-slate-400 truncate mt-0.5">{order.item_title}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="ml-auto text-slate-400 hover:text-ink cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {paid ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> ขั้นตอนการจัดส่ง
              </legend>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['', ...FULFILLMENTS] as const).map((f) => (
                  <label
                    key={f || 'paid'}
                    className={`px-3 py-2 rounded-xl border cursor-pointer text-center transition ${
                      fulfillment === f ? 'border-brand-500 bg-brand-500/10 text-ink' : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="fulfillment"
                      value={f}
                      checked={fulfillment === f}
                      onChange={() => setFulfillment(f)}
                      className="sr-only"
                    />
                    {f ? FULFILLMENT_LABEL[f] : 'ชำระแล้ว (ยังไม่เริ่ม)'}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-[2fr_3fr] gap-2">
              <div>
                <label htmlFor="carrier" className="text-xs text-slate-400 block mb-1">
                  ขนส่ง
                </label>
                <select id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
                  <option value="">ไม่ระบุ</option>
                  {CARRIERS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tracking-number" className="text-xs text-slate-400 block mb-1">
                  เลขพัสดุ
                </label>
                <input
                  id="tracking-number"
                  value={trackingNumber}
                  onChange={(e) => {
                    setTrackingNumber(e.target.value.toUpperCase());
                    if (e.target.value && fulfillment !== 'delivered') setFulfillment('shipped');
                  }}
                  maxLength={60}
                  placeholder="เช่น EF123456789TH"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 bg-slate-800/50 rounded-xl p-3">
            {order.status === 'pending'
              ? 'อนุมัติการชำระเงินก่อน จึงจะอัปเดตการจัดส่งและเลขพัสดุได้ ตอนนี้ส่งข้อความถึงลูกค้าได้'
              : 'คำสั่งซื้อนี้ถูกปฏิเสธ เขียนเหตุผลหรือวิธีติดต่อกลับให้ลูกค้าได้ด้านล่าง'}
          </p>
        )}

        <div>
          <label htmlFor="shop-message" className="text-xs text-slate-400 mb-1 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> ข้อความถึงลูกค้า
          </label>
          <textarea
            id="shop-message"
            rows={3}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={order.status === 'rejected' ? 'เช่น ยอดโอนไม่ครบ กรุณาโอนเพิ่ม 20 บาท แล้วทักไลน์ร้าน' : 'เช่น จะจัดส่งภายในวันพรุ่งนี้'}
            className={`${inputClass} resize-none`}
          />
        </div>

        <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
          <Mail className="w-3.5 h-3.5 shrink-0 mt-px" />
          {order.customer_email
            ? emailEnabled
              ? `ลูกค้าจะได้รับอีเมลแจ้งที่ ${order.customer_email}`
              : 'ลูกค้ากรอกอีเมลไว้ แต่ระบบยังไม่ได้ตั้งค่าการส่งอีเมล ลูกค้าจะเห็นในหน้าติดตามเท่านั้น'
            : 'ลูกค้าไม่ได้กรอกอีเมล จะเห็นการอัปเดตในหน้าติดตามคำสั่งซื้อ'}
        </p>

        <button
          type="submit"
          disabled={saving}
          className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-sm font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกและแจ้งลูกค้า'}
        </button>
      </form>
    </div>
  );
}
