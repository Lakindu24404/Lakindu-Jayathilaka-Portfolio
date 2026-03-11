declare global {
  interface Window {
    __lenis?: {
      scrollTo: (
        target: HTMLElement | number | string,
        options?: {
          offset?: number;
          immediate?: boolean;
          duration?: number;
          easing?: (time: number) => number;
        },
      ) => void;
      on?: (event: "scroll", cb: () => void) => () => void;
    };
  }
}

/** Shared by SmoothScroll and late-mounting navigation observers. */
export const LENIS_READY_EVENT = "portfolio:lenis-ready";

/**
 * A short exponential ease matches the reference navbar's immediate response:
 * most of the distance is covered early, followed by a controlled soft stop.
 */
export const NAV_SCROLL_DURATION = 0.8;
export const NAV_SCROLL_EASING = (time: number) =>
  Math.min(1, 1.001 - Math.pow(2, -10 * time));

/**
 * Observed landing y of section headings on the live Cohesion site at 1280×720
 * (Projects heading ≈ 173px). One offset only — no extra scroll-padding or
 * scroll-margin on top of this.
 */
export const NAV_LANDING_Y = 173;

const TOP_ALIGNED_SECTIONS = new Set([
  "home",
  "about",
  "stack",
  "services",
  "projects",
  "get-in-touch",
  "contact",
]);

function scrollTarget(el: HTMLElement, id: string) {
  if (TOP_ALIGNED_SECTIONS.has(id)) return el;
  return el.querySelector("h2") ?? el;
}

function landingOffset(id: string) {
  if (TOP_ALIGNED_SECTIONS.has(id)) return 0;
  return -NAV_LANDING_Y;
}

export function landingY(id: string) {
  if (TOP_ALIGNED_SECTIONS.has(id)) return 0;
  return NAV_LANDING_Y;
}

export function scrollToHash(hash: string, immediate = false) {
  const id = hash.replace(/^#/, "");
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;
  const target = scrollTarget(el, id);
  const offset = landingOffset(id);
  // Native hash navigation can move the page before Lenis receives its scroll
  // event. Measure from the actual viewport, not Lenis's previous scroll value.
  const top = target.getBoundingClientRect().top + window.scrollY + offset;
  const shouldJump =
    immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(top, {
      immediate: shouldJump,
      duration: NAV_SCROLL_DURATION,
      easing: NAV_SCROLL_EASING,
    });
    return;
  }
  window.scrollTo({ top, behavior: shouldJump ? "instant" : "smooth" });
}

/** In-page hash if the target exists; otherwise follow `/#section` to home. */
export function handleHashClick(
  href: string,
  e: {
    preventDefault: () => void;
    defaultPrevented?: boolean;
    button?: number;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  },
  options: { immediate?: boolean } = {},
) {
  // Preserve normal browser behaviour for new-tab/window gestures.
  if (
    e.defaultPrevented ||
    (e.button !== undefined && e.button !== 0) ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.altKey
  ) {
    return;
  }
  if (!href.includes("#")) return;
  const hash = `#${href.split("#")[1]}`;
  if (hash.length <= 1) return;
  if (document.getElementById(hash.slice(1))) {
    e.preventDefault();
    scrollToHash(hash, options.immediate);
    return;
  }
  if (href.startsWith("/#") && window.location.pathname !== "/") {
    e.preventDefault();
    window.location.assign(href);
  }
}

export function sectionMarker(hash: string) {
  const el = document.querySelector(hash);
  if (!el) return null;
  const id = hash.replace(/^#/, "");
  if (TOP_ALIGNED_SECTIONS.has(id)) return el;
  return el.querySelector("h2") ?? el;
}
