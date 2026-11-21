'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import {
  ShoppingBag,
  UploadCloud,
  CheckCircle2,
  X,
  Minus,
  Plus,
  Share2,
  Check,
  Copy,
  Download,
  ArrowLeft,
  QrCode,
  Receipt,
  BadgeCheck,
  AlertCircle,
  ChevronRight,
  Clock,
  XCircle,
} from 'lucide-react';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { LogoMark } from '@/components/logo';
import { LiquidIndicator } from '@/components/liquid-indicator';
import { resolveTheme, themeStyle } from '@/lib/shop-theme';
import { SHOP_FONT_VARIABLES } from '@/lib/shop-fonts';
import type { PublicProduct, PublicShop } from '@/lib/shop-data';
import { initialOf } from '@/lib/initial';
import { POSTCODE_RE, shippingFee } from '@/lib/shipping';

type Step = 'details' | 'pay' | 'done';
type PlacedOrder = { order_number: string; amount: number; quantity: number; track_token: string | null };
// ออเดอร์ที่ลูกค้าเคยสั่งจากเบราว์เซอร์นี้ (เก็บใน localStorage)
type SavedOrder = { token: string; order_number: string; slug: string; item: string; amount: number; at: string };
type OrderStatus = 'pending' | 'paid' | 'rejected';
type Fulfillment = 'preparing' | 'shipped' | 'delivered';
const FULFILLMENT_BADGE: Record<Fulfillment, string> = { preparing: 'เตรียมสินค้า', shipped: 'จัดส่งแล้ว', delivered: 'ได้รับแล้ว' };

const MAX_SLIP_BYTES = 10 * 1024 * 1024;
const CONTACT_KEY = 'paybio:customer';
const ORDERS_KEY = 'paybio:orders';

const ORDER_STATUS: Record<OrderStatus, { label: string; Icon: typeof Clock; style: string }> = {
  pending: { label: 'รอตรวจสอบ', Icon: Clock, style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  paid: { label: 'ชำระแล้ว', Icon: CheckCircle2, style: 'text-brand-400 bg-brand-500/10 border-brand-500/20' },
  rejected: { label: 'ถูกปฏิเสธ', Icon: XCircle, style: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
};

function readSavedOrders(): SavedOrder[] {
  try {
    const list = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

const baht = (n: number) => '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

// ออเดอร์ล่าสุดของลูกค้าในร้านนี้ พร้อมสถานะปัจจุบัน
async function fetchMyOrders(slug: string): Promise<(SavedOrder & { status?: OrderStatus; fulfillment?: Fulfillment | null })[]> {
  const saved = readSavedOrders().filter((o) => o.slug === slug).slice(0, 5);
  if (saved.length === 0) return [];
  try {
    const res = await fetch(`/api/orders/track?tokens=${saved.map((o) => o.token).join(',')}`, { cache: 'no-store' });
    const { orders } = (await res.json()) as { orders: { token: string; status: OrderStatus; fulfillment: Fulfillment | null }[] };
    const byToken = new Map(orders.map((o) => [o.token, o]));
    return saved
      .filter((o) => byToken.has(o.token))
      .map((o) => ({ ...o, status: byToken.get(o.token)!.status, fulfillment: byToken.get(o.token)!.fulfillment }));
  } catch {
    return saved; // โหลดสถานะไม่ได้ก็แสดงรายการไว้ก่อน
  }
}

// แสดงเฉพาะ 4 หลักท้าย (เลขบัตรประชาชน/เบอร์โทรเป็นข้อมูลส่วนตัวของเจ้าของร้าน)
const maskPromptpay = (n: string) => `•••• ${n.slice(-4)}`;

const initial = (name: string) => initialOf(name);

// demo = ร้านตัวอย่างบนหน้า /demo: ใช้หน้าตาเดียวกับร้านจริง แต่ไม่ส่งคำสั่งซื้อและปิด QR ไม่ให้โอนเงินจริง
export default function ShopFront({
  shop,
  products,
  demo = false,
}: {
  shop: PublicShop;
  products: PublicProduct[];
  demo?: boolean;
}) {
  const [selected, setSelected] = useState<PublicProduct | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState({ name: '', contact: '', email: '', note: '' });
  const [methodName, setMethodName] = useState('');
  const [ship, setShip] = useState({ phone: '', address: '', postcode: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [copied, setCopied] = useState<'link' | 'order' | 'track' | null>(null);
  const [myOrders, setMyOrders] = useState<(SavedOrder & { status?: OrderStatus; fulfillment?: Fulfillment | null })[]>([]);
  const qrRef = useRef<HTMLCanvasElement>(null);
  // ร้านที่อัปโหลดรูป QR เอง: เริ่มที่ QR ของร้าน และสลับไปใช้ QR ใส่ยอดอัตโนมัติได้
  const [qrMode, setQrMode] = useState<'shop' | 'auto'>(shop.promptpay_qr_url ? 'shop' : 'auto');
  const useShopQr = qrMode === 'shop' && !!shop.promptpay_qr_url;

  const shipping = shop.shipping;
  const method = shipping?.methods.find((m) => m.name === methodName) ?? null;
  const needsAddress = !!method && !method.pickup;
  const subtotal = selected ? Math.round(selected.price * quantity * 100) / 100 : 0;
  const fee = shipping && method ? shippingFee(shipping, method, subtotal, quantity) : 0;
  const total = Math.round((subtotal + fee) * 100) / 100;
  const qrPayload = selected ? generatePayload(shop.promptpay_number, { amount: total }) : '';

  // ปิดหน้าต่างด้วยปุ่ม Esc
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, submitting]);

  useEffect(() => {
    if (!demo) fetchMyOrders(shop.slug).then(setMyOrders);
  }, [shop.slug, demo]);

  // คืนหน่วยความจำของรูปตัวอย่างสลิป
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const flashCopied = (what: 'link' | 'order' | 'track') => {
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const openCheckout = (product: PublicProduct) => {
    let saved = { name: '', contact: '', email: '', phone: '', address: '', postcode: '' };
    try {
      saved = { ...saved, ...JSON.parse(localStorage.getItem(CONTACT_KEY) ?? '{}') };
    } catch {
      // ไม่มีข้อมูลที่เคยกรอก หรือเบราว์เซอร์ปิด storage
    }
    setSelected(product);
    setStep('details');
    setQuantity(1);
    setCustomer({ name: saved.name, contact: saved.contact, email: saved.email ?? '', note: '' });
    setShip({ phone: saved.phone ?? '', address: saved.address ?? '', postcode: saved.postcode ?? '' });
    if (!shop.shipping?.methods.some((m) => m.name === methodName)) setMethodName(shop.shipping?.methods[0]?.name ?? '');
    setFile(null);
    setPreview(null);
    setError(null);
    setOrder(null);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: shop.shop_name, url });
        return;
      } catch {
        // ผู้ใช้ยกเลิก → คัดลอกลิงก์แทน
      }
    }
    await navigator.clipboard.writeText(url);
    flashCopied('link');
  };

  const handleFile = (f: File | null) => {
    setError(null);
    if (f && !f.type.startsWith('image/')) {
      setError('กรุณาแนบไฟล์รูปภาพสลิป (JPG หรือ PNG)');
      return;
    }
    if (f && f.size > MAX_SLIP_BYTES) {
      setError('ไฟล์ใหญ่เกิน 10 MB');
      return;
    }
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const downloadQr = async () => {
    if (useShopQr && shop.promptpay_qr_url) {
      try {
        const blob = await (await fetch(shop.promptpay_qr_url)).blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `promptpay-${shop.slug}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      } catch {
        window.open(shop.promptpay_qr_url, '_blank');
      }
      return;
    }
    const canvas = qrRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `promptpay-${shop.slug}-${total}.png`;
    a.click();
  };

  const goToPay = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (needsAddress && !POSTCODE_RE.test(ship.postcode.trim())) {
      setError('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
      return;
    }
    try {
      localStorage.setItem(
        CONTACT_KEY,
        JSON.stringify({ name: customer.name, contact: customer.contact, email: customer.email, ...(needsAddress ? ship : {}) })
      );
    } catch {
      // บันทึกไม่ได้ก็ไม่เป็นไร
    }
    setError(null);
    setStep('pay');
  };

  const submitOrder = async () => {
    if (!selected) return;
    if (demo) {
      // ร้านตัวอย่าง: จำลองผลลัพธ์ ไม่ส่งข้อมูลไปที่เซิร์ฟเวอร์
      setOrder({ order_number: 'PB-DEMO01', amount: total, quantity, track_token: null });
      setStep('done');
      return;
    }
    if (!file) {
      setError('กรุณาแนบรูปสลิปโอนเงินก่อน');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('slip', file);
      fd.append('profile_id', shop.id);
      fd.append('product_id', selected.id);
      fd.append('quantity', String(quantity));
      fd.append('customer_name', customer.name);
      fd.append('customer_contact', customer.contact);
      fd.append('note', customer.note);
      fd.append('customer_email', customer.email);
      if (method) {
        fd.append('shipping_method', method.name);
        if (needsAddress) {
          fd.append('ship_phone', ship.phone);
          fd.append('ship_address', ship.address);
          fd.append('ship_postcode', ship.postcode);
        }
      }

      const res = await fetch('/api/orders', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งคำสั่งซื้อไม่สำเร็จ');
      const placed: PlacedOrder = {
        order_number: data.order.order_number,
        amount: Number(data.order.amount),
        quantity,
        track_token: data.order.track_token ?? null,
      };
      setOrder(placed);
      setStep('done');
      if (placed.track_token) {
        try {
          const entry: SavedOrder = {
            token: placed.track_token,
            order_number: placed.order_number,
            slug: shop.slug,
            item: quantity > 1 ? `${selected.name} × ${quantity}` : selected.name,
            amount: placed.amount,
            at: new Date().toISOString(),
          };
          localStorage.setItem(ORDERS_KEY, JSON.stringify([entry, ...readSavedOrders()].slice(0, 30)));
        } catch {
          // บันทึกไม่ได้ก็ยังมีลิงก์ติดตามบนหน้าจอ
        }
        fetchMyOrders(shop.slug).then(setMyOrders);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำสั่งซื้อไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const watermark = PLAN_LIMITS[planOf(shop)].watermark;
  const closed = shop.closedReason;
  const trackUrl = order?.track_token ? `/order/${order.track_token}` : null;
  const theme = resolveTheme(shop.theme, shop.plan);

  return (
    <div
      style={themeStyle(theme)}
      className={`shop-theme ${SHOP_FONT_VARIABLES} min-h-screen text-ink flex flex-col items-center px-4 pt-6 pb-10`}
    >
      <div className="w-full max-w-md">
        <div className="flex justify-end">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-ink px-3 py-1.5 rounded-full border border-slate-800 hover:bg-slate-900 transition cursor-pointer"
          >
            {copied === 'link' ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Share2 className="w-3.5 h-3.5" />}
            {copied === 'link' ? 'คัดลอกลิงก์แล้ว' : 'แชร์ร้าน'}
          </button>
        </div>

        {demo && (
          <div className="mt-3 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-3 text-xs text-slate-300 flex items-center gap-3">
            <span className="flex-1">
              <span className="font-semibold text-ink block">นี่คือร้านตัวอย่าง</span>
              ลองกดสั่งซื้อดูได้ ไม่มีการส่งคำสั่งซื้อหรือโอนเงินจริง
            </span>
            <Link
              href="/login?mode=signup"
              className="shrink-0 text-white px-3 py-2 btn-primary rounded-lg font-semibold"
            >
              เปิดร้านฟรี
            </Link>
          </div>
        )}

        {/* หัวร้าน */}
        <header className="text-center mt-2">
          <div className="w-20 h-20 rounded-full bg-linear-to-br from-brand-400 to-brand-700 text-white text-2xl font-bold flex items-center justify-center mx-auto shadow-lg shadow-brand-500/20">
            {initial(shop.shop_name)}
          </div>
          <h1 className="text-2xl font-bold mt-4">{shop.shop_name}</h1>
          {shop.bio && <p className="text-sm text-slate-400 mt-1.5 max-w-xs mx-auto whitespace-pre-line">{shop.bio}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2.5 py-1 rounded-full">
              <BadgeCheck className="w-3.5 h-3.5" /> รับชำระผ่านพร้อมเพย์
            </span>
            <span className="glass text-slate-400 px-2.5 py-1 rounded-full">
              {products.length.toLocaleString('th-TH')} รายการ
            </span>
          </div>
        </header>

        {closed && (
          <div role="status" className="mt-6 flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl p-4 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <span className="font-semibold block text-sm">{closed}</span>
              ตอนนี้ยังสั่งซื้อผ่านหน้านี้ไม่ได้ กรุณาอย่าโอนเงิน และติดต่อร้านค้าโดยตรง
            </p>
          </div>
        )}

        {myOrders.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1 mb-3">
              <Receipt className="w-3.5 h-3.5" /> คำสั่งซื้อของคุณ
            </h2>
            <ul className="glass rounded-2xl divide-y divide-slate-800">
              {myOrders.map((o) => {
                const st = o.status ? ORDER_STATUS[o.status] : null;
                return (
                  <li key={o.token}>
                    <Link href={`/order/${o.token}`} className="flex items-center gap-3 p-3.5 hover:bg-slate-800/50 transition">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate">{o.item}</span>
                        <span className="block text-[11px] text-slate-500 font-mono">
                          {o.order_number} · {baht(o.amount)}
                        </span>
                      </span>
                      {st && (
                        <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${st.style}`}>
                          <st.Icon className="w-3 h-3" />{' '}
                          {o.status === 'paid' && o.fulfillment ? FULFILLMENT_BADGE[o.fulfillment] : st.label}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-slate-500 mt-2 px-1">
              ไม่เห็นคำสั่งซื้อ?{' '}
              <Link href="/order" className="underline hover:text-ink">
                ค้นหาด้วยเลขคำสั่งซื้อ
              </Link>
            </p>
          </section>
        )}

        {/* สินค้า */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1 mb-3">
            <ShoppingBag className="w-3.5 h-3.5" /> สินค้าและบริการ
          </h2>
          {products.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-sm text-slate-500">
              ร้านนี้ยังไม่มีสินค้าวางจำหน่าย
            </div>
          ) : (
            <ul className="space-y-3">
              {products.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openCheckout(item)}
                    disabled={!!closed}
                    className="w-full text-left glass hover:border-brand-500/40 rounded-2xl p-4 flex items-center gap-3 transition cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-transparent"
                  >
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="w-16 h-16 shrink-0 rounded-xl object-cover border border-slate-800 bg-slate-800"
                      />
                    ) : (
                      <span className="w-11 h-11 shrink-0 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                        <ShoppingBag className="w-5 h-5" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-sm line-clamp-2 break-words">{item.name}</span>
                      <span className="block text-sm text-brand-400 font-bold mt-0.5">{baht(item.price)}</span>
                    </span>
                    <span className="text-white text-xs font-semibold px-3.5 py-2 rounded-xl bg-brand-500 group-hover:bg-brand-600 group-disabled:bg-slate-700 transition">
                      {closed ? 'ปิดรับ' : 'สั่งซื้อ'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* วิธีสั่งซื้อ */}
        <section className="mt-8 glass rounded-2xl p-4">
          <h2 className="text-sm font-semibold mb-3">สั่งซื้ออย่างไร</h2>
          <ol className="space-y-2.5 text-xs text-slate-400">
            {[
              { Icon: ShoppingBag, text: 'เลือกสินค้า ระบุจำนวน และช่องทางติดต่อกลับ' },
              { Icon: QrCode, text: 'สแกน QR พร้อมเพย์ ยอดเงินคำนวณให้อัตโนมัติ' },
              { Icon: Receipt, text: 'แนบสลิป แล้วร้านจะตรวจสอบและติดต่อกลับ' },
            ].map(({ Icon, text }, i) => (
              <li key={text} className="flex items-center gap-2.5">
                <span className="w-6 h-6 shrink-0 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[11px] font-semibold">
                  {i + 1}
                </span>
                <Icon className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                {text}
              </li>
            ))}
          </ol>
        </section>

        {watermark && (
          <div className="mt-8 text-center">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
            >
              <LogoMark className="w-4 h-4" /> Powered by PayBio
            </Link>
          </div>
        )}
      </div>

      {/* หน้าต่างสั่งซื้อ */}
      {selected && (
        <div
          onClick={() => !submitting && setSelected(null)}
          className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 z-50"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            onClick={(e) => e.stopPropagation()}
            className="glass glass-dialog w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-5 max-h-[92vh] overflow-y-auto relative shadow-2xl"
          >
            <div className="flex items-center gap-2 mb-4">
              {step === 'pay' && (
                <button
                  onClick={() => setStep('details')}
                  disabled={submitting}
                  aria-label="ย้อนกลับ"
                  className="p-1 -ml-1 rounded-lg text-slate-400 hover:text-ink hover:bg-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h3 id="checkout-title" className="font-bold text-base flex-1">
                {step === 'details' ? 'รายละเอียดคำสั่งซื้อ' : step === 'pay' ? 'ชำระเงินผ่านพร้อมเพย์' : 'สั่งซื้อสำเร็จ'}
              </h3>
              <button
                onClick={() => setSelected(null)}
                disabled={submitting}
                aria-label="ปิด"
                className="p-1 rounded-lg text-slate-400 hover:text-ink hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {step !== 'done' && (
              <div className="flex gap-1.5 mb-4" aria-hidden="true">
                <span className="h-1 flex-1 rounded-full bg-brand-500" />
                <span className={`h-1 flex-1 rounded-full ${step === 'pay' ? 'bg-brand-500' : 'bg-slate-800'}`} />
              </div>
            )}

            {step === 'details' && (
              <form onSubmit={goToPay} className="space-y-4">
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
                  {selected.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.image_url} alt="" className="w-12 h-12 shrink-0 rounded-lg object-cover bg-slate-800" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{selected.name}</p>
                    <p className="text-xs text-slate-400">{baht(selected.price)} / ชิ้น</p>
                  </div>
                  <div className="flex items-center gap-1" role="group" aria-label="จำนวน">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      aria-label="ลดจำนวน"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                      disabled={quantity >= 99}
                      aria-label="เพิ่มจำนวน"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="c-name" className="text-xs text-slate-400 block mb-1">
                    ชื่อผู้สั่งซื้อ
                  </label>
                  <input
                    id="c-name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    value={customer.name}
                    onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="c-contact" className="text-xs text-slate-400 block mb-1">
                    เบอร์โทร หรือ LINE ID สำหรับติดต่อกลับ
                  </label>
                  <input
                    id="c-contact"
                    required
                    maxLength={100}
                    autoComplete="tel"
                    value={customer.contact}
                    onChange={(e) => setCustomer((c) => ({ ...c, contact: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="c-email" className="text-xs text-slate-400 block mb-1">
                    อีเมลรับแจ้งสถานะ <span className="text-slate-500">(ไม่บังคับ)</span>
                  </label>
                  <input
                    id="c-email"
                    type="email"
                    maxLength={200}
                    autoComplete="email"
                    placeholder="รับลิงก์ติดตามและแจ้งเตือนเมื่อจัดส่ง"
                    value={customer.email}
                    onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                {shipping && (
                  <fieldset>
                    <legend className="text-xs text-slate-400 mb-1.5">วิธีรับสินค้า</legend>
                    <div className="space-y-1.5">
                      {shipping.methods.map((m) => {
                        const mFee = shippingFee(shipping, m, subtotal, quantity);
                        return (
                          <label
                            key={m.name}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition ${
                              methodName === m.name ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              name="shipping-method"
                              required
                              checked={methodName === m.name}
                              onChange={() => setMethodName(m.name)}
                              className="accent-brand-500"
                            />
                            <span className="flex-1">{m.name}</span>
                            <span className={`text-xs font-semibold ${mFee === 0 ? 'text-brand-400' : 'text-slate-300'}`}>
                              {m.pickup ? 'ไม่มีค่าส่ง' : mFee === 0 ? 'ส่งฟรี' : `+${baht(mFee)}`}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {(shipping.free_over != null || shipping.extra_per_item > 0) && (
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {[
                          shipping.extra_per_item > 0 && `ชิ้นถัดไปบวกค่าส่งชิ้นละ ${baht(shipping.extra_per_item)}`,
                          shipping.free_over != null &&
                            (subtotal >= shipping.free_over
                              ? `ซื้อครบ ${baht(shipping.free_over)} ส่งฟรีแล้ว`
                              : `ซื้อเพิ่มอีก ${baht(shipping.free_over - subtotal)} ส่งฟรี`),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </fieldset>
                )}

                {needsAddress && (
                  <div className="space-y-3 rounded-xl border border-slate-800 p-3">
                    <p className="text-xs font-medium text-slate-300">ที่อยู่จัดส่ง (ผู้รับ: {customer.name || 'ชื่อผู้สั่งซื้อ'})</p>
                    <div>
                      <label htmlFor="s-phone" className="text-xs text-slate-400 block mb-1">
                        เบอร์โทรผู้รับ
                      </label>
                      <input
                        id="s-phone"
                        required
                        type="tel"
                        inputMode="tel"
                        maxLength={30}
                        autoComplete="tel"
                        value={ship.phone}
                        onChange={(e) => setShip((s) => ({ ...s, phone: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="s-address" className="text-xs text-slate-400 block mb-1">
                        บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด
                      </label>
                      <textarea
                        id="s-address"
                        required
                        rows={3}
                        maxLength={300}
                        autoComplete="street-address"
                        value={ship.address}
                        onChange={(e) => setShip((s) => ({ ...s, address: e.target.value }))}
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                    <div className="w-32">
                      <label htmlFor="s-postcode" className="text-xs text-slate-400 block mb-1">
                        รหัสไปรษณีย์
                      </label>
                      <input
                        id="s-postcode"
                        required
                        inputMode="numeric"
                        maxLength={5}
                        pattern="\d{5}"
                        autoComplete="postal-code"
                        value={ship.postcode}
                        onChange={(e) => setShip((s) => ({ ...s, postcode: e.target.value.replace(/\D/g, '') }))}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="c-note" className="text-xs text-slate-400 block mb-1">
                    {shipping ? 'หมายเหตุถึงร้าน' : 'ที่อยู่จัดส่ง / หมายเหตุ'} <span className="text-slate-500">(ไม่บังคับ)</span>
                  </label>
                  <textarea
                    id="c-note"
                    rows={shipping ? 2 : 3}
                    maxLength={500}
                    value={customer.note}
                    onChange={(e) => setCustomer((c) => ({ ...c, note: e.target.value }))}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-1">
                  {shipping && (
                    <>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>ค่าสินค้า</span>
                        <span>{baht(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>ค่าจัดส่ง{method ? ` (${method.name})` : ''}</span>
                        <span>{fee === 0 ? 'ฟรี' : baht(fee)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">ยอดชำระ</span>
                    <span className="text-xl font-bold text-brand-400">{baht(total)}</span>
                  </div>
                </div>
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <button
                  type="submit"
                  className="text-white w-full py-3 btn-primary font-semibold rounded-xl text-sm transition cursor-pointer"
                >
                  ถัดไป: ชำระเงิน
                </button>
              </form>
            )}

            {step === 'pay' && (
              <div className="text-center">
                <p className="text-xs text-slate-400">
                  {selected.name} × {quantity}
                  {method && ` · ${method.name}${fee > 0 ? ` (ค่าส่ง ${baht(fee)})` : ''}`}
                </p>
                <p className="text-3xl font-bold text-brand-400 mt-1">{baht(total)}</p>

                {shop.promptpay_qr_url && (
                  <div className="liquid-host mt-4 inline-grid grid-cols-2 gap-1 p-1 bg-slate-800/60 rounded-xl text-xs">
                    <LiquidIndicator active={qrMode} variant="clear" />
                    {(['shop', 'auto'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        data-active={qrMode === m}
                        onClick={() => setQrMode(m)}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-colors duration-300 cursor-pointer ${
                          qrMode === m ? 'text-ink' : 'text-slate-400 hover:text-ink'
                        }`}
                      >
                        {m === 'shop' ? 'QR ของร้าน' : 'QR ใส่ยอดให้'}
                      </button>
                    ))}
                  </div>
                )}

                <div className="bg-white p-3.5 rounded-2xl inline-block mt-4">
                  {useShopQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.promptpay_qr_url!}
                      alt={`QR พร้อมเพย์ของ ${shop.shop_name}`}
                      className="w-[208px] max-h-80 object-contain"
                    />
                  ) : (
                    <div className="relative">
                      <QRCodeCanvas ref={qrRef} value={qrPayload} size={180} marginSize={1} className={demo ? 'blur-[3px] opacity-40' : ''} />
                      <p className="text-gray-600 text-[10px] mt-1 font-mono">พร้อมเพย์ {maskPromptpay(shop.promptpay_number)}</p>
                      {demo && (
                        <span className="absolute inset-0 flex items-center justify-center text-center text-xs font-bold text-gray-800 px-6">
                          QR ตัวอย่าง
                          <br />
                          ห้ามโอนเงินจริง
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className={demo ? 'hidden' : ''}>
                  <button
                    onClick={downloadQr}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-brand-400 hover:underline cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> บันทึกรูป QR
                  </button>
                </div>
                {useShopQr ? (
                  <p className="text-[11px] text-amber-400 mt-2">
                    QR นี้ไม่มียอดเงิน กรุณากรอกยอด <span className="font-bold">{baht(total)}</span> เองในแอปธนาคาร
                    ให้ตรงทุกสตางค์ แล้วตรวจชื่อผู้รับว่าเป็น {shop.shop_name} ก่อนยืนยัน
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-2">
                    เปิดแอปธนาคาร สแกน QR หรือเลือกรูปที่บันทึกไว้ ยอดเงินจะขึ้นให้อัตโนมัติ
                    ตรวจชื่อผู้รับว่าเป็น {shop.shop_name} ก่อนยืนยัน
                  </p>
                )}

                <label
                  htmlFor="slip-upload"
                  className={`mt-4 block border-2 border-dashed rounded-xl p-3 cursor-pointer transition ${
                    file ? 'border-brand-500/50 bg-brand-500/5' : 'border-slate-700 hover:border-brand-500/50'
                  }`}
                >
                  <input
                    type="file"
                    id="slip-upload"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  {preview ? (
                    <span className="flex items-center gap-3 text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="ตัวอย่างสลิป" className="w-14 h-20 object-cover rounded-lg bg-slate-950" />
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-ink truncate">{file?.name}</span>
                        <span className="block text-[11px] text-brand-400 mt-0.5">แตะเพื่อเปลี่ยนรูป</span>
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col items-center gap-1">
                      <UploadCloud className="w-5 h-5 text-slate-400" />
                      <span className="text-xs text-slate-300 font-medium">แนบรูปสลิปโอนเงิน</span>
                      <span className="text-[10px] text-slate-500">JPG หรือ PNG ไม่เกิน 10 MB</span>
                    </span>
                  )}
                </label>

                {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="text-white mt-4 w-full py-3 btn-primary font-semibold rounded-xl text-sm disabled:opacity-50 transition cursor-pointer"
                >
                  {submitting ? 'กำลังส่งคำสั่งซื้อ...' : demo ? 'ลองส่งคำสั่งซื้อ (ตัวอย่าง)' : 'ส่งสลิปยืนยันคำสั่งซื้อ'}
                </button>
              </div>
            )}

            {step === 'done' && order && (
              <div className="text-center py-2">
                <CheckCircle2 className="w-14 h-14 text-brand-400 mx-auto" />
                <p className="text-sm text-slate-300 mt-3">ส่งสลิปเรียบร้อย ร้านจะตรวจสอบและติดต่อกลับทาง</p>
                <p className="text-sm font-semibold">{customer.contact}</p>

                <div className="mt-5 bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">รหัสคำสั่งซื้อ</span>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(order.order_number);
                        flashCopied('order');
                      }}
                      className="inline-flex items-center gap-1 font-mono font-semibold hover:text-brand-400 cursor-pointer"
                    >
                      {order.order_number}
                      {copied === 'order' ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400">สินค้า</span>
                    <span className="text-right">
                      {selected.name} × {order.quantity}
                    </span>
                  </div>
                  {method && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-400">การจัดส่ง</span>
                      <span className="text-right">
                        {method.name} · {fee === 0 ? 'ไม่มีค่าส่ง' : baht(fee)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400">ยอดชำระ</span>
                    <span className="font-semibold text-brand-400">{baht(order.amount)}</span>
                  </div>
                </div>
                {trackUrl ? (
                  <div className="mt-4 space-y-2">
                    <Link
                      href={trackUrl}
                      className="text-white w-full inline-flex items-center justify-center gap-1.5 py-2.5 btn-primary text-sm font-semibold rounded-xl"
                    >
                      <Clock className="w-4 h-4" /> ติดตามสถานะคำสั่งซื้อ
                    </Link>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(window.location.origin + trackUrl);
                        flashCopied('track');
                      }}
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:underline cursor-pointer"
                    >
                      {copied === 'track' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === 'track' ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ติดตาม'}
                    </button>
                    <p className="text-[11px] text-slate-500">ดูสถานะได้จากลิงก์นี้ หรือเปิดหน้าร้านนี้อีกครั้งบนเครื่องเดิม</p>
                  </div>
                ) : demo ? (
                  <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-xs text-slate-300">
                    นี่คือสิ่งที่ลูกค้าของคุณจะเห็นหลังส่งสลิป ส่วนร้านจะได้รับแจ้งเตือนพร้อมผลตรวจสลิปทันที
                    <Link
                      href="/login?mode=signup"
                      className="text-white mt-3 w-full inline-flex items-center justify-center py-2.5 btn-primary text-sm font-semibold rounded-xl"
                    >
                      เปิดร้านของคุณฟรี
                    </Link>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-3">เก็บรหัสคำสั่งซื้อไว้สำหรับสอบถามร้านค้า</p>
                )}

                <button
                  onClick={() => setSelected(null)}
                  className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-xl cursor-pointer"
                >
                  กลับไปหน้าร้าน
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
