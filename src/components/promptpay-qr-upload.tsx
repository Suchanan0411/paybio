'use client';

import { useRef, useState } from 'react';
import { QrCode, Upload, Trash2 } from 'lucide-react';

type Props = {
  url: string | null | undefined;
  onChange: (url: string | null) => void;
  notify: (kind: 'ok' | 'error', text: string) => void;
};

// อัปโหลดรูป QR พร้อมเพย์ของร้าน (เช่น QR ร้านค้าจากแอปธนาคาร) เพื่อแสดงบนหน้าร้าน
export function PromptpayQrUpload({ url, onChange, notify }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'delete' | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/shop/qr', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปโหลดไม่สำเร็จ');
      onChange(data.promptpay_qr_url);
      notify('ok', 'บันทึกรูป QR พร้อมเพย์แล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!window.confirm('ลบรูป QR พร้อมเพย์ของร้าน? หน้าร้านจะใช้ QR ที่ระบบสร้างตามยอดแทน')) return;
    setBusy('delete');
    try {
      const res = await fetch('/api/shop/qr', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ');
      onChange(null);
      notify('ok', 'ลบรูป QR แล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="glass p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
        <QrCode className="w-4 h-4 text-brand-400" /> รูป QR พร้อมเพย์ของร้าน
      </div>
      <p className="text-xs text-slate-400">
        อัปโหลดรูป QR รับเงินจากแอปธนาคารของร้าน (เช่น QR ร้านค้า / Thai QR) ลูกค้าจะเลือกสแกนรูปนี้ได้บนหน้าร้าน
        ระบบยังมี QR ที่ใส่ยอดเงินให้อัตโนมัติเป็นอีกตัวเลือกเสมอ
      </p>

      <div className="flex items-center gap-4">
        <div className="w-28 h-28 shrink-0 rounded-xl bg-white flex items-center justify-center overflow-hidden">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="QR พร้อมเพย์ของร้าน" className="w-full h-full object-contain" />
          ) : (
            <QrCode className="w-10 h-10 text-gray-300" />
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="promptpay-qr-upload"
            onChange={(e) => upload(e.target.files?.[0])}
          />
          <label
            htmlFor="promptpay-qr-upload"
            className={`text-white px-4 py-2 btn-primary rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              busy ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            {busy === 'upload' ? 'กำลังตรวจและอัปโหลด...' : url ? 'เปลี่ยนรูป QR' : 'อัปโหลดรูป QR'}
          </label>
          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={!!busy}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> {busy === 'delete' ? 'กำลังลบ...' : 'ลบรูป'}
            </button>
          )}
          <p className="text-[11px] text-slate-500">JPG / PNG ไม่เกิน 5 MB ต้องเห็น QR ชัดเจน</p>
        </div>
      </div>
    </div>
  );
}
