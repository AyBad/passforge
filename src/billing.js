import { native } from './device.js';

/*
 * Pro mode = one-time Google Play in-app product (id from the GitHub variable PRO_PRODUCT_ID, "passforge_pro" by default).
 * Real billing works only when the app is installed from Google Play (internal test track or production).
 * Elsewhere (APK from GitHub, iPhone web app) the purchase is simulated for testing.
 */
export const PRODUCT = import.meta.env.VITE_PRO_PRODUCT || 'passforge_pro';
let plugin = null, product = null, checked = false;

async function np() {
  if (!native) return null;
  if (!plugin) {
    try {
      const m = await import('@capgo/native-purchases');
      plugin = { api: m.NativePurchases, INAPP: m.PURCHASE_TYPE.INAPP };
    } catch { return null; }
  }
  return plugin;
}

/** the product as sold on Google Play ({ price }), or null when real billing is not available here */
export async function storeProduct() {
  if (checked) return product;
  checked = true;
  const p = await np();
  if (!p) return null;
  try {
    const { isBillingSupported } = await p.api.isBillingSupported();
    if (!isBillingSupported) return null;
    const { products } = await p.api.getProducts({ productIdentifiers: [PRODUCT], productType: p.INAPP });
    product = products && products[0] ? { price: products[0].priceString, title: products[0].title } : null;
  } catch (e) { console.warn('billing', e); product = null; }
  return product;
}

/** true when bought; throws on error; false when cancelled */
export async function buy() {
  const p = await np();
  try {
    const tr = await p.api.purchaseProduct({ productIdentifier: PRODUCT, productType: p.INAPP, quantity: 1 });
    return !!tr && (tr.purchaseState === undefined || tr.purchaseState === '1' || tr.purchaseState === 'PURCHASED');
  } catch (e) {
    if (/cancel/i.test(e.message || e.code || '')) return false;
    throw e;
  }
}

/** asks Google Play whether this account owns Pro (reinstall, new phone, refund) → true / false / null (unknown) */
export async function owned() {
  const p = await np();
  if (!p || !(await storeProduct())) return null;
  try {
    const { purchases } = await p.api.getPurchases({ productType: p.INAPP });
    return (purchases || []).some(x => x.productIdentifier === PRODUCT && (x.purchaseState === undefined || x.purchaseState === '1'));
  } catch { return null; }
}
