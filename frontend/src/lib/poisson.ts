/**
 * Bridson Poisson-disc sampling — the even-but-organic point layout the
 * Antigravity hero uses for its particle field (it ships the
 * `poisson-disk-sampling` package; this is the same algorithm in ~70 lines).
 *
 * `minDistance` is the rejection radius, `maxDistance` the outer edge of the
 * annulus new candidates are thrown into, so a slightly variable spacing.
 * Sampling is seeded, so the same viewport always yields the same field.
 */

type Options = {
  width: number;
  height: number;
  minDistance: number;
  maxDistance?: number;
  /** Candidates per active point before it is retired. */
  tries?: number;
  seed?: number;
};

/** mulberry32 — small, fast, deterministic. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns flat `[x0, y0, x1, y1, …]` inside `[0, width] × [0, height]`. */
export function poissonDisc({
  width,
  height,
  minDistance,
  maxDistance = minDistance * 1.3,
  tries = 20,
  seed = 0x9e3779b9,
}: Options): Float32Array {
  const random = rng(seed);
  const cell = minDistance / Math.SQRT2;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid = new Int32Array(cols * rows).fill(-1);

  const points: number[] = [];
  const active: number[] = [];
  const minSq = minDistance * minDistance;

  const emit = (x: number, y: number) => {
    const index = points.length / 2;
    points.push(x, y);
    grid[Math.floor(y / cell) * cols + Math.floor(x / cell)] = index;
    active.push(index);
  };

  const fits = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let gy = Math.max(0, cy - 2); gy <= Math.min(rows - 1, cy + 2); gy++) {
      for (let gx = Math.max(0, cx - 2); gx <= Math.min(cols - 1, cx + 2); gx++) {
        const other = grid[gy * cols + gx];
        if (other === -1) continue;
        const dx = points[other * 2] - x;
        const dy = points[other * 2 + 1] - y;
        if (dx * dx + dy * dy < minSq) return false;
      }
    }
    return true;
  };

  emit(random() * width, random() * height);

  while (active.length) {
    const slot = (random() * active.length) | 0;
    const index = active[slot];
    const px = points[index * 2];
    const py = points[index * 2 + 1];
    let placed = false;

    for (let i = 0; i < tries; i++) {
      const angle = random() * Math.PI * 2;
      const radius = minDistance + random() * (maxDistance - minDistance);
      const x = px + Math.cos(angle) * radius;
      const y = py + Math.sin(angle) * radius;
      if (!fits(x, y)) continue;
      emit(x, y);
      placed = true;
      break;
    }

    if (!placed) {
      active[slot] = active[active.length - 1];
      active.pop();
    }
  }

  return new Float32Array(points);
}
