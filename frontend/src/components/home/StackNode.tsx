import type { CSSProperties } from "react";
import Image from "next/image";
import type { LogoFit } from "@/lib/data/logo-fit";
import type { IconMode } from "@/lib/data/types";
import styles from "./Stack.module.css";

/**
 * The inside of one orbit node, shared by the public orbit and the dashboard's
 * "Logo fit" editor.
 *
 * There is deliberately only one implementation of the transform. `.node` owns
 * the circle — background, border, shadow and the `overflow: hidden` that clips
 * the logo to it — and everything here sits inside that clip:
 *
 *   .node          the circle, positioned by the orbit (or not, in the editor)
 *   └ .logoFit     a full-size wrapper translated by the offsets
 *     └ .logo      the image, scaled by the zoom
 *
 * The wrapper fills the node, so the offsets are a percentage of the node's own
 * diameter rather than of the image, and the framing therefore holds at every
 * `--orbit-size` the stylesheet scales to. Keeping the wrapper separate from
 * the anchor's `rotate(var(--angle))` and the node's counter-rotation is what
 * stops logo editing from touching the orbit animation at all.
 *
 * No hooks and no client directive, so it renders unchanged in the Server
 * Component homepage and in the dashboard's client-side editor.
 */

type LogoFitStyle = CSSProperties & {
  "--logo-scale": string;
  "--logo-offset-x": string;
  "--logo-offset-y": string;
};

/** The three custom properties `.logoFit` and `.logo` read. */
export function logoFitStyle(fit: LogoFit): LogoFitStyle {
  return {
    "--logo-scale": String(fit.scale),
    // Unitless: the stylesheet multiplies these by 1% itself, so the value can
    // be read straight back out of the DOM as the number that was saved.
    "--logo-offset-x": String(fit.offsetX),
    "--logo-offset-y": String(fit.offsetY),
  };
}

/** The optional per-node disc colour, or nothing to keep the brand rule. */
export function nodeBackgroundStyle(
  nodeBackground: string | null,
): CSSProperties | undefined {
  return nodeBackground
    ? { background: nodeBackground, borderColor: "transparent" }
    : undefined;
}

export function StackNodeLogo({
  logoPath,
  fit,
}: {
  logoPath: string;
  fit: LogoFit;
}) {
  return (
    <div className={styles.logoFit} style={logoFitStyle(fit)}>
      <Image
        src={logoPath}
        alt=""
        width={52}
        height={52}
        unoptimized
        draggable={false}
        className={styles.logo}
      />
    </div>
  );
}

/**
 * A compact, non-animated rendering of a saved orbit node for dashboard lists.
 * It deliberately reuses the real `.node` and `StackNodeLogo` layers so brand
 * colours, icon mode, zoom and offsets can never drift from the public orbit.
 */
export function StackNodePreview({
  brandKey,
  iconMode,
  nodeBackground,
  logoPath,
  fit,
}: {
  brandKey: string;
  iconMode: IconMode;
  nodeBackground: string | null;
  logoPath: string | null;
  fit: LogoFit;
}) {
  return (
    <span
      className={styles.nodePreview}
      data-brand={brandKey}
      data-icon={iconMode}
      aria-hidden="true"
    >
      <span className={styles.node} style={nodeBackgroundStyle(nodeBackground)}>
        {logoPath ? <StackNodeLogo logoPath={logoPath} fit={fit} /> : null}
      </span>
    </span>
  );
}
