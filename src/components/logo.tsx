import { useId, type SVGProps } from 'react';

// สัญลักษณ์ PayBio: กล่องสีฟ้า คลื่นสัญญาณ และเครื่องหมายถูก
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  const gradientId = useId();
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f9cf9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.7 18.5A13 13 0 0 1 35.3 18.5" opacity=".75" />
        <path d="M16.2 20.5A9 9 0 0 1 31.8 20.5" opacity=".9" />
        <path d="M19.7 22.5A5 5 0 0 1 28.3 22.5" />
        <path d="M17.5 30.5 22 35l9-9" strokeWidth="3" />
      </g>
    </svg>
  );
}

// โลโก้เต็ม: สัญลักษณ์ + ตัวอักษร Pay / BIO
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const mark = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const pay = size === 'sm' ? 'text-xl' : 'text-2xl';
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={`${mark} shrink-0`} />
      <span className="flex flex-col leading-none">
        <span className={`${pay} font-bold text-brand-500 tracking-tight`}>Pay</span>
        <span className="text-[9px] font-semibold tracking-[0.35em] text-slate-400 mt-0.5">BIO</span>
      </span>
    </span>
  );
}
