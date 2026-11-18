import { NextResponse } from 'next/server';
import { getTrackedOrders } from '@/lib/order-track';

// สถานะออเดอร์ของลูกค้าจากลิงก์ติดตาม — ?tokens=<uuid>,<uuid>
export async function GET(req: Request) {
  const tokens = (new URL(req.url).searchParams.get('tokens') ?? '').split(',');
  const orders = await getTrackedOrders(tokens);
  return NextResponse.json(
    // ไม่ส่ง id ภายในออกไป
    {
      orders: orders.map((o) => ({
        token: o.token,
        order_number: o.order_number,
        item_title: o.item_title,
        quantity: o.quantity,
        amount: o.amount,
        status: o.status,
        fulfillment: o.fulfillment,
        created_at: o.created_at,
        shop_slug: o.shop?.slug ?? null,
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
