// อีเมลแจ้งลูกค้าเมื่อสั่งซื้อ / สถานะเปลี่ยน ผ่าน Resend (https://resend.com)
// ต้องตั้ง RESEND_API_KEY และ EMAIL_FROM (อีเมลผู้ส่งจากโดเมนที่ยืนยันใน Resend) — ไม่ตั้ง = ไม่ส่ง
import { carrierOf, customerStatusLabel, trackingUrl, type Fulfillment, type OrderStatus } from '@/lib/order-stages';

export type EmailOrder = {
  order_number: string;
  item_title: string;
  amount: number;
  shipping_method?: string | null;
  shipping_fee?: number | null;
  status: OrderStatus;
  fulfillment: Fulfillment | null;
  carrier: string | null;
  tracking_number: string | null;
  shop_message: string | null;
  customer_name: string | null;
  customer_email: string | null;
  track_token: string | null;
};

export function customerEmailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function render(shopName: string, order: EmailOrder, headline: string) {
  const link = order.track_token ? `${appUrl()}/order/${order.track_token}` : null;
  const parcelUrl = trackingUrl(order.carrier, order.tracking_number);
  const rows: [string, string][] = [
    ['รหัสคำสั่งซื้อ', order.order_number],
    ['สินค้า', order.item_title],
    ...(order.shipping_method
      ? ([['การจัดส่ง', `${order.shipping_method} · ${Number(order.shipping_fee) > 0 ? `฿${Number(order.shipping_fee).toLocaleString('th-TH')}` : 'ฟรี'}`]] as [string, string][])
      : []),
    ['ยอดชำระ', `฿${Number(order.amount).toLocaleString('th-TH')}`],
    ['สถานะ', customerStatusLabel(order.status, order.fulfillment)],
  ];
  if (order.tracking_number) {
    rows.push(['เลขพัสดุ', `${carrierOf(order.carrier)?.label ?? ''} ${order.tracking_number}`.trim()]);
  }
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Tahoma,Arial,sans-serif;color:#18181b">
<div style="max-width:520px;margin:0 auto;padding:24px">
  <p style="font-size:13px;color:#71717a;margin:0 0 8px">คำสั่งซื้อจาก ${esc(shopName)}</p>
  <div style="background:#fff;border-radius:16px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 16px">${esc(headline)}</h1>
    ${order.shop_message ? `<div style="background:#f0fdf4;border-left:4px solid #10b981;padding:12px;border-radius:8px;margin-bottom:16px;font-size:14px"><b>ข้อความจากร้าน</b><br>${esc(order.shop_message).replace(/\n/g, '<br>')}</div>` : ''}
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#71717a">${esc(k)}</td><td style="padding:6px 0;text-align:right">${esc(v)}</td></tr>`).join('')}
    </table>
    ${parcelUrl ? `<p style="margin:16px 0 0"><a href="${esc(parcelUrl)}" style="color:#059669">ติดตามพัสดุกับขนส่ง</a></p>` : ''}
    ${link ? `<p style="margin:20px 0 0"><a href="${esc(link)}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">ดูสถานะคำสั่งซื้อ</a></p>` : ''}
  </div>
  <p style="font-size:11px;color:#a1a1aa;margin-top:16px">อีเมลนี้ส่งอัตโนมัติจาก PayBio เพราะคุณกรอกอีเมลนี้ตอนสั่งซื้อ หากมีคำถามกรุณาติดต่อร้านค้าโดยตรง</p>
</div></body></html>`;
  const text = [headline, order.shop_message && `ข้อความจากร้าน: ${order.shop_message}`, ...rows.map(([k, v]) => `${k}: ${v}`), parcelUrl, link && `ดูสถานะ: ${link}`]
    .filter(Boolean)
    .join('\n');
  return { html, text };
}

// ไม่ throw: การส่งอีเมลล้มเหลวต้องไม่ทำให้การอัปเดตออเดอร์ล้มเหลว
export async function sendCustomerEmail(shopName: string, order: EmailOrder, headline: string) {
  if (!customerEmailConfigured() || !order.customer_email) return false;
  const { html, text } = render(shopName, order, headline);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [order.customer_email],
        subject: `[${shopName}] ${headline} · ${order.order_number}`,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error('[customer-email] send failed', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('[customer-email] send failed', err);
    return false;
  }
}
