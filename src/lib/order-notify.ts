import { createHmac } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { PLAN_LIMITS, planOf } from '@/lib/plans';
import { lineMessagingConfigured, pushMessage } from '@/lib/line-messaging';
import type { SlipCheck } from '@/lib/slip-check';
import { signedSlipUrl } from '@/lib/slip-url';

export type NotifyShop = {
  id: string;
  slug: string;
  shop_name: string;
  plan?: string | null;
  line_user_id?: string | null;
  order_webhook_url?: string | null;
  order_webhook_secret?: string | null;
};

export type NotifyOrder = {
  id: string;
  order_number: string;
  item_title: string;
  amount: number;
  quantity?: number | null;
  customer_name?: string | null;
  customer_contact?: string | null;
  note?: string | null;
  shipping_method?: string | null;
  shipping_fee?: number | null;
  ship_phone?: string | null;
  ship_address?: string | null;
  ship_postcode?: string | null;
  slip_url?: string | null;
  status: string;
  created_at: string;
};

const VERDICT_TEXT: Record<SlipCheck['verdict'], string> = {
  pass: '✅ สลิปผ่านการตรวจ',
  warn: '⚠️ สลิปควรตรวจซ้ำ',
  fail: '❌ สลิปไม่ผ่านการตรวจ',
  unchecked: '🔎 กรุณาตรวจยอดเงินในสลิปก่อนอนุมัติ',
};

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const CHECK_MARK: Record<string, string> = { pass: '✓', warn: '!', fail: '✗', skip: '–' };

// รายละเอียดผลตรวจสลิปสำหรับข้อความ LINE: ข้อมูลจากธนาคาร + ข้อที่ไม่ผ่าน/ควรดู (ไม่เกิน 4 บรรทัด)
function slipSummary(check?: SlipCheck | null): string[] {
  if (!check) return [VERDICT_TEXT.unchecked];
  const lines = [VERDICT_TEXT[check.verdict]];
  if (check.bank) {
    const at = check.bank.datetime
      ? new Date(check.bank.datetime).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' })
      : null;
    lines.push(`🏦 ยอดตามธนาคาร: ฿${check.bank.amount.toLocaleString('th-TH')}${at ? ` · ${at}` : ''}`);
    if (check.bank.receiver_name) lines.push(`ผู้รับ: ${check.bank.receiver_name}`);
  }
  const problems = check.checks.filter((c) => c.status === 'fail' || c.status === 'warn').slice(0, 4);
  for (const c of problems) lines.push(`${CHECK_MARK[c.status]} ${c.label}${c.detail ? `: ${c.detail}` : ''}`);
  return lines;
}

export function orderLineText(shop: NotifyShop, order: NotifyOrder, check?: SlipCheck | null) {
  return [
    `🛒 ออเดอร์ใหม่ ${order.order_number}`,
    `ร้าน: ${shop.shop_name}`,
    '',
    `${order.item_title}`,
    `ยอด ฿${Number(order.amount).toLocaleString('th-TH')}${
      Number(order.shipping_fee) > 0 ? ` (รวมค่าส่ง ฿${Number(order.shipping_fee).toLocaleString('th-TH')})` : ''
    }`,
    order.shipping_method && `จัดส่ง: ${order.shipping_method}`,
    order.customer_name && `ลูกค้า: ${order.customer_name}${order.customer_contact ? ` (${order.customer_contact})` : ''}`,
    order.ship_address && `ที่อยู่: ${order.ship_address} ${order.ship_postcode ?? ''} โทร ${order.ship_phone ?? ''}`.trim(),
    order.note && `หมายเหตุ: ${order.note}`,
    '',
    ...slipSummary(check),
    '',
    `ตรวจสลิปและอนุมัติ: ${appUrl()}/manage`,
  ]
    .filter((line) => typeof line === 'string')
    .join('\n');
}

// --- Webhook (Business) -------------------------------------------------------

function isPrivateAddress(ip: string) {
  if (ip.includes(':')) {
    const v = ip.toLowerCase();
    if (v.startsWith('::ffff:')) return isPrivateAddress(v.slice(7));
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff');
  }
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast / สงวน
  );
}

// ยอมให้ส่งเฉพาะ https ไปยังเซิร์ฟเวอร์สาธารณะ (กันการยิงเข้าเครือข่ายภายใน)
export async function validateWebhookUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'รูปแบบ URL ไม่ถูกต้อง';
  }
  if (url.protocol !== 'https:') return 'Webhook ต้องเป็น https://';
  if (url.username || url.password) return 'URL ต้องไม่มีชื่อผู้ใช้/รหัสผ่าน';
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return 'ใช้ที่อยู่ภายในเครื่องไม่ได้';
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) return 'ใช้ที่อยู่ในเครือข่ายภายในไม่ได้';
  } catch {
    return 'หาโดเมนนี้ไม่พบ';
  }
  return null;
}

export function signWebhook(secret: string, body: string) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

export async function sendWebhook(
  shop: NotifyShop,
  event: 'order.created' | 'webhook.test',
  order: NotifyOrder | null,
  check?: SlipCheck | null
) {
  if (!shop.order_webhook_url || !shop.order_webhook_secret) throw new Error('ยังไม่ได้ตั้ง Webhook');
  const problem = await validateWebhookUrl(shop.order_webhook_url);
  if (problem) throw new Error(problem);

  const body = JSON.stringify({
    event,
    sent_at: new Date().toISOString(),
    shop: { id: shop.id, slug: shop.slug, name: shop.shop_name },
    order: order && {
      id: order.id,
      order_number: order.order_number,
      item_title: order.item_title,
      quantity: order.quantity ?? 1,
      amount: Number(order.amount),
      status: order.status,
      customer_name: order.customer_name ?? null,
      customer_contact: order.customer_contact ?? null,
      note: order.note ?? null,
      shipping: order.shipping_method
        ? {
            method: order.shipping_method,
            fee: Number(order.shipping_fee ?? 0),
            phone: order.ship_phone ?? null,
            address: order.ship_address ?? null,
            postcode: order.ship_postcode ?? null,
          }
        : null,
      slip_url: await signedSlipUrl(order.slip_url, 7 * 24 * 60 * 60), // ลิงก์ชั่วคราว 7 วัน
      slip_check: check
        ? {
            verdict: check.verdict,
            checks: check.checks,
            // ข้อมูลจากธนาคาร (มีเมื่อยืนยันผ่าน SlipOK ได้)
            bank: check.bank
              ? {
                  verified: true,
                  ref: check.bank.ref,
                  amount: check.bank.amount,
                  datetime: check.bank.datetime,
                  sending_bank: check.bank.sending_bank,
                  receiving_bank: check.bank.receiving_bank,
                  receiver_name: check.bank.receiver_name,
                }
              : null,
          }
        : null,
      created_at: order.created_at,
    },
  });

  const status = await postPinned(shop.order_webhook_url, body, {
    'Content-Type': 'application/json',
    'User-Agent': 'PayBio-Webhook/1.0',
    'X-PayBio-Event': event,
    'X-PayBio-Signature': signWebhook(shop.order_webhook_secret, body),
  });
  if (status < 200 || status >= 300) throw new Error(`ปลายทางตอบกลับ ${status}`);
}

// DNS lookup ที่ใช้ตอนเชื่อมต่อจริง: ตรวจ IP ทุกครั้ง (กัน DNS rebinding — โดเมนที่ผ่านตอนตรวจแต่เปลี่ยนเป็น IP ภายในตอนส่ง)
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(new Error('ใช้ที่อยู่ในเครือข่ายภายในไม่ได้'), '');
    }
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
};

// POST แบบไม่ตาม redirect และเชื่อมต่อเฉพาะ IP สาธารณะ — คืน HTTP status
function postPinned(url: string, body: string, headers: Record<string, string>) {
  return new Promise<number>((resolve, reject) => {
    const req = request(url, { method: 'POST', headers, lookup: publicOnlyLookup, timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on('timeout', () => req.destroy(new Error('ปลายทางไม่ตอบสนองภายใน 5 วินาที')));
    req.on('error', reject);
    req.end(body);
  });
}

// แจ้งร้านเมื่อมีออเดอร์ใหม่ ตามสิทธิ์ของแพ็กเกจ (ไม่ throw: ออเดอร์บันทึกไปแล้ว)
export async function notifyNewOrder(shop: NotifyShop, order: NotifyOrder, check?: SlipCheck | null) {
  const limits = PLAN_LIMITS[planOf(shop)];
  const jobs: Promise<unknown>[] = [];

  if (limits.lineNotify && shop.line_user_id && lineMessagingConfigured()) {
    jobs.push(
      pushMessage(shop.line_user_id, [{ type: 'text', text: orderLineText(shop, order, check) }]).catch((err) =>
        console.error('[notify] LINE failed', err)
      )
    );
  }
  if (limits.webhook && shop.order_webhook_url) {
    jobs.push(sendWebhook(shop, 'order.created', order, check).catch((err) => console.error('[notify] webhook failed', err)));
  }
  await Promise.all(jobs);
}
