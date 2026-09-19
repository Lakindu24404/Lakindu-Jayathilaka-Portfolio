import {
  createLavaRenderer,
  QUALITY_STEPS,
  type LavaCanvas,
  type LavaRenderer,
} from "./lavaRenderer";

/**
 * The lava's frame loop: 30fps pacing, the quality governor and WebGL
 * context recovery. It runs unchanged in the lava worker and, where a worker
 * cannot render WebGL, on the page itself.
 */

const FRAME_MS = 1000 / 30;
/**
 * A frame this close to the 30fps mark is drawn now rather than one display
 * frame late, so 60, 90 and 120Hz screens all settle on an even every-Nth
 * cadence instead of alternating short and long gaps.
 */
const FRAME_SLACK_MS = 4;
/** How long the governor watches frame times before deciding anything. */
const GOVERNOR_WINDOW_MS = 2000;
/** Average frame time, relative to the best seen, that counts as struggling. */
const STRUGGLING = 1.35;
const COMFORTABLE = 1.12;
/** Comfortable windows in a row before quality steps back up. */
const RECOVERY_WINDOWS = 3;

export type LavaLoop = {
  /** The viewport size, in CSS px. Draws straight away. */
  resize: (width: number, height: number) => void;
  /** 0–1: how far into the blue passage the page is scrolled. */
  setBlueFocus: (value: number) => void;
  /**
   * The page scrolled; `blueFocus` is the new grade. Under reduced motion the
   * still frame is redrawn at the current time, as the old renderer did on
   * every scroll event, so the lava still shifts as the page moves.
   */
  scrolled: (blueFocus: number) => void;
  dispose: () => void;
};

export type LavaLoopOptions = {
  reducedMotion: boolean;
  /**
   * Milliseconds to add to this context's clock so the lava's time is
   * seconds since the page's navigation, as it always was. A worker's clock
   * starts when the worker does.
   */
  clockOffset: number;
};

/**
 * Coarsens the march grid when frames run long and refines it again once
 * they recover. Every step stays well inside what the 40px blur can resolve,
 * so a struggling phone gets headroom without a visible change.
 */
function createGovernor() {
  let step = 0;
  let previous = 0;
  let windowStart = 0;
  let frames = 0;
  let total = 0;
  let best = Number.POSITIVE_INFINITY;
  let calm = 0;

  return (timestamp: number): number | null => {
    const delta = timestamp - previous;
    previous = timestamp;
    // First frame, or back from a hidden tab: start a fresh window.
    if (delta <= 0 || delta > 250) {
      windowStart = timestamp;
      frames = 0;
      total = 0;
      return null;
    }
    best = Math.min(best, Math.max(4, delta));
    frames++;
    total += delta;
    if (timestamp - windowStart < GOVERNOR_WINDOW_MS) return null;

    const average = total / frames;
    windowStart = timestamp;
    frames = 0;
    total = 0;

    if (average > best * STRUGGLING) {
      calm = 0;
      if (step < QUALITY_STEPS.length - 1) return ++step;
      return null;
    }
    if (average < best * COMFORTABLE) {
      if (++calm >= RECOVERY_WINDOWS && step > 0) {
        calm = 0;
        return --step;
      }
      return null;
    }
    calm = 0;
    return null;
  };
}

/** Workers without `requestAnimationFrame` fall back to a 60Hz timer. */
const requestFrame: (callback: (timestamp: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? (callback) => requestAnimationFrame(callback)
    : (callback) => setTimeout(() => callback(performance.now()), 1000 / 60) as unknown as number;
const cancelFrame: (handle: number) => void =
  typeof cancelAnimationFrame === "function"
    ? (handle) => cancelAnimationFrame(handle)
    : (handle) => clearTimeout(handle);

export function startLavaLoop(
  canvas: LavaCanvas,
  { reducedMotion, clockOffset }: LavaLoopOptions,
): LavaLoop | null {
  let renderer: LavaRenderer | null = createLavaRenderer(canvas);
  if (!renderer) return null;

  const governor = createGovernor();
  let width = 0;
  let height = 0;
  let blueFocus = 0;
  // Reduced motion shows the scene as it stood at t = 0, as before.
  let time = reducedMotion ? 0 : (clockOffset + performance.now()) / 1000;
  let lastDrawAt = Number.NEGATIVE_INFINITY;
  let handle = 0;

  const draw = () => renderer?.render(time, blueFocus);

  const tick = (timestamp: number) => {
    handle = requestFrame(tick);
    if (!renderer) return;
    const quality = governor(timestamp);
    if (quality !== null) renderer.setQuality(quality);
    if (timestamp - lastDrawAt < FRAME_MS - FRAME_SLACK_MS) return;
    lastDrawAt = timestamp;
    time = (clockOffset + timestamp) / 1000;
    draw();
  };

  const onContextLost = (event: Event) => {
    event.preventDefault();
    renderer = null;
  };
  const onContextRestored = () => {
    renderer = createLavaRenderer(canvas);
    renderer?.resize(width, height);
    draw();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  if (!reducedMotion) handle = requestFrame(tick);

  return {
    resize(nextWidth, nextHeight) {
      if (nextWidth === 0 || nextHeight === 0) return;
      if (nextWidth === width && nextHeight === height) return;
      width = nextWidth;
      height = nextHeight;
      renderer?.resize(width, height);
      // The old renderer redrew a reduced-motion frame at t = 0 on resize.
      if (reducedMotion) time = 0;
      // Resizing clears the canvas, so draw now rather than show an empty
      // frame until the next tick.
      draw();
    },

    // A moving lava picks the grade up on its next frame; a still one only
    // redraws when the page scrolls, as before.
    setBlueFocus(value) {
      blueFocus = value;
    },

    scrolled(value) {
      blueFocus = value;
      if (!reducedMotion) return;
      time = (clockOffset + performance.now()) / 1000;
      draw();
    },

    dispose() {
      cancelFrame(handle);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer?.dispose();
      renderer = null;
    },
  };
}
