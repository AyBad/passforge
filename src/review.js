import * as store from './store.js';
import { native } from './device.js';

/*
 * Google Play rating, asked rarely and only after a good moment (a password saved):
 *  - not before 3 days of use and 3 saved passwords,
 *  - then at most once every 4 months, and never more than 3 times in total.
 * Google decides itself whether the window is shown (it also limits how often), so no question is asked before it.
 */
const PKG = 'com.aybad.passforge';
const DAY = 86400000;

export async function noteFirstUse() {
  if (!(await store.get('firstUse'))) await store.set('firstUse', Date.now());
}

export async function maybeAskReview() {
  if (!native) return;
  const r = (await store.get('review')) || { saves: 0, asked: 0, last: 0 };
  r.saves++;
  await store.set('review', r);
  const first = (await store.get('firstUse')) || Date.now();
  if (r.asked >= 3 || r.saves < 3 || Date.now() - first < 3 * DAY || (r.last && Date.now() - r.last < 120 * DAY)) return;
  r.asked++; r.last = Date.now();
  await store.set('review', r);
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    setTimeout(() => InAppReview.requestReview().catch(() => { }), 800);
  } catch { }
}

/** "Rate the app" from the menu: opens the Google Play page */
export function openStorePage() {
  // Android hands the Play link over to the Play Store app
  window.open(`https://play.google.com/store/apps/details?id=${PKG}`, '_blank');
}
