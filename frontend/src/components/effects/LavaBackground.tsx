"use client";

import { cancelFrame, frame } from "motion/react";
import { useEffect, useRef } from "react";
import type { LavaWorkerMessage } from "./lava.worker";
import { startLavaLoop, type LavaLoop } from "./lavaLoop";
import styles from "./LavaBackground.module.css";

/** Re-measure the blue passage this often even without scrolling, to catch layout shifts above it. */
const BLUE_REMEASURE_MS = 250;

type LavaBackgroundProps = {
  blueStartId?: string;
  blueEndId?: string;
};

const smoothStep = (edge0: number, edge1: number, value: number) => {
  const progress = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
};

let offscreenSupport: boolean | undefined;

/** Whether a worker can render WebGL to a transferred canvas (Safari < 17 cannot). */
function canRenderInWorker() {
  if (offscreenSupport !== undefined) return offscreenSupport;
  offscreenSupport = false;
  if (
    typeof Worker === "undefined" ||
    typeof OffscreenCanvas === "undefined" ||
    !("transferControlToOffscreen" in HTMLCanvasElement.prototype)
  ) {
    return offscreenSupport;
  }
  try {
    const probe = new OffscreenCanvas(1, 1).getContext("webgl");
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    offscreenSupport = probe !== null;
  } catch {
    offscreenSupport = false;
  }
  return offscreenSupport;
}

function startWorkerLoop(canvas: HTMLCanvasElement, reducedMotion: boolean): LavaLoop {
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker(new URL("./lava.worker.ts", import.meta.url), {
    type: "module",
  });
  const send = (message: LavaWorkerMessage, transfer: Transferable[] = []) =>
    worker.postMessage(message, transfer);
  send(
    { type: "start", canvas: offscreen, reducedMotion, timeOrigin: performance.timeOrigin },
    [offscreen],
  );
  return {
    resize: (width, height) => send({ type: "resize", width, height }),
    setBlueFocus: (value) => send({ type: "blueFocus", value }),
    scrolled: (value) => send({ type: "scrolled", value }),
    dispose: () => {
      send({ type: "stop" });
      worker.terminate();
    },
  };
}

/**
 * A canvas can only be handed to a worker once, but Strict Mode (and a change
 * of blue section) re-runs the effect on the same canvas. Releasing defers the
 * teardown by a task so an immediate re-acquire keeps the running loop.
 */
const held = new WeakMap<HTMLCanvasElement, { loop: LavaLoop; release: number }>();

function acquireLoop(canvas: HTMLCanvasElement, reducedMotion: boolean) {
  const existing = held.get(canvas);
  if (existing) {
    window.clearTimeout(existing.release);
    return existing.loop;
  }
  const loop = canRenderInWorker()
    ? startWorkerLoop(canvas, reducedMotion)
    : startLavaLoop(canvas, { reducedMotion, clockOffset: 0 });
  if (loop) held.set(canvas, { loop, release: 0 });
  return loop;
}

function releaseLoop(canvas: HTMLCanvasElement) {
  const entry = held.get(canvas);
  if (!entry) return;
  entry.release = window.setTimeout(() => {
    held.delete(canvas);
    entry.loop.dispose();
  }, 0);
}

export function LavaBackground({
  blueStartId,
  blueEndId,
}: LavaBackgroundProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lava = acquireLoop(canvas, reducedMotion);
    if (!lava) return;

    const measureBlueFocus = () => {
      if (!blueStartId || !blueEndId) return 0;
      const start = document.getElementById(blueStartId);
      const end = document.getElementById(blueEndId);
      if (!start || !end) return 0;

      const viewportCenter = window.scrollY + window.innerHeight * 0.5;
      const startTop = window.scrollY + start.getBoundingClientRect().top;
      const endBottom = window.scrollY + end.getBoundingClientRect().bottom;
      const fadeDistance = window.innerHeight * 0.85;
      const fadeIn = smoothStep(
        startTop - fadeDistance,
        startTop + window.innerHeight * 0.08,
        viewportCenter,
      );
      const fadeOut = 1 - smoothStep(
        endBottom - window.innerHeight * 0.12,
        endBottom + fadeDistance,
        viewportCenter,
      );
      return fadeIn * fadeOut;
    };

    let blueFocus = measureBlueFocus();
    let lastScrollY = window.scrollY;
    let lastViewport = window.innerHeight;
    let lastMeasuredAt = 0;
    lava.setBlueFocus(blueFocus);

    // Lenis-driven anchor jumps do not consistently emit a native scroll
    // event, so the live document position is sampled every frame instead —
    // in Motion's read phase, before anything writes styles, so the two rect
    // reads never force a layout. The spatial smoothstep above supplies the
    // transition easing.
    const read = ({ timestamp }: { timestamp: number }) => {
      const moved = window.scrollY !== lastScrollY || window.innerHeight !== lastViewport;
      if (!moved && timestamp - lastMeasuredAt < BLUE_REMEASURE_MS) return;
      lastScrollY = window.scrollY;
      lastViewport = window.innerHeight;
      lastMeasuredAt = timestamp;
      const next = measureBlueFocus();
      // A reduced-motion frame is redrawn on every scroll, not just when the
      // grade changes.
      if (moved && reducedMotion) {
        blueFocus = next;
        lava.scrolled(next);
        return;
      }
      if (next === blueFocus) return;
      blueFocus = next;
      lava.setBlueFocus(next);
    };

    const syncSize = () => {
      const rect = root.getBoundingClientRect();
      lava.resize(rect.width, rect.height);
    };

    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(root);
    frame.read(read, true);

    return () => {
      cancelFrame(read);
      resizeObserver.disconnect();
      releaseLoop(canvas);
    };
  }, [blueStartId, blueEndId]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.grain} />
    </div>
  );
}
