// รันไฟล์ migration ตรงเข้าฐานข้อมูล Supabase (ต้องมี SUPABASE_DB_URL ใน .env.local)
// ใช้: node --env-file=.env.local scripts/migrate.mjs supabase/migrations/<ไฟล์>.sql [...]
import { readFileSync } from 'node:fs';
import pg from 'pg';

const files = process.argv.slice(2);
if (!process.env.SUPABASE_DB_URL || files.length === 0) {
  console.error('ใช้: node --env-file=.env.local scripts/migrate.mjs <ไฟล์ .sql> ... (ต้องตั้ง SUPABASE_DB_URL)');
  process.exit(1);
}

// แยกรหัสผ่านเอง เพื่อให้วางรหัสที่มีอักขระพิเศษ (@ # / ? ฯลฯ) ลงใน .env.local ได้ตรงๆ โดยไม่ต้องเข้ารหัส URL
const m = process.env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@/]+?)(?::(\d+))?\/([^?]+)$/);
const client = new pg.Client({
  ...(m
    ? { user: m[1], password: m[2], host: m[3], port: Number(m[4] ?? 5432), database: m[5] }
    : { connectionString: process.env.SUPABASE_DB_URL }),
  ssl: { rejectUnauthorized: false },
});
await client.connect();
try {
  for (const file of files) {
    await client.query('begin');
    try {
      await client.query(readFileSync(file, 'utf8'));
      await client.query('commit');
      console.log(`✓ ${file}`);
    } catch (err) {
      await client.query('rollback');
      console.error(`✕ ${file}: ${err.message}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
