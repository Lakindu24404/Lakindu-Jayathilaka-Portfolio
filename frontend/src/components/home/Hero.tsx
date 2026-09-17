"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { FloatingShapes } from "@/components/effects/FloatingShapes";
import { RotatingText } from "@/components/effects/RotatingText";
import { ScrollRing } from "@/components/effects/ScrollRing";
import { TextReveal } from "@/components/effects/TextReveal";
import { site } from "@/content/site";
import { HERO_PARALLAX_START, hoverSpring } from "@/lib/motion";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Profile Photo (`framer-7yFNy`). Faces animate independently (not a
 * single preserve-3d wrapper): desktop rest is a 10° Y tilt, hover
 * sends the front to -180 and the back from 180 to -10, spring 500/60,
 * perspective 500. Both faces are 280 squares, radius 48, shadow
 * 0 20px 20px rgb(0 0 0 / 0.1). The portrait bitmap is 280×420 inside
 * the clipped front, object-position 47.9% 24.1%.
 */
function PortraitFlip() {
  const reduce = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const [hoverOk, setHoverOk] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setHoverOk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const open = !reduce && flipped;

  return (
    <div
      className="relative z-20 size-[clamp(156px,42vw,200px)] cursor-pointer md:size-[clamp(200px,26vw,248px)] min-[1200px]:size-[clamp(240px,23.33vw,280px)]"
      onMouseEnter={() => {
        if (hoverOk) setFlipped(true);
      }}
      onMouseLeave={() => {
        if (hoverOk) setFlipped(false);
      }}
      onClick={() => {
        if (!hoverOk) setFlipped((v) => !v);
      }}
    >
      <motion.div
        className="absolute inset-x-0 top-1/2 z-[1] flex aspect-square items-center justify-center overflow-hidden rounded-[clamp(28px,8vw,48px)] bg-white shadow-[0_20px_20px_rgb(0_0_0/0.1)] [backface-visibility:hidden]"
        style={{ transformPerspective: 500, y: "-50%" }}
        initial={false}
        animate={{
          rotateY: reduce ? 180 : open ? -10 : 180,
          backdropFilter: open ? "blur(15px)" : "none",
          backgroundColor: open ? "rgba(255,255,255,0.85)" : "rgb(255,255,255)",
        }}
        transition={hoverSpring}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 size-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink"
        />
        <ScrollRing />
      </motion.div>
      <motion.div
        className="absolute inset-0 z-[1] overflow-hidden rounded-[clamp(28px,8vw,48px)] bg-indigo shadow-[0_20px_20px_rgb(0_0_0/0.1)]"
        style={{
          transformPerspective: 500,
          backfaceVisibility: open ? "hidden" : "visible",
        }}
        initial={false}
        animate={{ rotateY: reduce ? 0 : open ? -180 : 10 }}
        transition={hoverSpring}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/lakindu.png"
          alt="Lakindu Jayathilaka portrait"
          className="absolute left-0 top-0 h-[180%] w-full object-cover"
          style={{ objectPosition: "47.9% 24.1%" }}
        />
        {/* A softly masked duplicate lifts facial exposure without affecting the transparent cutout. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/lakindu.png"
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[180%] w-full object-cover"
          style={{
            objectPosition: "47.9% 24.1%",
            filter: "brightness(1.38) contrast(0.95) saturate(0.92)",
            maskImage:
              "radial-gradient(ellipse 21% 15% at 52% 24%, black 0%, black 55%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 21% 15% at 52% 24%, black 0%, black 55%, transparent 100%)",
          }}
        />
      </motion.div>
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  /**
   * The reference hero does not pin — the section scrolls away normally and
   * only some of its parts drift relative to the page. Measured against real
   * scroll on the live site: nothing moves for the first 200px, then the
   * greeting and role rise at 0.30x, the badge and CTA sink at 0.10x, and the
   * scroll ring rises at 0.40x. The portrait card carries no parallax.
   */
  const titleY = useTransform(scrollY, (v) =>
    reduce ? 0 : Math.max(0, v - HERO_PARALLAX_START) * -0.3,
  );
  const lowerY = useTransform(scrollY, (v) =>
    reduce ? 0 : Math.max(0, v - HERO_PARALLAX_START) * 0.1,
  );

  return (
    <section
      id="home"
      className="relative z-0 flex min-h-svh items-center justify-center overflow-x-clip px-5 pt-[88px] pb-10 md:px-8 md:pt-[96px] md:pb-12"
    >
      <FloatingShapes scrollY={scrollY} />

      <div className="relative flex w-full max-w-[720px] flex-col items-center text-center">
        <motion.div style={{ y: titleY }} className="relative z-20">
          <h1 className="text-[length:var(--type-display-hero)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-white drop-shadow-[0_2px_18px_rgb(0_0_0/0.5)]">
            <TextReveal>
              Hi, I&apos;m{" "}
              <span className="font-semibold not-italic">
                {site.firstName}
              </span>
              !
            </TextReveal>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12, ease }}
            className="mt-1.5 w-full md:mt-2"
          >
            <RotatingText
              items={site.roles}
              className="text-[15px] text-white/75 drop-shadow-[0_2px_12px_rgb(0_0_0/0.6)] md:text-xl"
            />
          </motion.div>
        </motion.div>

        <div className="relative z-20 mt-3 flex justify-center md:mt-[7px]">
          <PortraitFlip />
        </div>

        <motion.div
          style={{ y: lowerY }}
          className="relative z-20 flex flex-col items-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease }}
            className="mt-6 md:mt-[clamp(36px,5.4vh,72px)]"
          >
            <Image
              src="/images/lakindu-signature.png"
              alt="Lakindu Jayathilaka signature"
              width={1600}
              height={900}
              priority
              className="h-auto w-[clamp(168px,48vw,220px)] select-none invert drop-shadow-[0_2px_16px_rgb(0_0_0/0.55)] md:w-[clamp(240px,34vw,320px)] min-[1200px]:w-[clamp(280px,28vw,390px)]"
              draggable={false}
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
