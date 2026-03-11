"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "motion/react";

/**
 * Cursor-follow labels live at the document root: animated card transforms
 * must not become the containing block of this fixed-position overlay.
 * Project pills are centred on the pointer; Stack keeps its 20px offset.
 */
export function FollowCursor({
  label,
  children,
  className = "",
  variant = "label",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  variant?: "label" | "project";
}) {
  const reduce = useReducedMotion();
  const project = variant === "project";
  const offset = project ? 0 : 20;
  const center = project ? " translate(-50%, -50%)" : "";
  const pill = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const raf = useRef(0);
  const [on, setOn] = useState(false);
  const [hoverOk, setHoverOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setHoverOk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!on) return;
    const hide = () => setOn(false);
    window.addEventListener("blur", hide);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      window.removeEventListener("blur", hide);
      window.removeEventListener("scroll", hide);
    };
  }, [on]);

  useEffect(() => {
    if (!on || !hoverOk || reduce) {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      return;
    }

    const stiffness = 300;
    const damping = 60;
    const mass = 1;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const el = pill.current;
      const cur = current.current;
      const to = target.current;
      const ax = (to.x - cur.x) * stiffness - cur.vx * damping;
      const ay = (to.y - cur.y) * stiffness - cur.vy * damping;
      cur.vx += (ax / mass) * dt;
      cur.vy += (ay / mass) * dt;
      cur.x += cur.vx * dt;
      cur.y += cur.vy * dt;
      if (el) {
        el.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)${center}`;
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [on, hoverOk, reduce, center]);

  const onMove = useCallback((e: MouseEvent) => {
    const next = { x: e.clientX + offset, y: e.clientY + offset };
    target.current = next;
    if (reduce && pill.current) {
      pill.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)${center}`;
    }
    setOn(true);
  }, [offset, center, reduce]);

  const onEnter = useCallback((e: MouseEvent) => {
    const start = { x: e.clientX + offset, y: e.clientY + offset };
    target.current = start;
    current.current = { x: start.x, y: start.y, vx: 0, vy: 0 };
    const el = pill.current;
    if (el) el.style.transform = `translate3d(${start.x}px, ${start.y}px, 0)${center}`;
    setOn(true);
  }, [offset, center]);

  const enabled = hoverOk && (project || !reduce);
  const show = on && enabled;

  return (
    <div
      className={`${className} ${show ? "cursor-none [&_a]:cursor-none" : ""}`}
      onMouseEnter={onEnter}
      onMouseLeave={() => setOn(false)}
      onMouseMove={onMove}
    >
      {children}
      {enabled && createPortal(
        <div
          ref={pill}
          aria-hidden
          data-follow-cursor={variant}
          className={`pointer-events-none fixed left-0 top-0 z-[80] whitespace-nowrap rounded-pill bg-white text-ink shadow-[0_20px_20px_rgb(0_0_0/0.1)] backdrop-blur-[5px] transition-opacity duration-200 ${project ? "flex h-[54px] items-center pl-9 pr-[78px] text-xl font-normal leading-6" : "px-5 py-2.5 text-sm font-medium"}`}
          style={{
            opacity: show ? 1 : 0,
            transform: "translate3d(-9999px,-9999px,0)",
          }}
        >
          {label}
          {project && (
            <span className="absolute right-0 top-0 flex size-[54px] items-center justify-center rounded-full bg-ink text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h16m-7-7 7 7-7 7" />
              </svg>
            </span>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
