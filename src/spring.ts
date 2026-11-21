/**
 * Springy release for every button: after a click (pointer or keyboard),
 * replay the "boing" animation defined in index.css. A data attribute is used
 * instead of a class so React re-renders (which rewrite className) don't cut
 * the animation short.
 */
export function installButtonSpring() {
  document.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as Element | null)?.closest?.('button');
      if (!btn || btn.disabled) return;
      delete btn.dataset.boing;
      void btn.offsetWidth; // restart the animation if it's already running
      btn.dataset.boing = '';
      const done = (ev: AnimationEvent) => {
        if (ev.animationName !== 'boing') return;
        delete btn.dataset.boing;
        btn.removeEventListener('animationend', done);
      };
      btn.addEventListener('animationend', done);
    },
    true,
  );
}
