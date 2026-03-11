/**
 * Non-destructive logo framing, shared by every layer that touches it.
 *
 * A technology's uploaded file is never modified or re-cropped. Instead three
 * display-only numbers say how it sits inside its circular orbit node, and the
 * same numbers drive the public orbit and the dashboard's "Logo fit" editor —
 * one definition of the ranges, one clamp, one transform.
 *
 * Offsets are a percentage of the node's *diameter*, not of the image, so the
 * framing an administrator sets at 176px in the dashboard reproduces exactly at
 * every orbit size the stylesheet scales to.
 */

export type LogoFit = {
  /** 1 = the node's own base logo size, before any zoom. */
  scale: number;
  /** Percent of the node diameter. Positive moves the logo right. */
  offsetX: number;
  /** Percent of the node diameter. Positive moves the logo down. */
  offsetY: number;
};

/**
 * The bounds the database check constraints enforce. Zoom steps in 5% so the
 * slider's percentage readout is always a whole number.
 */
export const LOGO_SCALE = { min: 0.5, max: 4, step: 0.05, default: 1 } as const;
export const LOGO_OFFSET = { min: -100, max: 100, step: 1, default: 0 } as const;

/** Centred, unzoomed: what every row had before the editor existed. */
export const LOGO_FIT_DEFAULT: LogoFit = {
  scale: LOGO_SCALE.default,
  offsetX: LOGO_OFFSET.default,
  offsetY: LOGO_OFFSET.default,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Clamp a zoom to the stored range. Anything unusable falls back to 1. */
export function clampLogoScale(value: number): number {
  if (!Number.isFinite(value)) return LOGO_SCALE.default;
  // Two decimals matches `numeric(4, 2)`, so what the editor shows is what the
  // database keeps rather than a value silently rounded on the way in.
  return Number(clamp(value, LOGO_SCALE.min, LOGO_SCALE.max).toFixed(2));
}

/** Clamp an offset to the stored range. Anything unusable falls back to 0. */
export function clampLogoOffset(value: number): number {
  if (!Number.isFinite(value)) return LOGO_OFFSET.default;
  // Whole percent, so dragging and the step-1 sliders agree on every value.
  return clamp(Math.round(value), LOGO_OFFSET.min, LOGO_OFFSET.max);
}

/**
 * Read one column from a database row.
 *
 * PostgREST returns `numeric` as a string, and a row written before
 * `0005_stack_logo_fit.sql` has no such column at all — both land on the
 * default rather than on `NaN` or an out-of-range transform.
 */
export function readLogoFitValue(
  value: unknown,
  clampValue: (input: number) => number,
  fallback: number,
): number {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? clampValue(parsed) : fallback;
}

/** The percentage readout the zoom control shows, e.g. `1.35` -> `135`. */
export function toZoomPercent(scale: number): number {
  return Math.round(scale * 100);
}

/** The inverse, used when a zoom slider reports its value. */
export function fromZoomPercent(percent: number): number {
  return clampLogoScale(percent / 100);
}
