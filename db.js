'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'messenger.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    pass_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL DEFAULT 'direct',
    title TEXT,
    created_at INTEGER NOT NULL
  );

CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS blocks (
    blocker INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (blocker, blocked)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

CREATE TABLE IF NOT EXISTS message_views (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS message_reactions (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id)
  );

CREATE TABLE IF NOT EXISTS poll_votes (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    option_index INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id)
  );

CREATE TABLE IF NOT EXISTS coin_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
    to_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    note TEXT,
    kind TEXT NOT NULL DEFAULT 'transfer',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_codes (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS market_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    item_data TEXT,
    price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sold_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON chat_members (user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
`);

function ensureColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
  if (!columns.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

ensureColumn('users', 'public_key', 'TEXT');
ensureColumn('users', 'bio', 'TEXT');
ensureColumn('users', 'hide_online', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'hide_last_seen', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'avatar', 'TEXT');
ensureColumn('users', 'phone', 'TEXT');
ensureColumn('users', 'balance', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'wallet_no', 'TEXT');
ensureColumn('users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');

const hasAdmin = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get();
if (!hasAdmin || hasAdmin.n === 0) {
  const owner = db.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').get();
  if (owner) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(owner.id);
}
ensureColumn('users', 'verified', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'balance_updated_at', 'INTEGER');
ensureColumn('users', 'phone_collectible', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'username_set', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'phone_price', 'TEXT');
ensureColumn('users', 'major_verified', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'phone_bought_at', 'INTEGER');
ensureColumn('users', 'purchase_count', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('users', 'status_emoji', 'TEXT');
ensureColumn('sessions', 'ua', 'TEXT');
ensureColumn('sessions', 'ip', 'TEXT');

ensureColumn('chats', 'description', 'TEXT');
ensureColumn('chats', 'username', 'TEXT');
ensureColumn('chats', 'invite_token', 'TEXT');
ensureColumn('chats', 'history_for_new', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('chats', 'created_by', 'INTEGER');
ensureColumn('chats', 'avatar', 'TEXT');
ensureColumn('chats', 'verified', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('chats', 'discussion_chat_id', 'INTEGER');

ensureColumn('chat_members', 'role', "TEXT NOT NULL DEFAULT 'member'");
ensureColumn('chats', 'pinned_message_id', 'INTEGER');
ensureColumn('messages', 'edited', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('messages', 'reply_to_id', 'INTEGER');
ensureColumn('chat_members', 'join_message_id', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('chat_members', 'is_pinned', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('chat_members', 'is_archived', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('messages', 'kind', "TEXT NOT NULL DEFAULT 'text'");
ensureColumn('messages', 'attachment', 'TEXT');
ensureColumn('messages', 'file_name', 'TEXT');
ensureColumn('messages', 'file_size', 'INTEGER');
ensureColumn('messages', 'caption', 'TEXT');
ensureColumn('messages', 'duration', 'INTEGER');
ensureColumn('messages', 'forwarded_from', 'INTEGER');
ensureColumn('messages', 'media_group_id', 'TEXT');
ensureColumn('messages', 'poll_question', 'TEXT');
ensureColumn('messages', 'poll_options', 'TEXT');
ensureColumn('messages', 'poll_anonymous', 'INTEGER NOT NULL DEFAULT 1');

const q = {
  insertUser: db.prepare(`
    INSERT INTO users (username, display_name, pass_hash, pass_salt, created_at, last_seen)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByUsername: db.prepare('SELECT * FROM users WHERE username = ?'),
  userByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
  allUsers: db.prepare('SELECT * FROM users ORDER BY display_name COLLATE NOCASE'),

  insertUserWithPhone: db.prepare(`
    INSERT INTO users (username, display_name, pass_hash, pass_salt, phone, phone_collectible, created_at, last_seen)
    VALUES (?, ?, '', '', ?, ?, ?, ?)
  `),
  authUpsert: db.prepare(`
    INSERT INTO auth_codes (phone, code, created_at, attempts)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(phone) DO UPDATE SET code = excluded.code, created_at = excluded.created_at, attempts = 0
  `),
  authByPhone: db.prepare('SELECT * FROM auth_codes WHERE phone = ?'),
  authBumpAttempts: db.prepare('UPDATE auth_codes SET attempts = attempts + 1 WHERE phone = ?'),
  authResetAttempts: db.prepare('UPDATE auth_codes SET attempts = 0 WHERE phone = ?'),
  authDelete: db.prepare('DELETE FROM auth_codes WHERE phone = ?'),
  clearPhone: db.prepare('UPDATE users SET phone = NULL WHERE phone = ?'),
  updatePhone: db.prepare('UPDATE users SET phone = ?, phone_collectible = ? WHERE id = ?'),

  insertSession: db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at, ua, ip) VALUES (?, ?, ?, ?, ?, ?)'),
  sessionsOf: db.prepare('SELECT token, created_at, expires_at, ua, ip FROM sessions WHERE user_id = ? ORDER BY created_at DESC'),
deleteUserSession: db.prepare('DELETE FROM sessions WHERE token = ? AND user_id = ?'),
updateProfile: db.prepare('UPDATE users SET display_name = ?, bio = ?, avatar = ?, phone = ? WHERE id = ?'),
  setUsername: db.prepare('UPDATE users SET username = ?, username_set = 1 WHERE id = ?'),
  bumpPurchaseCount: db.prepare('UPDATE users SET purchase_count = purchase_count + 1 WHERE id = ?'),
  purchaseCountOf: db.prepare('SELECT purchase_count FROM users WHERE id = ?'),
  updatePhoneInfo: db.prepare('UPDATE users SET phone = ?, phone_collectible = ?, phone_price = ?, phone_bought_at = ? WHERE id = ?'),
updatePassword: db.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?'),
  setHideOnline: db.prepare('UPDATE users SET hide_online = ? WHERE id = ?'),
  setMajorVerified: db.prepare('UPDATE users SET major_verified = ? WHERE id = ?'),
  setStatusEmoji: db.prepare('UPDATE users SET status_emoji = ? WHERE id = ?'),
  sessionByToken: db.prepare('SELECT * FROM sessions WHERE token = ?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
  purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),

  insertLot: db.prepare(`
    INSERT INTO market_lots (seller_id, kind, item_id, item_name, item_data, price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `),
  lotById: db.prepare('SELECT * FROM market_lots WHERE id = ?'),
  activeLots: db.prepare("SELECT * FROM market_lots WHERE status = 'active' ORDER BY created_at DESC"),
  lotsOfSeller: db.prepare("SELECT * FROM market_lots WHERE seller_id = ? AND status = 'active' ORDER BY created_at DESC"),
  sellLot: db.prepare("UPDATE market_lots SET status = 'sold', buyer_id = ?, sold_at = ? WHERE id = ? AND status = 'active'"),
  cancelLot: db.prepare("DELETE FROM market_lots WHERE id = ? AND seller_id = ? AND status = 'active'"),

  insertChat: db.prepare("INSERT INTO chats (kind, title, created_at) VALUES (?, ?, ?)"),
  insertNamedChat: db.prepare(`
    INSERT INTO chats (kind, title, description, username, invite_token, history_for_new, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  chatByUsername: db.prepare('SELECT * FROM chats WHERE username = ? COLLATE NOCASE'),
  chatByInvite: db.prepare('SELECT * FROM chats WHERE invite_token = ?'),
  chatSavedOf: db.prepare("SELECT id FROM chats WHERE kind = 'saved' AND created_by = ? LIMIT 1"),
  updateChatMeta: db.prepare('UPDATE chats SET title = ?, description = ?, username = ?, history_for_new = ? WHERE id = ?'),
  rotateInvite: db.prepare('UPDATE chats SET invite_token = ? WHERE id = ?'),
  deleteChatRow: db.prepare('DELETE FROM chats WHERE id = ?'),
  memberCount: db.prepare('SELECT COUNT(*) AS n FROM chat_members WHERE chat_id = ?'),
membersOf: db.prepare(`
    SELECT cm.user_id, cm.role, u.username, u.display_name, u.avatar, u.verified
    FROM chat_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.chat_id = ?
    ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.display_name COLLATE NOCASE
  `),
  roleOf: db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?'),
  setRole: db.prepare('UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?'),
  removeMember: db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?'),
  setJoinMarker: db.prepare('UPDATE chat_members SET join_message_id = ? WHERE chat_id = ? AND user_id = ?'),
messagesInChatSince: db.prepare(`
    SELECT m.id, m.chat_id, m.sender_id, m.body, m.kind, m.attachment, m.duration, m.forwarded_from, m.file_name, m.file_size, m.caption, m.edited, m.reply_to_id, m.poll_question, m.poll_options, m.poll_anonymous, m.created_at, u.display_name AS sender_name, u.avatar AS sender_avatar,
           (SELECT cm.role FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = m.sender_id) AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ? AND m.id < ? AND m.id > ?
    ORDER BY m.id DESC
    LIMIT ?
  `),
  unreadSince: db.prepare(`
    SELECT COUNT(*) AS n FROM messages
    WHERE chat_id = ? AND sender_id <> ? AND id > ?
  `),
  insertView: db.prepare('INSERT OR IGNORE INTO message_views (message_id, user_id, viewed_at) VALUES (?, ?, ?)'),
  messageInChat: db.prepare('SELECT id, chat_id, sender_id FROM messages WHERE id = ? AND chat_id = ?'),
  deleteMessageRow: db.prepare('DELETE FROM messages WHERE id = ? AND chat_id = ?'),
  updateMessageBody: db.prepare('UPDATE messages SET body = ?, edited = 1 WHERE id = ? AND chat_id = ?'),
  upsertReaction: db.prepare(`
    INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at
  `),
  removeReaction: db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?'),
  reactionCounts: db.prepare('SELECT emoji, COUNT(*) AS n FROM message_reactions WHERE message_id = ? GROUP BY emoji'),
  myReaction: db.prepare('SELECT emoji FROM message_reactions WHERE message_id = ? AND user_id = ?'),
  setPinned: db.prepare('UPDATE chats SET pinned_message_id = ? WHERE id = ?'),
  setDiscussion: db.prepare('UPDATE chats SET discussion_chat_id = ? WHERE id = ?'),
  getDiscussion: db.prepare('SELECT discussion_chat_id AS id FROM chats WHERE id = ?'),
  discussionOwner: db.prepare('SELECT id FROM chats WHERE discussion_chat_id = ? AND id != ?'),
  clearPinnedIfRef: db.prepare('UPDATE chats SET pinned_message_id = NULL WHERE id = ? AND pinned_message_id = ?'),
getPinned: db.prepare(`
    SELECT m.id, m.chat_id, m.sender_id, m.body, m.kind, m.attachment, m.duration, m.forwarded_from, m.file_name, m.file_size, m.caption, m.edited, m.reply_to_id, m.poll_question, m.poll_options, m.poll_anonymous, m.created_at, u.display_name AS sender_name, u.avatar AS sender_avatar,
           (SELECT cm.role FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = m.sender_id) AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.id = ? AND m.chat_id = ?
  `),
  viewCount: db.prepare('SELECT COUNT(*) AS n FROM message_views WHERE message_id = ?'),
  insertMember: db.prepare('INSERT INTO chat_members (chat_id, user_id, last_read_id) VALUES (?, ?, ?)'),
  chatById: db.prepare('SELECT * FROM chats WHERE id = ?'),
memberChats: db.prepare(`
    SELECT c.id, c.kind, c.title, cm.last_read_id, cm.is_pinned, cm.is_archived
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = ?
  `),
  userGroups: db.prepare(`
    SELECT c.id, c.title
    FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = ?
    WHERE c.kind = 'group'
    ORDER BY c.title COLLATE NOCASE
  `),
  setChatPin: db.prepare('UPDATE chat_members SET is_pinned = ? WHERE chat_id = ? AND user_id = ?'),
  setChatArchive: db.prepare('UPDATE chat_members SET is_archived = ? WHERE chat_id = ? AND user_id = ?'),
  membership: db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?'),
  chatMemberIds: db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?'),
  blockInsert: db.prepare('INSERT OR IGNORE INTO blocks (blocker, blocked, created_at) VALUES (?, ?, ?)'),
  blockDelete: db.prepare('DELETE FROM blocks WHERE blocker = ? AND blocked = ?'),
  isBlocked: db.prepare('SELECT 1 FROM blocks WHERE blocker = ? AND blocked = ?'),
  myBlockedIds: db.prepare('SELECT blocked FROM blocks WHERE blocker = ?'),
  deleteDirectChatBetween: db.prepare(`
    DELETE FROM chats WHERE id IN (
      SELECT c.id FROM chats c
      JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = ?
      JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = ?
      WHERE c.kind = 'direct'
    )
  `),
  directChatBetween: db.prepare(`
    SELECT c.id FROM chats c
    JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = ?
    JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = ?
    WHERE c.kind = 'direct'
    LIMIT 1
  `),
peerOf: db.prepare(`
    SELECT u.id, u.username, u.display_name, u.public_key, u.avatar, u.last_seen, u.verified
    FROM chat_members cm JOIN users u ON u.id = cm.user_id
    WHERE cm.chat_id = ? AND cm.user_id <> ?
    LIMIT 1
  `),
lastMessage: db.prepare(`
    SELECT m.id, m.chat_id, m.sender_id, m.body, m.kind, m.attachment, m.duration, m.forwarded_from, m.file_name, m.file_size, m.caption, m.edited, m.reply_to_id, m.created_at, u.display_name AS sender_name, u.avatar AS sender_avatar,
           (SELECT cm.role FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = m.sender_id) AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ?
    ORDER BY m.id DESC
    LIMIT 1
  `),
  unreadCount: db.prepare(`
    SELECT COUNT(*) AS n FROM messages
    WHERE chat_id = ? AND sender_id <> ? AND id > ?
  `),

  insertMessage: db.prepare('INSERT INTO messages (chat_id, sender_id, body, kind, attachment, duration, forwarded_from, file_name, file_size, caption, reply_to_id, media_group_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  insertMessageWithPoll: db.prepare('INSERT INTO messages (chat_id, sender_id, body, kind, attachment, duration, forwarded_from, file_name, file_size, caption, reply_to_id, poll_question, poll_options, poll_anonymous, media_group_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  pollVote: db.prepare('INSERT INTO poll_votes (message_id, user_id, option_index, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (message_id, user_id) DO UPDATE SET option_index = excluded.option_index, created_at = excluded.created_at'),
  pollVoteOf: db.prepare('SELECT option_index FROM poll_votes WHERE message_id = ? AND user_id = ?'),
  pollCounts: db.prepare('SELECT option_index, COUNT(*) AS n FROM poll_votes WHERE message_id = ? GROUP BY option_index'),
  pollTotal: db.prepare('SELECT COUNT(*) AS n FROM poll_votes WHERE message_id = ?'),
  insertForward: db.prepare(`
    INSERT INTO messages (chat_id, sender_id, body, kind, attachment, duration, forwarded_from, file_name, file_size, caption, media_group_id, created_at)
    SELECT ?, ?, body, kind, attachment, duration, ?, file_name, file_size, caption, NULL, ? FROM messages WHERE id = ?
  `),
  updateChatAvatar: db.prepare('UPDATE chats SET avatar = ? WHERE id = ?'),
messageById: db.prepare(`
    SELECT m.id, m.chat_id, m.sender_id, m.body, m.kind, m.attachment, m.duration, m.forwarded_from, m.file_name, m.file_size, m.caption, m.edited, m.reply_to_id, m.poll_question, m.poll_options, m.poll_anonymous, m.media_group_id, m.created_at, u.display_name AS sender_name, u.avatar AS sender_avatar,
           (SELECT cm.role FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = m.sender_id) AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `),
messagesInChat: db.prepare(`
    SELECT m.id, m.chat_id, m.sender_id, m.body, m.kind, m.attachment, m.duration, m.forwarded_from, m.file_name, m.file_size, m.caption, m.edited, m.reply_to_id, m.poll_question, m.poll_options, m.poll_anonymous, m.media_group_id, m.created_at, u.display_name AS sender_name, u.avatar AS sender_avatar,
           (SELECT cm.role FROM chat_members cm WHERE cm.chat_id = m.chat_id AND cm.user_id = m.sender_id) AS sender_role
    FROM messages m JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ? AND m.id < ?
    ORDER BY m.id DESC
    LIMIT ?
  `),
  lastChatMessage: db.prepare('SELECT MAX(id) AS id FROM messages WHERE chat_id = ?'),
  messagesTotal: db.prepare('SELECT COUNT(*) AS n FROM messages WHERE chat_id = ?'),
markRead: db.prepare('UPDATE chat_members SET last_read_id = ? WHERE chat_id = ? AND user_id = ?'),
  setPublicKey: db.prepare('UPDATE users SET public_key = ? WHERE id = ?'),
  touchUser: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),

  userByWallet: db.prepare('SELECT * FROM users WHERE wallet_no = ?'),
  setWalletNo: db.prepare('UPDATE users SET wallet_no = ? WHERE id = ?'),
  balanceOf: db.prepare('SELECT balance, wallet_no, verified, is_admin FROM users WHERE id = ?'),
  addBalance: db.prepare('UPDATE users SET balance = balance + ?, balance_updated_at = ? WHERE id = ?'),
  setBalance: db.prepare('UPDATE users SET balance = ?, balance_updated_at = ? WHERE id = ?'),
  setUserVerified: db.prepare('UPDATE users SET verified = ? WHERE id = ?'),
  setChatVerified: db.prepare('UPDATE chats SET verified = ? WHERE id = ?'),
  insertCoinTransfer: db.prepare('INSERT INTO coin_transfers (from_user, to_user, amount, note, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  transfersOf: db.prepare('SELECT * FROM coin_transfers WHERE from_user = ? OR to_user = ? ORDER BY created_at DESC LIMIT ?'),
  allTransfers: db.prepare('SELECT * FROM coin_transfers ORDER BY created_at DESC LIMIT ?')
};

function toMessage(row) {
  if (!row) return null;
return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
senderAvatar: row.sender_avatar || null,
    senderRole: row.sender_role || null,
    edited: Boolean(row.edited),
    replyToId: row.reply_to_id || null,
    body: row.body || '',
    kind: row.kind || 'text',
    attachment: row.attachment || null,
    duration: row.duration || 0,
    forwardedFrom: row.forwarded_from || null,
    fileName: row.file_name || null,
    fileSize: row.file_size || null,
    caption: row.caption || null,
    mediaGroupId: row.media_group_id || null,
    pollQuestion: row.poll_question || null,
    pollOptions: row.poll_options ? JSON.parse(row.poll_options) : null,
    pollAnonymous: Boolean(row.poll_anonymous),
    createdAt: row.created_at
  };
}

function createUser({ username, displayName, salt, hash }) {
  const ts = Date.now();
  const isFirst = q.allUsers.all().length === 0;
  const info = q.insertUser.run(username, displayName, hash, salt, ts, ts);
  if (isFirst) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(info.lastInsertRowid);
  }
  return q.userById.get(info.lastInsertRowid);
}

function getUserByUsername(username) {
  return q.userByUsername.get(username) || null;
}

function getUserByPhone(phone) {
  return q.userByPhone.get(phone) || null;
}

function createUser({ username, displayName, salt, hash, phone = null, collectible = false }) {
  const ts = Date.now();
  const isFirst = q.allUsers.all().length === 0;
  let info;
  if (phone) {
    info = q.insertUserWithPhone.run(username, displayName, phone, collectible ? 1 : 0, ts, ts);
  } else {
    info = q.insertUser.run(username, displayName, hash, salt, ts, ts);
  }
  if (isFirst) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(info.lastInsertRowid);
  }
  return q.userById.get(info.lastInsertRowid);
}

function makeAuthCode(phone, code) {
  q.authUpsert.run(phone, code, Date.now());
}

function getAuthCode(phone) {
  return q.authByPhone.get(phone) || null;
}

function bumpAuthAttempts(phone) {
  q.authBumpAttempts.run(phone);
}

function resetAuthAttempts(phone) {
  q.authResetAttempts.run(phone);
}

function clearAuthCode(phone) {
  q.authDelete.run(phone);
}

function clearPhoneFromUser(phone) {
  q.clearPhone.run(phone);
}

function bindPhoneToUser(userId, phone, collectible) {
  q.updatePhone.run(phone, collectible ? 1 : 0, userId);
}

function getUserById(id) {
  return q.userById.get(id) || null;
}

function listUsers() {
  return q.allUsers.all();
}

function messageCountWith(userId, peerId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n FROM messages m
    WHERE m.chat_id IN (
      SELECT c.id FROM chats c
      JOIN chat_members a ON a.chat_id = c.id AND a.user_id = ?
      JOIN chat_members b ON b.chat_id = c.id AND b.user_id = ?
      WHERE c.kind = 'direct'
    )
  `).get(userId, peerId);
  return (row && row.n) || 0;
}

function createSession(userId, expiresAt, meta = {}) {
  const token = require('node:crypto').randomBytes(32).toString('hex');
  q.insertSession.run(token, userId, Date.now(), expiresAt, meta.ua || null, meta.ip || null);
  return token;
}

function listSessions(userId) {
  return q.sessionsOf.all(userId);
}

function deleteUserSession(userId, token) {
  q.deleteUserSession.run(token, userId);
}

function updateProfile(userId, displayName, bio, avatar, phone) {
  q.updateProfile.run(displayName, bio, avatar, phone, userId);
}

function setUsername(userId, username) {
  q.setUsername.run(username, userId);
}

function updatePhoneInfo(userId, { phone, collectible = false, price = null, boughtAt = null } = {}) {
  q.updatePhoneInfo.run(phone || null, collectible ? 1 : 0, price || null, boughtAt || null, userId);
}

function updatePassword(userId, salt, hash) {
  q.updatePassword.run(hash, salt, userId);
}

function setHideOnline(userId, hide) {
  q.setHideOnline.run(hide ? 1 : 0, userId);
}

function setHideLastSeen(userId, hide) {
  db.prepare('UPDATE users SET hide_last_seen = ? WHERE id = ?').run(hide ? 1 : 0, userId);
}

function getSession(token) {
  const session = q.sessionByToken.get(token);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    q.deleteSession.run(token);
    return null;
  }
  return session;
}

function deleteSession(token) {
  q.deleteSession.run(token);
}

function purgeSessions() {
  q.purgeSessions.run(Date.now());
}

function deleteAccount(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!u) return false;
  // Анонимизация вместо жёсткого удаления: ник -> «Удаленный Аккаунт», юзернейм убираем.
  // Запись юзера сохраняется, чтобы его старые сообщения отображались как «Удаленный Аккаунт».
  db.prepare('UPDATE users SET display_name = ?, username = NULL, username_set = 0, pass_hash = ?, pass_salt = ?, bio = ?, avatar = NULL, public_key = NULL, phone = NULL, phone_collectible = 0, phone_price = NULL, is_admin = 0, verified = 0, hide_online = 0, hide_last_seen = 0 WHERE id = ?')
    .run('Удаленный Аккаунт', 'x', 'x', '', userId);
  updatePhoneInfo(userId, { phone: null });
  db.prepare('DELETE FROM coin_transfers WHERE from_user = ?').run(userId);
  db.prepare('DELETE FROM coin_transfers WHERE to_user = ?').run(userId);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM message_views WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM message_reactions WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM poll_votes WHERE user_id = ?').run(userId);
  // Убрать этот аккаунт из приватных членств (лс), но оставить в остальных чатах/каналах как «Удаленный Аккаунт»?
  // Приватные диалоги удаляем, чтобы не висли пустые ЛС.
  db.prepare('DELETE FROM chat_members WHERE user_id = ? AND chat_id IN (SELECT id FROM chats WHERE kind = ?)').run(userId, 'direct');
  db.exec('DELETE FROM chats WHERE id NOT IN (SELECT chat_id FROM chat_members)');
  const admins = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').get().n;
  if (admins === 0) {
    const next = db.prepare('SELECT id FROM users WHERE id <> ? ORDER BY id ASC LIMIT 1').get(userId);
    if (next) db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(next.id);
  }
  return true;
}

function isMember(chatId, userId) {
  return Boolean(q.membership.get(chatId, userId));
}

function chatMemberIds(chatId) {
  return q.chatMemberIds.all(chatId).map(row => row.user_id);
}

function blockUser(blocker, blocked) {
  q.blockInsert.run(blocker, blocked, Date.now());
  q.deleteDirectChatBetween.run(blocker, blocked);
}

function unblockUser(blocker, blocked) {
  q.blockDelete.run(blocker, blocked);
}

function isBlocked(blocker, blocked) {
  return Boolean(q.isBlocked.get(blocker, blocked));
}

function myBlockedIds(userId) {
  return q.myBlockedIds.all(userId).map(row => row.blocked);
}

function listUserGroups(userId) {
  return q.userGroups.all(userId);
}

function createDirectChat(userA, userB) {
  const existing = q.directChatBetween.get(userA, userB);
  if (existing) return existing.id;

  const ts = Date.now();
  const info = q.insertChat.run('direct', null, ts);
  const chatId = info.lastInsertRowid;
  q.insertMember.run(chatId, userA, 0);
  q.insertMember.run(chatId, userB, 0);
  return chatId;
}

function chatForUser(chatId, userId) {
  const chat = q.chatById.get(chatId);
  if (!chat) return null;

  const mine = q.membership.get(chatId, userId);
  if (!mine) return null;

  const peer = q.peerOf.get(chatId, userId);
  const peerMembership = peer ? q.membership.get(chatId, peer.id) : null;
  const restrictedHistory = chat.kind !== 'direct' && !chat.history_for_new && mine.join_message_id > 0;
  const minId = restrictedHistory ? mine.join_message_id : 0;
  const myRole = mine.role || 'member';
  const canManage = myRole === 'owner' || myRole === 'admin';

  return {
id: chat.id,
    kind: chat.kind,
title: chat.title,
    avatar: chat.avatar || null,
    description: chat.description || '',
    username: chat.username || null,
    verified: Boolean(chat.verified),
    historyForNew: Boolean(chat.history_for_new),
    createdBy: chat.created_by || null,
    isPinned: Boolean(mine.is_pinned),
    isArchived: Boolean(mine.is_archived),
    pinnedMessageId: chat.pinned_message_id || null,
    pinnedMessage: toMessage(q.getPinned.get(chat.pinned_message_id || 0, chatId)) || null,
    discussionId: chat.discussion_chat_id || null,
    peer: peer
      ? {
        id: peer.id,
        username: peer.username,
        displayName: peer.display_name,
        publicKey: peer.public_key || null,
        avatar: peer.avatar || null,
        lastSeen: peer.last_seen || null,
        verified: Boolean(peer.verified)
      }
      : null,
    lastMessage: toMessage(q.lastMessage.get(chatId)),
    unread: q.unreadSince.get(chatId, userId, Math.max(mine.last_read_id, minId)).n,
    lastReadId: mine.last_read_id,
    peerLastReadId: peerMembership ? peerMembership.last_read_id : 0,
    memberCount: chat.kind === 'direct' ? 2 : q.memberCount.get(chatId).n,
    myRole,
    canManage,
    inviteToken: canManage ? chat.invite_token : null,
    minMessageId: minId
  };
}

function createNamedChat({ kind, title, description, username, inviteToken, historyForNew, createdBy }) {
  const info = q.insertNamedChat.run(
    kind,
    title,
    description || null,
    username || null,
    inviteToken || null,
    historyForNew ? 1 : 0,
    createdBy,
    Date.now()
  );

  const chatId = info.lastInsertRowid;
  q.insertMember.run(chatId, createdBy, 0);
  q.setRole.run('owner', chatId, createdBy);

  return chatId;
}

function addChatMember(chatId, userId, role = 'member') {
  q.insertMember.run(chatId, userId, 0);
  q.setRole.run(role, chatId, userId);

  const last = q.lastChatMessage.get(chatId);
  q.setJoinMarker.run(last && last.id ? last.id : 0, chatId, userId);
  return q.membership.get(chatId, userId);
}

function membershipOf(chatId, userId) {
  return q.membership.get(chatId, userId) || null;
}

function memberRole(chatId, userId) {
  const row = q.roleOf.get(chatId, userId);
  return row ? row.role : null;
}

function setMemberRole(chatId, userId, role) {
  q.setRole.run(role, chatId, userId);
}

function removeChatMember(chatId, userId) {
  q.removeMember.run(chatId, userId);
}

function chatMembers(chatId) {
  return q.membersOf.all(chatId).map(row => ({
    id: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar || null,
    role: row.role,
    verified: Boolean(row.verified)
  }));
}

function findChatByUsername(username) {
  return q.chatByUsername.get(username) || null;
}

function findChatByInvite(token) {
  return q.chatByInvite.get(token) || null;
}

function updateChatMeta(chatId, { title, description, username, historyForNew }) {
  q.updateChatMeta.run(title, description, username, historyForNew ? 1 : 0, chatId);
}

function rotateInvite(chatId, token) {
  q.rotateInvite.run(token, chatId);
}

function deleteChat(chatId) {
  q.deleteChatRow.run(chatId);
}

function memberCount(chatId) {
  return q.memberCount.get(chatId).n;
}

function getSavedChat(userId) {
  const existing = q.chatSavedOf.get(userId);
  if (existing) return existing.id;

  const info = q.insertNamedChat.run('saved', 'Избранное', null, null, null, 1, userId, Date.now());
  const chatId = info.lastInsertRowid;
  q.insertMember.run(chatId, userId, 0);
  q.setRole.run('owner', chatId, userId);
  return chatId;
}

function getMessage(chatId, messageId) {
  return q.messageInChat.get(messageId, chatId) || null;
}

function deleteMessage(chatId, messageId) {
  const removed = q.deleteMessageRow.run(messageId, chatId).changes > 0;
  if (removed) q.clearPinnedIfRef.run(chatId, messageId);
  return removed;
}

function updateMessageBody(chatId, messageId, body) {
  const info = q.updateMessageBody.run(body, messageId, chatId);
  return info.changes > 0 ? toMessage(q.messageById.get(messageId)) : null;
}

function setReaction(messageId, userId, emoji) {
  q.upsertReaction.run(messageId, userId, emoji, Date.now());
}

function clearReaction(messageId, userId) {
  q.removeReaction.run(messageId, userId);
}

function setPinned(chatId, messageId) {
  q.setPinned.run(messageId, chatId);
}

function getPinnedMessage(chatId, messageId) {
  if (!messageId) return null;
  return q.getPinned.get(messageId, chatId) || null;
}

function reactionSummary(messageIds, viewerId) {
  const result = new Map();
  for (const id of messageIds) {
    const counts = {};
    for (const row of q.reactionCounts.all(id)) counts[row.emoji] = row.n;
    const mine = q.myReaction.get(id, viewerId);
    result.set(id, { counts, mine: mine ? mine.emoji : null });
  }
  return result;
}

function registerViews(userId, messageIds) {
  const now = Date.now();
  for (const id of messageIds) q.insertView.run(id, userId, now);
}

function viewsFor(messageIds) {
  const counts = new Map();
  for (const id of messageIds) counts.set(id, q.viewCount.get(id).n);
  return counts;
}

function discussionMessageCount(discussionChatId) {
  if (!discussionChatId) return 0;
  const row = q.messagesTotal.get(discussionChatId);
  return row && row.n ? row.n : 0;
}

function castPollVote(messageId, userId, optionIndex) {
  q.pollVote.run(messageId, userId, optionIndex, Date.now());
}

function clearPollVote(messageId, userId) {
  db.prepare('DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?').run(messageId, userId);
}

function pollResults(messageId, viewerId) {
  const options = [];
  const counts = {};
  for (const row of q.pollCounts.all(messageId)) counts[row.option_index] = row.n;
  const total = q.pollTotal.get(messageId).n || 0;
  const mine = q.pollVoteOf.get(messageId, viewerId);
  return { counts, total, mine: mine ? mine.option_index : null, options };
}

function listChats(userId) {
  return q.memberChats.all(userId)
    .map(chat => chatForUser(chat.id, userId))
    .filter(Boolean)
.sort((a, b) => {
      const ap = a.isPinned ? 1 : 0;
      const bp = b.isPinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = a.lastMessage ? a.lastMessage.createdAt : 0;
      const bt = b.lastMessage ? b.lastMessage.createdAt : 0;
      return bt - at;
    });
}

function insertMessage(chatId, senderId, { body = '', kind = 'text', attachment = null, duration = 0, forwardedFrom = null, fileName = null, fileSize = null, caption = null, replyToId = null, pollQuestion = null, pollOptions = null, pollAnonymous = true, mediaGroupId = null } = {}) {
  let info;
  if (pollQuestion && Array.isArray(pollOptions)) {
    info = q.insertMessageWithPoll.run(
      chatId, senderId, body, kind, attachment, duration, forwardedFrom, fileName, fileSize, caption, replyToId,
      String(pollQuestion), JSON.stringify(pollOptions), pollAnonymous ? 1 : 0, mediaGroupId, Date.now()
    );
  } else {
    info = q.insertMessage.run(chatId, senderId, body, kind, attachment, duration, forwardedFrom, fileName, fileSize, caption, replyToId, mediaGroupId, Date.now());
  }
  return toMessage(q.messageById.get(info.lastInsertRowid));
}

function forwardMessage(chatId, senderId, sourceMessageId) {
  const info = q.insertForward.run(chatId, senderId, sourceMessageId, Date.now(), sourceMessageId);
  return toMessage(q.messageById.get(info.lastInsertRowid));
}

function setChatAvatar(chatId, avatar) {
  q.updateChatAvatar.run(avatar, chatId);
}

function listMessages(chatId, beforeId, limit = 50, minId = 0) {
  const cursor = Number.isFinite(beforeId) && beforeId > 0 ? beforeId : Number.MAX_SAFE_INTEGER;
  return q.messagesInChatSince.all(chatId, cursor, minId, limit).map(toMessage).reverse();
}

function markRead(chatId, userId, messageId) {
  const last = q.lastChatMessage.get(chatId);
  const target = Math.min(Number(messageId) || 0, last && last.id ? last.id : 0);
  q.markRead.run(target, chatId, userId);
  return target;
}

function touchUser(userId) {
  q.touchUser.run(Date.now(), userId);
}

function setPublicKey(userId, publicKey) {
  q.setPublicKey.run(publicKey, userId);
}

function walletOf(userId) {
  const row = q.balanceOf.get(userId);
  if (!row) return null;
  return {
    balance: row.balance,
    walletNo: row.wallet_no || null,
    verified: Boolean(row.verified),
    isAdmin: Boolean(row.is_admin)
  };
}

function ensureWallet(userId) {
  const current = q.balanceOf.get(userId);
  if (!current.wallet_no) {
    let wallet;
    do {
      wallet = String(Math.floor(100000000 + Math.random() * 900000000));
    } while (q.userByWallet.get(wallet));
    q.setWalletNo.run(wallet, userId);
    return wallet;
  }
  return current.wallet_no;
}

function findUserByWallet(walletNo) {
  return q.userByWallet.get(String(walletNo)) || null;
}

function addFunds(userId, amount) {
  q.addBalance.run(amount, Date.now(), userId);
}

function grantFunds(userId, amount) {
  const row = q.balanceOf.get(userId);
  const next = Math.max(0, (row ? row.balance : 0) + amount);
  q.setBalance.run(next, Date.now(), userId);
  return next;
}

function recordTransfer({ from, to, amount, note, kind }) {
  q.insertCoinTransfer.run(from || null, to || null, amount, note || null, kind || 'transfer', Date.now());
}

function listTransfersOf(userId, limit = 50) {
  return q.transfersOf.all(userId, userId, limit);
}

function listAllTransfers(limit = 100) {
  return q.allTransfers.all(limit);
}

function createLot({ sellerId, kind, itemId, itemName, itemData, price }) {
  const res = q.insertLot.run(sellerId, kind, itemId, itemName, itemData ? JSON.stringify(itemData) : null, price, Date.now());
  return res.lastInsertRowid;
}

function getLot(id) {
  return q.lotById.get(Number(id)) || null;
}

function listActiveLots() {
  return q.activeLots.all();
}

function listLotsOfSeller(sellerId) {
  return q.lotsOfSeller.all(sellerId);
}

function markLotSold(id, buyerId) {
  const res = q.sellLot.run(buyerId, Date.now(), id);
  return res.changes > 0;
}

function cancelLot(id, sellerId) {
  q.cancelLot.run(id, sellerId);
}

function bumpPurchaseCount(userId) {
  q.bumpPurchaseCount.run(userId);
}

function purchaseCountOf(userId) {
  const row = q.purchaseCountOf.get(userId);
  return row ? row.purchase_count : 0;
}

function setMajorVerified(userId, on) {
  q.setMajorVerified.run(on ? 1 : 0, userId);
}

function setStatusEmoji(userId, emoji) {
  q.setStatusEmoji.run(emoji || null, userId);
}

function setUserVerified(userId, verified) {
  q.setUserVerified.run(verified ? 1 : 0, userId);
}

function setChatVerified(chatId, verified) {
  q.setChatVerified.run(verified ? 1 : 0, chatId);
}

function setChatPin(chatId, userId, pinned) {
  q.setChatPin.run(pinned ? 1 : 0, chatId, userId);
}

function setChatArchive(chatId, userId, archived) {
  q.setChatArchive.run(archived ? 1 : 0, chatId, userId);
}

function setChatDiscussion(chatId, discussionId) {
  q.setDiscussion.run(discussionId || null, chatId);
}

function getChatDiscussion(chatId) {
  return q.getDiscussion.get(chatId) || null;
}

function discussionGroupTaken(groupId, exceptChannelId) {
  const row = q.discussionOwner.get(groupId, exceptChannelId);
  return row ? row.id : null;
}

module.exports = {
  createUser,
  getUserByUsername,
  getUserById,
  getUserByPhone,
  makeAuthCode,
  getAuthCode,
  bumpAuthAttempts,
  resetAuthAttempts,
  clearAuthCode,
  clearPhoneFromUser,
  bindPhoneToUser,
  listUsers,
  messageCountWith,
  walletOf,
  ensureWallet,
  findUserByWallet,
  addFunds,
  grantFunds,
  recordTransfer,
  listTransfersOf,
  listAllTransfers,
  createLot,
  getLot,
  listActiveLots,
  listLotsOfSeller,
  markLotSold,
  cancelLot,
  bumpPurchaseCount,
  purchaseCountOf,
  setMajorVerified,
  setUserVerified,
  setChatVerified,
  listUsers,
  createSession,
  getSession,
  deleteSession,
  purgeSessions,
  isMember,
  chatMemberIds,
  blockUser,
  unblockUser,
  isBlocked,
  myBlockedIds,
createDirectChat,
  listChats,
chatForUser,
  insertMessage,
  listMessages,
  markRead,
  touchUser,
  setPublicKey,
  listSessions,
  deleteUserSession,
updateProfile,
  setUsername,
  updatePhoneInfo,
  updatePassword,
  setHideOnline,
  setHideLastSeen,
  createNamedChat,
  addChatMember,
  membershipOf,
  memberRole,
  setMemberRole,
  removeChatMember,
  chatMembers,
  findChatByUsername,
  findChatByInvite,
  updateChatMeta,
  rotateInvite,
  deleteChat,
  memberCount,
registerViews,
  viewsFor,
  discussionMessageCount,
  castPollVote,
  clearPollVote,
  pollResults,
  getSavedChat,
  getMessage,
  deleteMessage,
  setReaction,
  clearReaction,
  reactionSummary,
  setPinned,
  getPinnedMessage,
  updateMessageBody,
  forwardMessage,
  setChatAvatar,
  setChatPin,
  setChatArchive,
  setChatDiscussion,
  getChatDiscussion,
  discussionGroupTaken,
  listUserGroups,
  deleteAccount
};



