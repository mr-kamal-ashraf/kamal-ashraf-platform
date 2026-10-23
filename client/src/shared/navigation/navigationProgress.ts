/**
 * Whether a page change is under way — so the loading screen shows from the
 * click itself, not only once the server starts answering (until then Next
 * keeps the old page up and nothing seems to happen).
 *
 * Next calls onRouterTransitionStart (instrumentation-client.ts) the moment a
 * Link is clicked or router.push/replace runs. The change is over once the URL
 * has changed AND every loading screen on the new page is gone — its
 * loading.tsx, the page's own data loading, a list or section still loading —
 * so the loader stays up until the page is really ready, then hands over.
 *
 * A plain module (no React) — it loads before the app does.
 */

let target: string | null = null; // the page being opened (path + query)
let urlChanged = false;
let holds = 0; // loading screens currently on the page
let failsafe = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

function finish() {
  if (target === null) return;
  target = null;
  window.clearTimeout(failsafe);
  emit();
}

/** A Link click / router.push / router.replace just started. */
export function navigationStarted(href: string) {
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return;
  }
  // Another site: the browser shows its own progress.
  if (url.origin !== window.location.origin) return;
  // Same page (or only the #hash changes): nothing is going to load.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return;

  target = url.pathname + url.search;
  urlChanged = false;
  window.clearTimeout(failsafe);
  // Never leave the screen covered if a navigation somehow never lands.
  failsafe = window.setTimeout(finish, 30_000);
  emit();
}

/** The URL changed: the new page is on screen — or its loading screens are. */
export function urlCommitted() {
  if (target === null) return;
  urlChanged = true;
  if (holds === 0) finish();
}

/**
 * A loading screen appeared; call the returned function when it goes. The
 * check after it goes waits a tick: one loading screen often hands over to
 * the next in the same render (the page's data arrives, a section of it
 * starts loading its own), and that must not end the page change between.
 */
export function holdPageChange() {
  holds += 1;
  return () => {
    holds -= 1;
    queueMicrotask(() => {
      if (holds === 0 && urlChanged) finish();
    });
  };
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The page being opened, or null when no page change is under way. */
export const getNavigationTarget = () => target;
