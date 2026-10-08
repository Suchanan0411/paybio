import type { SVGProps } from 'react';
import { Check } from 'lucide-react';

const STEPS = ['สร้างบัญชี', 'ลงทะเบียนร้านค้า', 'จัดการร้านค้า'];

// แถบแสดงขั้นตอนการเริ่มต้นใช้งาน (current เริ่มที่ 0)
export function OnboardingSteps({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 mb-6 text-[11px]">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold border ${
                done
                  ? 'bg-brand-500 border-brand-500 text-ink'
                  : active
                    ? 'border-brand-500 text-brand-400'
                    : 'border-slate-700 text-slate-500'
              }`}
            >
              {done ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span className={active ? 'text-ink font-medium' : 'text-slate-500'}>{label}</span>
            {i < STEPS.length - 1 && <span className="w-4 border-t border-slate-700" />}
          </li>
        );
      })}
    </ol>
  );
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
      <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
    </svg>
  );
}

export function LineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <rect width="24" height="24" rx="5.5" fill="#06C755" />
      <path
        fill="#fff"
        d="M19.6 11.1c0-3.4-3.4-6.2-7.6-6.2s-7.6 2.8-7.6 6.2c0 3.1 2.7 5.6 6.4 6.1.3.1.6.2.7.4.1.2.1.5 0 .7l-.1.7c0 .2-.2.8.7.4.9-.4 4.8-2.8 6.5-4.8 1.3-1.1 1-2.2 1-3.5Z"
      />
      <path
        fill="#06C755"
        d="M8.9 9.5h-.5a.1.1 0 0 0-.1.1v3.3c0 .1 0 .1.1.1h.5c.1 0 .1 0 .1-.1V9.6c0-.1 0-.1-.1-.1Zm3.7 0h-.5a.1.1 0 0 0-.1.1v2l-1.5-2.1h-.6a.1.1 0 0 0-.1.1v3.3c0 .1 0 .1.1.1h.5c.1 0 .1 0 .1-.1v-2l1.5 2.1h.6c.1 0 .1 0 .1-.1V9.6c0-.1 0-.1-.1-.1Zm-5 2.8H6.2V9.6c0-.1 0-.1-.1-.1h-.5a.1.1 0 0 0-.1.1v3.3h2.1c.1 0 .1 0 .1-.1v-.5c0-.1 0-.1-.1-.1Zm8.2-2.1c.1 0 .1 0 .1-.1v-.5c0-.1 0-.1-.1-.1h-2.1v3.4c0 .1 0 .1.1.1h2.1c.1 0 .1 0 .1-.1v-.5c0-.1 0-.1-.1-.1h-1.4v-.6h1.4c.1 0 .1 0 .1-.1v-.5c0-.1 0-.1-.1-.1h-1.4v-.6Z"
      />
    </svg>
  );
}
