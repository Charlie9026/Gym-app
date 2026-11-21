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
 * re-align when the container changes size (rotation, wrapping, a scrollbar
 * appearing). Re-aligning animates, so a resize mid-slide redirects the slide
 * instead of cancelling it.
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
    // ResizeObserver fires once on observe; skip that so it can't cancel the first slide.
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placeHighlight(el, pillRef.current, true, { active, axis });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, pillRef, active, axis]);
}
