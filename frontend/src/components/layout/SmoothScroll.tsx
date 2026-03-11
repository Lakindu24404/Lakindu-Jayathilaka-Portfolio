"use client";

import Lenis from "lenis";
import { useReducedMotion } from "motion/react";
import { useEffect } from "react";
import {
  LENIS_READY_EVENT,
  NAV_SCROLL_DURATION,
  NAV_SCROLL_EASING,
  scrollToHash,
} from "@/lib/scroll";
import "lenis/dist/lenis.css";

/** Quick section travel with a soft stop, plus Lenis' overflow handling. */
export function SmoothScroll() {
  const reduce = useReducedMotion();

  useEffect(() => {
    let initialHash = window.location.hash;
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    const isReload = navigation?.type === "reload";
    const startsAtHome =
      window.location.pathname === "/" &&
      (initialHash.length <= 1 || isReload);

    // Navbar section clicks intentionally leave the clean `/` URL in place.
    // Without this override Chromium restores the previous Y position on a
    // reload, making a refresh from Projects look like Projects is the home
    // page. A real `/#section` URL remains an explicit deep link and is
    // handled below on its first visit. If that URL itself is refreshed, the
    // user explicitly wants a fresh homepage, so retire the stale hash first.
    if (startsAtHome) {
      if (initialHash.length > 1) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        initialHash = "";
      }
      window.history.scrollRestoration = "manual";
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }

    if (reduce) {
      if (initialHash.length > 1) scrollToHash(initialHash, true);
      return;
    }

    let raf = 0;
    let hashFrame = 0;
    let cancelInitialAlignment = () => {};
    const instance = new Lenis({
      duration: NAV_SCROLL_DURATION,
      easing: NAV_SCROLL_EASING,
      autoToggle: true,
    });
    window.__lenis = instance;
    window.dispatchEvent(new Event(LENIS_READY_EVENT));

    if (startsAtHome) instance.scrollTo(0, { immediate: true });

    const loop = (time: number) => {
      instance.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    if (initialHash.length > 1) {
      scrollToHash(initialHash, true);
    }

    // Direct section links can land before fonts/images above them settle.
    // Realign once after loading, but never pull a visitor back after input.
    if (initialHash === "#stack" || initialHash === "#services" || initialHash === "#get-in-touch") {
      let cancelled = false;
      const cancel = () => { cancelled = true; };
      const align = () => {
        void document.fonts.ready.then(() => {
          if (cancelled) return;
          hashFrame = requestAnimationFrame(() => {
            if (!cancelled && window.location.hash === initialHash) {
              scrollToHash(initialHash, true);
            }
          });
        });
      };
      window.addEventListener("wheel", cancel, { passive: true, once: true });
      window.addEventListener("pointerdown", cancel, { once: true });
      window.addEventListener("keydown", cancel, { once: true });
      window.addEventListener("load", align, { once: true });
      if (document.readyState === "complete") align();
      cancelInitialAlignment = () => {
        cancel();
        window.removeEventListener("wheel", cancel);
        window.removeEventListener("pointerdown", cancel);
        window.removeEventListener("keydown", cancel);
        window.removeEventListener("load", align);
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(hashFrame);
      cancelInitialAlignment();
      if (window.__lenis === instance) delete window.__lenis;
      instance.destroy();
    };
  }, [reduce]);

  return null;
}
