import { createHmac, timingSafeEqual } from 'node:crypto';

// LINE Messaging API ของ LINE OA ที่ PayBio ใช้ส่งแจ้งเตือนให้ร้านค้า
// (คนละ channel กับ LINE Login: LINE_CHANNEL_ID / LINE_CHANNEL_SECRET)
const API = 'https://api.line.me/v2/bot';

export function lineMessagingConfigured() {
  return !!(process.env.LINE_MESSAGING_ACCESS_TOKEN && process.env.LINE_MESSAGING_CHANNEL_SECRET);
}

// ตรวจว่า webhook มาจาก LINE จริง (x-line-signature = base64(HMAC-SHA256(channel secret, raw body)))
export function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const given = Buffer.from(signature, 'base64');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function call(path: string, init?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.LINE_MESSAGING_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
}

export type LineMessage = { type: 'text'; text: string };

export async function pushMessage(to: string, messages: LineMessage[]) {
  const res = await call('/message/push', { method: 'POST', body: JSON.stringify({ to, messages }) });
  if (!res.ok) throw new Error(`LINE push ${res.status}: ${await res.text()}`);
}

export async function replyMessage(replyToken: string, messages: LineMessage[]) {
  const res = await call('/message/reply', { method: 'POST', body: JSON.stringify({ replyToken, messages }) });
  if (!res.ok) console.error('[line] reply failed', res.status, await res.text());
}

// LINE ID ของ OA (เช่น @123abcde) สำหรับลิงก์เพิ่มเพื่อน
let basicIdCache: string | null = null;
export async function getOaBasicId() {
  if (basicIdCache) return basicIdCache;
  if (process.env.LINE_OA_BASIC_ID) return (basicIdCache = process.env.LINE_OA_BASIC_ID);
  const res = await call('/info');
  if (!res.ok) return null;
  const info = (await res.json()) as { basicId?: string };
  return (basicIdCache = info.basicId ?? null);
}
