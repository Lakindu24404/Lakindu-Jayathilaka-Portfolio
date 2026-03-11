"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { CtaButton } from "@/components/ui/CtaButton";
import { TextReveal } from "@/components/effects/TextReveal";
import { about } from "@/content/site";
import styles from "./About.module.css";

function useLenisProgress(
  target: RefObject<HTMLElement | null>,
  measure: (rect: DOMRect, viewportHeight: number) => number,
) {
  const progress = useMotionValue(0);

  useEffect(() => {
    const update = () => {
      const el = target.current;
      if (!el) return;
      progress.set(Math.min(1, Math.max(0, measure(el.getBoundingClientRect(), window.innerHeight))));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const unsub = window.__lenis?.on?.("scroll", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      unsub?.();
    };
  }, [target, progress, measure]);

  return progress;
}

function measureCardProgress(rect: DOMRect, viewportHeight: number) {
  const start = viewportHeight * 0.65;
  return (start - rect.top) / Math.max(rect.height, 1);
}

function ExperienceCard({
  item,
  reduce,
  observeRef,
}: {
  item: (typeof about.experience)[number];
  reduce: boolean;
  observeRef?: RefObject<HTMLDivElement | null>;
}) {
  const localRef = useRef<HTMLDivElement>(null);
  const triggerRef = observeRef ?? localRef;
  // Folira: onScrollTarget, threshold 0.5, offset 150, over the card height.
  // The card is tilted until its top sits ~65% down the viewport, then
  // flattens as its bottom crosses that same line.
  const scrollYProgress = useLenisProgress(triggerRef, measureCardProgress);
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-60, 0]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <div ref={triggerRef} className={styles.cardTrigger}>
      <motion.article
        className={styles.card}
        style={reduce ? undefined : { rotateX, opacity }}
      >
        <div className={styles.cardCopy}>
          <div className={styles.cardHeader}>
            <h3>
              <TextReveal>{item.role}</TextReveal>
            </h3>
            <span className={styles.company}>{item.company}</span>
          </div>
          <p>{item.description}</p>
        </div>
        <span className={styles.period}>{item.period}</span>
      </motion.article>
    </div>
  );
}

function measureSectionProgress(rect: DOMRect, viewportHeight: number) {
  return (viewportHeight - rect.top) / (viewportHeight * 0.5);
}

export function About() {
  const reduce = !!useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const midCardRef = useRef<HTMLDivElement>(null);
  const scrollYProgress = useLenisProgress(sectionRef, measureSectionProgress);
  const midCardProgress = useLenisProgress(midCardRef, measureCardProgress);
  const entranceOpacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const entranceY = useTransform(scrollYProgress, [0, 1], [-200, 0]);
  const entranceScale = useTransform(scrollYProgress, [0, 1], [0.7, 1]);
  // Cohesion About Me: the pill slides out from behind the stack while the
  // card set is around mid-scroll — same flatten window as the middle card.
  const cvY = useTransform(midCardProgress, (latest) => {
    const t = Math.min(1, Math.max(0, latest));
    return (1 - t) * -92;
  });
  const midIndex = Math.floor(about.experience.length / 2);
  const [stacked, setStacked] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 809px)");
    const sync = () => setStacked(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <section ref={sectionRef} id="about" aria-labelledby="about-heading" className={styles.about}>
      <motion.div
        className={styles.container}
        style={reduce ? undefined : { opacity: entranceOpacity, y: entranceY, scale: entranceScale }}
      >
        <div className={styles.timeline}>
          <div className={styles.experienceList}>
            {about.experience.map((item, index) => (
              <ExperienceCard
                key={`${item.company}-${item.period}`}
                item={item}
                reduce={reduce}
                observeRef={index === midIndex ? midCardRef : undefined}
              />
            ))}
          </div>

          <div className={styles.rail} aria-hidden="true">
            {about.experience.map((item, index) => (
              <span key={`${item.company}-${item.period}`} className={styles.dot} style={{ top: `${105.5 + index * 211}px` } as CSSProperties} />
            ))}
          </div>

          <div className={styles.summary}>
            <div className={styles.intro}>
              <h2
                id="about-heading"
                data-about-scroll-title
                aria-label={`${about.headingLineOne} ${about.headingLineTwo}`}
              >
                <TextReveal wordDataAttribute="data-about-title-word">
                  <span className={styles.headingLine} aria-hidden="true">
                    {about.headingLineOne}
                  </span>
                  <span className={styles.headingLine} aria-hidden="true">
                    {about.headingLineTwo}
                  </span>
                </TextReveal>
              </h2>
              <p>{about.intro}</p>
            </div>

            <div className={styles.cvWell}>
              <motion.div
                className={styles.cvButton}
                style={reduce || stacked ? undefined : { y: cvY }}
              >
                <CtaButton href={about.cta.href} target="_blank" arrow="cv">
                  {about.cta.label}
                </CtaButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
