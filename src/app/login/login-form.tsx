'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, AlertCircle, ArrowRight, ArrowLeft, MailCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  OnboardingSteps,
  GoogleIcon,
  LineIcon,
} from '@/components/onboarding';
import { Logo } from '@/components/logo';
import { LiquidIndicator } from '@/components/liquid-indicator';

type Mode = 'signup' | 'login';
type Provider = 'google' | 'line';

const PROVIDERS: { key: Provider; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: 'google', label: 'Google', Icon: GoogleIcon },
  { key: 'line', label: 'LINE', Icon: LineIcon },
];

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500 transition';

function errorMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (/already registered|already exists/i.test(msg)) return 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ';
  if (/email not confirmed/i.test(msg)) return 'กรุณายืนยันอีเมลจากลิงก์ที่ส่งไปก่อนเข้าสู่ระบบ';
  if (/provider is not enabled/i.test(msg)) return 'ยังไม่ได้เปิดใช้งานการเชื่อมต่อนี้ใน Supabase';
  const wait = msg.match(/only request this after (\d+) seconds?/i);
  if (wait) return `ส่งคำขอถี่เกินไป กรุณารอ ${wait[1]} วินาทีแล้วลองใหม่ (ถ้ากดไปแล้ว ลองเช็กอีเมลก่อน)`;
  if (/email rate limit exceeded/i.test(msg)) return 'ส่งอีเมลเกินจำนวนที่ระบบอนุญาตในชั่วโมงนี้ กรุณาลองใหม่ภายหลัง';
  return msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}

// ไปหน้าถัดไปตามสถานะ: admin → แผงผู้ดูแล, ยังไม่มีร้าน → ลงทะเบียนร้าน, มีร้านแล้ว → จัดการร้าน
async function nextPath() {
  const res = await fetch('/api/me', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.user?.isAdmin) return '/admin';
  return data.shop ? '/manage' : '/register';
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [errorMsg, setErrorMsg] = useState(searchParams.get('error') ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const isSignUp = mode === 'signup';

  // ลบ ?error= ออกจาก URL หลังแสดงแล้ว เพื่อไม่ให้ error เก่าค้างเมื่อรีเฟรช
  useEffect(() => {
    if (window.location.search.includes('error=') || window.location.hash.includes('error=')) {
      const mode = new URLSearchParams(window.location.search).get('mode');
      window.history.replaceState(null, '', mode ? `/login?mode=${mode}` : '/login');
    }
  }, []);

  // ถ้าล็อกอินอยู่แล้ว พาไปหน้าถัดไปทันที
  useEffect(() => {
    nextPath().then((path) => {
      if (path) router.replace(path);
    });
  }, [router]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrorMsg('');
    setConfirmPassword('');
  };

  const handleProvider = async (provider: 'google') => {
    setErrorMsg('');
    setPendingProvider(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErrorMsg(errorMessage(error));
      setPendingProvider(null);
    }
  };

  const handleEmailAuth = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    if (isSignUp && password !== confirmPassword) {
      setErrorMsg('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        // Supabase คืนผู้ใช้ที่ไม่มี identity เมื่ออีเมลนี้สมัครไว้แล้ว
        if (data.user && data.user.identities?.length === 0) {
          throw new Error('already registered');
        }
        if (!data.session) {
          // โปรเจกต์เปิดการยืนยันอีเมล — รอผู้ใช้กดลิงก์ในอีเมล
          setSentTo(email);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      router.push((await nextPath()) ?? '/register');
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) throw error;
      setResetSentTo(email.trim());
    } catch (err) {
      setErrorMsg(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (forgot) {
    return (
      <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4">
        <Link href="/" aria-label="PayBio หน้าแรก" className="mb-6">
          <Logo />
        </Link>
        <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 shadow-2xl">
          {resetSentTo ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-7 h-7 text-brand-400" />
              </div>
              <h1 className="text-xl font-bold">ตรวจสอบอีเมลของคุณ</h1>
              <p className="text-sm text-slate-400 mt-2">
                ถ้า <span className="text-ink font-medium">{resetSentTo}</span> มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว
                <br />
                เปิดลิงก์จากเบราว์เซอร์นี้เพื่อตั้งรหัสผ่านใหม่
              </p>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="text-center mb-2">
                <h1 className="text-2xl font-bold">ลืมรหัสผ่าน</h1>
                <p className="text-sm text-slate-400 mt-1">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>
              </div>
              {errorMsg && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> อีเมล
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="text-white w-full py-3 btn-primary disabled:opacity-50 font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/20"
              >
                {loading ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={() => {
              setForgot(false);
              setResetSentTo(null);
              setErrorMsg('');
            }}
            className="mt-6 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-ink transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> กลับไปหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md glass rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-14 h-14 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-xl font-bold">ยืนยันอีเมลของคุณ</h1>
          <p className="text-sm text-slate-400 mt-2">
            เราส่งลิงก์ยืนยันไปที่ <span className="text-ink font-medium">{sentTo}</span>
            <br />
            กดลิงก์ในอีเมลเพื่อเปิดใช้งานบัญชี แล้วระบบจะพาไปลงทะเบียนร้านค้าต่อทันที
          </p>
          <button
            onClick={() => {
              setSentTo(null);
              switchMode('login');
            }}
            className="mt-6 text-xs text-brand-400 hover:underline cursor-pointer"
          >
            ยืนยันแล้ว? เข้าสู่ระบบที่นี่
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4">
      <Link href="/" aria-label="PayBio หน้าแรก" className="mb-6">
          <Logo />
        </Link>

      <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 shadow-2xl">
        {isSignUp && <OnboardingSteps current={0} />}

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{isSignUp ? 'สร้างบัญชี PayBio' : 'ยินดีต้อนรับกลับมา'}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isSignUp
              ? 'สมัครฟรี แล้วเปิดหน้าร้านรับเงินพร้อมเพย์ได้ในไม่กี่นาที'
              : 'เข้าสู่ระบบเพื่อจัดการร้านค้าของคุณ'}
          </p>
        </div>

        {/* สลับ สมัครสมาชิก / เข้าสู่ระบบ */}
        <div className="liquid-host grid grid-cols-2 gap-1 p-1 bg-slate-800/60 rounded-xl mb-6 text-sm">
          <LiquidIndicator active={mode} variant="clear" />
          {(['signup', 'login'] as const).map((m) => (
            <button
              key={m}
              type="button"
              data-active={mode === m}
              onClick={() => switchMode(m)}
              className={`py-2 rounded-lg font-medium transition-colors duration-300 cursor-pointer ${
                mode === m ? 'text-ink' : 'text-slate-400 hover:text-ink'
              }`}
            >
              {m === 'signup' ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!showEmailForm ? (
          <div className="space-y-3">
            {PROVIDERS.map(({ key, label, Icon }) => {
              const className = `w-full flex items-center gap-3 py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl text-sm font-medium transition cursor-pointer ${
                pendingProvider !== null ? 'opacity-50 pointer-events-none' : ''
              }`;
              const content = (
                <>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 text-left">
                    {pendingProvider === key ? 'กำลังเชื่อมต่อ...' : `ดำเนินการต่อด้วย ${label}`}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                </>
              );

              // LINE ใช้ OAuth ของเราเองฝั่ง Server
              return key === 'line' ? (
                <a key={key} href={`/auth/social/${key}`} onClick={() => setPendingProvider(key)} className={className}>
                  {content}
                </a>
              ) : (
                <button key={key} type="button" onClick={() => handleProvider(key)} className={className}>
                  {content}
                </button>
              );
            })}

            <div className="relative flex items-center justify-center py-2">
              <div className="border-t border-slate-800 w-full" />
              <span className="px-3 text-xs text-slate-500 whitespace-nowrap">หรือ</span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            <button
              type="button"
              onClick={() => {
                setShowEmailForm(true);
                setErrorMsg('');
              }}
              className="text-white w-full flex items-center justify-center gap-2 py-3 btn-primary font-semibold rounded-xl text-sm transition cursor-pointer shadow-lg shadow-brand-500/20"
            >
              <Mail className="w-4 h-4" />
              {isSignUp ? 'สร้างบัญชีด้วยอีเมล' : 'เข้าสู่ระบบด้วยอีเมล'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" /> ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อของคุณ"
                  autoComplete="name"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> อีเมล
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> รหัสผ่าน
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'อย่างน้อย 6 ตัวอักษร' : '••••••••'}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className={inputClass}
              />
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setForgot(true);
                    setErrorMsg('');
                  }}
                  className="mt-1.5 text-[11px] text-brand-400 hover:underline cursor-pointer"
                >
                  ลืมรหัสผ่าน?
                </button>
              )}
            </div>

            {isSignUp && (
              <div>
                <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" /> ยืนยันรหัสผ่าน
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="พิมพ์รหัสผ่านอีกครั้ง"
                  autoComplete="new-password"
                  className={inputClass}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="text-white w-full py-3 btn-primary disabled:opacity-50 font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/20"
            >
              {loading ? 'กำลังดำเนินการ...' : isSignUp ? 'สร้างบัญชีและไปต่อ' : 'เข้าสู่ระบบ'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowEmailForm(false);
                setErrorMsg('');
              }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-ink transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> เลือกวิธีอื่น
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-500">
          การดำเนินการต่อถือว่าคุณยอมรับ{' '}
          <Link href="/terms" className="underline hover:text-ink">ข้อกำหนดการใช้งาน</Link>
          และ
          <Link href="/privacy" className="underline hover:text-ink">นโยบายความเป็นส่วนตัว</Link>
          ของ PayBio
        </p>
      </div>
    </div>
  );
}
