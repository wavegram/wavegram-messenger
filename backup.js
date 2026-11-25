// Авто-бэкап SQLite в git (для эфемерного диска бесплатных хостингов).
// Копирует БД в /data/backups (gitignored НЕ будет — добавим в отслеживаемое),
// затем делает commit+push. Запускается как отдельный процесс в Procfile.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const BACKUPS = path.join(DATA, 'backups');
const FILES = ['data/messenger.db', 'bot-numbers.db'];
const INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS || 5 * 60 * 1000);

fs.mkdirSync(BACKUPS, { recursive: true });

function backupOnce() {
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const ok = [];
  try {
    for (const rel of FILES) {
      const src = path.join(ROOT, rel);
      if (!fs.existsSync(src)) continue;
      const dst = path.join(BACKUPS, path.basename(rel) + '.' + stamp + '.db');
      try { fs.copyFileSync(src + '-wal', dst + '.wal'); } catch {}
      fs.copyFileSync(src, dst);
      ok.push(path.basename(dst));
    }
    if (!ok.length) return;
    execSync('git add data/backups && git commit -m "backup: ' + stamp + '" --allow-empty --quiet', { cwd: ROOT });
    execSync('git push origin HEAD --quiet', { cwd: ROOT });
    console.log('[backup] ' + new Date().toISOString() + ' ' + ok.join(', '));
  } catch (e) {
    console.error('[backup] ' + e.message);
  }
}

setTimeout(function run() {
  backupOnce();
  setTimeout(run, INTERVAL_MS);
}, 10 * 1000);