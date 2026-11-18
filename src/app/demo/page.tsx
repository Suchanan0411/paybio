import type { Metadata } from 'next';
import ShopFront from '../[slug]/shop-front';
import type { PublicProduct, PublicShop } from '@/lib/shop-data';

export const metadata: Metadata = {
  title: 'ร้านตัวอย่าง · PayBio',
  description: 'ดูหน้าตาร้านค้าบน PayBio และลองสั่งซื้อแบบไม่ต้องโอนเงินจริง',
};

// ร้านตัวอย่าง: ใช้หน้าร้านจริงทุกส่วน (ข้อมูลคงที่ ไม่แตะฐานข้อมูล ไม่ส่งคำสั่งซื้อ)
const SHOP: PublicShop = {
  id: 'demo',
  slug: 'demo',
  shop_name: 'Baan Bake ขนมอบโฮมเมด',
  bio: 'ขนมอบสดใหม่ทุกวัน ส่งทั่วกรุงเทพฯ · สั่งก่อน 14:00 ส่งวันถัดไป',
  promptpay_number: '0812345678',
  promptpay_qr_url: null,
  plan: 'pro',
  theme: { palette: 'orange', font: 'prompt' },
  suspended: false,
  closedReason: null,
};

const PRODUCTS: PublicProduct[] = [
  { id: 'demo-1', name: 'บราวนี่หน้าฟิล์ม (กล่อง 6 ชิ้น)', price: 189 },
  { id: 'demo-2', name: 'คุกกี้ช็อกโกแลตชิพ (10 ชิ้น)', price: 129 },
  { id: 'demo-3', name: 'ชีสเค้กบาสก์ 1 ปอนด์', price: 450 },
  { id: 'demo-4', name: 'เซ็ตของขวัญ (บราวนี่ + คุกกี้)', price: 299 },
];

export default function DemoShopPage() {
  return <ShopFront shop={SHOP} products={PRODUCTS} demo />;
}
