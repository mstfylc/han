/**
 * SQLite yedeği — çalışan veritabanından tutarlı kopya (better-sqlite3 backup API).
 * Kullanım: node scripts/backup-db.mjs   (compose içinde: docker compose exec app node scripts/backup-db.mjs)
 * Yedekler .data/backups/han-YYYYMMDD-HHmm.db olarak düşer; son 30 yedek tutulur.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dir = process.env.HAN_DB_DIR || path.join(process.cwd(), ".data");
const src = path.join(dir, "han.db");
if (!fs.existsSync(src)) {
  console.error("veritabanı yok: " + src);
  process.exit(1);
}
const bdir = path.join(dir, "backups");
fs.mkdirSync(bdir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const out = path.join(bdir, "han-" + stamp + ".db");

const db = new Database(src, { readonly: true });
await db.backup(out);
db.close();
console.log("yedek alındı: " + out);

// son 30 yedek kalsın
const all = fs.readdirSync(bdir).filter((f) => f.startsWith("han-") && f.endsWith(".db")).sort();
all.slice(0, Math.max(0, all.length - 30)).forEach((f) => fs.unlinkSync(path.join(bdir, f)));
