/**
 * Postgres yedeği — `pg_dump` ile sıkıştırılmış tam kopya.
 *
 *   node scripts/backup-db.mjs
 *   docker compose exec app node scripts/backup-db.mjs      (compose içinde)
 *
 * Yedekler `HAN_BACKUP_DIR` (varsayılan `.backups/`) altına
 * `han-YYYYMMDD-HHmm.sql.gz` olarak düşer; son 30 yedek tutulur.
 *
 * Neden `pg_dump` da uygulama kodu değil: yedek, uygulamanın belge şemasını
 * bilmemeli. Şema değiştiğinde yedek scriptinin de değişmesi gerekseydi, tam da
 * en çok ihtiyaç duyulan anda bozulurdu.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import zlib from "node:zlib";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL tanımlı değil — neyin yedeğini alacağı belli değil.");
  process.exit(1);
}

const dir = process.env.HAN_BACKUP_DIR || path.join(process.cwd(), ".backups");
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const out = path.join(dir, "han-" + stamp + ".sql.gz");

// Kısmi bir dosya geçerli bir yedek gibi görünür. Önce `.part` yazılır, ancak
// pg_dump 0 ile bittiğinde adı son haline gelir.
const partial = out + ".part";

const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", url], {
  stdio: ["ignore", "pipe", "inherit"],
});

dump.on("error", (e) => {
  console.error("pg_dump çalıştırılamadı: " + e.message);
  console.error("postgresql-client kurulu mu? (Dockerfile'da var.)");
  process.exit(1);
});

const sink = fs.createWriteStream(partial);
dump.stdout.pipe(zlib.createGzip()).pipe(sink);

dump.on("close", (code) => {
  if (code !== 0) {
    fs.rmSync(partial, { force: true });
    console.error("pg_dump " + code + " ile çıktı — yedek alınamadı.");
    process.exit(1);
  }
  sink.on("close", () => {
    fs.renameSync(partial, out);
    const mb = (fs.statSync(out).size / 1048576).toFixed(1);
    console.log("yedek alındı: " + out + " (" + mb + " MB)");

    // Son 30 yedek kalsın.
    const all = fs.readdirSync(dir)
      .filter((f) => f.startsWith("han-") && f.endsWith(".sql.gz"))
      .sort();
    all.slice(0, Math.max(0, all.length - 30))
      .forEach((f) => fs.unlinkSync(path.join(dir, f)));
  });
});
