import { Suspense } from 'react';
import ShopDetail from './shop-detail';

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShopDetail id={id} />;
}

// รายละเอียดร้านสำหรับผู้ดูแลระบบ (ตรวจสิทธิ์ที่ /api/admin/shops/[id])
export default function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">กำลังโหลด...</div>}
    >
      <Loader params={params} />
    </Suspense>
  );
}
