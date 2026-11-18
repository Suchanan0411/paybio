'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';

type Product = { id: string; name: string; image_url?: string | null };

// รูปสินค้าในหน้าจัดการร้าน: กดที่กรอบเพื่อเพิ่ม/เปลี่ยนรูป, ปุ่ม × เพื่อลบ
export function ProductImagePicker<T extends Product>({
  product,
  onChange,
  notify,
}: {
  product: T;
  onChange: (product: T) => void;
  notify: (kind: 'ok' | 'error', text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.append('product_id', product.id);
      body.append('file', file);
      const res = await fetch('/api/products/image', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปโหลดไม่สำเร็จ');
      onChange({ ...product, ...data.product });
      notify('ok', `เพิ่มรูป "${product.name}" แล้ว`);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!window.confirm(`ลบรูปของ "${product.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/products/image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ');
      onChange({ ...product, ...data.product });
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={product.image_url ? 'เปลี่ยนรูปสินค้า' : 'เพิ่มรูปสินค้า'}
        aria-label={product.image_url ? `เปลี่ยนรูปของ ${product.name}` : `เพิ่มรูปให้ ${product.name}`}
        className="w-14 h-14 rounded-xl overflow-hidden border border-slate-700 bg-slate-800/60 hover:border-brand-500 flex items-center justify-center text-slate-500 hover:text-brand-400 transition cursor-pointer disabled:cursor-wait"
      >
        {busy ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlus className="w-5 h-5" />
        )}
      </button>
      {product.image_url && !busy && (
        <button
          type="button"
          onClick={remove}
          title="ลบรูป"
          aria-label={`ลบรูปของ ${product.name}`}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 border border-slate-600 text-slate-300 hover:text-rose-400 hover:border-rose-400 flex items-center justify-center cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => upload(e.target.files?.[0])}
      />
    </div>
  );
}
