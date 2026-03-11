"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { SCROLL_RING_SECONDS } from "@/lib/motion";

/**
 * 140px circular arc-text on the back of the Profile Photo. Read off the live
 * SVG: viewBox 0 0 100 100 scaled to 140, the text riding a radius-41 circle (its ascent lands the glyph ring
 * on the same 105-unit outer edge the reference measures)
 * at 12 user units / 400 with no letter- or word-spacing, one turn of copy,
 * rotating once per 20s. A 96px hairline circle sits inside it around a thin
 * down-arrow that bobs 12px on a 1s linear mirror loop.
 */
export function ScrollRing({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  const rawId = useId();
  const pathId = `scroll-ring-${rawId.replace(/:/g, "")}`;

  return (
    <div
      className={`pointer-events-none absolute z-30 size-[min(140px,78%)] ${className}`}
      aria-hidden
    >
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full overflow-visible"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={
          reduce
            ? undefined
            : {
                duration: SCROLL_RING_SECONDS,
                repeat: Infinity,
                ease: "linear",
              }
        }
      >
        <path
          id={pathId}
          d="M 9,50 A 41,41 0 0,1 91,50 A 41,41 0 0,1 9,50"
          fill="transparent"
        />
        <text
          className="fill-ink"
          style={{ fontSize: "12px", fontWeight: 400 }}
        >
          <textPath href={`#${pathId}`} startOffset="0">
            {"✦  SCROLL DOWN  ✦ AND KNOW ME BETTER"}
          </textPath>
        </text>
      </motion.svg>
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[68.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink"
      />
      <motion.div
        className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        animate={reduce ? undefined : { y: [0, 12] }}
        transition={
          reduce
            ? undefined
            : {
                duration: 1,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "linear",
              }
        }
      >
        <svg
          viewBox="0 0 24 24"
          className="size-8 text-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </motion.div>
    </div>
  );
}
