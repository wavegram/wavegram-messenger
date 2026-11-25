const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const CONFIG_PATH = process.env.BOT_CONFIG || path.join(__dirname, 'bot-config.json');
const config = loadConfig();
function loadConfig() { try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return { token: '' }; } }

const TOKEN = config.token || '';
if (!TOKEN) { console.error('[bot] Нет токена в конфиге.'); process.exit(1); }
const ADMINS = Array.isArray(config.admins) ? config.admins.map(String) : [];
function isAdmin(id) { return ADMINS.includes(String(id)); }

// API Telegram через нативный https (fetch/undici к Telegraph ловит таймаут в этой среде).
const dns = require('node:dns');
const https = require('node:https');
const apiHost = 'api.telegram.org';
function apiCall(method, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      host: apiHost,
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      lookup: (h, o, cb) => dns.lookup(h, { ...o, family: 4 }, cb),
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 12000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (!json.ok) reject(new Error(json.description || method));
          else resolve(json.result);
        } catch (e) { reject(new Error('Bad response: ' + data.slice(0, 120))); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

const HTTP_PORT = Number(process.env.BOT_HTTP_PORT || 3999);
const USERNAME_RE = /^[a-zA-Z0-9_]{3,16}$/;

/* База: много номеров у одного юзера. Число номеров ключом является сам phone.
   Бесплатный номер выдаётся максимум один — это жёсткий лимит (free_given в users). */
const db = new DatabaseSync(path.join(__dirname, 'bot-numbers.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS numbers (
    phone TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'free'
  );
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    free_given INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS usernames (
    name TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    price INTEGER NOT NULL
  );
`);
try { db.exec(`ALTER TABLE usernames ADD COLUMN price INTEGER NOT NULL DEFAULT 150`); } catch {}
try { db.exec(`ALTER TABLE users ADD COLUMN tg_username TEXT DEFAULT NULL`); } catch {}

const getPhones = db.prepare('SELECT * FROM numbers WHERE telegram_id = ? ORDER BY created_at ASC');
const getPhoneByPhone = db.prepare('SELECT * FROM numbers WHERE phone = ?');
const saveNumber = db.prepare('INSERT OR REPLACE INTO numbers (phone, telegram_id, created_at, kind) VALUES (?, ?, ?, ?)');
const getFreeGiven = db.prepare('SELECT free_given FROM users WHERE telegram_id = ?');
const setFreeGiven = db.prepare('INSERT INTO users (telegram_id, free_given) VALUES (?, 1) ON CONFLICT(telegram_id) DO UPDATE SET free_given = 1');
const getUserName = db.prepare('SELECT * FROM usernames WHERE telegram_id = ?');
const getByName = db.prepare('SELECT * FROM usernames WHERE name = ?');
const saveName = db.prepare('INSERT OR REPLACE INTO usernames (name, telegram_id, created_at, price) VALUES (?, ?, ?, ?)');
const getUserByTgUsername = db.prepare('SELECT * FROM users WHERE tg_username = ?');
const setTgUsername = db.prepare('INSERT INTO users (telegram_id, tg_username) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET tg_username = excluded.tg_username');

/* Ценник. Анонимный/коллекционный номер = одна позиция +888. */
const ANON_PRICE_RUB = 230;
const ANON_PRICE_STARS = 150;
function anonPriceText() { return `${ANON_PRICE_RUB} ₽ / ${ANON_PRICE_STARS} ⭐`; }

function anonPhone() {
  return `+888${Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('')}`;
}
function freePhone() {
  const isUs = Math.random() < 0.08;
  return `+${isUs ? '1' : '7'}${Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('')}`;
}
function usernamePrice(name) {
  if (/^[0-9]+$/.test(name)) return { rub: 0, stars: 0 };
  return { rub: 140, stars: 100 };
}

async function sendMessage(chatId, text, extra = {}) { await apiCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra }); }
async function editMessage(chatId, mid, text, extra = {}) { await apiCall('editMessageText', { chat_id: chatId, message_id: mid, text, parse_mode: 'HTML', ...extra }); }

function mainKbd() {
  return { resize_keyboard: true, keyboard: [
    [{ text: '🎲 Получить бесплатный номер' }],
    [{ text: '🛒 Магазин' }],
    [{ text: '📒 Мои номера' }, { text: '👤 Мой username' }]
  ]};
}
function mainKbdFor(userId) {
  const kbd = mainKbd().keyboard.slice();
  if (isAdmin(userId)) kbd.push([{ text: '🧑‍💻 Админ' }]);
  return { resize_keyboard: true, keyboard: kbd };
}
function shopKbd() {
  return { inline_keyboard: [
    [{ text: `👑 Анонимный (коллекционный) номер — ${anonPriceText()}`, callback_data: 'shop:anon' }],
    [{ text: `@ Коллекционный username ${anonPriceText()}`, callback_data: 'shop:uname' }],
    [{ text: '◀ Назад', callback_data: 'menu:start' }]
  ]};
}

function greeting(phones, uname) {
  const has = phones.length > 0 || Boolean(uname);
  if (!has) {
    return `Привет! Я бот мессенджера.\n\n• «Получить бесплатный номер» — один бесплатный навсегда\n• «Магазин» — коллекционные номера (+888) без лимита и коллекционный username\n\nКоды для входа в мессенджер приходят сюда же.`;
  }
  const parts = [];
  if (phones.length) parts.push(`Номеров: <b>${phones.length}</b>`);
  if (uname) parts.push(`Username: <b>@${uname.name}</b>`);
  return `Привет! Твои покупки:\n${parts.join('\n')}\n\nПодробнее — в «Мои номера» / «Мой username».`;
}

function phonesList(phones) {
  if (!phones.length) return 'У тебя пока нет номеров.';
  const lines = phones.map((r, i) => {
    const tag = r.kind === 'collectible' ? '👑 коллекционный' : '🎲 бесплатный';
    return `${i + 1}. <b>${r.phone}</b> — ${tag}`;
  });
  return `Твои номера (${phones.length}):\n\n${lines.join('\n')}\n\nНомера закреплены за тобой навсегда.`;
}
function unameInfo(u) {
  const priceTxt = u.price === 0 ? 'бесплатно' : `${u.price} ₽`;
  return `Твой username: <b>@${u.name}</b>\nКоллекционный username, закреплён за тобой.\n\nЦена при покупке: ${priceTxt}.`;
}

function adminPanelsKbd() {
  return { inline_keyboard: [
    [{ text: '📇 Выдать юзернейм на номер', callback_data: 'admin:uname' }],
    [{ text: '📞 Выдать номер по юзернейму', callback_data: 'admin:num' }],
    [{ text: '✖ Закрыть', callback_data: 'admin:close' }]
  ]};
}
function adminHelpText() {
  return `🧑‍💻 <b>Админ-панель</b>\n\nВыберите действие:`;
}

const pendingUname = new Map();
const pendingAdmin = new Map(); // userId -> { step, data }

function saveNameWithLog(name, tgId, ts, price) {
  try {
    saveName.run(name, tgId, ts, price);
    console.log(`[bot] saveName: @${name} -> TG ${tgId} (price ${price}, ts ${ts})`);
  } catch (err) {
    console.error('[bot] saveName ERROR:', err && err.message);
  }
}

async function adminGrantUname(chatId, name, phone) {
  const who = getPhoneByPhone.get(phone);
  if (!who) return sendMessage(chatId, `❌ Номер <b>${phone}</b> ни за кем не закреплён в боте.`, { reply_markup: mainKbd() });
  const un = getByName.get(name);
  if (un && String(un.telegram_id) !== String(who.telegram_id)) return sendMessage(chatId, `❌ Юзернейм <b>@${name}</b> уже занят другим владельцем.`, { reply_markup: mainKbd() });
  saveNameWithLog(name, who.telegram_id, Date.now(), 0);
  return sendMessage(chatId, `✅ Юзернейм <b>@${name}</b> выдан на номер <b>${phone}</b> (владелец TG ${who.telegram_id}).`, { reply_markup: mainKbd() });
}

async function adminGrantNum(chatId, phone, name) {
  const un = getByName.get(name);
  if (!un) return sendMessage(chatId, `❌ Юзернейм <b>@${name}</b> ни за кем не закреплён.`, { reply_markup: mainKbd() });
  const who = getPhoneByPhone.get(phone);
  if (who && String(who.telegram_id) !== String(un.telegram_id)) return sendMessage(chatId, `❌ Номер <b>${phone}</b> уже закреплён за другим владельцем.`, { reply_markup: mainKbd() });
  const kind = phone.startsWith('+888') ? 'collectible' : 'free';
  saveNumber.run(phone, un.telegram_id, Date.now(), kind);
  return sendMessage(chatId, `✅ Номер <b>${phone}</b> привязан к коллекционному username <b>@${name}</b> (владелец TG ${un.telegram_id}).`, { reply_markup: mainKbd() });
}

async function adminGrantNumByTg(chatId, phone, tgUsername) {
  const tu = String(tgUsername).replace(/^@/, '').toLowerCase();
  const target = getUserByTgUsername.get(tu);
  if (!target) return sendMessage(chatId, `❌ Telegram-юзернейм <b>@${tu}</b> не найден. Убедись, что получатель писал боту (/start) хотя бы раз.`, { reply_markup: mainKbd() });
  const tid = target.telegram_id;
  const who = getPhoneByPhone.get(phone);
  if (who && String(who.telegram_id) !== String(tid)) return sendMessage(chatId, `❌ Номер <b>${phone}</b> уже закреплён за другим владельцем (TG ${who.telegram_id}).`, { reply_markup: mainKbd() });
  const kind = phone.startsWith('+888') ? 'collectible' : 'free';
  saveNumber.run(phone, tid, Date.now(), kind);
  await sendMessage(chatId, `✅ Номер <b>${phone}</b> выдан на Telegram-юзернейм <b>@${tu}</b> (TG ${tid}). Теперь он в «Мои номера» у получателя.`, { reply_markup: mainKbd() });
  await sendMessage(tid, `🎉 Администратор выдал тебе номер:\n<b>${phone}</b>\n\nОн уже в разделе «Мои номера».`, { reply_markup: mainKbd() });
  return;
}

function parsePhones(s) { return (s.match(/\+?\d{6,}/g) || []).map(x => (x.startsWith('+') ? x : '+' + x)); }

async function handleCallback(cb) {
  const chatId = cb.message.chat.id, mid = cb.message.message_id, data = cb.data || '', userId = String(cb.from.id);
  try { await apiCall('answerCallbackQuery', { callback_query_id: cb.id }); } catch {}

  if (data === 'menu:start') {
    const phones = getPhones.all(userId); const un = getUserName.get(userId);
    try { await apiCall('deleteMessage', { chat_id: chatId, message_id: mid }); } catch {}
    await sendMessage(chatId, greeting(phones, un), { reply_markup: mainKbdFor(userId) });
    return;
  }
  if (data === 'shop:anon') {
    const n = anonPhone(); saveNumber.run(n, userId, Date.now(), 'collectible');
    try { await apiCall('deleteMessage', { chat_id: chatId, message_id: mid }); } catch {}
    await sendMessage(chatId,
      `👑 Оплачено (${anonPriceText()})!\n\nТвой коллекционный номер:\n<b>${n}</b>\n\nВведи его в мессенджере при регистрации — код придёт сюда.`,
      { reply_markup: mainKbdFor(userId) });
    return;
  }
  if (data === 'shop:uname') {
    pendingUname.set(userId, chatId);
    await editMessage(chatId, mid, `@ Выбери себе коллекционный username.\n\nНапиши желаемое имя (3–16 символов: a-z, 0-9, _):`, { reply_markup: shopKbd() });
    return;
  }

  if (data === 'admin:close') { try { await apiCall('deleteMessage', { chat_id: chatId, message_id: mid }); } catch {} return; }
  if (data === 'admin:uname') {
    if (!isAdmin(userId)) return;
    pendingAdmin.set(userId, { step: 'uname:name', data: {} });
    await editMessage(chatId, mid, `📇 <b>Выдать юзернейм на номер</b>\n\nШаг 1/2. Напиши имя юзернейма (без @):`, { reply_markup: inlineCancel() });
    return;
  }
  if (data === 'admin:num') {
    if (!isAdmin(userId)) return;
    pendingAdmin.set(userId, { step: 'num:phone', data: {} });
    await editMessage(chatId, mid, `📞 <b>Выдать номер по юзернейму</b>\n\nШаг 1/2. Напиши номер (например +79261234567 или +888...):`, { reply_markup: inlineCancel() });
    return;
  }
}

function inlineCancel() { return { inline_keyboard: [[{ text: '✖ Отмена', callback_data: 'admin:close' }]] }; }

async function handleMessage(msg) {
  const chatId = msg.chat.id, text = (msg.text || '').trim(), userId = String(msg.from ? msg.from.id : chatId);
  const phones = getPhones.all(userId); const un = getUserName.get(userId);
  if (msg.from && msg.from.username) setTgUsername.run(userId, String(msg.from.username).toLowerCase());

  if (pendingUname.has(userId)) {
    const name = text.replace(/^@/, '').trim();
    pendingUname.delete(userId);
    if (!USERNAME_RE.test(name)) { await sendMessage(chatId, 'Имя должно быть 3–16 символов: латиница, цифры, _ . Попробуй ещё раз.', { reply_markup: mainKbdFor(userId) }); return; }
    if (getByName.get(name)) { await sendMessage(chatId, `@${name} уже занят. Выбери другое.`, { reply_markup: mainKbdFor(userId) }); return; }
    const p = usernamePrice(name);
    saveName.run(name, userId, Date.now(), p.rub);
    const priceTxt = p.rub === 0 ? 'бесплатно' : `${p.rub} ₽ / ${p.stars} ⭐`;
    await sendMessage(chatId,
      `${p.rub === 0 ? '🎁' : '@'} ${p.rub === 0 ? 'Готово!' : 'Оплачено!'}\n\nТвой юзернейм:\n<b>@${name}</b>\n\nЦена: ${priceTxt}. Теперь он твой навсегда.\n\nУстанови его в мессенджере в профиле.`,
      { reply_markup: mainKbdFor(userId) });
    return;
  }

  if (text.includes('Админ')) {
    if (!isAdmin(userId)) { await sendMessage(chatId, '⛔ Нет прав администратора.'); return; }
    await sendMessage(chatId, adminHelpText(), { reply_markup: adminPanelsKbd() });
    return;
  }

  if (pendingAdmin.has(userId)) {
    const st = pendingAdmin.get(userId);
    if (text === '✖ Отмена' || text === '/cancel') { pendingAdmin.delete(userId); await sendMessage(chatId, 'Отменено.', { reply_markup: mainKbdFor(userId) }); return; }
    if (st.step === 'uname:name') {
      const name = text.replace(/^@/, '').trim();
      if (!USERNAME_RE.test(name)) { await sendMessage(chatId, '❌ Некорректное имя (3–16: латиница, цифры, _). Попробуй ещё раз.', { reply_markup: mainKbdFor(userId) }); return; }
      st.data.name = name; st.step = 'uname:phone';
      await sendMessage(chatId, `✔ Имя: <b>@${name}</b>\n\nШаг 2/2. Теперь номер владельца (например +79261234567):`, { reply_markup: mainKbdFor(userId) });
      return;
    }
    if (st.step === 'uname:phone') {
      const p = parsePhones(text);
      if (!p.length) { await sendMessage(chatId, '❌ Не нашёл номер в сообщении. Введи номер ещё раз:', { reply_markup: mainKbdFor(userId) }); return; }
      const phone = p[0]; const name = st.data.name; pendingAdmin.delete(userId);
      console.log(`[bot] adminGrantUname: name=@${name} phone=${phone} from TG ${userId}`);
      await adminGrantUname(chatId, name, phone);
      return;
    }
    if (st.step === 'num:phone') {
      const p = parsePhones(text);
      if (!p.length) { await sendMessage(chatId, '❌ Не нашёл номер. Введи номер ещё раз:', { reply_markup: mainKbdFor(userId) }); return; }
      st.data.phone = p[0]; st.step = 'num:addr';
      await sendMessage(chatId, `✔ Номер: <b>${p[0]}</b>\n\nШаг 2/2. Укажи, кому выдать — напиши <b>@telegram_username</b> получателя:`, { reply_markup: mainKbdFor(userId) });
      return;
    }
    if (st.step === 'num:addr') {
      const m = text.replace(/^@/, '').trim();
      if (!m) { await sendMessage(chatId, '❌ Введи Telegram username получателя (@имя):', { reply_markup: mainKbdFor(userId) }); return; }
      pendingAdmin.delete(userId);
      await adminGrantNumByTg(chatId, st.data.phone, m);
      return;
    }
  }

  if (text === '/start') { await sendMessage(chatId, greeting(phones, un), { reply_markup: mainKbdFor(userId) }); return; }

  if (text.includes('бесплатный') || text.includes('Получить номер')) {
    const free = getFreeGiven.get(userId);
    if (free && free.free_given) {
      await sendMessage(chatId, '🎲 Бесплатный номер ты уже получал — он выдаётся только один раз.\n\nДополнительные номера — в «Магазин».', { reply_markup: mainKbdFor(userId) });
      return;
    }
    const n = freePhone(); saveNumber.run(n, userId, Date.now(), 'free'); setFreeGiven.run(userId);
    await sendMessage(chatId, `🎲 Твой бесплатный номер:\n<b>${n}</b>\n\nОн закреплён за тобой навсегда. Больше бесплатных не будет — следующие номера в «Магазин».`, { reply_markup: mainKbdFor(userId) });
    return;
  }

  if (text.includes('Магазин')) { await sendMessage(chatId, '🛒 <b>Магазин</b>\n\nВыбери товар:', { reply_markup: shopKbd() }); return; }

  if (text.includes('Мои номера')) {
    await sendMessage(chatId, phonesList(phones), { reply_markup: mainKbdFor(userId) }); return;
  }
  if (text.includes('username') || text.includes('Username')) {
    if (!un) { await sendMessage(chatId, 'У тебя пока нет коллекционного username. Зайди в «Магазин».', { reply_markup: mainKbdFor(userId) }); return; }
    await sendMessage(chatId, unameInfo(un), { reply_markup: mainKbdFor(userId) }); return;
  }
  await sendMessage(chatId, 'Я бот мессенджера. Нажми «Магазин» или получи бесплатный номер.', { reply_markup: mainKbdFor(userId) });
}

async function poll(offset) {
  let updates;
  try { updates = await apiCall('getUpdates', { offset, timeout: 25 }); }
  catch (e) { console.error('[bot] getUpdates:', e.message); return offset; }
  for (const u of updates) {
    if (u.message) handleMessage(u.message).catch(err => console.error('[bot]', err));
    if (u.callback_query) handleCallback(u.callback_query).catch(err => console.error('[bot] cb:', err));
  }
  return updates.length ? updates[updates.length - 1].update_id + 1 : offset;
}

/* --- HTTP: приёмник кодов + профиль --- */
http.createServer((req, res) => {
  const send = (obj) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');

      // GET-профиль: по любому номеру владельца вернуть все его телефоны и имена.
      if (req.url === '/profile') {
        const phone = String(data.phone || '').trim();
        const who = getPhoneByPhone.get(phone);
        if (!who) { send({ ok: false, reason: 'владелец не найден' }); return; }
        const uid = who.telegram_id;
        const phones = getPhones.all(uid).map(r => ({ phone: r.phone, kind: r.kind, boughtAt: r.created_at, price: r.kind === 'collectible' ? ANON_PRICE_RUB : 0 }));
        const names = db.prepare('SELECT * FROM usernames WHERE telegram_id = ? ORDER BY created_at ASC').all(uid)
          .map(u => ({ name: u.name, price: u.price, boughtAt: u.created_at }));
        send({ ok: true, phone, owner: uid, numbers: phones, usernames: names });
        return;
      }

      // POST доставка кода
      const phone = String(data.phone || '').trim();
      const code = String(data.code || '').trim();
      const r = getPhoneByPhone.get(phone);
      if (r && code) {
        console.log(`[bot] Код для ${phone} -> TG ${r.telegram_id}`);
        await sendMessage(r.telegram_id, `🔑 Код для входа\n\nНомер: <b>${phone}</b>\nКод: <b>${code}</b>\n\nДействует 5 минут.`, { reply_markup: mainKbd() });
        send({ ok: true });
      } else {
        send({ ok: false, reason: 'не найден' });
      }
    } catch (e) { console.error('[bot] http:', e.message); res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false })); }
  });
}).listen(HTTP_PORT, () => console.log(`[bot] HTTP-приёмник на порту ${HTTP_PORT}`));

(async () => {
  let me = null;
  for (let i = 0; i < 30 && !me; i++) {
    try { await apiCall('deleteWebhook', {}).catch(() => {}); me = await apiCall('getMe'); }
    catch (e) { console.error(`[bot] подключение (${i + 1}): ${e.message}`); await new Promise(r => setTimeout(r, 5000)); }
  }
  console.log(me ? `[bot] Запущен: @${me.username}` : '[bot] Только HTTP-приёмник.');
  let offset = 0;
  while (me) { try { offset = await poll(offset); } catch (e) { console.error('[bot] poll:', e.message); } await new Promise(r => setTimeout(r, 500)); }
})().catch(err => console.error('[bot] fatal:', err));