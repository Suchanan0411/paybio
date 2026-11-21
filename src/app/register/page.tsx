'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Link as LinkIcon, Phone, FileText, ArrowRight, LogOut, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { OnboardingSteps } from '@/components/onboarding';

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500 transition';

// แปลงข้อความเป็น slug: ตัวพิมพ์เล็ก, เว้นวรรคเป็นขีด, ตัดอักขระพิเศษออก
function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-ก-๙]/g, '')
    .replace(/-+/g, '-');
}

export default function RegisterShopPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [account, setAccount] = useState<{ email?: string; name?: string | null } | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [formData, setFormData] = useState({
    shop_name: '',
    slug: '',
    promptpay_number: '',
    bio: '',
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ต้องล็อกอินก่อน และถ้ามีร้านอยู่แล้วให้ไปหน้าจัดการร้าน
  useEffect(() => {
    const toLogin = (error?: string) =>
      router.replace(error ? `/login?error=${encodeURIComponent(error)}` : '/login?mode=signup');

    fetch('/api/me', { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) return toLogin();
        if (!res.ok) return toLogin('ตรวจสอบบัญชีไม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง');

        const data = await res.json();
        if (!data.user) return toLogin();
        if (data.shop) {
          router.replace('/manage');
          return;
        }
        if (data.user.isAdmin) {
          router.replace('/admin');
          return;
        }
        setAccount(data.user);
        setFormData((prev) => ({ ...prev, shop_name: prev.shop_name || data.user.name || '' }));
        setChecking(false);
      })
      .catch(() => toLogin('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่'));
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'shop_name') {
      // สร้าง slug อัตโนมัติจากชื่อร้าน จนกว่าผู้ใช้จะแก้ slug เอง
      setFormData((prev) => ({ ...prev, shop_name: value, slug: slugEdited ? prev.slug : toSlug(value) }));
    } else if (name === 'slug') {
      setSlugEdited(true);
      setFormData((prev) => ({ ...prev, slug: value.replace(/\s+/g, '-').toLowerCase() }));
    } else if (name === 'promptpay_number') {
      setFormData((prev) => ({ ...prev, promptpay_number: value.replace(/[^\d]/g, '') }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (res.status === 409) {
        router.replace('/manage');
        return;
      }
      if (!res.ok) throw new Error(data.error);

      router.push('/manage?welcome=1');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'สร้างร้านค้าไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (checking) {
    return (
      <div className="min-h-screen text-slate-400 flex items-center justify-center text-sm">
        กำลังตรวจสอบบัญชี...
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md glass rounded-2xl p-6 sm:p-8 shadow-2xl">
        <OnboardingSteps current={1} />

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Store className="w-6 h-6 text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold">ลงทะเบียนร้านค้า</h1>
          <p className="text-sm text-slate-400 mt-1">ตั้งค่าหน้าร้านและบัญชีพร้อมเพย์สำหรับรับเงิน</p>
          {account?.email && (
            <p className="text-[11px] text-slate-500 mt-2">
              บัญชี: <span className="text-slate-300">{account.email}</span>
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400" /> ชื่อร้านค้า
            </label>
            <input
              type="text"
              name="shop_name"
              required
              value={formData.shop_name}
              onChange={handleChange}
              placeholder="เช่น My Shop"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-slate-400" /> ลิงก์ร้านค้า
            </label>
            <div className="flex items-center bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden focus-within:border-brand-500 transition">
              <span className="text-xs text-slate-500 pl-3.5 pr-1 font-mono select-none">paybio.me/</span>
              <input
                type="text"
                name="slug"
                required
                value={formData.slug}
                onChange={handleChange}
                placeholder="my-shop"
                className="w-full bg-transparent px-1 py-2.5 text-sm text-ink placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">ใช้ตัวอักษร ตัวเลข และขีด (-) ได้</p>
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> พร้อมเพย์สำหรับรับเงิน
            </label>
            <input
              type="text"
              inputMode="numeric"
              name="promptpay_number"
              required
              pattern="\d{10}|\d{13}|\d{15}"
              title="เบอร์มือถือ 10 หลัก, เลขบัตรประชาชน 13 หลัก หรือ e-Wallet 15 หลัก"
              value={formData.promptpay_number}
              onChange={handleChange}
              placeholder="เบอร์มือถือ หรือ เลขบัตรประชาชน"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5 mb-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" /> รายละเอียดร้านค้า (ไม่บังคับ)
            </label>
            <textarea
              name="bio"
              rows={2}
              value={formData.bio}
              onChange={handleChange}
              placeholder="คำอธิบายร้านค้าสั้นๆ สำหรับแสดงบนหน้าร้าน"
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="text-white w-full py-3 btn-primary disabled:opacity-50 font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-500/20"
          >
            {loading ? 'กำลังสร้างร้านค้า...' : 'สร้างร้านค้าและไปที่หน้าจัดการ'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="mt-6 w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> ออกจากระบบ / ใช้บัญชีอื่น
        </button>
      </div>
    </div>
  );
}
