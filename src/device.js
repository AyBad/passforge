import { Capacitor, registerPlugin } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';

export const native = Capacitor.isNativePlatform();
const SaveAs = registerPlugin('SaveAs');

// While the system file picker / share sheet is open the app goes to the background:
// the list must not lock itself during that time.
let external = 0;
export const inExternal = () => external > 0;
async function outside(fn) { external++; try { return await fn(); } finally { setTimeout(() => external--, 800); } }

/* ---- clipboard, cleared automatically ---- */
let clearTimer;
export async function copy(text, clearAfter) {
  try { await Clipboard.write({ string: text }); }
  catch { await navigator.clipboard.writeText(text); }
  clearTimeout(clearTimer);
  if (clearAfter > 0) clearTimer = setTimeout(async () => {
    try { await Clipboard.write({ string: ' ' }); } catch { try { await navigator.clipboard.writeText(' '); } catch { } }
  }, clearAfter * 1000);
}

const toB64 = (str) => btoa(unescape(encodeURIComponent(str)));

/** "Save as…" on Android (system picker); download on the web. Returns true when saved. */
export async function saveFile(name, text) {
  if (native) {
    const r = await outside(() => SaveAs.save({ name, mime: 'application/octet-stream', data: toB64(text) }));
    return !!(r && r.saved);
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}

/** share the file (e-mail, Drive, WhatsApp…) */
export async function shareFile(name, text, title) {
  if (native) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const w = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try { await outside(() => Share.share({ title, files: [w.uri], dialogTitle: title })); }
    catch (e) { if (!/cancel/i.test(e.message || '')) throw e; }
    finally { setTimeout(() => Filesystem.deleteFile({ path: name, directory: Directory.Cache }).catch(() => { }), 60000); }
    return true;
  }
  const file = new File([text], name, { type: 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return true; } catch (e) { if (e.name === 'AbortError') return false; }
  }
  return saveFile(name, text);
}

/** lets the user pick an export file; resolves with its text or null */
export function pickFile() {
  return outside(() => new Promise(resolve => {
    const input = Object.assign(document.createElement('input'), { type: 'file' });
    input.style.display = 'none';
    document.body.appendChild(input);
    let done = false;
    input.onchange = async () => {
      done = true;
      const f = input.files && input.files[0];
      input.remove();
      resolve(f ? await f.text() : null);
    };
    // cancelled picker: no change event; resolve null when the window gets the focus back
    window.addEventListener('focus', () => setTimeout(() => { if (!done) { input.remove(); resolve(null); } }, 1500), { once: true });
    input.click();
  }));
}
