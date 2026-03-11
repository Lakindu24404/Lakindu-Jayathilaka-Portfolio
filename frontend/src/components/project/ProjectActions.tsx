"use client";

import { motion, useReducedMotion } from "motion/react";
import { hoverSpring } from "@/lib/motion";
import { handleHashClick } from "@/lib/scroll";
import styles from "./ProjectCase.module.css";

export function ProjectNavigation() {
  const reduce = useReducedMotion();

  return (
    <nav className={styles.navigation} aria-label="Project navigation">
      <motion.a
        href="/#projects"
        onClick={(event) => handleHashClick("/#projects", event)}
        className={styles.backLink}
        initial="rest"
        animate="rest"
        whileHover="hover"
        whileFocus="hover"
      >
        <motion.svg
          className={styles.backIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          variants={{ rest: { x: 0 }, hover: { x: -4 } }}
          transition={reduce ? { duration: 0 } : hoverSpring}
        >
          <path d="M19 12H5m6-6-6 6 6 6" />
        </motion.svg>
        Back to Projects
      </motion.a>
    </nav>
  );
}

export function ProjectActionLink({
  href,
  children,
  accent = false,
}: {
  href: string;
  children: string;
  accent?: boolean;
}) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : hoverSpring;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.actionLink} ${accent ? styles.accent : ""}`}
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileFocus="hover"
    >
      <motion.span
        className={styles.actionInner}
        variants={{
          rest: { paddingLeft: 48, paddingRight: 48 },
          hover: { paddingLeft: 48, paddingRight: 78 },
        }}
        transition={transition}
      >
        {children}
        <motion.span
          className={styles.actionIcon}
          variants={{ rest: { right: -54, rotate: 180 }, hover: { right: 0, rotate: 0 } }}
          transition={transition}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </motion.span>
      </motion.span>
    </motion.a>
  );
}
