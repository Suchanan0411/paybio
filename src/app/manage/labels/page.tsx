'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { readShipping } from '@/lib/shipping';

type LabelOrder = {
  id: string;
  order_number: string;
  item_title: string;
  customer_name?: string | null;
  customer_contact?: string | null;
  note?: string | null;
  shipping_method?: string | null;
  ship_phone?: string | null;
  ship_address?: string | null;
  ship_postcode?: string | null;
};
type Shop = { shop_name: string; shipping?: unknown };
type Size = 'a4' | 'thermal';

// ใบจ่าหน้าพัสดุ: A4 แผ่นละ 4 ใบ หรือ 100×150 มม. สำหรับเครื่องพิมพ์ความร้อน
export default function LabelsPage() {
  const [size, setSize] = useState<Size>('a4');
  const [shop, setShop] = useState<Shop | null>(null);
  const [orders, setOrders] = useState<LabelOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ids = new Set((params.get('ids') ?? '').split(',').filter(Boolean));
    (async () => {
      try {
        const [me, list] = await Promise.all([
          fetch('/api/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('กรุณาเข้าสู่ระบบ')))),
          fetch('/api/orders', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('โหลดออเดอร์ไม่สำเร็จ')))),
        ]);
        setSize(params.get('size') === 'thermal' ? 'thermal' : 'a4');
        setShop(me.shop);
        setOrders((list.orders as LabelOrder[]).filter((o) => ids.has(o.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
      }
    })();
  }, []);

  if (error) return <p className="p-8 text-sm">{error}</p>;
  if (!shop || !orders) return <p className="p-8 text-sm">กำลังเตรียมใบจ่าหน้า...</p>;

  const sender = readShipping(shop.shipping);
  const senderName = sender?.sender_name || shop.shop_name;
  const thermal = size === 'thermal';

  return (
    <div className="labels-root min-h-screen bg-zinc-200 text-black print:bg-white">
      <style>{`
        @page { size: ${thermal ? '100mm 150mm' : 'A4'}; margin: ${thermal ? '0' : '8mm'}; }
        @media print {
          html, body { background: #fff !important; }
          .no-print { display: none !important; }
          .labels-root { padding: 0 !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-zinc-300 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold">ใบจ่าหน้า {orders.length} ใบ</span>
        <div className="flex rounded-lg border border-zinc-300 overflow-hidden">
          {(['a4', 'thermal'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`px-3 py-1.5 cursor-pointer ${size === s ? 'bg-zinc-900 text-white' : 'bg-white hover:bg-zinc-100'}`}
            >
              {s === 'a4' ? 'A4 (4 ใบ/แผ่น)' : '100×150 มม.'}
            </button>
          ))}
        </div>
        {!sender?.sender_address && (
          <span className="text-amber-700 text-xs">ยังไม่ได้ตั้งที่อยู่ผู้ส่ง (ตั้งค่าร้าน › การจัดส่งและค่าส่ง)</span>
        )}
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
        >
          <Printer className="w-4 h-4" /> พิมพ์
        </button>
      </div>

      {orders.length === 0 ? (
        <p className="p-8 text-sm">ไม่พบออเดอร์ที่เลือก</p>
      ) : (
        <div
          className={
            thermal
              ? 'flex flex-col items-center gap-4 py-4 print:block print:p-0'
              : 'mx-auto my-4 w-[194mm] grid grid-cols-2 gap-[4mm] print:m-0 print:w-full'
          }
        >
          {orders.map((o) => (
            <div
              key={o.id}
              className={`bg-white border border-black flex flex-col text-[11px] leading-snug break-inside-avoid ${
                thermal ? 'w-[100mm] h-[150mm] p-[5mm] print:border-0 print:break-after-page' : 'h-[136mm] p-[5mm]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-black pb-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-600">คำสั่งซื้อจากหน้าร้าน PayBio</p>
                  <p className="font-mono font-bold text-base">{o.order_number}</p>
                  {o.shipping_method && <p className="font-bold text-sm mt-0.5">{o.shipping_method}</p>}
                </div>
                <QRCodeSVG value={o.order_number} size={56} marginSize={0} className="shrink-0" />
              </div>

              <div className="py-2 border-b border-dashed border-black">
                <p className="font-semibold text-[10px]">ผู้ส่ง</p>
                <p>
                  {senderName}
                  {sender?.sender_phone && ` · โทร ${sender.sender_phone}`}
                </p>
                {sender?.sender_address && <p className="whitespace-pre-line">{sender.sender_address}</p>}
              </div>

              <div className="py-2 flex-1">
                <p className="font-semibold text-[10px]">ผู้รับ</p>
                <p className="text-base font-bold">{o.customer_name}</p>
                <p className="text-sm">โทร {o.ship_phone || o.customer_contact}</p>
                {o.ship_address ? (
                  <>
                    <p className="text-sm whitespace-pre-line mt-1">{o.ship_address}</p>
                    <p className="text-xl font-bold tracking-[0.3em] mt-1">{o.ship_postcode}</p>
                  </>
                ) : (
                  o.note && <p className="text-sm whitespace-pre-line mt-1">{o.note}</p>
                )}
              </div>

              <div className="border-t border-black pt-1.5 text-[10px]">
                <span className="font-semibold">สินค้า:</span> {o.item_title}
                {o.ship_address && o.note && (
                  <p className="text-zinc-700">
                    <span className="font-semibold">หมายเหตุ:</span> {o.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
