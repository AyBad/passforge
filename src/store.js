import { Preferences } from '@capacitor/preferences';

// Local key/value storage only: Android SharedPreferences (excluded from backups) or the browser's localStorage.
// Nothing is ever sent over the network.
export async function get(key, def = null) {
  const { value } = await Preferences.get({ key });
  if (value == null) return def;
  try { return JSON.parse(value); } catch { return def; }
}
export async function set(key, val) { await Preferences.set({ key, value: JSON.stringify(val) }); }
export async function del(key) { await Preferences.remove({ key }); }
export async function clearAll() { await Preferences.clear(); }

/* ---- settings ---- */
const DEFAULTS = {
  lang: null,          // null = phone language
  theme: 'system',     // system | light | dark
  clipClear: 30,       // seconds, 0 = never
  onboarded: false,
  profile: { first: '', last: '' },
  pro: false,
  gen: null            // last generator options
};
let cache = null;
export async function settings() {
  if (!cache) cache = Object.assign({}, DEFAULTS, (await get('settings')) || {});
  return cache;
}
export async function saveSettings(patch) {
  const s = await settings();
  Object.assign(s, patch);
  await set('settings', s);
  return s;
}
export function resetCache() { cache = null; }
