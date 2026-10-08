import { redirect } from 'next/navigation';

// หน้า Dashboard เดิมถูกรวมเข้ากับหน้าจัดการร้านค้าแล้ว
export default function Dashboard() {
  redirect('/manage');
}
