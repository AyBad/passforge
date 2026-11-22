import { randInt } from './gen.js';

// Opening screen (markup and style in index.html so that it shows at once):
// the password line "forges" itself, character by character, then the splash zooms away.
const T0 = performance.now();
const MIN = 1900; // ms on screen
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';

export function startSplash(tagline) {
  const el = document.getElementById('splash');
  if (!el) return;
  const tag = document.getElementById('sp-tag');
  if (tag) tag.textContent = tagline;
  const pw = document.getElementById('sp-pw');
  if (!pw) return;
  const target = Array.from({ length: 14 }, () => CHARS[randInt(CHARS.length)]);
  let fixed = 0;
  const start = performance.now() + 700;
  const tick = () => {
    if (!el.isConnected) return;
    const now = performance.now();
    if (now > start) fixed = Math.min(target.length, Math.floor((now - start) / 65));
    pw.innerHTML = target.map((c, i) => i < fixed ? `<b>${c}</b>` : CHARS[randInt(CHARS.length)]).join('');
    if (fixed < target.length) setTimeout(tick, 45);
  };
  tick();
}

/** waits until the splash has been visible long enough (or a tap), then removes it */
export function endSplash() {
  const el = document.getElementById('splash');
  if (!el) return Promise.resolve();
  return new Promise(resolve => {
    let done = false;
    const go = () => {
      if (done) return; done = true;
      el.classList.add('out');
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#0f1420' : '#ffffff');
      setTimeout(() => { el.remove(); resolve(); }, 450);
    };
    el.addEventListener('click', go, { once: true });
    setTimeout(go, Math.max(0, MIN - (performance.now() - T0)));
  });
}
