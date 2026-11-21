// Capture input while the server-rendered page is usable but React is still
// loading. The navigation effect takes over and removes these one-shot listeners.
export const initialFragmentEntryScript = `(() => {
  if (!location.hash) return;
  const events = ["pointerdown", "keydown", "wheel", "touchstart"];
  const stop = () => events.forEach(type => window.removeEventListener(type, cancel, true));
  const state = { href: location.href, cancelled: false, stop };
  const cancel = () => { state.cancelled = true; stop(); };
  window.__aatInitialFragmentEntry = state;
  events.forEach(type => window.addEventListener(type, cancel, { capture: true, passive: true, once: true }));
})();`;

declare global {
  interface Window {
    __aatInitialFragmentEntry?: {
      href: string;
      cancelled: boolean;
      stop: () => void;
    };
  }
}
