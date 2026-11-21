/** Small facts about where the app is running. */

export function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** True when shown inside another page (e.g. the claude.ai viewer), where downloads,
 *  notifications and service workers are blocked. */
export const isEmbedded: boolean = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
