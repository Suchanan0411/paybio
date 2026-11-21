'use client';

import { useLayoutEffect, useRef } from 'react';

type Box = { x: number; y: number; w: number; h: number };

const px = (b: Box) => ({ transform: `translate(${b.x}px, ${b.y}px)`, width: `${b.w}px`, height: `${b.h}px` });

/**
 * พื้นหลังแท็บแบบ "หยดน้ำกระจก" ที่ไหลไปหาแท็บที่เลือก
 * วางไว้ในกล่องที่มี class liquid-host และใส่ data-active บนปุ่มแท็บ
 * ตอนเปลี่ยนแท็บ: ยืดคลุมทั้งสองแท็บ บีบตัวเล็กน้อย แล้วเด้งเข้าที่แท็บใหม่
 */
export function LiquidIndicator({ active, variant = 'brand' }: { active: string; variant?: 'brand' | 'clear' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<Box | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;

    const place = (animate: boolean) => {
      const btn = host.querySelector<HTMLElement>(':scope > [data-active="true"]');
      if (!btn) {
        el.style.opacity = '0';
        prev.current = null;
        return;
      }
      const next: Box = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
      const from = prev.current;
      Object.assign(el.style, px(next), { opacity: '1' });
      prev.current = next;

      const moved = from && (from.x !== next.x || from.y !== next.y);
      if (!animate || !moved || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // ช่วงกลาง: ยืดคลุมจากแท็บเดิมถึงแท็บใหม่ (แถวเดียวกัน) แล้วบีบแนวตั้งเหมือนหยดน้ำถูกดึง
      const sameRow = from.y === next.y;
      const left = Math.min(from.x, next.x);
      const stretch: Box = sameRow
        ? { x: left, y: next.y, w: Math.max(from.x + from.w, next.x + next.w) - left, h: next.h }
        : { x: (from.x + next.x) / 2, y: (from.y + next.y) / 2, w: (from.w + next.w) / 2, h: next.h };
      // easing ต่อช่วง (ไม่ใส่ทั้งแอนิเมชัน ไม่งั้นช่วงยืดจะเร็วจนมองไม่เห็น):
      // ยืดออกช้าๆ → หดเข้าหาแท็บใหม่แล้วเลยไปนิด → เด้งกลับเข้าที่
      el.animate(
        [
          { ...px(from), offset: 0, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
          { ...px(stretch), transform: `${px(stretch).transform} scale(1, 0.84)`, offset: 0.4, easing: 'cubic-bezier(0.25, 0.9, 0.3, 1)' },
          { ...px(next), transform: `${px(next).transform} scale(1.05, 1.08)`, offset: 0.75, easing: 'ease-out' },
          { ...px(next), transform: `${px(next).transform} scale(1, 1)`, offset: 1 },
        ],
        { duration: 600, easing: 'linear' }
      );
    };

    place(true);
    // ขนาดกล่องเปลี่ยน (หมุนจอ / ตัวเลขในแท็บเปลี่ยน) = ย้ายตามโดยไม่เล่นแอนิเมชัน
    const ro = new ResizeObserver(() => place(false));
    ro.observe(host);
    return () => ro.disconnect();
  }, [active]);

  return <span ref={ref} aria-hidden="true" className={`liquid-indicator liquid-${variant}`} />;
}
