"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { TextReveal } from "@/components/effects/TextReveal";
import styles from "./CreativeServicesShowcase.module.css";

const services = [
  {
    title: "Empower",
    description:
      "Learning ICT should feel exciting, not complicated. ictwithls turns big ideas into simple lessons, practical skills, and confidence that grows with every step.",
    image: "/images/brand-ict-with-ls.png",
    imageAlt: "ictwithls ICT tutoring identity",
    side: "left",
  },
  {
    title: "Create",
    description:
      "Every great story deserves to be seen and felt. L.S. Studio brings ideas to life through vibrant design, engaging content, and creative production that leaves a lasting impression.",
    image: "/images/brand-ls-studio.png",
    imageAlt: "L.S. Studio creative media and production identity",
    side: "right",
  },
  {
    title: "Innovate",
    description:
      "Technology works best when it feels simple and dependable. L.S. Computer Technologh creates practical digital solutions and friendly support that help people move forward with confidence.",
    image: "/images/brand-ls-computer-technology.png",
    imageAlt: "L.S. Computer Technologh brand identity",
    side: "left",
  },
] as const;

export function CreativeServicesShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const activationPointsRef = useRef<[number, number, number]>([
    0.01, 0.33, 0.65,
  ]);
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(-1);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const measureActivationPoints = () => {
      const imageRows = Array.from(
        section.querySelectorAll<HTMLElement>("[data-service-image-row]"),
      );
      const scrollRange = section.offsetHeight - window.innerHeight;
      if (imageRows.length !== services.length || scrollRange <= 0) return;

      const sectionTop = section.getBoundingClientRect().top + window.scrollY;
      const points = imageRows.map((row) => {
        const rowTop = row.getBoundingClientRect().top + window.scrollY;
        return Math.min(
          1,
          Math.max(0, (rowTop - sectionTop - window.innerHeight) / scrollRange),
        );
      }) as [number, number, number];

      activationPointsRef.current = points;
    };

    measureActivationPoints();
    const resizeObserver = new ResizeObserver(measureActivationPoints);
    resizeObserver.observe(section);
    window.addEventListener("resize", measureActivationPoints);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measureActivationPoints);
    };
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    // Switch at the exact frame each image row enters the viewport. Lenis
    // already eases the page scroll, so a second spring here would lag behind.
    const [artDirectionAt, brandingAt, uiUxAt] = activationPointsRef.current;
    const next =
      progress < artDirectionAt
        ? -1
        : progress < brandingAt
          ? 0
          : progress < uiUxAt
            ? 1
            : 2;
    setActiveIndex((current) => (current === next ? current : next));
  });

  const descriptionIndex = Math.max(activeIndex, 0);
  const description = services[descriptionIndex];
  const stateTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] as const };
  const descriptionTransition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 150, damping: 19, mass: 0.8 };

  return (
    <section
      id="creative-services"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="creative-services-heading"
    >
      <div className={styles.imageLayer} aria-hidden="true">
        {services.map((service) => (
          <div
            key={service.title}
            data-service-image-row
            className={styles.imageRow}
          >
            <figure className={`${styles.imagePlate} ${styles[service.side]}`}>
              <Image
                src={service.image}
                alt={service.imageAlt}
                fill
                sizes="(max-width: 809px) 44vw, 24vw"
                className={styles.image}
              />
            </figure>
          </div>
        ))}
      </div>

      <div className={styles.stickyStage}>
        <div className={styles.headingGroup}>
          <p className={styles.label}>(Brands I built)</p>

          <div className={styles.headings} id="creative-services-heading">
            {services.map((service, index) => (
              <motion.h2
                key={service.title}
                className={styles.heading}
                initial={false}
                animate={{ opacity: index === activeIndex ? 1 : 0.35 }}
                transition={stateTransition}
              >
                <TextReveal>{service.title}</TextReveal>
              </motion.h2>
            ))}
          </div>
        </div>

        <div className={styles.descriptions} aria-live="polite">
          <motion.p
            key={description.title}
            className={styles.description}
            initial={
              reduceMotion
                ? false
                : { opacity: 0, y: 52, scaleY: 1.2, originY: 1 }
            }
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            transition={descriptionTransition}
          >
            {description.description}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
