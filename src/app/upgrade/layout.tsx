import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'อัปเกรดแพ็กเกจ · PayBio', robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
