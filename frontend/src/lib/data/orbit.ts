import {
  MAX_ACTIVE_TECHNOLOGIES,
  ORBIT_RINGS,
  RING_CAPACITY,
  type OrbitRing,
  type StackTechRecord,
} from "@/lib/data/types";

export type OrbitNodeLayout = StackTechRecord & { resolvedAngle: number };

/**
 * Resolve the angle of every node on one ring.
 *
 * Nodes with a manual angle keep it verbatim. The rest are spread evenly over
 * the full circle in `displayOrder`, which reproduces the 45deg steps the outer
 * ring was hand-written with.
 */
export function layoutRing(items: StackTechRecord[]): OrbitNodeLayout[] {
  const ordered = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  const step = ordered.length > 0 ? 360 / ordered.length : 0;

  return ordered.map((item, index) => ({
    ...item,
    resolvedAngle:
      item.manualAngle && item.angle !== null ? item.angle : index * step,
  }));
}

/** Group enabled-or-all technologies into their rings, angles resolved. */
export function layoutOrbit(
  items: StackTechRecord[],
  { includeDisabled = false } = {},
): Record<OrbitRing, OrbitNodeLayout[]> {
  const source = includeDisabled ? items : items.filter((item) => item.enabled);

  return Object.fromEntries(
    ORBIT_RINGS.map((ring) => [
      ring,
      layoutRing(source.filter((item) => item.ring === ring)),
    ]),
  ) as Record<OrbitRing, OrbitNodeLayout[]>;
}

export type OrbitTickerItem = Pick<StackTechRecord, "id" | "name">;

/**
 * Names for the ticker beneath the orbit, sourced from the exact same layout
 * as its nodes. This keeps add, rename, hide, move and delete changes in sync
 * without maintaining a second editorial list.
 */
export function orbitTickerItems(items: StackTechRecord[]): OrbitTickerItem[] {
  const rings = layoutOrbit(items);
  return ORBIT_RINGS.flatMap((ring) =>
    rings[ring].map(({ id, name }) => ({ id, name })),
  );
}

export type CapacityWarning = {
  ring: OrbitRing;
  count: number;
  capacity: number;
  /** `crowded` is the last comfortable step before nodes actually overlap. */
  level: "crowded" | "overlapping";
};

export type ActiveCountWarning = {
  count: number;
  max: number;
};

/**
 * Warn once the orbit holds more enabled nodes than it is designed to show.
 *
 * Separate from `ringCapacityWarnings`: the rings can physically hold far more
 * than twenty-one between them, so this is the editorial limit, not the point
 * where circles would start to touch.
 */
export function activeCountWarning(
  items: StackTechRecord[],
): ActiveCountWarning | null {
  const count = items.filter((item) => item.enabled).length;
  if (count <= MAX_ACTIVE_TECHNOLOGIES) return null;
  return { count, max: MAX_ACTIVE_TECHNOLOGIES };
}

/** Warn before a ring holds more nodes than will fit without touching. */
export function ringCapacityWarnings(
  items: StackTechRecord[],
): CapacityWarning[] {
  return ORBIT_RINGS.flatMap((ring) => {
    const count = items.filter(
      (item) => item.ring === ring && item.enabled,
    ).length;
    const capacity = RING_CAPACITY[ring];
    if (count <= capacity - 1) return [];
    return [
      {
        ring,
        count,
        capacity,
        level: count > capacity ? ("overlapping" as const) : ("crowded" as const),
      },
    ];
  });
}
