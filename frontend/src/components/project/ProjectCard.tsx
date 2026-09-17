"use client";

import { motion, useReducedMotion } from "motion/react";
import { FollowCursor } from "@/components/effects/FollowCursor";
import { TextReveal } from "@/components/effects/TextReveal";
import { hoverSpring } from "@/lib/motion";

export function ProjectCard({
  href,
  image,
  title,
  tag,
}: {
  href: string;
  image: string;
  title: string;
  tag: string;
}) {
  const reduce = useReducedMotion();

  return (
    <FollowCursor label="View Project" variant="project">
      <motion.a
        href={href}
        className="block"
        initial="rest"
        animate="rest"
        whileHover={reduce ? undefined : "hover"}
      >
        <div className="rounded-panel bg-black/30 p-[19px] ring-1 ring-white/15 backdrop-blur-md">
          <div className="relative overflow-hidden rounded-card">
            <div className="relative aspect-[451/306] w-full">
              <motion.img
                src={image}
                alt={title}
                variants={
                  reduce
                    ? undefined
                    : {
                        rest: { scale: 1, x: 0 },
                        hover: { scale: 1.06, x: -6 },
                      }
                }
                transition={hoverSpring}
                className="absolute inset-0 h-full w-full origin-center object-cover"
              />
            </div>
          </div>
        </div>
        <p className="mt-2.5 px-[19px] text-sm font-medium leading-[1.4] text-white/70">{tag}</p>
        <h3 className="mt-1 px-[19px] text-[length:var(--type-title-md)] font-medium leading-[var(--leading-title)] text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.5)]">
          <TextReveal>{title}</TextReveal>
        </h3>
      </motion.a>
    </FollowCursor>
  );
}
