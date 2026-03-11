"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { statistics } from "@/content/site";
import styles from "./StatisticsBar.module.css";

type AnimatedCounterProps = {
  value: string;
  active: boolean;
  reduceMotion: boolean;
  delay: number;
};

function AnimatedCounter({
  value,
  active,
  reduceMotion,
  delay,
}: AnimatedCounterProps) {
  const match = /^(\d+)(.*)$/.exec(value);
  // `exec` hands back a fresh array every render, so the effect depends on this
  // boolean instead — an object identity there would restart the count on every
  // parent render.
  const hasNumber = match !== null;
  const target = match ? Number(match[1]) : 0;
  const suffix = match?.[2] ?? "";
  // Only the running count needs to be state. The settled values are facts
  // about the props — `target` once motion is reduced, zero before the bar is
  // in view — so they are derived below rather than written back from an
  // effect, which is what the synchronous `setCurrent` calls used to do.
  const [counted, setCounted] = useState(0);

  useEffect(() => {
    if (!hasNumber || reduceMotion || !active) return;

    const controls = animate(0, target, {
      duration: 1.35,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setCounted(Math.min(target, Math.round(latest))),
    });

    return () => controls.stop();
  }, [active, delay, hasNumber, reduceMotion, target]);

  if (!hasNumber) return value;

  const current = reduceMotion ? target : active ? counted : 0;
  return `${current}${suffix}`;
}

export function StatisticsBar() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.32, once: true });
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = Boolean(prefersReducedMotion);
  const visible = reduceMotion || isInView;

  return (
    <section
      id="statistics"
      ref={sectionRef}
      className={styles.section}
      aria-label="Selected career statistics"
    >
      <ul className={styles.grid}>
        {statistics.map((statistic, index) => (
          <li
            className={styles.item}
            key={statistic.label}
            aria-label={`${statistic.value} ${statistic.accessibleLabel}`}
          >
            <span className={styles.numberWindow} aria-hidden="true">
              <motion.span
                className={styles.number}
                initial={false}
                animate={{
                  y: visible ? "0%" : "112%",
                  opacity: visible ? 1 : 0,
                }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.78,
                        delay: index * 0.07,
                        ease: [0.16, 1, 0.3, 1],
                      }
                }
              >
                <AnimatedCounter
                  value={statistic.value}
                  active={visible}
                  reduceMotion={reduceMotion}
                  delay={index * 0.08}
                />
              </motion.span>
            </span>

            <motion.span
              className={styles.label}
              aria-hidden="true"
              initial={false}
              animate={{
                y: visible ? 0 : 14,
                opacity: visible ? 1 : 0,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.55,
                      delay: 0.2 + index * 0.07,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
            >
              {statistic.label}
            </motion.span>
          </li>
        ))}
      </ul>
    </section>
  );
}
