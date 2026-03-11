"use client";

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import styles from "./TextReveal.module.css";

type TextRevealProps = {
  children: ReactNode;
  /** Delay used by the quieter copy reveal. */
  delay?: number;
  /** Display type tracks scroll word-by-word; copy uses a quieter short rise. */
  variant?: "display" | "copy";
  className?: string;
  /** Optional data attribute used by focused motion regression tests. */
  wordDataAttribute?: `data-${string}`;
};

const ease = [0.16, 1, 0.3, 1] as const;
const wordSpring = { stiffness: 300, damping: 60, mass: 1 };

function RevealWord({
  children,
  index,
  progress,
  reduce,
  dataAttribute,
}: {
  children: string;
  index: number;
  progress: MotionValue<number>;
  reduce: boolean;
  dataAttribute?: `data-${string}`;
}) {
  const start = index * 0.07;
  const rawOpacity = useTransform(progress, [start, start + 0.5], [0.001, 1]);
  const rawY = useTransform(progress, [start, start + 0.5], [10, 0]);
  const opacity = useSpring(rawOpacity, wordSpring);
  const y = useSpring(rawY, wordSpring);
  const data = dataAttribute ? { [dataAttribute]: index } : {};

  return (
    <motion.span
      className={styles.word}
      data-heading-reveal-word={index}
      {...data}
      style={reduce ? undefined : { opacity, y }}
    >
      {children}
    </motion.span>
  );
}

function WordReveal({
  children,
  className,
  wordDataAttribute,
}: {
  children: ReactNode;
  className: string;
  wordDataAttribute?: `data-${string}`;
}) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  const progress = useMotionValue(0);

  useEffect(() => {
    const update = () => {
      const root = rootRef.current;
      if (!root) return;
      const { top } = root.getBoundingClientRect();
      const travel = window.innerHeight * 0.525;
      progress.set(Math.min(1, Math.max(0, (window.innerHeight - top) / travel)));
    };

    // Defer the first value until the child word springs have subscribed.
    // Setting progress during the parent effect can happen too early, leaving
    // above-the-fold headings permanently at their hidden initial value.
    const initialFrame = window.requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const unsubscribe = window.__lenis?.on?.("scroll", update);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      unsubscribe?.();
    };
  }, [progress]);

  let wordIndex = 0;
  const split = (node: ReactNode, path: string): ReactNode => {
    if (typeof node === "string" || typeof node === "number") {
      return String(node)
        .split(/(\s+)/)
        .filter(Boolean)
        .map((part, partIndex) => {
          if (/^\s+$/.test(part)) return part;
          const index = wordIndex++;
          return (
            <RevealWord
              key={`${path}-${partIndex}`}
              index={index}
              progress={progress}
              reduce={reduce}
              dataAttribute={wordDataAttribute}
            >
              {part}
            </RevealWord>
          );
        });
    }

    if (isValidElement<{ children?: ReactNode }>(node)) {
      if (!("children" in node.props)) return node;
      return cloneElement(
        node as ReactElement<{ children?: ReactNode }>,
        undefined,
        split(node.props.children, `${path}-child`),
      );
    }

    return Children.map(node, (child, index) => split(child, `${path}-${index}`));
  };

  return (
    <span
      ref={rootRef}
      className={`${styles.words} ${className}`}
      data-text-reveal="display"
    >
      {split(children, "word")}
    </span>
  );
}

/** Folira's word-staggered heading reveal plus the quieter supporting-copy motion. */
export function TextReveal({
  children,
  delay = 0,
  variant = "display",
  className = "",
  wordDataAttribute,
}: TextRevealProps) {
  if (variant === "display") {
    return (
      <WordReveal className={className} wordDataAttribute={wordDataAttribute}>
        {children}
      </WordReveal>
    );
  }

  return (
    <CopyReveal className={className} delay={delay}>
      {children}
    </CopyReveal>
  );
}

function CopyReveal({
  children,
  delay,
  className,
}: {
  children: ReactNode;
  delay: number;
  className: string;
}) {
  const reduce = useReducedMotion();
  const clipRef = useRef<HTMLSpanElement>(null);
  // Observe the stationary clip rather than the translated text. Observing
  // the moving child can leave it permanently outside the observer's
  // threshold on a clipped hero line.
  const inView = useInView(clipRef, {
    once: true,
    amount: 0.4,
  });
  const hidden = {
    opacity: 0,
    y: "45%",
    rotate: 0,
  };

  return (
    <span
      ref={clipRef}
      className={`${styles.clip} ${className}`}
      data-text-reveal="copy"
    >
      <motion.span
        className={styles.text}
        initial={false}
        animate={reduce || inView ? { opacity: 1, y: "0%", rotate: 0 } : hidden}
        transition={{
          duration: 0.68,
          delay,
          ease,
        }}
      >
        {children}
      </motion.span>
    </span>
  );
}
