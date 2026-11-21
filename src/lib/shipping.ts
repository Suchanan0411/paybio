// ค่าจัดส่งที่ร้านตั้งเอง (ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์ — คำนวณสูตรเดียวกันทั้งสองฝั่ง)

export type ShippingMethod = { id: string; name: string; fee: number; pickup: boolean };

/** ส่วนที่ลูกค้าเห็นบนหน้าร้าน */
export type PublicShipping = {
  methods: ShippingMethod[];
  extra_per_item: number; // ชิ้นถัดไปบวกเพิ่มชิ้นละ (0 = ไม่บวก)
  free_over: number | null; // ยอดสินค้าครบเท่านี้ส่งฟรี (null = ไม่มี)
};

/** ที่เก็บในฐานข้อมูล (มีข้อมูลผู้ส่งสำหรับใบจ่าหน้า ไม่ส่งให้ลูกค้า) */
export type ShippingSettings = PublicShipping & {
  sender_name: string;
  sender_phone: string;
  sender_address: string;
};

export const MAX_METHODS = 6;
export const POSTCODE_RE = /^\d{5}$/;

const money = (v: unknown) => {
  const n = Math.round(Number(v) * 100) / 100;
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
};
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** อ่านค่าที่เก็บในฐานข้อมูล (ข้อมูลเสีย = ถือว่าไม่ได้ตั้ง) */
export function readShipping(raw: unknown): ShippingSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const methods = (Array.isArray(r.methods) ? r.methods : [])
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      const fee = money(o.fee);
      const name = text(o.name, 40);
      return name && fee != null ? { id: text(o.id, 20) || name, name, fee, pickup: !!o.pickup } : null;
    })
    .filter((m): m is ShippingMethod => !!m)
    .slice(0, MAX_METHODS);
  return {
    methods,
    extra_per_item: money(r.extra_per_item) ?? 0,
    free_over: r.free_over == null || r.free_over === '' ? null : money(r.free_over),
    sender_name: text(r.sender_name, 100),
    sender_phone: text(r.sender_phone, 30),
    sender_address: text(r.sender_address, 300),
  };
}

/** ตรวจค่าที่ร้านส่งมาจากหน้าตั้งค่า คืนข้อความผิดพลาด หรือค่าที่บันทึกได้ (null = ปิดค่าส่ง) */
export function parseShippingInput(body: unknown): ShippingSettings | null | string {
  if (!body || typeof body !== 'object') return 'ข้อมูลไม่ถูกต้อง';
  const b = body as Record<string, unknown>;
  const list = Array.isArray(b.methods) ? b.methods : [];
  if (list.length > MAX_METHODS) return `ตั้งวิธีจัดส่งได้ไม่เกิน ${MAX_METHODS} แบบ`;
  const methods: ShippingMethod[] = [];
  for (const [i, m] of list.entries()) {
    const o = (m ?? {}) as Record<string, unknown>;
    const name = text(o.name, 40);
    const fee = money(o.fee);
    if (!name) return `กรุณาตั้งชื่อวิธีจัดส่งแบบที่ ${i + 1}`;
    if (fee == null) return `ค่าส่งของ "${name}" ต้องเป็นตัวเลข 0 ขึ้นไป`;
    if (methods.some((x) => x.name === name)) return `ชื่อวิธีจัดส่ง "${name}" ซ้ำกัน`;
    methods.push({ id: `m${i + 1}`, name, fee, pickup: !!o.pickup });
  }
  const extra = money(b.extra_per_item || 0);
  if (extra == null) return 'ค่าส่งชิ้นถัดไปต้องเป็นตัวเลข 0 ขึ้นไป';
  const freeOver = b.free_over == null || b.free_over === '' ? null : money(b.free_over);
  if (b.free_over != null && b.free_over !== '' && (freeOver == null || freeOver <= 0)) return 'ยอดส่งฟรีต้องมากกว่า 0';
  const settings: ShippingSettings = {
    methods,
    extra_per_item: extra,
    free_over: freeOver,
    sender_name: text(b.sender_name, 100),
    sender_phone: text(b.sender_phone, 30),
    sender_address: text(b.sender_address, 300),
  };
  const hasSender = settings.sender_name || settings.sender_phone || settings.sender_address;
  return methods.length || hasSender ? settings : null;
}

export function publicShipping(s: ShippingSettings | null): PublicShipping | null {
  if (!s || s.methods.length === 0) return null;
  return { methods: s.methods, extra_per_item: s.extra_per_item, free_over: s.free_over };
}

/** ค่าส่งของออเดอร์: ค่าส่งของวิธีที่เลือก + ชิ้นถัดไป (รับเองไม่คิด, ยอดสินค้าครบตามที่ตั้ง = ส่งฟรี) */
export function shippingFee(s: PublicShipping, method: ShippingMethod, subtotal: number, quantity: number) {
  if (method.pickup) return 0;
  if (s.free_over != null && subtotal >= s.free_over) return 0;
  return Math.round((method.fee + s.extra_per_item * Math.max(0, quantity - 1)) * 100) / 100;
}
