"use client";

import { motion, useReducedMotion } from "motion/react";
import { FollowCursor } from "@/components/effects/FollowCursor";
import { TextReveal } from "@/components/effects/TextReveal";
import { appearSpring, hoverSpring } from "@/lib/motion";
import type { PublicProject } from "@/lib/data/types";
import styles from "./ProjectCase.module.css";

export function ProjectRelated({ items }: { items: readonly PublicProject[] }) {
  const reduce = useReducedMotion();

  return (
    <section className={styles.related} aria-labelledby="other-projects-heading">
      <h2 id="other-projects-heading">
        <TextReveal>Other Projects</TextReveal>
      </h2>
      <ul className={styles.relatedGrid}>
        {items.map((project) => (
          <motion.li
            key={project.slug}
            initial={reduce ? false : { opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ amount: 0.5, once: false }}
            transition={reduce ? { duration: 0 } : appearSpring}
          >
            <FollowCursor label="View Project" variant="project">
              <motion.a
                href={project.href}
                className={styles.relatedCard}
                initial="rest"
                animate="rest"
                whileHover="hover"
                whileFocus="hover"
              >
                <div className={styles.relatedFrame}>
                  <div className={styles.relatedImage}>
                    <motion.img
                      src={project.image}
                      alt={project.title}
                      width={1200}
                      height={900}
                      loading="lazy"
                      variants={reduce ? undefined : { rest: { scale: 1, x: 0 }, hover: { scale: 1.06, x: -6 } }}
                      transition={hoverSpring}
                    />
                  </div>
                </div>
                <div className={styles.relatedCaption}>
                  <p>{project.tag}</p>
                  <h3>
                    <TextReveal>{project.title}</TextReveal>
                  </h3>
                </div>
              </motion.a>
            </FollowCursor>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
