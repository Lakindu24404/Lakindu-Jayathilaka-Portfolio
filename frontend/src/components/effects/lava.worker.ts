import { startLavaLoop, type LavaLoop } from "./lavaLoop";

/**
 * Renders the lava off the main thread. The page transfers its canvas here
 * once, then only reports size and scroll-driven blue focus. Frames go from
 * this worker straight to the compositor, so the page never has to commit a
 * frame just because the lava moved, and the lava keeps flowing while the
 * page is busy.
 */

export type LavaWorkerMessage =
  | {
      type: "start";
      canvas: OffscreenCanvas;
      reducedMotion: boolean;
      /** The page's `performance.timeOrigin`. */
      timeOrigin: number;
    }
  | { type: "resize"; width: number; height: number }
  | { type: "blueFocus"; value: number }
  | { type: "scrolled"; value: number }
  | { type: "stop" };

let loop: LavaLoop | null = null;

self.onmessage = (event: MessageEvent<LavaWorkerMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "start":
      loop = startLavaLoop(message.canvas, {
        reducedMotion: message.reducedMotion,
        clockOffset: performance.timeOrigin - message.timeOrigin,
      });
      break;
    case "resize":
      loop?.resize(message.width, message.height);
      break;
    case "blueFocus":
      loop?.setBlueFocus(message.value);
      break;
    case "scrolled":
      loop?.scrolled(message.value);
      break;
    case "stop":
      loop?.dispose();
      loop = null;
      break;
  }
};
