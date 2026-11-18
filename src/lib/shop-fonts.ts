import { IBM_Plex_Sans_Thai, Kanit, Mitr, Prompt, Sarabun } from 'next/font/google';

// ฟอนต์หน้าร้าน (เบราว์เซอร์ดาวน์โหลดเฉพาะฟอนต์ที่ร้านเลือกใช้จริง)
const prompt = Prompt({ variable: '--font-shop-prompt', subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], preload: false });
const kanit = Kanit({ variable: '--font-shop-kanit', subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], preload: false });
const sarabun = Sarabun({ variable: '--font-shop-sarabun', subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], preload: false });
const mitr = Mitr({ variable: '--font-shop-mitr', subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], preload: false });
const plex = IBM_Plex_Sans_Thai({ variable: '--font-shop-plex', subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], preload: false });

export const SHOP_FONT_VARIABLES = [prompt, kanit, sarabun, mitr, plex].map((f) => f.variable).join(' ');
