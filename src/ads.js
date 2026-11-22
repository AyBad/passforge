import { Capacitor } from '@capacitor/core';
import { t } from './i18n.js';
import { settings } from './store.js';

// Real AdMob ids come from the GitHub variables ADMOB_BANNER_ID / ADMOB_INTERSTITIAL_ID (see README).
// Without them: Google's official TEST ad units (no revenue, safe to click).
const env = import.meta.env;
const REAL = !!(env.VITE_ADMOB_BANNER && env.VITE_ADMOB_INTERSTITIAL);
const TEST = {
  banner: env.VITE_ADMOB_BANNER || 'ca-app-pub-3940256099942544/6300978111',
  interstitial: env.VITE_ADMOB_INTERSTITIAL || 'ca-app-pub-3940256099942544/1033173712'
};
export const realAds = REAL;

const native = Capacitor.isNativePlatform();
let admob = null, ready = false, bannerShown = false, wanted = false, bannerH = 0, modalHidden = false;
const anyModal = () => !!document.querySelector('.modal-back, .pinpad, .fake-inter, .drawer.open');
new MutationObserver(() => {
  if (!native || !ready || !bannerShown) return;
  const open = anyModal();
  if (open && !modalHidden) { modalHidden = true; admob.hideBanner().catch(() => { }); }
  else if (!open && modalHidden) { modalHidden = false; if (wanted) admob.resumeBanner().catch(() => { }); }
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
const setAdSpace = (h) => document.documentElement.style.setProperty('--ad', (h || 0) + 'px');

const adsAllowed = async () => !(await settings()).pro;

async function initAds() {
  if (!native || ready) return;
  try {
    admob = (await import('@capacitor-community/admob')).AdMob;
    await admob.initialize({ initializeForTesting: !REAL });
    // GDPR (EU): Google's consent form, shown only when it is required and not answered yet
    try {
      const c = await admob.requestConsentInfo();
      if (c.isConsentFormAvailable && c.status === 'REQUIRED') await admob.showConsentForm();
    } catch (e) { console.warn('consent', e); }
    admob.addListener('bannerAdSizeChanged', (info) => { if (info && info.height) bannerH = info.height; if (wanted) setAdSpace((bannerH || 60) + 4); });
    ready = true;
  } catch (e) { console.warn('ads', e); }
}

/** banner at the bottom of the generator screen (never on the password list) */
export async function showBanner() {
  wanted = true;
  if (!(await adsAllowed())) { hideBanner(); return; }
  if (native) {
    await initAds(); if (!ready || !wanted) return;
    try {
      if (!bannerShown) await admob.showBanner({ adId: TEST.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: !REAL });
      else if (!anyModal()) await admob.resumeBanner();
      bannerShown = true;
      if (!wanted) { await admob.hideBanner(); return; }
      setAdSpace((bannerH || 60) + 4);
    } catch (e) { console.warn('banner', e); }
  } else if (wanted && !document.querySelector('.fake-ad')) {
    // web / iPhone: simulated test banner
    const el = document.createElement('div');
    el.className = 'fake-ad';
    el.innerHTML = `<span class="ad-tag">${t('ad')}</span><b>PassForge Pro</b>&nbsp;· ${t('testBanner')}`;
    document.body.appendChild(el);
    setAdSpace(54);
  }
}

export async function hideBanner() {
  wanted = false; setAdSpace(0);
  if (native && ready && bannerShown) { try { await admob.hideBanner(); } catch { } }
  document.querySelectorAll('.fake-ad').forEach(e => e.remove());
}

export async function removeAdsForPro() {
  wanted = false; setAdSpace(0);
  if (native && ready && bannerShown) { try { await admob.removeBanner(); } catch { } bannerShown = false; }
  document.querySelectorAll('.fake-ad').forEach(e => e.remove());
}

let interReady = false, saves = 0, lastInter = 0;
export async function prepareInterstitial() {
  if (!native || !(await adsAllowed())) return;
  try { await initAds(); if (!ready) return; await admob.prepareInterstitial({ adId: TEST.interstitial, isTesting: !REAL }); interReady = true; } catch (e) { interReady = false; }
}

/** full-screen ad after a password is saved: every 2nd save, at most once every 90 s. Returns true when an ad was shown */
export async function afterSave() {
  saves++;
  if (saves % 2 || Date.now() - lastInter < 90000 || !(await adsAllowed())) return;
  lastInter = Date.now();
  if (native) {
    await initAds();
    if (ready) {
      try {
        if (!interReady) await prepareInterstitial();
        interReady = false;
        await admob.showInterstitial();
        prepareInterstitial();
        return true;
      } catch (e) { interReady = false; }
    }
  }
  await new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'fake-inter';
    back.innerHTML = `<div class="fi-box"><span class="ad-tag">${t('ad')}</span>
      <div class="fi-art">PassForge Pro</div><p>${t('testInter')}</p><button class="btn ghost fi-close" disabled>5</button></div>`;
    document.body.appendChild(back);
    const btn = back.querySelector('.fi-close');
    let n = 5;
    const iv = setInterval(() => { n--; if (n > 0) btn.textContent = n; else { clearInterval(iv); btn.disabled = false; btn.textContent = '✕'; } }, 1000);
    btn.onclick = () => { back.remove(); resolve(); };
  });
  return true;
}
