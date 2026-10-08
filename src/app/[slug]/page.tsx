import { Suspense } from 'react';
import ShopFrontPage from './shop-front';

export default function Page({ params }: PageProps<'/[slug]'>) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-ink flex items-center justify-center text-sm">
          กำลังโหลดหน้าร้านค้า...
        </div>
      }
    >
      <ShopFrontPage params={params} />
    </Suspense>
  );
}
