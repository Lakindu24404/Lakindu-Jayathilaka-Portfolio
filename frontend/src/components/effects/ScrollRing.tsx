import { useId, type CSSProperties } from "react";
import { SCROLL_RING_SECONDS } from "@/lib/motion";
import styles from "./ScrollRing.module.css";

/**
 * 140px circular arc-text on the back of the Profile Photo. Read off the live
 * SVG: viewBox 0 0 100 100 scaled to 140, the text riding a radius-41 circle (its ascent lands the glyph ring
 * on the same 105-unit outer edge the reference measures)
 * at 12 user units / 400 with no letter- or word-spacing, one turn of copy,
 * rotating once per 20s. A 96px hairline circle sits inside it around a thin
 * down-arrow that bobs 12px on a 1s linear mirror loop.
 *
 * Both loops are CSS animations so they run on the compositor. The ring sits
 * on the card's back face, hidden until the card flips, so `active` holds them
 * still whenever nobody can see them.
 */
export function ScrollRing({
  className = "",
  active = true,
}: {
  className?: string;
  active?: boolean;
}) {
  const rawId = useId();
  const pathId = `scroll-ring-${rawId.replace(/:/g, "")}`;

  return (
    <div
      className={`pointer-events-none absolute z-30 size-[min(140px,78%)] ${styles.ring} ${className}`}
      data-active={active}
      style={{ "--spin-duration": `${SCROLL_RING_SECONDS}s` } as CSSProperties}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        className={`absolute inset-0 h-full w-full overflow-visible ${styles.spin}`}
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
      </svg>
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[68.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink"
      />
      <div
        className={`absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center ${styles.arrow}`}
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
      </div>
    </div>
  );
}
