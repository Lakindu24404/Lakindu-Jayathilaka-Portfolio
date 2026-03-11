"use client";

import {
  motion,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { appear3dFrom, bobSpring, HERO_PARALLAX_START, linear } from "@/lib/motion";
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
 * Phone / tablet positions are a separate composition: the desktop percentages
 * put ~280px solids on top of the portrait once the viewport is a phone.
 */
const ITEMS = [
  { src: "/images/pyramid-orange.png", alt: "Orange Pyramid", cx: 26.6, cy: 26.4, tx: 16, ty: 20, px: 16, py: 24, size: 278, rotateZ: 10, rotateX: 0, speed: 140, bob: 12, bobDuration: 2.4 },
  { src: "/images/sphere-purple.png", alt: "Purple Sphere", cx: 21.0, cy: 50.0, tx: 12, ty: 48, px: 12, py: 50, size: 279, rotateZ: 0, rotateX: 6.7, speed: 150, bob: 12, bobDuration: 2.0 },
  { src: "/images/cylinder-blue.png", alt: "Blue Cylinder", cx: 27.5, cy: 75.4, tx: 15, ty: 82, px: 16, py: 78, size: 262, rotateZ: -55, rotateX: 0, speed: 160, bob: 24, bobDuration: 2.8 },
  { src: "/images/star-teal.png", alt: "Turquoise Star", cx: 72.4, cy: 26.8, tx: 84, ty: 20, px: 84, py: 24, size: 293, rotateZ: 0, rotateX: 0, speed: 140, bob: 12, bobDuration: 2.4 },
  { src: "/images/capsule-lime.png", alt: "Lime Green Object", cx: 78.6, cy: 50.4, tx: 88, ty: 50, px: 88, py: 51, size: 274, rotateZ: 0, rotateX: 6.7, speed: 150, bob: 12, bobDuration: 2.0 },
  { src: "/images/cube-yellow.png", alt: "Yellow Cube", cx: 72.4, cy: 75.0, tx: 85, ty: 82, px: 84, py: 78, size: 296, rotateZ: 0, rotateX: 0, speed: 160, bob: 24, bobDuration: 2.8 },
] as const;

function useBobScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const phone = window.matchMedia("(max-width: 767px)");
    const tablet = window.matchMedia("(min-width: 768px) and (max-width: 1199px)");
    const sync = () => {
      if (phone.matches) setScale(0.55);
      else if (tablet.matches) setScale(0.7);
      else setScale(1);
    };
    sync();
    phone.addEventListener("change", sync);
    tablet.addEventListener("change", sync);
    return () => {
      phone.removeEventListener("change", sync);
      tablet.removeEventListener("change", sync);
    };
  }, []);

  return scale;
}

export function FloatingShapes({
  scrollY,
}: {
  scrollY: MotionValue<number>;
}) {
  const reduce = useReducedMotion();
  const bobScale = useBobScale();

  return (
    <div className={styles.stage} aria-hidden>
      {ITEMS.map((item) => (
        <ShapeItem
          key={item.alt}
          item={item}
          reduce={!!reduce}
          scrollY={scrollY}
          bobScale={bobScale}
        />
      ))}
    </div>
  );
}

function ShapeItem({
  item,
  reduce,
  scrollY,
  bobScale,
}: {
  item: (typeof ITEMS)[number];
  reduce: boolean;
  scrollY: MotionValue<number>;
  bobScale: number;
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
        } as CSSProperties
      }
    >
      <motion.div style={{ y: parallax }}>
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
          <motion.div
            animate={reduce ? undefined : { y: [0, item.bob * bobScale] }}
            transition={
              reduce
                ? undefined
                : {
                    duration: item.bobDuration,
                    repeat: Infinity,
                    repeatType: "mirror",
                    ease: linear,
                  }
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt="" draggable={false} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
