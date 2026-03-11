/**
 * Springs and tweens measured from the published Cohesion bundle
 * (https://cohesion.framer.ai, Framer site 650ovdcXNrUyveRRfGW8Ip).
 *
 * Framer loop + `repeatType: "mirror"` uses `duration` as one direction,
 * so a full cycle is 2× duration.
 */
/**
 * Nothing in the hero drifts for the first 200px of scroll on the live site —
 * every parallax rate is applied to `scrollY - 200`, clamped at zero.
 */
export const HERO_PARALLAX_START = 200;

export const hoverSpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 60,
  mass: 1,
  delay: 0,
};

export const appearSpring = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 1,
  delay: 0,
};

export const bobSpring = {
  type: "spring" as const,
  stiffness: 200,
  damping: 30,
  mass: 1,
  delay: 0,
};

/** Folira Navbar Mobile Close ↔ Mobile Open (`qn` in the published bundle). */
export const navMenuSpring = {
  type: "spring" as const,
  stiffness: 200,
  damping: 30,
  mass: 1,
  delay: 0,
};

export const footerSpring = {
  type: "spring" as const,
  stiffness: 200,
  damping: 40,
  mass: 1,
  delay: 0,
};

export const scrollTargetSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 60,
  mass: 1,
  delay: 0,
  duration: 0.3,
  ease: [0.44, 0, 0.56, 1] as const,
};

export const photoFanSpring = {
  type: "spring" as const,
  stiffness: 100,
  damping: 30,
  mass: 1,
};

export const linear = [0, 0, 1, 1] as const;

export const appearFrom = {
  opacity: 0,
  scale: 0.8,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  x: 0,
  y: 0,
};

export const appear3dFrom = {
  opacity: 1,
  scale: 0.8,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  x: 0,
  y: 0,
};

/** Circular arc-text `rotateSpeed: 5` → duration 100/5 = 20s. */
export const SCROLL_RING_SECONDS = 20;

/**
 * GSAP `scrub: 1` — the tween chases the scrollbar over roughly a second
 * rather than locking to it. Slightly overdamped so the panel never overshoots
 * past full size.
 */
export const scrubSpring = {
  stiffness: 80,
  damping: 20,
  mass: 1,
};
