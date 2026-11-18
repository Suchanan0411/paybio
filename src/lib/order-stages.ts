// ขั้นตอนของออเดอร์ที่ลูกค้าเห็น (ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์)

export type OrderStatus = 'pending' | 'paid' | 'rejected';
export type Fulfillment = 'preparing' | 'shipped' | 'delivered';

export const FULFILLMENTS: Fulfillment[] = ['preparing', 'shipped', 'delivered'];

export const FULFILLMENT_LABEL: Record<Fulfillment, string> = {
  preparing: 'กำลังเตรียมสินค้า',
  shipped: 'จัดส่งแล้ว',
  delivered: 'ได้รับสินค้าแล้ว',
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'รอร้านตรวจสอบสลิป',
  paid: 'ชำระเงินเรียบร้อย',
  rejected: 'ร้านปฏิเสธคำสั่งซื้อ',
};

// ขั้นตอนบนหน้าติดตาม (ก่อนชำระ → ชำระแล้ว → เตรียม → ส่ง → ได้รับ)
export const STAGES = [
  { key: 'pending', label: 'ส่งสลิปแล้ว' },
  { key: 'paid', label: 'ชำระเงินแล้ว' },
  { key: 'preparing', label: 'เตรียมสินค้า' },
  { key: 'shipped', label: 'จัดส่งแล้ว' },
  { key: 'delivered', label: 'ได้รับสินค้า' },
] as const;

export function stageIndex(status: OrderStatus, fulfillment: Fulfillment | null) {
  if (status !== 'paid') return 0;
  return fulfillment ? STAGES.findIndex((s) => s.key === fulfillment) : 1;
}

// ป้ายสถานะสั้นสำหรับรายการ
export function customerStatusLabel(status: OrderStatus, fulfillment: Fulfillment | null) {
  return status === 'paid' && fulfillment ? FULFILLMENT_LABEL[fulfillment] : STATUS_LABEL[status];
}

export const CARRIERS: { key: string; label: string; url?: (n: string) => string }[] = [
  { key: 'thaipost', label: 'ไปรษณีย์ไทย', url: (n) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(n)}` },
  { key: 'flash', label: 'Flash Express', url: (n) => `https://www.flashexpress.co.th/fle/tracking?se=${encodeURIComponent(n)}` },
  { key: 'kex', label: 'KEX (Kerry)' },
  { key: 'jt', label: 'J&T Express' },
  { key: 'spx', label: 'SPX Express' },
  { key: 'ninjavan', label: 'Ninja Van' },
  { key: 'best', label: 'BEST Express' },
  { key: 'dhl', label: 'DHL' },
  { key: 'lalamove', label: 'Lalamove / Grab / ส่งด่วน' },
  { key: 'other', label: 'อื่นๆ' },
];

export const carrierOf = (key: string | null | undefined) => CARRIERS.find((c) => c.key === key) ?? null;

export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined) {
  const c = carrierOf(carrier);
  return c?.url && number ? c.url(number) : null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
