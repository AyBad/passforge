// Password generator: cryptographically secure randomness (crypto.getRandomValues), no Math.random.

export const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789'
};
export const ALL_SPECIALS = '!@#$%&*?-_+=.,:;/\\|^~()[]{}<>\'"`';
export const DEFAULT_SPECIALS = '!@#$%&*?-_+=.';
const AMBIGUOUS = 'Il1O0o|`\'"';

// letters of the interface language (optional, off by default: many websites refuse them)
export const LOCALE_CHARS = {
  fr: 'éèêàâçùûîïôëœ',
  de: 'äöüßÄÖÜ',
  es: 'ñÑáéíóú¿¡',
  it: 'àèéìòù',
  pt: 'ãõáâéêíóôúç',
  ar: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي',
  zh: '的一是不了人我在有他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长'
};

export const PRESETS = {
  weak: { length: 8, lower: true, upper: false, digits: true, special: false },
  medium: { length: 12, lower: true, upper: true, digits: true, special: false },
  strong: { length: 16, lower: true, upper: true, digits: true, special: true }
};

export function defaultOptions() {
  return {
    mode: 'password', preset: 'strong', ...PRESETS.strong, specials: DEFAULT_SPECIALS, count: 1, noAmbiguous: false, localeChars: false,
    phrase: { preset: 'medium', ...PHRASE_PRESETS.medium, separator: '-', wordLang: null }
  };
}

/** uniform random integer in [0, n) — rejection sampling avoids modulo bias */
export function randInt(n) {
  const max = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
  return x % n;
}
const pick = (arr) => arr[randInt(arr.length)];

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** the character groups chosen in the options (each as an array: Chinese/Arabic letters are whole code points) */
export function groups(o, lang) {
  const clean = (s) => [...new Set([...s])].filter(c => !(o.noAmbiguous && AMBIGUOUS.includes(c)));
  const g = [];
  if (o.lower) g.push(clean(SETS.lower));
  if (o.upper) g.push(clean(SETS.upper));
  if (o.digits) g.push(clean(SETS.digits));
  if (o.special && o.specials) g.push(clean(o.specials));
  if (o.localeChars && LOCALE_CHARS[lang]) g.push(clean(LOCALE_CHARS[lang]));
  return g.filter(x => x.length);
}

export function generate(o, lang) {
  const g = groups(o, lang);
  if (!g.length) return '';
  const len = Math.max(o.length, g.length);
  const pool = g.flat();
  // at least one character of every chosen group, the rest from the whole pool, then shuffled
  const out = g.map(pick);
  while (out.length < len) out.push(pick(pool));
  return shuffle(out).join('');
}

/** entropy in bits, estimated from the kinds of characters actually present */
export function entropy(pw) {
  if (!pw) return 0;
  const chars = [...pw];
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (chars.some(c => ALL_SPECIALS.includes(c) || c === ' ')) pool += 32;
  if (chars.some(c => c.codePointAt(0) > 127)) pool += 100;
  let bits = chars.length * Math.log2(pool || 1);
  // penalties: repeated characters, very short passwords
  const uniq = new Set(chars).size;
  if (uniq < chars.length / 2) bits *= 0.6;
  return Math.round(bits);
}

/** weak < 50 bits ≤ medium < 75 bits ≤ strong */
export function strength(pw) { return strengthFromBits(entropy(pw)); }

/* ---------------- passphrases ---------------- */
// BIP-39 word lists (2048 common words each); accents are removed so that every website accepts them
export const WORD_LANGS = { en: 'English', fr: 'Français', es: 'Español', it: 'Italiano', pt: 'Português' };
const WL = {
  en: () => import('@scure/bip39/wordlists/english.js'),
  fr: () => import('@scure/bip39/wordlists/french.js'),
  es: () => import('@scure/bip39/wordlists/spanish.js'),
  it: () => import('@scure/bip39/wordlists/italian.js'),
  pt: () => import('@scure/bip39/wordlists/portuguese.js')
};
const lists = {};
export async function loadWords(l) {
  if (!WL[l]) l = 'en';
  if (!lists[l]) {
    const raw = (await WL[l]()).wordlist;
    lists[l] = [...new Set(raw.map(w => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()))].filter(w => /^[a-z]{3,9}$/.test(w));
  }
  return lists[l];
}
export const wordLangFor = (uiLang, chosen) => chosen && WL[chosen] ? chosen : (WL[uiLang] ? uiLang : 'en');

export const PHRASE_PRESETS = {
  weak: { words: 3, capitalize: false, addNumber: false, addSymbol: false },
  medium: { words: 5, capitalize: true, addNumber: true, addSymbol: false },
  strong: { words: 7, capitalize: true, addNumber: true, addSymbol: true }
};
export const SEPARATORS = ['-', '.', '_', ' ', '/', '+'];

/** words → { value, bits } (bits = real entropy of the choice) */
export function phrase(o, words) {
  const n = Math.max(2, o.words);
  const w = Array.from({ length: n }, () => pick(words));
  const out = w.map(x => o.capitalize ? x[0].toUpperCase() + x.slice(1) : x);
  let bits = n * Math.log2(words.length);
  if (o.addNumber) { const i = randInt(n); out[i] += String(randInt(100)); bits += Math.log2(100) + Math.log2(n); }
  if (o.addSymbol) {
    const sp = [...(o.specials || DEFAULT_SPECIALS)].filter(c => c !== o.separator);
    if (sp.length) { const i = randInt(n); out[i] += pick(sp); bits += Math.log2(sp.length) + Math.log2(n); }
  }
  return { value: out.join(o.separator ?? '-'), bits: Math.round(bits) };
}
export const strengthFromBits = (b) => b >= 75 ? 'strong' : b >= 50 ? 'medium' : 'weak';
