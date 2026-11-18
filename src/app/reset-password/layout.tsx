import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ตั้งรหัสผ่านใหม่ · PayBio',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
