import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, Clock, ExternalLink, MessageSquare, Package, PackageCheck, RefreshCw, Search, Store, Truck, XCircle } from 'lucide-react';
import { getTrackedOrders } from '@/lib/order-track';
import { getOrderEvents } from '@/lib/order-events';
import { STAGES, carrierOf, stageIndex, trackingUrl } from '@/lib/order-stages';
import { resolveTheme, themeStyle } from '@/lib/shop-theme';
import { SHOP_FONT_VARIABLES } from '@/lib/shop-fonts';

export const metadata: Metadata = { title: 'สถานะคำสั่งซื้อ · PayBio', robots: { index: false } };

const HERO = {
  pending: {
    Icon: Clock,
    title: 'รอร้านตรวจสอบสลิป',
    text: 'ร้านได้รับสลิปของคุณแล้ว กำลังตรวจสอบยอดเงิน',
    style: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  paid: {
    Icon: CheckCircle2,
    title: 'ชำระเงินเรียบร้อย',
    text: 'ร้านยืนยันการชำระเงินแล้ว และจะดำเนินการตามคำสั่งซื้อของคุณ',
    style: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  },
  preparing: {
    Icon: Package,
    title: 'กำลังเตรียมสินค้า',
    text: 'ร้านกำลังเตรียมสินค้าของคุณ',
    style: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  },
  shipped: {
    Icon: Truck,
    title: 'จัดส่งแล้ว',
    text: 'สินค้าอยู่ระหว่างการจัดส่ง',
    style: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  },
  delivered: {
    Icon: PackageCheck,
    title: 'ได้รับสินค้าแล้ว',
    text: 'ขอบคุณที่สั่งซื้อ',
    style: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  },
  rejected: {
    Icon: XCircle,
    title: 'ร้านปฏิเสธคำสั่งซื้อ',
    text: 'สลิปหรือยอดเงินอาจไม่ถูกต้อง กรุณาติดต่อร้านค้าพร้อมรหัสคำสั่งซื้อ',
    style: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
} as const;

const baht = (n: number) => '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
const when = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' });

async function Tracker({ params }: { params: PageProps<'/order/[token]'>['params'] }) {
  const { token } = await params;
  const [order] = await getTrackedOrders([token]);

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4 text-center">
        <Store className="w-10 h-10 text-slate-500 mb-3" />
        <h1 className="text-xl font-bold mb-2">ไม่พบคำสั่งซื้อนี้</h1>
        <p className="text-sm text-slate-400">ลิงก์ติดตามอาจไม่ถูกต้อง กรุณาตรวจสอบลิงก์อีกครั้ง</p>
        <Link href="/order" className="mt-5 inline-flex items-center gap-1.5 text-sm text-brand-400 hover:underline">
          <Search className="w-4 h-4" /> ค้นหาด้วยเลขคำสั่งซื้อ
        </Link>
      </div>
    );
  }

  const events = await getOrderEvents(order.id);
  const heroKey = order.status === 'paid' && order.fulfillment ? order.fulfillment : order.status;
  const hero = HERO[heroKey] ?? HERO.pending;
  const theme = resolveTheme(order.shop?.theme, order.shop?.plan);
  const current = stageIndex(order.status, order.fulfillment);
  const parcelUrl = trackingUrl(order.carrier, order.tracking_number);

  return (
    <div
      style={themeStyle(theme)}
      className={`shop-theme ${SHOP_FONT_VARIABLES} min-h-screen bg-slate-950 text-ink flex justify-center px-4 pt-10 pb-10`}
    >
      <div className="w-full max-w-md space-y-4">
        <p className="text-center text-xs text-slate-400">
          คำสั่งซื้อจาก <span className="font-semibold text-ink">{order.shop?.shop_name ?? 'ร้านค้า'}</span>
        </p>

        <div className={`border rounded-2xl p-5 text-center ${hero.style}`}>
          <hero.Icon className="w-12 h-12 mx-auto" />
          <h1 className="text-lg font-bold mt-3">{hero.title}</h1>
          <p className="text-xs text-slate-300 mt-1">{hero.text}</p>
        </div>

        {order.status !== 'rejected' && (
          <ol className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-5 gap-1" aria-label="ขั้นตอนคำสั่งซื้อ">
            {STAGES.map((s, i) => {
              const done = i <= current;
              return (
                <li key={s.key} className="flex flex-col items-center text-center gap-1.5" aria-current={i === current ? 'step' : undefined}>
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      done ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-500'
                    } ${i === current ? 'ring-2 ring-brand-500/40' : ''}`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-[10px] leading-tight ${done ? 'text-ink' : 'text-slate-500'}`}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {order.tracking_number && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs space-y-2">
            <p className="font-semibold flex items-center gap-1.5 text-sm">
              <Truck className="w-4 h-4 text-brand-400" /> ข้อมูลพัสดุ
            </p>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">ขนส่ง</span>
              <span>{carrierOf(order.carrier)?.label ?? 'ไม่ระบุ'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-400">เลขพัสดุ</span>
              <span className="font-mono font-semibold select-all">{order.tracking_number}</span>
            </div>
            {parcelUrl ? (
              <a
                href={parcelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-brand-400 hover:underline"
              >
                ติดตามพัสดุกับขนส่ง <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <p className="text-slate-500">คัดลอกเลขพัสดุไปค้นหาในเว็บหรือแอปของขนส่ง</p>
            )}
          </div>
        )}

        {order.shop_message && (
          <div className="bg-slate-900 border border-brand-500/30 rounded-2xl p-4 text-sm">
            <p className="font-semibold flex items-center gap-1.5 text-xs text-brand-400 mb-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> ข้อความจากร้าน
            </p>
            <p className="whitespace-pre-line break-words text-slate-200">{order.shop_message}</p>
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs space-y-2.5">
          <div className="flex justify-between">
            <span className="text-slate-400">รหัสคำสั่งซื้อ</span>
            <span className="font-mono font-semibold">{order.order_number}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400 shrink-0">สินค้า</span>
            <span className="text-right">{order.item_title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">ยอดชำระ</span>
            <span className="font-semibold text-brand-400">{baht(order.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">สั่งซื้อเมื่อ</span>
            <span>{when(order.created_at)}</span>
          </div>
        </div>

        {events.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-3">ประวัติคำสั่งซื้อ</p>
            <ol className="space-y-3 border-l border-slate-700 ml-1.5">
              {[...events].reverse().map((e, i) => (
                <li key={`${e.created_at}-${i}`} className="pl-4 relative text-xs">
                  <span
                    className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-brand-500' : 'bg-slate-600'}`}
                  />
                  <p className={i === 0 ? 'text-ink font-medium' : 'text-slate-300'}>{e.label}</p>
                  {e.detail && <p className="text-slate-400 whitespace-pre-line break-words mt-0.5">{e.detail}</p>}
                  <p className="text-[10px] text-slate-500 mt-0.5">{when(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex gap-2">
          <Link
            href={`/order/${order.token}`}
            prefetch={false}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-xl"
          >
            <RefreshCw className="w-4 h-4" /> อัปเดตสถานะ
          </Link>
          {order.shop && (
            <Link
              href={`/${order.shop.slug}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl"
            >
              <Store className="w-4 h-4" /> กลับไปหน้าร้าน
            </Link>
          )}
        </div>
        <p className="text-center text-[11px] text-slate-500">
          บันทึกลิงก์หน้านี้ไว้เพื่อกลับมาดูสถานะได้ทุกเมื่อ หรือ{' '}
          <Link href="/order" className="underline hover:text-ink">
            ค้นหาด้วยเลขคำสั่งซื้อ
          </Link>
        </p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-slate-950 flex justify-center px-4 pt-10">
      <div className="w-full max-w-md space-y-4 animate-pulse">
        <div className="h-4 w-40 bg-slate-800 rounded mx-auto" />
        <div className="h-36 bg-slate-900 rounded-2xl" />
        <div className="h-32 bg-slate-900 rounded-2xl" />
      </div>
    </div>
  );
}

export default function OrderTrackingPage({ params }: PageProps<'/order/[token]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Tracker params={params} />
    </Suspense>
  );
}
