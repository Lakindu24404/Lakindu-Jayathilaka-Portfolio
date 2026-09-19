"use client";

import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import type { CSSProperties } from "react";
import { appear3dFrom, bobSpring, HERO_PARALLAX_START } from "@/lib/motion";
import styles from "./FloatingShapes.module.css";

/**
 * Transforms measured from the live Cohesion hero at 1440×900.
 * Rotation lives on the wrapper (the PNGs themselves are unrotated renders).
 *
 * Each solid has three motions from the published bundle:
 * 1. Appear — scale 0.8 → 1, spring 200/30, threshold 0.5, reverses on leave
 * 2. Loop — linear mirror bob, y 12 or 24, duration 2–2.8s one way
 * 3. Parallax — Framer speed (100 = locked to scroll). Read straight off the
 *    live site by sampling `getComputedStyle().transform` at 0/200/400/600/800
 *    of real scroll: the rows pair up at 140 (top), 150 (middle) and 160
 *    (bottom), and nothing moves at all for the first 200px.
 *
 * The bob is a CSS animation rather than a Motion loop: Motion can only hand
 * `y` loops with `repeatType: "mirror"` to the compositor as a keyframe
 * animation, so the six loops used to run in JavaScript every frame, forever.
 *
 * Phone / tablet positions are a separate composition: the desktop percentages
 * put ~280px solids on top of the portrait once the viewport is a phone.
 */
const ITEMS = [
  { src: "/images/pyramid-orange.webp", alt: "Orange Pyramid", cx: 26.6, cy: 26.4, tx: 16, ty: 20, px: 16, py: 24, size: 278, rotateZ: 10, rotateX: 0, speed: 140, bob: 12, bobDuration: 2.4 },
  { src: "/images/sphere-purple.webp", alt: "Purple Sphere", cx: 21.0, cy: 50.0, tx: 12, ty: 48, px: 12, py: 50, size: 279, rotateZ: 0, rotateX: 6.7, speed: 150, bob: 12, bobDuration: 2.0 },
  { src: "/images/cylinder-blue.webp", alt: "Blue Cylinder", cx: 27.5, cy: 75.4, tx: 15, ty: 82, px: 16, py: 78, size: 262, rotateZ: -55, rotateX: 0, speed: 160, bob: 24, bobDuration: 2.8 },
  { src: "/images/star-teal.webp", alt: "Turquoise Star", cx: 72.4, cy: 26.8, tx: 84, ty: 20, px: 84, py: 24, size: 293, rotateZ: 0, rotateX: 0, speed: 140, bob: 12, bobDuration: 2.4 },
  { src: "/images/capsule-lime.webp", alt: "Lime Green Object", cx: 78.6, cy: 50.4, tx: 88, ty: 50, px: 88, py: 51, size: 274, rotateZ: 0, rotateX: 6.7, speed: 150, bob: 12, bobDuration: 2.0 },
  { src: "/images/cube-yellow.webp", alt: "Yellow Cube", cx: 72.4, cy: 75.0, tx: 85, ty: 82, px: 84, py: 78, size: 296, rotateZ: 0, rotateX: 0, speed: 160, bob: 24, bobDuration: 2.8 },
] as const;

/** The rendered width at each breakpoint (see FloatingShapes.module.css). */
const SHAPE_SIZES = "(max-width: 767px) 120px, (max-width: 1199px) 168px, 296px";

export function FloatingShapes({
  scrollY,
}: {
  scrollY: MotionValue<number>;
}) {
  const reduce = useReducedMotion();

  return (
    <div className={styles.stage} aria-hidden>
      {ITEMS.map((item) => (
        <ShapeItem
          key={item.alt}
          item={item}
          reduce={!!reduce}
          scrollY={scrollY}
        />
      ))}
    </div>
  );
}

function ShapeItem({
  item,
  reduce,
  scrollY,
}: {
  item: (typeof ITEMS)[number];
  reduce: boolean;
  scrollY: MotionValue<number>;
}) {
  const vw = (item.size / 14.4).toFixed(2);
  const rate = -(item.speed - 100) / 100;
  const parallax = useTransform(scrollY, (v) =>
    reduce ? 0 : Math.max(0, v - HERO_PARALLAX_START) * rate,
  );

  return (
    <div
      className={styles.shape}
      style={
        {
          "--dx": `${item.cx}%`,
          "--dy": `${item.cy}%`,
          "--tx": `${item.tx}%`,
          "--ty": `${item.ty}%`,
          "--px": `${item.px}%`,
          "--py": `${item.py}%`,
          "--vw": `${vw}vw`,
          "--native": `${item.size}px`,
          "--bob": `${item.bob}px`,
          "--bob-duration": `${item.bobDuration}s`,
        } as CSSProperties
      }
    >
      <motion.div className={styles.parallax} style={{ y: parallax }}>
        <motion.div
          initial={reduce ? false : appear3dFrom}
          whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
          viewport={{ once: false, amount: 0.5 }}
          transition={bobSpring}
          style={{
            rotateZ: item.rotateZ,
            rotateX: item.rotateX,
            transformOrigin: "center center",
          }}
        >
          <div className={styles.bob}>
            <Image
              src={item.src}
              alt=""
              width={1024}
              height={1024}
              sizes={SHAPE_SIZES}
              loading="eager"
              draggable={false}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
