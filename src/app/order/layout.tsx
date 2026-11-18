import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'ค้นหาคำสั่งซื้อ · PayBio', robots: { index: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
