import { t } from './i18n.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = (d) => `<svg viewBox="0 0 24 24" class="ic" aria-hidden="true">${d}</svg>`;
export const ICON = {
  menu: P('<path d="M3 6h18M3 12h18M3 18h18"/>'),
  back: P('<path d="M15 5l-7 7 7 7"/>'),
  close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  lock: P('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  unlock: P('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>'),
  key: P('<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L20 3M16 7l3 3M14 9l2 2"/>'),
  copy: P('<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'),
  eye: P('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: P('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  refresh: P('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  save: P('<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v6h8M7 21v-7h10v7"/>'),
  edit: P('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'),
  trash: P('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  dots: P('<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  globe: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  star: P('<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>'),
  moon: P('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  book: P('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>'),
  info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  shield: P('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  wifiOff: P('<path d="M3 3l18 18M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5-2.7M14.5 10.3a10 10 0 0 1 4.5 2.6M2 9.3a15 15 0 0 1 4.5-3M10 5.1a15 15 0 0 1 12 4.2"/><circle cx="12" cy="20" r=".8"/>'),
  upload: P('<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>'),
  download: P('<path d="M12 4v12M7 11l5 5 5-5M4 17v3h16v-3"/>'),
  phone: P('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'),
  check: P('<path d="M5 12l5 5 9-10"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  minus: P('<path d="M5 12h14"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  share: P('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  select: P('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>'),
  finger: P('<path d="M12 11v3a8 8 0 0 1-1.5 4.6M8.5 7.5A5 5 0 0 1 17 11v2.5M7 11a5 5 0 0 1 .6-2.4M17 16.5a14 14 0 0 1-.8 3M4.5 9A8 8 0 0 1 19.6 8M4 13.5V12M8 12v2a12 12 0 0 1-1.6 6M15 13.5v.5a11 11 0 0 1-2 6.3"/>'),
  heart: P('<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>'),
  wand: P('<path d="M4 20L16 8M14 4v2M19 9h2M18 4l-1.5 1.5M10 2v2M20 14h2"/>')
};

/* ---- modal dialog ---- */
export function modal(html, { cls = '', dismiss = true, onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${cls}" role="dialog">${html}</div>`;
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('in'));
  const close = () => { if (!back.isConnected) return; back.remove(); onClose && onClose(); };
  if (dismiss) back.addEventListener('click', (e) => { if (e.target === back) close(); });
  return { el: back.querySelector('.modal'), close };
}

export function confirmBox(title, text, { ok = t('ok'), cancel = t('cancel'), danger = false } = {}) {
  return new Promise(res => {
    const m = modal(`<h2>${title}</h2>${text ? `<p class="lead">${text}</p>` : ''}
      <div class="actions"><button class="btn ghost c">${cancel}</button><button class="btn ${danger ? 'danger' : 'primary'} o">${ok}</button></div>`, { onClose: () => res(false) });
    $('.c', m.el).onclick = () => { m.close(); };
    $('.o', m.el).onclick = () => { res(true); m.close(); };
  });
}

export function alertBox(title, text) {
  return new Promise(res => {
    const m = modal(`<h2>${title}</h2>${text ? `<p class="lead">${text}</p>` : ''}<div class="actions"><button class="btn primary o">${t('ok')}</button></div>`, { onClose: res });
    $('.o', m.el).onclick = () => m.close();
  });
}

let toastTimer;
export function toast(msg) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export function busy(on, text = '') {
  let el = $('.busy');
  if (on) {
    if (!el) { el = document.createElement('div'); el.className = 'busy'; el.innerHTML = '<div class="spin"></div><p></p>'; document.body.appendChild(el); }
    $('p', el).textContent = text;
  } else if (el) el.remove();
}

/* ---- PIN pad ----
 * mode 'create': the user types 4 to 6 digits, presses OK, then confirms them. Resolves with the PIN or null.
 * mode 'verify': check(pin) → true | false. Resolves with the PIN or null. */
export function pinPad({ mode = 'verify', title, sub = '', length = 0, check, lockedFor, onForgot, bio }) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'pinpad';
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', bio && length ? 'bio' : 'ok'];
    el.innerHTML = `<button class="icon-btn pp-close" aria-label="${t('cancel')}">${ICON.close}</button>
      <div class="pp-top"><div class="pp-ic">${ICON.lock}</div><h2 class="pp-title"></h2><p class="pp-sub"></p>
      <div class="pp-dots"></div><p class="pp-err"></p></div>
      <div class="pp-keys">${keys.map(k => `<button class="pp-k ${k === 'x' || k === 'ok' || k === 'bio' ? 'fn' : ''}" data-k="${k}" ${k === 'bio' ? `aria-label="${t('bioUse')}"` : ''}>${k === 'x' ? '⌫' : k === 'ok' ? 'OK' : k === 'bio' ? ICON.finger : k}</button>`).join('')}</div>
      ${onForgot ? `<button class="link pp-forgot">${t('forgotPin')}</button>` : ''}`;
    document.body.appendChild(el);
    let pin = '', first = null, wait = null;
    const max = mode === 'create' ? 6 : (length || 6);
    const title_ = $('.pp-title', el), sub_ = $('.pp-sub', el), dots = $('.pp-dots', el), err = $('.pp-err', el);
    const okBtn = $('[data-k="ok"]', el) || document.createElement('button');
    const setTitle = () => { title_.textContent = first ? t('pinConfirm') : title; sub_.textContent = first ? '' : sub; };
    const draw = () => {
      const n = mode === 'create' ? Math.max(4, pin.length) : max;
      dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
      okBtn.style.visibility = mode === 'create' || !length ? 'visible' : 'hidden';
      okBtn.disabled = pin.length < 4;
    };
    const done = (v) => { clearInterval(wait); el.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const shake = (msg) => { err.textContent = msg; dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); pin = ''; draw(); };
    const showWait = async () => {
      if (!lockedFor) return false;
      let s = await lockedFor();
      if (!s) return false;
      el.classList.add('waiting');
      clearInterval(wait);
      const tick = () => { err.textContent = t('pinWait', { s }); if (s-- <= 0) { clearInterval(wait); el.classList.remove('waiting'); err.textContent = ''; } };
      tick(); wait = setInterval(tick, 1000);
      return true;
    };
    const submit = async () => {
      if (pin.length < 4) return;
      if (mode === 'create') {
        if (!first) { first = pin; pin = ''; err.textContent = ''; setTitle(); draw(); return; }
        if (pin === first) return done(pin);
        first = null; setTitle(); shake(t('pinMismatch'));
        return;
      }
      if (await showWait()) { pin = ''; draw(); return; }
      el.classList.add('checking');
      const ok = await check(pin);
      el.classList.remove('checking');
      if (ok) return done(pin);
      shake(t('pinWrong'));
      showWait();
    };
    const press = (k) => {
      if (el.classList.contains('waiting') || el.classList.contains('checking')) return;
      if (k === 'x') { pin = pin.slice(0, -1); draw(); return; }
      if (k === 'ok') { submit(); return; }
      if (k === 'bio') { runBio(); return; }
      if (pin.length >= max) return;
      pin += k; err.textContent = ''; draw();
      if (mode === 'verify' && length && pin.length === length) submit();
    };
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('x'); else if (e.key === 'Enter') press('ok'); else if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    $$('.pp-k', el).forEach(b => b.onclick = () => press(b.dataset.k));
    $('.pp-close', el).onclick = () => done(null);
    if (onForgot) $('.pp-forgot', el).onclick = () => { done(null); onForgot(); };
    // fingerprint / face: asked at once, the keypad stays available as a fallback
    const runBio = async () => {
      if (!bio || (await lockedFor?.())) return;
      el.classList.add('checking');
      let p = null;
      try { p = await bio(); } catch (e) { err.textContent = e.message || ''; }
      el.classList.remove('checking');
      if (!el.isConnected || !p) return;
      if (await check(p)) done(p); else shake(t('pinWrong'));
    };
    setTitle(); draw(); showWait().then(w => { if (!w && bio) setTimeout(runBio, 250); });
  });
}

/** slides (welcome and tutorial) */
export function slides(list, { finish, skip = true }) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'slides';
    el.innerHTML = `<div class="sl-track">${list.map(s => `<section class="sl"><div class="sl-art ${s.tone || ''}">${s.icon}</div><h1>${s.title}</h1><p>${s.text}</p></section>`).join('')}</div>
      <div class="sl-foot">${skip ? `<button class="link sl-skip">${t('skip')}</button>` : '<span></span>'}
      <div class="sl-dots">${list.map(() => '<i></i>').join('')}</div>
      <button class="btn primary sl-next"></button></div>`;
    document.body.appendChild(el);
    let i = 0;
    const track = $('.sl-track', el);
    const go = (n) => {
      i = Math.max(0, Math.min(list.length - 1, n));
      const dir = document.documentElement.dir === 'rtl' ? 1 : -1;
      track.style.transform = `translateX(${dir * i * 100}%)`;
      $$('.sl-dots i', el).forEach((d, k) => d.classList.toggle('on', k === i));
      $('.sl-next', el).textContent = i === list.length - 1 ? finish : t('next');
    };
    const end = () => { el.remove(); resolve(); };
    $('.sl-next', el).onclick = () => i === list.length - 1 ? end() : go(i + 1);
    if (skip) $('.sl-skip', el).onclick = end;
    // swipe
    let x0 = null;
    track.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
    track.addEventListener('touchend', e => {
      if (x0 == null) return;
      let dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (document.documentElement.dir === 'rtl') dx = -dx;
      if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
    });
    go(0);
  });
}
