'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const store = require('./db');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const MAX_BODY_CHARS = 8000;
const USERNAME_RE = /^[a-zA-Z0-9_]{5,20}$/;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const BOT_CODE_URL = process.env.BOT_CODE_URL || 'http://127.0.0.1:3999/';
const WS_RATE_WINDOW_MS = 10 * 1000;
const WS_RATE_MAX = 20;

const online = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 512 * 1024) {
        reject(Object.assign(new Error('Слишком большой запрос'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Некорректный JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(token) {
  return `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

function clearCookie() {
  return 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
}

function currentUser(req) {
  const token = (req.headers['x-sid'] || '').trim() || parseCookies(req.headers.cookie).sid;
  if (!token) return null;
  const session = store.getSession(token);
  if (!session) return null;
  return store.getUserById(session.user_id);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function normalizePhone(raw) {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+') || cleaned.length < 8) return null;
  return cleaned;
}

function nickFor(phone) {
  const digits = phone.replace(/\D/g, '');
  const base = 'u' + digits.slice(-10);
  let nick = base;
  let i = 1;
  while (store.getUserByUsername(nick)) {
    nick = base + '_' + (i++);
  }
  return nick;
}

function deliverCodeToBot(phone, code) {
  // Отправляет код в Telegram через бота (HTTP-приёмник bot.js).
  return new Promise(resolve => {
    const payload = JSON.stringify({ phone, code });
    const mod = BOT_CODE_URL.startsWith('https:') ? require('node:https') : http;
    const req = mod.request(BOT_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 3000
    }, res => {
      res.resume();
      res.on('end', () => resolve());
    });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(payload);
    req.end();
  });
}

const BOT_PROFILE_URL = process.env.BOT_PROFILE_URL || 'http://127.0.0.1:3999/profile';

// Запрашивает у бота список номеров и коллекционных юзернеймов владельца телефона.
function fetchBotProfile(phone) {
  return new Promise(resolve => {
    if (!phone) return resolve(null);
    const payload = JSON.stringify({ phone });
    const req = http.request(BOT_PROFILE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 3000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.write(payload);
    req.end();
  });
}

function verifyPassword(password, salt, expectedHex) {
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function publicLot(row) {
  let itemData = {};
  try { itemData = row.item_data ? JSON.parse(row.item_data) : {}; } catch {}
  return {
    id: row.id,
    sellerId: row.seller_id,
    kind: row.kind,
    itemId: row.item_id,
    itemName: row.item_name,
    itemData,
    price: row.price,
    status: row.status,
    createdAt: row.created_at
  };
}

function publicUser(row, options = {}) {
  const hidden = Boolean(row.hide_online) && !options.self;
  return {
    id: row.id,
    username: row.username_set ? row.username : null,
    displayName: row.display_name,
    bio: row.bio || '',
    avatar: row.avatar || null,
    phone: row.phone || null,
    phoneCollectible: Boolean(row.phone_collectible),
    phonePrice: row.phone_price || null,
    phoneBoughtAt: row.phone_bought_at || null,
    createdAt: row.created_at,
    hideOnline: Boolean(row.hide_online),
    lastSeenHidden: Boolean(row.hide_last_seen),
    lastSeen: hidden || (Boolean(row.hide_last_seen) && !options.self) ? null : row.last_seen,
    publicKey: row.public_key || null,
    online: hidden ? false : online.has(row.id),
    verified: Boolean(row.verified),
    majorVerified: Boolean(row.major_verified),
    statusEmoji: row.status_emoji || null,
    isAdmin: Boolean(row.is_admin),
    balance: options.self ? (store.walletOf(row.id) ? store.walletOf(row.id).balance : 0) : undefined
  };
}

function sessionHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 16);
}

const loginAttempts = new Map();

function clientKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

function sessionMeta(req) {
  return {
    ua: String(req.headers['user-agent'] || '').slice(0, 200),
    ip: clientKey(req)
  };
}

function makeInviteToken() {
  return crypto.randomBytes(12).toString('base64url');
}

function isThrottled(key) {
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) {
    loginAttempts.delete(key);
    return false;
  }
  return rec.count >= LOGIN_MAX_ATTEMPTS;
}

function noteFailedLogin(key) {
  const rec = loginAttempts.get(key);
  if (!rec || Date.now() > rec.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

function sendWs(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function sendToUser(userId, payload) {
  const sockets = online.get(userId);
  if (!sockets) return;
  for (const ws of sockets) sendWs(ws, payload);
}

function sendToChatMembers(chatId, payload, exceptUserId = null) {
  for (const memberId of store.chatMemberIds(chatId)) {
    if (memberId === exceptUserId) continue;
    sendToUser(memberId, payload);
  }
}

function broadcastMessage(chatId, senderId, payload) {
  const message = store.insertMessage(chatId, senderId, payload);
  message.reactions = {};
  message.myReaction = null;
  sendToChatMembers(chatId, { type: 'message', chatId, message });
  return message;
}

function broadcastPresence(userId) {
  const row = store.getUserById(userId);
  const visible = !(row && row.hide_online) && online.has(userId);
  const payload = { type: 'presence', userId, online: visible };
  for (const sockets of online.values()) {
    for (const ws of sockets) sendWs(ws, payload);
  }
}

function notifyRead(chatId, userId, messageId) {
  sendToChatMembers(chatId, { type: 'read', chatId, userId, messageId }, userId);
}

function withReactions(messages, viewerId) {
  const summary = store.reactionSummary(messages.map(message => message.id), viewerId);
  for (const message of messages) {
    const data = summary.get(message.id) || { counts: {}, mine: null };
    message.reactions = data.counts;
    message.myReaction = data.mine;
  }
  return messages;
}

function sendReactionEvent(chatId, messageId, viewerId) {
  const data = store.reactionSummary([messageId], viewerId).get(messageId) || { counts: {}, mine: null };
  sendToChatMembers(chatId, {
    type: 'reaction',
    chatId,
    messageId,
    reactions: data.counts,
    mine: data.mine
  }, viewerId);
}

function sendPollEvent(chatId, messageId, viewerId) {
  sendToChatMembers(chatId, { type: 'poll', chatId, messageId }, viewerId);
}

function pollPayload(message, viewerId) {
  const options = message.pollOptions || [];
  const results = store.pollResults(message.id, viewerId);
  return {
    messageId: message.id,
    question: message.pollQuestion,
    options,
    anonymous: message.pollAnonymous,
    counts: results.counts,
    total: results.total,
    mine: results.mine
  };
}

const REACTION_RE = /^[\u{1F000}-\u{1FAFF}\u{2000}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2764}\u{2600}-\u{27FF}]+$/u;

function addConnection(user, ws) {
  if (!online.has(user.id)) online.set(user.id, new Set());
  online.get(user.id).add(ws);
  store.touchUser(user.id);
  if (online.get(user.id).size === 1) broadcastPresence(user.id);
}

function removeConnection(user, ws) {
  const sockets = online.get(user.id);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) {
    online.delete(user.id);
    store.touchUser(user.id);
    broadcastPresence(user.id);
  }
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  if (pathname === '/api/auth/phone' && method === 'POST') {
    const body = await readJsonBody(req);
    const phone = normalizePhone(String(body.phone || '').trim());
    if (!phone) return sendJson(res, 400, { error: 'Введите корректный номер телефона' });

    const collectible = phone.startsWith('+888');
    const code = String(Math.floor(10000 + Math.random() * 90000));
    store.makeAuthCode(phone, code);
    console.log(`[auth] код для ${phone}: ${code}`);
    deliverCodeToBot(phone, code);

    const existing = store.getUserByPhone(phone);
    return sendJson(res, 200, { phone, collectible, exists: Boolean(existing) });
  }

  if (pathname === '/api/auth/verify' && method === 'POST') {
    const body = await readJsonBody(req);
    const phone = normalizePhone(String(body.phone || '').trim());
    const code = String(body.code || '').trim();
    if (!phone || !/^\d{4,6}$/.test(code)) {
      return sendJson(res, 400, { error: 'Введите код из уведомления' });
    }

    const record = store.getAuthCode(phone);
    if (!record) return sendJson(res, 400, { error: 'Код уже не действует, отправьте новый' });
    if (Date.now() - record.created_at > AUTH_CODE_TTL_MS) {
      store.clearAuthCode(phone);
      return sendJson(res, 400, { error: 'Код истёк, отправьте новый' });
    }
    if (record.attempts >= 5) {
      return sendJson(res, 429, { error: 'Слишком много попыток. Отправьте новый код' });
    }
    if (record.code !== code) {
      store.bumpAuthAttempts(phone);
      return sendJson(res, 400, { error: 'Неверный код' });
    }
    store.clearAuthCode(phone);

    const collectible = phone.startsWith('+888');
    let user = store.getUserByPhone(phone);
    const isNew = !user;
    if (!user) {
      const displayName = String(body.displayName || '').trim().slice(0, 40) || 'Пользователь';
      user = store.createUser({ username: nickFor(phone), displayName, salt: '', hash: '', phone, collectible });
    }

    const token = store.createSession(user.id, Date.now() + SESSION_TTL_MS, sessionMeta(req));
    res.setHeader('Set-Cookie', sessionCookie(token));
    store.touchUser(user.id);
    return sendJson(res, 200, { user: publicUser(user, { self: true }), isNew, token });
  }

  if (pathname === '/api/register' && method === 'POST') {
    const body = await readJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim().slice(0, 40) || username;

    if (!USERNAME_RE.test(username)) {
      return sendJson(res, 400, { error: 'Логин: 3–20 символов, латиница, цифры и _' });
    }
    if (password.length < 8) {
      return sendJson(res, 400, { error: 'Пароль должен быть не короче 8 символов' });
    }
    if (store.getUserByUsername(username)) {
      return sendJson(res, 409, { error: 'Такой логин уже занят' });
    }

    const { salt, hash } = hashPassword(password);
    const user = store.createUser({ username, displayName, salt, hash });
    const token = store.createSession(user.id, Date.now() + SESSION_TTL_MS, sessionMeta(req));
    res.setHeader('Set-Cookie', sessionCookie(token));
    return sendJson(res, 201, { user: publicUser(user, { self: true }), token });
  }

  if (pathname === '/api/login' && method === 'POST') {
    const key = clientKey(req);
    if (isThrottled(key)) {
      return sendJson(res, 429, { error: 'Слишком много попыток, попробуйте через 5 минут' });
    }

    const body = await readJsonBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const user = store.getUserByUsername(username);

    if (!user || !verifyPassword(password, user.pass_salt, user.pass_hash)) {
      noteFailedLogin(key);
      return sendJson(res, 401, { error: 'Неверный логин или пароль' });
    }

    const token = store.createSession(user.id, Date.now() + SESSION_TTL_MS, sessionMeta(req));
    res.setHeader('Set-Cookie', sessionCookie(token));
    store.touchUser(user.id);
    return sendJson(res, 200, { user: publicUser(user, { self: true }), token });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const token = (req.headers['x-sid'] || '').trim() || parseCookies(req.headers.cookie).sid;
    if (token) store.deleteSession(token);
    res.setHeader('Set-Cookie', clearCookie());
    return sendJson(res, 200, { ok: true });
  }

  const me = currentUser(req);
  if (!me) return sendJson(res, 401, { error: 'Нужно войти' });

  if (pathname === '/api/account' && method === 'DELETE') {
    const token = parseCookies(req.headers.cookie).sid;
    if (token) store.deleteSession(token);
    store.deleteAccount(me.id);
    res.setHeader('Set-Cookie', clearCookie());
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const user = publicUser(me, { self: true });
    user.purchaseCount = store.purchaseCountOf(me.id);
    const bp = await fetchBotProfile(me.phone);
    if (bp && bp.ok) {
      user.numbers = (bp.numbers || []).map(n => ({
        phone: n.phone,
        kind: n.kind,
        collectible: n.kind === 'collectible',
        boughtAt: n.boughtAt,
        price: n.price
      }));
      user.collectUsernames = (bp.usernames || []).map(u => ({
        name: u.name,
        price: u.price,
        boughtAt: u.boughtAt
      }));
    }
    return sendJson(res, 200, { user });
  }

  if (pathname === '/api/me' && method === 'PATCH') {
    const body = await readJsonBody(req);
    const displayName = String(body.displayName ?? me.display_name).trim().slice(0, 40) || me.display_name;
    const bio = String(body.bio ?? '').trim().slice(0, 140);

    if (body.username !== undefined) {
      const usernameRaw = String(body.username || '').replace(/^@/, '').trim();
      if (!usernameRaw || !USERNAME_RE.test(usernameRaw)) {
        return sendJson(res, 400, { error: 'Имя пользователя: 3–20 символов, латиница, цифры и _' });
      }
      const taken = store.getUserByUsername(usernameRaw);
      if (taken && taken.id !== me.id) {
        return sendJson(res, 409, { error: 'Это имя пользователя уже занято' });
      }
      store.setUsername(me.id, usernameRaw);
    }

    if (body.statusEmoji !== undefined) {
      store.setStatusEmoji(me.id, body.statusEmoji === null ? null : String(body.statusEmoji).slice(0, 2));
    }

    let avatar = me.avatar || null;
    if (body.avatar !== undefined) {
      if (body.avatar === null || body.avatar === '') {
        avatar = null;
      } else {
        const value = String(body.avatar);
        const valid = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
        if (!valid || value.length > 300000) {
          return sendJson(res, 400, { error: 'Фото: PNG, JPEG или WEBP до 300 КБ' });
        }
        avatar = value;
      }
    }

    store.updateProfile(me.id, displayName, bio, avatar, me.phone);
    const fresh = store.getUserById(me.id);
    return sendJson(res, 200, { user: publicUser(fresh, { self: true }) });
  }

  if (pathname === '/api/password' && method === 'POST') {
    const body = await readJsonBody(req);
    const current = String(body.currentPassword || '');
    const next = String(body.newPassword || '');

    if (!verifyPassword(current, me.pass_salt, me.pass_hash)) {
      return sendJson(res, 400, { error: 'Текущий пароль неверен' });
    }
    if (next.length < 8) {
      return sendJson(res, 400, { error: 'Новый пароль должен быть не короче 8 символов' });
    }

    const { salt, hash } = hashPassword(next);
    store.updatePassword(me.id, salt, hash);

    const currentToken = parseCookies(req.headers.cookie).sid;
    for (const session of store.listSessions(me.id)) {
      if (session.token !== currentToken) store.deleteUserSession(me.id, session.token);
    }

    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/privacy' && method === 'POST') {
    const body = await readJsonBody(req);
    if (body.hideOnline !== undefined) store.setHideOnline(me.id, Boolean(body.hideOnline));
    if (body.hideLastSeen !== undefined) store.setHideLastSeen(me.id, Boolean(body.hideLastSeen));
    broadcastPresence(me.id);

    const fresh = store.getUserById(me.id);
    return sendJson(res, 200, { user: publicUser(fresh, { self: true }) });
  }

  if (pathname === '/api/sessions' && method === 'GET') {
    const currentToken = parseCookies(req.headers.cookie).sid;
    const sessions = store.listSessions(me.id).map(session => ({
      id: sessionHash(session.token),
      current: session.token === currentToken,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      ua: session.ua || '',
      ip: session.ip || ''
    }));
    return sendJson(res, 200, { sessions });
  }

  if (pathname === '/api/sessions' && method === 'DELETE') {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    const currentToken = parseCookies(req.headers.cookie).sid;
    const target = store.listSessions(me.id).find(session => sessionHash(session.token) === id);

    if (!target) return sendJson(res, 404, { error: 'Сеанс не найден' });

    store.deleteUserSession(me.id, target.token);
    if (target.token === currentToken) res.setHeader('Set-Cookie', clearCookie());
    return sendJson(res, 200, { ok: true, current: target.token === currentToken });
  }

  if (pathname === '/api/keys' && method === 'POST') {
    const body = await readJsonBody(req);
    const publicKey = String(body.publicKey || '').trim();

    if (!publicKey || publicKey.length > 2000) {
      return sendJson(res, 400, { error: 'Некорректный публичный ключ' });
    }

    let parsed;
    try {
      parsed = JSON.parse(publicKey);
    } catch {
      return sendJson(res, 400, { error: 'Ключ должен быть в формате JWK' });
    }

    if (!parsed || parsed.kty !== 'EC' || !parsed.x || !parsed.y) {
      return sendJson(res, 400, { error: 'Ключ должен быть EC P-256' });
    }

    store.setPublicKey(me.id, publicKey);
    const fresh = store.getUserById(me.id);
    return sendJson(res, 200, { user: publicUser(fresh, { self: true }) });
  }

  if (pathname === '/api/users' && method === 'GET') {
    const users = store.listUsers()
      .filter(row => row.id !== me.id)
      .map(row => ({ ...publicUser(row), messageCount: store.messageCountWith(me.id, row.id) }));
    return sendJson(res, 200, { users });
  }

  // ---------- Кошелёк ----------
  if (pathname === '/api/wallet' && method === 'GET') {
    const wallet = store.walletOf(me.id);
    store.ensureWallet(me.id);
    return sendJson(res, 200, { wallet: store.walletOf(me.id) });
  }

  if (pathname === '/api/wallet/topup' && method === 'POST') {
    const body = await readJsonBody(req);
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return sendJson(res, 400, { error: 'Некорректная сумма пополнения' });
    }
    store.addFunds(me.id, amount);
    store.recordTransfer({ from: null, to: me.id, amount, note: 'Пополнение', kind: 'topup' });
    return sendJson(res, 200, { balance: store.walletOf(me.id).balance });
  }

  if (pathname === '/api/wallet/transfer' && method === 'POST') {
    const body = await readJsonBody(req);
    const targetNo = String(body.walletNo || '').trim();
    const amount = Math.round(Number(body.amount));
    if (!/^\d{9}$/.test(targetNo)) {
      return sendJson(res, 400, { error: 'Номер кошелька: 9 цифр' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return sendJson(res, 400, { error: 'Сумма должна быть больше нуля' });
    }

    const ownWallet = store.ensureWallet(me.id);
    if (targetNo === ownWallet) {
      return sendJson(res, 400, { error: 'Нельзя перевести самому себе' });
    }

    const target = store.findUserByWallet(targetNo);
    if (!target) return sendJson(res, 404, { error: 'Кошелёк не найден' });

    const own = store.walletOf(me.id);
    if (own.balance < amount) {
      return sendJson(res, 400, { error: 'Недостаточно средств на балансе' });
    }

    store.addFunds(me.id, -amount);
    store.addFunds(target.id, amount);
    store.recordTransfer({ from: me.id, to: target.id, amount, note: String(body.note || '').slice(0, 200), kind: 'transfer' });
    return sendJson(res, 200, {
      balance: store.walletOf(me.id).balance,
      transfer: { amount, to: target.wallet_no }
    });
  }

  if (pathname === '/api/market/buy' && method === 'POST') {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    const price = Math.round(Number(body.price));
    if (!id || !Number.isFinite(price) || price <= 0) {
      return sendJson(res, 400, { error: 'Некорректный товар' });
    }
    const own = store.walletOf(me.id);
    if (!own || own.balance < price) {
      return sendJson(res, 400, { error: 'Недостаточно средств на балансе' });
    }
    store.addFunds(me.id, -price);
    store.recordTransfer({ from: me.id, to: null, amount: price, note: `Покупка подарка ${id}`, kind: 'purchase' });
    return sendJson(res, 200, { balance: store.walletOf(me.id).balance });
  }

  if (pathname === '/api/market/upgrade' && method === 'POST') {
    const body = await readJsonBody(req);
    const id = String(body.id || '');
    const price = Math.round(Number(body.price));
    if (!id || !Number.isFinite(price) || price <= 0) {
      return sendJson(res, 400, { error: 'Некорректный товар' });
    }
    const own = store.walletOf(me.id);
    if (!own || own.balance < price) {
      return sendJson(res, 400, { error: 'Недостаточно средств на балансе' });
    }
    store.addFunds(me.id, -price);
    store.recordTransfer({ from: me.id, to: null, amount: price, note: `Улучшение подарка ${id}`, kind: 'purchase' });
    return sendJson(res, 200, { balance: store.walletOf(me.id).balance });
  }

  if (pathname === '/api/market/lots' && method === 'GET') {
    const lots = store.listActiveLots().map(lot => publicLot(lot));
    return sendJson(res, 200, { lots });
  }

  if (pathname === '/api/market/mine' && method === 'GET') {
    const lots = store.listLotsOfSeller(me.id).map(lot => publicLot(lot));
    return sendJson(res, 200, { lots });
  }

  if (pathname === '/api/market/lots' && method === 'POST') {
    const body = await readJsonBody(req);
    const { kind, itemId, itemName, itemData, price } = body;
    const kindOk = ['gift', 'number', 'username'].includes(kind);
    if (!kindOk || !itemId || !itemName) return sendJson(res, 400, { error: 'Некорректный лот' });
    const priceNum = Math.round(Number(price));
    if (!Number.isFinite(priceNum) || priceNum < 1 || priceNum > 100000000) {
      return sendJson(res, 400, { error: 'Некорректная цена' });
    }
    const id = store.createLot({ sellerId: me.id, kind, itemId, itemName, itemData: itemData || {}, price: priceNum });
    const lot = store.getLot(id);
    return sendJson(res, 201, { lot: publicLot(lot) });
  }

  const lotMatch = pathname.match(/^\/api\/market\/lots\/(\d+)(?:\/(buy|cancel))?$/);
  if (lotMatch) {
    const lotId = Number(lotMatch[1]);
    const action = lotMatch[2] || '';
    const lot = store.getLot(lotId);
    if (!lot) return sendJson(res, 404, { error: 'Лот не найден' });

    if ((action === 'buy' || !action) && method === 'POST') {
      if (lot.seller_id === me.id) return sendJson(res, 400, { error: 'Нельзя купить свой лот' });
      const own = store.walletOf(me.id);
      if (!own || own.balance < lot.price) return sendJson(res, 400, { error: 'Недостаточно средств' });
      if (!store.markLotSold(lotId, me.id)) return sendJson(res, 409, { error: 'Лот уже продан' });
      store.addFunds(me.id, -lot.price);
      store.grantFunds(lot.seller_id, lot.price);
      store.recordTransfer({ from: me.id, to: lot.seller_id, amount: lot.price, note: `Покупка лота #${lotId}`, kind: 'market' });
      store.bumpPurchaseCount(me.id);
      const purchaseNo = store.purchaseCountOf(me.id);
      return sendJson(res, 200, { balance: store.walletOf(me.id).balance, purchaseNo, purchasePrice: lot.price });
    }

    if (action === 'cancel' && method === 'POST') {
      if (lot.seller_id !== me.id) return sendJson(res, 403, { error: 'Нет прав' });
      store.cancelLot(lotId, me.id);
      return sendJson(res, 200, { ok: true });
    }
  }

  if (pathname === '/api/wallet/transfers' && method === 'GET') {
    const transfers = store.listTransfersOf(me.id, 100).map(t => ({
      id: t.id,
      from: t.from_user,
      to: t.to_user,
      amount: t.amount,
      note: t.note,
      kind: t.kind,
      createdAt: t.created_at
    }));
    return sendJson(res, 200, { transfers });
  }

  // ---------- Пополнение кошелька (админ выдает) ----------
  if (pathname === '/api/admin/topup' && method === 'POST') {
    const me2 = store.getUserById(me.id);
    if (!me2.is_admin) return sendJson(res, 403, { error: 'Нет прав администратора' });

    const body = await readJsonBody(req);
    const amount = Math.round(Number(body.amount));
    const targetId = Number(body.userId);
    if (!Number.isFinite(amount) || amount < 0) return sendJson(res, 400, { error: 'Некорректная сумма' });
    if (!Number.isFinite(targetId) || !store.getUserById(targetId)) return sendJson(res, 404, { error: 'Пользователь не найден' });

    store.grantFunds(targetId, amount);
    store.recordTransfer({ from: null, to: targetId, amount: Math.max(0, amount), note: body.note || 'Выдача', kind: amount < 0 ? 'revoke' : 'admin_grant' });
    return sendJson(res, 200, { balance: store.walletOf(targetId).balance });
  }

  // ---------- Админ-панель ----------
  if (pathname === '/api/admin' && method === 'GET') {
    const me2 = store.getUserById(me.id);
    if (!me2.is_admin) return sendJson(res, 403, { error: 'Нет прав администратора' });

    const users = store.listUsers().map(u => ({
      id: u.id,
      displayName: u.display_name,
      username: u.username,
      verified: Boolean(u.verified),
      majorVerified: Boolean(u.major_verified),
      isAdmin: Boolean(u.is_admin),
      balance: u.balance || 0,
      walletNo: u.wallet_no,
      createdAt: u.created_at
    }));
    const transfers = store.listAllTransfers(200).map(t => ({
      id: t.id, from: t.from_user, to: t.to_user,
      amount: t.amount, note: t.note, kind: t.kind, createdAt: t.created_at
    }));
    return sendJson(res, 200, { users, transfers });
  }

  if (pathname === '/api/admin/users' && method === 'GET') {
    const me2 = store.getUserById(me.id);
    if (!me2.is_admin) return sendJson(res, 403, { error: 'Нет прав администратора' });
    const users = store.listUsers().map(u => ({
      id: u.id, displayName: u.display_name, username: u.username,
      verified: Boolean(u.verified), majorVerified: Boolean(u.major_verified), isAdmin: Boolean(u.is_admin),
      balance: u.balance || 0, walletNo: u.wallet_no, createdAt: u.created_at
    }));
    return sendJson(res, 200, { users });
  }

  if (pathname === '/api/admin/verify' && method === 'POST') {
    const me2 = store.getUserById(me.id);
    if (!me2.is_admin) return sendJson(res, 403, { error: 'Нет прав администратора' });

    const body = await readJsonBody(req);
    const chatVerify = pathname.includes('chat') ? null : body;
    if (body.kind === 'user') {
      const userId = Number(body.targetId);
      if (!Number.isFinite(userId) || !store.getUserById(userId)) return sendJson(res, 404, { error: 'Пользователь не найден' });
      if (body.badge === 'major') {
        store.setMajorVerified(userId, Boolean(body.on));
      } else {
        store.setUserVerified(userId, Boolean(body.verified !== undefined ? body.verified : body.on));
      }
      return sendJson(res, 200, { ok: true });
    }
    if (body.kind === 'chat') {
      const chatId = Number(body.targetId);
      if (!Number.isFinite(chatId) || !store.memberCount(chatId)) return sendJson(res, 404, { error: 'Чат не найден' });
      store.setChatVerified(chatId, Boolean(body.verified));
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: 'Некорректный запрос' });
  }

  if (pathname === '/api/chats' && method === 'GET') {
    return sendJson(res, 200, { chats: store.listChats(me.id) });
  }

  if (pathname === '/api/chats' && method === 'POST') {
    const body = await readJsonBody(req);

    if (body.kind === 'group' || body.kind === 'channel') {
      const title = String(body.title || '').trim().slice(0, 80);
      if (title.length < 2) return sendJson(res, 400, { error: 'Название: минимум 2 символа' });

      const usernameRaw = String(body.username || '').trim().replace(/^@/, '');
      if (usernameRaw && !/^[a-zA-Z0-9_]{4,32}$/.test(usernameRaw)) {
        return sendJson(res, 400, { error: 'Ссылка: 4–32 символа, латиница, цифры и _' });
      }
      if (usernameRaw && store.findChatByUsername(usernameRaw)) {
        return sendJson(res, 409, { error: 'Такая ссылка уже занята' });
      }

      const chatId = store.createNamedChat({
        kind: body.kind,
        title,
        description: String(body.description || '').trim().slice(0, 255),
        username: usernameRaw || null,
        inviteToken: makeInviteToken(),
        historyForNew: body.historyForNew === undefined ? true : Boolean(body.historyForNew),
        createdBy: me.id
      });

      const chat = store.chatForUser(chatId, me.id);
      sendToUser(me.id, { type: 'chat', chat });

      if (body.kind === 'channel') {
        const created = store.insertMessage(chatId, me.id, {
          body: 'Канал создан',
          kind: 'service'
        });
        sendToChatMembers(chatId, { type: 'message', chatId, message: created }, me.id);
        sendToUser(me.id, { type: 'message', chatId, message: created });
      }

      return sendJson(res, 201, { chat });
    }

    const peerId = Number(body.userId);
    const peer = store.getUserById(peerId);

    if (!peer) return sendJson(res, 404, { error: 'Пользователь не найден' });
    if (peer.id === me.id) return sendJson(res, 400, { error: 'Нельзя открыть чат с самим собой' });

    const chatId = store.createDirectChat(me.id, peer.id);
    const chat = store.chatForUser(chatId, me.id);
    const peerChat = store.chatForUser(chatId, peer.id);

    sendToUser(peer.id, { type: 'chat', chat: peerChat });
    sendToUser(me.id, { type: 'chat', chat });

    return sendJson(res, 200, { chat });
  }

  const blockMatch = pathname.match(/^\/api\/users\/(\d+)\/(block|unblock)$/);
  if (blockMatch && method === 'POST') {
    const targetId = Number(blockMatch[1]);
    const target = store.getUserById(targetId);
    if (!target) return sendJson(res, 404, { error: 'Пользователь не найден' });
    if (target.id === me.id) return sendJson(res, 400, { error: 'Нельзя блокировать самого себя' });

    if (blockMatch[2] === 'block') store.blockUser(me.id, targetId);
    else store.unblockUser(me.id, targetId);

    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/users/blocked' && method === 'GET') {
    const blocked = store.myBlockedIds(me.id);
    return sendJson(res, 200, { blocked });
  }

  if (pathname === '/api/saved') {
    const chatId = store.getSavedChat(me.id);
    const chat = store.chatForUser(chatId, me.id);
    sendToUser(me.id, { type: 'chat', chat });
    return sendJson(res, 200, { chat });
  }

  if (pathname === '/api/join' && method === 'POST') {
    const body = await readJsonBody(req);
    const raw = String(body.link || body.username || '').trim();
    if (!raw) return sendJson(res, 400, { error: 'Нужна ссылка или имя' });

    const candidate = raw.replace(/^.*\//, '').replace(/^@/, '');
    let chatRow = store.findChatByInvite(candidate) || store.findChatByUsername(candidate);

    if (!chatRow) return sendJson(res, 404, { error: 'Группа или канал не найдены' });
    if (chatRow.kind === 'direct') return sendJson(res, 400, { error: 'Это личный чат' });

    if (!store.isMember(chatRow.id, me.id)) {
      store.addChatMember(chatRow.id, me.id);
      sendToChatMembers(chatRow.id, { type: 'chats-changed' }, me.id);
    }

    if (chatRow.kind === 'channel' && chatRow.discussion_chat_id) {
      const discussionId = chatRow.discussion_chat_id;
      if (!store.isMember(discussionId, me.id)) {
        store.addChatMember(discussionId, me.id);
        const discussionChat = store.chatForUser(discussionId, me.id);
        if (discussionChat) sendToUser(me.id, { type: 'chat', chat: discussionChat });
      }
    }

    const chat = store.chatForUser(chatRow.id, me.id);
    sendToUser(me.id, { type: 'chat', chat });
    return sendJson(res, 200, { chat });
  }

  const chatMatch = pathname.match(/^\/api\/chats\/(\d+)(?:\/(avatar|messages|read|members|invite|leave|pin|archive)(?:\/(\d+))?(?:\/(reactions|forward|poll))?)?$/);
  if (chatMatch) {
    const chatId = Number(chatMatch[1]);
    const action = chatMatch[2] || '';
    const messageId = chatMatch[3] ? Number(chatMatch[3]) : null;
    const reactionRoute = chatMatch[4] || '';
    const chat = store.chatForUser(chatId, me.id);

    if (!chat) return sendJson(res, 403, { error: 'Нет доступа к чату' });

    const canManage = chat.canManage;
    const isOwner = chat.myRole === 'owner';

    if (!action && method === 'GET') {
      return sendJson(res, 200, { chat });
    }

    if (!action && method === 'PATCH') {
      if (chat.kind === 'direct') return sendJson(res, 400, { error: 'У личного чата нет настроек' });
      if (!canManage) return sendJson(res, 403, { error: 'Менять настройки могут администраторы' });

      const body = await readJsonBody(req);
      const title = String(body.title ?? chat.title).trim().slice(0, 80);
      if (title.length < 2) return sendJson(res, 400, { error: 'Название: минимум 2 символа' });

      const usernameRaw = String(body.username ?? chat.username ?? '').trim().replace(/^@/, '');
      if (usernameRaw && !/^[a-zA-Z0-9_]{4,32}$/.test(usernameRaw)) {
        return sendJson(res, 400, { error: 'Ссылка: 4–32 символа, латиница, цифры и _' });
      }
      if (usernameRaw) {
        const taken = store.findChatByUsername(usernameRaw);
        if (taken && taken.id !== chatId) return sendJson(res, 409, { error: 'Такая ссылка уже занята' });
      }

      if (body.pinnedMessageId !== undefined) {
        const pinnedId = body.pinnedMessageId === null ? null : Number(body.pinnedMessageId);
        if (pinnedId !== null && !store.getMessage(chatId, pinnedId)) {
          return sendJson(res, 404, { error: 'Сообщение не найдено' });
        }
        store.setPinned(chatId, pinnedId);
      }

      store.updateChatMeta(chatId, {
        title,
        description: String(body.description ?? chat.description ?? '').trim().slice(0, 255),
        username: usernameRaw || null,
        historyForNew: body.historyForNew === undefined ? chat.historyForNew : Boolean(body.historyForNew)
      });

      const fresh = store.chatForUser(chatId, me.id);
      sendToChatMembers(chatId, { type: 'chats-changed' }, me.id);
      return sendJson(res, 200, { chat: fresh });
    }

    if (action === 'pin' && method === 'POST') {
      const b = await readJsonBody(req);
      store.setChatPin(chatId, me.id, Boolean(b.pinned));
      return sendJson(res, 200, { chat: store.chatForUser(chatId, me.id) });
    }

    if (action === 'archive' && method === 'POST') {
      const b = await readJsonBody(req);
      store.setChatArchive(chatId, me.id, Boolean(b.archived));
      return sendJson(res, 200, { chat: store.chatForUser(chatId, me.id) });
    }

    if (action === 'discussion' && method === 'POST') {
      if (chat.kind !== 'channel') return sendJson(res, 400, { error: 'Обсуждение привязывается только к каналу' });
      if (!canManage) return sendJson(res, 403, { error: 'Менять настройки могут администраторы' });

      const b = await readJsonBody(req);
      const groupId = b.groupId === null || b.groupId === undefined ? null : Number(b.groupId);

      if (groupId !== null) {
        const occupiedBy = store.discussionGroupTaken(groupId, chatId);
        if (occupiedBy) {
          return sendJson(res, 400, { error: 'Эта группа уже привязана к другому каналу как обсуждение' });
        }
        const target = store.chatForUser(groupId, me.id);
        if (!target || target.kind !== 'group') {
          return sendJson(res, 404, { error: 'Группа не найдена' });
        }
        if (!store.isMember(groupId, me.id)) {
          return sendJson(res, 403, { error: 'Вы не участник этой группы' });
        }
        store.setChatDiscussion(chatId, groupId);
      } else {
        store.setChatDiscussion(chatId, null);
      }

      const fresh = store.chatForUser(chatId, me.id);
      sendToChatMembers(chatId, { type: 'chats-changed' }, me.id);
      if (groupId) {
        const groupChat = store.chatForUser(groupId, me.id);
        if (groupChat) sendToUser(me.id, { type: 'chat', chat: groupChat });
      }
      return sendJson(res, 200, { chat: fresh });
    }

    if (!action && method === 'DELETE') {
      if (!isOwner) return sendJson(res, 403, { error: 'Удалить чат может только владелец' });

      for (const memberId of store.chatMemberIds(chatId)) {
        sendToUser(memberId, { type: 'chat-removed', chatId });
      }
      store.deleteChat(chatId);
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'avatar' && method === 'POST') {
      if (chat.kind === 'direct') return sendJson(res, 400, { error: 'У личного чата нет аватара' });
      if (!canManage) return sendJson(res, 403, { error: 'Менять аватар могут администраторы' });

      const body = await readJsonBody(req);
      let value = String(body.avatar || '').trim();
      if (!value) return sendJson(res, 400, { error: 'Пустой аватар' });
      if (!/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(value) || value.length > 300000) {
        return sendJson(res, 400, { error: 'Фото: PNG, JPEG или WEBP до 300 КБ' });
      }

      store.setChatAvatar(chatId, value);
      sendToChatMembers(chatId, { type: 'chats-changed' });
      return sendJson(res, 200, { chat: store.chatForUser(chatId, me.id) });
    }

    if (action === 'messages' && method === 'GET') {
      const before = Number(url.searchParams.get('before') || 0);
      const messages = store.listMessages(chatId, before, 50, chat.minMessageId || 0);

      if (chat.kind === 'channel' && messages.length) {
        store.registerViews(me.id, messages.filter(message => message.senderId !== me.id).map(message => message.id));
        const counts = store.viewsFor(messages.map(message => message.id));
        for (const message of messages) message.views = counts.get(message.id) || 0;
        const commentCount = store.discussionMessageCount(chat.discussionId);
        for (const message of messages) message.commentCount = commentCount;
        for (const message of messages) {
          if (!message.pollOptions || !message.pollOptions.length) continue;
          const res = store.pollResults(message.id, me.id);
          message.pollCounts = Object.entries(res.counts).map(([option_index, n]) => ({ option_index: Number(option_index), n }));
          message.pollTotal = res.total;
          message.pollMine = res.mine;
        }
      }

      withReactions(messages, me.id);
      return sendJson(res, 200, { messages });
    }

    if (action === 'messages' && method === 'PATCH' && messageId) {
      const message = store.getMessage(chatId, messageId);
      if (!message) return sendJson(res, 404, { error: 'Сообщение не найдено' });
      if (message.sender_id !== me.id) return sendJson(res, 403, { error: 'Можно редактировать только свои сообщения' });

      const body = await readJsonBody(req);
      const text = String(body.body || '').trim();
      if (!text) return sendJson(res, 400, { error: 'Пустое сообщение' });
      if (text.length > MAX_BODY_CHARS) {
        return sendJson(res, 400, { error: `Максимум ${MAX_BODY_CHARS} символов` });
      }

      const updated = store.updateMessageBody(chatId, messageId, text);
      if (!updated) return sendJson(res, 404, { error: 'Сообщение не найдено' });
      updated.edited = true;
      sendToChatMembers(chatId, { type: 'message', chatId, message: updated }, me.id);
      return sendJson(res, 200, { message: updated });
    }

    if (action === 'messages' && method === 'DELETE' && messageId) {
      const message = store.getMessage(chatId, messageId);
      if (!message) return sendJson(res, 404, { error: 'Сообщение не найдено' });

      const canDelete = message.sender_id === me.id
        || chat.canManage
        || (chat.kind === 'group' && canManage);
      if (!canDelete) return sendJson(res, 403, { error: 'Нет прав на удаление' });

      store.deleteMessage(chatId, messageId);
      sendToChatMembers(chatId, { type: 'message-deleted', chatId, messageId });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'messages' && messageId && reactionRoute === 'forward') {
      if (method === 'POST') {
        const source = store.getMessage(chatId, messageId);
        if (!source) return sendJson(res, 404, { error: 'Сообщение не найдено' });

        const targetId = Number((await readJsonBody(req)).chatId);
        if (!Number.isFinite(targetId) || !store.isMember(targetId, me.id)) {
          return sendJson(res, 403, { error: 'Нет доступа к чату' });
        }

        const targetChat = store.chatForUser(targetId, me.id);
        if (targetChat.kind === 'channel' && !targetChat.canManage) {
          return sendJson(res, 403, { error: 'В канал ведут только администраторы' });
        }

        const message = store.forwardMessage(targetId, me.id, messageId);
        message.reactions = {};
        message.myReaction = null;
        sendToChatMembers(targetId, { type: 'message', chatId: targetId, message });
        sendToUser(me.id, { type: 'chat', chat: targetChat });
        return sendJson(res, 201, { message });
      }
    }

    if (action === 'messages' && messageId && reactionRoute === 'reactions') {
      if (method === 'POST') {
        const body = await readJsonBody(req);
        const emoji = String(body.emoji || '').trim();
        if (!emoji || emoji.length > 8 || !REACTION_RE.test(emoji)) {
          return sendJson(res, 400, { error: 'Некорректная реакция' });
        }

        store.setReaction(messageId, me.id, emoji);
        sendReactionEvent(chatId, messageId, me.id);
        return sendJson(res, 200, { ok: true });
      }

      if (method === 'DELETE') {
        store.clearReaction(messageId, me.id);
        sendReactionEvent(chatId, messageId, me.id);
        return sendJson(res, 200, { ok: true });
      }
    }

    if (action === 'messages' && messageId && reactionRoute === 'poll') {
      const message = store.getMessage(chatId, messageId);
      if (!message) return sendJson(res, 404, { error: 'Сообщение не найдено' });

      if (method === 'GET') {
        return sendJson(res, 200, { poll: pollPayload(message, me.id) });
      }

      if (method === 'POST') {
        if (message.pollQuestion == null) return sendJson(res, 400, { error: 'Это не опрос' });
        const body = await readJsonBody(req);
        const optionIndex = Number(body.optionIndex);
        const options = message.pollOptions || [];
        if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
          return sendJson(res, 400, { error: 'Некорректный вариант ответа' });
        }
        store.castPollVote(messageId, me.id, optionIndex);
        sendPollEvent(chatId, messageId, me.id);
        return sendJson(res, 200, { poll: pollPayload(message, me.id) });
      }

      if (method === 'DELETE') {
        store.clearPollVote(messageId, me.id);
        sendPollEvent(chatId, messageId, me.id);
        return sendJson(res, 200, { poll: pollPayload(message, me.id) });
      }
    }

    if (action === 'messages' && method === 'POST') {
      if (chat.kind === 'channel' && !canManage) {
        return sendJson(res, 403, { error: 'В канале писать могут только администраторы' });
      }

      if (chat.kind === 'direct' && chat.peer) {
        if (store.isBlocked(chat.peer.id, me.id) || store.isBlocked(me.id, chat.peer.id)) {
          return sendJson(res, 403, { error: 'Вы не можете писать этому пользователю' });
        }
      }

      const body = await readJsonBody(req);
      const text = String(body.body || '').trim();
      const kind = String(body.kind || 'text');
      const attachment = body.attachment || null;

      if (text.length > MAX_BODY_CHARS) {
        return sendJson(res, 400, { error: `Максимум ${MAX_BODY_CHARS} символов` });
      }
      if (kind !== 'text' && (!attachment || typeof attachment !== 'string' || attachment.length > 900000)) {
        return sendJson(res, 400, { error: 'Вложение не валидно' });
      }

      const pollQuestion = body.pollQuestion ? String(body.pollQuestion).trim().slice(0, 200) : null;
      const pollOptions = Array.isArray(body.pollOptions)
        ? body.pollOptions.map(String).map(option => option.trim().slice(0, 80)).filter(Boolean).slice(0, 10)
        : null;
      if (pollQuestion && (!pollOptions || pollOptions.length < 2)) {
        return sendJson(res, 400, { error: 'У опроса должно быть минимум 2 варианта' });
      }

      if (kind === 'text' && !text && !pollQuestion) return sendJson(res, 400, { error: 'Пустое сообщение' });

      const payload = {
        body: text,
        kind,
        attachment,
        duration: Math.min(Number(body.duration) || 0, 5 * 60),
        forwardedFrom: body.forwardedFrom ? Number(body.forwardedFrom) : null,
        fileName: body.fileName ? String(body.fileName).slice(0, 120) : null,
        fileSize: body.fileSize ? Number(body.fileSize) : null,
        caption: body.caption ? String(body.caption).slice(0, 4000) : null,
        mediaGroupId: body.mediaGroupId ? String(body.mediaGroupId).slice(0, 40) : null,
        replyToId: null,
        pollQuestion,
        pollOptions,
        pollAnonymous: body.pollAnonymous === undefined ? true : Boolean(body.pollAnonymous)
      };

      if (body.replyToId !== undefined && body.replyToId !== null) {
        const replyId = Number(body.replyToId);
        const replyTarget = store.getMessage(chatId, replyId);
        if (!replyTarget) return sendJson(res, 404, { error: 'Сообщение, на которое отвечаете, не найдено' });
        payload.replyToId = replyId;
      }

      const message = store.insertMessage(chatId, me.id, payload);
      message.reactions = {};
      message.myReaction = null;
      sendToChatMembers(chatId, { type: 'message', chatId, message });

      return sendJson(res, 201, { message });
    }

    if (action === 'read' && method === 'POST') {
      const body = await readJsonBody(req);
      const messageId = Number(body.messageId || 0);
      const applied = store.markRead(chatId, me.id, messageId);
      notifyRead(chatId, me.id, applied);
      return sendJson(res, 200, { lastReadId: applied });
    }

    if (action === 'members' && method === 'GET') {
      return sendJson(res, 200, { members: store.chatMembers(chatId) });
    }

    if (action === 'members' && method === 'POST') {
      if (!isOwner) return sendJson(res, 403, { error: 'Менять роли может владелец' });

      const body = await readJsonBody(req);
      const userId = Number(body.userId);
      const role = String(body.role || '');

      if (!['admin', 'member'].includes(role)) return sendJson(res, 400, { error: 'Неизвестная роль' });
      if (!store.isMember(chatId, userId)) return sendJson(res, 404, { error: 'Участник не найден' });
      if (userId === me.id) return sendJson(res, 400, { error: 'Свою роль менять нельзя' });

      store.setMemberRole(chatId, userId, role);
      return sendJson(res, 200, { members: store.chatMembers(chatId) });
    }

    if (action === 'members' && method === 'DELETE') {
      const body = await readJsonBody(req);
      const userId = Number(body.userId);
      if (!Number.isFinite(userId)) return sendJson(res, 400, { error: 'Не указан участник' });

      const targetRole = store.memberRole(chatId, userId);
      if (!targetRole) return sendJson(res, 404, { error: 'Участник не найден' });
      if (targetRole === 'owner') return sendJson(res, 403, { error: 'Владельца удалить нельзя' });

      if (userId === me.id) {
        store.removeChatMember(chatId, userId);
        sendToUser(userId, { type: 'chat-removed', chatId });
        return sendJson(res, 200, { left: true });
      }

      if (!canManage) return sendJson(res, 403, { error: 'Удалять участников могут администраторы' });
      if (targetRole === 'admin' && !isOwner) {
        return sendJson(res, 403, { error: 'Администратора может удалить только владелец' });
      }

      store.removeChatMember(chatId, userId);
      sendToUser(userId, { type: 'chat-removed', chatId });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'leave' && method === 'POST') {
      if (isOwner) {
        return sendJson(res, 400, { error: 'Владелец должен удалить чат или передать права' });
      }
      store.removeChatMember(chatId, me.id);
      sendToUser(me.id, { type: 'chat-removed', chatId });
      return sendJson(res, 200, { ok: true });
    }

    if (action === 'invite' && method === 'POST') {
      if (!canManage) return sendJson(res, 403, { error: 'Ссылку меняют администраторы' });
      const token = makeInviteToken();
      store.rotateInvite(chatId, token);
      return sendJson(res, 200, { inviteToken: token });
    }
  }
  return sendJson(res, 404, { error: 'Не найдено' });
}

function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relative);

  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 403, { error: 'Запрещено' });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      return sendJson(res, 404, { error: 'Файл не найден' });
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { error: 'Некорректный запрос' });
  }

  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Метод не поддерживается' });
    }
    return serveStatic(req, res, url);
  }

  handleApi(req, res, url).catch(err => {
    const status = err && err.status ? err.status : 500;
    if (status === 500) console.error(err);
    sendJson(res, status, { error: err && err.message ? err.message : 'Внутренняя ошибка' });
  });
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    socket.destroy();
    return;
  }
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const user = currentUser(req);
  if (!user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    ws.userId = user.id;
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', ws => {
  const user = store.getUserById(ws.userId);
  if (!user) {
    ws.close();
    return;
  }

  addConnection(user, ws);
  sendWs(ws, {
    type: 'hello',
    user: publicUser(user, { self: true }),
    onlineUsers: [...online.keys()].filter(id => {
      if (id === user.id) return false;
      const row = store.getUserById(id);
      return !(row && row.hide_online);
    })
  });

  ws.rate = { windowStart: Date.now(), count: 0 };

  ws.on('message', raw => {
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!event || typeof event.type !== 'string') return;

    const now = Date.now();
    if (now - ws.rate.windowStart > WS_RATE_WINDOW_MS) {
      ws.rate = { windowStart: now, count: 0 };
    }
    ws.rate.count += 1;
    if (ws.rate.count > WS_RATE_MAX) {
      sendWs(ws, { type: 'error', message: 'Слишком много сообщений подряд' });
      return;
    }

    if (event.type === 'send') {
      const chatId = Number(event.chatId);
      const text = String(event.body || '').trim();
      if (!Number.isFinite(chatId) || !store.isMember(chatId, user.id)) return;

      const chat = store.chatForUser(chatId, user.id);
      if (!chat) return;
      if (chat.kind === 'channel' && !chat.canManage) return;
      if (text.length > MAX_BODY_CHARS) return;

      const payload = { body: text, kind: 'text' };
      if (event.replyToId !== undefined && event.replyToId !== null) {
        const replyId = Number(event.replyToId);
        if (Number.isFinite(replyId) && store.getMessage(chatId, replyId)) payload.replyToId = replyId;
      }

      const message = store.insertMessage(chatId, user.id, payload);
      message.reactions = {};
      message.myReaction = null;
      sendToChatMembers(chatId, { type: 'message', chatId, message });

      return;
    }

    if (event.type === 'typing') {
      const chatId = Number(event.chatId);
      if (!Number.isFinite(chatId) || !store.isMember(chatId, user.id)) return;
      sendToChatMembers(chatId, {
        type: 'typing',
        chatId,
        userId: user.id,
        displayName: user.display_name
      }, user.id);
      return;
    }

    if (event.type === 'read') {
      const chatId = Number(event.chatId);
      const messageId = Number(event.messageId || 0);
      if (!Number.isFinite(chatId) || !store.isMember(chatId, user.id)) return;
      const applied = store.markRead(chatId, user.id, messageId);
      notifyRead(chatId, user.id, applied);
    }
  });

  ws.on('close', () => removeConnection(user, ws));
  ws.on('error', () => removeConnection(user, ws));
});

setInterval(() => store.purgeSessions(), 60 * 60 * 1000).unref();

function seedMarketLots() {
  const active = store.listActiveLots();
  const existingIds = new Set(active.filter(l => l.kind === 'number').map(l => l.item_id));
  const catalog = [
    { itemId: 'num-888-111', name: '+888 111 11 11', price: 500 },
    { itemId: 'num-888-777', name: '+888 777 77 77', price: 1200 }
  ];
  const pending = catalog.filter(c => !existingIds.has(c.itemId));
  if (!pending.length) return;

  const users = store.listUsers();
  const seller = users.find(u => u.is_admin) || users[0];
  if (!seller) return;

  for (const c of pending) {
    store.createLot({
      sellerId: seller.id,
      kind: 'number',
      itemId: c.itemId,
      itemName: c.name,
      itemData: { kind: 'collectible' },
      price: c.price
    });
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Мессенджер запущен: http://localhost:${PORT}`);
  seedMarketLots();
  if (HOST === '0.0.0.0') {
    const nets = require('node:os').networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`В локальной сети: http://${net.address}:${PORT}`);
        }
      }
    }
  }
});
