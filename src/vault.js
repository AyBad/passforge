import * as store from './store.js';

/*
 * Encrypted local vault (Web Crypto, all on the device).
 *  - Each password is encrypted with its own AES-256-GCM key, itself encrypted with an RSA-OAEP public key.
 *    → new passwords can be saved without the PIN, but reading them needs the private key.
 *  - The private key is encrypted with a key derived from the PIN (PBKDF2-SHA256). Without a PIN yet, it is
 *    stored as is (and the list asks the user to create a PIN before opening).
 *  - A wrong PIN cannot decrypt the private key (AES-GCM authentication fails).
 */
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
const PIN_ITER = 250000;

let pub = null, priv = null; // priv is only in memory while the list is unlocked

async function deriveKey(secret, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function init() {
  let spki = await store.get('pubKey');
  if (!spki) {
    const kp = await crypto.subtle.generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
    spki = b64(await crypto.subtle.exportKey('spki', kp.publicKey));
    await store.set('privKey', b64(await crypto.subtle.exportKey('pkcs8', kp.privateKey)));
    await store.set('pubKey', spki);
    await store.set('entries', []);
  }
  pub = await crypto.subtle.importKey('spki', unb64(spki), RSA, false, ['encrypt']);
}

export async function hasPin() { return !!(await store.get('privKeyEnc')); }
export async function pinLength() { return (await store.get('pinLen')) || 0; }
export const isUnlocked = () => !!priv;
export function lock() { priv = null; }

const importPriv = (bytes) => crypto.subtle.importKey('pkcs8', bytes, RSA, false, ['decrypt']);

/** open without a PIN (only possible when no PIN has been defined yet) */
export async function unlockNoPin() {
  const p = await store.get('privKey');
  if (!p) return false;
  priv = await importPriv(unb64(p));
  return true;
}

/* ---- wrong PIN attempts: growing waiting time ---- */
export async function lockedFor() {
  const until = (await store.get('pinLockUntil')) || 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}
async function registerFail() {
  const n = ((await store.get('pinFails')) || 0) + 1;
  await store.set('pinFails', n);
  if (n >= 5) await store.set('pinLockUntil', Date.now() + 30000 * 2 ** Math.min(n - 5, 6)); // 30 s, 1 min, 2 min… up to 32 min
  return n;
}

async function decryptPrivBytes(pin) {
  const e = await store.get('privKeyEnc');
  const key = await deriveKey(pin, unb64(e.salt), e.iter);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) }, key, unb64(e.ct)));
}

/** returns true when the PIN is right; false otherwise */
export async function unlock(pin) {
  if (await lockedFor()) return false;
  try {
    const bytes = await decryptPrivBytes(pin);
    priv = await importPriv(bytes);
    await store.set('pinFails', 0); await store.del('pinLockUntil');
    return true;
  } catch { await registerFail(); return false; }
}
export async function checkPin(pin) {
  if (await lockedFor()) return false;
  try { await decryptPrivBytes(pin); await store.set('pinFails', 0); return true; } catch { await registerFail(); return false; }
}

async function storePrivWithPin(privBytes, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt, PIN_ITER);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, privBytes);
  await store.set('privKeyEnc', { salt: b64(salt), iv: b64(iv), ct: b64(ct), iter: PIN_ITER });
  await store.set('pinLen', pin.length);
  await store.set('pinFails', 0); await store.del('pinLockUntil');
  await store.del('privKey');
}

/** first PIN (no PIN yet) */
export async function setPin(pin) {
  const p = await store.get('privKey');
  await storePrivWithPin(unb64(p), pin);
}
export async function changePin(oldPin, newPin) {
  let bytes;
  try { bytes = await decryptPrivBytes(oldPin); } catch { await registerFail(); return false; }
  await storePrivWithPin(bytes, newPin);
  return true;
}
export async function removePin(pin) {
  let bytes;
  try { bytes = await decryptPrivBytes(pin); } catch { await registerFail(); return false; }
  await store.set('privKey', b64(bytes));
  await store.del('privKeyEnc'); await store.del('pinLen');
  return true;
}

/* ---- entries ---- */
async function seal(obj) {
  const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)));
  const wk = await crypto.subtle.encrypt(RSA, pub, await crypto.subtle.exportKey('raw', k));
  return { k: b64(wk), iv: b64(iv), ct: b64(ct) };
}
async function open(blob) {
  const raw = await crypto.subtle.decrypt(RSA, priv, unb64(blob.k));
  const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, k, unb64(blob.ct))));
}
const newId = () => b64(crypto.getRandomValues(new Uint8Array(9))).replace(/[+/=]/g, '');

/*
 * Unique names: the names stay encrypted, so each entry also keeps a keyed fingerprint of its normalised name
 * (HMAC-SHA256 with a random key of this install). It lets the app refuse a duplicate name before the PIN is entered.
 */
export const normName = (n) => String(n).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
let macKey = null;
async function nameMac(name) {
  if (!macKey) {
    let raw = await store.get('nameKey');
    if (!raw) { raw = b64(crypto.getRandomValues(new Uint8Array(32))); await store.set('nameKey', raw); }
    macKey = await crypto.subtle.importKey('raw', unb64(raw), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }
  return b64(await crypto.subtle.sign('HMAC', macKey, enc.encode(normName(name))));
}
/** true when another entry already has this name (case and spaces ignored) */
export async function nameTaken(name, exceptId = null) {
  const h = await nameMac(name);
  return ((await store.get('entries')) || []).some(e => e.nh === h && e.id !== exceptId);
}

export async function count() { return ((await store.get('entries')) || []).length; }

export async function add({ name, value }) {
  if (await nameTaken(name)) throw new Error('duplicate');
  const list = (await store.get('entries')) || [];
  const now = Date.now();
  list.push({ id: newId(), created: now, updated: now, nh: await nameMac(name), blob: await seal({ name, value }) });
  await store.set('entries', list);
}

/** decrypted list (the vault must be unlocked) */
export async function list() {
  if (!priv) throw new Error('locked');
  const raw = (await store.get('entries')) || [];
  const out = [];
  let migrated = false;
  for (const e of raw) {
    try {
      const d = await open(e.blob);
      if (!e.nh) { e.nh = await nameMac(d.name); migrated = true; } // entries saved before v1.3
      out.push({ id: e.id, created: e.created, updated: e.updated, ...d });
    } catch (err) { console.warn('entry', err); }
  }
  if (migrated) await store.set('entries', raw);
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export async function update(id, { name, value }) {
  const raw = (await store.get('entries')) || [];
  const e = raw.find(x => x.id === id);
  if (!e) return;
  if (await nameTaken(name, id)) throw new Error('duplicate');
  e.blob = await seal({ name, value }); e.nh = await nameMac(name); e.updated = Date.now();
  await store.set('entries', raw);
}
export async function remove(id) { return removeMany([id]); }
export async function removeMany(ids) {
  const set_ = new Set(ids);
  await store.set('entries', ((await store.get('entries')) || []).filter(x => !set_.has(x.id)));
}

/* ---- encrypted export file (.pfg), readable only with the export password ---- */
const EXPORT_ITER = 300000;
export async function exportFile(entries, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, EXPORT_ITER);
  const data = entries.map(({ name, value, created, updated }) => ({ name, value, created, updated }));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  return JSON.stringify({ app: 'PassForge', format: 1, count: data.length, date: new Date().toISOString(), kdf: 'PBKDF2-SHA256', iter: EXPORT_ITER, salt: b64(salt), iv: b64(iv), data: b64(ct) });
}
/** returns the entries, or throws 'format' / 'password' */
export async function readExport(text, password) {
  let f;
  try { f = JSON.parse(text); } catch { throw new Error('format'); }
  if (!f || f.app !== 'PassForge' || !f.data) throw new Error('format');
  try {
    const key = await deriveKey(password, unb64(f.salt), f.iter || EXPORT_ITER);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, key, unb64(f.data));
    return JSON.parse(dec.decode(plain));
  } catch { throw new Error('password'); }
}
export function peekExport(text) {
  try { const f = JSON.parse(text); return f && f.app === 'PassForge' ? f : null; } catch { return null; }
}

/** adds imported entries: exact duplicates (same name and password) are skipped;
 *  a name already used by another password gets a number: "Gmail (2)" */
export async function importEntries(items) {
  const existing = await list();
  const pairs = new Set(existing.map(e => normName(e.name) + '\u0000' + e.value));
  const names = new Set(existing.map(e => normName(e.name)));
  const raw = (await store.get('entries')) || [];
  let added = 0, skipped = 0, renamed = 0;
  for (const it of items) {
    if (!it || typeof it.name !== 'string' || typeof it.value !== 'string' || !it.name.trim()) { skipped++; continue; }
    let name = it.name.trim();
    if (pairs.has(normName(name) + '\u0000' + it.value)) { skipped++; continue; }
    if (names.has(normName(name))) {
      let k = 2;
      while (names.has(normName(`${name} (${k})`))) k++;
      name = `${name} (${k})`; renamed++;
    }
    names.add(normName(name)); pairs.add(normName(name) + '\u0000' + it.value);
    const now = Date.now();
    raw.push({ id: newId(), created: it.created || now, updated: it.updated || now, nh: await nameMac(name), blob: await seal({ name, value: it.value }) });
    added++;
  }
  await store.set('entries', raw);
  return { added, skipped, renamed };
}
