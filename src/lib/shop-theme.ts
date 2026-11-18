import type { CSSProperties } from 'react';
import { PLAN_LIMITS, planOf } from '@/lib/plans';

// ชุดสีหน้าร้าน: เฉด 300–700 (โหมดสว่างจะสลับไปใช้เฉดเข้มเองใน globals.css → .shop-theme)
export const PALETTES = {
  blue: { label: 'น้ำเงิน PayBio', shades: ['#93c5fd', '#6b95f5', '#1e4fd8', '#1a43b8', '#163a9e'] },
  emerald: { label: 'เขียวมรกต', shades: ['#6ee7b7', '#34d399', '#059669', '#047857', '#065f46'] },
  teal: { label: 'เขียวน้ำทะเล', shades: ['#5eead4', '#2dd4bf', '#0d9488', '#0f766e', '#115e59'] },
  violet: { label: 'ม่วง', shades: ['#c4b5fd', '#a78bfa', '#7c3aed', '#6d28d9', '#5b21b6'] },
  pink: { label: 'ชมพู', shades: ['#f9a8d4', '#f472b6', '#db2777', '#be185d', '#9d174d'] },
  rose: { label: 'แดงกุหลาบ', shades: ['#fda4af', '#fb7185', '#e11d48', '#be123c', '#9f1239'] },
  orange: { label: 'ส้ม', shades: ['#fdba74', '#fb923c', '#ea580c', '#c2410c', '#9a3412'] },
  amber: { label: 'ทอง', shades: ['#fcd34d', '#fbbf24', '#b45309', '#92400e', '#78350f'] },
} as const;

export type PaletteKey = keyof typeof PALETTES;

// ฟอนต์ที่รองรับภาษาไทย (ตัวแปร CSS มาจาก src/lib/shop-fonts.ts)
export const FONTS = {
  noto: { label: 'Noto Sans Thai', note: 'อ่านง่าย มาตรฐาน', cssVar: '--font-noto-sans-thai' },
  prompt: { label: 'Prompt', note: 'ทันสมัย เป็นมิตร', cssVar: '--font-shop-prompt' },
  kanit: { label: 'Kanit', note: 'หนักแน่น โดดเด่น', cssVar: '--font-shop-kanit' },
  sarabun: { label: 'Sarabun', note: 'สุภาพ เป็นทางการ', cssVar: '--font-shop-sarabun' },
  mitr: { label: 'Mitr', note: 'มน น่ารัก', cssVar: '--font-shop-mitr' },
  plex: { label: 'IBM Plex Sans Thai', note: 'เรียบ มินิมอล', cssVar: '--font-shop-plex' },
} as const;

export type FontKey = keyof typeof FONTS;

export type ShopTheme = { palette?: PaletteKey; font?: FontKey; custom_color?: string | null };

export const HEX_RE = /^#[0-9a-f]{6}$/i;

const isPalette = (v: unknown): v is PaletteKey => typeof v === 'string' && Object.hasOwn(PALETTES, v);
const isFont = (v: unknown): v is FontKey => typeof v === 'string' && Object.hasOwn(FONTS, v);

// สร้างเฉด 300–700 จากสีเดียว (Business: สีแบรนด์ของร้านเอง)
function shadesFromHex(hex: string) {
  return [
    `color-mix(in oklab, ${hex} 45%, white)`,
    `color-mix(in oklab, ${hex} 70%, white)`,
    hex,
    `color-mix(in oklab, ${hex} 82%, black)`,
    `color-mix(in oklab, ${hex} 68%, black)`,
  ];
}

// ธีมที่ใช้งานจริงตามสิทธิ์ของแพ็กเกจ (แพ็กเกจลดลง → กลับเป็นค่าเริ่มต้น)
export function resolveTheme(theme: unknown, plan: string | null | undefined) {
  const level = PLAN_LIMITS[planOf({ plan })].theme;
  const t = (theme && typeof theme === 'object' ? theme : {}) as ShopTheme;
  const palette: PaletteKey = level !== 'standard' && isPalette(t.palette) ? t.palette : 'blue';
  const font: FontKey = level !== 'standard' && isFont(t.font) ? t.font : 'noto';
  const custom = level === 'custom' && t.custom_color && HEX_RE.test(t.custom_color) ? t.custom_color : null;
  return { palette, font, custom_color: custom };
}

// style สำหรับ element ที่มี class "shop-theme"
export function themeStyle(theme: { palette: PaletteKey; font: FontKey; custom_color: string | null }) {
  const shades = theme.custom_color ? shadesFromHex(theme.custom_color) : PALETTES[theme.palette].shades;
  return {
    '--p300': shades[0],
    '--p400': shades[1],
    '--p500': shades[2],
    '--p600': shades[3],
    '--p700': shades[4],
    fontFamily: `var(${FONTS[theme.font].cssVar}), ui-sans-serif, system-ui, sans-serif`,
  } as CSSProperties;
}

// ตรวจข้อมูลที่ร้านส่งมาบันทึก
export function parseThemeInput(body: unknown, level: 'standard' | 'palette' | 'custom'): ShopTheme | string {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isPalette(b.palette)) return 'ชุดสีไม่ถูกต้อง';
  if (!isFont(b.font)) return 'ฟอนต์ไม่ถูกต้อง';
  const custom = b.custom_color ? String(b.custom_color) : null;
  if (custom && !HEX_RE.test(custom)) return 'รหัสสีต้องอยู่ในรูปแบบ #RRGGBB';
  if (custom && level !== 'custom') return 'สีแบรนด์ของตัวเองใช้ได้เฉพาะแพ็กเกจ Business Studio';
  return { palette: b.palette, font: b.font, custom_color: custom };
}
