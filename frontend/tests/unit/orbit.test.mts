import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  activeCountWarning,
  layoutOrbit,
  layoutRing,
  orbitTickerItems,
  ringCapacityWarnings,
} from "@/lib/data/orbit";
import {
  MAX_ACTIVE_TECHNOLOGIES,
  ORBIT_RINGS,
  RING_CAPACITY,
  type OrbitRing,
  type StackTechRecord,
} from "@/lib/data/types";
import { stackSeed } from "@/content/portfolio-seed";

function tech(over: Partial<StackTechRecord> & { id: string }): StackTechRecord {
  const base: StackTechRecord = {
    id: over.id,
    name: over.id,
    brandKey: over.id,
    logoPath: "/images/stack-html5.svg",
    ring: "outer",
    displayOrder: 0,
    enabled: true,
    nodeBackground: null,
    iconMode: "original",
    manualAngle: false,
    angle: null,
    logoScale: 1,
    logoOffsetX: 0,
    logoOffsetY: 0,
    updatedAt: null,
  };
  // Spread by key, so an explicit `undefined` in `over` cannot widen a field.
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined) Reflect.set(base, key, value);
  }
  return base;
}

describe("layoutRing", () => {
  it("spreads nodes evenly in display order", () => {
    const laid = layoutRing([
      tech({ id: "c", displayOrder: 2 }),
      tech({ id: "a", displayOrder: 0 }),
      tech({ id: "b", displayOrder: 1 }),
      tech({ id: "d", displayOrder: 3 }),
    ]);
    assert.deepEqual(
      laid.map((n) => [n.id, n.resolvedAngle]),
      [["a", 0], ["b", 90], ["c", 180], ["d", 270]],
    );
  });

  it("honours a manual angle verbatim", () => {
    const laid = layoutRing([
      tech({ id: "a", displayOrder: 0, manualAngle: true, angle: 45 }),
      tech({ id: "b", displayOrder: 1 }),
    ]);
    assert.deepEqual(
      laid.map((n) => n.resolvedAngle),
      [45, 180],
    );
  });

  it("ignores a stored angle once manual placement is turned off", () => {
    const laid = layoutRing([
      tech({ id: "a", displayOrder: 0, manualAngle: false, angle: 300 }),
      tech({ id: "b", displayOrder: 1 }),
    ]);
    assert.deepEqual(
      laid.map((n) => n.resolvedAngle),
      [0, 180],
    );
  });

  it("handles an empty ring without dividing by zero", () => {
    assert.deepEqual(layoutRing([]), []);
  });
});

describe("layoutOrbit", () => {
  it("reproduces the angles the orbit shipped with", () => {
    const rings = layoutOrbit(stackSeed);
    assert.deepEqual(
      rings.farOuter.map((n) => [n.brandKey, n.resolvedAngle]),
      [
        ["html", 0], ["css", 45], ["javascript", 90], ["php", 135],
        ["xampp", 180], ["cplusplus", 225], ["vscode", 270], ["claude", 315],
      ],
    );
    assert.deepEqual(
      rings.outer.map((n) => [n.brandKey, n.resolvedAngle]),
      [
        ["csharp", 0], ["mysql", 360 / 7], ["java", 720 / 7],
        ["python", 1080 / 7], ["react", 1440 / 7],
        ["gemini", 1800 / 7], ["clickup", 2160 / 7],
      ],
    );
    assert.deepEqual(
      rings.middle.map((n) => [n.brandKey, n.resolvedAngle]),
      [["wordpress", 0], ["chatgpt", 90], ["github", 180], ["canva", 270]],
    );
    assert.deepEqual(
      rings.inner.map((n) => [n.brandKey, n.resolvedAngle]),
      [["intellij", 45], ["adobe", 225]],
    );
  });

  it("produces all four rings, even when a ring is empty", () => {
    const rings = layoutOrbit([tech({ id: "solo", ring: "inner" })]);

    assert.deepEqual(Object.keys(rings).sort(), [...ORBIT_RINGS].sort());
    assert.equal(rings.inner.length, 1);
    assert.deepEqual(rings.farOuter, []);
    assert.deepEqual(rings.outer, []);
    assert.deepEqual(rings.middle, []);
  });

  it("places twenty-one technologies across the four rings", () => {
    // The shipped distribution: 8 / 7 / 4 / 2.
    const rings = layoutOrbit(stackSeed);
    const counts = ORBIT_RINGS.map((ring) => rings[ring].length);

    assert.deepEqual(counts, [8, 7, 4, 2]);
    assert.equal(
      counts.reduce((sum, count) => sum + count, 0),
      21,
      "the seeded orbit should show twenty-one technologies",
    );
  });

  it("keeps a three-ring record from before the fourth ring existed working", () => {
    // Rows stored as outer/middle/inner predate `farOuter` and must keep
    // laying out exactly as they did, on their original rings.
    const legacy = [
      tech({ id: "a", ring: "outer", displayOrder: 0 }),
      tech({ id: "b", ring: "outer", displayOrder: 1 }),
      tech({ id: "c", ring: "middle", displayOrder: 0 }),
      tech({ id: "d", ring: "inner", displayOrder: 0 }),
    ];

    const rings = layoutOrbit(legacy);

    assert.deepEqual(rings.farOuter, []);
    assert.deepEqual(
      rings.outer.map((n) => [n.id, n.resolvedAngle]),
      [["a", 0], ["b", 180]],
    );
    assert.deepEqual(rings.middle.map((n) => n.id), ["c"]);
    assert.deepEqual(rings.inner.map((n) => n.id), ["d"]);
  });

  it("drops disabled nodes unless they are asked for", () => {
    const items = [
      tech({ id: "on", ring: "outer", displayOrder: 0 }),
      tech({ id: "off", ring: "outer", displayOrder: 1, enabled: false }),
    ];
    assert.equal(layoutOrbit(items).outer.length, 1);
    assert.equal(
      layoutOrbit(items, { includeDisabled: true }).outer.length,
      2,
    );
  });

  it("redistributes the remaining nodes when one is disabled", () => {
    const items = [
      tech({ id: "a", displayOrder: 0 }),
      tech({ id: "b", displayOrder: 1, enabled: false }),
      tech({ id: "c", displayOrder: 2 }),
    ];
    assert.deepEqual(
      layoutOrbit(items).outer.map((n) => n.resolvedAngle),
      [0, 180],
    );
  });
});

describe("orbitTickerItems", () => {
  it("uses only visible orbit records in the same ring and display order", () => {
    const items = [
      tech({ id: "outer-second", name: "Outer second", ring: "outer", displayOrder: 2 }),
      tech({ id: "inner", name: "Inner", ring: "inner", displayOrder: 0 }),
      tech({ id: "hidden", name: "Do not show", ring: "farOuter", enabled: false }),
      tech({ id: "far", name: "Far outer", ring: "farOuter", displayOrder: 4 }),
      tech({ id: "outer-first", name: "Outer first", ring: "outer", displayOrder: 1 }),
    ];

    assert.deepEqual(orbitTickerItems(items), [
      { id: "far", name: "Far outer" },
      { id: "outer-first", name: "Outer first" },
      { id: "outer-second", name: "Outer second" },
      { id: "inner", name: "Inner" },
    ]);
  });

  it("reflects additions, renames and deletions without a separate list", () => {
    const original = [tech({ id: "a", name: "Alpha" })];
    const added = [...original, tech({ id: "b", name: "Beta", displayOrder: 1 })];
    const renamed = added.map((item) =>
      item.id === "b" ? { ...item, name: "Beta latest" } : item,
    );

    assert.deepEqual(orbitTickerItems(original).map((item) => item.name), ["Alpha"]);
    assert.deepEqual(orbitTickerItems(added).map((item) => item.name), ["Alpha", "Beta"]);
    assert.deepEqual(orbitTickerItems(renamed).map((item) => item.name), [
      "Alpha",
      "Beta latest",
    ]);
    assert.deepEqual(
      orbitTickerItems(renamed.filter((item) => item.id !== "a")).map(
        (item) => item.name,
      ),
      ["Beta latest"],
    );
  });
});

/**
 * The capacity constants claim to be derived from the stylesheet. This reads
 * the real ratios back out of `Stack.module.css` and checks that claim, so a
 * change to the orbit sizing cannot silently invalidate the warnings.
 *
 * Every length in the orbit is a fraction of one `--orbit-size`, so these
 * ratios describe the geometry at *every* breakpoint at once — a breakpoint
 * only restates that single length.
 */
describe("RING_CAPACITY matches the stylesheet geometry", () => {
  const css = readFileSync("src/components/home/Stack.module.css", "utf8");

  /** CSS custom property holding each ring's radius. */
  const RADIUS_PROPERTY: Record<OrbitRing, string> = {
    farOuter: "far-outer-radius",
    outer: "outer-radius",
    middle: "middle-radius",
    inner: "inner-radius",
  };

  /** Every `--x: calc(var(--orbit-size) * ratio)` the stylesheet declares. */
  function ratios(): Record<string, number> {
    const found: Record<string, number> = {};
    const pattern =
      /--([a-z-]+):\s*calc\(\s*var\(--orbit-size\)\s*\*\s*([\d.]+)\s*\)/g;
    for (const match of css.matchAll(pattern)) {
      found[match[1]] = Number(match[2]);
    }
    return found;
  }

  /** Circles of diameter `d` that fit around a circle of radius `R`. */
  function fits(radius: number, node: number): number {
    return Math.floor(Math.PI / Math.asin(node / (2 * radius)));
  }

  function geometry() {
    const all = ratios();
    const node = all["node-size"];
    assert.ok(node, "--node-size is not declared as a ratio of --orbit-size");
    return { all, node };
  }

  it("declares a ratio for every ring, the node and the portrait", () => {
    const { all } = geometry();
    for (const ring of ORBIT_RINGS) {
      assert.ok(
        all[RADIUS_PROPERTY[ring]],
        `--${RADIUS_PROPERTY[ring]} is missing from the stylesheet`,
      );
    }
    assert.ok(all["portrait-size"], "--portrait-size is missing");
  });

  it("orders the rings outward and never lets two rings collide", () => {
    const { all, node } = geometry();
    // Outermost first, so each radius must be larger than the next one in.
    const radii = ORBIT_RINGS.map((ring) => all[RADIUS_PROPERTY[ring]]);

    for (let i = 0; i < radii.length - 1; i++) {
      const gap = radii[i] - radii[i + 1];
      assert.ok(gap > 0, `${ORBIT_RINGS[i]} is not outside ${ORBIT_RINGS[i + 1]}`);
      assert.ok(
        gap >= node,
        `${ORBIT_RINGS[i]} and ${ORBIT_RINGS[i + 1]} are ${gap} apart, closer than one ${node} node — their nodes would overlap`,
      );
    }
  });

  it("keeps the outermost nodes inside the orbit box", () => {
    const { all, node } = geometry();
    const outermost = all[RADIUS_PROPERTY.farOuter] + node / 2;
    assert.ok(
      outermost <= 0.5,
      `the outermost node reaches ${outermost} of the orbit box, past its 0.5 edge`,
    );
  });

  it("keeps the innermost ring clear of the portrait", () => {
    const { all, node } = geometry();
    const innerEdge = all[RADIUS_PROPERTY.inner] - node / 2;
    const portraitEdge = all["portrait-size"] / 2;
    assert.ok(
      innerEdge > portraitEdge,
      `the inner ring's nodes reach ${innerEdge}, inside the portrait's ${portraitEdge}`,
    );
  });

  for (const ring of ORBIT_RINGS) {
    it(`${ring}: declared capacity never exceeds what actually fits`, () => {
      const { all, node } = geometry();
      const room = fits(all[RADIUS_PROPERTY[ring]], node);
      assert.ok(
        RING_CAPACITY[ring] <= room,
        `RING_CAPACITY.${ring} = ${RING_CAPACITY[ring]} but only ${room} fit`,
      );
    });

    it(`${ring}: declared capacity is not needlessly pessimistic`, () => {
      const { all, node } = geometry();
      const room = fits(all[RADIUS_PROPERTY[ring]], node);
      assert.ok(
        RING_CAPACITY[ring] >= room - 1,
        `RING_CAPACITY.${ring} = ${RING_CAPACITY[ring]} warns far too early: ${room} nodes actually fit`,
      );
    });
  }

  it("has room for the twenty-one the orbit is designed to show", () => {
    const total = ORBIT_RINGS.reduce((sum, ring) => sum + RING_CAPACITY[ring], 0);
    assert.ok(
      total >= MAX_ACTIVE_TECHNOLOGIES,
      `the four rings hold ${total}, fewer than the ${MAX_ACTIVE_TECHNOLOGIES} the orbit advertises`,
    );
  });
});

describe("ringCapacityWarnings", () => {
  function fill(ring: OrbitRing, count: number, enabled = true) {
    return Array.from({ length: count }, (_, i) =>
      tech({ id: `${ring}-${i}`, ring, displayOrder: i, enabled }),
    );
  }

  it("stays quiet while a ring is comfortably under capacity", () => {
    assert.deepEqual(
      ringCapacityWarnings(fill("outer", RING_CAPACITY.outer - 2)),
      [],
    );
  });

  it("warns as crowded on the last comfortable node", () => {
    const [warning] = ringCapacityWarnings(fill("outer", RING_CAPACITY.outer));
    assert.equal(warning?.level, "crowded");
  });

  it("warns as overlapping past capacity", () => {
    const [warning] = ringCapacityWarnings(
      fill("outer", RING_CAPACITY.outer + 1),
    );
    assert.equal(warning?.level, "overlapping");
  });

  it("counts only enabled nodes", () => {
    assert.deepEqual(
      ringCapacityWarnings(fill("inner", RING_CAPACITY.inner + 4, false)),
      [],
    );
  });

  it("is silent for the shipped orbit", () => {
    assert.deepEqual(ringCapacityWarnings(stackSeed), []);
  });
});

describe("activeCountWarning", () => {
  function enabled(count: number, isEnabled = true) {
    return Array.from({ length: count }, (_, i) =>
      tech({ id: `n-${i}`, ring: "farOuter", displayOrder: i, enabled: isEnabled }),
    );
  }

  it("stays quiet at the twenty-one the orbit is designed for", () => {
    assert.equal(activeCountWarning(enabled(MAX_ACTIVE_TECHNOLOGIES)), null);
  });

  it("warns past twenty-one, reporting the count and the limit", () => {
    const warning = activeCountWarning(enabled(MAX_ACTIVE_TECHNOLOGIES + 1));

    assert.deepEqual(warning, {
      count: MAX_ACTIVE_TECHNOLOGIES + 1,
      max: MAX_ACTIVE_TECHNOLOGIES,
    });
  });

  it("counts only enabled technologies", () => {
    // Forty hidden nodes are not shown, so they cannot crowd anything.
    assert.equal(activeCountWarning(enabled(40, false)), null);
  });

  it("is silent for the shipped orbit", () => {
    assert.equal(activeCountWarning(stackSeed), null);
  });
});
