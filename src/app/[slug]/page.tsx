import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Store } from 'lucide-react';
import { getPublicShop } from '@/lib/shop-data';
import ShopFront from './shop-front';

export async function generateMetadata({ params }: PageProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicShop(decodeURIComponent(slug));
  if (!data) return { title: 'ไม่พบร้านค้า · PayBio' };
  return {
    title: `${data.shop.shop_name} · PayBio`,
    description: data.shop.bio || `สั่งซื้อและชำระเงินผ่านพร้อมเพย์กับ ${data.shop.shop_name}`,
  };
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-h-screen bg-slate-950 text-ink flex flex-col items-center justify-center p-4 text-center">
      <Store className="w-10 h-10 text-slate-500 mb-3" />
      <h1 className="text-xl font-bold mb-2">{title}</h1>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

async function ShopLoader({ params }: { params: PageProps<'/[slug]'>['params'] }) {
  const { slug } = await params;
  const data = await getPublicShop(decodeURIComponent(slug));

  if (!data) {
    return <Message title="ไม่พบร้านค้านี้" text={`ลิงก์ร้านค้า paybio.me/${decodeURIComponent(slug)} อาจไม่มีอยู่จริง`} />;
  }
  if (data.shop.suspended) {
    return (
      <Message
        title="ร้านค้านี้ปิดให้บริการชั่วคราว"
        text={`${data.shop.shop_name} ไม่สามารถรับคำสั่งซื้อได้ในขณะนี้`}
      />
    );
  }
  return <ShopFront shop={data.shop} products={data.products} />;
}

function Skeleton() {
  return (
    <div className="min-h-screen bg-slate-950 flex justify-center p-4 pt-10">
      <div className="w-full max-w-md space-y-3 animate-pulse">
        <div className="w-20 h-20 rounded-full bg-slate-800 mx-auto" />
        <div className="h-6 w-40 bg-slate-800 rounded mx-auto" />
        <div className="h-4 w-56 bg-slate-800/70 rounded mx-auto" />
        <div className="h-20 bg-slate-900 rounded-2xl mt-8" />
        <div className="h-20 bg-slate-900 rounded-2xl" />
        <div className="h-20 bg-slate-900 rounded-2xl" />
      </div>
    </div>
  );
}

export default function Page({ params }: PageProps<'/[slug]'>) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ShopLoader params={params} />
    </Suspense>
  );
}
