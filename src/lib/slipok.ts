// ตรวจสลิปกับข้อมูลธนาคารผ่าน SlipOK (https://slipok.com) — เอกสาร API v1.13
// ใช้บัญชี SlipOK เดียวของทั้งระบบ จึงไม่ส่ง log: true (ซึ่งจะเทียบบัญชีผู้รับกับบัญชีที่ผูกกับสาขา SlipOK)
// แต่ตรวจยอดเงิน บัญชีผู้รับ และสลิปซ้ำเองต่อร้าน ตามคำแนะนำในเอกสาร

const API = 'https://api.slipok.com/api/line/apikey';

export type BankSlip = {
  provider: 'slipok';
  ref: string;
  amount: number;
  datetime: string | null; // ISO 8601
  sending_bank: string | null;
  receiving_bank: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  receiver_proxy: string | null; // masked เช่น 081xxx5678
  receiver_account: string | null; // masked เช่น xxx-x-x3109-x
};

export type BankVerify =
  | { status: 'verified'; slip: BankSlip }
  // สลิปไม่มีอยู่จริงในระบบธนาคาร / ไม่ใช่สลิป → ปลอมหรือใช้ไม่ได้
  | { status: 'invalid'; code: number; message: string }
  // ตรวจตอนนี้ไม่ได้ (ธนาคารขัดข้อง, ต้องรอหลังโอน, โควตาหมด, ตั้งค่าผิด) → ใช้การตรวจแบบเดิมแทน
  | { status: 'unavailable'; code: number | null; message: string; retryMinutes?: number };

const env = () => ({ key: process.env.SLIPOK_API_KEY, branch: process.env.SLIPOK_BRANCH_ID });

export function slipokEnabled(plan: string) {
  const { key, branch } = env();
  if (!key || !branch) return false;
  // SLIPOK_PLANS=pro,business จำกัดแพ็กเกจที่ใช้โควตา (ไม่ตั้ง = ทุกแพ็กเกจ)
  const plans = process.env.SLIPOK_PLANS?.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  return !plans?.length || plans.includes(plan);
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function toSlip(d: Record<string, unknown>): BankSlip | null {
  const ref = str(d.transRef);
  const amount = Number(d.amount);
  if (!ref || !Number.isFinite(amount)) return null;
  const receiver = (d.receiver ?? {}) as Record<string, Record<string, unknown> | unknown>;
  const sender = (d.sender ?? {}) as Record<string, unknown>;
  const rProxy = (receiver.proxy ?? {}) as Record<string, unknown>;
  const rAccount = (receiver.account ?? {}) as Record<string, unknown>;

  let datetime = str(d.transTimestamp);
  const date = str(d.transDate);
  const time = str(d.transTime);
  if (!datetime && date && /^\d{8}$/.test(date)) {
    datetime = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time ?? '00:00:00'}+07:00`;
  }
  return {
    provider: 'slipok',
    ref,
    amount,
    datetime,
    sending_bank: str(d.sendingBank),
    receiving_bank: str(d.receivingBank),
    sender_name: str(sender.displayName) ?? str(sender.name),
    receiver_name: str(receiver.displayName) ?? str(receiver.name),
    receiver_proxy: str(rProxy.value),
    receiver_account: str(rAccount.value),
  };
}

const INVALID_CODES = new Set([1005, 1006, 1008, 1011]);

/**
 * ส่งสลิปไปตรวจกับธนาคาร: ใช้ข้อความ QR ที่อ่านได้แล้ว (เล็กและเร็ว) หรือรูปสลิปถ้าอ่าน QR ในเครื่องไม่ได้
 * โควตา SlipOK ถูกหักเฉพาะสลิปที่ถูกต้อง (ส่งซ้ำก็ถูกหัก)
 */
export async function verifyWithSlipok(input: { qrText?: string | null; image?: ArrayBuffer }): Promise<BankVerify> {
  const { key, branch } = env();
  if (!key || !branch) return { status: 'unavailable', code: null, message: 'ยังไม่ได้ตั้งค่า SlipOK' };

  let body: BodyInit;
  const headers: Record<string, string> = { 'x-authorization': key };
  if (input.qrText) {
    body = JSON.stringify({ data: input.qrText });
    headers['content-type'] = 'application/json';
  } else if (input.image) {
    const form = new FormData();
    form.append('files', new Blob([input.image]), 'slip.jpg');
    body = form;
  } else {
    return { status: 'unavailable', code: null, message: 'ไม่มีข้อมูลสลิปให้ตรวจ' };
  }

  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(branch)}`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error('[slipok] request failed', err);
    return { status: 'unavailable', code: null, message: 'เชื่อมต่อ SlipOK ไม่ได้' };
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; code?: number; message?: string; data?: Record<string, unknown> }
    | null;

  if (res.ok && json?.success && json.data) {
    const slip = toSlip(json.data);
    return slip
      ? { status: 'verified', slip }
      : { status: 'unavailable', code: null, message: 'ข้อมูลตอบกลับจาก SlipOK ไม่ครบ' };
  }

  const code = Number(json?.code) || null;
  const message = json?.message || `SlipOK ตอบกลับผิดพลาด (${res.status})`;

  // 1012/1013/1014 ใช้กับ log/amount ซึ่งเราไม่ได้ส่ง แต่ถ้ามีข้อมูลสลิปกลับมา ถือว่าสลิปจริง แล้วตรวจต่อเอง
  if (code && [1012, 1013, 1014].includes(code) && json?.data) {
    const slip = toSlip(json.data);
    if (slip) return { status: 'verified', slip };
  }
  if (code && INVALID_CODES.has(code)) return { status: 'invalid', code, message };
  if (code === 1007) {
    // ไม่พบ QR ในรูป — อาจครอป/ไม่ชัด ไม่ได้แปลว่าปลอม
    return { status: 'unavailable', code, message };
  }
  if (code === 1010) {
    const delay = Number((json?.data as { delay?: unknown } | undefined)?.delay);
    return { status: 'unavailable', code, message, retryMinutes: Number.isFinite(delay) ? delay : undefined };
  }
  if (code && code !== 1009) console.error('[slipok] error', code, message);
  return { status: 'unavailable', code, message };
}

/**
 * เทียบเลขผู้รับที่ถูกปิดบัง (เช่น "081xxx5678", "XXX-X-XX123-4") กับพร้อมเพย์ของร้าน
 * ตัดทุกอย่างที่ไม่ใช่ตัวเลข/x แล้วเทียบเฉพาะหลักที่เห็นตามตำแหน่งชิดขวา
 * คืน true = ตรง, false = ขัดกัน, null = เทียบไม่ได้ (เห็นตัวเลขน้อยเกินไป)
 */
export function maskedMatches(masked: string | null | undefined, actual: string): boolean | null {
  const m = (masked ?? '').replace(/[^0-9xX]/g, '');
  const a = actual.replace(/\D/g, '');
  if (!m || !a) return null;
  // เบอร์มือถืออาจมาในรูป 66xxxxxxxxx แทน 0xxxxxxxxx
  const candidates = [a];
  if (/^0\d{9}$/.test(a)) candidates.push('66' + a.slice(1));
  let sawConflict = false;
  for (const c of candidates) {
    if (m.length !== c.length) continue;
    let known = 0;
    let ok = true;
    for (let i = 0; i < m.length; i++) {
      if (/[xX]/.test(m[i])) continue;
      known++;
      if (m[i] !== c[i]) {
        ok = false;
        break;
      }
    }
    if (ok && known >= 4) return true;
    if (!ok) sawConflict = true;
  }
  return sawConflict ? false : null;
}
