import type { CSSProperties } from "react";
import { layoutOrbit, type OrbitNodeLayout } from "@/lib/data/orbit";
import { ORBIT_RINGS, type OrbitRing, type StackTechRecord } from "@/lib/data/types";
import { StackNodeLogo, nodeBackgroundStyle } from "./StackNode";
import styles from "./Stack.module.css";

/**
 * The orbit itself, split out of `Stack` so the dashboard can preview the real
 * thing rather than a mock. It renders identical markup either way — the only
 * addition is `data-paused`, which the stylesheet uses to hold the rotors
 * still while an editor is placing nodes.
 *
 * No hooks and no client directive, so it works unchanged in a Server
 * Component page and inside the dashboard's client-side preview.
 */

type AnchorStyle = CSSProperties & {
  "--angle": string;
  "--counter-angle": string;
};

/**
 * Per-ring class names, kept in one table so a new ring is a data change here
 * and in `ORBIT_RINGS` rather than another hand-written block of markup.
 * `track` draws the hairline circle, `rotor` carries the rotation, and `size`
 * places a node at that ring's radius.
 */
const RING_CLASSES: Record<
  OrbitRing,
  { track: string; rotor: string; size: string }
> = {
  farOuter: {
    track: styles.farOuterRing,
    rotor: styles.farOuterRotor,
    size: styles.xlarge,
  },
  outer: { track: styles.outerRing, rotor: styles.outerRotor, size: styles.large },
  middle: {
    track: styles.middleRing,
    rotor: styles.middleRotor,
    size: styles.medium,
  },
  inner: { track: styles.innerRing, rotor: styles.innerRotor, size: styles.small },
};

function OrbitNode({ node }: { node: OrbitNodeLayout }) {
  const anchorStyle: AnchorStyle = {
    "--angle": `${node.resolvedAngle}deg`,
    "--counter-angle": `${-node.resolvedAngle}deg`,
  };

  return (
    <div
      className={`${styles.anchor} ${RING_CLASSES[node.ring].size}`}
      data-brand={node.brandKey}
      data-icon={node.iconMode}
      style={anchorStyle}
    >
      <div className={styles.node} style={nodeBackgroundStyle(node.nodeBackground)}>
        <StackNodeLogo
          logoPath={node.logoPath}
          fit={{
            scale: node.logoScale,
            offsetX: node.logoOffsetX,
            offsetY: node.logoOffsetY,
          }}
        />
        <span className={styles.srOnly}>{node.name}</span>
      </div>
    </div>
  );
}

export function StackOrbit({
  technologies,
  paused = false,
  centerMark = true,
}: {
  technologies: StackTechRecord[];
  /** Holds the CSS rotor animations, for the dashboard preview only. */
  paused?: boolean;
  centerMark?: boolean;
}) {
  const rings = layoutOrbit(technologies);
  const total = ORBIT_RINGS.reduce((sum, ring) => sum + rings[ring].length, 0);

  return (
    <div
      className={styles.orbit}
      role="img"
      aria-label={
        total === 0
          ? "Technology orbit"
          : `${total} technology and creative tools orbiting the Stack wordmark`
      }
      data-paused={paused ? "true" : undefined}
    >
      {ORBIT_RINGS.map((ring) => (
        <div key={ring} className={`${styles.ring} ${RING_CLASSES[ring].track}`} />
      ))}

      {ORBIT_RINGS.map((ring) => (
        <div key={ring} className={`${styles.rotor} ${RING_CLASSES[ring].rotor}`}>
          {rings[ring].map((node) => (
            <OrbitNode key={node.id} node={node} />
          ))}
        </div>
      ))}

      {centerMark ? (
        <div className={styles.centerMark} aria-hidden="true">
          <span className={styles.centerLabel}>stack</span>
        </div>
      ) : null}
    </div>
  );
}
