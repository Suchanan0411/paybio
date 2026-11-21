import { randomInt } from 'node:crypto';

// ตัวอักษรที่อ่านไม่สับสน (ไม่มี 0/O, 1/I/L) ลูกค้าพิมพ์ตามได้ถูก
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 8; // 31^8 ≈ 8.5 แสนล้านแบบ เดาไม่ได้และแทบไม่ชนกัน

/** เลขออเดอร์แบบสุ่ม เช่น PB-7K3QX9MD (ฐานข้อมูลบังคับไม่ให้ซ้ำ ชนเมื่อไหร่ให้สุ่มใหม่) */
export function newOrderNumber() {
  let s = '';
  for (let i = 0; i < LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `PB-${s}`;
}

/** รูปแบบเลขออเดอร์ที่รับค้นหา: แบบใหม่ (ตัวอักษร+ตัวเลข) และแบบเดิม (ตัวเลข 6 หลัก) */
export const ORDER_NUMBER_RE = /^PB-[0-9A-Z]{4,10}$/;
