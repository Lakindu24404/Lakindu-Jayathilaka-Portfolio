"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { RollLink } from "@/components/ui/RollLink";
import { site } from "@/content/site";
import { hoverSpring, navMenuSpring } from "@/lib/motion";
import {
  landingY,
  LENIS_READY_EVENT,
  NAV_LANDING_Y,
  sectionMarker,
} from "@/lib/scroll";

export function TopNav() {
  const [active, setActive] = useState<string>("#home");
  const [open, setOpen] = useState(false);
  const locked = useRef<string | null>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const reduce = useReducedMotion();
  const spring = reduce ? { duration: 0 } : navMenuSpring;

  useEffect(() => {
    let frame = 0;
    document.documentElement.dataset.navigationReady = "true";

    const measure = () => {
      frame = 0;
      const line = NAV_LANDING_Y + 32;
      if (locked.current) {
        const marker = sectionMarker(locked.current);
        if (marker) {
          const top = marker.getBoundingClientRect().top;
          const id = locked.current.replace(/^#/, "");
          if (Math.abs(top - landingY(id)) > 28) return;
        }
        locked.current = null;
      }
      let current = "#home";
      for (const item of site.nav) {
        const hash = item.href.replace("/", "");
        const marker = sectionMarker(hash);
        if (!marker) continue;
        if (marker.getBoundingClientRect().top <= line) current = hash;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    let unsubscribeLenis: (() => void) | undefined;
    const connectLenis = () => {
      unsubscribeLenis?.();
      unsubscribeLenis = window.__lenis?.on?.("scroll", onScroll);
    };
    const interruptNavigation = (event: Event) => {
      if (
        event instanceof KeyboardEvent &&
        ![
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        return;
      }
      locked.current = null;
      onScroll();
    };

    connectLenis();
    window.addEventListener(LENIS_READY_EVENT, connectLenis);
    window.addEventListener("wheel", interruptNavigation, { passive: true });
    window.addEventListener("touchstart", interruptNavigation, { passive: true });
    window.addEventListener("keydown", interruptNavigation);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener(LENIS_READY_EVENT, connectLenis);
      window.removeEventListener("wheel", interruptNavigation);
      window.removeEventListener("touchstart", interruptNavigation);
      window.removeEventListener("keydown", interruptNavigation);
      unsubscribeLenis?.();
      delete document.documentElement.dataset.navigationReady;
    };
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!mobileRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const go = (hash: string) => {
    locked.current = hash;
    setActive(hash);
    setOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-end overflow-visible px-5 pt-[max(20px,env(safe-area-inset-top))] md:justify-center md:px-4 md:pt-6">
      <div ref={mobileRef} className="relative size-12 md:hidden">
        <motion.nav
          initial={false}
          animate={open ? "open" : "closed"}
          variants={{
            closed: {
              opacity: 0,
              top: 0,
              scale: 0.35,
              pointerEvents: "none",
            },
            open: {
              opacity: 1,
              top: 64,
              scale: 1,
              pointerEvents: "auto",
            },
          }}
          transition={spring}
          style={{ originX: 1, originY: 0 }}
          id={menuId}
          aria-label="Site menu"
          aria-hidden={!open}
          inert={open ? undefined : true}
          className="absolute right-0 z-[1] flex min-w-[240px] flex-col items-center gap-3 rounded-[12px] bg-white p-8 shadow-[0_10px_20px_rgb(0_0_0/0.05)]"
        >
          {site.nav.map((item) => {
            const hash = item.href.replace("/", "");
            const isActive = active === hash;
            return (
              <div key={item.href} className="relative w-fit">
                <RollLink
                  href={item.href}
                  height={42}
                  onClick={() => go(hash)}
                  current={isActive ? "location" : undefined}
                  immediate
                  className={`relative z-10 ${
                    isActive ? "text-white" : "text-ink-muted"
                  }`}
                  lineClassName="px-5 text-[24px] font-medium leading-[1.2] tracking-[var(--tracking-display)]"
                >
                  {item.label}
                </RollLink>
                {isActive && (
                  <motion.span
                    layoutId="nav-pill-mobile"
                    transition={hoverSpring}
                    className="absolute inset-0 rounded-pill bg-accent"
                  />
                )}
              </div>
            );
          })}
        </motion.nav>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
          className="absolute inset-0 z-[2] flex size-12 cursor-pointer items-center justify-center rounded-full bg-white shadow-[0_10px_20px_rgb(0_0_0/0.05)]"
        >
          <span className="relative block size-12" aria-hidden>
            <motion.span
              className="absolute left-[calc(50%-9px)] top-[18px] block h-0.5 w-[18px] rounded-full bg-ink"
              initial={false}
              animate={open ? { top: 23, rotate: -45 } : { top: 18, rotate: 0 }}
              transition={spring}
            />
            <motion.span
              className="absolute left-[calc(50%-9px)] top-[23px] block h-0.5 w-[18px] rounded-full bg-ink"
              initial={false}
              animate={{ opacity: open ? 0 : 1 }}
              transition={spring}
            />
            <motion.span
              className="absolute left-[calc(50%-9px)] top-[28px] block h-0.5 w-[18px] rounded-full bg-ink"
              initial={false}
              animate={open ? { top: 23, rotate: 45 } : { top: 28, rotate: 0 }}
              transition={spring}
            />
          </span>
        </button>
      </div>

      <nav className="hidden max-w-full rounded-[24px] bg-white p-[3px] shadow-[0_5px_20px_rgb(0_0_0/0.05)] md:block">
        <ul className="flex items-center">
          {site.nav.map((item) => {
            const hash = item.href.replace("/", "");
            const isActive = active === hash;
            return (
              <li key={item.href} className="relative shrink-0">
                <RollLink
                  href={item.href}
                  height={42}
                  onClick={() => go(hash)}
                  current={isActive ? "location" : undefined}
                  immediate
                  className={`relative z-10 ${
                    isActive ? "text-white" : "text-ink-muted"
                  }`}
                  lineClassName="px-2.5 text-[13px] font-medium lg:px-[18px] lg:text-sm"
                >
                  {item.label}
                </RollLink>
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={hoverSpring}
                    className="absolute inset-0 rounded-pill bg-accent"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
