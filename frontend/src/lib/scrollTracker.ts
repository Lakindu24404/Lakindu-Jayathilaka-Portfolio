import { cancelFrame, frame } from "motion/react";

/**
 * One shared scroll reader for every scroll-linked effect on the page.
 *
 * Each effect used to add its own `scroll` listener (often a native one and a
 * Lenis one) and call `getBoundingClientRect()` on every event, so 30-odd
 * headings measured themselves several times per frame, wherever they were on
 * the page. Here a single IntersectionObserver keeps track of which elements
 * are within a viewport of the screen, and a single callback in Motion's read
 * phase — before anything writes styles for the frame — measures only those,
 * only when the scroll position or viewport actually changed.
 *
 * `measure` receives the element's rect and the viewport height, exactly what
 * the old listeners computed their progress from, so every effect keeps its
 * own mapping.
 */
export type ScrollMeasure = (rect: DOMRect, viewportHeight: number) => void;

type Tracker = {
  element: Element;
  measure: ScrollMeasure;
  near: boolean;
  dirty: boolean;
};

/** Elements this close to the viewport keep following the scroll. */
const NEAR_MARGIN = "100% 0px";

const trackers = new Set<Tracker>();
const byElement = new Map<Element, Set<Tracker>>();
let observer: IntersectionObserver | null = null;
let running = false;
let lastScrollY = Number.NaN;
let lastViewport = Number.NaN;

function read() {
  const scrollY = window.scrollY;
  const viewport = window.innerHeight;
  const moved = scrollY !== lastScrollY || viewport !== lastViewport;
  // A jump of more than a screen (anchor links, restored positions, the first
  // frame) or a new viewport height can move far-away elements past their
  // thresholds without ever bringing them near, so re-measure everything.
  const jumped =
    moved &&
    (Number.isNaN(lastScrollY) ||
      viewport !== lastViewport ||
      Math.abs(scrollY - lastScrollY) > viewport);
  lastScrollY = scrollY;
  lastViewport = viewport;

  for (const tracker of trackers) {
    if (tracker.dirty || jumped || (moved && tracker.near)) {
      tracker.dirty = false;
      tracker.measure(tracker.element.getBoundingClientRect(), viewport);
    }
  }
}

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        for (const tracker of byElement.get(entry.target) ?? []) {
          if (tracker.near === entry.isIntersecting) continue;
          tracker.near = entry.isIntersecting;
          // Measure once on the way in and once on the way out, so an element
          // that leaves mid-effect settles on its final value.
          tracker.dirty = true;
        }
      }
    },
    { rootMargin: NEAR_MARGIN },
  );
  return observer;
}

/** Calls `measure` whenever `element`'s scroll position may have changed. */
export function trackScroll(element: Element, measure: ScrollMeasure) {
  const tracker: Tracker = { element, measure, near: false, dirty: true };
  trackers.add(tracker);

  let group = byElement.get(element);
  if (!group) {
    group = new Set();
    byElement.set(element, group);
    getObserver().observe(element);
  }
  group.add(tracker);

  if (!running) {
    running = true;
    frame.read(read, true);
  }

  return () => {
    trackers.delete(tracker);
    group.delete(tracker);
    if (group.size === 0) {
      byElement.delete(element);
      observer?.unobserve(element);
    }
    if (trackers.size === 0 && running) {
      running = false;
      cancelFrame(read);
    }
  };
}
