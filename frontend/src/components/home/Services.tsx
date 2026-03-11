"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { TextReveal } from "@/components/effects/TextReveal";
import { services } from "@/content/site";
import styles from "./Services.module.css";

const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 48,
    scale: 0.985,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.09,
    },
  },
};

const imageVariants: Variants = {
  hidden: { scale: 1.055 },
  visible: {
    scale: 1,
    transition: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
  },
};

const copyVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

type ProcessIconProps = {
  name: (typeof services.items)[number]["icon"];
};

function ProcessIcon({ name }: ProcessIconProps) {
  if (name === "research") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 6 6 18m9.5-12L18 18M7 12h10M5.5 18h4v-3.5h-4V18Zm9 0h4v-3.5h-4V18ZM9 8h6" />
      </svg>
    );
  }

  if (name === "design") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 19 3.5-.8L18.7 8a1.9 1.9 0 0 0 0-2.7 1.9 1.9 0 0 0-2.7 0L5.8 15.5 5 19Zm9.6-12.3 2.7 2.7M8.5 18.2l-2.7-2.7" />
      </svg>
    );
  }

  if (name === "develop") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m8.5 7-5 5 5 5m7-10 5 5-5 5M14 4l-4 16" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5 9.2 17 19 7M5 5h14v14H5V5Z" />
    </svg>
  );
}

export function Services() {
  const [active, setActive] = useState(0);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      frame = 0;
      // Mirrors `top: clamp(112px, 25vh, 180px)` on `.card`; the old
      // `Math.min(180, 25vh)` dropped the 112px floor and drifted from the
      // stylesheet on short viewports, so the highlight moved a step early.
      // The tolerance absorbs sub-pixel rounding on the stuck card.
      const stickyLine =
        Math.min(180, Math.max(112, window.innerHeight * 0.25)) + 2;
      let next = 0;

      for (let index = 0; index < cards.current.length; index++) {
        const card = cards.current[index];
        if (!card) continue;
        if (card.getBoundingClientRect().top <= stickyLine) next = index;
        else break;
      }

      setActive(next);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    // Lenis drives scrolling here, and a programmatic `lenis.scrollTo` moves
    // the page without emitting a native scroll event — the step highlight
    // then stayed on 01 after a nav jump into this section.
    //
    // Subscribing has to retry: `SmoothScroll` creates the instance from the
    // layout, whose effect runs *after* this one, so `window.__lenis` is still
    // undefined on the first pass and a plain `window.__lenis?.on?.(...)` here
    // silently binds nothing.
    let unsubscribe: (() => void) | undefined;
    let subscribeFrame = 0;
    let attempts = 0;

    const subscribeToLenis = () => {
      subscribeFrame = 0;
      const lenis = window.__lenis;
      if (lenis?.on) {
        unsubscribe = lenis.on("scroll", onScroll);
        onScroll();
        return;
      }
      // ~1s at 60fps, then give up: without Lenis the native listener above
      // is already the correct and only source.
      if (attempts++ < 60) subscribeFrame = requestAnimationFrame(subscribeToLenis);
    };
    subscribeToLenis();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (subscribeFrame) cancelAnimationFrame(subscribeFrame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      unsubscribe?.();
    };
  }, []);

  const goToStep = (index: number) => {
    cards.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section id="services" aria-labelledby="services-heading" className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 id="services-heading" className={styles.heading}>
            <TextReveal>{services.heading}</TextReveal>
          </h2>
          <p className={styles.intro}>
            <TextReveal variant="copy" delay={0.1}>
              {services.intro}
            </TextReveal>
          </p>
        </header>

        <div className={styles.process}>
          <nav className={styles.stepNav} aria-label="Design process steps">
            {services.items.map((item, index) => (
              <button
                key={item.title}
                type="button"
                className={styles.stepButton}
                data-active={active === index}
                aria-current={active === index ? "step" : undefined}
                onClick={() => goToStep(index)}
              >
                <span className={styles.stepNumber} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={styles.stepTitle}>{item.title}</span>
              </button>
            ))}
          </nav>

          <div className={styles.cards}>
            {services.items.map((item, index) => (
              <motion.article
                key={item.title}
                ref={(element) => { cards.current[index] = element; }}
                aria-labelledby={`process-title-${index + 1}`}
                className={styles.card}
                data-reverse={index % 2 === 1}
                style={{ zIndex: index + 1 }}
                variants={cardVariants}
                initial={reduceMotion ? false : "hidden"}
                whileInView={reduceMotion ? undefined : "visible"}
                viewport={{ once: true, amount: 0.16 }}
              >
                <motion.div className={styles.imageFrame} variants={imageVariants}>
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    width={1200}
                    height={1200}
                    sizes="(max-width: 679px) calc(100vw - 48px), (max-width: 999px) 46vw, 34vw"
                    // Not lazy. The cards are `position: sticky` and stack at
                    // the same pinned offset, and in that arrangement the
                    // browser never issued a request for cards 2-4 at all —
                    // measured: only process-research.png was ever fetched,
                    // even after scrolling the whole section. The result was a
                    // card animating into place over an empty grey frame.
                    // Four images, 25-340 KB each, so eager is cheap; the
                    // later ones drop to low priority so they never compete
                    // with the hero.
                    loading="eager"
                    fetchPriority={index === 0 ? "high" : "low"}
                    unoptimized
                    className={styles.image}
                  />
                </motion.div>

                <motion.div className={styles.cardCopy} variants={copyVariants}>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardNumber}>
                      /{String(index + 1).padStart(2, "0")}
                    </span>
                    <span className={styles.badge}>
                      <span className={styles.badgeIcon}>
                        <ProcessIcon name={item.icon} />
                      </span>
                      {item.title}
                    </span>
                  </div>

                  <div className={styles.cardText}>
                    <h3 id={`process-title-${index + 1}`} className={styles.cardTitle}>
                      <TextReveal>{item.headline}</TextReveal>
                    </h3>
                    <p className={styles.description}>{item.body}</p>
                  </div>
                </motion.div>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
