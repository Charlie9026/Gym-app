/**
 * Stops the page zooming. The viewport tag covers most browsers, but iPhone
 * Safari ignores it, so pinch gestures are cancelled here as well.
 */
export function blockZoom() {
  const stop = (e: Event) => e.preventDefault();
  // Safari's pinch events.
  document.addEventListener('gesturestart', stop);
  document.addEventListener('gesturechange', stop);
  // Two-finger moves elsewhere (one finger still scrolls normally).
  document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });
}
