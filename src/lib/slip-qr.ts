import jsQR from 'jsqr';

// รหัสธนาคารผู้โอน (3 หลัก) ที่อยู่ใน QR ของสลิป
const BANKS: Record<string, string> = {
  '002': 'ธ.กรุงเทพ',
  '004': 'ธ.กสิกรไทย',
  '006': 'ธ.กรุงไทย',
  '011': 'ธ.ทหารไทยธนชาต',
  '014': 'ธ.ไทยพาณิชย์',
  '017': 'ธ.ซิตี้แบงก์',
  '022': 'ธ.ซีไอเอ็มบี ไทย',
  '024': 'ธ.ยูโอบี',
  '025': 'ธ.กรุงศรีอยุธยา',
  '030': 'ธ.ออมสิน',
  '033': 'ธ.อาคารสงเคราะห์',
  '034': 'ธ.ก.ส.',
  '066': 'ธ.อิสลามแห่งประเทศไทย',
  '067': 'ธ.ทิสโก้',
  '069': 'ธ.เกียรตินาคินภัทร',
  '070': 'ธ.ไอซีบีซี (ไทย)',
  '073': 'ธ.แลนด์ แอนด์ เฮ้าส์',
};

export type SlipQr = {
  bank_code: string;
  bank: string | null;
  ref: string;
  crc_ok: boolean;
};

// อ่าน TLV แบบ EMVCo: [id 2 หลัก][ความยาว 2 หลัก][ค่า]
function parseTlv(text: string): Map<string, string> | null {
  const out = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    if (i + 4 > text.length) return null;
    const id = text.slice(i, i + 2);
    const len = Number(text.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(len) || i + 4 + len > text.length) return null;
    out.set(id, text.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return out;
}

// CRC16-CCITT (0x1021, เริ่มที่ 0xFFFF) แบบเดียวกับ QR พร้อมเพย์
function crc16(text: string) {
  let crc = 0xffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * แปลงข้อความใน QR เป็นข้อมูลสลิป (คืน null ถ้าไม่ใช่ QR ของสลิปธนาคารไทย)
 * โครงสร้าง: 00 = { 00: API ID "000001", 01: รหัสธนาคารผู้โอน, 02: เลขอ้างอิงรายการ }, 51 = "TH", 91 = CRC16
 */
export function parseSlipQr(text: string): SlipQr | null {
  const top = parseTlv(text.trim());
  const payload = top?.get('00');
  if (!top || !payload || top.get('51') !== 'TH') return null;
  const inner = parseTlv(payload);
  const bankCode = inner?.get('01');
  const ref = inner?.get('02');
  if (!inner || inner.get('00') !== '000001' || !bankCode || !/^\d{3}$/.test(bankCode) || !ref) return null;

  const crc = top.get('91');
  const body = text.trim();
  const crcOk = !!crc && body.endsWith(`9104${crc}`) && crc16(body.slice(0, -4)) === crc.toUpperCase();
  return { bank_code: bankCode, bank: BANKS[bankCode] ?? null, ref, crc_ok: crcOk };
}

// หา QR ในรูปสลิป: ลองทั้งภาพ แล้วลองขยาย/เพิ่มความคมชัด เพราะ QR บนสลิปมักเล็ก
export async function readSlipQr(bytes: ArrayBuffer): Promise<{ text: string; qr: SlipQr | null } | null> {
  const sharp = (await import('sharp')).default;
  const base = sharp(Buffer.from(bytes)).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const longest = Math.max(width, meta.height ?? 0);
  if (!longest) return null;

  const attempts = [
    { maxEdge: Math.min(longest, 2000), normalise: false },
    { maxEdge: Math.min(longest * 2, 2400), normalise: true },
    { maxEdge: 1000, normalise: true },
  ];

  for (const a of attempts) {
    try {
      let img = base.clone().resize({ width: a.maxEdge, height: a.maxEdge, fit: 'inside' });
      // ยืดคอนทราสต์บนภาพสี (ไม่แปลงเป็นขาวดำ เพราะ jsQR ต้องการ RGBA 4 ช่องเสมอ)
      if (a.normalise) img = img.normalise();
      const { data, info } = await img.removeAlpha().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (info.channels !== 4) continue;
      const found = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (found?.data) return { text: found.data, qr: parseSlipQr(found.data) };
    } catch (err) {
      console.error('[slip-qr] attempt failed', a, err);
    }
  }
  return null;
}
