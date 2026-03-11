"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { hoverSpring } from "@/lib/motion";

const WINDOW = 32;
const LINE = 24;

/**
 * Slot-machine roll through a 32px window (24px line + 8px gap), matching
 * `.framer-Qk9V0` on the live site. Variant changes use the hover spring
 * (500/60). The first item is repeated at the end so the wrap rolls the
 * same direction, then snaps back with the animation off.
 */
export function RotatingText({
  items,
  intervalMs = 3000,
  className = "",
}: {
  items: readonly string[];
  intervalMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const isClone = index === items.length;

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i >= items.length ? 1 : i + 1)),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  useEffect(() => {
    if (!isClone) return;
    const id = setTimeout(() => setIndex(0), 450);
    return () => clearTimeout(id);
  }, [isClone]);

  const reel = [...items, items[0]];

  return (
    <div
      className={`overflow-hidden [contain:paint] ${className}`}
      style={{ height: WINDOW }}
      aria-live="polite"
    >
      <motion.div
        animate={{ y: -index * WINDOW }}
        transition={index === 0 ? { duration: 0 } : hoverSpring}
      >
        {reel.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center justify-center"
            style={{ height: WINDOW }}
            aria-hidden={i !== index}
          >
            <span style={{ lineHeight: `${LINE}px` }}>{item}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
