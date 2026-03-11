"use client";

import { motion, useReducedMotion } from "motion/react";
import { photoFanSpring } from "@/lib/motion";
import styles from "./ProjectCase.module.css";

// Measured entrance on the reference: the side images unfold outward,
// while the enlarged centre image settles into the same three-column row.
const PLATES = [
  { x: 180, scale: 0.6, rotateY: -40 },
  { x: 0, scale: 1.2, rotateY: 0 },
  { x: -180, scale: 0.6, rotateY: 40 },
] as const;

export function ProjectPhotos({
  images,
  alt,
}: {
  images: readonly string[];
  alt: string;
}) {
  const reduce = useReducedMotion();
  // A project may have fewer than three gallery images; repeat rather than
  // collapse, so the three-plate composition never changes shape.
  const trio = [images[0], images[1] ?? images[0], images[2] ?? images[0]];

  return (
    <div className={styles.gallery} aria-label="Project gallery">
      {PLATES.map((from, index) => (
        <motion.div
          key={trio[index]}
          className={styles.photo}
          style={{ transformPerspective: 1200 }}
          initial={reduce ? false : from}
          animate={{ x: 0, scale: 1, rotateY: 0 }}
          transition={reduce ? { duration: 0 } : photoFanSpring}
        >
          <div className={styles.photoFrame}>
            {/* These local images use an intentionally cropped display ratio. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={trio[index]}
              alt={`${alt} — ${index === 1 ? "main preview" : index === 0 ? "project detail" : "additional preview"}`}
              width={1200}
              height={900}
              draggable={false}
              decoding="async"
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
