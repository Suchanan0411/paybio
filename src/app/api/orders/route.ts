import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getCurrentUser, getShopByUserId } from '@/lib/supabase-server';
import { planOf } from '@/lib/plans';
import { monthlyOrdersFull } from '@/lib/order-limits';
import { checkSlip, slipHash, type SlipCheck } from '@/lib/slip-check';
import { notifyNewOrder, type NotifyShop } from '@/lib/order-notify';
import { purgeExpiredSlips, slipQuotaBlocked, slipStorage, trimSlips } from '@/lib/slip-storage';
import { addOrderEvents } from '@/lib/order-events';
import { clientIp, rateLimited } from '@/lib/rate-limit';
import { customerEmailConfigured, sendCustomerEmail } from '@/lib/customer-email';
import {
  EMAIL_RE,
  FULFILLMENTS,
  FULFILLMENT_LABEL,
  STATUS_LABEL,
  carrierOf,
  type Fulfillment,
  type OrderStatus,
} from '@/lib/order-stages';

const ORDER_STATUSES = ['pending', 'paid', 'rejected'];

// ร้านค้าของผู้ใช้ที่ล็อกอินอยู่ (ใช้ตรวจสิทธิ์จัดการคำสั่งซื้อ)
async function currentShop() {
  const user = await getCurrentUser();
  return user ? getShopByUserId(user.id) : null;
}

// รายการคำสั่งซื้อของร้านค้าผู้ใช้
export async function GET() {
  const shop = await currentShop();
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  after(() => purgeExpiredSlips(shop)); // ไม่ต้องรอ: ลบสลิปหมดอายุหลังตอบกลับ
  const [{ data, error }, storage] = await Promise.all([
    supabaseAdmin.from('orders').select('*').eq('profile_id', shop.id).order('created_at', { ascending: false }),
    slipStorage(shop),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ orders: data, storage, customerEmail: customerEmailConfigured() });
}

// อนุมัติ / ปฏิเสธ / อัปเดตการจัดส่ง เลขพัสดุ และข้อความถึงลูกค้า
// ส่งเฉพาะ field ที่ต้องการเปลี่ยน: { id, status?, fulfillment?, carrier?, tracking_number?, shop_message? }
export async function PATCH(req: Request) {
  const shop = await currentShop();
  if (!shop) {
    return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและลงทะเบียนร้านค้า' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '');
  if (!id) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const { data: current } = await supabaseAdmin.from('orders').select('*').eq('id', id).eq('profile_id', shop.id).maybeSingle();
  if (!current) return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อนี้ในร้านของคุณ' }, { status: 404 });

  const update: Record<string, unknown> = {};
  const events: { kind: string; label: string; detail?: string | null }[] = [];
  const clean = (v: unknown, max: number) => (v == null ? null : String(v).trim().slice(0, max) || null);

  if ('status' in body) {
    if (!ORDER_STATUSES.includes(body.status)) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    if (body.status !== current.status) {
      update.status = body.status;
      events.push({ kind: 'status', label: STATUS_LABEL[body.status as OrderStatus] });
      // ยกเลิกการชำระ = ขั้นตอนจัดส่งไม่มีผลแล้ว
      if (body.status !== 'paid' && current.fulfillment) update.fulfillment = null;
    }
  }
  const nextStatus = (update.status ?? current.status) as OrderStatus;

  if ('fulfillment' in body) {
    const f = body.fulfillment || null;
    if (f && !FULFILLMENTS.includes(f)) return NextResponse.json({ error: 'ขั้นตอนจัดส่งไม่ถูกต้อง' }, { status: 400 });
    if (f && nextStatus !== 'paid') {
      return NextResponse.json({ error: 'อนุมัติการชำระเงินก่อน จึงจะอัปเดตการจัดส่งได้' }, { status: 400 });
    }
    if (f !== current.fulfillment) {
      update.fulfillment = f;
      if (f) events.push({ kind: 'fulfillment', label: FULFILLMENT_LABEL[f as Fulfillment] });
    }
  }

  if ('carrier' in body || 'tracking_number' in body) {
    const carrier = 'carrier' in body ? clean(body.carrier, 30) : current.carrier;
    const number = 'tracking_number' in body ? clean(body.tracking_number, 60) : current.tracking_number;
    if (carrier && !carrierOf(carrier)) return NextResponse.json({ error: 'บริษัทขนส่งไม่ถูกต้อง' }, { status: 400 });
    if (carrier !== current.carrier || number !== current.tracking_number) {
      update.carrier = carrier;
      update.tracking_number = number;
      if (number) events.push({ kind: 'tracking', label: 'เพิ่มเลขพัสดุ', detail: `${carrierOf(carrier)?.label ?? ''} ${number}`.trim() });
    }
  }

  if ('shop_message' in body) {
    const msg = clean(body.shop_message, 500);
    if (msg !== current.shop_message) {
      update.shop_message = msg;
      if (msg) events.push({ kind: 'message', label: 'ข้อความจากร้าน', detail: msg });
    }
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ order: current });
  update.status_updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update(update)
    .eq('id', id)
    .eq('profile_id', shop.id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'ไม่พบคำสั่งซื้อนี้ในร้านของคุณ' }, { status: 404 });
  }

  // หลังตอบกลับ: บันทึกประวัติ แล้วแจ้งลูกค้าทางอีเมล (ถ้ากรอกไว้) ด้วยหัวข้อของการเปลี่ยนแปลงล่าสุด
  after(async () => {
    await addOrderEvents(data.id, events);
    if (events.length) await sendCustomerEmail(shop.shop_name, data, events[events.length - 1].label);
  });
  return NextResponse.json({ order: data });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('slip') as File | null;
    let itemTitle = '';
    let amount = 0;
    let productId: string | null = null;
    let quantity = 1;
    const text = (key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
    const customer = {
      customer_name: text('customer_name', 100),
      customer_contact: text('customer_contact', 100),
      note: text('note', 500) || null,
      customer_email: text('customer_email', 200).toLowerCase() || null,
    };
    if (customer.customer_email && !EMAIL_RE.test(customer.customer_email)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    const profileId = (formData.get('profile_id') as string) || null;
    if (!profileId) {
      return NextResponse.json({ error: 'กรุณาสั่งซื้อผ่านหน้าร้านค้า' }, { status: 400 });
    }
    // กันยิงออเดอร์ปลอมรัวๆ (ทำให้โควตาร้านเต็ม / เปลืองโควตาตรวจสลิป)
    // นับต่อ IP ต่อร้าน และต่อ IP ทั้งระบบ เผื่อลูกค้าหลายคนใช้ IP เดียวกันผ่านเครือข่ายมือถือ
    const ip = clientIp(req);
    const [perShop, perIp] = await Promise.all([
      rateLimited('order-create', `${ip}:${profileId}`, 10, 10 * 60),
      rateLimited('order-create', ip, 30, 60 * 60),
    ]);
    if (perShop || perIp) {
      return NextResponse.json({ error: 'ส่งคำสั่งซื้อบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 });
    }
    const orderNumber = `PB-${Date.now().toString().slice(-6)}`;

    let shop: (NotifyShop & { promptpay_number: string }) | null = null;
    if (profileId) {
      const { data } = await supabaseAdmin.from('profiles').select('*').eq('id', profileId).maybeSingle();
      if (!data) {
        return NextResponse.json({ error: 'ไม่พบร้านค้านี้' }, { status: 404 });
      }
      // ร้านที่ถูกระงับรับคำสั่งซื้อใหม่ไม่ได้
      if (data.suspended_at) {
        return NextResponse.json({ error: 'ร้านค้านี้ถูกระงับชั่วคราว ไม่สามารถสั่งซื้อได้' }, { status: 403 });
      }
      shop = data;

      // ราคาคำนวณจากสินค้าในฐานข้อมูล (ไม่เชื่อยอดเงินที่ส่งมาจากเบราว์เซอร์)
      const { data: product } = await supabaseAdmin
        .from('products')
        .select('id, name, price')
        .eq('id', String(formData.get('product_id') ?? ''))
        .eq('profile_id', data.id)
        .maybeSingle();
      if (!product) {
        return NextResponse.json({ error: 'ไม่พบสินค้านี้ในร้าน อาจถูกลบไปแล้ว' }, { status: 404 });
      }
      quantity = Math.trunc(Number(formData.get('quantity')) || 1);
      if (quantity < 1 || quantity > 99) {
        return NextResponse.json({ error: 'จำนวนสินค้าต้องอยู่ระหว่าง 1–99' }, { status: 400 });
      }
      if (!customer.customer_name || !customer.customer_contact) {
        return NextResponse.json({ error: 'กรุณากรอกชื่อและช่องทางติดต่อกลับ' }, { status: 400 });
      }
      if (!file || file.size === 0 || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'กรุณาแนบรูปสลิป (ไฟล์รูปภาพไม่เกิน 10 MB)' }, { status: 400 });
      }
      productId = product.id;
      itemTitle = quantity > 1 ? `${product.name} × ${quantity}` : product.name;
      amount = Math.round(Number(product.price) * quantity * 100) / 100;

      // แพ็กเกจ Free รับออเดอร์ได้จำกัดต่อเดือน
      if (await monthlyOrdersFull(data)) {
        return NextResponse.json(
          { error: 'ร้านนี้รับคำสั่งซื้อครบโควตาของเดือนนี้แล้ว กรุณาติดต่อร้านค้า' },
          { status: 403 }
        );
      }

      // พื้นที่เก็บสลิปตามแพ็กเกจ: แพ็กเกจเก็บถาวรเต็มแล้วรับเพิ่มไม่ได้
      // (Free ลบสลิปเก่าให้อัตโนมัติ หลังบันทึกออเดอร์ใหม่สำเร็จ — ดู trimSlips ด้านล่าง)
      if (await slipQuotaBlocked(data, file.size)) {
        return NextResponse.json(
          { error: 'พื้นที่เก็บสลิปของร้านนี้เต็มแล้ว กรุณาติดต่อร้านค้า' },
          { status: 403 }
        );
      }
    }

    let slipUrl = null;
    let slipBytes: ArrayBuffer | null = null;
    let hash: string | null = null;

    // อัปโหลดไฟล์สลิปเข้า Bucket 'payment-slips'
    if (file && file.size > 0) {
      slipBytes = await file.arrayBuffer();
      hash = slipHash(slipBytes);
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderNumber}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('payment-slips')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json({ error: 'Storage Error: ' + uploadError.message }, { status: 500 });
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('payment-slips')
        .getPublicUrl(fileName);

      slipUrl = urlData.publicUrl;
    }

    // บันทึกลงตาราง orders
    const row = {
      order_number: orderNumber,
      item_title: itemTitle,
      amount: amount,
      slip_url: slipUrl,
      status: 'pending',
      profile_id: profileId,
    };
    const extra = profileId ? { product_id: productId, quantity, ...customer } : {};
    let { data: orderData, error: dbError } = await supabaseAdmin
      .from('orders')
      .insert({ ...row, ...extra, slip_hash: hash, slip_size: file && file.size > 0 ? file.size : null })
      .select()
      .single();

    // ฐานข้อมูลยังไม่ได้รัน migration: บันทึกคำสั่งซื้อแบบเดิมไปก่อน โดยเก็บข้อมูลผู้สั่งไว้ในชื่อรายการ
    // ยังไม่ได้รัน migration โควตาสลิป: บันทึกโดยไม่มีขนาดไฟล์
    if (dbError && /slip_size/.test(dbError.message)) {
      ({ data: orderData, error: dbError } = await supabaseAdmin
        .from('orders')
        .insert({ ...row, ...extra, slip_hash: hash })
        .select()
        .single());
    }
    if (dbError && /slip_hash|product_id|quantity|customer_|note/.test(dbError.message)) {
      const fallback = profileId
        ? { ...row, item_title: `${itemTitle} — ${customer.customer_name} (${customer.customer_contact})${customer.note ? ` · ${customer.note}` : ''}` }
        : row;
      ({ data: orderData, error: dbError } = await supabaseAdmin
        .from('orders')
        .insert({ ...fallback, slip_hash: hash })
        .select()
        .single());
      if (dbError && /slip_hash/.test(dbError.message)) {
        ({ data: orderData, error: dbError } = await supabaseAdmin.from('orders').insert(fallback).select().single());
        slipBytes = null;
      }
    }

    if (dbError) {
      return NextResponse.json({ error: 'Database Error: ' + dbError.message }, { status: 500 });
    }

    // หลังตอบกลับลูกค้า: ตรวจสลิป (AI ใช้เวลาหลายวินาที) แล้วแจ้งร้านทาง LINE / Webhook พร้อมผลตรวจ
    if (shop) {
      const shopRow = shop;
      const order = orderData;
      const bytes = slipBytes;
      const slipHashValue = hash;
      after(async () => {
        await trimSlips(shopRow, order.id);
        let result: SlipCheck | null = null;
        if (bytes && slipHashValue && file) {
          try {
            result = await checkSlip({
              plan: planOf(shopRow),
              bytes,
              hash: slipHashValue,
              expectedAmount: amount,
              orderId: order.id,
              orderCreatedAt: order.created_at,
              shopId: shopRow.id,
              promptpayNumber: shopRow.promptpay_number,
            });
            const { error } = await supabaseAdmin.from('orders').update({ slip_check: result }).eq('id', order.id);
            if (error) console.error('[slip-check] save failed', error.message);
          } catch (err) {
            console.error('[slip-check] failed', err);
          }
        }
        await notifyNewOrder(shopRow, order, result);
        await addOrderEvents(order.id, [{ kind: 'created', label: 'ส่งสลิปแล้ว รอร้านตรวจสอบ' }]);
        // อีเมลยืนยันพร้อมลิงก์ติดตาม — ลูกค้าไม่ต้องจดลิงก์เอง
        await sendCustomerEmail(shopRow.shop_name, order, 'ได้รับคำสั่งซื้อของคุณแล้ว');
      });
    }

    return NextResponse.json({ success: true, order: orderData });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server Error' }, { status: 500 });
  }
}
