'use client';

import { useRef, useState } from 'react';
import { Camera, KeyRound, Save, Trash2, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { initialOf } from '@/lib/initial';

export type Account = {
  email?: string;
  name?: string | null;
  avatar?: string | null;
  customAvatar?: boolean;
  provider?: string;
  isAdmin?: boolean;
};

const inputClass =
  'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-ink placeholder-slate-500 focus:outline-none focus:border-brand-500';

const PROVIDER_LABEL: Record<string, string> = { email: 'อีเมล', google: 'Google', line: 'LINE' };

// แก้โปรไฟล์บัญชีของตัวเอง: ชื่อที่แสดง รูปโปรไฟล์ และรหัสผ่าน (เฉพาะบัญชีอีเมล)
export function AccountProfile({
  account,
  onChange,
  notify,
}: {
  account: Account;
  onChange: (next: Partial<Account>) => void;
  notify: (kind: 'ok' | 'error', text: string) => void;
}) {
  const [name, setName] = useState(account.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState<'upload' | 'delete' | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEmail = (account.provider ?? 'email') === 'email';

  const saveName = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
      onChange({ name: data.user.name });
      setName(data.user.name ?? '');
      notify('ok', 'บันทึกชื่อแล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingName(false);
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy('upload');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/me/avatar', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปโหลดไม่สำเร็จ');
      onChange({ avatar: data.avatar, customAvatar: true });
      notify('ok', 'เปลี่ยนรูปโปรไฟล์แล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ');
    } finally {
      setAvatarBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy('delete');
    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ');
      onChange({ avatar: data.avatar, customAvatar: false });
      notify('ok', 'ลบรูปโปรไฟล์แล้ว');
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    } finally {
      setAvatarBusy(null);
    }
  };

  const savePassword = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      notify('error', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSavingPassword(false);
    if (error) {
      notify(
        'error',
        /different from the old/i.test(error.message)
          ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม'
          : /reauthenticat|recent/i.test(error.message)
            ? 'เพื่อความปลอดภัย กรุณาออกจากระบบแล้วเข้าใหม่ก่อนเปลี่ยนรหัสผ่าน'
            : error.message
      );
      return;
    }
    setPassword('');
    setConfirm('');
    notify('ok', 'เปลี่ยนรหัสผ่านแล้ว');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 font-semibold text-sm border-b border-slate-800 pb-3">
        <UserRound className="w-4 h-4 text-brand-400" /> โปรไฟล์บัญชี
      </div>

      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
          {account.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={account.avatar} alt="รูปโปรไฟล์" className="w-16 h-16 rounded-full object-cover border border-slate-700" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">
              {initialOf(account.name, account.email)}
            </div>
          )}
          <label
            htmlFor="avatar-upload"
            title="เปลี่ยนรูปโปรไฟล์"
            className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-500 hover:bg-brand-600 text-white flex items-center justify-center cursor-pointer border-2 border-slate-900 ${
              avatarBusy ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
          </label>
          <input
            ref={fileRef}
            id="avatar-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => uploadAvatar(e.target.files?.[0])}
          />
        </div>
        <div className="min-w-0 text-xs space-y-1">
          <p className="text-slate-300 truncate">{account.email}</p>
          <p className="text-slate-500">เข้าสู่ระบบด้วย {PROVIDER_LABEL[account.provider ?? 'email'] ?? account.provider}</p>
          {avatarBusy === 'upload' && <p className="text-brand-400">กำลังอัปโหลด...</p>}
          {account.customAvatar && !avatarBusy && (
            <button
              type="button"
              onClick={removeAvatar}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-400 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> ลบรูปที่อัปโหลด
            </button>
          )}
        </div>
      </div>

      <form onSubmit={saveName} className="space-y-2">
        <label htmlFor="display-name" className="text-xs text-slate-400 block">
          ชื่อที่แสดง
        </label>
        <div className="flex gap-2">
          <input
            id="display-name"
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={savingName || !name.trim() || name.trim() === (account.name ?? '')}
            className="text-white px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" /> {savingName ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </form>

      {isEmail ? (
        <form onSubmit={savePassword} className="space-y-2 border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> เปลี่ยนรหัสผ่าน
          </p>
          <input
            type="password"
            required
            minLength={6}
            placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
            aria-label="รหัสผ่านใหม่"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="ยืนยันรหัสผ่านใหม่"
            aria-label="ยืนยันรหัสผ่านใหม่"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={savingPassword}
            className="w-full py-2 rounded-xl text-xs font-semibold border border-slate-700 hover:border-brand-500 text-slate-200 disabled:opacity-50 transition cursor-pointer"
          >
            {savingPassword ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-slate-500 border-t border-slate-800 pt-3">
          บัญชีนี้เข้าสู่ระบบด้วย {PROVIDER_LABEL[account.provider ?? ''] ?? account.provider} จึงไม่มีรหัสผ่านให้เปลี่ยน
        </p>
      )}
    </div>
  );
}
