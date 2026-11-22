// Opening screen (markup and style in index.html so that it shows at once): the logo appears, its dots
// light up one by one, then it zooms away. The page behind is drawn only at the end, so nothing competes
// with the animation and nothing is left on screen.
const T0 = performance.now();
const MIN = 1450; // ms: the logo animation is over

export function startSplash() { }

/** waits for the end of the animation (or a tap), draws the page behind (render), then removes the splash */
export function endSplash(render) {
  const el = document.getElementById('splash');
  if (!el) { render && render(); return Promise.resolve(); }
  return new Promise(resolve => {
    let done = false;
    const go = () => {
      if (done) return; done = true;
      render && render();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.querySelector('.sp-logo')?.classList.add('out');
        el.classList.add('out');
        document.querySelector('meta[name=theme-color]')?.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#0f1420' : '#ffffff');
        setTimeout(() => { el.remove(); resolve(); }, 380);
      }));
    };
    el.addEventListener('click', go, { once: true });
    setTimeout(go, Math.max(0, MIN - (performance.now() - T0)));
  });
}
