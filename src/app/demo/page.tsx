'use client';
import generatePayload from 'promptpay-qr';
import { useState, type SVGProps } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 16V4m0 0 4 4m-4-4-4 4M5 16.5v1.5A2 2 0 0 0 7 20h10a2 2 0 0 0 2-2v-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M5 12.5 9.2 16.7 19 6.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M6 8h12l-1 11H7L6 8Zm3-2a3 3 0 0 1 6 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function ShopDemo() {
  const item = {
    title: 'PayBio Premium Pass (Demo)',
    price: 200,
  };

  const promptpayNumber = '0812345678'; // เปลี่ยนเป็นเบอร์พร้อมเพย์ หรือเลขบัตรประชาชนของคุณ
  const qrPayload = generatePayload(promptpayNumber, { amount: item.price });

  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [successOrder, setSuccessOrder] = useState<{ order_number: string } | null>(null);

  const handleSubmit = async () => {
    if (!file) {
      alert('กรุณาแนบภาพสลิปโอนเงินก่อนครับ');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('slip', file);
      formData.append('item_title', item.title);
      formData.append('amount', item.price.toString());

      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessOrder(data.order);
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BagIcon className="text-brand-400" /> PayBio Store Demo
          </h1>
          <Link
            href="/manage"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            ไปหน้าจัดการร้าน
          </Link>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 mb-6">
          <p className="text-slate-400 text-sm">สินค้าตัวอย่าง</p>
          <div className="flex justify-between items-end mt-2">
            <span className="font-semibold text-lg">{item.title}</span>
            <span className="text-2xl font-bold text-brand-400">฿{item.price}</span>
          </div>
        </div>

        <button
          onClick={() => {
            setSuccessOrder(null);
            setFile(null);
            setIsOpen(true);
          }}
          className="text-white w-full py-3 bg-brand-500 hover:bg-brand-600 font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-brand-500/20"
        >
          สั่งซื้อทันที
        </button>
      </div>

      {/* Modal ชำระเงิน */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center relative">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-ink"
            >
              ✕
            </button>

            {!successOrder ? (
              <>
                <h3 className="text-lg font-bold">สแกนชำระผ่านพร้อมเพย์</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  ยอดที่ต้องชำระ <span className="text-brand-400 font-bold">฿{item.price}</span>
                </p>

                <div className="bg-white p-4 rounded-xl inline-block shadow-inner mb-4">
                  <QRCodeSVG value={qrPayload} size={180} />
                  <p className="text-gray-600 text-[10px] mt-2 font-mono">Thai PromptPay • ฿{item.price}</p>
                </div>

                <div className="border-2 border-dashed border-slate-700 hover:border-brand-500/50 rounded-xl p-4 mb-4 transition text-center">
                  <input
                    type="file"
                    id="slip"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="slip" className="cursor-pointer flex flex-col items-center gap-1">
                    <UploadIcon className="w-6 h-6 text-slate-400" />
                    <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                      {file ? file.name : 'เลือกรูปสลิปจากเครื่อง'}
                    </span>
                    <span className="text-[10px] text-slate-500">รองรับ JPG, PNG</span>
                  </label>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 font-semibold rounded-xl text-sm disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'กำลังบันทึก...' : 'ยืนยันคำสั่งซื้อ'}
                </button>
              </>
            ) : (
              <div className="py-4">
                <CheckIcon className="w-12 h-12 text-brand-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold">สั่งซื้อสำเร็จแล้ว!</h3>
                <p className="text-xs text-slate-400 mt-1">รหัสสั่งซื้อ: {successOrder.order_number}</p>
                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    href="/manage"
                    className="text-white w-full py-2 bg-brand-500 hover:bg-brand-600 text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <EyeIcon className="w-4 h-4" /> ดูที่หน้าจัดการร้าน
                  </Link>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-xl text-slate-300"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}