'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Logo } from '@/components/logo';

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500 transition';

// ปลายทางของลิงก์ "ลืมรหัสผ่าน" — /auth/callback สร้าง session ให้แล้ว หน้านี้แค่ตั้งรหัสใหม่
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<'loading' | 'ok' | 'no-session'>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setReady(data.user ? 'ok' : 'no-session'));
  }, []);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    if (password !== confirm) {
      setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErrorMsg(
        /different from the old/i.test(error.message)
          ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'
          : error.message || 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่'
      );
      return;
    }
    setDone(true);
    const res = await fetch('/api/me', { cache: 'no-store' });
    const me = res.ok ? await res.json() : null;
    setTimeout(() => router.replace(me?.user?.isAdmin ? '/admin' : me?.shop ? '/manage' : '/register'), 1500);
  };

  return (
    <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4">
      <Link href="/" aria-label="PayBio หน้าแรก" className="mb-6">
        <Logo />
      </Link>
      <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 shadow-2xl">
        {ready === 'loading' ? (
          <p className="text-center text-sm text-slate-400">กำลังโหลด...</p>
        ) : ready === 'no-session' ? (
          <div className="text-center">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold">ลิงก์หมดอายุหรือไม่ถูกต้อง</h1>
            <p className="text-sm text-slate-400 mt-2">กรุณาขอลิงก์ตั้งรหัสผ่านใหม่อีกครั้งจากหน้าเข้าสู่ระบบ</p>
            <Link href="/login" className="inline-block mt-6 text-sm text-brand-400 hover:underline">
              ไปหน้าเข้าสู่ระบบ
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h1 className="text-xl font-bold">ตั้งรหัสผ่านใหม่เรียบร้อย</h1>
            <p className="text-sm text-slate-400 mt-2">กำลังพาคุณไปยังร้านค้า...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
              <h1 className="text-2xl font-bold">ตั้งรหัสผ่านใหม่</h1>
              <p className="text-sm text-slate-400 mt-1">ใช้อย่างน้อย 6 ตัวอักษร</p>
            </div>
            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> รหัสผ่านใหม่
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="text-white w-full py-3 btn-primary disabled:opacity-50 font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-brand-500/20"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
