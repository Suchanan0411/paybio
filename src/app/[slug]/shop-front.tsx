'use client';

import { useEffect, useState, use } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import generatePayload from 'promptpay-qr';
import { supabase } from '@/lib/supabase';
import { Store, UploadCloud, CheckCircle2, ShoppingBag } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function ShopFrontPage({ params }: PageProps) {
  // แกะค่า slug ออกมาจาก params Promise ด้วย use() ของ React
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loadingShop, setLoadingShop] = useState(true);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<any>(null);

  useEffect(() => {
    async function loadShopAndProducts() {
      if (!slug) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('slug', slug)
        .single();

      if (profile) {
        setShop(profile);

        const { data: prods } = await supabase
          .from('products')
          .select('*')
          .eq('profile_id', profile.id)
          .order('created_at', { ascending: false });

        setProducts(prods || []);
      }
      setLoadingShop(false);
    }
    loadShopAndProducts();
  }, [slug]);

  if (loadingShop) {
    return (
      <div className="min-h-screen bg-slate-950 text-ink flex items-center justify-center text-sm">
        กำลังโหลดหน้าร้านค้า...
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-2">ไม่พบร้านค้านี้</h2>
        <p className="text-sm text-slate-400">ลิงก์ร้านค้า paybio.me/{slug} อาจไม่มีอยู่จริง</p>
      </div>
    );
  }

  const qrPayload = selectedItem
    ? generatePayload(shop.promptpay_number, { amount: selectedItem.price })
    : '';

  const handleSubmitOrder = async () => {
    if (!file) {
      alert('กรุณาแนบรูปสลิปโอนเงินก่อนครับ');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('slip', file);
      formData.append('item_title', selectedItem.name);
      formData.append('amount', selectedItem.price.toString());
      formData.append('profile_id', shop.id);

      const res = await fetch('/api/orders', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessOrder(data.order);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
        
        {/* หัวโปรไฟล์ร้าน */}
        <div className="w-16 h-16 bg-brand-500/10 border border-brand-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <Store className="w-8 h-8 text-brand-400" />
        </div>
        <h1 className="text-2xl font-bold">{shop.shop_name}</h1>
        {shop.bio && <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{shop.bio}</p>}
        <span className="inline-block mt-2 text-[11px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full border border-slate-700 font-mono">
          พร้อมเพย์: {shop.promptpay_number}
        </span>

        {/* รายการสินค้าที่ร้านวางจำหน่าย */}
        <div className="mt-6 space-y-3 text-left">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
            <ShoppingBag className="w-3.5 h-3.5" /> สินค้าและบริการ
          </div>

          {products.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-xs text-slate-500">
              ร้านนี้ยังไม่มีรายการสินค้าวางจำหน่าย
            </div>
          ) : (
            products.map((item) => (
              <div
                key={item.id}
                className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-2xl p-4 flex justify-between items-center transition"
              >
                <div>
                  <p className="font-semibold text-sm text-ink">{item.name}</p>
                  <p className="text-xs text-brand-400 font-bold mt-0.5">฿{item.price}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setFile(null);
                    setSuccessOrder(null);
                  }}
                  className="text-white px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  สั่งซื้อ
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal ชำระเงิน */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm text-center relative shadow-2xl">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-ink"
            >
              ✕
            </button>

            {!successOrder ? (
              <>
                <h3 className="text-base font-bold">สแกนชำระผ่าน PromptPay</h3>
                <p className="text-xs text-slate-400 mt-1 mb-3">
                  ชำระค่า <span className="text-ink font-medium">{selectedItem.name}</span> จำนวน{' '}
                  <span className="text-brand-400 font-bold">฿{selectedItem.price}</span>
                </p>

                <div className="bg-white p-3.5 rounded-2xl inline-block shadow-inner mb-4">
                  <QRCodeSVG value={qrPayload} size={170} />
                  <p className="text-gray-600 text-[10px] mt-1.5 font-mono">{shop.promptpay_number}</p>
                </div>

                <div className="border-2 border-dashed border-slate-700 hover:border-brand-500/50 rounded-xl p-3.5 mb-4 transition text-center">
                  <input
                    type="file"
                    id="slip-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="slip-upload" className="cursor-pointer flex flex-col items-center gap-1">
                    <UploadCloud className="w-5 h-5 text-slate-400" />
                    <span className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                      {file ? file.name : 'แนบรูปภาพสลิปโอนเงิน'}
                    </span>
                    <span className="text-[10px] text-slate-500">รองรับไฟล์ JPG, PNG</span>
                  </label>
                </div>

                <button
                  onClick={handleSubmitOrder}
                  disabled={submitting}
                  className="text-white w-full py-2.5 bg-brand-500 hover:bg-brand-600 font-semibold rounded-xl text-xs disabled:opacity-50 transition cursor-pointer"
                >
                  {submitting ? 'กำลังส่งข้อมูล...' : 'ส่งสลิปยืนยันคำสั่งซื้อ'}
                </button>
              </>
            ) : (
              <div className="py-4">
                <CheckCircle2 className="w-12 h-12 text-brand-400 mx-auto mb-3" />
                <h3 className="text-base font-bold">แจ้งชำระเงินเรียบร้อย!</h3>
                <p className="text-xs text-slate-400 mt-1">รหัสคำสั่งซื้อ: {successOrder.order_number}</p>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl text-slate-300"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}