import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { replyMessage, verifyLineSignature } from '@/lib/line-messaging';

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; text?: string };
};

const HELP = 'ส่งรหัสเชื่อมต่อ 8 ตัวจากหน้า "ตั้งค่าร้าน" ใน PayBio เพื่อรับแจ้งเตือนออเดอร์ทาง LINE';

// Webhook ของ LINE OA: เชื่อมบัญชี LINE กับร้านด้วยรหัส 8 ตัว และยกเลิกเมื่อบล็อก OA
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyLineSignature(raw, req.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  const { events = [] } = JSON.parse(raw) as { events?: LineEvent[] };
  for (const event of events) {
    const userId = event.source?.type === 'user' ? event.source.userId : undefined;
    if (!userId) continue;

    if (event.type === 'unfollow') {
      await supabaseAdmin.from('profiles').update({ line_user_id: null }).eq('line_user_id', userId);
      continue;
    }

    if (event.type === 'follow' && event.replyToken) {
      await replyMessage(event.replyToken, [{ type: 'text', text: `ยินดีต้อนรับสู่ PayBio 🎉\n${HELP}` }]);
      continue;
    }

    if (event.type !== 'message' || event.message?.type !== 'text' || !event.replyToken) continue;

    const code = event.message.text?.toUpperCase().match(/\b([A-HJ-NP-Z2-9]{8})\b/)?.[1];
    if (!code) {
      await replyMessage(event.replyToken, [{ type: 'text', text: HELP }]);
      continue;
    }

    // เชื่อมเฉพาะเมื่อรหัสตรงกับร้านเดียว (กันรหัสชนกันแล้วเชื่อมหลายร้านพร้อมกัน)
    const { data: matches } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('line_link_code', code)
      .gt('line_link_expires_at', new Date().toISOString())
      .limit(2);
    const { data: shop } =
      matches?.length === 1
        ? await supabaseAdmin
            .from('profiles')
            .update({ line_user_id: userId, line_link_code: null, line_link_expires_at: null })
            .eq('id', matches[0].id)
            .select('shop_name')
            .maybeSingle()
        : { data: null };

    await replyMessage(event.replyToken, [
      {
        type: 'text',
        text: shop
          ? `เชื่อมต่อกับร้าน "${shop.shop_name}" สำเร็จ ✅\nจากนี้จะได้รับแจ้งเตือนทันทีเมื่อมีออเดอร์ใหม่`
          : 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณากดสร้างรหัสใหม่ในหน้า "ตั้งค่าร้าน"',
      },
    ]);
  }

  return NextResponse.json({ ok: true });
}
