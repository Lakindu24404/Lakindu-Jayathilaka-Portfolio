"use client";

import {
  cancelFrame,
  frame,
  motion,
  useInView,
  useReducedMotion,
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
import { trackScroll } from "@/lib/scrollTracker";
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

/**
 * Word motion. Each word's opacity and rise chase their scroll-derived target
 * through the same spring the per-word `useSpring`s used, but every moving
 * word on the page is integrated in one loop and written in one pass, and a
 * word that is at rest costs nothing at all.
 */
const WORD_SPRING = { stiffness: 300, damping: 60, mass: 1 };
/** Longest integration step, so the stiff spring stays stable at low frame rates. */
const MAX_STEP = 1 / 240;
/** Matches `.word`'s resting style in TextReveal.module.css. */
const HIDDEN_OPACITY = 0.001;
const HIDDEN_Y = 10;
/** Each word starts 7% of the heading's travel after the one before it… */
const STAGGER = 0.07;
/** …and takes half of the travel to arrive. */
const WORD_SPAN = 0.5;
/** A heading reveals over the 52.5% of the viewport below its entry point. */
const TRAVEL = 0.525;

type WordState = {
  element: HTMLElement;
  opacity: number;
  opacityVelocity: number;
  opacityTarget: number;
  y: number;
  yVelocity: number;
  yTarget: number;
};

/** Outlives effect re-runs, so a revealed word never snaps back to hidden. */
const wordStates = new WeakMap<HTMLElement, WordState>();
const moving = new Set<WordState>();
let animating = false;

function integrate({ delta }: { delta: number }) {
  const elapsed = Math.min(delta, 40) / 1000;
  const steps = Math.max(1, Math.ceil(elapsed / MAX_STEP));
  const h = elapsed / steps;
  const { stiffness, damping, mass } = WORD_SPRING;

  for (const word of moving) {
    for (let step = 0; step < steps; step++) {
      word.opacityVelocity +=
        ((-stiffness * (word.opacity - word.opacityTarget) - damping * word.opacityVelocity) / mass) * h;
      word.opacity += word.opacityVelocity * h;
      word.yVelocity +=
        ((-stiffness * (word.y - word.yTarget) - damping * word.yVelocity) / mass) * h;
      word.y += word.yVelocity * h;
    }

    if (
      Math.abs(word.opacity - word.opacityTarget) < 0.001 &&
      Math.abs(word.opacityVelocity) < 0.01 &&
      Math.abs(word.y - word.yTarget) < 0.01 &&
      Math.abs(word.yVelocity) < 0.1
    ) {
      word.opacity = word.opacityTarget;
      word.y = word.yTarget;
      word.opacityVelocity = 0;
      word.yVelocity = 0;
    }
  }
}

function paint() {
  for (const word of moving) {
    const { element } = word;
    element.style.opacity = String(word.opacity);
    element.style.transform = word.y === 0 ? "none" : `translateY(${word.y}px)`;
    if (word.opacityVelocity === 0 && word.yVelocity === 0) {
      // At rest: give the word's compositor layer back.
      moving.delete(word);
      element.style.willChange = "";
    }
  }
  if (moving.size === 0 && animating) {
    animating = false;
    cancelFrame(integrate);
    cancelFrame(paint);
  }
}

function retarget(word: WordState, opacityTarget: number, yTarget: number) {
  if (word.opacityTarget === opacityTarget && word.yTarget === yTarget) return;
  word.opacityTarget = opacityTarget;
  word.yTarget = yTarget;
  // Nudge a resting spring so the rest check cannot stop it before it moves.
  if (word.opacityVelocity === 0 && word.yVelocity === 0) word.opacityVelocity = 1e-6;
  if (!moving.has(word)) {
    moving.add(word);
    word.element.style.willChange = "transform, opacity";
  }
  if (!animating) {
    animating = true;
    frame.update(integrate, true);
    frame.render(paint, true);
  }
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

  let wordIndex = 0;
  const split = (node: ReactNode, path: string): ReactNode => {
    if (typeof node === "string" || typeof node === "number") {
      return String(node)
        .split(/(\s+)/)
        .filter(Boolean)
        .map((part, partIndex) => {
          if (/^\s+$/.test(part)) return part;
          const index = wordIndex++;
          const data = wordDataAttribute ? { [wordDataAttribute]: index } : {};
          return (
            <span
              key={`${path}-${partIndex}`}
              className={styles.word}
              data-heading-reveal-word={index}
              {...data}
            >
              {part}
            </span>
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
  const words = split(children, "word");
  const wordCount = wordIndex;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduce) return;

    const states = Array.from(
      root.querySelectorAll<HTMLElement>("[data-heading-reveal-word]"),
    )
      .filter((element) => element.closest('[data-text-reveal="display"]') === root)
      .map((element) => {
        let state = wordStates.get(element);
        if (!state) {
          state = {
            element,
            opacity: HIDDEN_OPACITY,
            opacityVelocity: 0,
            opacityTarget: HIDDEN_OPACITY,
            y: HIDDEN_Y,
            yVelocity: 0,
            yTarget: HIDDEN_Y,
          };
          wordStates.set(element, state);
        }
        return { state, start: Number(element.dataset.headingRevealWord) * STAGGER };
      });

    return trackScroll(root, (rect, viewportHeight) => {
      const progress = Math.min(
        1,
        Math.max(0, (viewportHeight - rect.top) / (viewportHeight * TRAVEL)),
      );
      for (const { state, start } of states) {
        const t = Math.min(1, Math.max(0, (progress - start) / WORD_SPAN));
        retarget(
          state,
          HIDDEN_OPACITY + (1 - HIDDEN_OPACITY) * t,
          HIDDEN_Y * (1 - t),
        );
      }
    });
  }, [reduce, wordCount]);

  return (
    <span
      ref={rootRef}
      className={`${styles.words} ${className}`}
      data-text-reveal="display"
    >
      {words}
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
