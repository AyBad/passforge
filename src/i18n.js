import en from './locales/en.js';

export const LANGS = {
  fr: 'Français', en: 'English', ar: 'العربية', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', zh: '中文'
};
const RTL = ['ar'];
const loaders = import.meta.glob('./locales/*.js');

let dict = en, current = 'en';

export function phoneLang() {
  const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS[l] ? l : 'en';
}

export async function setLang(lang) {
  current = LANGS[lang] ? lang : 'en';
  try { dict = current === 'en' ? en : (await loaders[`./locales/${current}.js`]()).default; } catch (e) { console.warn('lang', e); dict = en; current = 'en'; }
  document.documentElement.lang = current;
  document.documentElement.dir = RTL.includes(current) ? 'rtl' : 'ltr';
}
export const lang = () => current;

/** t('key', {n: 3}) → text with {n} replaced; falls back to English */
export function t(key, vars) {
  let s = dict[key] ?? en[key] ?? key;
  if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
  return s;
}
