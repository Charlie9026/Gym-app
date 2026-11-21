/**
 * The springy sliding highlight used by the tab bar and every row of pills:
 * an element (the "pill") moved under whichever child is active. The spring
 * itself is a CSS transition on the pill; this only measures and positions it.
 */
import { useLayoutEffect, type DependencyList, type RefObject } from 'react';

interface Options {
  /** Selector for the active item inside the container. */
  active: string;
  /** 'x' moves horizontally only (tab bar); 'xy' also follows wrapped rows. */
  axis: 'x' | 'xy';
}

export function placeHighlight(container: HTMLElement | null, pill: HTMLElement | null, animate: boolean, { active, axis }: Options) {
  const item = container?.querySelector<HTMLElement>(active);
  if (!container || !pill || !item) return;
  pill.classList.toggle('no-anim', !animate);
  pill.style.width = `${item.offsetWidth}px`;
  if (axis === 'xy') {
    pill.style.height = `${item.offsetHeight}px`;
    pill.style.transform = `translate(${item.offsetLeft}px, ${item.offsetTop}px)`;
  } else {
    pill.style.transform = `translateX(${item.offsetLeft}px)`;
  }
  if (!animate) {
    void pill.offsetWidth; // commit the jump before transitions come back
    pill.classList.remove('no-anim');
  }
  pill.classList.add('ready');
}

/**
 * Slide the pill whenever `deps` change (jumping into place the first time), and
 * keep it aligned when anything it depends on changes size: the container
 * (rotation, wrapping, the screen settling as an installed app opens), the items
 * themselves (fonts arriving), or the page coming back from the background.
 * A correction mid-slide redirects the slide; otherwise it jumps, so fixing a
 * stale measurement is invisible rather than a stray slide.
 */
export function useSlidingHighlight(
  containerRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  options: Options,
  deps: DependencyList,
) {
  const { active, axis } = options;
  useLayoutEffect(() => {
    placeHighlight(containerRef.current, pillRef.current, !!pillRef.current?.classList.contains('ready'), { active, axis });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass what should trigger a slide
  }, deps);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const realign = () => {
      const pill = pillRef.current;
      if (!pill?.classList.contains('ready')) return;
      const sliding = pill.getAnimations().some((a) => a.playState === 'running');
      placeHighlight(el, pill, sliding, { active, axis });
    };
    // Every report counts, including the first: the size can change between
    // placing the pill and the observer's first report.
    const ro = new ResizeObserver(realign);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    const onShow = () => document.visibilityState === 'visible' && realign();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', realign);
    let live = true;
    document.fonts?.ready.then(() => live && realign());
    return () => {
      live = false;
      ro.disconnect();
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', realign);
    };
  }, [containerRef, pillRef, active, axis]);
}
