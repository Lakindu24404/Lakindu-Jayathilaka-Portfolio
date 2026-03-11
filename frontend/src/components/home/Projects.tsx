"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CtaButton } from "@/components/ui/CtaButton";
import { ProjectCard } from "@/components/project/ProjectCard";
import { TextReveal } from "@/components/effects/TextReveal";
import { projects } from "@/content/site";
import type { PublicProject } from "@/lib/data/types";
import { appearFrom, appearSpring } from "@/lib/motion";

const PREVIEW_COUNT = 6;

export function Projects({ items }: { items: PublicProject[] }) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);
  const canToggle = items.length > PREVIEW_COUNT;

  return (
    <section
      id="projects"
      className="relative z-20 isolate bg-white pb-[clamp(96px,16vw,192px)]"
    >
      <header className="pt-[clamp(64px,10vw,160px)] pb-[clamp(32px,4vw,64px)]">
        <div className="mx-auto w-[calc(100%-32px)] md:w-[calc(100%-48px)] lg:w-[90vw]">
          <h2 className="max-w-[18ch] text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-black">
            <TextReveal>{projects.heading}</TextReveal>
          </h2>
          <p className="mt-[clamp(20px,2vw,30px)] max-w-[60ch] text-[length:var(--type-body)] font-medium leading-[var(--leading-body)] tracking-[var(--tracking-body)] text-[#5f5f5f]">
            <TextReveal variant="copy" delay={0.1}>
              {projects.description}
            </TextReveal>
          </p>
        </div>
      </header>

      <div className="mx-auto w-[calc(100%-32px)] max-w-[1248px] sm:w-[calc(100%-48px)]">
        <ul className="mt-[clamp(44px,4vw,64px)] grid gap-x-6 gap-y-12 md:grid-cols-2 md:gap-y-16 lg:gap-y-[136px]">
          {visible.map((p) => (
            <motion.li
              key={p.slug}
              initial={reduce ? false : appearFrom}
              animate={reduce ? undefined : appearFrom}
              whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={appearSpring}
            >
              <ProjectCard
                href={p.href}
                image={p.image}
                title={p.title}
                tag={p.tag}
              />
            </motion.li>
          ))}
        </ul>

        {canToggle && (
          <div className="mt-16 flex justify-center md:mt-[110px]">
            <CtaButton
              onClick={() => setExpanded((open) => !open)}
              arrow={expanded ? "up" : "down"}
            >
              {expanded ? "View Less" : "View More"}
            </CtaButton>
          </div>
        )}
      </div>
    </section>
  );
}
