'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, Copy, Lock, Send, Webhook } from 'lucide-react';
import { LineIcon } from '@/components/onboarding';

type LineStatus = { connected: boolean; code: string | null; expires_at: string | null; oa_id: string | null };
type ShopWebhook = { order_webhook_url?: string | null; order_webhook_secret?: string | null };

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';
const ghostButton =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-50 transition cursor-pointer';

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

export function OrderNotifications({
  lineAllowed,
  webhookAllowed,
  shop,
  onShopChange,
  notify,
}: {
  lineAllowed: boolean;
  webhookAllowed: boolean;
  shop: ShopWebhook;
  onShopChange: (shop: ShopWebhook) => void;
  notify: (type: 'ok' | 'error', text: string) => void;
}) {
  const [line, setLine] = useState<LineStatus | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState(shop.order_webhook_url ?? '');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!lineAllowed) return;
    request<LineStatus>('/api/shop/line').then(
      (status) => setLine(status),
      (err) => setLineError(err instanceof Error ? err.message : 'โหลดสถานะไม่สำเร็จ')
    );
  }, [lineAllowed]);

  // รอให้ร้านส่งรหัสใน LINE: เช็กสถานะทุก 3 วินาทีจนกว่าจะเชื่อมต่อหรือรหัสหมดอายุ
  const waiting = !!line && !line.connected && !!line.code;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      const next = await request<LineStatus>('/api/shop/line').catch(() => null);
      if (!next) return;
      setLine(next);
      if (next.connected) notify('ok', 'เชื่อมต่อ LINE สำเร็จ');
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting, notify]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setBusy(null);
    }
  };

  const oaId = line?.oa_id ?? '';
  const addFriendUrl = `https://line.me/R/ti/p/${encodeURIComponent(oaId)}`;
  const sendCodeUrl = line?.code ? `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(line.code)}` : '';

  return (
    <div className="glass p-5 rounded-2xl space-y-5">
      <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
        <Bell className="w-4 h-4 text-brand-400" /> แจ้งเตือนออเดอร์ใหม่
      </div>

      {/* LINE OA */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LineIcon className="w-4 h-4" /> LINE
          {line?.connected && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full border bg-brand-500/10 text-brand-400 border-brand-500/30">
              เชื่อมต่อแล้ว
            </span>
          )}
        </div>

        {!lineAllowed ? (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> ใช้ได้ตั้งแต่แพ็กเกจ Pro Merchant ·{' '}
            <Link href="/upgrade" className="text-brand-400 hover:underline">
              ดูแพ็กเกจ
            </Link>
          </p>
        ) : lineError ? (
          <p className="text-xs text-amber-400">{lineError}</p>
        ) : !line ? (
          <p className="text-xs text-slate-500">กำลังโหลด...</p>
        ) : line.connected ? (
          <>
            <p className="text-xs text-slate-400">
              ทุกออเดอร์ใหม่จะส่งเข้า LINE ของคุณทันที พร้อมยอดเงิน ข้อมูลลูกค้า และผลตรวจสลิป
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  run('test', async () => {
                    await request('/api/shop/line', 'POST', { action: 'test' });
                    notify('ok', 'ส่งข้อความทดสอบแล้ว ลองเปิด LINE ดู');
                  })
                }
                disabled={!!busy}
                className={ghostButton}
              >
                <Send className="w-3.5 h-3.5" /> {busy === 'test' ? 'กำลังส่ง...' : 'ส่งข้อความทดสอบ'}
              </button>
              <button
                onClick={() =>
                  run('unlink', async () => {
                    await request('/api/shop/line', 'DELETE');
                    setLine({ ...line, connected: false, code: null, expires_at: null });
                    notify('ok', 'ยกเลิกการเชื่อมต่อ LINE แล้ว');
                  })
                }
                disabled={!!busy}
                className={`${ghostButton} hover:text-rose-400`}
              >
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          </>
        ) : line.code ? (
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
            <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
              <li>
                เพิ่มเพื่อน LINE OA ของ PayBio{oaId && <span className="font-mono text-slate-400"> ({oaId})</span>}
              </li>
              <li>ส่งรหัสด้านล่างในแชต ระบบจะเชื่อมต่อให้อัตโนมัติ</li>
            </ol>
            <p className="text-center text-3xl font-bold font-mono tracking-[0.3em] text-ink">{line.code}</p>
            <div className="grid grid-cols-2 gap-2">
              <a href={addFriendUrl} target="_blank" rel="noreferrer" className={ghostButton}>
                1. เพิ่มเพื่อน
              </a>
              <a
                href={sendCodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#06C755] hover:opacity-90"
              >
                2. ส่งรหัสใน LINE
              </a>
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              รอการเชื่อมต่อ... รหัสหมดอายุ{' '}
              {line.expires_at &&
                new Date(line.expires_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}{' '}
              น.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400">รับแจ้งเตือนทันทีเมื่อลูกค้าส่งสลิป ไม่ต้องคอยเปิดหน้าจัดการร้าน</p>
            <button
              onClick={() =>
                run('link', async () => {
                  setLine(await request<LineStatus>('/api/shop/line', 'POST', { action: 'link' }));
                })
              }
              disabled={!!busy}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold text-white bg-[#06C755] hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <LineIcon className="w-4 h-4" /> {busy === 'link' ? 'กำลังสร้างรหัส...' : 'เชื่อมต่อ LINE'}
            </button>
          </>
        )}
      </section>

      {/* Webhook (Business) */}
      <section className="space-y-3 border-t border-slate-800 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Webhook className="w-4 h-4 text-brand-400" /> Webhook ไปยังระบบของคุณ
        </div>
        {!webhookAllowed ? (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> ใช้ได้เฉพาะแพ็กเกจ Business Studio ·{' '}
            <Link href="/upgrade" className="text-brand-400 hover:underline">
              ดูแพ็กเกจ
            </Link>
          </p>
        ) : (
          <form
            onSubmit={(e: React.SubmitEvent<HTMLFormElement>) => {
              e.preventDefault();
              void run('webhook', async () => {
                const data = await request<{ shop: ShopWebhook }>('/api/shop/webhook', 'PUT', { url: webhookUrl });
                onShopChange(data.shop);
                setWebhookUrl(data.shop.order_webhook_url ?? '');
                notify('ok', data.shop.order_webhook_url ? 'บันทึก Webhook แล้ว' : 'ลบ Webhook แล้ว');
              });
            }}
            className="space-y-3"
          >
            <input
              type="url"
              placeholder="https://example.com/paybio-webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className={`${inputClass} font-mono`}
            />
            {shop.order_webhook_secret && (
              <div>
                <p className="text-[11px] text-slate-400 mb-1">
                  Signing secret (ใช้ตรวจ header <span className="font-mono">X-PayBio-Signature</span> = sha256 HMAC ของ body)
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shop.order_webhook_secret ?? '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="w-full flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 cursor-pointer"
                >
                  <span className="truncate flex-1 text-left">{shop.order_webhook_secret}</span>
                  {copied ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              ระบบจะส่ง POST แบบ JSON (event <span className="font-mono">order.created</span>) ทุกครั้งที่มีออเดอร์ใหม่
              รองรับเฉพาะ https · เว้นว่างแล้วบันทึกเพื่อลบ
            </p>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!!busy}
                className="flex-1 text-white py-2 btn-primary disabled:opacity-50 text-xs font-semibold rounded-xl cursor-pointer"
              >
                {busy === 'webhook' ? 'กำลังบันทึก...' : 'บันทึก Webhook'}
              </button>
              {shop.order_webhook_url && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    run('webhook-test', async () => {
                      await request('/api/shop/webhook', 'POST');
                      notify('ok', 'ส่ง event ทดสอบสำเร็จ');
                    })
                  }
                  className={ghostButton}
                >
                  <Send className="w-3.5 h-3.5" /> {busy === 'webhook-test' ? 'กำลังส่ง...' : 'ทดสอบ'}
                </button>
              )}
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
