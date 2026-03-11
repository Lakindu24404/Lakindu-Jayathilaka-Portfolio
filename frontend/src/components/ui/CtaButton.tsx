"use client";

import { motion } from "motion/react";
import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { hoverSpring } from "@/lib/motion";
import { handleHashClick } from "@/lib/scroll";

function CvIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} fill="currentColor" aria-hidden>
      <path d="M210.78,39.25l-130.25-23A16,16,0,0,0,62,29.23l-29.75,169a16,16,0,0,0,13,18.53l130.25,23h0a16,16,0,0,0,18.54-13l29.75-169A16,16,0,0,0,210.78,39.25ZM178.26,224h0L48,201,77.75,32,208,55ZM89.34,58.42a8,8,0,0,1,9.27-6.48l83,14.65a8,8,0,0,1-1.39,15.88,8.36,8.36,0,0,1-1.4-.12l-83-14.66A8,8,0,0,1,89.34,58.42ZM83.8,89.94a8,8,0,0,1,9.27-6.49l83,14.66A8,8,0,0,1,174.67,114a7.55,7.55,0,0,1-1.41-.13l-83-14.65A8,8,0,0,1,83.8,89.94Zm-5.55,31.51A8,8,0,0,1,87.52,115L129,122.29a8,8,0,0,1-1.38,15.88,8.27,8.27,0,0,1-1.4-.12l-41.5-7.33A8,8,0,0,1,78.25,121.45Z" />
    </svg>
  );
}

/**
 * Signature pill CTA: lavender ring, white (or filled) inner, and a circle
 * with an arrow that slides in from the right on hover.
 * Hover padding (48 → 99) and the circle both use the 500/60 spring from
 * the live Button component.
 */
export function CtaButton({
  href,
  onClick,
  children,
  className = "",
  fill = "white",
  size = "lg",
  arrow = "down",
  target,
  rel,
  forcedHover = false,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  fill?: "white" | "accent" | "indigo";
  size?: "lg" | "md";
  arrow?: "down" | "right" | "up" | "cv";
  target?: string;
  rel?: string;
  forcedHover?: boolean;
}) {
  const filled = fill !== "white";
  const large = size === "lg";
  const innerBg =
    fill === "accent" ? "bg-accent" : fill === "indigo" ? "bg-indigo" : "bg-white";
  const textColor = filled ? "text-white" : "text-ink";
  const circleBg = filled ? "bg-white" : "bg-ink";
  const arrowColor = filled ? "text-ink" : "text-white";
    const dim = large
    ? "h-14 min-w-0 text-xl leading-[1.4] md:h-[72px] md:text-2xl"
    : "h-[38px] w-full text-base font-medium leading-[1.4]";
  const circle = large ? "size-14 md:size-[72px]" : "size-[38px]";
  const padRest = large ? 48 : 40;
  const padHover = large ? 99 : 64;
  const iconRest = large ? -78 : -54;
  const arrowPx = large ? "size-9" : "size-[18px]";

  const [hovered, setHovered] = useState(false);
  const open = forcedHover || hovered;

  const arrowIcon =
    arrow === "cv" ? (
      <CvIcon className={`${arrowColor} ${arrowPx}`} />
    ) : arrow === "up" ? (
      <svg
        viewBox="0 0 24 24"
        className={`${arrowColor} ${arrowPx}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
    ) : arrow === "down" ? (
      <svg
        viewBox="0 0 24 24"
        className={`${arrowColor} ${arrowPx}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 5v14M6 13l6 6 6-6" />
      </svg>
    ) : (
      <svg
        viewBox="0 0 24 24"
        className={`${arrowColor} ${arrowPx}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );

  const inner = (
    <motion.span
      className={`relative flex items-center justify-center overflow-visible rounded-panel ${innerBg} ${textColor} font-semibold ${dim}`}
      variants={{
        rest: { paddingLeft: padRest, paddingRight: padRest },
        hover: { paddingLeft: padRest, paddingRight: padHover },
      }}
      transition={hoverSpring}
    >
      <span>{children}</span>
      <motion.span
        aria-hidden
        variants={{
          rest: { right: iconRest, rotate: 180 },
          hover: { right: 0, rotate: 0 },
        }}
        transition={hoverSpring}
        className={`pointer-events-none absolute top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full ${circleBg} ${circle}`}
      >
        {arrowIcon}
      </motion.span>
    </motion.span>
  );

  const onActivate = (e: MouseEvent<HTMLAnchorElement>) => {
    if (href) handleHashClick(href, e);
    onClick?.();
  };

  const sharedClass = `group relative inline-flex max-w-full items-center overflow-hidden rounded-pill bg-surface-hover backdrop-blur-[5px] ${
    large ? "p-1.5" : "p-[5px]"
  } ${className}`;

  if (href) {
    return (
      <motion.a
        href={href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noreferrer" : undefined)}
        onClick={onActivate}
        className={sharedClass}
        initial="rest"
        animate={open ? "hover" : "rest"}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={sharedClass}
      initial="rest"
      animate={open ? "hover" : "rest"}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {inner}
    </motion.button>
  );
}
