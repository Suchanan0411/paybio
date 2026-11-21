'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Lock, Palette, ShoppingBag } from 'lucide-react';
import {
  FONTS,
  HEX_RE,
  PALETTES,
  resolveTheme,
  themeStyle,
  type FontKey,
  type PaletteKey,
} from '@/lib/shop-theme';
import { SHOP_FONT_VARIABLES } from '@/lib/shop-fonts';
import { initialOf } from '@/lib/initial';

type ThemeShop = { shop_name: string; plan?: string | null; theme?: unknown };

export function ThemePicker({
  shop,
  level,
  onShopChange,
  notify,
}: {
  shop: ThemeShop;
  level: 'standard' | 'palette' | 'custom';
  onShopChange: (shop: { theme?: unknown }) => void;
  notify: (type: 'ok' | 'error', text: string) => void;
}) {
  const current = resolveTheme(shop.theme, shop.plan);
  const [palette, setPalette] = useState<PaletteKey>(current.palette);
  const [font, setFont] = useState<FontKey>(current.font);
  const [useCustom, setUseCustom] = useState(!!current.custom_color);
  const [customColor, setCustomColor] = useState(current.custom_color ?? '#1e4fd8');
  const [saving, setSaving] = useState(false);

  const locked = level === 'standard';
  const customValid = HEX_RE.test(customColor);
  const preview = {
    palette,
    font,
    custom_color: level === 'custom' && useCustom && customValid ? customColor : null,
  };
  const dirty =
    preview.palette !== current.palette || preview.font !== current.font || preview.custom_color !== current.custom_color;

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/shop/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      onShopChange({ theme: data.shop.theme });
      notify('ok', 'บันทึกธีมหน้าร้านแล้ว');
    } catch (err) {
      notify('error', 'บันทึกธีมไม่สำเร็จ: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
        <Palette className="w-4 h-4 text-brand-400" /> ธีมหน้าร้าน
      </div>

      {/* ตัวอย่างหน้าร้าน */}
      <div
        style={themeStyle(preview)}
        className={`shop-theme ${SHOP_FONT_VARIABLES} rounded-2xl border border-slate-800 bg-slate-950 p-4`}
        aria-label="ตัวอย่างหน้าร้าน"
      >
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-linear-to-br from-brand-400 to-brand-700 text-white font-bold flex items-center justify-center">
            {initialOf(shop.shop_name)}
          </span>
          <div className="min-w-0">
            <p className="font-bold truncate">{shop.shop_name}</p>
            <span className="inline-block text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full">
              รับชำระผ่านพร้อมเพย์
            </span>
          </div>
        </div>
        <div className="mt-3 glass rounded-xl p-3 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <ShoppingBag className="w-4 h-4" />
          </span>
          <span className="flex-1 text-sm">
            <span className="block font-semibold">สินค้าตัวอย่าง</span>
            <span className="block text-brand-400 font-bold">฿290</span>
          </span>
          <span className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-500">สั่งซื้อ</span>
        </div>
      </div>

      {locked && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" /> แพ็กเกจ Free ใช้สีมาตรฐาน (Dark/Light) · เลือกชุดสีและฟอนต์ได้ตั้งแต่ Pro ·{' '}
          <Link href="/upgrade" className="text-brand-400 hover:underline">
            ดูแพ็กเกจ
          </Link>
        </p>
      )}

      <fieldset disabled={locked} className="space-y-4 disabled:opacity-50">
        <div>
          <p className="text-xs text-slate-400 mb-2">ชุดสี</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
              const active = !preview.custom_color && palette === key;
              return (
                <button
                  key={key}
                  type="button"
                  title={PALETTES[key].label}
                  aria-label={PALETTES[key].label}
                  aria-pressed={active}
                  onClick={() => {
                    setPalette(key);
                    setUseCustom(false);
                  }}
                  className={`h-10 rounded-xl flex items-center justify-center border-2 transition cursor-pointer disabled:cursor-not-allowed ${
                    active ? 'border-ink' : 'border-transparent'
                  }`}
                  style={{ background: PALETTES[key].shades[2] }}
                >
                  {active && <Check className="w-4 h-4 text-white" />}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {preview.custom_color ? 'ใช้สีแบรนด์ของคุณเอง' : PALETTES[palette].label}
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5">
            สีแบรนด์ของคุณเอง
            {level !== 'custom' && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                <Lock className="w-3 h-3" /> Business Studio
              </span>
            )}
          </p>
          <div className={`flex items-center gap-2 ${level !== 'custom' ? 'opacity-50' : ''}`}>
            <input
              type="color"
              value={customValid ? customColor : '#1e4fd8'}
              disabled={level !== 'custom'}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setUseCustom(true);
              }}
              aria-label="เลือกสีแบรนด์"
              className="w-10 h-10 rounded-lg bg-transparent border border-slate-700 cursor-pointer disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={customColor}
              disabled={level !== 'custom'}
              maxLength={7}
              onChange={(e) => {
                setCustomColor(e.target.value.trim());
                setUseCustom(true);
              }}
              aria-label="รหัสสี"
              className={`w-28 bg-slate-800/80 border rounded-xl px-3 py-2 text-sm font-mono text-ink focus:outline-none focus:border-brand-500 ${
                customValid ? 'border-slate-700' : 'border-rose-500'
              }`}
            />
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-2">ฟอนต์</p>
          <div className={`${SHOP_FONT_VARIABLES} grid grid-cols-1 sm:grid-cols-2 gap-2`}>
            {(Object.keys(FONTS) as FontKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={font === key}
                onClick={() => setFont(key)}
                className={`text-left rounded-xl border px-3 py-2.5 transition cursor-pointer disabled:cursor-not-allowed ${
                  font === key ? 'border-brand-500 bg-brand-500/10' : 'border-slate-800 hover:bg-slate-800/60'
                }`}
              >
                <span className="block text-sm font-semibold" style={{ fontFamily: `var(${FONTS[key].cssVar})` }}>
                  ร้านของฉัน ฿290
                </span>
                <span className="block text-[11px] text-slate-500">
                  {FONTS[key].label} · {FONTS[key].note}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={locked || saving || !dirty || (useCustom && level === 'custom' && !customValid)}
          className="text-white w-full py-2.5 btn-primary disabled:opacity-50 text-xs font-semibold rounded-xl transition cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? 'กำลังบันทึก...' : dirty ? 'บันทึกธีม' : 'บันทึกแล้ว'}
        </button>
      </fieldset>
    </div>
  );
}
