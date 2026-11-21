import type { SVGProps } from 'react';

// สัญลักษณ์ PayBio: กระเป๋าเงินสีน้ำเงิน การ์ดสีฟ้า และคลื่นสัญญาณ
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 -4 110 116" aria-hidden="true" {...props}>
      <rect x="17" y="5" width="74" height="45" rx="11" fill="#38bdf8" transform="rotate(-8 54 27)" />
      <rect x="0" y="33" width="110" height="78" rx="24" fill="#1e4fd8" />
      <g fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round">
        <path d="M35.1 91.2A23 23 0 1 1 75.4 91.2" />
        <path d="M45.4 86.9A12 12 0 1 1 65.1 86.9" />
        <circle cx="55.25" cy="80" r="3.6" strokeWidth="4.2" />
      </g>
    </svg>
  );
}

// โลโก้เต็ม: สัญลักษณ์ + ตัวอักษร PayBio (สีตามต้นฉบับ — โหมดมืดใช้ตัวอักษรสีอ่อนแทน)
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const mark = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const text = size === 'sm' ? 'text-2xl' : 'text-3xl';
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={`${mark} shrink-0`} />
      <span className={`${text} font-display font-bold tracking-tight leading-none`}>
        <span className="text-[#0b172f] dark:text-[#eef2fa]">Pay</span>
        <span className="text-[#1e4fd8] dark:text-[#7ea6fb]">Bio</span>
      </span>
    </span>
  );
}
