import './style.css';
import { App } from '@capacitor/app';
import * as store from './store.js';
import * as vault from './vault.js';
import { t, setLang, lang, LANGS, phoneLang } from './i18n.js';
import { generate, strength, entropy, defaultOptions, PRESETS, ALL_SPECIALS, DEFAULT_SPECIALS, LOCALE_CHARS, PHRASE_PRESETS, SEPARATORS, WORD_LANGS, loadWords, wordLangFor, phrase, strengthFromBits } from './gen.js';
import { $, $$, esc, ICON, modal, confirmBox, alertBox, toast, busy, pinPad, slides } from './ui.js';
import { showBanner, hideBanner, removeAdsForPro, afterSave, prepareInterstitial } from './ads.js';
import * as billing from './billing.js';
import { startSplash, endSplash } from './splash.js';
import { noteFirstUse, maybeAskReview, openStorePage } from './review.js';
import { native, copy, saveFile, shareFile, pickFile, inExternal, bio } from './device.js';

const VERSION = __APP_VERSION__;
let S;                 // settings
let screen = 'home';   // current screen
let opt;               // generator options
let results = [];      // generated passwords (not saved yet)
let editTarget = null; // {id, name} when a saved password is being re-generated

const app = () => $('#app');

/* ================= start ================= */
async function start() {
  S = await store.settings();
  await setLang(S.lang || phoneLang());
  startSplash(t('splashTag'));
  applyTheme();
  await vault.init();
  const d0 = defaultOptions();
  opt = Object.assign(d0, S.gen || {});
  opt.phrase = Object.assign(defaultOptions().phrase, (S.gen && S.gen.phrase) || {});
  setupSystem();
  if ('serviceWorker' in navigator && !native && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  noteFirstUse();
  if (!S.onboarded) { await endSplash(); await onboarding(); home(); }
  else { home(); await endSplash(); }
  prepareInterstitial();
  // Google Play says whether this account owns Pro (reinstall, new phone, refund)
  billing.owned().then(async (o) => {
    if (o === null || o === S.pro) return;
    S = await store.saveSettings({ pro: o });
    if (o) removeAdsForPro(); else if (screen === 'home') showBanner();
  });
}

function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = $('meta[name=theme-color]');
  if (m && !$('#splash')) m.content = dark ? '#0f1420' : '#ffffff';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S && S.theme === 'system' && applyTheme());

function setupSystem() {
  // the list locks itself as soon as the app goes to the background
  const toBackground = () => {
    if (inExternal()) return;
    vault.lock();
    if (screen === 'vault' || screen === 'regen') { editTarget = null; home(); }
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) toBackground(); });
  if (native) {
    App.addListener('appStateChange', ({ isActive }) => { if (!isActive) toBackground(); });
    App.addListener('backButton', () => {
      const pp = $('.pinpad'); if (pp) { $('.pp-close', pp).click(); return; }
      const m = $$('.modal-back').pop(); if (m) { m.click(); return; }
      if ($('.slides')) return;
      if ($('.drawer.open')) { closeDrawer(); return; }
      if (screen !== 'home') { const nav = $('.bar .nav'); if (nav) nav.click(); else home(); return; }
      App.minimizeApp();
    });
  }
}

/* ================= welcome ================= */
const welcomeSlides = () => [
  { icon: ICON.shield, title: t('w1Title'), text: t('w1Text') },
  { icon: ICON.wifiOff, title: t('w2Title'), text: t('w2Text'), tone: 'green' },
  { icon: ICON.lock, title: t('w3Title'), text: t('w3Text'), tone: 'violet' },
  { icon: ICON.upload, title: t('w4Title'), text: t('w4Text'), tone: 'orange' }
];

async function onboarding() {
  await slides(welcomeSlides(), { finish: t('start'), skip: false });
  await profileDialog(true);
  const create = await confirmBox(t('pinNowTitle'), t('pinNowText'), { ok: t('pinCreate'), cancel: t('later') });
  if (create && await createPin()) { await offerBio(lastPin); lastPin = null; }
  S = await store.saveSettings({ onboarded: true });
}

function profileDialog(first = false) {
  return new Promise(res => {
    const p = S.profile || {};
    const m = modal(`<div class="m-ic">${ICON.user}</div><h2>${t('profile')}</h2><p class="lead">${t('profileText')}</p>
      <label class="field"><span>${t('firstName')}</span><input class="fn" autocomplete="given-name" value="${esc(p.first)}"></label>
      <label class="field"><span>${t('lastName')}</span><input class="ln" autocomplete="family-name" value="${esc(p.last)}"></label>
      <div class="actions">${first ? `<button class="btn ghost c">${t('later')}</button>` : `<button class="btn ghost c">${t('cancel')}</button>`}<button class="btn primary o">${t('save')}</button></div>`,
      { dismiss: !first, onClose: () => res() });
    $('.c', m.el).onclick = () => m.close();
    $('.o', m.el).onclick = async () => {
      S = await store.saveSettings({ profile: { first: $('.fn', m.el).value.trim(), last: $('.ln', m.el).value.trim() } });
      m.close();
    };
  });
}

/* ================= PIN ================= */
async function createPin() {
  const pin = await pinPad({ mode: 'create', title: t('pinCreateTitle'), sub: t('pinCreateSub') });
  if (!pin) return false;
  busy(true, t('securing'));
  try { await vault.setPin(pin); await vault.unlock(pin); } finally { busy(false); }
  toast(t('pinSet'));
  lastPin = pin;
  return true;
}
let lastPin = null; // only between the PIN creation and the fingerprint offer, then forgotten

const bioTexts = (sub) => ({ title: t('bioTitle'), subtitle: sub || t('bioSub'), cancel: t('usePin') });

/** fingerprint / face callback for the PIN pad (null when not set up) */
async function bioFor(sub) {
  const st = await bio.status();
  if (!st.enrolled) return null;
  return async () => {
    try { return await bio.unlock(bioTexts(sub)); }
    catch { toast(t('bioInvalid')); return null; }
  };
}

async function askPin(title = t('pinEnter'), check = (p) => vault.unlock(p)) {
  return pinPad({
    mode: 'verify', title, length: await vault.pinLength(),
    check, lockedFor: vault.lockedFor, onForgot: forgotPin, bio: await bioFor()
  });
}

/** asks the PIN (or fingerprint) without opening the list; resolves with the PIN or null */
async function verifyPin(title = t('pinEnter')) {
  return pinPad({ mode: 'verify', title, length: await vault.pinLength(), check: vault.checkPin, lockedFor: vault.lockedFor, bio: await bioFor() });
}

/** proposes fingerprint / face after a PIN is created (when the phone has it) */
async function offerBio(pin) {
  const st = await bio.status();
  if (!st.available || st.enrolled) return;
  if (!(await confirmBox(t('bioOfferTitle'), t('bioOfferText'), { ok: t('bioEnable'), cancel: t('later') }))) return;
  if (!pin) pin = await verifyPin();
  if (!pin) return;
  try { if (await bio.enroll(pin, bioTexts(t('bioEnrollSub')))) toast(t('bioOn')); }
  catch (e) { alertBox(t('bioUnlock'), e.message); }
}

async function forgotPin() {
  const ok = await confirmBox(t('forgotPin'), t('forgotText'), { ok: t('resetApp'), danger: true });
  if (ok) await resetApp(true);
}

/** opens the password list: PIN required */
async function openVault() {
  // the PIN (or fingerprint / face) is asked every time the list is opened
  vault.lock();
  if (!(await vault.hasPin())) {
    const create = await confirmBox(t('pinNeededTitle'), t('pinNeededText'), { ok: t('pinCreate'), cancel: t('later') });
    if (!create) return;
    if (!(await createPin())) return;
    await offerBio(lastPin); lastPin = null;
    return vaultScreen();
  }
  if (await askPin()) vaultScreen();
}

/* ================= layout ================= */
function shell({ title, back, actions = '', body, cls = '' }) {
  if (screen !== 'vault' && screen !== 'regen') vault.lock();
  app().innerHTML = `<header class="bar">
      <button class="icon-btn nav" aria-label="menu">${back ? ICON.back : ICON.menu}</button>
      <h1>${title}</h1><div class="bar-act">${actions}</div></header>
    <main class="content ${cls}">${body}</main>`;
  $('.nav').onclick = back || openDrawer;
  window.scrollTo(0, 0);
}

function openDrawer() {
  let d = $('.drawer');
  if (!d) { d = document.createElement('div'); d.className = 'drawer'; document.body.appendChild(d); }
  const p = S.profile || {};
  const name = [p.first, p.last].filter(Boolean).join(' ');
  const initials = ((p.first || '')[0] || '') + ((p.last || '')[0] || '');
  d.innerHTML = `<div class="dr-panel">
      <div class="dr-head"><div class="avatar">${initials ? esc(initials.toUpperCase()) : ICON.user}</div>
        <div><b>${name ? t('hello', { name: esc(p.first || name) }) : t('appName')}</b><small>${S.pro ? '<em class="pro-tag">PRO</em>' : t('freeVersion')}</small></div></div>
      <nav>
        <button data-a="home" class="${screen === 'home' ? 'on' : ''}">${ICON.wand}<span>${t('generator')}</span></button>
        <button data-a="vault" class="${screen === 'vault' ? 'on' : ''}">${ICON.key}<span>${t('myPasswords')}</span></button>
        <hr>
        <button data-a="settings">${ICON.gear}<span>${t('settings')}</span></button>
        <button data-a="pro">${ICON.star}<span>${t('proMode')}</span>${S.pro ? '<em class="pro-tag">✓</em>' : '<em class="pro-tag">PRO</em>'}</button>
        <hr>
        <button data-a="tuto">${ICON.book}<span>${t('tutorial')}</span></button>
        <button data-a="about">${ICON.info}<span>${t('about')}</span></button>
        ${native ? `<button data-a="rate">${ICON.heart}<span>${t('rateApp')}</span></button>` : ''}
      </nav><p class="dr-foot">PassForge ${VERSION}</p></div>`;
  requestAnimationFrame(() => d.classList.add('open'));
  d.onclick = (e) => { if (e.target === d) closeDrawer(); };
  $$('nav button', d).forEach(b => b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'rate') { openStorePage(); return; }
    // back from the chosen page → the page where the menu was opened, with the menu shown again
    const origin = { settings: settingsScreen, pro: proScreen, about: aboutScreen }[screen] || home;
    menuReturn = a === 'home' ? null : origin;
    pageBack = null;
    closeDrawer();
    ({ home, vault: openVault, settings: settingsScreen, pro: proScreen, tuto: tutorial, about: aboutScreen })[a]();
  });
}
let menuReturn = null; // page to show again (with the menu open) when coming back from a menu entry
let pageBack = null;   // set when a page is opened from another page (e.g. Pro from the settings)
async function goBack() {
  if (pageBack) { const f = pageBack; pageBack = null; return f(); }
  const f = menuReturn; menuReturn = null;
  if (!f) return home();
  await f();
  openDrawer();
}
function closeDrawer() { const d = $('.drawer'); if (d) d.classList.remove('open'); }


/* ================= generator ================= */
const KINDS = [['lower', 'a-z'], ['upper', 'A-Z'], ['digits', '0-9'], ['special', '#$&']];
const isPhrase = () => opt.mode === 'passphrase';

function matchPreset() {
  if (isPhrase()) {
    const ph = opt.phrase;
    for (const [k, p] of Object.entries(PHRASE_PRESETS)) if (Object.keys(p).every(f => ph[f] === p[f])) return k;
    return 'custom';
  }
  for (const [k, p] of Object.entries(PRESETS)) {
    if (Object.keys(p).every(f => opt[f] === p[f]) && (!opt.special || opt.specials === DEFAULT_SPECIALS) && !opt.localeChars && !opt.noAmbiguous) return k;
  }
  return 'custom';
}
let saveOptTimer;
function persistOpt() { clearTimeout(saveOptTimer); saveOptTimer = setTimeout(() => store.saveSettings({ gen: opt }), 400); }

const sepLabel = (c) => c === ' ' ? t('sepSpace') : c;

function home() {
  screen = editTarget ? 'regen' : 'home';
  const hasLocale = !!LOCALE_CHARS[lang()];
  if (!hasLocale) opt.localeChars = false;
  const ph = opt.phrase;
  shell({
    title: editTarget ? t('regenerate') : t('generator'),
    back: editTarget ? () => { editTarget = null; results = []; vault.isUnlocked() ? vaultScreen() : openVault(); } : null,
    actions: editTarget ? '' : `<button class="icon-btn vault-btn" aria-label="${t('myPasswords')}">${ICON.key}</button>`,
    body: `
      ${editTarget ? `<div class="notice">${ICON.edit}<span>${t('regenFor', { name: `<b>${esc(editTarget.name)}</b>` })}</span></div>` : ''}
      <div class="seg modes">${['password', 'passphrase'].map(m => `<button data-m="${m}">${m === 'password' ? ICON.key : ICON.book}<span>${t('mode_' + m)}</span></button>`).join('')}</div>
      <section class="card">
        <h3>${t('level')}</h3>
        <div class="seg presets">${['weak', 'medium', 'strong', 'custom'].map(k => `<button data-p="${k}" class="lvl-${k}">${t(k)}</button>`).join('')}</div>

        <div class="pw-opts">
          <div class="len-row"><h3>${t('length')}</h3>
            <div class="stepper"><button class="icon-btn sm len-m">${ICON.minus}</button><b class="len-v"></b><button class="icon-btn sm len-p">${ICON.plus}</button></div></div>
          <input type="range" class="len" min="4" max="64" step="1">
          <h3>${t('characters')}</h3>
          <div class="kinds">${KINDS.map(([k, ex]) => `<button class="kind" data-k="${k}"><span class="kc">${ICON.check}</span><span><b>${t('k_' + k)}</b><small dir="ltr">${ex}</small></span></button>`).join('')}</div>
          <div class="specials">
            <div class="sp-head"><h3>${t('specialList')}</h3><span><button class="link sp-all">${t('all')}</button> · <button class="link sp-def">${t('default')}</button></span></div>
            <div class="sp-grid" dir="ltr">${[...ALL_SPECIALS].map(c => `<button class="sp" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
          </div>
          <label class="switch-row"><span><b>${t('noAmbiguous')}</b><small>${t('noAmbiguousHint')}</small></span><input type="checkbox" class="amb"><i></i></label>
          ${hasLocale ? `<label class="switch-row"><span><b>${t('localeChars')}</b><small>${t('localeCharsHint')} <span dir="auto">${esc([...LOCALE_CHARS[lang()]].slice(0, 6).join(' '))}…</span></small></span><input type="checkbox" class="loc"><i></i></label>` : ''}
        </div>

        <div class="ph-opts">
          <div class="len-row"><h3>${t('words')}</h3>
            <div class="stepper"><button class="icon-btn sm w-m">${ICON.minus}</button><b class="w-v"></b><button class="icon-btn sm w-p">${ICON.plus}</button></div></div>
          <input type="range" class="wn" min="3" max="10" step="1">
          <h3>${t('wordLang')}</h3>
          <div class="chips wl">${Object.entries(WORD_LANGS).map(([k, v]) => `<button class="chip" data-l="${k}">${v}</button>`).join('')}</div>
          <h3>${t('separator')}</h3>
          <div class="chips sep" dir="ltr">${SEPARATORS.map(c => `<button class="chip mono" data-s="${esc(c)}">${esc(sepLabel(c))}</button>`).join('')}</div>
          <label class="switch-row"><span><b>${t('capitalize')}</b><small>${t('capitalizeHint')}</small></span><input type="checkbox" class="cap"><i></i></label>
          <label class="switch-row"><span><b>${t('addNumber')}</b><small>${t('addNumberHint')}</small></span><input type="checkbox" class="num"><i></i></label>
          <label class="switch-row"><span><b>${t('addSymbol')}</b><small>${t('addSymbolHint')}</small></span><input type="checkbox" class="sym"><i></i></label>
        </div>

        ${editTarget ? '' : `<div class="len-row"><h3>${t('howMany')}</h3><div class="seg counts">${[1, 2, 3, 4, 5].map(n => `<button data-n="${n}">${n}</button>`).join('')}</div></div>`}
      </section>
      <button class="btn primary big gen">${ICON.refresh}<span>${t('generate')}</span></button>
      <div class="results"></div>`
  });
  if (!editTarget) $('.vault-btn').onclick = () => { menuReturn = null; pageBack = null; openVault(); };

  const sync = () => {
    const P = isPhrase();
    $$('.modes button').forEach(b => b.classList.toggle('on', b.dataset.m === opt.mode));
    $('.pw-opts').classList.toggle('hide', P);
    $('.ph-opts').classList.toggle('hide', !P);
    const pre = matchPreset();
    if (P) ph.preset = pre; else opt.preset = pre;
    $$('.presets button').forEach(b => b.classList.toggle('on', b.dataset.p === pre));
    $('.len').value = opt.length; $('.len-v').textContent = opt.length;
    $$('.kind').forEach(b => b.classList.toggle('on', !!opt[b.dataset.k]));
    $('.specials').classList.toggle('hide', !opt.special);
    $$('.sp').forEach(b => b.classList.toggle('on', opt.specials.includes(b.dataset.c)));
    $('.amb').checked = opt.noAmbiguous;
    if ($('.loc')) $('.loc').checked = opt.localeChars;
    $('.wn').value = ph.words; $('.w-v').textContent = ph.words;
    const wl = wordLangFor(lang(), ph.wordLang);
    $$('.wl .chip').forEach(b => b.classList.toggle('on', b.dataset.l === wl));
    $$('.sep .chip').forEach(b => b.classList.toggle('on', b.dataset.s === ph.separator));
    $('.cap').checked = ph.capitalize; $('.num').checked = ph.addNumber; $('.sym').checked = ph.addSymbol;
    $$('.counts button').forEach(b => b.classList.toggle('on', +b.dataset.n === opt.count));
    persistOpt();
  };
  const changed = () => { sync(); run(); };
  $$('.modes button').forEach(b => b.onclick = () => { if (opt.mode === b.dataset.m) return; opt.mode = b.dataset.m; changed(); });
  $$('.presets button').forEach(b => b.onclick = () => {
    const p = b.dataset.p;
    if (isPhrase()) {
      if (p !== 'custom') Object.assign(ph, PHRASE_PRESETS[p]);
      else $('.ph-opts').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (p !== 'custom') Object.assign(opt, PRESETS[p], { specials: DEFAULT_SPECIALS, localeChars: false, noAmbiguous: false });
    else $('.kinds').scrollIntoView({ behavior: 'smooth', block: 'center' });
    changed();
  });
  // password options
  $('.len').oninput = (e) => { opt.length = +e.target.value; sync(); };
  $('.len').onchange = run;
  $('.len-m').onclick = () => { opt.length = Math.max(4, opt.length - 1); changed(); };
  $('.len-p').onclick = () => { opt.length = Math.min(64, opt.length + 1); changed(); };
  $$('.kind').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    const on = KINDS.filter(([x]) => opt[x]).length;
    if (opt[k] && on === 1 && !opt.localeChars) { toast(t('oneKind')); return; }
    opt[k] = !opt[k];
    if (k === 'special' && opt.special && !opt.specials) opt.specials = DEFAULT_SPECIALS;
    changed();
  });
  $$('.sp').forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    if (opt.specials.includes(c)) {
      if ([...opt.specials].length === 1) { toast(t('oneSpecial')); return; }
      opt.specials = [...opt.specials].filter(x => x !== c).join('');
    } else opt.specials += c;
    changed();
  });
  $('.sp-all').onclick = () => { opt.specials = ALL_SPECIALS; changed(); };
  $('.sp-def').onclick = () => { opt.specials = DEFAULT_SPECIALS; changed(); };
  $('.amb').onchange = (e) => { opt.noAmbiguous = e.target.checked; changed(); };
  if ($('.loc')) $('.loc').onchange = (e) => { opt.localeChars = e.target.checked; changed(); };
  // passphrase options
  $('.wn').oninput = (e) => { ph.words = +e.target.value; sync(); };
  $('.wn').onchange = run;
  $('.w-m').onclick = () => { ph.words = Math.max(3, ph.words - 1); changed(); };
  $('.w-p').onclick = () => { ph.words = Math.min(10, ph.words + 1); changed(); };
  $$('.wl .chip').forEach(b => b.onclick = () => { ph.wordLang = b.dataset.l; changed(); });
  $$('.sep .chip').forEach(b => b.onclick = () => { ph.separator = b.dataset.s; changed(); });
  $('.cap').onchange = (e) => { ph.capitalize = e.target.checked; changed(); };
  $('.num').onchange = (e) => { ph.addNumber = e.target.checked; changed(); };
  $('.sym').onchange = (e) => { ph.addSymbol = e.target.checked; changed(); };

  $$('.counts button').forEach(b => b.onclick = () => { opt.count = +b.dataset.n; changed(); });
  $('.gen').onclick = async () => { await run(); $('.results').scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  sync();
  if (results.length) drawResults(); else run();
  if (editTarget) hideBanner(); else showBanner();
}

/** one new value → { value, bits } (bits only known for passphrases) */
async function makeOne() {
  if (!isPhrase()) return { value: generate(opt, lang()), bits: null };
  const words = await loadWords(wordLangFor(lang(), opt.phrase.wordLang));
  return phrase({ ...opt.phrase, specials: opt.specials || DEFAULT_SPECIALS }, words);
}

let runId = 0;
async function run() {
  const id = ++runId;
  const n = editTarget ? 1 : opt.count;
  const out = [];
  for (let i = 0; i < n; i++) out.push(await makeOne());
  if (id !== runId) return; // a newer generation started meanwhile
  results = out;
  drawResults();
}

function meter(pw, known) {
  const bits = known ?? entropy(pw), s = known != null ? strengthFromBits(known) : strength(pw);
  return `<div class="meter m-${s}"><div class="m-bar"><i></i><i></i><i></i></div><span>${t(s)} · ${bits} bits</span></div>`;
}

function drawResults() {
  const box = $('.results');
  if (!box) return;
  box.innerHTML = `<h3 class="res-title">${results.length > 1 ? t('chooseOne') : t('result')}</h3>` + results.map((r, i) => `
    <div class="res card" data-i="${i}">
      <textarea class="pw-field" rows="1" dir="ltr" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${t('password')}">${esc(r.value)}</textarea>
      <div class="res-meter">${meter(r.value, r.bits)}</div>
      <div class="res-act">
        <button class="icon-btn r-new" title="${t('regenerate')}">${ICON.refresh}</button>
        <button class="btn ghost r-copy">${ICON.copy}<span>${t('copy')}</span></button>
        <button class="btn primary r-save">${editTarget ? ICON.check : ICON.save}<span>${editTarget ? t('replace') : t('save')}</span></button>
      </div>
      <small class="edit-hint">${t('editHint')}</small>
    </div>`).join('');
  $$('.res', box).forEach(card => {
    const i = +card.dataset.i, ta = $('.pw-field', card);
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    requestAnimationFrame(fit);
    const show = () => { $('.res-meter', card).innerHTML = meter(results[i].value, results[i].bits); fit(); };
    // a hand-edited value: the strength is estimated from its characters
    ta.oninput = () => { ta.value = ta.value.replace(/[\r\n]/g, ''); results[i] = { value: ta.value, bits: null }; show(); };
    $('.r-new', card).onclick = async () => { results[i] = await makeOne(); ta.value = results[i].value; show(); };
    $('.r-copy', card).onclick = async () => { const v = results[i].value; if (!v) return; await copy(v, S.clipClear); toast(S.clipClear ? t('copiedClear', { s: S.clipClear }) : t('copied')); };
    $('.r-save', card).onclick = () => { const v = results[i].value; if (v) editTarget ? replaceSaved(v) : saveDialog(v, results[i].bits); };
  });
}

function saveDialog(value, bits = null) {
  const m = modal(`<h2>${t('savePw')}</h2>
    <label class="field"><span>${t('pwName')}</span><input class="nm" maxlength="80" placeholder="${t('pwNameHint')}" autocomplete="off"></label>
    <p class="err-msg nm-err"></p>
    <div class="preview" dir="ltr">${esc(value)}</div>${meter(value, bits)}
    <div class="actions"><button class="btn ghost c">${t('cancel')}</button><button class="btn primary o">${t('save')}</button></div>`);
  const nm = $('.nm', m.el);
  setTimeout(() => nm.focus(), 150);
  $('.c', m.el).onclick = () => m.close();
  const go = async () => {
    const name = nm.value.trim();
    if (!name) { nm.classList.add('err'); nm.focus(); return; }
    if (await vault.nameTaken(name)) { nameError(nm, $('.nm-err', m.el)); return; }
    busy(true);
    try { await vault.add({ name, value }); }
    catch (e) { if (e.message === 'duplicate') { nameError(nm, $('.nm-err', m.el)); return; } throw e; }
    finally { busy(false); }
    m.close();
    results = [];
    toast(t('saved'));
    home();
    const n = await vault.count();
    if (n === 1 && !(await vault.hasPin())) toast(t('firstSavedNoPin'));
    // never the rating window right after an ad
    if (!(await afterSave())) maybeAskReview();
  };
  $('.o', m.el).onclick = go;
  nm.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  nm.oninput = () => { nm.classList.remove('err'); $('.nm-err', m.el).textContent = ''; };
}

/** a name already used: the field is marked and the message shown under it */
function nameError(input, msgEl) {
  input.classList.add('err'); msgEl.textContent = t('nameTaken'); input.focus(); input.select();
}

async function replaceSaved(value) {
  if (!vault.isUnlocked()) { editTarget = null; return home(); }
  const ok = await confirmBox(t('replaceTitle'), t('replaceText', { name: `<b>${esc(editTarget.name)}</b>` }), { ok: t('replace') });
  if (!ok) return;
  await vault.update(editTarget.id, { name: editTarget.name, value });
  editTarget = null; results = [];
  toast(t('updated'));
  vaultScreen();
}

/* ================= password list ================= */
let idleTimer;
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (screen === 'vault' && !inExternal() && !$('.modal-back')) { vault.lock(); home(); toast(t('autoLocked')); } }, 180000);
}
document.addEventListener('pointerdown', () => screen === 'vault' && armIdle(), true);

async function vaultScreen() {
  screen = 'vault';
  hideBanner();
  armIdle();
  let items;
  try { items = await vault.list(); } catch { return home(); }
  let selecting = false, query = '';
  const fold = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matches = (e) => !query || fold(e.name).includes(query);
  // the matching part of the name in bold colour (accent-insensitive: same length after folding for Latin letters)
  const mark = (name) => {
    if (!query) return esc(name);
    const i = fold(name).indexOf(query);
    if (i < 0 || fold(name).length !== name.length) return esc(name);
    return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + query.length)) + '</mark>' + esc(name.slice(i + query.length));
  };
  const selected = new Set();
  const shown = new Set();
  const fmt = new Intl.DateTimeFormat(lang(), { dateStyle: 'medium' });

  shell({
    title: t('myPasswords'), back: goBack,
    actions: `<button class="icon-btn v-sel" aria-label="${t('select')}">${ICON.select}</button>
      <button class="icon-btn v-more" aria-label="${t('more')}">${ICON.dots}</button>`,
    body: `<div class="search">${ICON.search}<input type="search" placeholder="${t('searchName')}" class="q" autocomplete="off"><button class="icon-btn sm q-x hide" aria-label="${t('cancel')}">${ICON.close}</button></div>
      <p class="q-n muted small"></p>
      <div class="sel-bar hide"><button class="link s-all">${t('selectAll')}</button><span class="s-n"></span><button class="link s-cancel">${t('cancel')}</button></div>
      <div class="vlist"></div>
      <div class="export-bar hide"><button class="btn danger big s-del">${ICON.trash}<span></span></button><button class="btn primary big s-exp">${ICON.download}<span></span></button></div>
      <button class="fab" aria-label="${t('newPw')}">${ICON.plus}</button>`,
    cls: 'vault'
  });

  const draw = () => {
    const list = $('.vlist');
    const f = items.filter(matches);
    $('.q-n').textContent = query && items.length ? t('nFound', { n: f.length }) : '';
    $('.sel-bar').classList.toggle('hide', !selecting);
    $('.export-bar').classList.toggle('hide', !selecting);
    $('.fab').classList.toggle('hide', selecting);
    $('.s-n').textContent = t('nSelected', { n: selected.size });
    $('.s-exp span').textContent = t('exportN', { n: selected.size });
    $('.s-exp').disabled = !selected.size;
    $('.s-del span').textContent = t('deleteN', { n: selected.size });
    $('.s-del').disabled = !selected.size;
    if (!items.length) {
      list.innerHTML = `<div class="empty">${ICON.key}<h2>${t('emptyTitle')}</h2><p>${t('emptyText')}</p>
        <button class="btn primary e-gen">${ICON.wand}<span>${t('generate')}</span></button>
        <button class="btn ghost e-imp">${ICON.upload}<span>${t('import')}</span></button></div>`;
      $('.e-gen').onclick = home; $('.e-imp').onclick = importFlow;
      return;
    }
    list.innerHTML = f.map(e => `<div class="item ${selected.has(e.id) ? 'sel' : ''}" data-id="${e.id}">
        ${selecting ? `<span class="cb">${ICON.check}</span>` : `<span class="it-ic">${esc([...e.name][0] || '?').toUpperCase()}</span>`}
        <div class="it-main"><b>${mark(e.name)}</b>
          <code dir="ltr" class="${shown.has(e.id) ? 'shown' : ''}">${shown.has(e.id) ? esc(e.value) : '•'.repeat(Math.min(12, [...e.value].length))}</code>
          <small><span class="meter m-${strength(e.value)}" title="${t(strength(e.value))}"><span class="m-bar"><i></i><i></i><i></i></span></span><span>${t(strength(e.value))} · ${fmt.format(e.updated)}</span></small></div>
        ${selecting ? '' : `<div class="it-act">
          <button class="icon-btn i-eye" aria-label="${t('show')}">${shown.has(e.id) ? ICON.eyeOff : ICON.eye}</button>
          <button class="icon-btn i-copy" aria-label="${t('copy')}">${ICON.copy}</button>
          <button class="icon-btn i-more" aria-label="${t('more')}">${ICON.dots}</button></div>`}
      </div>`).join('') || `<p class="muted center">${t('noMatch')}</p>`;
    $$('.item', list).forEach(row => {
      const e = items.find(x => x.id === row.dataset.id);
      if (selecting) { row.onclick = () => { selected.has(e.id) ? selected.delete(e.id) : selected.add(e.id); draw(); }; return; }
      $('.i-eye', row).onclick = () => { shown.has(e.id) ? shown.delete(e.id) : shown.add(e.id); draw(); };
      $('.i-copy', row).onclick = async () => { await copy(e.value, S.clipClear); toast(S.clipClear ? t('copiedClear', { s: S.clipClear }) : t('copied')); };
      $('.i-more', row).onclick = () => itemMenu(e);
    });
  };

  const itemMenu = (e) => {
    const m = modal(`<h2 class="sheet-title">${esc(e.name)}</h2><div class="sheet">
        <button class="s-edit">${ICON.edit}<span>${t('editManual')}</span></button>
        <button class="s-regen">${ICON.refresh}<span>${t('editRegen')}</span></button>
        <button class="s-del danger">${ICON.trash}<span>${t('delete')}</span></button></div>`, { cls: 'bottom' });
    $('.s-edit', m.el).onclick = () => { m.close(); editDialog(e); };
    $('.s-regen', m.el).onclick = () => { m.close(); editTarget = { id: e.id, name: e.name }; results = []; home(); };
    $('.s-del', m.el).onclick = async () => {
      m.close();
      if (!(await confirmBox(t('deleteTitle'), t('deleteText', { name: `<b>${esc(e.name)}</b>` }), { ok: t('delete'), danger: true }))) return;
      await vault.remove(e.id);
      items = items.filter(x => x.id !== e.id);
      toast(t('deleted')); draw();
    };
  };

  const editDialog = (e) => {
    const m = modal(`<h2>${t('editManual')}</h2>
      <label class="field"><span>${t('pwName')}</span><input class="nm" maxlength="80" value="${esc(e.name)}"></label>
      <p class="err-msg nm-err"></p>
      <label class="field"><span>${t('password')}</span><div class="pw-in"><input class="pv" dir="ltr" type="password" value="${esc(e.value)}" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="icon-btn sm tg">${ICON.eye}</button></div></label>
      <div class="mt">${meter(e.value)}</div>
      <div class="actions"><button class="btn ghost c">${t('cancel')}</button><button class="btn primary o">${t('save')}</button></div>`);
    const pv = $('.pv', m.el), nm = $('.nm', m.el);
    nm.oninput = () => { nm.classList.remove('err'); $('.nm-err', m.el).textContent = ''; };
    pv.oninput = () => $('.mt', m.el).innerHTML = meter(pv.value);
    $('.tg', m.el).onclick = () => { pv.type = pv.type === 'password' ? 'text' : 'password'; $('.tg', m.el).innerHTML = pv.type === 'password' ? ICON.eye : ICON.eyeOff; };
    $('.c', m.el).onclick = () => m.close();
    $('.o', m.el).onclick = async () => {
      const name = nm.value.trim(), value = pv.value;
      if (!name) { nm.classList.add('err'); return; }
      if (!value) { pv.classList.add('err'); return; }
      try { await vault.update(e.id, { name, value }); }
      catch (err) { if (err.message === 'duplicate') { nameError(nm, $('.nm-err', m.el)); return; } throw err; }
      Object.assign(e, { name, value, updated: Date.now() });
      items.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      m.close(); toast(t('updated')); draw();
    };
  };

  $('.q').oninput = (e) => { query = fold(e.target.value.trim()); $('.q-x').classList.toggle('hide', !e.target.value); draw(); };
  $('.q-x').onclick = () => { $('.q').value = ''; $('.q').oninput({ target: $('.q') }); $('.q').focus(); };
  $('.v-sel').onclick = () => { if (!items.length) return; selecting = !selecting; selected.clear(); draw(); };
  $('.s-cancel').onclick = () => { selecting = false; selected.clear(); draw(); };
  $('.s-all').onclick = () => { const f = items.filter(matches); const all = f.every(e => selected.has(e.id)); f.forEach(e => all ? selected.delete(e.id) : selected.add(e.id)); draw(); };
  $('.s-del').onclick = async () => {
    const n = selected.size;
    if (!n) return;
    const one = n === 1 ? items.find(e => selected.has(e.id)) : null;
    const ok = await confirmBox(t('deleteTitle'), one ? t('deleteText', { name: `<b>${esc(one.name)}</b>` }) : t('deleteManyText', { n }), { ok: t('delete'), danger: true });
    if (!ok) return;
    await vault.removeMany([...selected]);
    items = items.filter(e => !selected.has(e.id));
    selected.clear(); selecting = false;
    toast(n === 1 ? t('deleted') : t('deletedN', { n })); draw();
  };
  $('.s-exp').onclick = async () => { if (await exportFlow(items.filter(e => selected.has(e.id)))) { selecting = false; selected.clear(); draw(); } };
  $('.fab').onclick = home;
  $('.v-more').onclick = () => {
    const m = modal(`<div class="sheet">
        <button class="m-exp">${ICON.download}<span>${t('export')}</span></button>
        <button class="m-imp">${ICON.upload}<span>${t('import')}</span></button>
        <button class="m-lock">${ICON.lock}<span>${t('lockNow')}</span></button></div>`, { cls: 'bottom' });
    $('.m-exp', m.el).onclick = () => { m.close(); if (!items.length) return toast(t('emptyTitle')); selecting = true; items.forEach(e => selected.add(e.id)); draw(); toast(t('chooseExport')); };
    $('.m-imp', m.el).onclick = () => { m.close(); importFlow(); };
    $('.m-lock', m.el).onclick = () => { m.close(); vault.lock(); home(); toast(t('locked')); };
  };

  async function importFlow() {
    const text = await pickFile();
    if (text == null) return;
    const head = vault.peekExport(text);
    if (!head) return alertBox(t('import'), t('importBadFile'));
    const pwd = await askSecret(t('import'), t('importText', { n: head.count ?? '?' }), false);
    if (pwd == null) return;
    busy(true, t('decrypting'));
    try {
      const data = await vault.readExport(text, pwd);
      const r = await vault.importEntries(data);
      items = await vault.list();
      busy(false);
      draw();
      alertBox(t('import'), t('importDone', { a: r.added, s: r.skipped }) + (r.renamed ? '<br><br>' + t('importRenamed', { r: r.renamed }) : ''));
    } catch (e) {
      busy(false);
      alertBox(t('import'), e.message === 'password' ? t('importBadPwd') : t('importBadFile'));
    }
  }

  draw();
}

/** asks for the export password (twice when creating it). Resolves with it, or null. */
function askSecret(title, text, create) {
  return new Promise(res => {
    const m = modal(`<h2>${title}</h2><p class="lead">${text}</p>
      <label class="field"><span>${t('exportPwd')}</span><div class="pw-in"><input class="p1" type="password" dir="ltr" autocomplete="new-password"><button class="icon-btn sm tg">${ICON.eye}</button></div></label>
      ${create ? `<label class="field"><span>${t('exportPwd2')}</span><input class="p2" type="password" dir="ltr" autocomplete="new-password"></label>` : ''}
      <p class="err-msg"></p>
      <div class="actions"><button class="btn ghost c">${t('cancel')}</button><button class="btn primary o">${t('ok')}</button></div>`, { onClose: () => res(null) });
    const p1 = $('.p1', m.el), p2 = $('.p2', m.el), err = $('.err-msg', m.el);
    setTimeout(() => p1.focus(), 150);
    $('.tg', m.el).onclick = () => { const ty = p1.type === 'password' ? 'text' : 'password'; p1.type = ty; if (p2) p2.type = ty; };
    $('.c', m.el).onclick = () => m.close();
    $('.o', m.el).onclick = () => {
      const v = p1.value;
      if (create && v.length < 6) { err.textContent = t('exportPwdShort'); return; }
      if (create && v !== p2.value) { err.textContent = t('exportPwdMismatch'); return; }
      if (!v) return;
      const r = res; m.el.parentElement.remove(); r(v);
    };
  });
}

async function exportFlow(entries) {
  if (!entries.length) return false;
  const pwd = await askSecret(t('export'), t('exportText', { n: entries.length }), true);
  if (pwd == null) return false;
  busy(true, t('encrypting'));
  let text;
  try { text = await vault.exportFile(entries, pwd); } finally { busy(false); }
  const name = `passforge-${new Date().toISOString().slice(0, 10)}.pfg`;
  return new Promise(res => {
    const m = modal(`<div class="m-ic green">${ICON.check}</div><h2>${t('exportReady')}</h2><p class="lead">${t('exportWhere')}</p>
      <div class="sheet"><button class="x-save">${ICON.download}<span>${t('saveDevice')}</span></button>
      <button class="x-share">${ICON.share}<span>${t('shareFile')}</span></button></div>`, { onClose: () => res(false) });
    $('.x-save', m.el).onclick = async () => {
      try { if (await saveFile(name, text)) { toast(t('exported')); res(true); m.close(); } } catch (e) { alertBox(t('export'), e.message); }
    };
    $('.x-share', m.el).onclick = async () => {
      try { await shareFile(name, text, 'PassForge'); res(true); m.close(); } catch (e) { alertBox(t('export'), e.message); }
    };
  });
}

/* ================= settings ================= */
async function settingsScreen() {
  screen = 'settings';
  if (pageBack === settingsScreen) pageBack = null;
  hideBanner();
  const pin = await vault.hasPin();
  const bst = await bio.status();
  const p = S.profile || {};
  shell({
    title: t('settings'), back: goBack,
    body: `
      <h3 class="sec">${t('profile')}</h3>
      <section class="card rows">
        <button class="row r-prof">${ICON.user}<span><b>${esc([p.first, p.last].filter(Boolean).join(' ') || t('notSet'))}</b><small>${t('firstName')} · ${t('lastName')}</small></span>${ICON.edit}</button>
      </section>
      <h3 class="sec">${t('security')}</h3>
      <section class="card rows">
        ${pin ? `<button class="row r-pin-c">${ICON.lock}<span><b>${t('pinChange')}</b><small>${t('pinActive')}</small></span></button>
                 ${bst.available || bst.enrolled ? `<label class="row switch-row r-bio">${ICON.finger}<span><b>${t('bioUnlock')}</b><small>${t('bioHint')}</small></span><input type="checkbox" class="bio-sw" ${bst.enrolled ? 'checked' : ''}><i></i></label>`
        : bst.noneEnrolled ? `<div class="row">${ICON.finger}<span><b>${t('bioUnlock')}</b><small>${t('bioNone')}</small></span></div>` : ''}
                 <button class="row r-pin-d">${ICON.unlock}<span><b>${t('pinRemove')}</b><small>${t('pinRemoveHint')}</small></span></button>`
      : `<button class="row r-pin-s">${ICON.lock}<span><b>${t('pinCreate')}</b><small class="warn">${t('pinMissing')}</small></span></button>`}
        <div class="row">${ICON.copy}<span><b>${t('clipClear')}</b><small>${t('clipClearHint')}</small></span>
          <select class="clip">${[0, 15, 30, 60, 120].map(s => `<option value="${s}" ${S.clipClear === s ? 'selected' : ''}>${s ? s + ' s' : t('never')}</option>`).join('')}</select></div>
      </section>
      <h3 class="sec">${t('appearance')}</h3>
      <section class="card rows">
        <button class="row r-lang">${ICON.globe}<span><b>${t('language')}</b><small>${LANGS[lang()]}</small></span></button>
        <div class="row col">${ICON.moon}<span><b>${t('theme')}</b></span>
          <div class="seg theme">${['system', 'light', 'dark'].map(k => `<button data-t="${k}" class="${S.theme === k ? 'on' : ''}">${t('theme_' + k)}</button>`).join('')}</div></div>
      </section>
      <h3 class="sec">${t('proMode')}</h3>
      <section class="card rows"><button class="row r-pro">${ICON.star}<span><b>${S.pro ? t('proActive') : t('proGet')}</b><small>${t('proHint')}</small></span></button></section>
      <h3 class="sec">${t('data')}</h3>
      <section class="card rows">
        <button class="row r-vault">${ICON.download}<span><b>${t('export')} / ${t('import')}</b><small>${t('exportHint')}</small></span></button>
        <button class="row r-reset danger">${ICON.trash}<span><b>${t('resetApp')}</b><small>${t('resetHint')}</small></span></button>
      </section>`
  });
  $('.r-prof').onclick = async () => { await profileDialog(); settingsScreen(); };
  if (pin) {
    $('.r-pin-c').onclick = async () => {
      const old = await verifyPin(t('pinOld'));
      if (!old) return;
      const nw = await pinPad({ mode: 'create', title: t('pinNew'), sub: t('pinCreateSub') });
      if (!nw) return;
      busy(true, t('securing'));
      try { await vault.changePin(old, nw); } finally { busy(false); }
      vault.lock(); toast(t('pinChanged'));
      // the fingerprint keeps the PIN: store the new one
      if ((await bio.status()).enrolled) {
        let ok = false;
        try { ok = await bio.enroll(nw, bioTexts(t('bioEnrollSub'))); } catch { }
        if (!ok) { await bio.remove(); toast(t('bioOff')); }
        settingsScreen();
      }
    };
    if ($('.bio-sw')) $('.bio-sw').onchange = async (e) => {
      if (e.target.checked) {
        e.target.checked = false;
        const pinv = await verifyPin();
        if (!pinv) return;
        try { if (await bio.enroll(pinv, bioTexts(t('bioEnrollSub')))) { e.target.checked = true; toast(t('bioOn')); } }
        catch (err) { alertBox(t('bioUnlock'), err.message); }
      } else { await bio.remove(); toast(t('bioOff')); }
    };
    $('.r-pin-d').onclick = async () => {
      if (!(await confirmBox(t('pinRemove'), t('pinRemoveText'), { ok: t('pinRemove'), danger: true }))) return;
      const old = await verifyPin();
      if (!old) return;
      await vault.removePin(old); vault.lock(); await bio.remove();
      toast(t('pinRemoved')); settingsScreen();
    };
  } else $('.r-pin-s').onclick = async () => { if (await createPin()) { await offerBio(lastPin); lastPin = null; vault.lock(); settingsScreen(); } };
  $('.clip').onchange = async (e) => { S = await store.saveSettings({ clipClear: +e.target.value }); };
  $('.r-lang').onclick = languageDialog;
  $$('.theme button').forEach(b => b.onclick = async () => { S = await store.saveSettings({ theme: b.dataset.t }); applyTheme(); $$('.theme button').forEach(x => x.classList.toggle('on', x === b)); });
  $('.r-pro').onclick = () => { pageBack = settingsScreen; proScreen(); };
  $('.r-vault').onclick = async () => { pageBack = settingsScreen; await openVault(); if (screen !== 'vault') pageBack = null; };
  $('.r-reset').onclick = () => resetApp(false);
}

async function resetApp(forgot) {
  if (!forgot) {
    if (!(await confirmBox(t('resetApp'), t('resetText'), { ok: t('resetApp'), danger: true }))) return;
    if (await vault.hasPin()) {
      const ok = await verifyPin();
      if (!ok) return;
    }
  }
  const keepLang = S.lang, keepTheme = S.theme, keepPro = S.pro;
  await bio.remove();
  await store.clearAll();
  store.resetCache();
  vault.lock();
  await store.saveSettings({ lang: keepLang, theme: keepTheme, pro: keepPro });
  location.reload();
}

function languageDialog() {
  const cur = lang();
  const m = modal(`<h2>${t('language')}</h2><p class="lead">${t('languageHint')}</p><div class="sheet langs">
    <button data-l="" class="${!S.lang ? 'on' : ''}">${ICON.phone}<span>${t('phoneLang')}</span><em>${LANGS[phoneLang()]}</em></button>
    ${Object.entries(LANGS).map(([k, v]) => `<button data-l="${k}" class="${S.lang === k ? 'on' : ''}"><span class="flag">${k.toUpperCase()}</span><span>${v}</span>${S.lang === k ? ICON.check : ''}</button>`).join('')}</div>`, { cls: 'bottom' });
  $$('[data-l]', m.el).forEach(b => b.onclick = async () => {
    const l = b.dataset.l || null;
    S = await store.saveSettings({ lang: l });
    await setLang(l || phoneLang());
    m.close();
    if (lang() !== cur) { results = []; await hideBanner(); }
    ({ settings: settingsScreen, vault: vaultScreen })[screen]?.() ?? home();
  });
}

/* ================= Pro ================= */
async function proScreen() {
  screen = 'pro';
  hideBanner();
  const prod = await billing.storeProduct(); // null → simulated purchase (APK from GitHub, iPhone)
  const price = prod ? prod.price : '2,99 €';
  shell({
    title: t('proMode'), back: goBack,
    body: `<div class="pro-hero"><div class="pro-badge">${ICON.star}</div><h2>PassForge Pro</h2><p>${t('proText')}</p></div>
      <section class="card"><ul class="ticks">
        <li>${ICON.check}${t('proB1')}</li><li>${ICON.check}${t('proB2')}</li><li>${ICON.check}${t('proB3')}</li></ul></section>
      ${S.pro
        ? `<div class="notice ok">${ICON.check}<span>${t('proActive')}</span></div>${prod ? '' : `<button class="btn ghost big p-off">${t('proDisable')}</button>`}`
        : `<button class="btn primary big p-buy">${t('proBuy', { price: esc(price) })}</button><button class="link center p-restore">${t('proRestore')}</button>`}
      ${prod ? '' : `<p class="muted small center">${t('proTestNote')}</p>`}`
  });
  const activate = async () => { S = await store.saveSettings({ pro: true }); await removeAdsForPro(); toast(t('proThanks')); proScreen(); };
  if ($('.p-buy')) $('.p-buy').onclick = async () => {
    if (!prod) {
      if (await confirmBox(t('proBuyTitle'), t('proBuyText'), { ok: t('proConfirm') })) activate();
      return;
    }
    try { if (await billing.buy()) activate(); }
    catch (e) { alertBox(t('proMode'), t('proError') + (e.message ? `<br><small>${esc(e.message)}</small>` : '')); }
  };
  if ($('.p-restore')) $('.p-restore').onclick = async () => {
    if (!prod) return alertBox(t('proRestore'), t('proRestoreText'));
    busy(true);
    const o = await billing.owned();
    busy(false);
    if (o) activate(); else alertBox(t('proRestore'), t('proNothing'));
  };
  if ($('.p-off')) $('.p-off').onclick = async () => { S = await store.saveSettings({ pro: false }); toast(t('proOff')); proScreen(); };
}

/* ================= tutorial & about ================= */
async function tutorial() {
  hideBanner();
  await slides([
    { icon: ICON.wand, title: t('t1Title'), text: t('t1Text') },
    { icon: ICON.refresh, title: t('t2Title'), text: t('t2Text'), tone: 'green' },
    { icon: ICON.book, title: t('t6Title'), text: t('t6Text'), tone: 'orange' },
    { icon: ICON.save, title: t('t3Title'), text: t('t3Text'), tone: 'violet' },
    { icon: ICON.key, title: t('t4Title'), text: t('t4Text') },
    { icon: ICON.download, title: t('t5Title'), text: t('t5Text'), tone: 'orange' },
    ...welcomeSlides().slice(1)
  ], { finish: t('finish') });
  goBack();
}

function aboutScreen() {
  screen = 'about';
  hideBanner();
  shell({
    title: t('about'), back: goBack,
    body: `<div class="pro-hero"><img src="icons/icon-192.png" class="about-logo" alt=""><h2>PassForge</h2><p>${t('version')} ${VERSION}</p></div>
      <section class="card"><p>${t('aboutText')}</p>
      <ul class="ticks"><li>${ICON.wifiOff}${t('about1')}</li><li>${ICON.shield}${t('about2')}</li><li>${ICON.refresh}${t('about3')}</li><li>${ICON.lock}${t('about4')}</li></ul></section>
      <section class="card"><h3>${t('privacy')}</h3><p class="small">${t('privacyText')}</p></section>
      <p class="muted small center">© ${new Date().getFullYear()} AyBad · PassForge</p>`
  });
}

start().catch(e => { console.error(e); document.body.innerHTML = `<pre style="padding:20px;white-space:pre-wrap">${esc(e.stack || e)}</pre>`; });
