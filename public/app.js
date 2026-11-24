'use strict';

const TICK_SENT = '<svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true"><path d="M1.6 6.2l3.1 3.1L11.1 2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TICK_READ = '<svg viewBox="0 0 20 11" width="20" height="11" aria-hidden="true"><path d="M1.6 6.2l3.1 3.1L11.1 2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.4 6.2l3.1 3.1L18 2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const EYE_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

const PALETTE = ['#4f7fe8', '#8b5cf6', '#e0713f', '#2f9e6b', '#c99a2e', '#3f9fc0', '#c95d8f', '#64748b'];
const PAGE_SIZE = 50;
const GROUP_GAP_MS = 5 * 60 * 1000;
const DRAFT_KEY = 'messenger-drafts-v1';
const E2E_PREFIX = 'e2e1:';
const KEY_STORAGE = 'messenger-e2e-key-v1';
const ACCOUNTS_KEY = 'wm_accounts_v1';
const ACTIVE_ACCOUNT_KEY = 'wm_active_account_v1';
const DECRYPT_FAILED = 'Зашифровано ключом другого устройства';

function getAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); }
  catch { return []; }
}
function saveAccounts(list) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}
function getActiveToken() {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY) || '';
}
function setActiveToken(token) {
  if (token) localStorage.setItem(ACTIVE_ACCOUNT_KEY, token);
  else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}
function addOrUpdateAccount(user, token) {
  if (!token) return;
  const accounts = getAccounts().filter(a => a.token !== token);
  accounts.push({ token, name: user.displayName, username: user.username || '', avatar: user.avatar || '' });
  saveAccounts(accounts);
  setActiveToken(token);
}

const REACTIONS_QUICK = ['👍', '👎', '❤️', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😱'];
const REACTIONS_ALL = [
  '👍', '👎', '❤️', '🔥', '🥰', '👏', '😁', '🤔', '🤯', '😱', '🤬', '😢',
  '🎉', '🤩', '🤮', '💩', '🙏', '👌', '🕊️', '🤡', '🥱', '🥴', '😍', '🐳',
  '❤️‍🔥', '🌚', '🌭', '💯', '🤣', '⚡', '🍌', '🏆', '💔', '🤨', '😐', '🍓',
  '🍾', '💋', '🖕', '😈', '😴', '😭', '🤓', '👻', '💻', '👀', '🎃', '🙈',
  '😇', '😨', '🤝', '🤗', '🫡', '🎅', '🎄', '☃️', '💅', '🤪', '🗿', '🆒',
  '💘', '🙉', '🦄', '😘', '💊', '🙊', '😎'
];

const EMOJI_FILE = {
  '👍': '1f44d', '👎': '1f44e', '❤️': '2764', '🔥': '1f525', '🥰': '1f970',
  '👏': '1f44f', '😁': '1f601', '🤔': '1f914', '🤯': '1f92f', '😱': '1f631',
  '🤬': '1f92c', '😢': '1f622', '🎉': '1f389', '🤩': '1f929', '🤮': '1f92e',
  '💩': '1f4a9', '🙏': '1f64f', '👌': '1f44c', '🕊️': '1f54a', '🤡': '1f921',
  '🥱': '1f971', '🥴': '1f974', '😍': '1f60d', '🐳': '1f433', '❤️‍🔥': '2764-fe0f-200d-1f525',
  '🌚': '1f31a', '🌭': '1f32d', '💯': '1f4af', '🤣': '1f923', '⚡': '26a1',
  '🍌': '1f34c', '🏆': '1f3c6', '💔': '1f494', '🤨': '1f928', '😐': '1f610',
  '🍓': '1f353', '🍾': '1f37e', '💋': '1f48b', '🖕': '1f595', '😈': '1f608',
  '😴': '1f634', '😭': '1f62d', '🤓': '1f913', '👻': '1f47b', '💻': '1f4bb',
  '👀': '1f440', '🎃': '1f383', '🙈': '1f648', '😇': '1f607', '😨': '1f628',
  '🤝': '1f91d', '🤗': '1f917', '🫡': '1fae1', '🎅': '1f385', '🎄': '1f384',
  '☃️': '2603', '💅': '1f485', '🤪': '1f92a', '🗿': '1f5ff', '🆒': '1f192',
  '💘': '1f498', '🙉': '1f649', '🦄': '1f984', '😘': '1f618', '💊': '1f48a',
  '🙊': '1f64a', '😎': '1f60e'
};

function emojiNode(emoji, cls) {
  const code = EMOJI_FILE[emoji];
  const node = document.createElement('span');
  node.className = cls;
  if (code) {
    const img = document.createElement('img');
    img.src = 'emoji/' + code + '.png';
    img.alt = emoji;
    img.loading = 'lazy';
    node.append(img);
  } else {
    node.textContent = emoji;
  }
  return node;
}

const state = {
  me: null,
  identity: null,
  fingerprint: '',
  users: [],
  chats: [],
  messages: [],
  currentChatId: null,
  ws: null,
  reconnectDelay: 1000,
  authMode: 'login',
  loadingOlder: false,
  exhausted: false,
  replyTo: null,
  typingSentAt: 0,
  typingTimer: null,
  dividerId: null,
  infoChatId: null,
  profileUserId: null,
  draftTimer: null,
  editing: null,
  recState: null,
  voicePlayer: null,
  settingsSection: 'profile',
  showAllPeople: false,
  showArchive: false,
  settings: { theme: 'snow', sound: true, desktop: false },
  render: { day: null, sender: null, time: 0 }
};

const el = {
  conn: document.getElementById('conn'),

  auth: document.getElementById('auth'),
  authForm: document.getElementById('auth-form'),
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  authPhone: document.getElementById('auth-phone'),
  authCodeBtn: document.getElementById('auth-code-btn'),
  authCountryName: document.getElementById('auth-country-name'),
  authCountryCode: document.getElementById('auth-country-code'),
  authCodePrefix: document.getElementById('auth-code-prefix'),
  authQr: document.getElementById('auth-qr'),
  authPhoneStep: document.getElementById('auth-phone-step'),
  authCodeStep: document.getElementById('auth-code-step'),
  authNext: document.getElementById('auth-next'),
  authCode: document.getElementById('auth-code'),
  authResend: document.getElementById('auth-resend'),
  authBack: document.getElementById('auth-back'),
  authDisplay: document.getElementById('auth-display'),
  displayField: document.getElementById('display-field'),
  authSubmit: document.getElementById('auth-submit'),
  authError: document.getElementById('auth-error'),
  authError2: document.getElementById('auth-error2'),
  authNote: document.getElementById('auth-note'),

  app: document.getElementById('app'),
  meAvatar: document.getElementById('me-avatar'),
  meName: document.getElementById('me-name'),
  meUsername: document.getElementById('me-username'),

  menuBtn: document.getElementById('menu-btn'),
  mainMenu: document.getElementById('main-menu'),
  menuAvatar: document.getElementById('menu-avatar'),
  menuName: document.getElementById('menu-name'),
  menuSettings: document.getElementById('menu-settings'),
  menuTheme: document.getElementById('menu-theme'),
  menuThemeSwitch: document.getElementById('menu-theme-switch'),
  menuAbout: document.getElementById('menu-about'),
  menuProfile: document.getElementById('menu-profile'),
  menuProfileTop: document.getElementById('menu-profile-top'),
  menuEmoji: document.getElementById('menu-emoji'),
  menuNewGroup: document.getElementById('menu-new-group'),
  menuNewChannel: document.getElementById('menu-new-channel'),
  menuContacts: document.getElementById('menu-contacts'),
  menuCalls: document.getElementById('menu-calls'),
  menuSaved: document.getElementById('menu-saved'),
  menuAddAccount: document.getElementById('menu-add-account'),
  menuMoney: document.getElementById('menu-money'),
  menuMarket: document.getElementById('menu-market'),
  menuAdmin: document.getElementById('menu-admin'),

  profile: document.getElementById('profile'),
  profileBack: document.getElementById('profile-back'),
  profileClose: document.getElementById('profile-close'),
  profileEdit: document.getElementById('profile-edit'),
  profileMore: document.getElementById('profile-more'),
  profileTitle: document.getElementById('profile-title'),
  profileContent: document.getElementById('profile-content'),
  avatarInput: document.getElementById('avatar-input'),

  settings: document.getElementById('settings'),
  settingsBack: document.getElementById('settings-back'),
  settingsTitle: document.getElementById('settings-title'),
  settingsNav: document.getElementById('settings-nav'),
  settingsContent: document.getElementById('settings-content'),

  composeBtn: document.getElementById('compose-btn'),
  composeMenu: document.getElementById('compose-menu'),
  composeMessage: document.getElementById('compose-message'),
  composeGroup: document.getElementById('compose-group'),
  composeChannel: document.getElementById('compose-channel'),
  chatInfoBtn: document.getElementById('chat-info-btn'),
  chatInfo: document.getElementById('chat-info'),
  chatInfoBack: document.getElementById('chat-info-back'),
  chatInfoTitle: document.getElementById('chat-info-title'),
  chatInfoContent: document.getElementById('chat-info-content'),

  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),

  search: document.getElementById('user-search'),
  peopleBlock: document.getElementById('people-block'),
  peopleList: document.getElementById('people-list'),
  chatsTitle: document.getElementById('chats-title'),
  archiveRow: document.getElementById('archive-row'),
  archiveBadge: document.getElementById('archive-badge'),
  chatList: document.getElementById('chat-list'),
  chatsEmpty: document.getElementById('chats-empty'),

  chatPane: document.getElementById('chat-pane'),
  back: document.getElementById('back'),
  peerAvatar: document.getElementById('peer-avatar'),
  chatTitles: document.getElementById('chat-titles'),
  peerName: document.getElementById('peer-name'),
  peerStatus: document.getElementById('peer-status'),
  chatLock: document.getElementById('chat-lock'),

  messages: document.getElementById('messages'),
  messageList: document.getElementById('message-list'),
  chatSearchBtn: document.getElementById('chat-search-btn'),
  chatSearchBar: document.getElementById('chat-searchbar'),
  chatSearchInput: document.getElementById('chat-search-input'),
  chatSearchCount: document.getElementById('chat-search-count'),
  chatSearchClose: document.getElementById('chat-search-close'),
  pinned: document.getElementById('pinned'),
  pinnedBody: document.getElementById('pinned-body'),
  pinnedLabel: document.getElementById('pinned-label'),
  pinnedComment: document.getElementById('pinned-comment'),
  pinnedShare: document.getElementById('pinned-share'),
  pinnedClose: document.getElementById('pinned-close'),
  jump: document.getElementById('jump'),

  composer: document.getElementById('composer'),
  input: document.getElementById('message-input'),
  counter: document.getElementById('counter'),
  micBtn: document.getElementById('mic-btn'),
  pollBtn: document.getElementById('poll-btn'),
  attachBtn: document.getElementById('attach-btn'),
  attachInput: document.getElementById('attach-input'),
  emojiBtn: document.getElementById('emoji-btn'),
  emojiPanel: document.getElementById('emoji-panel'),
  stickerBtn: document.getElementById('sticker-btn'),
  stickerPanel: document.getElementById('sticker-panel'),
  mentionPanel: document.getElementById('mention-panel'),
  recTimer: document.getElementById('rec-timer'),
  replyBar: document.getElementById('reply-bar'),
  replyBarTitle: document.getElementById('reply-bar-title'),
  replyBarText: document.getElementById('reply-bar-text'),
  replyBarClose: document.getElementById('reply-bar-close'),

  placeholder: document.getElementById('placeholder'),
  toast: document.getElementById('toast')
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ---------- Общие утилиты ---------- */

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const active = getActiveToken();
  if (active) headers['x-sid'] = active;
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.error || 'Ошибка запроса');
    error.status = response.status;
    throw error;
  }
  return data;
}

function initials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

function colorFor(id) {
  return PALETTE[Math.abs(Number(id) || 0) % PALETTE.length];
}

function shade(hex) {
  const value = hex.replace('#', '');
  const num = parseInt(value, 16);
  const r = Math.max(0, ((num >> 16) & 255) - 40);
  const g = Math.max(0, ((num >> 8) & 255) - 40);
  const b = Math.max(0, (num & 255) - 40);
  return `rgb(${r}, ${g}, ${b})`;
}

function verifiedBadge() {
  const badge = document.createElement('span');
  badge.className = 'verified-badge';
  badge.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-label="Верифицировано" role="img"><path d="M12 1.7l2.8 2 3.4-.4 1 3.3 3 1.7-1.2 3.2 1.2 3.2-3 1.7-1 3.3-3.4-.4-2.8 2-2.8-2-3.4.4-1-3.3-3-1.7 1.2-3.2L1.1 8l3-1.7 1-3.3 3.4.4z" fill="#3d8fe0"/><path d="M8.5 12l2.4 2.4L15.5 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return badge;
}

function appendVerified(parent, isVerified) {
  if (isVerified) parent.append(verifiedBadge());
}

function majorBadge() {
  const badge = document.createElement('span');
  badge.className = 'major-badge';
  badge.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-label="Major Verified" role="img"><path d="M12 0.6 13.4 4.3 14.5 7.1 17.9 8.2 21.6 9.6 19.7 12.7 18.1 14.5 19.6 17.7 18.4 21.3 14.9 19.6 12 18.4 9.1 19.6 5.6 21.3 4.4 17.7 5.9 14.5 4.3 12.7 2.4 9.6 6.1 8.2 9.5 7.1 10.6 4.3 Z" fill="#ff7d5c"/><path d="M12 7.2 13.3 10 16.2 10.3 14 12.3 14.7 15.1 12 13.6 9.3 15.1 10 12.3 7.8 10.3 10.7 10 Z" fill="#ffffff"/></svg>';
  return badge;
}

function applyAvatar(node, name, id, online, avatar) {
  const dot = node.querySelector('.dot');

  for (const child of [...node.childNodes]) {
    if (!dot || child !== dot) child.remove();
  }

  if (online) {
    node.classList.add('online');
    if (!dot) node.append(Object.assign(document.createElement('span'), { className: 'dot' }));
  } else {
    node.classList.remove('online');
  }

  if (avatar) {
    node.style.background = 'transparent';
    node.style.backgroundImage = `url("${avatar}")`;
    node.style.backgroundSize = 'cover';
    node.style.backgroundPosition = 'center';
  } else {
    node.style.backgroundImage = 'none';
    node.style.background = `linear-gradient(135deg, ${colorFor(id)}, ${shade(colorFor(id))})`;
    node.insertBefore(document.createTextNode(initials(name)), node.firstChild);
  }
}

function hhmm(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(ts) {
  return new Date(ts).toDateString();
}

function dayLabel(ts) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function listTime(ts) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return hhmm(ts);
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function lastSeenText(user) {
  if (!user) return '';
  if (user.online) return 'в сети';
  if (!user.lastSeen) return 'не в сети';

  const diff = Date.now() - Number(user.lastSeen);
  if (diff < 60 * 1000) return 'не в сети · только что';
  if (diff < 60 * 60 * 1000) return `не в сети · ${Math.floor(diff / 60000)} мин назад`;
  if (dayKey(user.lastSeen) === dayKey(Date.now())) return `не в сети · ${hhmm(user.lastSeen)}`;
  return 'не в сети · ' + new Date(user.lastSeen).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function toast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.toast.hidden = true; }, 2800);
}

function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getDraft(chatId) {
  return loadDrafts()[chatId] || '';
}

function persistDraft(chatId, text) {
  const drafts = loadDrafts();
  drafts[chatId] = text;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function clearDraft(chatId) {
  const drafts = loadDrafts();
  delete drafts[chatId];
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function autoGrow() {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 168) + 'px';
}

function nearBottom() {
  return el.messages.scrollHeight - el.messages.scrollTop - el.messages.clientHeight < 200;
}

function scrollBottom(smooth = false) {
  el.messages.scrollTo({ top: el.messages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

function chatById(id) {
  return state.chats.find(chat => chat.id === id) || null;
}

function userById(id) {
  return state.users.find(user => user.id === id) || null;
}

/* ---------- Шифрование ---------- */

function b64encode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function b64decode(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function identityKey(userId) {
  return `${KEY_STORAGE}:${userId}`;
}

function loadIdentity(userId) {
  const raw = localStorage.getItem(identityKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && parsed.priv && parsed.pub ? parsed : null;
  } catch {
    return null;
  }
}

async function createIdentity(userId) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const identity = { priv, pub };
  localStorage.setItem(identityKey(userId), JSON.stringify(identity));
  return identity;
}

async function fingerprintOf(publicJwk) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${publicJwk.x}.${publicJwk.y}`));
  const hex = [...new Uint8Array(digest).slice(0, 16)]
    .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  return hex.match(/.{1,8}/g).join(' ');
}

async function ensureIdentity() {
  let identity = loadIdentity(state.me.id);
  if (!identity) identity = await createIdentity(state.me.id);

  state.identity = identity;
  state.fingerprint = await fingerprintOf(identity.pub);

  const publicKeyJson = JSON.stringify(identity.pub);
  if (state.me.publicKey !== publicKeyJson) {
    try {
      const data = await api('/api/keys', { method: 'POST', body: { publicKey: publicKeyJson } });
      state.me = data.user;
    } catch (error) {
      toast('Не удалось опубликовать ключ: ' + error.message);
    }
  }
}

const keyCache = new Map();

async function chatKey(chatId, peerPublicJwk) {
  const peerKeyString = JSON.stringify(peerPublicJwk);
  const cached = keyCache.get(chatId);
  if (cached && cached.peerKeyString === peerKeyString) return cached.key;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    state.identity.priv,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits']
  );
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    peerPublicJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);

  const key = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('messenger-e2e-v1'),
      info: encoder.encode('chat:' + chatId)
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(chatId, { peerKeyString, key });
  return key;
}

function peerKeyOf(chatId) {
  const chat = chatById(chatId);
  const peer = chat && chat.peer ? userById(chat.peer.id) : null;
  if (!peer || !peer.publicKey) return null;
  try {
    return JSON.parse(peer.publicKey);
  } catch {
    return null;
  }
}

async function encryptBody(chatId, text) {
  return text;
}

async function decryptBody(chatId, body) {
  if (!body || !body.startsWith(E2E_PREFIX)) return body;
  return DECRYPT_FAILED;
}

/* ---------- Меню ---------- */

function setMenu(open) {
  el.mainMenu.hidden = !open;
  el.menuBtn.setAttribute('aria-expanded', String(Boolean(open)));
}

el.menuBtn.addEventListener('click', event => {
  event.stopPropagation();
  setMenu(el.mainMenu.hidden);
});

document.addEventListener('click', event => {
  if (el.mainMenu.hidden) return;
  if (el.mainMenu.contains(event.target)) return;
  setMenu(false);
});

/* ---------- Локальные настройки ---------- */

const SETTINGS_KEY = 'messenger-settings-v1';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch {
    /* настройки не критичны */
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function applyTheme() {
  const theme = state.settings.theme === 'black' ? 'black' : 'snow';
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('theme-snow', theme === 'snow');
  document.documentElement.classList.toggle('theme-black', theme === 'black');
  el.menuTheme.setAttribute('aria-checked', theme === 'black' ? 'false' : 'true');
}

let snowLayer = null;

function toggleSnow(on) {
  if (on && !snowLayer) {
    snowLayer = document.createElement('div');
    snowLayer.className = 'snow-layer';
    snowLayer.setAttribute('aria-hidden', 'true');
    const N = 60;
    for (let i = 0; i < N; i += 1) {
      const flake = document.createElement('i');
      flake.className = 'snow-flake';
      const size = 3 + Math.random() * 5;
      const left = Math.random() * 100;
      const duration = 8 + Math.random() * 14;
      const delay = Math.random() * 20;
      const drift = (Math.random() * 60 - 30).toFixed(1);
      flake.style.cssText = `left:${left}%;width:${size}px;height:${size}px;` +
        `animation-duration:${duration.toFixed(1)}s;animation-delay:-${delay.toFixed(1)}s;--drift:${drift}px;`;
      snowLayer.append(flake);
    }
    document.body.append(snowLayer);
  } else if (!on && snowLayer) {
    snowLayer.remove();
    snowLayer = null;
  }
}

let audioContext = null;

function playPing() {
  if (!state.settings.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext = audioContext || new Ctx();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.32);
  } catch {
    /* звук не критичен */
  }
}

function desktopNotify(title, body) {
  if (!state.settings.desktop) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
    return;
  }
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {
    /* уведомление не критично */
  }
}

/* ---------- Модальное подтверждение ---------- */

function closeModal() {
  el.modal.hidden = true;
}

function openModal(title, nodes) {
  el.modalTitle.textContent = title;
  el.modalBody.replaceChildren();
  if (Array.isArray(nodes)) el.modalBody.append(...nodes);
  else if (nodes) el.modalBody.append(nodes);
  el.modal.hidden = false;
}

for (const node of document.querySelectorAll('[data-close="modal"]')) {
  node.addEventListener('click', closeModal);
}

function confirmAction({ title, text, confirmText = 'Подтвердить' }, onConfirm) {
  el.modalTitle.textContent = title;
  el.modalBody.replaceChildren();

  const message = document.createElement('p');
  message.className = 'settings__note';
  message.textContent = text;

  const actions = document.createElement('div');
  actions.className = 'modal__actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--ghost';
  cancel.textContent = 'Отмена';
  cancel.addEventListener('click', closeModal);

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'btn btn--danger';
  confirm.textContent = confirmText;
  confirm.addEventListener('click', async () => {
    closeModal();
    await onConfirm();
  });

  actions.append(cancel, confirm);
  el.modalBody.append(message, actions);
  el.modal.hidden = false;
}

/* ---------- Экран настроек ---------- */

const SECTIONS = [
  { id: 'profile', title: 'Профиль' },
  { id: 'privacy', title: 'Конфиденциальность и безопасность' },
  { id: 'notifications', title: 'Уведомления' },
  { id: 'appearance', title: 'Оформление' },
  { id: 'data', title: 'Данные и память' },
  { id: 'market', title: 'Маркет' },
  { id: 'other', title: 'Прочее' },
  { id: 'about', title: 'О приложении' }
];

function openSettings(section = 'profile') {
  setMenu(false);
  el.settings.hidden = false;
  renderSettingsNav();
  renderSettingsSection(section);
}

function closeSettings() {
  el.settings.hidden = true;
}

el.settingsBack.addEventListener('click', closeSettings);
el.menuSettings.addEventListener('click', () => openSettings('profile'));
el.menuAbout.addEventListener('click', () => openSettings('about'));

function renderSettingsNav() {
  el.settingsNav.replaceChildren();

  for (const section of SECTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'settings__navitem' + (state.settingsSection === section.id ? ' is-active' : '');
    button.dataset.section = section.id;
    button.textContent = section.title;
    button.addEventListener('click', () => renderSettingsSection(section.id));
    el.settingsNav.append(button);
  }
}

function renderSettingsSection(id) {
  state.settingsSection = id;
  const section = SECTIONS.find(item => item.id === id) || SECTIONS[0];

  el.settingsTitle.textContent = section.title;
  el.settingsContent.replaceChildren();

  for (const button of el.settingsNav.children) {
    button.classList.toggle('is-active', button.dataset.section === section.id);
  }

  const builders = {
    profile: buildProfileSection,
    privacy: buildPrivacySection,
    notifications: buildNotificationsSection,
    appearance: buildAppearanceSection,
    data: buildDataSection,
    market: buildMarketSection,
    other: buildOtherSection,
    about: buildAboutSection
  };

  builders[section.id](el.settingsContent);
}

function settingsBlock(title) {
  const block = document.createElement('section');
  block.className = 'settings-block';

  if (title) {
    const heading = document.createElement('h2');
    heading.className = 'settings-block__title';
    heading.textContent = title;
    block.append(heading);
  }
  return block;
}

function settingsField(labelText, input) {
  const label = document.createElement('label');
  label.className = 'field';
  const span = document.createElement('span');
  span.textContent = labelText;
  label.append(span, input);
  return label;
}

function settingsToggle(labelText, hintText, value, onChange) {
  const row = document.createElement('label');
  row.className = 'settings-toggle';

  const text = document.createElement('div');
  text.className = 'settings-toggle__text';

  const label = document.createElement('div');
  label.className = 'settings-toggle__label';
  label.textContent = labelText;
  text.append(label);

  if (hintText) {
    const hint = document.createElement('div');
    hint.className = 'settings-toggle__hint';
    hint.textContent = hintText;
    text.append(hint);
  }

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'switch-input';
  input.checked = Boolean(value);
  input.addEventListener('change', () => onChange(input.checked));

  row.append(text, input);
  return row;
}

function buildProfileSection(container) {
  const block = settingsBlock();

  const head = document.createElement('div');
  head.className = 'settings__profile';

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar--xl avatar--me avatar--editable';
  avatar.title = 'Сменить фото';
  applyAvatar(avatar, state.me.displayName, state.me.id, false, state.me.avatar);
  avatar.addEventListener('click', () => el.avatarInput.click());

  const names = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'settings__name';
  name.textContent = state.me.displayName;
  const username = document.createElement('div');
  username.className = 'settings__username' + (state.me.username ? '' : ' settings__username--empty');
  username.textContent = state.me.username ? '@' + state.me.username : 'Имя пользователя не назначен';
  if (!state.me.username) {
    username.title = 'Назначить имя пользователя';
    username.classList.add('is-clickable');
    username.addEventListener('click', () => openUsernameModal(state.me));
  }
  names.append(name, username);
  if (state.me.phone) {
    const phone = document.createElement('div');
    phone.className = 'settings__username';
    phone.textContent = state.me.phone;
    names.append(phone);
  }

  head.append(avatar, names);
  block.append(head);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 40;
  nameInput.value = state.me.displayName;

  const bioInput = document.createElement('textarea');
  bioInput.className = 'settings-textarea';
  bioInput.rows = 3;
  bioInput.maxLength = 140;
  bioInput.placeholder = 'Расскажите о себе';
  bioInput.value = state.me.bio || '';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn--primary';
  save.textContent = 'Сохранить';
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const data = await api('/api/me', {
        method: 'PATCH',
        body: { displayName: nameInput.value, bio: bioInput.value }
      });
      state.me = data.user;
      applySelfProfile();
      toast('Профиль сохранён');
      renderSettingsSection('profile');
    } catch (error) {
      toast(error.message);
    } finally {
      save.disabled = false;
    }
  });

  block.append(
    settingsField('Имя', nameInput),
    settingsField('О себе', bioInput),
    save
  );

  const logoutRow = document.createElement('button');
  logoutRow.type = 'button';
  logoutRow.className = 'info-row info-row--danger';

  const logoutLabel = document.createElement('span');
  logoutLabel.className = 'info-row__label';
  logoutLabel.textContent = 'Выйти из аккаунта';
  logoutRow.append(logoutLabel);

  logoutRow.addEventListener('click', () => {
    confirmAction({
      title: 'Выйти из аккаунта',
      text: 'Сеанс завершится на этом устройстве. Ключ шифрования останется в браузере.',
      confirmText: 'Выйти'
    }, doLogout);
  });

  const delRow = document.createElement('button');
  delRow.type = 'button';
  delRow.className = 'info-row info-row--danger';

  const delLabel = document.createElement('span');
  delLabel.className = 'info-row__label';
  delLabel.textContent = 'Удалить аккаунт';
  delRow.append(delLabel);

  delRow.addEventListener('click', () => {
    confirmAction({
      title: 'Удалить аккаунт',
      text: 'Аккаунт, все сообщения и данные будут удалены без возможности восстановления.',
      confirmText: 'Удалить навсегда'
    }, async () => {
      try {
        await api('/api/account', { method: 'DELETE' });
        localStorage.clear();
        location.reload();
      } catch (error) {
        toast(error.message);
      }
    });
  });

  block.append(logoutRow, delRow);

  container.append(block);
}

function buildPrivacySection(container) {
  const visibility = settingsBlock('Приватность');
  visibility.append(settingsToggle(
    'Показывать, что я в сети',
    'Если выключить, собеседники не увидят ни статус, ни время последнего визита',
    !state.me.hideOnline,
    async checked => {
      try {
        const data = await api('/api/privacy', { method: 'POST', body: { hideOnline: !checked } });
        state.me = data.user;
        toast(checked ? 'Статус «в сети» показывается' : 'Статус «в сети» скрыт');
      } catch (error) {
        toast(error.message);
      }
    }
  ));

  visibility.append(settingsToggle(
    'Показывать время последнего захода',
    'Собеседники увидят, когда вы были в сети, но не сам статус',
    !state.me.lastSeenHidden,
    async checked => {
      try {
        const data = await api('/api/privacy', { method: 'POST', body: { hideLastSeen: !checked } });
        state.me = data.user;
        toast(checked ? 'Время захода показывается' : 'Время захода скрыто');
      } catch (error) {
        toast(error.message);
      }
    }
  ));

  container.append(visibility);

  const password = settingsBlock('Смена пароля');

  const current = document.createElement('input');
  current.type = 'password';
  current.autocomplete = 'current-password';

  const next = document.createElement('input');
  next.type = 'password';
  next.autocomplete = 'new-password';

  const repeat = document.createElement('input');
  repeat.type = 'password';
  repeat.autocomplete = 'new-password';

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn--primary';
  submit.textContent = 'Изменить пароль';
  submit.addEventListener('click', async () => {
    if (next.value.length < 8) {
      toast('Новый пароль короче 8 символов');
      return;
    }
    if (next.value !== repeat.value) {
      toast('Пароли не совпадают');
      return;
    }

    submit.disabled = true;
    try {
      await api('/api/password', {
        method: 'POST',
        body: { currentPassword: current.value, newPassword: next.value }
      });
      current.value = '';
      next.value = '';
      repeat.value = '';
      toast('Пароль изменён, остальные сеансы завершены');
    } catch (error) {
      toast(error.message);
    } finally {
      submit.disabled = false;
    }
  });

  password.append(
    settingsField('Текущий пароль', current),
    settingsField('Новый пароль', next),
    settingsField('Повторите новый', repeat),
    submit
  );
  container.append(password);

  const sessions = settingsBlock('Активные сеансы');
  const list = document.createElement('div');
  list.className = 'session-list';
  list.textContent = 'Загружаю…';
  sessions.append(list);
  container.append(sessions);

  renderSessions(list);
}

function describeDevice(userAgent) {
  if (!userAgent) return 'Неизвестное устройство';
  if (/edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/chrome\//i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent)) return 'Safari';
  return 'Браузер';
}

async function renderSessions(container) {
  try {
    const data = await api('/api/sessions');
    container.replaceChildren();

    if (!data.sessions.length) {
      container.textContent = 'Активных сеансов нет';
      return;
    }

    for (const session of data.sessions) {
      const row = document.createElement('div');
      row.className = 'session';

      const info = document.createElement('div');
      info.className = 'session__info';

      const title = document.createElement('div');
      title.className = 'session__title';
      title.textContent = describeDevice(session.ua) + (session.current ? ' · это устройство' : '');

      const meta = document.createElement('div');
      meta.className = 'session__meta';
      const started = new Date(session.createdAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      meta.textContent = `${session.ip || 'ip неизвестен'} · с ${started}`;

      info.append(title, meta);
      row.append(info);

      if (!session.current) {
        const end = document.createElement('button');
        end.type = 'button';
        end.className = 'btn btn--ghost btn--small session__end';
        end.textContent = 'Завершить';
        end.addEventListener('click', async () => {
          end.disabled = true;
          try {
            await api('/api/sessions', { method: 'DELETE', body: { id: session.id } });
            toast('Сеанс завершён');
            renderSettingsSection('privacy');
          } catch (error) {
            toast(error.message);
            end.disabled = false;
          }
        });
        row.append(end);
      }

      container.append(row);
    }
  } catch {
    container.textContent = 'Не удалось загрузить сеансы';
  }
}

function buildNotificationsSection(container) {
  const block = settingsBlock('Звуки');
  block.append(settingsToggle(
    'Звук новых сообщений',
    'Короткий сигнал, когда сообщение приходит в другой чат',
    state.settings.sound,
    checked => {
      state.settings.sound = checked;
      saveSettings();
      if (checked) playPing();
    }
  ));

  block.append(settingsToggle(
    'Уведомления на рабочем столе',
    'Всплывающее окно, когда сообщение приходит, пока вкладка не на переднем плане',
    state.settings.desktop,
    checked => {
      if (checked && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      state.settings.desktop = checked;
      saveSettings();
    }
  ));

  const test = document.createElement('button');
  test.type = 'button';
  test.className = 'btn btn--ghost';
  test.textContent = 'Проверить звук';
  test.addEventListener('click', () => {
    const previous = state.settings.sound;
    state.settings.sound = true;
    playPing();
    state.settings.sound = previous;
  });

  block.append(test);
  container.append(block);
}

function buildAppearanceSection(container) {
  const block = settingsBlock('Тема оформления');

  const note = document.createElement('p');
  note.className = 'settings__note';
  note.textContent = 'Снежинки идут в обеих темах — и на белой, и на чёрной.';
  block.append(note);

  const row = document.createElement('div');
  row.className = 'theme-row';

  const options = [
    { value: 'snow', label: 'Белая', desc: 'Светлая снежная тема' },
    { value: 'black', label: 'Чёрная', desc: 'Тёмная тема со снегом' }
  ];

  for (const opt of options) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.theme = opt.value;
    card.setAttribute('aria-pressed', String(state.settings.theme === opt.value));

    const title = document.createElement('div');
    title.className = 'theme-card__title';
    title.textContent = opt.label;

    const desc = document.createElement('div');
    desc.className = 'theme-card__desc';
    desc.textContent = opt.desc;

    card.append(title, desc);

    if (opt.value === 'snow') card.classList.add('theme-card--snow');
    if (opt.value === 'black') card.classList.add('theme-card--black');

    card.addEventListener('click', () => {
      state.settings.theme = opt.value;
      saveSettings();
      applyTheme();
      renderAppearance();
      toast(`Тема: ${opt.label.toLowerCase()}`);
    });

    row.append(card);
  }

  block.append(row);
  container.append(block);
}

function renderAppearance() {
  if (!el.settingsNav) return;
  renderSettingsSection('appearance');
}

function buildDataSection(container) {
  const block = settingsBlock('Ключ шифрования');

  const note = document.createElement('p');
  note.className = 'settings__note';
  note.textContent = 'Сообщения шифруются в этом браузере. Сервер хранит только шифротекст и прочитать переписку не может.';

  const keyRow = document.createElement('div');
  keyRow.className = 'settings__key';

  const keyLabel = document.createElement('div');
  keyLabel.className = 'settings__keylabel';
  keyLabel.textContent = 'Отпечаток ключа';

  const keyValue = document.createElement('code');
  keyValue.className = 'settings__keyvalue';
  keyValue.textContent = state.fingerprint || 'ключ не создан';

  keyRow.append(keyLabel, keyValue);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'btn btn--ghost btn--small';
  copy.textContent = 'Скопировать отпечаток';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.fingerprint);
      toast('Отпечаток скопирован');
    } catch {
      toast('Браузер не дал доступ к буферу');
    }
  });

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn btn--danger';
  reset.textContent = 'Создать новый ключ';
  reset.addEventListener('click', () => {
    confirmAction({
      title: 'Новый ключ шифрования',
      text: 'Старые сообщения останутся зашифрованными прежним ключом и в этом браузере больше не откроются.',
      confirmText: 'Создать ключ'
    }, async () => {
      localStorage.removeItem(identityKey(state.me.id));
      keyCache.clear();
      try {
        await ensureIdentity();
        toast('Ключ создан заново');
        renderSettingsSection('data');
        if (state.currentChatId) await openChat(state.currentChatId);
      } catch (error) {
        toast(error.message);
      }
    });
  });

  block.append(note, keyRow, copy, reset);
  container.append(block);
}

function buildAboutSection(container) {
  const block = settingsBlock();

  const rows = [
    ['Название', 'Мессенджер'],
    ['Версия', '0.4.0'],
    ['Сервер', 'Node.js, SQLite, WebSocket'],
    ['Шифрование', 'ECDH P-256 + HKDF + AES-GCM'],
    ['Клиент', 'ванильный JavaScript, без сборки']
  ];

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'about__row';

    const key = document.createElement('div');
    key.className = 'about__label';
    key.textContent = label;

    const val = document.createElement('div');
    val.className = 'about__value';
    val.textContent = value;

    row.append(key, val);
    block.append(row);
  }

  const note = document.createElement('p');
  note.className = 'settings__note';
  note.textContent = 'Собственный мессенджер: свой сервер, своя база, шифрование в браузере. Групповых чатов, вложений и звонков пока нет.';
  block.append(note);

  container.append(block);
}

function buildOtherSection(container) {
  const accountsBlock = settingsBlock('Аккаунты');

  const rows = document.createElement('div');
  rows.className = 'info-rows';

  const current = infoAction(state.me.phone || 'Без номера', {
    value: 'Текущий',
    chevron: false,
    onClick: () => {}
  });
  rows.append(current);

  const add = infoAction('Добавить номер', {
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M17 9v6M14 12h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 4h12v16l-6-4-6 4V4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    onClick: () => openAddNumberModal()
  });
  rows.append(add);

  accountsBlock.append(rows);
  container.append(accountsBlock);

  const generalBlock = settingsBlock('Общее');

  const generalRows = document.createElement('div');
  generalRows.className = 'info-rows';

  const lang = infoAction('Язык', { value: 'Русский', onClick: () => {} });
  generalRows.append(lang);

  generalBlock.append(generalRows);
  container.append(generalBlock);
}

const NFT_ITEMS = [];

function numberWithSpaces(n) {
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString('ru-RU');
}

const MARKET_KIND_LABELS = { gift: 'Подарки', username: 'Юзернеймы', number: 'Номера' };
let marketState = { tab: 'all', search: '', sort: 'new', loaded: false, lots: [], mine: [] };

function buildMarketSection(container) {
  container.replaceChildren();

  const balance = (state.me && state.me.balance != null) ? state.me.balance : 0;
  const head = document.createElement('div');
  head.className = 'market-head';
  const bal = document.createElement('div');
  bal.className = 'market-balance';
  bal.innerHTML = '<img class="market-balance__coin" src="wcoin.jpg" alt=""> <span>' + numberWithSpaces(balance) + '</span> WCOIN';
  const sellBtn = document.createElement('button');
  sellBtn.type = 'button';
  sellBtn.className = 'btn btn--primary btn--sm';
  sellBtn.textContent = 'Продать предмет';
  sellBtn.addEventListener('click', () => openSellModal());
  head.append(bal, sellBtn);
  container.append(head);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'market-search';
  const search = document.createElement('input');
  search.type = 'text';
  search.className = 'market-search__input';
  search.placeholder = 'Подарок, модель, @юзернейм или номер';
  search.value = marketState.search;
  search.addEventListener('input', () => { marketState.search = search.value; renderMarket(); });
  searchWrap.append(search);
  container.append(searchWrap);

  const tabs = document.createElement('div');
  tabs.className = 'market-tabs';
  const tabsDef = [
    { id: 'all', label: 'Все' },
    { id: 'gift', label: 'Подарки' },
    { id: 'username', label: 'Юзернеймы' },
    { id: 'number', label: 'Номера' },
    { id: 'mine', label: 'Мои' }
  ];
  for (const t of tabsDef) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'market-tabs__tab' + (marketState.tab === t.id ? ' is-active' : '');
    b.textContent = t.label;
    b.addEventListener('click', () => { marketState.tab = t.id; renderMarket(); });
    tabs.append(b);
  }
  container.append(tabs);

  const sortRow = document.createElement('div');
  sortRow.className = 'market-sortrow';
  const sortLbl = document.createElement('span');
  sortLbl.className = 'market-sortrow__label';
  sortLbl.textContent = 'Сортировка:';
  const sortSel = document.createElement('select');
  sortSel.className = 'market-sortrow__select';
  const sorts = [
    { id: 'new', label: 'Сначала новые' },
    { id: 'cheap', label: 'Сначала дешёвые' },
    { id: 'expensive', label: 'Сначала дорогие' }
  ];
  for (const s of sorts) {
    const op = document.createElement('option');
    op.value = s.id;
    op.textContent = s.label;
    if (s.id === marketState.sort) op.selected = true;
    sortSel.append(op);
  }
  sortSel.addEventListener('change', () => { marketState.sort = sortSel.value; renderMarket(); });
  sortRow.append(sortLbl, sortSel);
  container.append(sortRow);

  const body = document.createElement('div');
  body.className = 'market-body';
  container.append(body);

  const load = () => renderMarket();
  if (!marketState.loaded) {
    refreshMarket().then(() => { marketState.loaded = true; load(); });
  } else {
    load();
  }
}

async function refreshMarket() {
  try {
    const [all, mine] = await Promise.all([
      api('/api/market/lots'),
      api('/api/market/mine')
    ]);
    marketState.lots = (all && all.lots) || [];
    marketState.mine = (mine && mine.lots) || [];
  } catch (e) {
    marketState.lots = [];
    marketState.mine = [];
  }
}

function marketItemVisual(lot) {
  if (lot.kind !== 'gift') return { src: null, glyph: lot.kind === 'username' ? '@' + lot.itemName : lot.itemName };
  const d = lot.itemData || {};
  const base = nftBaseGifts().find(g => g.id === lot.itemId);
  const src = (base && base.img) || d.img || null;
  const glyph = (base && base.glyph) || d.glyph || '🎁';
  return { src, glyph };
}

function makeMarketCard(lot) {
  const card = document.createElement('div');
  card.className = 'market-card'
    + (lot.kind === 'gift' ? ' market-card--gift' : (lot.kind === 'number' ? ' market-card--num' : ' market-card--uname'));

  if (lot.kind === 'gift') {
    const artWrap = document.createElement('div');
    artWrap.className = 'market-card__artwrap';

    const art = document.createElement('div');
    art.className = 'market-card__art';
    const vis = marketItemVisual(lot);
    if (vis.src) {
      const img = document.createElement('img');
      img.className = 'market-card__img';
      img.src = vis.src;
      img.alt = lot.itemName;
      art.replaceChildren(img);
    } else {
      art.textContent = vis.glyph;
    }

    const badge = document.createElement('div');
    badge.className = 'market-card__badge market-card__badge--kind';
    badge.textContent = (MARKET_KIND_LABELS[lot.kind] || 'Товар');
    artWrap.append(art, badge);
    card.append(artWrap);
  } else {
    const top = document.createElement('div');
    top.className = 'market-card__head';
    const kindTag = document.createElement('span');
    kindTag.className = 'market-card__kindtag';
    kindTag.textContent = (MARKET_KIND_LABELS[lot.kind] || 'Товар');
    const label = document.createElement('span');
    label.className = 'market-card__sub';
    label.textContent = lot.kind === 'number' ? 'Коллекционный номер' : 'Коллекционный юзернейм';
    top.append(kindTag, label);
    card.append(top);
  }

  const body = document.createElement('div');
  body.className = 'market-card__body';
  const name = document.createElement('div');
  name.className = 'market-card__name';
  name.textContent = lot.itemName || lot.itemId;
  const price = document.createElement('div');
  price.className = 'market-card__price';
  price.textContent = numberWithSpaces(lot.price) + ' WCOIN';
  body.append(name, price);

  card.append(body);

  if (lot.sellerId === state.me.id) {
    const mineBadge = document.createElement('div');
    mineBadge.className = 'market-card__mine';
    mineBadge.textContent = 'Ваш лот';
    card.append(mineBadge);
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost market-card__buy';
    cancelBtn.textContent = 'Снять с продажи';
    cancelBtn.addEventListener('click', async () => {
      try {
        await api('/api/market/lots/' + lot.id + '/cancel', { method: 'POST' });
        toast('Лот снят');
        await refreshMarket();
        renderMarket();
      } catch (e) {
        toast(e.message || 'Не удалось снять');
      }
    });
    card.append(cancelBtn);
  } else {
    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'btn btn--primary market-card__buy';
    buyBtn.textContent = 'Купить · ' + numberWithSpaces(lot.price) + ' WCOIN';
    buyBtn.addEventListener('click', () => openMarketBuyModal(lot));
    card.append(buyBtn);
  }

  return card;
}

function renderMarket() {
  const body = el.settingsContent.querySelector('.market-body');
  if (!body || body.parentElement !== el.settingsContent) return;
  body.replaceChildren();

  const tabBtns = el.settingsContent.querySelectorAll('.market-tabs__tab');
  tabBtns.forEach(btn => {
    const id = btn.textContent;
    const map = { 'Все': 'all', 'Подарки': 'gift', 'Юзернеймы': 'username', 'Номера': 'number', 'Мои': 'mine' };
    btn.classList.toggle('is-active', map[id] === marketState.tab);
  });

  let list;
  if (marketState.tab === 'mine') {
    list = marketState.mine.slice();
  } else if (marketState.tab === 'all') {
    list = marketState.lots.slice();
  } else {
    list = marketState.lots.filter(l => l.kind === marketState.tab);
  }

  if (marketState.search.trim()) {
    const q = marketState.search.trim().toLowerCase();
    list = list.filter(l =>
      (l.itemName || '').toLowerCase().includes(q) ||
      (l.itemId || '').toLowerCase().includes(q) ||
      (l.kind === 'username' && ('@' + l.itemName).toLowerCase().includes(q)) ||
      (l.kind === 'number' && l.itemName.includes(q))
    );
  }

  if (marketState.sort === 'cheap') list.sort((a, b) => a.price - b.price);
  else if (marketState.sort === 'expensive') list.sort((a, b) => b.price - a.price);
  else list.sort((a, b) => b.createdAt - a.createdAt);

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'market-empty market-anim';
    empty.innerHTML = '<div class="market-empty__icon">🛍️</div><div class="market-empty__title">' +
      (marketState.tab === 'mine' ? 'Вы ещё ничего не продаёте' : 'Лотов пока нет') +
      '</div><div class="market-empty__text">' +
      (marketState.tab === 'mine'
        ? 'Нажмите «Продать предмет», чтобы выставить свой товар за WCOIN.'
        : 'Здесь появятся номера, юзернеймы и подарки от других пользователей.') +
      '</div>';
    body.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'market-grid market-anim';
  for (const lot of list) grid.append(makeMarketCard(lot));
  body.append(grid);
}

function openMarketBuyModal(lot) {
  const card = document.createElement('div');
  card.className = 'gift-card';

  const emoji = document.createElement('div');
  emoji.className = 'gift-card__emoji';
  const vis = marketItemVisual(lot);
  if (vis.src) {
    const img = document.createElement('img');
    img.className = 'gift-card__img';
    img.src = vis.src;
    img.alt = lot.itemName;
    emoji.replaceChildren(img);
  } else {
    emoji.textContent = vis.glyph;
  }

  const title = document.createElement('div');
  title.className = 'gift-card__title';
  title.textContent = lot.itemName || lot.itemId;

  const typeLbl = document.createElement('div');
  typeLbl.className = 'gift-card__badge';
  typeLbl.textContent = (MARKET_KIND_LABELS[lot.kind] || 'Товар');
  if (lot.kind === 'gift') {
    const g = nftBaseGifts().find(x => x.id === lot.itemId);
    if (g) typeLbl.textContent = 'Подарок · ' + g.name;
  }

  const price = document.createElement('div');
  price.className = 'gift-card__badge';
  price.textContent = 'Цена: ' + numberWithSpaces(lot.price) + ' WCOIN';

  let idBadge = null;
  if (lot.kind === 'number' || lot.kind === 'username') {
    idBadge = document.createElement('div');
    idBadge.className = 'gift-card__badge';
    idBadge.textContent = (lot.kind === 'username' ? 'Продавец @' : 'Продавец ID ') + lot.sellerId;
  }

  const actions = document.createElement('div');
  actions.className = 'modal__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--ghost';
  cancel.textContent = 'Отмена';
  cancel.addEventListener('click', closeModal);

  const buy = document.createElement('button');
  buy.type = 'button';
  buy.className = 'btn btn--primary';
  buy.textContent = 'Купить за ' + numberWithSpaces(lot.price) + ' WCOIN';
  buy.addEventListener('click', async () => {
    buy.disabled = true;
    buy.textContent = 'Переводим ' + numberWithSpaces(lot.price) + ' WCOIN…';
    try {
      const res = await api('/api/market/lots/' + lot.id + '/buy', { method: 'POST' });
      if (state.me && res && res.balance !== undefined) state.me.balance = res.balance;
      closeModal();
      toast('Успешно куплено! Покупка №' + (res && res.purchaseNo) + ' за ' + numberWithSpaces(lot.price) + ' WCOIN');
      await refreshMarket();
      renderMarket();
    } catch (error) {
      buy.disabled = false;
      buy.textContent = 'Купить за ' + numberWithSpaces(lot.price) + ' WCOIN';
      toast(error.message || 'Не удалось купить');
    }
  });

  actions.append(cancel, buy);
  const kids = [emoji, title, typeLbl];
  if (idBadge) kids.push(idBadge);
  kids.push(price, actions);
  card.append(...kids);
  openModal('Купить в маркете', [card]);
}

function openSellModal() {
  const card = document.createElement('div');
  card.className = 'sell-form';

  const items = [];
  for (const g of nftBaseGifts()) {
    items.push({ kind: 'gift', id: g.id, name: g.name, data: { img: g.img || null, glyph: g.glyph } });
  }
  if (state.me && state.me.phone) {
    items.push({ kind: 'number', id: 'main-phone', name: state.me.phone, data: {} });
  }
  const nums = (state.me && Array.isArray(state.me.numbers)) ? state.me.numbers : [];
  for (const n of nums) {
    items.push({ kind: 'number', id: 'num-' + n.phone, name: n.phone, data: { kind: n.collectible ? 'collectible' : 'free' } });
  }
  const us = (state.me && Array.isArray(state.me.collectUsernames)) ? state.me.collectUsernames : [];
  for (const u of us) {
    items.push({ kind: 'username', id: 'uname-' + u.name, name: u.name, data: { price: u.price } });
  }
  if (state.me && state.me.username) {
    items.push({ kind: 'username', id: 'main-uname', name: state.me.username, data: {} });
  }

  if (!items.length) {
    const note = document.createElement('div');
    note.className = 'settings__note';
    note.textContent = 'У вас пока нет предметов, которые можно продать. Купите номер, юзернейм или подарок в боте.';
    card.append(note);
    openModal('Продать предмет', [card]);
    return;
  }

  const selWrap = document.createElement('div');
  selWrap.className = 'sell-form__field';
  const selLbl = document.createElement('div');
  selLbl.className = 'sell-form__label';
  selLbl.textContent = 'Что продаёте';
  const sel = document.createElement('select');
  sel.className = 'market-sortrow__select sell-form__select';
  const kindOrder = { gift: 0, number: 1, username: 2 };
  items.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  for (const it of items) {
    const op = document.createElement('option');
    op.value = items.indexOf(it);
    op.textContent = (MARKET_KIND_LABELS[it.kind] || 'Товар') + ' — ' + it.name;
    sel.append(op);
  }
  selWrap.append(selLbl, sel);

  const priceWrap = document.createElement('div');
  priceWrap.className = 'sell-form__field';
  const priceLbl = document.createElement('div');
  priceLbl.className = 'sell-form__label';
  priceLbl.textContent = 'Цена, WCOIN';
  const price = document.createElement('input');
  price.type = 'number';
  price.min = '1';
  price.className = 'market-search__input sell-form__input';
  price.value = '50';
  priceWrap.append(priceLbl, price);

  const actions = document.createElement('div');
  actions.className = 'modal__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--ghost';
  cancel.textContent = 'Отмена';
  cancel.addEventListener('click', closeModal);
  const put = document.createElement('button');
  put.type = 'button';
  put.className = 'btn btn--primary';
  put.textContent = 'Выставить на маркет';
  put.addEventListener('click', async () => {
    const idx = Number(sel.value);
    const it = items[idx];
    const priceNum = Math.round(Number(price.value));
    if (!Number.isFinite(priceNum) || priceNum < 1) { toast('Укажите корректную цену'); return; }
    put.disabled = true;
    try {
      await api('/api/market/lots', { method: 'POST', body: {
        kind: it.kind, itemId: it.id, itemName: it.name, itemData: it.data, price: priceNum
      } });
      closeModal();
      toast('Лот выставлен');
      await refreshMarket();
      renderMarket();
    } catch (e) {
      put.disabled = false;
      toast(e.message || 'Не удалось выставить');
    }
  });
  actions.append(cancel, put);

  card.append(selWrap, priceWrap, actions);
  openModal('Продать предмет', [card]);
}

const OWNED_GIFTS_KEY = 'mt_owned_gifts';
function getOwnedGifts() {
  try { localStorage.removeItem(OWNED_GIFTS_KEY); } catch {}
  return [];
}
function markGiftOwned(item) {
  const list = getOwnedGifts();
  if (!list.some(g => g.id === item.id)) {
    list.push({ id: item.id, at: Date.now() });
    localStorage.setItem(OWNED_GIFTS_KEY, JSON.stringify(list));
  }
}
function markGiftUpgraded(item) {
  const list = getOwnedGifts();
  const rec = list.find(g => g.id === item.id);
  if (rec) rec.upgraded = true;
  else list.push({ id: item.id, at: Date.now(), upgraded: true });
  localStorage.setItem(OWNED_GIFTS_KEY, JSON.stringify(list));
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  setMenu(false);
  setComposeMenu(false);
  if (!el.modal.hidden) closeModal();
  if (!el.settings.hidden && !el.app.hidden) closeSettings();
});
/* ---------- Авторизация ---------- */

const PHONE_CODES = [
  { code: '+7', country: 'Россия' },
  { code: '+380', country: 'Украина' },
  { code: '+375', country: 'Беларусь' },
  { code: '+7', country: 'Казахстан' },
  { code: '+998', country: 'Узбекистан' },
  { code: '+996', country: 'Кыргызстан' },
  { code: '+992', country: 'Таджикистан' },
  { code: '+993', country: 'Туркменистан' },
  { code: '+374', country: 'Армения' },
  { code: '+994', country: 'Азербайджан' },
  { code: '+995', country: 'Грузия' },
  { code: '+373', country: 'Молдова' },
  { code: '+372', country: 'Эстония' },
  { code: '+371', country: 'Латвия' },
  { code: '+370', country: 'Литва' },
  { code: '+48', country: 'Польша' },
  { code: '+49', country: 'Германия' },
  { code: '+33', country: 'Франция' },
  { code: '+44', country: 'Великобритания' },
  { code: '+39', country: 'Италия' },
  { code: '+34', country: 'Испания' },
  { code: '+1', country: 'США/Канада' },
  { code: '+86', country: 'Китай' },
  { code: '+81', country: 'Япония' },
  { code: '+82', country: 'Республика Корея' },
  { code: '+91', country: 'Индия' },
  { code: '+55', country: 'Бразилия' },
  { code: '+52', country: 'Мексика' },
  { code: '+61', country: 'Австралия' },
  { code: '+90', country: 'Турция' },
  { code: '+98', country: 'Иран' },
  { code: '+93', country: 'Афганистан' },
  { code: '+964', country: 'Ирак' },
  { code: '+963', country: 'Сирия' },
  { code: '+20', country: 'Египет' },
  { code: '+971', country: 'ОАЭ' },
  { code: '+966', country: 'Саудовская Аравия' },
  { code: '+972', country: 'Израиль' },
  { code: '+888', country: 'Коллекционные' }
];

let authPhoneCode = '+7';
let authCollectible = false;

function showAuthError(message) {
  el.authError.textContent = message;
  el.authError2.textContent = message;
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === 'register';

  el.tabLogin.classList.toggle('is-active', !isRegister);
  el.tabRegister.classList.toggle('is-active', isRegister);
  el.displayField.hidden = !isRegister;
  el.authNote.textContent = isRegister
    ? 'Зарегистрируйтесь и сразу войдите.'
    : 'Войдите по номеру. Код придёт в Telegram-бота.';
  el.authPhoneStep.hidden = false;
  el.authCodeStep.hidden = true;
  showAuthError('');
}

function placePhoneCode(code, country) {
  authPhoneCode = code;
  if (el.authCountryName && el.authCountryCode && el.authCodePrefix) {
    el.authCountryName.textContent = country || 'Россия';
    el.authCountryCode.textContent = code;
    el.authCodePrefix.textContent = code;
  } else {
    el.authCodeBtn.textContent = code + ' ▾';
  }
  el.authCodeBtn.dataset.code = code;
}

el.authCodeBtn.addEventListener('click', () => {
  const options = PHONE_CODES.map((entry, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'phone-opt';
    option.dataset.index = index;
    option.innerHTML = `<span class="phone-opt__code">${entry.code}</span><span class="phone-opt__country">${entry.country}</span>`;
    option.addEventListener('click', () => {
      placePhoneCode(entry.code, entry.country);
      closeModal();
    });
    return option;
  });
  openModal('Выберите страну', options);
});

el.tabLogin.addEventListener('click', () => setAuthMode('login'));
el.tabRegister.addEventListener('click', () => setAuthMode('register'));

el.authNext.addEventListener('click', async () => {
  await requestAuthCode();
});

function formatPhoneMask(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 8));
  if (digits.length > 8) parts.push(digits.slice(8, 10));
  return parts.join(' ');
}

function applyPhoneMask() {
  const digitsOnly = el.authPhone.value.replace(/\D/g, '').slice(0, 10);
  const start = el.authPhone.selectionStart;
  const formatted = formatPhoneMask(el.authPhone.value);
  if (el.authPhone.value !== formatted) {
    el.authPhone.value = formatted;
  }
  el.authPhone.dataset.digits = digitsOnly;
}

el.authPhone.addEventListener('input', applyPhoneMask);
el.authPhone.addEventListener('keydown', event => {
  if (event.key === 'Enter') requestAuthCode();
});

async function requestAuthCode() {
  showAuthError('');
  const phone = authPhoneCode + el.authPhone.value.replace(/\D/g, '');
  if (phone.length < 8) {
    showAuthError('Введите номер телефона');
    return;
  }

  el.authNext.disabled = true;
  try {
    const data = await api('/api/auth/phone', { method: 'POST', body: { phone } });
    authCollectible = data.collectible;
    el.authPhoneStep.hidden = true;
    el.authCodeStep.hidden = false;
    el.authCode.focus();
    el.authError2.textContent = '';
  } catch (error) {
    showAuthError(error.message);
  } finally {
    el.authNext.disabled = false;
  }
}

function showPhoneStep() {
  el.authCodeStep.hidden = true;
  el.authPhoneStep.hidden = false;
  el.authPhone.focus();
  showAuthError('');
}

el.authBack.addEventListener('click', showPhoneStep);
el.authResend.addEventListener('click', () => {
  showAuthError('');
  requestAuthCode(false);
});

el.authForm.addEventListener('submit', async event => {
  event.preventDefault();
  const errorNode = el.authCodeStep.hidden ? el.authError : el.authError2;
  errorNode.textContent = '';

  const code = el.authCode.value.trim();
  const phone = authPhoneCode + el.authPhone.value.replace(/\D/g, '');

  if (!code) {
    errorNode.textContent = 'Введите код';
    return;
  }

  el.authSubmit.disabled = true;
  try {
    const displayName = el.authDisplay.value.trim();
    const data = await api('/api/auth/verify', { method: 'POST', body: { phone, code, displayName } });
    state.me = data.user;
    addOrUpdateAccount(data.user, data.token);
    el.authCode.value = '';
    el.authDisplay.value = '';
    await enterApp();
  } catch (error) {
    errorNode.textContent = error.message;
  } finally {
    el.authSubmit.disabled = false;
  }
}); 

function openAddNumberModal() {
  el.modalTitle.textContent = 'Добавить номер';
  el.modalBody.replaceChildren();

  const intro = document.createElement('div');
  intro.className = 'settings__note';
  intro.textContent = 'Выберите, что сделать с новым номером. Код придёт в Telegram-бота.';

  const actions = document.createElement('div');
  actions.className = 'auth__actions';

  const login = document.createElement('button');
  login.type = 'button';
  login.className = 'btn btn--primary';
  login.textContent = 'Войти в номер';
  login.addEventListener('click', () => openAddNumberFlow(false));

  const register = document.createElement('button');
  register.type = 'button';
  register.className = 'btn btn--ghost';
  register.textContent = 'Зарегистрироваться';
  register.addEventListener('click', () => openAddNumberFlow(true));

  actions.append(login, register);
  el.modalBody.append(intro, actions);
  el.modal.hidden = false;
}

function openAddNumberFlow(isRegister) {
  el.modalTitle.textContent = isRegister ? 'Новый номер' : 'Вход по номеру';
  el.modalBody.replaceChildren();

  const phoneField = document.createElement('label');
  phoneField.className = 'field';
  const phoneSpan = document.createElement('span');
  phoneSpan.textContent = 'Телефон';
  const codeRow = document.createElement('div');
  codeRow.className = 'phone-input';
  const codeBtn = document.createElement('button');
  codeBtn.type = 'button';
  codeBtn.className = 'phone-input__code';
  codeBtn.textContent = authPhoneCode + ' ▾';
  const phoneInput = document.createElement('input');
  phoneInput.type = 'tel';
  phoneInput.inputMode = 'tel';
  phoneInput.placeholder = '900 000-00-00';
  codeRow.append(codeBtn, phoneInput);
  phoneField.append(phoneSpan, codeRow);

  const displayField = document.createElement('label');
  displayField.className = 'field';
  displayField.hidden = !isRegister;
  const displaySpan = document.createElement('span');
  displaySpan.textContent = 'Как вас показывать';
  const displayInput = document.createElement('input');
  displayInput.placeholder = 'Имя';
  displayInput.maxLength = 40;
  displayField.append(displaySpan, displayInput);

  const err = document.createElement('div');
  err.className = 'auth__error';

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn--primary';
  submit.textContent = 'Продолжить';
  submit.addEventListener('click', async () => {
    err.textContent = '';
    const phone = codeBtn.textContent.split(' ')[0] + phoneInput.value.replace(/\D/g, '');
    if (phone.length < 8) {
      err.textContent = 'Введите номер телефона';
      return;
    }
    submit.disabled = true;
    try {
      const data = await api('/api/auth/phone', { method: 'POST', body: { phone } });
      openAddNumberCode(data.phone, data.collectible, data.exists, displayInput.value.trim(), isRegister);
    } catch (error) {
      err.textContent = error.message;
      submit.disabled = false;
    }
  });

  codeBtn.addEventListener('click', () => {
    const options = PHONE_CODES.map((entry, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'phone-opt';
      option.dataset.index = index;
      option.innerHTML = `<span class="phone-opt__code">${entry.code}</span><span class="phone-opt__country">${entry.country}</span>`;
      option.addEventListener('click', () => {
        codeBtn.textContent = entry.code + ' ▾';
        closeModal();
      });
      return option;
    });
    openModal('Выберите страну', options);
  });

  el.modalBody.append(phoneField, displayField, submit, err);
  el.modal.hidden = false;
  phoneInput.focus();
}

function openAddNumberCode(phone, collectible, exists, displayName, isRegister) {
  el.modalTitle.textContent = 'Введите код';
  el.modalBody.replaceChildren();

  if (collectible) {
    const coll = document.createElement('div');
    coll.className = 'settings__note';
    coll.textContent = `Это коллекционный номер — ${phone}`;
    el.modalBody.append(coll);
  }

  const field = document.createElement('label');
  field.className = 'field';
  const span = document.createElement('span');
  span.textContent = 'Код из сообщения';
  const codeInput = document.createElement('input');
  codeInput.type = 'text';
  codeInput.inputMode = 'numeric';
  codeInput.placeholder = '• • • • •';
  field.append(span, codeInput);

  const err = document.createElement('div');
  err.className = 'auth__error';

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'btn btn--primary';
  submit.textContent = 'Подтвердить';
  submit.addEventListener('click', async () => {
    err.textContent = '';
    const code = codeInput.value.trim();
    if (!code) {
      err.textContent = 'Введите код';
      return;
    }
    submit.disabled = true;
    try {
      const data = await api('/api/auth/verify', { method: 'POST', body: { phone, code, displayName } });
      state.me = data.user;
      addOrUpdateAccount(data.user, data.token);
      closeModal();
      await enterApp();
    } catch (error) {
      err.textContent = error.message;
      submit.disabled = false;
    }
  });

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'link-btn';
  back.textContent = '← Сменить номер';
  back.addEventListener('click', () => openAddNumberFlow(isRegister));

  el.modalBody.append(field, submit, back, err);
  el.modal.hidden = false;
  codeInput.focus();
}

async function doLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch {
    /* выходим в любом случае */
  }

  if (state.ws) {
    state.ws.onclose = null;
    state.ws.close();
    state.ws = null;
  }

  Object.assign(state, {
    me: null,
    identity: null,
    fingerprint: '',
    users: [],
    chats: [],
    messages: [],
    currentChatId: null,
    dividerId: null
  });
  keyCache.clear();

  el.settings.hidden = true;
  el.profile.hidden = true;
  el.chatInfo.hidden = true;
  el.app.hidden = true;
  el.auth.hidden = false;
  setAuthMode('login');
}

/* ---------- Загрузка ---------- */

function applySelfProfile() {
  el.meName.textContent = state.me.displayName;
  el.meUsername.textContent = state.me.username ? '@' + state.me.username : 'имя не назначено';
  el.menuName.textContent = state.me.displayName;
  el.menuEmoji.textContent = state.me.bio || 'Установить статус';

  el.menuAdmin.hidden = !state.me.isAdmin;

  for (const node of [el.meAvatar, el.menuAvatar]) {
    node.style.background = 'linear-gradient(135deg, #5b8cff, #8b5cf6)';
    node.style.backgroundImage = 'none';
    node.textContent = initials(state.me.displayName);

    if (state.me.avatar) {
      node.textContent = '';
      node.style.backgroundImage = `url("${state.me.avatar}")`;
      node.style.backgroundSize = 'cover';
      node.style.backgroundPosition = 'center';
    }
  }
}

async function enterApp() {
  el.auth.hidden = true;
  el.app.hidden = false;
  applySelfProfile();

  try {
    await ensureIdentity();
  } catch (error) {
    toast('Шифрование недоступно в этом браузере: ' + error.message);
  }

  await Promise.all([loadUsers(), loadChats()]);
  connectWs();
}

async function loadUsers() {
  const data = await api('/api/users');
  state.users = data.users;
  renderPeople();
}

async function loadChats() {
  const data = await api('/api/chats');
  state.chats = data.chats;
  renderChats();
}

/* ---------- Люди ---------- */

function joinCandidate(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^@[a-zA-Z0-9_]{4,32}$/.test(value)) return value.slice(1);
  if (/^wm\.me\/(@?[a-zA-Z0-9_-]+)/i.test(value)) return value.replace(/^wm\.me\//i, '').replace(/^@/, '');
  if (/^(?:t\.me|https?:\/\/t\.me)\//i.test(value)) return value.replace(/^(?:t\.me|https?:\/\/t\.me)\//i, '').replace(/^@/, '');
  if (/^[a-zA-Z0-9_-]{16,64}$/.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value.replace(/^.*\//, '').replace(/^@/, '');
  return null;
}

async function joinByLink(link) {
  try {
    const data = await api('/api/join', { method: 'POST', body: { link } });
    el.search.value = '';
    renderPeople();
    filterChatRows();
    await loadChats();
    await openChat(data.chat.id);
    toast('Вы присоединились');
  } catch (error) {
    toast(error.message);
  }
}

function renderPeople() {
  const query = el.search.value.trim().toLowerCase();
  el.peopleList.replaceChildren();

  if (!query && !state.showAllPeople) {
    el.peopleBlock.hidden = true;
    el.chatsTitle.hidden = false;
    return;
  }

  el.peopleBlock.hidden = false;
  el.chatsTitle.hidden = true;

  const candidate = joinCandidate(el.search.value);
  if (candidate) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row row--join';

    const icon = document.createElement('div');
    icon.className = 'avatar avatar--ghost';
    icon.textContent = '+';

    const body = document.createElement('div');
    body.className = 'row__body';

    const title = document.createElement('div');
    title.className = 'row__title';
    title.textContent = 'Присоединиться';

    const preview = document.createElement('div');
    preview.className = 'row__preview';
    preview.textContent = candidate;

    body.append(title, preview);
    row.append(icon, body);
    row.addEventListener('click', () => joinByLink(candidate));
    el.peopleList.append(row);
  }

  const found = state.users
    .filter(user => {
      const haystack = `${user.displayName} ${user.username}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0));

  if (!found.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Никого не нашли';
    el.peopleList.append(empty);
    return;
  }

  for (const user of found.slice(0, 25)) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    applyAvatar(avatar, user.displayName, user.id, user.online, user.avatar);

    const body = document.createElement('div');
    body.className = 'row__body';
    const title = document.createElement('div');
    title.className = 'row__title';
    title.textContent = user.displayName;
    appendVerified(title, user.verified);
    const preview = document.createElement('div');
    preview.className = 'row__preview';
    preview.textContent = user.username ? '@' + user.username : (user.phone || user.displayName);
    body.append(title, preview);

    row.append(avatar, body);
    row.addEventListener('click', () => openChatWith(user.id));
    el.peopleList.append(row);
  }
}

el.search.addEventListener('input', () => {
  state.showAllPeople = false;
  renderPeople();
  filterChatRows();
});

el.archiveRow.addEventListener('click', () => {
  state.showArchive = !state.showArchive;
  el.search.value = '';
  renderPeople();
  renderChats();
});

function filterChatRows() {
  const query = el.search.value.trim().toLowerCase();
  for (const row of el.chatList.querySelectorAll('.row')) {
    const title = (row.dataset.title || '').toLowerCase();
    row.hidden = Boolean(query) && !title.includes(query);
  }
}

/* ---------- Чаты ---------- */

function renderChats() {
  el.chatList.replaceChildren();

  const archived = state.chats.filter(c => c.isArchived);
  el.archiveRow.hidden = archived.length === 0;
  el.archiveBadge.textContent = archived.length > 99 ? '99+' : String(archived.length);
  el.archiveRow.setAttribute('aria-pressed', String(state.showArchive));

  const visible = state.chats.filter(c => {
    if (state.showArchive) return c.isArchived;
    return !c.isArchived || c.id === state.currentChatId;
  });
  el.chatsEmpty.hidden = visible.length > 0;
  el.chatsTitle.textContent = state.showArchive ? 'Архив' : 'Чаты';

  for (const chat of visible) {
    const isDirect = chat.kind === 'direct';
    const title = isDirect ? (chat.peer ? chat.peer.displayName : 'Чат') : chat.title;
    const peer = isDirect && chat.peer ? userById(chat.peer.id) : null;
    const online = peer ? peer.online : false;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row' + (chat.id === state.currentChatId ? ' is-active' : '');
    row.dataset.chatId = String(chat.id);
    row.dataset.title = title;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    applyAvatar(avatar, title, chat.peer ? chat.peer.id : chat.id, online, isDirect ? (chat.peer ? chat.peer.avatar : null) : chat.avatar);

    const body = document.createElement('div');
    body.className = 'row__body';
    const name = document.createElement('div');
    name.className = 'row__title';
    name.textContent = title;
    appendVerified(name, isDirect ? (chat.peer ? chat.peer.verified : false) : chat.verified);
    const preview = document.createElement('div');
    preview.className = 'row__preview';
    preview.textContent = isDirect ? 'Нет сообщений' : `${chatKindLabel(chat.kind)} · ${chat.memberCount}`;
    body.append(name, preview);

    if (chat.isPinned) {
      const pinIcon = document.createElement('div');
      pinIcon.className = 'row__pinicon';
      pinIcon.textContent = '📌';
      pinIcon.title = 'Закреплено';
      preview.prepend(pinIcon);
    }

    const meta = document.createElement('div');
    meta.className = 'row__meta';
    if (chat.lastMessage) {
      const time = document.createElement('div');
      time.className = 'row__time';
      time.textContent = listTime(chat.lastMessage.createdAt);
      meta.append(time);
    }
    if (chat.unread > 0) {
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = chat.unread > 99 ? '99+' : String(chat.unread);
      meta.append(badge);
    }

    row.append(avatar, body, meta);
    row.addEventListener('click', () => openChat(chat.id));
    el.chatList.append(row);

    if (chat.lastMessage) {
      const own = chat.lastMessage.senderId === state.me.id;
      const raw = chat.lastMessage.body;
      if (raw.startsWith(E2E_PREFIX)) {
        preview.textContent = own ? 'Вы: …' : '…';
        decryptBody(chat.id, raw).then(text => {
          if (preview.isConnected) preview.textContent = (own ? 'Вы: ' : '') + text;
        });
      } else {
        preview.textContent = (own ? 'Вы: ' : '') + raw;
      }
    }
  }

  filterChatRows();
}

/* ---------- Открытие чата ---------- */

async function openChatWith(userId) {
  try {
    const data = await api('/api/chats', { method: 'POST', body: { userId } });
    await loadChats();
    el.search.value = '';
    renderPeople();
    await openChat(data.chat.id);
  } catch (error) {
    toast(error.message);
  }
}

async function openChat(chatId) {
  const chat = chatById(chatId);
  if (!chat) return;

  state.currentChatId = chatId;
  state.messages = [];
  state.exhausted = false;
  state.loadingOlder = false;
  state.dividerId = null;
  state.replyTo = null;
  renderReplyBar();

  el.placeholder.hidden = true;
  el.app.classList.add('is-chat-open');
  updateHeader(chat);
  renderPinned(chat);
  renderChats();

  el.messageList.replaceChildren();
  el.jump.hidden = true;

  let loaded = [];
  try {
    const data = await api(`/api/chats/${chatId}/messages`);
    loaded = data.messages;
  } catch (error) {
    toast(error.message);
    return;
  }

  state.messages = loaded;
  state.exhausted = loaded.length < PAGE_SIZE;

  if (chat.unread > 0 && chat.lastReadId >= 0) {
    const firstUnread = loaded.find(message => message.id > chat.lastReadId && message.senderId !== state.me.id);
    if (firstUnread) state.dividerId = firstUnread.id;
  }

  await renderAll();

  if (state.dividerId) {
    const divider = el.messageList.querySelector('.unread-divider');
    if (divider) divider.scrollIntoView({ block: 'center' });
    else scrollBottom();
  } else {
    scrollBottom();
  }

  if (chat.lastMessage) markRead(chatId, chat.lastMessage.id);

  const readOnly = chat.kind === 'channel' && !chat.canManage;
  el.input.disabled = readOnly;
  const isChannelAdmin = chat.kind === 'channel' && chat.canManage;
  el.input.placeholder = isChannelAdmin ? 'Публикация...' : (readOnly ? 'Писать могут только администраторы' : 'Написать сообщение');
  el.pollBtn.hidden = !isChannelAdmin;
  el.input.value = getDraft(chatId);
  autoGrow();
  updateCounter();

  el.input.focus();
}

el.back.addEventListener('click', () => {
  el.app.classList.remove('is-chat-open');
});

function updateHeader(chat) {
  const isDirect = chat.kind === 'direct';
  const title = isDirect ? (chat.peer ? chat.peer.displayName : 'Чат') : chat.title;
  const peer = isDirect && chat.peer ? userById(chat.peer.id) : null;
  el.peerName.replaceChildren();
  if (peer && peer.statusEmoji) {
    const semoji = document.createElement('span');
    semoji.className = 'status-emoji';
    semoji.textContent = peer.statusEmoji;
    el.peerName.append(semoji);
  }
  el.peerName.appendChild(document.createTextNode(title));
  appendVerified(el.peerName, isDirect ? (chat.peer ? chat.peer.verified : false) : chat.verified);

  applyAvatar(el.peerAvatar, title, isDirect && chat.peer ? chat.peer.id : chat.id, peer ? peer.online : false, isDirect ? (peer ? peer.avatar : null) : chat.avatar);

  setStatus(isDirect
    ? lastSeenText(peer)
    : `${chat.memberCount} ${membersWord(chat.memberCount, chat.kind === 'channel')}`);

  el.chatLock.hidden = true;
  el.chatInfoBtn.hidden = isDirect;
  el.chatSearchBtn.hidden = false;
  closeChatSearch();
}

function setStatus(text, typing = false) {
  el.peerStatus.textContent = text;
  el.peerStatus.classList.toggle('is-typing', typing);
}

function renderPinned(chat) {
  if (!chat.pinnedMessage) {
    el.pinned.hidden = true;
    return;
  }
  const message = chat.pinnedMessage;
  const previewText = message.senderId === state.me.id ? 'Вы: ' : '';
  const text = (message.body.startsWith(E2E_PREFIX) ? '[зашифровано]' : message.body);
  el.pinnedBody.textContent = previewText + text;
  el.pinnedLabel.textContent = chat.kind === 'channel' ? 'Закреплённое сообщение' : 'Закреплено';
  el.pinnedComment.hidden = chat.kind !== 'channel';
  el.pinnedShare.hidden = chat.kind !== 'channel';
  el.pinned.hidden = false;
}

/* ---------- Отрисовка сообщений ---------- */

async function renderAll() {
  el.messageList.replaceChildren();
  state.render = { day: null, sender: null, time: 0 };

  for (let i = 0; i < state.messages.length; i++) {
    const message = state.messages[i];

    if (message.mediaGroupId && !!state.messages[i + 1] && state.messages[i + 1].mediaGroupId === message.mediaGroupId) {
      const group = [message];
      let j = i + 1;
      while (j < state.messages.length && state.messages[j].mediaGroupId === message.mediaGroupId) {
        group.push(state.messages[j]);
        j++;
      }
      const first = group[0];
      appendDayIfNeeded(first.createdAt);
      await appendAlbum(group, first);
      i = j - 1;
      continue;
    }

    appendDayIfNeeded(message.createdAt);

    if (state.dividerId && message.id === state.dividerId) {
      const divider = document.createElement('div');
      divider.className = 'unread-divider';
      divider.textContent = 'Непрочитанные';
      el.messageList.append(divider);
      state.render.sender = null;
    }

    await appendBubble(message);
  }
}

async function reRenderMessages() {
  const prevHeight = el.messages.scrollHeight;
  const prevTop = el.messages.scrollTop;
  await renderAll();
  el.messages.scrollTop = el.messages.scrollHeight - prevHeight + prevTop;
}

function appendDayIfNeeded(ts) {
  const key = dayKey(ts);
  if (state.render.day === key) return;

  const divider = document.createElement('div');
  divider.className = 'day';
  divider.textContent = dayLabel(ts);
  el.messageList.append(divider);

  state.render.day = key;
  state.render.sender = null;
  state.render.time = 0;
}

async function appendBubble(message) {
  const currentChat = chatById(state.currentChatId);

  if (message.kind === 'service' && message.body) {
    const chip = document.createElement('div');
    chip.className = 'service-chip';
    const wrapped = message.body;
    const cap = document.createElement('span');
    cap.className = 'service-chip__text';
    cap.textContent = wrapped;
    chip.append(cap);
    el.messageList.append(chip);
    state.render.sender = message.senderId;
    state.render.time = message.createdAt;
    return;
  }

  const plain = await decryptBody(state.currentChatId, message.body);

  const anyChat = !currentChat || currentChat.kind === 'direct' || currentChat.kind === 'saved';
  const own = message.senderId === state.me.id;
  const isGroup = Boolean(currentChat && currentChat.kind === 'group');
  const isChannel = Boolean(currentChat && currentChat.kind === 'channel');
  const grouped = state.render.sender === message.senderId
    && message.createdAt - state.render.time < GROUP_GAP_MS;

  const row = document.createElement('div');
  row.className = 'msg-row'
    + (grouped ? ' msg-row--grouped' : '');

  if (isGroup && !own) {
    const side = document.createElement('div');
    side.className = 'msg-row__side';

    if (!grouped) {
      const avatar = document.createElement('div');
      avatar.className = 'avatar avatar--msg';
      applyAvatar(avatar, message.senderName || '?', message.senderId, false, message.senderAvatar);
      side.append(avatar);
    }

    row.append(side);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg'
    + (own && !isChannel ? ' msg--own' : '')
    + (grouped ? ' msg--grouped' : '');
  bubble.dataset.id = String(message.id);

  if (message.forwardedFrom) {
    const marker = document.createElement('div');
    marker.className = 'msg__forwarded';
    marker.textContent = '↪ переслано';
    bubble.append(marker);
  }

  if (isGroup && !grouped) {
    const sender = document.createElement('div');
    sender.className = 'msg__sender';
    sender.style.color = colorFor(message.senderId);
    sender.textContent = message.senderName || '?';
    if (message.senderRole === 'owner' || message.senderRole === 'admin') {
      const roleLabel = document.createElement('span');
      roleLabel.className = 'msg__role';
      roleLabel.textContent = message.senderRole === 'owner' ? ' владелец' : ' админ';
      sender.append(roleLabel);
    }
    bubble.append(sender);
  } else if (isChannel && currentChat && currentChat.title) {
    const sender = document.createElement('div');
    sender.className = 'msg__sender';
    sender.style.color = colorFor(currentChat.id);
    sender.textContent = currentChat.title;
    bubble.append(sender);
  }

  const text = document.createElement('div');
  text.className = 'msg__text';

  if (message.replyToId) {
    const quoted = messageById(message.replyToId);
    if (quoted) {
      const replyBlock = document.createElement('button');
      replyBlock.type = 'button';
      replyBlock.className = 'msg__reply-quote';
      const qName = document.createElement('div');
      qName.className = 'msg__reply-name';
      qName.textContent = quoted.senderId === state.me.id ? 'Вы' : (quoted.senderName || 'Пользователь');
      const qText = document.createElement('div');
      qText.className = 'msg__reply-text';
      qText.textContent = replyPreviewText(quoted);
      replyBlock.append(qName, qText);
      replyBlock.addEventListener('click', () => {
        const node = el.messageList.querySelector(`[data-id="${quoted.id}"]`);
        if (node) (node.closest('.msg-row') || node).scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
      bubble.append(replyBlock);
    }
  }

  if (message.kind !== 'text' && message.kind !== 'voice' && message.kind !== 'contact') {
    renderAttachment(bubble, message);
    if (message.caption) {
      const cap = document.createElement('div');
      cap.className = 'msg__caption';
      appendRichText(cap, message.caption);
      bubble.append(cap);
    }
  } else if (message.kind === 'voice') {
    bubble.classList.add('msg--voice');
  } else if (message.kind === 'contact') {
    renderContact(bubble, message);
  } else if (plain === DECRYPT_FAILED) {
    text.classList.add('msg__text--locked');
    const mark = document.createElement('span');
    mark.className = 'msg__lock';
    mark.textContent = 'Зашифровано';
    text.append(mark);
  } else {
    appendRichText(text, plain);
  }
  bubble.append(text);

  if (message.pollOptions) renderPoll(bubble, message);

  const meta = document.createElement('div');
  meta.className = 'msg__meta';

  if (currentChat && currentChat.kind === 'channel') {
    const views = document.createElement('span');
    views.className = 'msg__views';
    views.innerHTML = EYE_SVG;
    views.append(document.createTextNode(String(message.views || 0)));
    meta.append(views);
  }

  if (message.edited) {
    const edited = document.createElement('span');
    edited.className = 'msg__edited';
    edited.textContent = 'изменено';
    edited.title = 'Сообщение было отредактировано';
    meta.append(edited);
  }

  const time = document.createElement('time');
  time.className = 'msg__time';
  time.textContent = hhmm(message.createdAt);
  meta.append(time);

  if (own && !isChannel) {
    const read = currentChat ? message.id <= (currentChat.peerLastReadId || 0) : false;
    const tick = document.createElement('span');
    tick.className = 'tick';
    tick.dataset.state = read ? 'read' : 'sent';
    tick.innerHTML = read ? TICK_READ : TICK_SENT;
    meta.append(tick);
  }

  if (message.kind === 'voice') voiceBubble(bubble, message);
  bubble.append(meta);

  if (isChannel && currentChat && currentChat.discussionId) {
    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'msg__comments';
    const count = String(message.commentCount || 0);
    commentBtn.innerHTML = `<span class="msg__comments-count">${count} комментари${commentWord(count)}</span><span class="msg__comments-arrow"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    commentBtn.addEventListener('click', event => {
      event.stopPropagation();
      openChat(currentChat.discussionId);
    });
    bubble.append(commentBtn);
  }

  const canDelete = own || (currentChat && currentChat.canManage);
  const canPin = Boolean(currentChat && currentChat.canManage && currentChat.kind !== 'direct');
  const canForward = true;

  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.className = 'msg__delete msg__reply';
  replyBtn.style.top = '26px';
  replyBtn.title = 'Ответить';
  replyBtn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M3 10l7-6v4c7 0 11 3 11 9h-2c0-4-3-5-9-5v4l-7-6z" fill="currentColor"/></svg>';
  replyBtn.addEventListener('click', event => {
    event.stopPropagation();
    startReply(message);
  });
  bubble.append(replyBtn);

  if (canForward) {
    const fwd = document.createElement('button');
    fwd.type = 'button';
    fwd.className = 'msg__delete msg__forward';
    fwd.style.top = '26px';
    fwd.title = 'Переслать';
    fwd.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 12l16-8-6 8 6 8-16-8z" fill="currentColor"/></svg>';
    fwd.addEventListener('click', event => {
      event.stopPropagation();
      openForwardDialog(state.currentChatId, message);
    });
    bubble.append(fwd);
  }
  const canEdit = own && !message.body.startsWith(E2E_PREFIX);

  if (canEdit) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'msg__delete';
    edit.style.top = '26px';
    edit.title = 'Редактировать';
    edit.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
    edit.addEventListener('click', event => {
      event.stopPropagation();
      startEdit(state.currentChatId, message);
    });
    bubble.append(edit);
  }

  if (canDelete) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'msg__delete';
    del.setAttribute('aria-label', 'Удалить сообщение');
    del.title = 'Удалить';
    del.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    del.addEventListener('click', event => {
      event.stopPropagation();
      deleteClientMessage(state.currentChatId, message);
    });
    bubble.append(del);
  }

  if (canPin) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'msg__delete msg__pin';
    pin.setAttribute('aria-label', 'Закрепить сообщение');
    pin.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M15 4l5 5-7 7H7l-4 4 4-4v-6l8-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    pin.addEventListener('click', async event => {
      event.stopPropagation();
      const isPinned = currentChat.pinnedMessageId === message.id;
      const next = isPinned ? null : message.id;
      try {
        await api(`/api/chats/${state.currentChatId}`, { method: 'PATCH', body: { pinnedMessageId: next } });
        const chat = chatById(state.currentChatId);
        if (chat) {
          chat.pinnedMessageId = next;
          chat.pinnedMessage = next ? message : null;
        }
        renderPinned(chatById(state.currentChatId));
        toast(isPinned ? 'Закрепление снято' : 'Сообщение закреплено');
      } catch (error) {
        toast(error.message);
      }
    });
    bubble.append(pin);
  }

  attachReactions(bubble, message);

  row.addEventListener('contextmenu', event => {
    event.preventDefault();
    openMessageMenu(event.clientX, event.clientY, message, { own, isChannel, currentChat });
  });
  let longPressTimer = null;
  row.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const x = event.clientX, y = event.clientY;
    longPressTimer = setTimeout(() => {
      openMessageMenu(x, y, message, { own, isChannel, currentChat });
    }, 500);
  });
  const cancelLongPress = () => { clearTimeout(longPressTimer); };
  row.addEventListener('pointerup', cancelLongPress);
  row.addEventListener('pointermove', cancelLongPress);
  row.addEventListener('pointerleave', cancelLongPress);

  row.append(bubble);
  el.messageList.append(row);

  state.render.sender = message.senderId;
  state.render.time = message.createdAt;
}

function attachReactions(bubble, message) {
  const reactionsWrap = document.createElement('div');
  reactionsWrap.className = 'msg__reactions';

  const quick = document.createElement('div');
  quick.className = 'msg__quick';

  const quickRow = document.createElement('div');
  quickRow.className = 'msg__quick-row';
  for (const emoji of REACTIONS_QUICK) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msg__quickbtn';
    button.append(emojiNode(emoji, 'react-img'));
    button.addEventListener('click', event => {
      event.stopPropagation();
      toggleReaction(state.currentChatId, message, emoji);
    });
    quickRow.append(button);
  }

  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'msg__quickmore msg__quick-more';
  more.textContent = '＋';
  more.title = 'Все реакции';
  const allRow = document.createElement('div');
  allRow.className = 'msg__quick-all';
  allRow.hidden = true;
  for (const emoji of REACTIONS_ALL) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'msg__quickbtn';
    button.append(emojiNode(emoji, 'react-img'));
    button.addEventListener('click', event => {
      event.stopPropagation();
      toggleReaction(state.currentChatId, message, emoji);
    });
    allRow.append(button);
  }
  more.addEventListener('click', event => {
    event.stopPropagation();
    allRow.hidden = !allRow.hidden;
    more.textContent = allRow.hidden ? '＋' : '−';
  });

  quick.append(quickRow, more, allRow);

  const chips = document.createElement('div');
  chips.className = 'msg__chips';
  renderChips(chips, message);

  reactionsWrap.append(quick, chips);
  bubble.append(reactionsWrap);

  bubble.addEventListener('click', event => {
    if (event.target.closest('a, button, audio, video, .msg__quick, .msg__chip, input')) return;
    const wasOpen = bubble.classList.contains('msg--react-open');
    el.messageList.querySelectorAll('.msg--react-open').forEach(node => node.classList.remove('msg--react-open'));
    if (!wasOpen) bubble.classList.add('msg--react-open');
  });
}

async function appendAlbum(group, first) {
  const currentChat = chatById(state.currentChatId);
  const own = first.senderId === state.me.id;
  const isGroup = Boolean(currentChat && currentChat.kind === 'group');

  const row = document.createElement('div');
  row.className = 'msg-row';

  if (isGroup && !own) {
    const side = document.createElement('div');
    side.className = 'msg-row__side';
    const avatar = document.createElement('div');
    avatar.className = 'avatar avatar--msg';
    applyAvatar(avatar, first.senderName || '?', first.senderId, false, first.senderAvatar);
    side.append(avatar);
    row.append(side);
  }

  const bubble = document.createElement('div');
  bubble.className = 'msg msg--album' + (own && currentChat && currentChat.kind !== 'channel' ? ' msg--own' : '');
  bubble.dataset.album = first.mediaGroupId;

  if (isGroup && !own) {
    const sender = document.createElement('div');
    sender.className = 'msg__sender';
    sender.style.color = colorFor(first.senderId);
    sender.textContent = first.senderName || '?';
    if (first.senderRole === 'owner' || first.senderRole === 'admin') {
      const roleLabel = document.createElement('span');
      roleLabel.className = 'msg__role';
      roleLabel.textContent = first.senderRole === 'owner' ? ' владелец' : ' админ';
      sender.append(roleLabel);
    }
    bubble.append(sender);
  }

  const grid = document.createElement('div');
  grid.className = 'album-grid album-grid--' + Math.min(3, group.length);

  for (const m of group) {
    if (!m.attachment) continue;
    const cell = document.createElement('div');
    cell.className = 'album-grid__cell';

    const img = document.createElement('img');
    img.className = 'album-grid__img';
    img.src = mediaUrl(m.attachment);
    img.alt = m.caption || '';
    img.loading = 'lazy';
    img.addEventListener('click', event => {
      event.stopPropagation();
      openFullscreen(mediaUrl(m.attachment), 'image');
    });

    cell.append(img);
    grid.append(cell);
  }

  bubble.append(grid);

  if (group[group.length - 1] && group[group.length - 1].caption) {
    const cap = document.createElement('div');
    cap.className = 'msg__caption';
    appendRichText(cap, group[group.length - 1].caption);
    bubble.append(cap);
  }

  const meta = document.createElement('div');
  meta.className = 'msg__meta';
  meta.textContent = hhmm(first.createdAt);
  bubble.append(meta);

  const last = group[group.length - 1] || first;
  attachReactions(bubble, last);

  row.append(bubble);
  el.messageList.append(row);

  state.render.sender = first.senderId;
  state.render.time = first.createdAt;
}

function removeLocalMessage(chatId, messageId) {
  state.messages = state.messages.filter(message => message.id !== messageId);

  const node = el.messageList.querySelector(`[data-id="${messageId}"]`);
  const row = node ? node.closest('.msg-row') : null;
  if (row) row.remove();

  loadChats().catch(() => {});
}

function deleteClientMessage(chatId, message) {
  confirmAction({
    title: 'Удалить сообщение',
    text: 'Сообщение будет удалено у всех участников.',
    confirmText: 'Удалить'
  }, async () => {
    try {
      await api(`/api/chats/${chatId}/messages/${message.id}`, { method: 'DELETE' });
      removeLocalMessage(chatId, message.id);
      toast('Сообщение удалено');
    } catch (error) {
      toast(error.message);
    }
  });
}

function renderChips(container, message) {
  container.replaceChildren();
  const entries = Object.entries(message.reactions || {});
  if (!entries.length) return;

  for (const [emoji, count] of entries) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'msg__chip' + (message.myReaction === emoji ? ' is-mine' : '');
    chip.append(emojiNode(emoji, 'react-img react-img--chip'));
    chip.append(document.createTextNode(' ' + count));
    chip.addEventListener('click', event => {
      event.stopPropagation();
      toggleReaction(state.currentChatId, message, emoji);
    });
    container.append(chip);
  }
}

function renderPoll(bubble, message) {
  const options = message.pollOptions || [];
  if (!options.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'poll';
  const title = document.createElement('div');
  title.className = 'poll__title';
  title.textContent = message.pollQuestion || 'Опрос';
  wrap.append(title);

  const votes = {};
  let total = 0;
  for (const row of (message.pollCounts || [])) {
    votes[row.option_index] = row.n;
    total += row.n;
  }

  const statusRow = document.createElement('div');
  statusRow.className = 'poll__status';
  statusRow.textContent = `${total} ${commentWord(total)} ›`;
  wrap.append(statusRow);

  for (let i = 0; i < options.length; i += 1) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'poll__option';
    option.dataset.index = String(i);
    option.addEventListener('click', event => {
      event.stopPropagation();
      votePoll(message, i);
    });

    const text = document.createElement('span');
    text.className = 'poll__option-text';
    text.textContent = options[i];
    option.append(text);
    wrap.append(option);
  }

  bubble.append(wrap);
}

async function votePoll(message, optionIndex) {
  try {
    const data = await api(`/api/chats/${message.chatId}/messages/${message.id}/poll`, {
      method: 'POST',
      body: { optionIndex }
    });
    applyPollResults(message.id, data.poll);
  } catch (error) {
    toast(error.message);
  }
}

function applyPollResults(messageId, poll) {
  const message = messageById(messageId);
  if (!message) return;
  message.pollCounts = Object.entries(poll.counts || {}).map(([option_index, n]) => ({ option_index: Number(option_index), n }));
  message.pollTotal = poll.total || 0;
  message.pollMine = poll.mine;
  const node = el.messageList.querySelector(`[data-id="${messageId}"]`);
  if (node) {
    const old = node.querySelector('.poll');
    if (old) old.remove();
    const bubble = node.querySelector('.msg');
    if (bubble) renderPoll(bubble, message);
  }
}

function refreshPoll(messageId) {
  (async () => {
    const message = messageById(messageId);
    if (!message || !state.currentChatId) return;
    if (state.currentChatId !== message.chatId) return;
    try {
      const data = await api(`/api/chats/${message.chatId}/messages/${messageId}/poll`, { method: 'GET' });
      applyPollResults(messageId, data.poll);
    } catch {
      /* проигнорировать */
    }
  })();
}

function messageById(id) {
  return state.messages.find(message => message.id === id) || null;
}

function startEdit(chatId, message) {
  state.editing = { chatId, messageId: message.id };
  el.input.value = message.body;
  el.input.dataset.editing = '1';
  autoGrow();
  updateCounter();
  el.input.focus();
  toast('Редактирование — нажмите «Отправить»');
}

function cancelEdit() {
  state.editing = null;
  delete el.input.dataset.editing;
  if (state.currentChatId) {
    el.input.value = getDraft(state.currentChatId);
    autoGrow();
    updateCounter();
  }
}

function startReply(message) {
  state.replyTo = message;
  renderReplyBar();
  el.input.focus();
}

function cancelReply() {
  state.replyTo = null;
  renderReplyBar();
}

function replyPreviewText(message) {
  if (!message) return '';
  if (message.kind === 'voice') return '[голосовое сообщение]';
  if (message.kind === 'contact') return '[контакт]';
  if (message.kind === 'image') return message.caption || '[фото]';
  if (message.kind === 'video') return message.caption || '[видео]';
  if (message.kind === 'audio') return message.caption || '[аудио]';
  if (message.kind === 'file') return message.fileName || message.caption || '[файл]';
  return message.body;
}

function renderReplyBar() {
  const message = state.replyTo;
  if (!message) {
    el.replyBar.hidden = true;
    return;
  }
  const name = message.senderId === state.me.id ? 'Вы' : (message.senderName || 'Пользователь');
  el.replyBarTitle.textContent = name;
  el.replyBarText.textContent = replyPreviewText(message);
  el.replyBar.hidden = false;
}

function currentReplyTarget() {
  return state.replyTo && messageById(state.replyTo.id) ? state.replyTo : null;
}

function refreshReactionChips(messageId) {
  const container = el.messageList.querySelector(`[data-id="${messageId}"] .msg__chips`);
  if (!container) return;
  const message = messageById(messageId);
  if (message) renderChips(container, message);
}

async function toggleReaction(chatId, message, emoji) {
  const current = message.myReaction;
  try {
    if (current === emoji) {
      await api(`/api/chats/${chatId}/messages/${message.id}/reactions`, { method: 'DELETE' });
      message.myReaction = null;
      if (message.reactions[emoji]) message.reactions[emoji] -= 1;
      if (message.reactions[emoji] <= 0) delete message.reactions[emoji];
    } else {
      if (current && message.reactions[current]) {
        message.reactions[current] -= 1;
        if (message.reactions[current] <= 0) delete message.reactions[current];
      }
      message.reactions[emoji] = (message.reactions[emoji] || 0) + 1;
      message.myReaction = emoji;
      await api(`/api/chats/${chatId}/messages/${message.id}/reactions`, { method: 'POST', body: { emoji } });
    }
    refreshReactionChips(message.id);
  } catch (error) {
    toast(error.message);
  }
}

function shareContactToChat(user, userId) {
  openFormModal('Поделиться контактом', form => {
    const select = document.createElement('select');
    select.className = 'forward-select';

    const ownChats = state.chats.filter(item => item.id !== (state.currentChatId || -1));
    for (const chat of ownChats) {
      const option = document.createElement('option');
      option.value = String(chat.id);
      option.textContent = chat.title || (chat.peer ? chat.peer.displayName : 'Чат');
      select.append(option);
    }

    if (!ownChats.length) {
      select.append(Object.assign(document.createElement('option'), { value: '', textContent: 'Нет чатов' }));
      select.disabled = true;
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = 'Отправить';
    submit.disabled = ownChats.length === 0;

    form.append(settingsField('В чат', select), submit);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!select.value) return;
      submit.disabled = true;
      try {
        const contact = {
          name: user.displayName,
          username: user.username,
          phone: user.phone || '',
          id: userId
        };
        const data = await api(`/api/chats/${select.value}/messages`, {
          method: 'POST',
          body: {
            body: '',
            kind: 'contact',
            attachment: JSON.stringify(contact)
          }
        });
        closeModal();
        toast('Контакт отправлен');
        if (Number(select.value) === state.currentChatId) {
          await handleIncomingMessage(state.currentChatId, data.message);
        }
      } catch (error) {
        toast(error.message);
        submit.disabled = false;
      }
    });
  });
}

function openForwardDialog(chatId, message) {
  openFormModal('Переслать', form => {
    const select = document.createElement('select');
    select.className = 'forward-select';

    const ownChats = state.chats.filter(item => item.id !== chatId && item.kind !== 'direct');
    for (const chat of ownChats) {
      const option = document.createElement('option');
      option.value = String(chat.id);
      option.textContent = chat.title || (chat.peer ? chat.peer.displayName : 'Чат');
      select.append(option);
    }

    if (!ownChats.length) {
      select.append(Object.assign(document.createElement('option'), { value: '', textContent: 'Нет чатов для пересылки' }));
      select.disabled = true;
    }

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = 'Переслать';
    submit.disabled = ownChats.length === 0;

    form.append(settingsField('В чат', select), submit);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!select.value) return;
      submit.disabled = true;
      try {
        await api(`/api/chats/${chatId}/messages/${message.id}/forward`, {
          method: 'POST',
          body: { chatId: Number(select.value) }
        });
        closeModal();
        toast('Сообщение переслано');
      } catch (error) {
        toast(error.message);
        submit.disabled = false;
      }
    });
  });
}

function b64toBlob(base64, mime = 'audio/webm') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToB64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Ошибка чтения записи'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function toggleRecording() {
  if (state.recState) {
    state.recState.recorder.stop();
    return;
  }
  if (!state.currentChatId) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    const startedAt = Date.now();

    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      el.micBtn.classList.remove('is-recording');
      el.recTimer.hidden = true;
      state.recState = null;

      const duration = Math.round((Date.now() - startedAt) / 1000);
      if (duration < 1) {
        toast('Запись слишком короткая');
        return;
      }

      try {
        const b64 = await blobToB64(blob);
        await sendVoice(state.currentChatId, b64, duration);
      } catch (error) {
        toast('Не удалось отправить голосовое: ' + error.message);
      }
    };

    recorder.start();
    state.recState = { recorder, timer: null, startedAt };
    el.micBtn.classList.add('is-recording');
    el.recTimer.hidden = false;

    const update = () => {
      if (!state.recState) return;
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      el.recTimer.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    };
    update();
    state.recState.timer = setInterval(update, 500);
  } catch {
    toast('Нет доступа к микрофону');
  }
}

async function sendVoice(chatId, b64, duration) {
  const chat = chatById(chatId);
  if (!chat) return;

  if (chat.kind === 'channel' && !chat.canManage) {
    toast('В канале писать могут только администраторы');
    return;
  }

  const payload = { body: '', kind: 'voice', attachment: b64, duration };
  const data = await api(`/api/chats/${chatId}/messages`, { method: 'POST', body: payload });
  await handleIncomingMessage(chatId, data.message);
}

function voiceBubble(bubble, message) {
  const wrap = document.createElement('div');
  wrap.className = 'voice';

  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'voice__play';
  play.setAttribute('aria-label', 'Воспроизвести');

  const wave = document.createElement('div');
  wave.className = 'voice__wave';
  for (let i = 0; i < 16; i += 1) {
    wave.append(Object.assign(document.createElement('span'), { style: `height:${6 + ((i * 7) % 14)}px` }));
  }

  const lengthLabel = document.createElement('span');
  lengthLabel.className = 'voice__length';
  const seconds = message.duration || 0;
  lengthLabel.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

  wrap.append(play, wave, lengthLabel);
  bubble.append(wrap);

  play.addEventListener('click', async event => {
    event.stopPropagation();
    if (state.voicePlayer && state.voicePlayer.messageId === message.id && !state.voicePlayer.audio.paused) {
      state.voicePlayer.audio.pause();
      return;
    }

    try {
      const blob = b64toBlob(message.attachment || '');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => play.classList.remove('is-playing');

      if (state.voicePlayer && state.voicePlayer.audio) {
        state.voicePlayer.audio.pause();
        const prev = document.querySelector(`[data-id="${state.voicePlayer.messageId}"] .voice__play`);
        if (prev) prev.classList.remove('is-playing');
      }

      state.voicePlayer = { messageId: message.id, audio };
      play.classList.add('is-playing');
      audio.play().catch(() => {});
    } catch {
      toast('Не удалось воспроизвести');
    }
  });
}

function openFullscreen(dataUrl, type) {
  const veil = document.createElement('div');
  veil.className = 'media-view';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = '';
  if (type === 'video') {
    void 0;
  }
  veil.append(img);
  veil.addEventListener('click', () => veil.remove());
  document.body.append(veil);
}

function mediaUrl(attachment) {
  return attachment && attachment.startsWith('data:') ? attachment : (attachment ? 'data:application/octet-stream;base64,' + attachment : '');
}

function renderAttachment(bubble, message) {
  const kind = message.kind || '';
  const at = message.attachment || '';
  const dataUrl = mediaUrl(at);

  if (kind === 'sticker') {
    const img = document.createElement('img');
    img.className = 'attachment attachment--sticker';
    img.src = 'emoji/' + at + '.png';
    img.alt = 'Стикер';
    img.loading = 'lazy';
    img.addEventListener('click', event => {
      event.stopPropagation();
      openFullscreen(img.src, 'image');
    });
    bubble.append(img);
    return;
  }

  if (kind === 'image') {
    const img = document.createElement('img');
    img.className = 'attachment attachment--image';
    img.src = dataUrl;
    img.alt = message.caption || '';
    img.loading = 'lazy';
    img.addEventListener('click', event => {
      event.stopPropagation();
      openFullscreen(dataUrl, 'image');
    });
    bubble.append(img);
    return;
  }

  if (kind === 'video') {
    const video = document.createElement('video');
    video.className = 'attachment attachment--video';
    video.src = dataUrl;
    video.controls = true;
    video.preload = 'metadata';
    video.playsInline = true;
    bubble.append(video);
    return;
  }

  if (kind === 'audio') {
    const audio = document.createElement('audio');
    audio.className = 'attachment attachment--audio';
    audio.src = dataUrl;
    audio.controls = true;
    bubble.append(audio);
    return;
  }

  // generic file
  const fileRow = document.createElement('div');
  fileRow.className = 'attachment-file';
  const name = document.createElement('div');
  name.className = 'attachment-file__name';
  name.textContent = message.fileName || 'Файл';
  const size = document.createElement('div');
  size.className = 'attachment-file__size';
  size.textContent = message.fileSize ? formatBytes(message.fileSize) : '';
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = message.fileName || 'file';
  a.append(name, size);
  fileRow.append(a);
  bubble.append(fileRow);
}

function renderContact(bubble, message) {
  let contact = message.contact;
  if (!contact && message.attachment) {
    try {
      contact = JSON.parse(message.attachment);
    } catch {
      contact = null;
    }
  }
  if (!contact) return;
  const row = document.createElement('div');
  row.className = 'contact-card';
  const name = document.createElement('div');
  name.className = 'contact-card__name';
  name.textContent = contact.name || contact.displayName || 'Контакт';
  const uname = document.createElement('div');
  uname.className = 'contact-card__username';
  uname.textContent = (contact.username ? '@' + contact.username : (contact.phone || ''));
  row.append(name, uname);
  bubble.append(row);
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const n = Number(bytes);
  if (n < 1024) return n + ' Б';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' КБ';
  return (n / (1024 * 1024)).toFixed(1) + ' МБ';
}

function appendRichText(container, body) {
  const pattern = /(?:https?:\/\/[^\s<>"']+|wm\.me\/[a-zA-Z0-9_-]+)/gi;
  const atPattern = /@([A-Za-z0-9_]{3,20})/g;
  let lastIndex = 0;

  function flushText(text) {
    if (!text) return;
    let atIndex = 0;
    let am;
    while ((am = atPattern.exec(text)) !== null) {
      if (am.index > atIndex) container.append(document.createTextNode(text.slice(atIndex, am.index)));
      const mention = document.createElement('span');
      mention.className = 'mention';
      mention.textContent = am[0];
      const target = state.users.find(u => u.username === am[1]);
      if (target) {
        mention.addEventListener('click', () => openProfile(target.id));
      }
      container.append(mention);
      atIndex = am.index + am[0].length;
    }
    if (atIndex < text.length) container.append(document.createTextNode(text.slice(atIndex)));
  }

  let match;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > lastIndex) flushText(body.slice(lastIndex, match.index));

    const link = document.createElement('a');
    link.href = match[0];
    link.textContent = match[0];
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    if (/^wm\.me\//i.test(match[0])) {
      link.target = '_self';
      link.addEventListener('click', (e) => {
        e.preventDefault();
        joinByLink(match[0]);
      });
    }
    container.append(link);

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < body.length) flushText(body.slice(lastIndex));
}

function refreshTicks() {
  const chat = chatById(state.currentChatId);
  const readUpTo = chat ? (chat.peerLastReadId || 0) : 0;

  for (const node of el.messageList.querySelectorAll('.msg--own')) {
    const tick = node.querySelector('.tick');
    if (!tick) continue;
    const read = Number(node.dataset.id) <= readUpTo;
    const next = read ? 'read' : 'sent';
    if (tick.dataset.state !== next) {
      tick.dataset.state = next;
      tick.innerHTML = read ? TICK_READ : TICK_SENT;
    }
  }
}

/* ---------- Подгрузка истории ---------- */

el.messages.addEventListener('scroll', () => {
  const distance = el.messages.scrollHeight - el.messages.scrollTop - el.messages.clientHeight;
  el.jump.hidden = distance < 240;

  if (el.messages.scrollTop < 80) loadOlder();
});

el.jump.addEventListener('click', () => scrollBottom(true));

el.messages.addEventListener('click', event => {
  if (!event.target.closest('.msg')) {
    el.messageList.querySelectorAll('.msg--react-open').forEach(node => node.classList.remove('msg--react-open'));
  }
});

el.replyBarClose.addEventListener('click', () => cancelReply());

el.pinnedBody.addEventListener('click', () => {
  const chat = chatById(state.currentChatId);
  const pinnedId = chat && chat.pinnedMessageId;
  if (!pinnedId) return;
  const node = el.messageList.querySelector(`[data-id="${pinnedId}"]`);
  if (node) {
    (node.closest('.msg-row') || node).scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  jumpToMessage(state.currentChatId, pinnedId);
});

el.pinnedComment.addEventListener('click', () => {
  const chat = chatById(state.currentChatId);
  const pinnedId = chat && chat.pinnedMessageId;
  const message = pinnedId ? messageById(pinnedId) : null;
  if (chat && pinnedId && message) startReply(message);
});

el.pinnedClose.addEventListener('click', () => {
  const chat = chatById(state.currentChatId);
  if (chat) {
    chat.pinnedMessage = null;
    chat.pinnedMessageId = null;
    renderPinned(chat);
  }
});

el.pinnedShare.addEventListener('click', () => {
  const chat = chatById(state.currentChatId);
  const pinnedId = chat && chat.pinnedMessageId;
  const message = pinnedId ? messageById(pinnedId) : null;
  if (message) openForwardDialog(state.currentChatId, message);
});

async function jumpToMessage(chatId, messageId) {
  state.loadingOlder = true;
  try {
    const before = await loadUntil(chatId, messageId);
    if (!before) {
      state.exhausted = true;
      toast('Сообщение находится в начале переписки');
    }
    const node = el.messageList.querySelector(`[data-id="${messageId}"]`);
    if (node) (node.closest('.msg-row') || node).scrollIntoView({ block: 'center' });
  } finally {
    state.loadingOlder = false;
  }
}

async function loadUntil(chatId, messageId) {
  let before = 0;
  while (!state.messages.some(m => m.id === messageId)) {
    const data = await api(`/api/chats/${chatId}/messages?before=${before}`);
    if (!data.messages.length) return null;
    state.messages = [...data.messages.reverse(), ...state.messages];
    before = state.messages[0].id;
    if (state.messages.length > 2000) return 'limit';
  }
  return before;
}

async function loadOlder() {
  const chatId = state.currentChatId;
  if (!chatId || state.loadingOlder || state.exhausted) return;

  const first = state.messages[0];
  if (!first) return;

  state.loadingOlder = true;
  const prevHeight = el.messages.scrollHeight;
  const prevTop = el.messages.scrollTop;

  try {
    const data = await api(`/api/chats/${chatId}/messages?before=${first.id}`);
    if (data.messages.length) {
      state.messages = [...data.messages, ...state.messages];
      await renderAll();
      el.messages.scrollTop = el.messages.scrollHeight - prevHeight + prevTop;
    }
    state.exhausted = data.messages.length < PAGE_SIZE;
  } catch {
    state.exhausted = true;
  } finally {
    state.loadingOlder = false;
  }
}

/* ---------- Отправка ---------- */

el.composer.addEventListener('submit', event => {
  event.preventDefault();
  sendMessage();
});

el.micBtn.addEventListener('click', () => {
  if (state.recState) {
    state.recState.recorder.stop();
  } else {
    toggleRecording();
  }
});

el.attachBtn.addEventListener('click', () => {
  if (!state.currentChatId) return toast('Сначала выберите чат');
  el.attachInput.click();
});

const EMOJI_SET = ['😀','😁','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😜','🤪','😎','🤩','🥳','😏','😢','😭','😅','😤','😡','🤯','🥶','😴','🤔','🤫','🫡','👋','✌️','🤝','👍','👎','👏','🙏','💪','🫶','❤️','🔥','✨','⭐','💎','🎁','🎉','💰','✅','❌','🚀','🎮','🎵','📸','📍','🍕','🍔','🌮','☕','🍺','⚽','🏀','🐱','🐶','🦊','🐼','🌚','🌝','💯','🔞'];

function buildEmojiPanel() {
  if (el.emojiPanel.childElementCount) return;
  const grid = document.createElement('div');
  grid.className = 'emoji-panel__grid';
  for (const emoji of EMOJI_SET) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-panel__item';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      insertEmoji(emoji);
    });
    grid.append(btn);
  }
  el.emojiPanel.append(grid);
}

function insertEmoji(emoji) {
  buildEmojiPanel();
  const start = el.input.selectionStart ?? el.input.value.length;
  const end = el.input.selectionEnd ?? start;
  const value = el.input.value;
  el.input.value = value.slice(0, start) + emoji + value.slice(end);
  el.input.focus();
  const pos = start + emoji.length;
  el.input.setSelectionRange(pos, pos);
  autoGrow();
  updateCounter();
  sendTyping();
  scheduleDraftSave();
  if (state.currentChatId) persistDraft(state.currentChatId, el.input.value);
}

el.emojiBtn.addEventListener('click', () => {
  buildEmojiPanel();
  const willShow = el.emojiPanel.hidden;
  if (willShow && !state.currentChatId) return toast('Сначала выберите чат');
  el.emojiPanel.hidden = !willShow;
  el.emojiBtn.classList.toggle('is-active', willShow);
});

document.addEventListener('click', event => {
  if (!el.emojiPanel.hidden && !el.emojiPanel.contains(event.target) && !el.emojiBtn.contains(event.target)) {
    el.emojiPanel.hidden = true;
    el.emojiBtn.classList.remove('is-active');
  }
  if (!el.stickerPanel.hidden && !el.stickerPanel.contains(event.target) && !el.stickerBtn.contains(event.target)) {
    el.stickerPanel.hidden = true;
    el.stickerBtn.classList.remove('is-active');
  }
});

const STICKER_SET = ['🔥','❤️','👍','😂','🥰','😎','🤔','😱','💯','🎉','🌚','❤️‍🔥','😈','🥶','💀','⭐','🎁','🍕'];

function buildStickerPanel() {
  if (el.stickerPanel.childElementCount) return;
  const grid = document.createElement('div');
  grid.className = 'sticker-panel__grid';
  for (const emoji of STICKER_SET) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sticker-panel__item';
    const code = EMOJI_FILE[emoji];
    if (code) {
      const img = document.createElement('img');
      img.src = 'emoji/' + code + '.png';
      img.alt = emoji;
      img.loading = 'lazy';
      btn.append(img);
    } else {
      btn.textContent = emoji;
    }
    btn.addEventListener('click', () => sendSticker(emoji));
    grid.append(btn);
  }
  el.stickerPanel.append(grid);
}

function sendSticker(emoji) {
  const chatId = state.currentChatId;
  if (!chatId) return toast('Сначала выберите чат');
  const chat = chatById(chatId);
  if (!chat) return;
  if (chat.kind === 'channel' && !chat.canManage) {
    toast('В канале писать могут только администраторы');
    return;
  }
  el.stickerPanel.hidden = true;
  el.stickerBtn.classList.remove('is-active');
  const code = EMOJI_FILE[emoji] || '';
  const msg = { type: 'send', chatId, body: '', kind: 'sticker', attachment: code };
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(msg));
  } else {
    api(`/api/chats/${chatId}/messages`, { method: 'POST', body: { body: '', kind: 'sticker', attachment: code } })
      .then(data => handleIncomingMessage(chatId, data.message))
      .catch(error => toast(error.message));
  }
}

el.stickerBtn.addEventListener('click', () => {
  buildStickerPanel();
  const willShow = el.stickerPanel.hidden;
  if (willShow && !state.currentChatId) return toast('Сначала выберите чат');
  el.stickerPanel.hidden = !willShow;
  el.stickerBtn.classList.toggle('is-active', willShow);
  if (willShow) {
    el.emojiPanel.hidden = true;
    el.emojiBtn.classList.remove('is-active');
  }
});

el.pollBtn.addEventListener('click', () => {
  if (!state.currentChatId) return toast('Сначала выберите чат');
  openPollDialog(state.currentChatId);
});

el.attachInput.addEventListener('change', async () => {
  const files = Array.from(el.attachInput.files || []);
  el.attachInput.value = '';
  if (!files.length) return;

  const chatId = state.currentChatId;
  const chat = chatById(chatId);
  if (!chat) return;
  if (chat.kind === 'channel' && !chat.canManage) {
    return toast('В канале писать могут только администраторы');
  }

  const MaxSize = 850000;
  const images = [];
  let uploadError = null;

  for (const file of files) {
    if (file.size > MaxSize) {
      uploadError = 'Файл слишком большой (до ~850 КБ)';
      break;
    }
    try {
      const b64 = await blobToB64(file);
      const type = (file.type || '').toLowerCase();
      let kind = 'file';
      if (type.startsWith('image/')) kind = 'image';
      else if (type.startsWith('video/')) kind = 'video';
      else if (type.startsWith('audio/')) kind = 'audio';
      images.push({ name: file.name, size: file.size, b64, kind });
    } catch {
      uploadError = 'Не удалось прочитать файл';
      break;
    }
  }

  if (uploadError) {
    if (images.length) toast('Часть файлов не отправлена: ' + uploadError);
    else return toast(uploadError);
  }

  const groupId = images.length > 1 ? 'g' + Date.now() + '_' + state.me.id : undefined;

  try {
    for (const img of images) {
      const data = await api(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        body: {
          body: '',
          kind: img.kind,
          attachment: img.b64,
          fileName: img.name,
          fileSize: img.size,
          caption: (groupId ? '' : el.input.value.trim()),
          mediaGroupId: groupId
        }
      });
      await handleIncomingMessage(chatId, data.message);
    }
    if (images.length === 1) {
      el.input.value = '';
      autoGrow();
      updateCounter();
    } else {
      toast('Альбом из ' + images.length + ' фото отправлен');
    }
  } catch (error) {
    toast(error.message || 'Не удалось отправить файл');
  }
});

el.input.addEventListener('input', () => {
  autoGrow();
  updateCounter();
  sendTyping();
  scheduleDraftSave();
  updateMentionPanel();
});

function scheduleDraftSave() {
  clearTimeout(state.draftTimer);
  state.draftTimer = setTimeout(() => {
    if (state.currentChatId) persistDraft(state.currentChatId, el.input.value);
  }, 400);
}

el.input.addEventListener('keydown', event => {
  if (event.key === 'Escape' && state.editing) {
    event.preventDefault();
    cancelEdit();
    return;
  }
  if (event.key === 'Escape' && !el.mentionPanel.hidden) {
    el.mentionPanel.hidden = true;
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey) {
    if (!el.mentionPanel.hidden) {
      event.preventDefault();
      insertMention();
      return;
    }
    event.preventDefault();
    sendMessage();
  }
});

function updateMentionPanel() {
  const chat = chatById(state.currentChatId);
  const hintOpen = chat && chat.kind !== 'direct' && chat.kind !== 'saved';
  if (!hintOpen) { el.mentionPanel.hidden = true; return; }

  const value = el.input.value;
  const cursor = el.input.selectionStart ?? el.input.value.length;
  const before = value.slice(0, cursor);
  const match = before.match(/@([A-Za-z0-9_]{0,20})$/);
  if (!match) { el.mentionPanel.hidden = true; return; }

  const q = match[1].toLowerCase();
  const candidates = state.users.filter(u => {
    if (u.id === state.me.id) return false;
    const hay = (u.displayName + ' ' + u.username).toLowerCase();
    return hay.includes(q);
  }).slice(0, 8);

  if (!candidates.length) { el.mentionPanel.hidden = true; return; }

  el.mentionPanel.replaceChildren();
  el.mentionPanel.hidden = false;
  const atStart = before.length - match[0].length;
  state.mentionStart = atStart;

  for (const u of candidates) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mention-item';
    const av = document.createElement('span');
    av.className = 'avatar avatar--xs';
    av.textContent = initials(u.displayName);
    const name = document.createElement('span');
    name.className = 'mention-item__name';
    name.textContent = u.displayName;
    const uname = document.createElement('span');
    uname.className = 'mention-item__uname';
    uname.textContent = '@' + u.username;
    item.append(av, name, uname);
    item.addEventListener('click', () => {
      replaceMention(u.username);
    });
    el.mentionPanel.append(item);
  }
}

function replaceMention(username) {
  const value = el.input.value;
  const start = state.mentionStart;
  const end = value.indexOf(' ', start) === -1 ? value.length : value.indexOf(' ', start);
  const atEnd = Math.max(end, start + 1);
  const nothingAfter = value.slice(atEnd);
  el.input.value = value.slice(0, start) + '@' + username + (nothingAfter ? ' ' + nothingAfter : '');
  el.mentionPanel.hidden = true;
  el.input.focus();
  el.input.selectionStart = el.input.selectionEnd = el.input.value.length;
  autoGrow();
  updateCounter();
}

function insertMention() {
  const item = el.mentionPanel.querySelector('.mention-item');
  if (!item) { el.mentionPanel.hidden = true; return; }
  const uname = item.querySelector('.mention-item__uname').textContent.slice(1);
  replaceMention(uname);
}

document.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement !== el.input && document.activeElement !== el.authPhone) {
    if (el.app.hidden) return;
    event.preventDefault();
    el.search.focus();
  }
  if (event.key === 'Escape' && document.activeElement === el.search) {
    el.search.value = '';
    renderPeople();
    filterChatRows();
    el.search.blur();
  }
});

function updateCounter() {
  const length = el.input.value.length;
  el.counter.hidden = length < 3500;
  el.counter.textContent = `${length}/4000`;
}

async function sendMessage() {
  const chatId = state.currentChatId;
  const body = el.input.value.trim();
  if (!chatId || !body) return;

  const chat = chatById(chatId);
  if (!chat) return;
  if (chat.kind === 'channel' && !chat.canManage) {
    toast('В канале писать могут только администраторы');
    return;
  }

  el.input.value = '';
  autoGrow();
  updateCounter();

  const editing = state.editing;
  state.editing = null;
  delete el.input.dataset.editing;

  if (editing && editing.chatId === chatId) {
    try {
      const data = await api(`/api/chats/${chatId}/messages/${editing.messageId}`, { method: 'PATCH', body: { body } });
      await handleIncomingMessage(chatId, data.message);
      clearDraft(chatId);
      toast('Сообщение изменено');
    } catch (error) {
      toast(error.message);
      el.input.value = body;
      autoGrow();
      updateCounter();
    }
    return;
  }

  let payload;
  if (chat.kind === 'direct') {
    try {
      payload = await encryptBody(chatId, body);
    } catch (error) {
      toast(error.message);
      el.input.value = body;
      autoGrow();
      updateCounter();
      return;
    }
  } else {
    payload = body;
  }

  clearDraft(chatId);

  const replyTarget = currentReplyTarget();
  if (state.replyTo) {
    state.replyTo = null;
    renderReplyBar();
  }

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    const msg = { type: 'send', chatId, body: payload };
    if (replyTarget) msg.replyToId = replyTarget.id;
    state.ws.send(JSON.stringify(msg));
    return;
  }

  try {
    const postBody = { body: payload };
    if (replyTarget) postBody.replyToId = replyTarget.id;
    const data = await api(`/api/chats/${chatId}/messages`, { method: 'POST', body: postBody });
    await handleIncomingMessage(chatId, data.message);
  } catch (error) {
    toast(error.message);
    el.input.value = body;
    autoGrow();
    updateCounter();
  }
}

function sendTyping() {
  if (!state.currentChatId || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  if (now - state.typingSentAt < 2500) return;
  state.typingSentAt = now;
  state.ws.send(JSON.stringify({ type: 'typing', chatId: state.currentChatId }));
}

/* ---------- Прочтение ---------- */

function markRead(chatId, messageId) {
  const chat = chatById(chatId);
  if (chat) {
    chat.lastReadId = Math.max(chat.lastReadId || 0, messageId);
    chat.unread = 0;
  }

  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify({ type: 'read', chatId, messageId }));
  } else {
    api(`/api/chats/${chatId}/read`, { method: 'POST', body: { messageId } }).catch(() => {});
  }

  renderChats();
}

/* ---------- WebSocket ---------- */

function connectWs() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws`);
  state.ws = ws;

  ws.addEventListener('open', () => {
    state.reconnectDelay = 1000;
    el.conn.hidden = true;
  });

  ws.addEventListener('message', event => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    handleServerEvent(payload);
  });

  ws.addEventListener('close', () => {
    if (!state.me) return;
    state.ws = null;
    el.conn.hidden = false;
    setTimeout(connectWs, state.reconnectDelay);
    state.reconnectDelay = Math.min(state.reconnectDelay * 1.7, 15000);
  });

  ws.addEventListener('error', () => ws.close());
}

function handleServerEvent(payload) {
  if (payload.type === 'hello') {
    const onlineIds = new Set(payload.onlineUsers || []);
    for (const user of state.users) user.online = onlineIds.has(user.id);
    loadUsers().catch(() => {});
    renderPeople();
    renderChats();
    const chat = chatById(state.currentChatId);
    if (chat && chat.peer) setStatus(lastSeenText(userById(chat.peer.id)));
    return;
  }

  if (payload.type === 'presence') {
    const user = userById(payload.userId);
    if (user) {
      user.online = payload.online;
      if (!payload.online) user.lastSeen = Date.now();
    }
    renderPeople();
    renderChats();
    const chat = chatById(state.currentChatId);
    if (chat && chat.peer && chat.peer.id === payload.userId) {
      setStatus(lastSeenText(user));
    }
    return;
  }

  if (payload.type === 'message') {
    handleIncomingMessage(payload.chatId, payload.message);
    return;
  }

  if (payload.type === 'typing') {
    if (payload.chatId !== state.currentChatId) return;
    setStatus('печатает', true);
    clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => {
      const chat = chatById(state.currentChatId);
      if (chat) setStatus(lastSeenText(chat.peer ? userById(chat.peer.id) : null));
      else setStatus('');
    }, 3200);
    return;
  }

  if (payload.type === 'read') {
    const chat = chatById(payload.chatId);
    if (!chat) return;
    if (chat.peer && chat.peer.id === payload.userId) {
      chat.peerLastReadId = Math.max(chat.peerLastReadId || 0, payload.messageId);
      if (payload.chatId === state.currentChatId) refreshTicks();
    }
    return;
  }

  if (payload.type === 'chat') {
    loadChats().catch(() => {});
    return;
  }

  if (payload.type === 'chat') {
    loadChats().catch(() => {});
    return;
  }

  if (payload.type === 'message-deleted') {
    removeLocalMessage(payload.chatId, payload.messageId);
    return;
  }

  if (payload.type === 'reaction') {
    const message = messageById(payload.messageId);
    if (message) {
      message.reactions = payload.reactions || {};
      refreshReactionChips(payload.messageId);
    }
    return;
  }

  if (payload.type === 'poll') {
    refreshPoll(payload.messageId);
    return;
  }

  if (payload.type === 'chats-changed') {
    loadChats().catch(() => {});
    if (!el.chatInfo.hidden) renderChatInfo();
    return;
  }

  if (payload.type === 'chat-removed') {
    state.chats = state.chats.filter(chat => chat.id !== payload.chatId);

    if (state.currentChatId === payload.chatId) closeChat();
    if (state.infoChatId === payload.chatId) closeChatInfo();

    renderChats();
    return;
  }

  if (payload.type === 'error') {
    toast(payload.message);
  }
}

async function handleIncomingMessage(chatId, message) {
  const chat = chatById(chatId);

  if (chat) {
    chat.lastMessage = message;
    if (chatId === state.currentChatId) {
      chat.unread = 0;
    } else if (message.senderId !== state.me.id) {
      chat.unread = (chat.unread || 0) + 1;
    }
    state.chats.sort((a, b) => {
      const at = a.lastMessage ? a.lastMessage.createdAt : 0;
      const bt = b.lastMessage ? b.lastMessage.createdAt : 0;
      return bt - at;
    });
  } else {
    loadChats().catch(() => {});
  }

  if (message.senderId !== state.me.id && (chatId !== state.currentChatId || !document.hasFocus())) {
    playPing();
    desktopNotify(message.senderName || 'Новое сообщение', message.body || '(вложение)');
  }

  if (chatId === state.currentChatId) {
    const existingIndex = state.messages.findIndex(m => m.id === message.id);

    if (existingIndex !== -1) {
      state.messages[existingIndex] = { ...state.messages[existingIndex], ...message };
      await reRenderMessages();
    } else {
      const stick = nearBottom();
      appendDayIfNeeded(message.createdAt);
      await appendBubble(message);
      state.messages.push(message);
      if (stick) scrollBottom(true);
    }

    if (document.hasFocus()) markRead(chatId, message.id);
  }

  renderChats();
}

/* ---------- Группы и каналы ---------- */

function openFormModal(title, build) {
  el.modalTitle.textContent = title;
  el.modalBody.replaceChildren();

  const form = document.createElement('form');
  form.className = 'form';
  build(form);

  el.modalBody.append(form);
  el.modal.hidden = false;
  return form;
}

function openPollDialog(chatId) {
  const form = openFormModal('Новый опрос', formEl => {
    const qField = settingsField('Вопрос', (() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 200;
      input.placeholder = 'Вопрос опроса';
      return input;
    })());
    const optsWrap = document.createElement('div');
    optsWrap.className = 'poll-form__opts';

    const options = [];
    for (let i = 0; i < 2; i += 1) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 80;
      input.placeholder = `Вариант ${i + 1}`;
      options.push(input);
      const field = settingsField('', input);
      optsWrap.append(field);
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn--ghost btn--small';
    addBtn.textContent = '+ Добавить вариант';
    addBtn.addEventListener('click', () => {
      if (options.length >= 10) return;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 80;
      input.placeholder = `Вариант ${options.length + 1}`;
      options.push(input);
      optsWrap.append(settingsField('', input));
    });

    const anonLabel = settingsToggle('Анонимный опрос', 'Голоса не будут видны другим подписчикам', true, () => {});

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = 'Создать опрос';
    submit.disabled = true;
    const check = () => {
      const q = qField.querySelector('input');
      const validOptions = options.map(input => input.value.trim()).filter(Boolean);
      submit.disabled = !(q && q.value.trim() && validOptions.length >= 2);
    };
    [qField.querySelector('input'), ...options].forEach(input => input.addEventListener('input', check));

    formEl.append(
      qField,
      document.createElement('div'),
      optsWrap,
      addBtn,
      anonLabel,
      submit
    );

    let anon = true;
    const anonBox = anonLabel.querySelector('input[type=checkbox]');
    if (anonBox) anonBox.addEventListener('change', () => { anon = anonBox.checked; });

    formEl.addEventListener('submit', async event => {
      event.preventDefault();
      const question = qField.querySelector('input').value.trim();
      const validOptions = options.map(input => input.value.trim()).filter(Boolean);
      if (!question || validOptions.length < 2) return;
      try {
        await api(`/api/chats/${chatId}/messages`, {
          method: 'POST',
          body: { kind: 'text', body: '', pollQuestion: question, pollOptions: validOptions, pollAnonymous: anon }
        });
        closeModal();
        toast('Опрос создан');
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function chatKindLabel(kind) {
  if (kind === 'saved') return 'Избранное';
  return kind === 'channel' ? 'канал' : 'группа';
}

function commentWord(n) {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'ев';
  if (last === 1) return 'й';
  if (last >= 2 && last <= 4) return 'я';
  return 'ев';
}

function pluralWord(n, forms) {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function membersWord(n, isChannel) {
  return pluralWord(n, isChannel ? ['подписчик', 'подписчика', 'подписчиков'] : ['участник', 'участника', 'участников']);
}

function createChatDialog(kind) {
  setMenu(false);
  const isChannel = kind === 'channel';

  openFormModal(isChannel ? 'Новый канал' : 'Новая группа', form => {
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.maxLength = 80;
    titleInput.placeholder = isChannel ? 'Название канала' : 'Название группы';

    const descInput = document.createElement('textarea');
    descInput.className = 'settings-textarea';
    descInput.rows = 2;
    descInput.maxLength = 255;
    descInput.placeholder = 'Описание (необязательно)';

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.maxLength = 32;
    usernameInput.placeholder = 'например news';

    const history = document.createElement('input');
    history.type = 'checkbox';
    history.className = 'switch-input';
    history.checked = true;

    const historyRow = settingsToggle(
      'История для новых участников',
      'Если выключить, новые увидят только сообщения после входа',
      true,
      checked => { history.checked = checked; }
    );

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = 'Создать';

    form.append(
      settingsField('Название', titleInput),
      settingsField('Описание', descInput),
      settingsField('Публичная ссылка (необязательно)', usernameInput),
      historyRow,
      submit
    );

    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const data = await api('/api/chats', {
          method: 'POST',
          body: {
            kind,
            title: titleInput.value,
            description: descInput.value,
            username: usernameInput.value,
            historyForNew: history.checked
          }
        });
        closeModal();
        await loadChats();
        await openChat(data.chat.id);
        toast(isChannel ? 'Канал создан' : 'Группа создана');
      } catch (error) {
        toast(error.message);
        submit.disabled = false;
      }
    });

    titleInput.focus();
  });
}

function joinDialog() {
  setMenu(false);

  openFormModal('Присоединиться', form => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '@username или код приглашения';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = 'Присоединиться';

    form.append(settingsField('Ссылка или имя', input), submit);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const data = await api('/api/join', { method: 'POST', body: { link: input.value } });
        closeModal();
        await loadChats();
        await openChat(data.chat.id);
        toast('Вы присоединились');
      } catch (error) {
        toast(error.message);
        submit.disabled = false;
      }
    });

    input.focus();
  });
}

function openChatInfo(chatId = state.currentChatId) {
  const chat = chatById(chatId);
  if (!chat || chat.kind === 'direct') return;

  state.infoChatId = chat.id;
  el.chatInfo.hidden = false;
  renderChatInfo();
}

function closeChatInfo() {
  el.chatInfo.hidden = true;
}

function openChannelProfile(chat) {
  const isChannel = chat.kind === 'channel';
  const card = document.createElement('div');
  card.className = 'channel-profile';

  const head = document.createElement('div');
  head.className = 'channel-profile__head';

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar--xxl' + (chat.canManage ? ' avatar--editable' : '');
  applyAvatar(avatar, chat.title, chat.id, false, chat.avatar);
  if (chat.canManage) {
    avatar.title = 'Сменить фото чата';
    avatar.addEventListener('click', () => {
      closeModal();
      state.avatarTarget = { type: 'chat', chatId: chat.id };
      el.avatarInput.click();
    });
  }

  const name = document.createElement('div');
  name.className = 'channel-profile__name';
  name.textContent = chat.title;
  appendVerified(name, chat.verified);

  const meta = document.createElement('div');
  meta.className = 'channel-profile__meta';
  meta.textContent = `${chat.memberCount} ${membersWord(chat.memberCount, isChannel)}`;

  head.append(avatar, name, meta);
  card.append(head);

  const actions = document.createElement('div');
  actions.className = 'channel-profile__actions';

  const actionBtn = (label, iconSvg, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'channel-action';
    const icon = document.createElement('span');
    icon.className = 'channel-action__icon';
    icon.innerHTML = iconSvg;
    const text = document.createElement('span');
    text.className = 'channel-action__label';
    text.textContent = label;
    btn.append(icon, text);
    btn.addEventListener('click', onClick);
    return btn;
  };

  actions.append(
    actionBtn('Звук',
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      () => toast('Звук уведомлений пока не настраивается')),
    actionBtn('Обсуждение',
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
      () => {
        if (isChannel) {
          closeModal();
          const c = chatById(chat.id);
          if (c && c.discussionId) openChat(c.discussionId);
          else if (c && c.canManage) openChatInfo(c.id);
          else toast('Обсуждения нет');
        } else {
          toast(chat.title + ' — обсуждение');
        }
      }),
    actionBtn('Управление',
      '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      () => {
        if (chat.canManage) {
          closeModal();
          openChatInfo(chat.id);
        } else {
          toast('Управлять может только администратор');
        }
      })
  );
  card.append(actions);

  if (chat.description) {
    const desc = document.createElement('p');
    desc.className = 'channel-profile__desc';
    desc.textContent = chat.description;
    card.append(desc);
  }

  if (chat.username || (chat.inviteToken && !isChannel)) {
    const linkRow = document.createElement('div');
    linkRow.className = 'channel-profile__link';

    const linkIcon = document.createElement('span');
    linkIcon.className = 'channel-profile__link-icon';
    linkIcon.innerHTML = qrIcon();

    const linkText = document.createElement('span');
    linkText.className = 'channel-profile__link-text';
    linkText.textContent = chat.username ? 'wm.me/' + chat.username : ('wm.me/' + chat.inviteToken);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'channel-profile__link-copy';
    copyBtn.textContent = 'Скопировать';
    copyBtn.addEventListener('click', async () => {
      const text = chat.username ? 'wm.me/' + chat.username : ('wm.me/' + chat.inviteToken);
      try {
        await navigator.clipboard.writeText(text);
        toast('Ссылка скопирована');
      } catch {
        toast('Браузер не дал доступ к буферу');
      }
    });

    linkRow.append(linkIcon, linkText, copyBtn);
    card.append(linkRow);

    if (chat.username) {
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn btn--primary channel-profile__open';
      openBtn.textContent = 'Открыть канал';
      openBtn.addEventListener('click', closeModal);
      card.append(openBtn);
    }
  }

  const stats = document.createElement('div');
  stats.className = 'channel-profile__stats';

  const stat = (label, value) => {
    const box = document.createElement('div');
    box.className = 'channel-profile__stat';
    const v = document.createElement('div');
    v.className = 'channel-profile__stat-value';
    v.textContent = String(value || 0);
    const l = document.createElement('div');
    l.className = 'channel-profile__stat-label';
    l.textContent = label;
    box.append(v, l);
    return box;
  };

  stats.append(
    stat(membersWord(chat.memberCount, true), chat.memberCount),
    stat('администраторов', chat.adminCount || 0)
  );
  card.append(stats);

  if (chat.kind !== 'saved') {
    const leave = document.createElement('button');
    leave.type = 'button';
    leave.className = 'channel-profile__leave';
    leave.textContent = isChannel ? 'Покинуть канал' : 'Покинуть группу';
    leave.addEventListener('click', () => {
      confirmAction({
        title: 'Покинуть чат',
        text: 'Сообщения перестанут приходить. Вернуться можно по ссылке.',
        confirmText: 'Покинуть'
      }, async () => {
        try {
          await api(`/api/chats/${chat.id}/leave`, { method: 'POST' });
          closeModal();
          closeChat();
          await loadChats();
          toast('Вы покинули чат');
        } catch (error) {
          toast(error.message);
        }
      });
    });
    card.append(leave);
  }

  openModal(isChannel ? 'Канал' : 'Группа', [card]);

  if (isChannel) {
    loadChannelStats(chat.id).then(info => {
      if (info) {
        const s1 = card.querySelector('.channel-profile__stat-value');
        if (s1) s1.textContent = String(info.members || chat.memberCount);
        const s2 = card.querySelectorAll('.channel-profile__stat-value')[1];
        if (s2) s2.textContent = String(info.admins || 0);
      }
    });
  }
}

async function loadChannelStats(chatId) {
  try {
    const data = await api(`/api/chats/${chatId}/members`);
    const members = data.members || [];
    return { members: members.length, admins: members.filter(m => m.role === 'owner' || m.role === 'admin').length };
  } catch {
    return null;
  }
}

function renderChatInfo() {
  const chat = chatById(state.infoChatId);
  if (!chat) {
    closeChatInfo();
    return;
  }

  el.chatInfoTitle.textContent = chat.kind === 'channel' ? 'Канал' : 'Группа';
  const content = el.chatInfoContent;
  content.replaceChildren();

  const head = document.createElement('div');
  head.className = 'chat-info__head';

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar--xl' + (chat.canManage ? ' avatar--editable' : '');
  applyAvatar(avatar, chat.title, chat.id, false, chat.avatar);
  if (chat.canManage) {
    avatar.title = 'Сменить фото чата';
    avatar.addEventListener('click', () => {
      state.avatarTarget = { type: 'chat', chatId: chat.id };
      el.avatarInput.click();
    });
  }

  const titles = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'settings__name';
  name.textContent = chat.title;
  appendVerified(name, chat.verified);

  const meta = document.createElement('div');
  meta.className = 'settings__username';
  meta.textContent = `${chat.memberCount} ${membersWord(chat.memberCount, chat.kind === 'channel')}`;

  titles.append(name, meta);
  head.append(avatar, titles);
  content.append(head);

  if (chat.description) {
    const description = document.createElement('p');
    description.className = 'settings__note';
    description.textContent = chat.description;
    content.append(description);
  }

  const pinBlock = settingsBlock('Чат');
  const pinActions = document.createElement('div');
  pinActions.className = 'info-rows';

  const pinBtn = infoAction(chat.isPinned ? 'Открепить' : 'Закрепить', {
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 3l5 5-7 7H7l-4 4 4-4v-6l8-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    onClick: async () => {
      try {
        await api(`/api/chats/${chat.id}/pin`, { method: 'POST', body: { pinned: !chat.isPinned } });
        await loadChats();
        renderChats();
        if (!el.chatInfo.hidden) renderChatInfo();
      } catch (error) {
        toast(error.message);
      }
    }
  });

  const archBtn = infoAction(chat.isArchived ? 'Из архива' : 'В архив', {
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    onClick: async () => {
      try {
        await api(`/api/chats/${chat.id}/archive`, { method: 'POST', body: { archived: !chat.isArchived } });
        closeChatInfo();
        await loadChats();
        renderChats();
      } catch (error) {
        toast(error.message);
      }
    }
  });

  pinActions.append(pinBtn, archBtn);
  pinBlock.append(pinActions);
  content.append(pinBlock);

  const membersBlock = settingsBlock('Участники');
  const membersList = document.createElement('div');
  membersList.className = 'session-list';
  membersList.textContent = 'Загружаю…';
  membersBlock.append(membersList);
  content.append(membersBlock);
  renderMembers(membersList, chat);

  const linkBlock = settingsBlock('Ссылка');
  const linkRow = document.createElement('div');
  linkRow.className = 'settings__key';

  const linkCode = document.createElement('code');
  linkCode.className = 'settings__keyvalue';
  linkCode.textContent = chat.username ? '@' + chat.username : String(chat.inviteToken || 'нет кода');
  linkRow.append(linkCode);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'btn btn--ghost btn--small';
  copy.textContent = 'Скопировать';
  copy.addEventListener('click', async () => {
    const text = chat.username ? '@' + chat.username : String(chat.inviteToken || '');
    try {
      await navigator.clipboard.writeText(text);
      toast('Скопировано');
    } catch {
      toast('Браузер не дал доступ к буферу');
    }
  });

  linkBlock.append(linkRow, copy);

  if (chat.canManage) {
    const rotate = document.createElement('button');
    rotate.type = 'button';
    rotate.className = 'btn btn--ghost btn--small';
    rotate.textContent = 'Обновить код приглашения';
    rotate.addEventListener('click', async () => {
      try {
        const data = await api(`/api/chats/${chat.id}/invite`, { method: 'POST' });
        chat.inviteToken = data.inviteToken;
        renderChatInfo();
        toast('Код обновлён');
      } catch (error) {
        toast(error.message);
      }
    });
    linkBlock.append(rotate);
  }

  content.append(linkBlock);

  if (chat.canManage) {
    const settings = settingsBlock('Настройки');

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.maxLength = 80;
    titleInput.value = chat.title;

    const descInput = document.createElement('textarea');
    descInput.className = 'settings-textarea';
    descInput.rows = 2;
    descInput.maxLength = 255;
    descInput.value = chat.description || '';

    const usernameInput = document.createElement('input');
    usernameInput.type = 'text';
    usernameInput.maxLength = 32;
    usernameInput.value = chat.username || '';
    usernameInput.placeholder = 'публичная ссылка';

    const history = document.createElement('input');
    history.type = 'checkbox';
    history.className = 'switch-input';
    history.checked = chat.historyForNew;

    const historyRow = settingsToggle(
      'История для новых участников',
      'Новые видят сообщения, отправленные после входа',
      chat.historyForNew,
      checked => { history.checked = checked; }
    );

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn--primary';
    save.textContent = 'Сохранить';
    save.addEventListener('click', async () => {
      save.disabled = true;
      try {
        const data = await api(`/api/chats/${chat.id}`, {
          method: 'PATCH',
          body: {
            title: titleInput.value,
            description: descInput.value,
            username: usernameInput.value,
            historyForNew: history.checked
          }
        });

        const index = state.chats.findIndex(item => item.id === chat.id);
        if (index !== -1) state.chats[index] = data.chat;
        renderChats();
        renderChatInfo();
        updateHeader(chatById(chat.id));
        toast('Сохранено');
      } catch (error) {
        toast(error.message);
      } finally {
        save.disabled = false;
      }
    });

    settings.append(
      settingsField('Название', titleInput),
      settingsField('Описание', descInput),
      settingsField('Публичная ссылка', usernameInput),
      historyRow,
      save
    );

    content.append(settings);
  }

  if (chat.kind === 'channel' && chat.canManage) {
    const discBlock = settingsBlock('Обсуждение');

    const discRow = document.createElement('div');
    discRow.className = 'info-rows';

    const groups = state.chats.filter(item => item.kind === 'group');
    const bound = groups.find(item => item.id === chat.discussionId);

    const current = infoAction(bound ? bound.title : 'Не привязано', {
      value: bound ? 'Обсуждение' : 'Выберите группу',
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 6h16M4 12h9M4 18h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="15" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
      onClick: () => openDiscussionPicker(chat).then(ok => {
        if (ok) {
          loadChats().then(renderChats);
          renderChatInfo();
        }
      })
    });
    discRow.append(current);

    if (bound) {
      const detach = infoAction('Отвязать обсуждение', {
        danger: true,
        onClick: async () => {
          try {
            await api(`/api/chats/${chat.id}/discussion`, { method: 'POST', body: { groupId: null } });
            toast('Обсуждение отвязано');
            await loadChats();
            renderChats();
            renderChatInfo();
          } catch (error) {
            toast(error.message);
          }
        }
      });
      discRow.append(detach);
    }

    discBlock.append(discRow);
    content.append(discBlock);
  }

  async function openDiscussionPicker(channel) {
    const groups = state.chats.filter(item => item.kind === 'group');

    const shelf = document.createElement('div');
    shelf.className = 'info-rows';

    if (!groups.length) {
      const empty = document.createElement('div');
      empty.className = 'settings__note';
      empty.textContent = 'Сначала создайте группу — её можно будет привязать как обсуждение.';
      shelf.append(empty);
      openModal('Привязать обсуждение', shelf);
      return false;
    }

    const hint = document.createElement('div');
    hint.className = 'settings__note';
    hint.textContent = 'Выберите группу, в которую будут приходить комментарии:';
    shelf.append(hint);

    const taken = new Set(
      state.chats
        .filter(item => item.kind === 'channel' && item.discussionId)
        .map(item => item.discussionId)
    );

    for (const group of groups) {
      if (group.id === channel.discussionId) continue;
      const item = infoAction(group.title, {
        icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="8" cy="9" r="2.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 19c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        value: taken.has(group.id) ? 'Занята' : null,
        onClick: async () => {
          closeModal();
          try {
            await api(`/api/chats/${channel.id}/discussion`, { method: 'POST', body: { groupId: group.id } });
            toast('Обсуждение привязано');
            await loadChats();
            renderChats();
            renderChatInfo();
          } catch (error) {
            toast(error.message);
          }
        }
      });
      if (taken.has(group.id)) item.disabled = true;
      shelf.append(item);
    }

    openModal('Привязать обсуждение', shelf);
    return true;
  }

  const danger = document.createElement('div');
  danger.className = 'info-rows';

  const leave = infoAction(chat.kind === 'channel' ? 'Покинуть канал' : 'Покинуть группу', {
    danger: true,
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 4l-1 1h-4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4l1 1h1V4h-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M18 9l3 3-3 3M9 12h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    onClick: () => {
      confirmAction({
        title: 'Покинуть чат',
        text: 'Сообщения перестанут приходить. Вернуться можно по ссылке.',
        confirmText: 'Покинуть'
      }, async () => {
        try {
          await api(`/api/chats/${chat.id}/leave`, { method: 'POST' });
          closeChatInfo();
          closeChat();
          await loadChats();
          toast('Вы покинули чат');
        } catch (error) {
          toast(error.message);
        }
      });
    }
  });
  danger.append(leave);

  if (chat.myRole === 'owner') {
    const remove = infoAction('Удалить чат', {
      danger: true,
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      onClick: () => {
        confirmAction({
          title: 'Удалить чат',
          text: 'Сообщения и участники удалятся безвозвратно.',
          confirmText: 'Удалить'
        }, async () => {
          try {
            await api(`/api/chats/${chat.id}`, { method: 'DELETE' });
            closeChatInfo();
            closeChat();
            await loadChats();
            toast('Чат удалён');
          } catch (error) {
            toast(error.message);
          }
        });
      }
    });
    danger.append(remove);
  }

  content.append(danger);
}

async function renderMembers(container, chat) {
  try {
    const data = await api(`/api/chats/${chat.id}/members`);
    container.replaceChildren();

    if (!data.members.length) {
      container.textContent = 'Участников нет';
      return;
    }

    for (const member of data.members) {
      const row = document.createElement('div');
      row.className = 'session';

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      applyAvatar(avatar, member.displayName, member.id, false, member.avatar);

      const info = document.createElement('div');
      info.className = 'session__info';

      const name = document.createElement('div');
      name.className = 'session__title session__title--link';
      name.textContent = `${member.displayName} @${member.username}`;
      appendVerified(name, member.verified);
      name.addEventListener('click', () => openProfile(member.id));

      const role = document.createElement('div');
      role.className = 'session__meta';
      role.textContent = member.role === 'owner'
        ? 'владелец'
        : member.role === 'admin' ? 'администратор' : 'участник';

      info.append(name, role);
      row.append(avatar, info);

      if (chat.myRole === 'owner' && member.role !== 'owner' && member.id !== state.me.id) {
        const promote = document.createElement('button');
        promote.type = 'button';
        promote.className = 'btn btn--ghost btn--small';
        promote.textContent = member.role === 'admin' ? 'Снять права' : 'Сделать админом';
        promote.addEventListener('click', async () => {
          try {
            await api(`/api/chats/${chat.id}/members`, {
              method: 'POST',
              body: { userId: member.id, role: member.role === 'admin' ? 'member' : 'admin' }
            });
            renderMembers(container, chat);
          } catch (error) {
            toast(error.message);
          }
        });
        row.append(promote);
      }

      if (chat.canManage && member.role !== 'owner' && member.id !== state.me.id) {
        const kick = document.createElement('button');
        kick.type = 'button';
        kick.className = 'btn btn--ghost btn--small';
        kick.textContent = 'Исключить';
        kick.addEventListener('click', async () => {
          try {
            await api(`/api/chats/${chat.id}/members`, {
              method: 'DELETE',
              body: { userId: member.id }
            });
            renderMembers(container, chat);
          } catch (error) {
            toast(error.message);
          }
        });
        row.append(kick);
      }

      container.append(row);
    }
  } catch {
    container.textContent = 'Не удалось загрузить участников';
  }
}

/* ---------- Кнопка создания ---------- */

function setComposeMenu(open) {
  el.composeMenu.hidden = !open;
  el.composeBtn.setAttribute('aria-expanded', String(Boolean(open)));
}

el.composeBtn.addEventListener('click', event => {
  event.stopPropagation();
  setComposeMenu(el.composeMenu.hidden);
});

document.addEventListener('click', event => {
  if (el.composeMenu.hidden) return;
  if (el.composeMenu.contains(event.target) || el.composeBtn.contains(event.target)) return;
  setComposeMenu(false);
});

el.composeMessage.addEventListener('click', () => {
  setComposeMenu(false);
  el.search.value = '';
  renderPeople();
  filterChatRows();
  el.search.focus();
});

el.composeGroup.addEventListener('click', () => {
  setComposeMenu(false);
  createChatDialog('group');
});

el.composeChannel.addEventListener('click', () => {
  setComposeMenu(false);
  createChatDialog('channel');
});

el.chatInfoBtn.addEventListener('click', () => openChatInfo());
el.chatInfoBack.addEventListener('click', closeChatInfo);

el.chatSearchBtn.addEventListener('click', () => {
  el.chatSearchBar.hidden = false;
  el.chatSearchInput.focus();
});
el.chatSearchClose.addEventListener('click', closeChatSearch);
el.chatSearchInput.addEventListener('input', () => {
  const q = el.chatSearchInput.value.trim().toLowerCase();
  let shown = 0, total = 0;
  for (const row of el.messageList.querySelectorAll('.msg-row')) {
    const text = (row.textContent || '').toLowerCase();
    const match = !q || text.includes(q);
    row.hidden = !match;
    if (!row.hidden) shown++;
    total++;
  }
  el.chatSearchCount.textContent = q && !shown ? 'Не найдено' : (q ? `${shown} из ${total}` : '');
  const first = el.messageList.querySelector('.msg-row:not([hidden])');
  if (q && first) first.scrollIntoView({ block: 'center' });
});

function closeChatSearch() {
  el.chatSearchBar.hidden = true;
  el.chatSearchInput.value = '';
  el.chatSearchCount.textContent = '';
  for (const row of el.messageList.querySelectorAll('.msg-row')) row.hidden = false;
}

/* ---------- Профиль ---------- */

function infoRow(labelText, valueText, onClick) {
  const row = document.createElement(onClick ? 'button' : 'div');
  if (onClick) row.type = 'button';
  row.className = 'info-row' + (onClick ? '' : ' info-row--static');

  const label = document.createElement('span');
  label.className = 'info-row__label';
  label.textContent = labelText;

  const value = document.createElement('span');
  value.className = 'info-row__value';
  value.textContent = valueText;

  row.append(label, value);
  if (onClick) row.addEventListener('click', onClick);
  return row;
}

function qrIcon() {
  return '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1.4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 14h3v3h-3zM19 17v4M17 21h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}

function chevronIcon() {
  return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function infoAction(labelText, options = {}) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'info-row' + (options.danger ? ' info-row--danger' : '');

  if (options.icon) {
    const icon = document.createElement('span');
    icon.className = 'info-row__icon';
    icon.innerHTML = options.icon;
    row.append(icon);
  }

  const label = document.createElement('span');
  label.className = 'info-row__label';
  label.textContent = labelText;
  row.append(label);

  if (options.value) {
    const value = document.createElement('span');
    value.className = 'info-row__value';
    value.textContent = options.value;
    row.append(value);
  }

  if (options.chevron !== false) {
    const chevron = document.createElement('span');
    chevron.className = 'info-row__chevron';
    chevron.innerHTML = chevronIcon();
    row.append(chevron);
  }

  if (options.onClick) row.addEventListener('click', options.onClick);
  return row;
}

function profileRow(valueText, labelText, options = {}) {
  const row = document.createElement('div');
  row.className = 'profile-row';

  const text = document.createElement('div');
  text.className = 'profile-row__text';

  const value = document.createElement('div');
  value.className = 'profile-row__value';
  value.textContent = valueText;

  const label = document.createElement('div');
  label.className = 'profile-row__label';
  label.textContent = labelText;

  text.append(value, label);
  row.append(text);

  if (options.icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-row__icon';
    button.innerHTML = options.icon;
    button.title = 'Скопировать ссылку на профиль';
    if (options.onIconClick) button.addEventListener('click', options.onIconClick);
    row.append(button);
  }

  return row;
}

function openProfile(userId = state.me.id) {
  const user = userId === state.me.id ? state.me : userById(userId);
  if (!user) return;

  state.profileUserId = userId;
  el.profile.hidden = false;
  renderProfile();
}

function closeProfile() {
  el.profile.hidden = true;
}

function openUsernameModal(user) {
  const row = document.createElement('div');
  row.className = 'gift-card';

  const title = document.createElement('div');
  title.className = 'gift-card__title';
  title.textContent = 'Имя пользователя';

  const desc = document.createElement('div');
  desc.className = 'gift-card__desc';
  desc.textContent = 'Выберите уникальное имя. Ваша ссылка — @' + (user.username || 'имя');

  const field = document.createElement('label');
  field.className = 'field';
  const span = document.createElement('span');
  span.textContent = 'Имя пользователя';
  const input = document.createElement('input');
  input.placeholder = 'например, wave_dev';
  input.maxLength = 20;
  input.value = user.username || '';
  field.append(span, input);

  const err = document.createElement('div');
  err.className = 'auth__error';

  const actions = document.createElement('div');
  actions.className = 'modal__actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--ghost';
  cancel.textContent = 'Отмена';
  cancel.addEventListener('click', closeModal);

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn--primary';
  save.textContent = 'Сохранить';
  save.addEventListener('click', async () => {
    err.textContent = '';
    const value = input.value.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{5,20}$/.test(value)) {
      err.textContent = '5–20 символов: латиница, цифры и _';
      return;
    }
    save.disabled = true;
    try {
      const data = await api('/api/me', { method: 'PATCH', body: { username: value } });
      state.me = data.user;
      applySelfProfile();
      closeModal();
      renderProfile();
      toast('Имя пользователя установлено');
    } catch (error) {
      err.textContent = error.message;
      save.disabled = false;
    }
  });

  actions.append(cancel, save);
  row.append(title, desc, field, actions, err);
  openModal('Имя пользователя', [row]);
}

function openCollectibleNumber(user) {
  const modalRow = document.createElement('div');
  modalRow.className = 'collectible';

  const icon = document.createElement('div');
  icon.className = 'collectible__icon';
  icon.textContent = numIconGlyph(user.phone);

  const head = document.createElement('div');
  head.className = 'collectible__head';
  head.textContent = 'Коллекционный номер';

  const number = document.createElement('div');
  number.className = 'collectible__number';
  number.textContent = user.phone;

  const owner = document.createElement('div');
  owner.className = 'collectible__owner';
  const ownerName = document.createElement('span');
  ownerName.textContent = '— номер, который принадлежит ' + (user.displayName || 'вам');
  owner.append(ownerName);

  // Цена номера — крупной плашкой, если известна.
  let priceEl = null;
  if (user.phonePrice) {
    const priceNum = Number(String(user.phonePrice).replace(/[^\d.]/g, ''));
    const priceText = !Number.isNaN(priceNum) && priceNum > 0
      ? priceNum.toLocaleString('ru-RU') + ' ₽'
      : String(user.phonePrice);
    priceEl = document.createElement('div');
    priceEl.className = 'collectible__price';
    priceEl.textContent = 'Цена: ' + priceText;
  }

  const meta = document.createElement('div');
  meta.className = 'collectible__meta';
  if (user.phoneBoughtAt) {
    meta.textContent = 'приобретён ' + new Date(user.phoneBoughtAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  const actions = document.createElement('div');
  actions.className = 'collectible__actions';

  const details = document.createElement('button');
  details.type = 'button';
  details.className = 'btn btn--primary';
  details.textContent = 'Подробнее';
  details.addEventListener('click', () => {
    closeModal();
    openSettings('profile');
  });

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'collectible__copy';
  copy.textContent = 'Скопировать номер';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(user.phone || '');
      toast('Номер скопирован');
    } catch {
      toast('Браузер не дал доступ к буферу');
    }
  });

  actions.append(details);
  modalRow.append(icon, head, number);
  if (priceEl) modalRow.append(priceEl);
  modalRow.append(owner);
  if (meta.textContent) modalRow.append(meta);
  modalRow.append(actions, copy);
  openRawModal('Коллекционный номер', modalRow);
}

function openCollectibleUsername(u) {
  const modalRow = document.createElement('div');
  modalRow.className = 'collectible';

  const icon = document.createElement('div');
  icon.className = 'collectible__icon';
  icon.textContent = '@';

  const head = document.createElement('div');
  head.className = 'collectible__head';
  head.textContent = 'Коллекционное имя пользователя';

  const number = document.createElement('div');
  number.className = 'collectible__number';
  number.textContent = '@' + u.name;

  const owner = document.createElement('div');
  owner.className = 'collectible__owner';
  const ownerName = document.createElement('span');
  ownerName.textContent = '— коллекционное имя пользователя, которое принадлежит';
  owner.append(ownerName);

  const meta = document.createElement('div');
  meta.className = 'collectible__meta';
  const parts = [];
  if (u.boughtAt) {
    parts.push('приобретено ' + new Date(u.boughtAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' }));
  }
  if (u.price || u.stars) {
    const stars = u.stars || '';
    const rub = u.price ? Number(u.price).toLocaleString('ru-RU') + ' ₽' : '';
    parts.push('за ' + [rub, stars].filter(Boolean).join(' / '));
  }
  if (parts.length) meta.textContent = parts.join(' ');

  const actions = document.createElement('div');
  actions.className = 'collectible__actions';

  const details = document.createElement('button');
  details.type = 'button';
  details.className = 'btn btn--primary';
  details.textContent = 'Подробнее';
  details.addEventListener('click', () => {
    closeModal();
    openSettings('profile');
  });

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'collectible__copy';
  copy.textContent = 'Копировать ссылку';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('@' + u.name);
      toast('Ссылка скопирована');
    } catch {
      toast('Браузер не дал доступ к буферу');
    }
  });

  actions.append(details);
  modalRow.append(icon, head, number, owner, meta, actions, copy);
  openRawModal('Коллекционное имя', modalRow);
}

function openRawModal(title, bodyNode) {
  el.modalTitle.textContent = title;
  el.modalBody.replaceChildren();
  el.modalBody.append(bodyNode);
  el.modal.hidden = false;
  return bodyNode;
}

function openUserMoreMenu(user) {
  const list = document.createElement('div');
  list.className = 'menu-list';

  const items = [
    { icon: '<path d="M12 4a6 6 0 0 0-5.2 8.8L2 17l2 2 4.2-4.2A6 6 0 1 0 12 4z" fill="none" stroke="currentColor" stroke-width="1.8"/>', label: 'Без звука', action: () => toast('Уведомления приглушены') },
    { icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', label: 'Автоудаление', action: () => toast('Автоудаление пока недоступно') },
    { icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19 8v6M16 11h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', label: 'Добавить в контакты', action: () => toast('Добавлено в контакты') },
    { icon: '<path d="M20 12v6H4v-6M12 3v14m0 0l-4-4m4 4l4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', label: 'Добавить в папку', action: () => toast('Папки пока недоступны') },
    { icon: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>', label: 'Разрешить пересылку', action: () => toast('Пересылка разрешена') }
  ];

  for (const it of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-list__item';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' + it.icon + '</svg><span>' + it.label + '</span>';
    btn.addEventListener('click', () => {
      closeModal();
      it.action();
    });
    list.append(btn);
  }

  const block = document.createElement('button');
  block.type = 'button';
  block.className = 'menu-list__item menu-list__item--danger';
  block.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Заблокировать</span>';
  block.addEventListener('click', () => {
    closeModal();
    toast('Пользователь заблокирован');
  });
  list.append(block);

  openModal('Ещё', list);
}

function numIconGlyph(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.slice(-2) || '✆';
}

function shieldIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.verticalAlign = '-2px';
  svg.style.marginRight = '5px';
  svg.innerHTML = '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}

function ratingIcon(label) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = label;
  return svg;
}

function computeRating(user) {
  let score = 0;
  const placed = isSelfUser(user) ? getPlacedGifts().length : (user.giftsCount || 0);
  score += placed * 25;
  if (user.phoneCollectible) score += 40;
  const cvnames = Array.isArray(user.collectUsernames) ? user.collectUsernames.length : 0;
  score += cvnames * 15;
  const bal = typeof user.balance === 'number' ? user.balance : 0;
  score += Math.min(100, Math.floor(bal / 50));
  const level = score > 250 ? 2 : 1;
  return { score, level, placed, cvnames, balance: bal };
}

function isSelfUser(user) {
  return state.me && user && user.id === state.me.id;
}

function openRatingModal(user, rating) {
  const card = document.createElement('div');
  card.className = 'rating';

  const head = document.createElement('div');
  head.className = 'rating__head';
  const crown = document.createElement('div');
  crown.className = 'rating__crown';
  crown.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 17l-2-8 5 3 5-6 5 6 5-3-2 8H4z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>';
  const scoreLabel = document.createElement('div');
  scoreLabel.className = 'rating__score';
  scoreLabel.textContent = formatRating(rating.score) + ' / 5 000';
  head.append(crown, scoreLabel);

  const tabs = document.createElement('div');
  tabs.className = 'rating__tabs';
  for (let lv = 1; lv <= 2; lv++) {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'rating__tab' + (lv === rating.level ? ' is-active' : '');
    t.textContent = 'Уровень ' + lv;
    t.addEventListener('click', () => { rating.level = lv; openRatingModal(user, rating); });
    tabs.append(t);
  }

  const title = document.createElement('div');
  title.className = 'rating__title';
  title.textContent = 'Рейтинг';

  const desc = document.createElement('div');
  desc.className = 'rating__desc';
  desc.textContent = 'Рейтинг отражает Вашу активность в ' + (state.appName || 'мессенджере') + '. На него влияют:';

  const list = document.createElement('div');
  list.className = 'rating__list';

  const factors = [
    { icon: '<path d="M20 12v6H4v-6M12 3v14m0 0l-4-4m4 4l4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>', title: 'Подарки на аватарке', mod: '+' + rating.placed * 25, text: 'Каждый подарок на аватарке добавляет 25 баллов рейтинга.' },
    { icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v10M7 10l5-3 5 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', title: 'Коллекционные номера и имена', mod: '+' + (40 + rating.cvnames * 15), text: 'Коллекционный номер приносит 40 баллов, каждое коллекционное имя — 15.' }
  ];
  if (typeof rating.balance === 'number' && rating.balance > 0) {
    factors.push({ icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v10M7 10l5-3 5 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>', title: 'Баланс WCOIN', mod: '+' + Math.min(100, Math.floor(rating.balance / 50)), text: 'Монеты на кошельке повышают активность.' });
  }

  for (const f of factors) {
    const row = document.createElement('div');
    row.className = 'rating__item';

    const ic = document.createElement('div');
    ic.className = 'rating__item-icon';
    ic.append(ratingIcon(f.icon));
    row.append(ic);

    const body = document.createElement('div');
    body.className = 'rating__item-body';
    const hd = document.createElement('div');
    hd.className = 'rating__item-title';
    hd.textContent = f.title;
    const tx = document.createElement('div');
    tx.className = 'rating__item-desc';
    tx.textContent = f.text;
    body.append(hd, tx);
    row.append(body);

    const badge = document.createElement('span');
    badge.className = 'rating__item-mod rating__item-mod--plus';
    badge.textContent = f.mod;
    row.append(badge);

    list.append(row);
  }

  const note = document.createElement('div');
  note.className = 'rating__note';
  note.textContent = 'Повышайте рейтинг, чтобы перейти на уровень 2 (больше 250 баллов).';

  const ok = document.createElement('div');
  ok.className = 'rating__ok';
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn--primary';
  okBtn.textContent = 'ОК';
  okBtn.addEventListener('click', closeModal);
  ok.append(okBtn);

  card.append(head, tabs, title, desc, list, note, ok);
  openModal('Рейтинг', card);
}

function formatRating(n) {
  return Number(n).toLocaleString('ru-RU');
}

function renderProfile() {
  const isSelf = state.profileUserId === state.me.id;
  const user = isSelf ? state.me : userById(state.profileUserId);
  if (!user) {
    closeProfile();
    return;
  }

  el.profileTitle.textContent = isSelf ? 'Мой профиль' : 'Профиль';
  el.profileEdit.hidden = !isSelf;
  el.profileMore.hidden = isSelf;
  const content = el.profileContent;
  content.replaceChildren();

  const head = document.createElement('div');
  head.className = 'profile__head';

  const avatarWrap = document.createElement('div');
  avatarWrap.className = 'profile__avatar-wrap';

  const avatar = document.createElement('div');
  avatar.className = 'avatar avatar--xxl';
  applyAvatar(avatar, user.displayName, user.id, user.online, user.avatar);

if (isSelf) {
    avatar.classList.add('avatar--editable');
    avatar.title = 'Сменить фото';
    avatar.addEventListener('click', () => el.avatarInput.click());
  }

avatarWrap.append(avatar);

  const placedOwn = isSelf ? getPlacedGifts().length : 0;

  if (isSelf) {
    addProfileGiftStars(avatarWrap, user, getPlacedGifts().length, true);
  } else if ((user.giftsCount || 0) > 0) {
    addProfileGiftStars(avatarWrap, user, user.giftsCount, false);
  }

const name = document.createElement('div');
  name.className = 'profile__name';
  if (user.majorVerified) name.prepend(majorBadge());
  if (user.statusEmoji) {
    const semoji = document.createElement('span');
    semoji.className = 'status-emoji';
    semoji.textContent = user.statusEmoji;
    name.prepend(semoji);
  }
  name.appendChild(document.createTextNode(user.displayName));
  appendVerified(name, user.verified);

  const status = document.createElement('div');
  status.className = 'profile__status';
  status.classList.toggle('profile__status--online', Boolean(user.online));
  if (isSelf) {
    status.textContent = 'это вы';
  } else if (user.online) {
    status.textContent = 'в сети';
    status.prepend(shieldIcon());
  } else {
    status.textContent = lastSeenText(user);
  }

  const rating = computeRating(user);
  const ratingBtn = document.createElement('button');
  ratingBtn.type = 'button';
  ratingBtn.className = 'profile__rating';
  ratingBtn.title = 'Открыть рейтинг';
  ratingBtn.innerHTML = '<svg class="profile__rating-crown" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 17l-2-8 5 3 5-6 5 6 5-3-2 8H4z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg><span class="profile__rating-value">' + rating.score + '</span><span class="profile__rating-lv">' + rating.level + '</span>';
  ratingBtn.addEventListener('click', () => openRatingModal(user, rating));
  status.append(ratingBtn);

  head.append(avatarWrap, name, status);
  content.append(head);

  const rows = document.createElement('div');
  rows.className = 'profile-rows';

  // Купленные в магазине номера (+888) — запасные для регистрации, не основной. Идём ниже отдельным блоком.

  // Коллекционные юзернеймы из бота + основной username.
  const cvnames = Array.isArray(user.collectUsernames) ? user.collectUsernames : [];
  if (user.username) {
    const unameRow = profileRow('@' + user.username, 'Имя пользователя', {
      icon: qrIcon(),
      onIconClick: async () => {
        try {
          await navigator.clipboard.writeText('@' + user.username);
          toast('Ссылка скопирована');
        } catch {
          toast('Браузер не дал доступ к буферу');
        }
      }
    });
    rows.append(unameRow);
  } else if (isSelf) {
    const unsetRow = profileRow('Имя пользователя не назначен', 'Имя пользователя', {
      icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      onIconClick: () => openUsernameModal(user)
    });
    unsetRow.classList.add('is-clickable');
    unsetRow.querySelector('.profile-row__value').style.color = 'var(--text-faint)';
    unsetRow.addEventListener('click', () => openUsernameModal(user));
    rows.append(unsetRow);
  }
  // Отдельные коллекционные юзернеймы (купленные отдельно) — карточки.
  cvnames.forEach((cv, idx) => {
    const unameValue = document.createElement('span');
    unameValue.className = 'profile-row__phone--collectible';
    unameValue.textContent = '@' + cv.name;
    if (cv.price != null && cv.price > 0) {
      const priceTag = document.createElement('span');
      priceTag.className = 'profile-row__uname-price';
      priceTag.textContent = Number(cv.price).toLocaleString('ru-RU') + ' ₽';
      unameValue.append(' ', priceTag);
    }
    const row = profileRow('@' + cv.name, idx === 0 ? 'Коллекционное имя' : 'Коллекционное имя ' + (idx + 1));
    row.querySelector('.profile-row__value').replaceChildren(unameValue);
    unameValue.classList.add('is-link');
    unameValue.addEventListener('click', () => openCollectibleUsername({ ...user, name: cv.name, price: cv.price, boughtAt: cv.boughtAt }));
    rows.append(row);
  });

  // Один номер на аккаунт — основной (user.phone). Редкость не нужна, показываем цену если есть.
  if (user.phone) {
    const phoneValue = document.createElement('span');
    phoneValue.className = user.phoneCollectible ? 'profile-row__phone--collectible' : 'profile-row__phone';
    phoneValue.textContent = user.phone;
    let phoneLabel = user.phoneCollectible ? 'Коллекционный номер' : 'Телефон';
    const phoneRow = profileRow(user.phone, phoneLabel);
    phoneRow.querySelector('.profile-row__value').replaceChildren(phoneValue);
    if (user.phoneCollectible) {
      phoneValue.classList.add('is-link');
      phoneValue.addEventListener('click', () => openCollectibleNumber(user));
    }
    if (user.phonePrice) {
      const priceNum = Number(String(user.phonePrice).replace(/[^\d.]/g, ''));
      const priceText = !Number.isNaN(priceNum) && priceNum > 0 ? priceNum.toLocaleString('ru-RU') + ' ₽' : String(user.phonePrice);
      const priceTag = document.createElement('span');
      priceTag.className = 'profile-row__phone-price';
      priceTag.textContent = priceText;
      phoneRow.querySelector('.profile-row__value').append(priceTag);
    }
    rows.append(phoneRow);
  } else if (isSelf) {
    rows.append(profileRow('не указан', 'Телефон'));
  }

  if (user.bio) rows.append(profileRow(user.bio, 'О себе'));

  rows.append(profileRow(String(user.id), 'ID'));

  if (!isSelf && !user.online && user.lastSeen) {
    rows.append(profileRow(new Date(user.lastSeen).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }), 'Был(а) в сети'));
  }

  content.append(rows);

  if (isSelf) {
    const actions = document.createElement('div');
    actions.className = 'profile__actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn--primary';
    edit.textContent = 'Редактировать профиль';
    edit.addEventListener('click', () => {
      closeProfile();
      openSettings('profile');
    });
    actions.append(edit);

    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = 'btn btn--ghost';
    statusBtn.textContent = user.statusEmoji ? 'Изменить эмодзи-статус' : 'Установить эмодзи-статус';
    statusBtn.addEventListener('click', () => openStatusEmojiModal(user));
    actions.append(statusBtn);

    if (state.me.avatar) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--ghost';
      remove.textContent = 'Удалить фото';
      remove.addEventListener('click', () => saveProfile({ avatar: null }));
      actions.append(remove);
    }

    content.append(actions);
  } else {
    const write = document.createElement('button');
    write.type = 'button';
    write.className = 'btn btn--primary profile__act';
    write.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5h16v11H8l-4 4V5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
    write.title = 'Написать сообщение';
    write.addEventListener('click', async () => {
      closeProfile();
      await openChatWith(state.profileUserId);
    });

    const call = document.createElement('button');
    call.type = 'button';
    call.className = 'btn btn--ghost profile__act';
    call.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 4h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16 13l4 1.5v3a2 2 0 0 1-2 2C11 19.5 4.5 13 4.5 6a2 2 0 0 1 1.5-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
    call.title = 'Позвонить';
    call.addEventListener('click', () => toast('Звонки пока не поддерживаются'));

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn--ghost profile__act';
    more.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>';
    more.title = 'Ещё';
    more.addEventListener('click', () => openUserMoreMenu(user));

    const acts = document.createElement('div');
    acts.className = 'profile__actions-row';
    acts.append(write, call, more);
    content.append(acts);
  }

  function giftPatternBase() {
    const patterns = ['✦', '✧', '❋', '✳', '★', '✵'];
    const span = document.createElement('span');
    span.className = 'gift-detail__pattern-sym';
    span.textContent = patterns[Math.floor(Math.random() * patterns.length)];
    return span;
  }

  const tabs = document.createElement('div');
  tabs.className = 'profile__tabs';
  const giftsCount = isSelf ? getPlacedGifts().length : (user.giftsCount || 0);
  const tabsData = [
    { id: 'stories', label: 'Истории', count: 0, icon: storyIcon() },
    { id: 'gifts', label: 'Подарки', count: giftsCount, icon: giftIcon() }
  ];
  for (const tab of tabsData) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile__tab';
    btn.innerHTML = '';
    btn.append(tab.icon, document.createTextNode(tab.label));
    if (tab.count) {
      const badge = document.createElement('span');
      badge.className = 'profile__tab-badge';
      badge.textContent = tab.count;
      btn.append(badge);
    }
    btn.addEventListener('click', () => {
      if (tab.id === 'gifts') {
        openMyGifts(user);
      } else {
        toast((isSelf ? 'У вас' : 'У пользователя') + ' пока нет ' + tab.label.toLowerCase());
      }
    });
    tabs.append(btn);
  }
  content.append(tabs);
}

function storyIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" stroke-width="1.6"/>';
  return svg;
}

function giftIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<rect x="3" y="8" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 8V5h18v3M12 8v13" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5c0-2 4-4 4-1s-4 4-4 4M12 5c0-2-4-4-4-1s4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>';
  return svg;
}

function nftBaseGifts() {
  return [
    { id: 'crystal', name: 'Кристалл', glyph: '💎', num: '1', sub: 'Легендарный', bg: 'Гравитация', rarity: 'Легендарный', effect: 'Светится при открытии профиля', minted: '100 / 500', pattern: 'Ромбы', price: 250, img: 'gift-crystal.jpg' },
    { id: 'flame', name: 'Пламя', glyph: '🔥', num: '2', sub: 'Редкий', bg: 'Вулкан', rarity: 'Редкий', effect: 'Пульсация огня', minted: '340 / 1000', pattern: 'Волны', price: 150, img: 'gift-flame.jpg' },
    { id: 'star', name: 'Звезда', glyph: '⭐', num: '4', sub: 'Обычный', bg: 'Космос', rarity: 'Обычный', effect: 'Мерцание', minted: '980 / 5000', pattern: 'Точки', price: 40, img: 'gift-star.jpg' }
  ];
}

function addProfileGiftStars(wrap, user, count, isSelf) {
  const base = nftBaseGifts();
  if (count > 0) {
    const holder = document.createElement('div');
    holder.className = 'profile__gift-stars';
    let placed = [];
    try { placed = JSON.parse(localStorage.getItem(GIFTS_STORAGE_KEY) || '[]'); } catch {}
    const placedDefs = placed.map(p => base.find(b => b.id === p.id)).filter(Boolean);
    const total = Math.min(6, count);
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span');
      s.className = 'profile__gift-star';
      const def = placedDefs[i] || base[i % base.length];
      s.textContent = def ? def.glyph : (['✦', '✧', '★', '✵', '✳', '❋'][i % 6]);
      s.setAttribute('title', def ? def.name + ' — ≈ ' + numberWithSpaces(def.price) + ' WCOIN' : '');
      const angle = (360 / total) * i - 90;
      s.style.setProperty('--sa', angle + 'deg');
      s.style.setProperty('--spd', (Math.random() * 0.8 + 1.4) + 's');
      s.style.setProperty('--so', String(Math.round(Math.random() * 900)));
      holder.append(s);
    }
    wrap.append(holder);
  }
}

const GIFTS_STORAGE_KEY = 'mt_placed_gifts';

function getPlacedGifts() {
  try { return JSON.parse(localStorage.getItem(GIFTS_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function setPlacedGifts(list) {
  localStorage.setItem(GIFTS_STORAGE_KEY, JSON.stringify(list));
}

function giftGlyphForPlaced() {
  const placed = getPlacedGifts();
  if (!placed.length) return null;
  const def = nftBaseGifts().find(g => g.id === placed[placed.length - 1].id);
  return def ? def.glyph : null;
}

function openStatusEmojiModal(user) {
  const card = document.createElement('div');
  card.className = 'modal-card status-emoji-picker';

  const subtitle = document.createElement('div');
  subtitle.className = 'settings__note';
  subtitle.textContent = 'Эмодзи-статус появится рядом с вашим именем в профиле и в чате.';
  card.append(subtitle);

  const grid = document.createElement('div');
  grid.className = 'emoji-panel__grid';
  const pick = document.createElement('input');
  pick.className = 'field status-emoji-input';
  pick.placeholder = 'Введите эмодзи (1–2 символа)';
  pick.maxLength = 2;
  card.append(pick);
  for (const emoji of EMOJI_SET) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-panel__item';
    btn.textContent = emoji;
    btn.addEventListener('click', () => { pick.value = emoji; });
    grid.append(btn);
  }
  card.append(grid);

  const actions = document.createElement('div');
  actions.className = 'modal__actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn--ghost';
  cancel.textContent = 'Отмена';
  cancel.addEventListener('click', closeModal);
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn--primary';
  save.textContent = 'Сохранить';
  save.addEventListener('click', async () => {
    const value = pick.value.trim();
    if (!value) return toast('Введите эмодзи');
    save.disabled = true;
    try {
      const data = await api('/api/me', { method: 'PATCH', body: { statusEmoji: value } });
      state.me = data.user;
      applySelfProfile();
      closeModal();
      renderProfile();
      toast('Эмодзи-статус установлен');
    } catch (error) {
      toast(error.message);
      save.disabled = false;
    }
  });
  actions.append(cancel, save);
  card.append(actions);
  openModal('Эмодзи-статус', [card]);
}

function openGiftAroundAvatar(user) {
  const card = document.createElement('div');
  card.className = 'gift-avatar-picker';

  const subtitle = document.createElement('div');
  subtitle.className = 'settings__note';
  subtitle.textContent = 'Выберите подарок, чтобы поставить его вокруг вашей аватарки. Выбранные подарки останутся на вашем профиле.';
  card.append(subtitle);

  const grid = document.createElement('div');
  grid.className = 'profile__nft-grid';

  const placed = getPlacedGifts();
  const placedIds = new Set(placed.map(p => p.id));

  for (const item of nftBaseGifts()) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'profile__nft-card' + (placedIds.has(item.id) ? ' is-placed' : '');
    tile.title = placedIds.has(item.id) ? 'Убрать с аватарки' : 'Поставить вокруг аватарки';

    const art = document.createElement('div');
    art.className = 'profile__nft-art';
    if (item.img) {
      const img = document.createElement('img');
      img.className = 'profile__nft-img';
      img.src = item.img;
      img.alt = item.name;
      art.replaceChildren(img);
    } else {
      art.textContent = item.glyph;
    }

    const nameNode = document.createElement('div');
    nameNode.className = 'profile__nft-name';
    nameNode.textContent = item.name;

    const subNode = document.createElement('div');
    subNode.className = 'profile__nft-sub';
    subNode.textContent = placedIds.has(item.id) ? 'На аватарке' : (item.price != null ? '≈ ' + numberWithSpaces(item.price) + ' WCOIN' : item.sub);

    tile.append(art, nameNode, subNode);

    tile.addEventListener('click', () => {
      let list = getPlacedGifts();
      if (placedIds.has(item.id)) {
        list = list.filter(p => p.id !== item.id);
      } else {
        list.push({ id: item.id, at: Date.now() });
      }
      setPlacedGifts(list);
      closeModal();
      if (user.id === state.me.id && !el.profile.hidden) renderProfile();
      toast(placedIds.has(item.id) ? 'Убрано с аватарки' : 'Подарок поставлен');
    });

    grid.append(tile);
  }

  card.append(grid);
  openModal('Подарки вокруг аватарки', [card]);

  const help = document.createElement('div');
  help.className = 'gift-card__badge';
  help.textContent = 'Нажмите на подарок, чтобы поставить или убрать';
  card.append(help);
}

function openMyGifts(user) {
  const isSelf = user.id === state.me.id;
  const card = document.createElement('div');
  card.className = 'gift-list';

  const subtitle = document.createElement('div');
  subtitle.className = 'settings__note';
  subtitle.textContent = isSelf
    ? 'Нажмите на подарок, чтобы открыть детали и надеть его на аватарку.'
    : 'Подарки пользователя ' + (user.displayName || '').trim() + '.';
  card.append(subtitle);

  const grid = document.createElement('div');
  grid.className = 'profile__nft-grid';

  for (const item of nftBaseGifts()) {
    const tile = document.createElement('div');
    tile.className = 'profile__nft-card';
    tile.title = item.name;
    tile.addEventListener('click', () => openNftDetail(item, user.displayName, isSelf));

    const art = document.createElement('div');
    art.className = 'profile__nft-art';
    if (item.img) {
      const img = document.createElement('img');
      img.className = 'profile__nft-img';
      img.src = item.img;
      img.alt = item.name;
      art.replaceChildren(img);
    } else {
      art.textContent = item.glyph;
    }

    const nameNode = document.createElement('div');
    nameNode.className = 'profile__nft-name';
    nameNode.textContent = item.name;

    const subNode = document.createElement('div');
    subNode.className = 'profile__nft-sub';
    const ownedRec = (isSelf ? getOwnedGifts() : []).find(g => g.id === item.id);
    subNode.textContent = (ownedRec && ownedRec.upgraded)
      ? 'Улучшено 🟢'
      : (item.price != null ? '≈ ' + numberWithSpaces(item.price) + ' WCOIN' : (item.sub || ''));

    tile.append(art, nameNode, subNode);

    if (isSelf) {
      const dots = document.createElement('button');
      dots.type = 'button';
      dots.className = 'gift-list__dots';
      dots.textContent = '⋮';
      dots.title = 'Меню';
      dots.addEventListener('click', (e) => {
        e.stopPropagation();
        const placed = getPlacedGifts();
        const worn = placed.some(p => p.id === item.id);
        const menu = document.createElement('div');
        menu.className = 'gift-detail__menu';
        const items = [
          { label: worn ? 'Снять с аватарки' : 'Надеть на аватарку', fn: () => {
            let list = getPlacedGifts();
            if (worn) list = list.filter(p => p.id !== item.id);
            else list = list.filter(p => p.id !== item.id).concat({ id: item.id, at: Date.now() });
            setPlacedGifts(list);
            closeModal();
            if (!el.profile.hidden) renderProfile();
            toast(worn ? 'Снято' : 'Надето');
          } }
        ];
        for (const it of items) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'gift-detail__menu-item';
          b.textContent = it.label;
          b.addEventListener('click', it.fn);
          menu.append(b);
        }
        document.body.append(menu);
        const r = dots.getBoundingClientRect();
        menu.style.top = (r.bottom + 4) + 'px';
        menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
        const onDoc = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', onDoc, true); } };
        document.addEventListener('click', onDoc, true);
      });
      tile.append(dots);
    }

    grid.append(tile);
  }

  card.append(grid);
  openModal(isSelf ? 'Ваши подарки' : 'Подарки', [card]);
}

function openNftDetail(item, ownerName, ownerIsSelf) {
  const card = document.createElement('div');
  card.className = 'gift-detail';

  const artWrap = document.createElement('div');
  artWrap.className = 'gift-detail__art';

  const ownedNow = ownerIsSelf ? getOwnedGifts().find(g => g.id === item.id) : null;
  const src = ownedNow && ownedNow.upgraded && item.imgUpgraded ? item.imgUpgraded : (item.img || null);
  if (src) {
    const img = document.createElement('img');
    img.className = 'gift-detail__artimg';
    img.src = src;
    img.alt = item.name;
    artWrap.append(img);
  } else {
    const big = document.createElement('div');
    big.className = 'gift-detail__glyph';
    big.textContent = item.glyph;
    artWrap.append(big);
  }

  const badge = document.createElement('div');
  badge.className = 'gift-detail__sale';
  badge.textContent = 'В продаже за ' + numberWithSpaces(item.price) + ' WCOIN';
  artWrap.append(badge);

  const title = document.createElement('div');
  title.className = 'gift-detail__title';
  title.textContent = (item.name || 'Подарок') + ' #' + String(item.num || item.id || '').replace(/^#/, '');

  const rows = document.createElement('div');
  rows.className = 'nft-detail__rows';

  const mkRow = (label, value) => {
    const r = document.createElement('div');
    r.className = 'nft-detail__row';
    const l = document.createElement('span');
    l.className = 'nft-detail__key';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'nft-detail__value';
    v.textContent = value;
    r.append(l, v);
    return r;
  };

  const price = item.price != null ? numberWithSpaces(item.price) + ' WCOIN' : (item.costValue || item.value || '—');
  const owner = ownerName || item.owner || '—';

  rows.append(
    mkRow('Владелец', owner),
    mkRow('Модель', item.name || '—'),
    mkRow('Узор', item.pattern || '—'),
    mkRow('Фон', item.bg || '—'),
    mkRow('Количество', item.minted || '—'),
    mkRow('Ценность', price)
  );

  const ton = document.createElement('div');
  ton.className = 'gift-detail__ton';
  ton.textContent = 'Подарок хранится в блокчейне TON';

  const actions = document.createElement('div');
  actions.className = 'modal__actions';

  if (!ownerIsSelf) {
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn btn--primary gift-detail__buy';
    ok.textContent = 'Купить за ' + numberWithSpaces(item.price) + ' WCOIN';
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      ok.textContent = 'Списываем ' + numberWithSpaces(item.price) + ' WCOIN…';
      try {
        const res = await api('/api/market/buy', { method: 'POST', body: { id: item.id, price: item.price } });
        markGiftOwned(item);
        ok.textContent = '✅ Куплено за ' + numberWithSpaces(item.price) + ' WCOIN';
        if (res && res.balance !== undefined) {
          if (state.me) state.me.balance = res.balance;
          toast('Успешно купили! Списано ' + item.price + ' WCOIN. Баланс: ' + res.balance + ' WCOIN');
        } else {
          toast('Успешно купили!');
        }
      } catch (error) {
        ok.disabled = false;
        ok.textContent = 'Купить за ' + numberWithSpaces(item.price) + ' WCOIN';
        toast(error.message || 'Не удалось купить');
      }
    });
    actions.append(ok);
  }

  if (ownerIsSelf) {
    const placed = getPlacedGifts();
    const worn = placed.some(p => p.id === item.id);
    const dotsBtn = document.createElement('button');
    dotsBtn.type = 'button';
    dotsBtn.className = 'btn btn--ghost gift-detail__dots';
    dotsBtn.textContent = '⋮';
    dotsBtn.title = 'Меню';
    dotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.createElement('div');
      menu.className = 'gift-detail__menu';
      const itBtn = document.createElement('button');
      itBtn.type = 'button';
      itBtn.className = 'gift-detail__menu-item';
      itBtn.textContent = worn ? 'Снять с аватарки' : 'Надеть на аватарку';
      itBtn.addEventListener('click', () => {
        let list = getPlacedGifts();
        if (worn) {
          list = list.filter(p => p.id !== item.id);
        } else {
          list = list.filter(p => p.id !== item.id).concat({ id: item.id, at: Date.now() });
        }
        setPlacedGifts(list);
        closeModal();
        if (!el.profile.hidden) renderProfile();
        toast(worn ? 'Снято' : 'Надето');
      });
      menu.append(itBtn);
      document.body.append(menu);
      const r = dotsBtn.getBoundingClientRect();
      menu.style.top = (r.bottom + 4) + 'px';
      menu.style.left = Math.max(8, r.left - 40) + 'px';
      const onDoc = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', onDoc, true); } };
      document.addEventListener('click', onDoc, true);
    });
    actions.append(dotsBtn);
    const okSelf = document.createElement('button');
    okSelf.type = 'button';
    okSelf.className = 'btn btn--primary';
    okSelf.textContent = 'ОК';
    okSelf.addEventListener('click', closeModal);
    actions.append(okSelf);
  }

  card.append(artWrap, title, rows, ton, actions);
  openModal('Подарок', [card]);
}

function openGiftPlaceholder(user) {
  const card = document.createElement('div');
  card.className = 'gift-card';

  const emoji = document.createElement('div');
  emoji.className = 'gift-card__emoji';
  emoji.textContent = '🎁';

  const title = document.createElement('div');
  title.className = 'gift-card__title';
  title.textContent = 'Подарков пока нет';

  const desc = document.createElement('div');
  desc.className = 'gift-card__desc';
  desc.textContent = (user.id === state.me.id ? 'Вы' : user.displayName) + ' ещё не получали подарков. Скоро здесь появятся подарки, которые можно дарить и получать.';

  const badge = document.createElement('div');
  badge.className = 'gift-card__badge';
  badge.textContent = 'Скоро';

  card.append(emoji, title, desc, badge);
  openModal((user.id === state.me.id ? 'Ваши' : 'Подарки') + ' подарки', [card]);
}

async function saveProfile(patch) {
  try {
    const data = await api('/api/me', { method: 'PATCH', body: patch });
    state.me = data.user;
    applySelfProfile();

    if (!el.profile.hidden) renderProfile();
    if (!el.settings.hidden) renderSettingsSection('profile');

    toast('Профиль обновлён');
  } catch (error) {
    toast(error.message);
  }
}

function resizeImage(file, size) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Не картинка'));
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

el.avatarInput.addEventListener('change', async () => {
  const file = el.avatarInput.files && el.avatarInput.files[0];
  el.avatarInput.value = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    toast('Нужна картинка');
    return;
  }

  try {
    const dataUrl = await resizeImage(file, 256);

    if (state.avatarTarget && state.avatarTarget.type === 'chat') {
      await api(`/api/chats/${state.avatarTarget.chatId}/avatar`, { method: 'POST', body: { avatar: dataUrl } });
      state.avatarTarget = null;
      await loadChats();
      if (!el.chatInfo.hidden) renderChatInfo();
      if (state.currentChatId) updateHeader(chatById(state.currentChatId));
      toast('Фото чата обновлено');
      return;
    }

    await saveProfile({ avatar: dataUrl });
  } catch {
    toast('Не удалось обработать фото');
  }
});

el.menuProfile.addEventListener('click', () => {
  setMenu(false);
  openProfile(state.me.id);
});

el.menuProfileTop.addEventListener('click', () => {
  setMenu(false);
  const accounts = getAccounts();
  if (accounts.length > 1) {
    openAccountSwitcher();
  } else {
    openProfile(state.me.id);
  }
});

function openAccountSwitcher() {
  const list = document.createElement('div');
  list.className = 'menu-list';
  const accounts = getAccounts();
  const active = getActiveToken();

  for (const acc of accounts) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu-list__item' + (acc.token === active ? ' menu-list__item--active' : '');

    const av = document.createElement('span');
    av.className = 'account-switch__avatar';
    if (acc.avatar) {
      av.style.backgroundImage = `url("${acc.avatar}")`;
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
      av.textContent = '';
    } else {
      av.textContent = initials(acc.name);
    }

    const text = document.createElement('span');
    text.className = 'account-switch__text';
    text.textContent = acc.name + (acc.username ? ' — @' + acc.username : '');
    if (acc.token === active) {
      const check = document.createElement('span');
      check.className = 'account-switch__check';
      check.textContent = '●';
      text.append(' ', check);
    }

    btn.append(av, text);
    btn.addEventListener('click', async () => {
      closeModal();
      if (acc.token === active) return openProfile(state.me.id);
      setActiveToken(acc.token);
      location.reload();
    });
    list.append(btn);
  }

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'menu-list__item';
  add.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Добавить аккаунт</span>';
  add.addEventListener('click', () => {
    closeModal();
    openAddNumberModal();
  });
  list.append(add);

  if (accounts.length > 1) {
    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'menu-list__item account-switch__logout';
    logout.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Выйти из этого аккаунта</span>';
    logout.addEventListener('click', async () => {
      closeModal();
      await doLogout();
      const accounts2 = getAccounts().filter(a => a.token !== getActiveToken());
      saveAccounts(accounts2);
      setActiveToken(accounts2[0] ? accounts2[0].token : '');
      if (accounts2.length) location.reload();
      else { setActiveToken(''); el.auth.hidden = false; setAuthMode('login'); }
    });
    list.append(logout);
  }

  openModal('Аккаунты', list);
}

el.menuEmoji.addEventListener('click', () => {
  setMenu(false);
  openSettings('profile');
});

el.menuNewGroup.addEventListener('click', () => {
  setMenu(false);
  createChatDialog('group');
});

el.menuNewChannel.addEventListener('click', () => {
  setMenu(false);
  createChatDialog('channel');
});

el.menuContacts.addEventListener('click', () => {
  setMenu(false);
  state.showAllPeople = true;
  el.search.value = '';
  renderPeople();
  el.search.focus();
});

el.menuCalls.addEventListener('click', () => {
  setMenu(false);
  toast('Звонки пока не поддерживаются');
});

el.menuSaved.addEventListener('click', async () => {
  setMenu(false);
  try {
    const data = await api('/api/saved');
    await loadChats();
    await openChat(data.chat.id);
  } catch (error) {
    toast(error.message);
  }
});

async function openWallet() {
  openFormModal('Монеты', async form => {
    const status = document.createElement('div');
    status.className = 'wallet-status';

    const balanceRow = document.createElement('div');
    balanceRow.className = 'wallet-balance';

    function showLoading(msg) {
      balanceRow.textContent = msg || 'Загрузка…';
    }

    let wallet = null;
    try {
      const data = await api('/api/wallet');
      wallet = data.wallet;
    } catch {
      showLoading('Не удалось загрузить кошелёк');
    }

    const balLabel = document.createElement('div');
    balLabel.className = 'wallet-balance__label';
    balLabel.textContent = 'Баланс';

    const balValue = document.createElement('div');
    balValue.className = 'wallet-balance__value';

    const coin = document.createElement('img');
    coin.className = 'wallet-coin';
    coin.src = '/wcoin.jpg';
    coin.alt = 'wcoin';
    balValue.append(coin, document.createTextNode(wallet ? Number(wallet.balance).toLocaleString('ru-RU') : '—'));

    const walletNo = document.createElement('div');
    walletNo.className = 'wallet-number';
    walletNo.textContent = wallet && wallet.walletNo ? `Кошелёк: ${wallet.walletNo}` : 'Кошелёк: —';

    balanceRow.append(balLabel, balValue, walletNo);
    form.append(balanceRow);

    // Источник пополнения: виртуальная выдача админом описана в dropdown
    const transferBlock = document.createElement('div');
    transferBlock.className = 'wallet-transfer';

    const h = document.createElement('div');
    h.className = 'wallet-transfer__head';
    h.textContent = 'Перевод по номеру кошелька';
    transferBlock.append(h);

    const target = document.createElement('input');
    target.type = 'text';
    target.inputMode = 'numeric';
    target.maxLength = 9;
    target.placeholder = 'Номер кошелька (9 цифр)';
    target.className = 'settings-input';

    const amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.placeholder = 'Сумма в WCOIN';
    amount.className = 'settings-input';

    const note = document.createElement('input');
    note.type = 'text';
    note.maxLength = 200;
    note.placeholder = 'Комментарий (необязательно)';
    note.className = 'settings-input';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = 'Перевести';

    transferBlock.append(settingsField('Куда', target), settingsField('Сумма', amount), settingsField('Комментарий', note));
    form.append(transferBlock);
    form.append(submit);

    // Пополнение собственного кошелька
    const topupBlock = document.createElement('div');
    topupBlock.className = 'wallet-transfer';
    const topupHead = document.createElement('div');
    topupHead.className = 'wallet-transfer__head';
    topupHead.textContent = 'Пополнить кошелёк';
    const topupAmount = document.createElement('input');
    topupAmount.type = 'number';
    topupAmount.min = '1';
    topupAmount.step = '1';
    topupAmount.placeholder = 'Сумма в WCOIN';
    topupAmount.className = 'settings-input';
    const topupBtn = document.createElement('button');
    topupBtn.type = 'button';
    topupBtn.className = 'btn btn--primary';
    topupBtn.textContent = 'Пополнить';
    topupBlock.append(topupHead, settingsField('Сумма', topupAmount), topupBtn);
    form.append(topupBlock);

    topupBtn.addEventListener('click', async () => {
      topupBtn.disabled = true;
      try {
        const res = await api('/api/wallet/topup', { method: 'POST', body: { amount: Number(topupAmount.value) } });
        if (res && res.balance !== undefined) { balValue.replaceChildren(coin, document.createTextNode(Number(res.balance).toLocaleString('ru-RU'))); }
        toast('Кошелёк пополнен');
        topupAmount.value = '';
      } catch (error) {
        toast(error.message);
      }
      topupBtn.disabled = false;
    });

    const history = document.createElement('div');
    history.className = 'wallet-history';
    history.append(Object.assign(document.createElement('div'), { className: 'wallet-history__title', textContent: 'Последние операции' }));
    try {
      const tdata = await api('/api/wallet/transfers');
      const list = tdata.transfers || [];
      if (!list.length) {
        history.append(Object.assign(document.createElement('div'), { className: 'wallet-history__empty', textContent: 'Операций пока нет' }));
      }
      for (const t of list) {
        const row = document.createElement('div');
        row.className = 'wallet-history__row';
        const dir = t.to === state.me.id ? '+' : '−';
        const who = t.from === state.me.id ? 'отправлено' : 'получено';
        row.textContent = `${dir}${t.amount} WCOIN · ${who} · ${new Date(t.createdAt).toLocaleDateString('ru-RU')}`;
        history.append(row);
      }
    } catch {
      /* история не критична */
    }
    form.append(history);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      submit.disabled = true;
      try {
        const res = await api('/api/wallet/transfer', {
          method: 'POST',
          body: { walletNo: target.value.trim(), amount: Number(amount.value), note: note.value.trim() }
        });
        if (res && res.balance !== undefined) { balValue.replaceChildren(coin, document.createTextNode(Number(res.balance).toLocaleString('ru-RU'))); }
        toast('Перевод выполнен');
        form.querySelector('.wallet-history').remove();
        const freshHist = document.createElement('div');
        freshHist.className = 'wallet-history';
        freshHist.append(Object.assign(document.createElement('div'), { className: 'wallet-history__title', textContent: 'Последние операции' }));
        const tdata = await api('/api/wallet/transfers');
        for (const t of (tdata.transfers || [])) {
          const row = document.createElement('div');
          row.className = 'wallet-history__row';
          const dir = t.to === state.me.id ? '+' : '−';
          const who = t.from === state.me.id ? 'отправлено' : 'получено';
          row.textContent = `${dir}${t.amount} WCOIN · ${who} · ${new Date(t.createdAt).toLocaleDateString('ru-RU')}`;
          freshHist.append(row);
        }
        form.append(freshHist);
        target.value = '';
        amount.value = '';
        note.value = '';
      } catch (error) {
        toast(error.message);
      }
      submit.disabled = false;
    });
  });
}

async function openAdminPanel() {
  openFormModal('Админ-панель', async form => {
    const status = document.createElement('div');
    status.className = 'admin-status';

    const giveBlock = document.createElement('div');
    giveBlock.className = 'wallet-transfer';
    giveBlock.append(Object.assign(document.createElement('div'), {
      className: 'wallet-transfer__head', textContent: 'Выдать / списать валюту'
    }));

    const userSel = document.createElement('select');
    userSel.className = 'settings-input admin-select';
    const amount = document.createElement('input');
    amount.type = 'number';
    amount.placeholder = 'Сумма WCOIN (отрицательная — списание)';
    amount.className = 'settings-input';
    const giveBtn = document.createElement('button');
    giveBtn.type = 'button';
    giveBtn.className = 'btn btn--primary';
    giveBtn.textContent = 'Выдать';

    giveBlock.append(settingsField('Пользователь', userSel), settingsField('Сумма', amount), giveBtn);
    form.append(giveBlock);

    const verifyHead = document.createElement('div');
    verifyHead.className = 'wallet-transfer__head';
    verifyHead.textContent = 'Галочки (верификация)';
    form.append(verifyHead);

    const verifyBlock = document.createElement('div');
    verifyBlock.className = 'admin-verify';
    const pad = document.createElement('div');
    pad.className = 'admin-verify__cols';
    pad.innerHTML = '<span>Пользователь</span><span class="admin-badge-key">🔵 Verified</span><span class="admin-badge-key">🌟 Major</span>';
    verifyBlock.append(pad);

    try {
      const data = await api('/api/admin');

      for (const u of (data.users || [])) {
        const row = document.createElement('div');
        row.className = 'admin-user';
        const info = document.createElement('span');
        info.textContent = `${u.displayName} (@${u.username}) — ${u.balance || 0} WCOIN`;
        const vChk = document.createElement('input');
        vChk.type = 'checkbox';
        vChk.title = 'Verified (голубая галочка)';
        vChk.checked = Boolean(u.verified);
        vChk.addEventListener('change', async () => {
          await api('/api/admin/verify', { method: 'POST', body: { kind: 'user', targetId: u.id, badge: 'verified', on: vChk.checked } });
          toast(vChk.checked ? 'Verified выдана' : 'Verified снята');
        });
        const mChk = document.createElement('input');
        mChk.type = 'checkbox';
        mChk.title = 'Major (звёздочка)';
        mChk.checked = Boolean(u.majorVerified);
        mChk.addEventListener('change', async () => {
          await api('/api/admin/verify', { method: 'POST', body: { kind: 'user', targetId: u.id, badge: 'major', on: mChk.checked } });
          toast(mChk.checked ? 'Major выдана' : 'Major снята');
        });
        const chkRow = document.createElement('span');
        chkRow.className = 'admin-badge-set';
        chkRow.append(vChk, mChk);
        row.append(info, chkRow);
        verifyBlock.append(row);
      }

      try {
        const chatsRes = await api('/api/chats');
        for (const chat of (chatsRes.chats || [])) {
          if (chat.kind === 'direct') continue;
          const row = document.createElement('div');
          row.className = 'admin-user';
          const info = document.createElement('span');
          info.textContent = `${chatKindLabel(chat.kind)}: ${chat.title}`;
          const sel = document.createElement('input');
          sel.type = 'checkbox';
          sel.title = 'Verified (голубая галочка)';
          sel.checked = Boolean(chat.verified);
          sel.addEventListener('change', async () => {
            await api('/api/admin/verify', { method: 'POST', body: { kind: 'chat', targetId: chat.id, on: sel.checked } });
            toast(sel.checked ? 'Чат верифицирован' : 'Галочка снята');
          });
          row.append(info, sel);
          verifyBlock.append(row);
        }
      } catch {
        /* чаты могли не загрузиться — не критично */
      }
    } catch (error) {
      status.textContent = error.message || 'Нет доступа';
      form.append(status);
    }

    form.append(verifyBlock);

    giveBtn.addEventListener('click', async () => {
      if (!userSel.value) return toast('Выберите пользователя');
      giveBtn.disabled = true;
      try {
        const res = await api('/api/admin/topup', {
          method: 'POST',
          body: { userId: Number(userSel.value), amount: Number(amount.value) }
        });
        toast('Готово. Баланс: ' + (res.balance || 0) + ' WCOIN');
      } catch (error) {
        toast(error.message);
      }
      giveBtn.disabled = false;
    });

    try {
      const u = await api('/api/admin/users');
      for (const usr of (u.users || [])) {
        const opt = document.createElement('option');
        opt.value = String(usr.id);
        opt.textContent = `${usr.displayName} (@${usr.username}) — ${usr.balance || 0} WCOIN`;
        userSel.append(opt);
      }
    } catch {
      /* селект может быть пуст */
    }
  });
}

el.menuMoney.addEventListener('click', () => {
  setMenu(false);
  openWallet();
});

el.menuMarket.addEventListener('click', () => {
  setMenu(false);
  openSettings('market');
});

el.menuAdmin.addEventListener('click', () => {
  setMenu(false);
  openAdminPanel();
});

el.menuAddAccount.addEventListener('click', () => {
  setMenu(false);
  openAddNumberModal();
});

el.profileBack.addEventListener('click', closeProfile);
el.profileClose.addEventListener('click', closeProfile);

el.profileMore.addEventListener('click', () => {
  const target = state.profileUserId;
  const user = userById(target);

  const shelf = document.createElement('div');
  shelf.className = 'info-rows';

  const block = infoAction('Заблокировать', {
    danger: true,
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.6 5.6l12.8 12.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    onClick: () => {
      closeModal();
      confirmAction({
        title: 'Заблокировать',
        text: `Пользователь @${user.displayName} не сможет писать вам и добавлять в группы. Чат будет удалён из вашего списка.`,
        confirmText: 'Заблокировать'
      }, async () => {
        try {
          await api(`/api/users/${target}/block`, { method: 'POST' });
          toast('Пользователь заблокирован');
          await loadUsers();
          await loadChats();
          closeProfile();
        } catch (error) {
          toast(error.message);
        }
      });
    }
  });
  shelf.append(block);

  const deleteChat = infoAction('Удалить чат', {
    danger: true,
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    onClick: () => {
      closeModal();
      confirmAction({
        title: 'Удалить чат',
        text: 'История переписки будет удалена для вас. Собеседник ничего не увидит.',
        confirmText: 'Удалить'
      }, async () => {
        try {
          const chat = state.chats.find(item => item.peer && item.peer.id === target);
          if (chat) {
            await api(`/api/chats/${chat.id}`, { method: 'DELETE' });
            await loadChats();
          }
          toast('Чат удалён');
        } catch (error) {
          toast(error.message);
        }
      });
    }
  });
  shelf.append(deleteChat);

  const report = infoAction('Пожаловаться', {
    danger: true,
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 10v4M12 17.5h.01M10.3 4L3 17h18L13.7 4a1.6 1.6 0 0 0-3.4 0z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    onClick: () => {
      closeModal();
      confirmAction({
        title: 'Пожаловаться',
        text: 'Жалоба анонимна. Администратор проверит профиль.',
        confirmText: 'Отправить жалобу'
      }, async () => {
        toast('Жалоба отправлена');
      });
    }
  });
  shelf.append(report);

  openModal('Действия', [shelf]);
});
el.profileEdit.addEventListener('click', () => {
  closeProfile();
  openSettings('profile');
});

function openChatOrProfile() {
  const chat = chatById(state.currentChatId);
  if (!chat) return;

  if (chat.kind === 'direct' && chat.peer) openProfile(chat.peer.id);
  else openChannelProfile(chat);
}

el.peerAvatar.addEventListener('click', openChatOrProfile);
el.chatTitles.addEventListener('click', openChatOrProfile);
el.chatTitles.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openChatOrProfile();
  }
});

/* ---------- Старт ---------- */

function openMessageMenu(x, y, message, ctx) {
  const old = document.querySelector('.msg-ctxmenu');
  if (old) old.remove();

  const own = Boolean(ctx.own);
  const isChannel = Boolean(ctx.isChannel);
  const currentChat = ctx.currentChat;
  const canDelete = own || (currentChat && currentChat.canManage);
  const canPin = Boolean(currentChat && currentChat.canManage && currentChat.kind !== 'direct');
  const canEdit = own && !message.body.startsWith(E2E_PREFIX) && !isChannel;
  const isPinned = currentChat && currentChat.pinnedMessageId === message.id;

  const menu = document.createElement('div');
  menu.className = 'msg-ctxmenu';
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - 240)) + 'px';
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - 260)) + 'px';

  const item = (label, icon, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'msg-ctxmenu__item';
    b.innerHTML = icon + '<span>' + label + '</span>';
    b.addEventListener('click', () => { menu.remove(); fn(); });
    return b;
  };

  menu.append(item('Ответить', '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 10l7-6v4c7 0 11 3 11 9h-2c0-4-3-5-9-5v4l-7-6z" fill="currentColor"/></svg>', () => startReply(message)));
  menu.append(item('Переслать', '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 12l16-8-6 8 6 8-16-8z" fill="currentColor"/></svg>', () => openForwardDialog(state.currentChatId, message)));
  if (canEdit) {
    menu.append(item('Редактировать', '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>', () => startEdit(state.currentChatId, message)));
  }
  if (canPin) {
    menu.append(item(isPinned ? 'Открепить' : 'Закрепить', '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M15 4l5 5-7 7H7l-4 4 4-4v-6l8-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>', async () => {
      const next = isPinned ? null : message.id;
      try {
        await api(`/api/chats/${state.currentChatId}`, { method: 'PATCH', body: { pinnedMessageId: next } });
        const chat = chatById(state.currentChatId);
        if (chat) { chat.pinnedMessageId = next; chat.pinnedMessage = next ? message : null; }
        renderPinned(chatById(state.currentChatId));
        toast(isPinned ? 'Закрепление снято' : 'Сообщение закреплено');
      } catch (error) { toast(error.message); }
    }));
  }
  if (canDelete) {
    menu.append(item('Удалить', '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>', () => deleteClientMessage(state.currentChatId, message)));
  }

  document.body.append(menu);
  setTimeout(() => {
    document.addEventListener('pointerdown', function handler(ev) {
      if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', handler); }
    }, { once: true });
  }, 0);
}

async function boot() {
  loadSettings();
  applyTheme();

  try {
    const data = await api('/api/me');
    state.me = data.user;
    await enterApp();
  } catch {
    el.auth.hidden = false;
    setAuthMode('login');
    el.authPhone.focus();
  }
}

boot();
