/**
 * Domain types for the dashboard-managed portfolio content.
 *
 * These are deliberately storage-agnostic: nothing here mentions Supabase, so
 * the UI and the public pages can be pointed at a different backend by adding
 * another `PortfolioRepository` implementation.
 */

/**
 * Outermost first. The order is the render order of the rotors in
 * `StackOrbit`, and the order the dashboard lists its ring panels in.
 */
export const ORBIT_RINGS = ["farOuter", "outer", "middle", "inner"] as const;
export type OrbitRing = (typeof ORBIT_RINGS)[number];

export const ICON_MODES = ["original", "dark", "white"] as const;
export type IconMode = (typeof ICON_MODES)[number];

/**
 * How many nodes fit on a ring before the circles start to touch.
 *
 * `floor(pi / asin(nodeSize / (2 * radius)))`. Every radius and the node size
 * in `Stack.module.css` are expressed as the same fraction of `--orbit-size`,
 * so `nodeSize / (2 * radius)` — and therefore the capacity — is identical at
 * every breakpoint. That is what makes one number per ring correct here
 * instead of one per screen size. `tests/unit/orbit.test.mts` recomputes these
 * from the stylesheet's own ratios.
 */
export const RING_CAPACITY: Record<OrbitRing, number> = {
  farOuter: 30,
  outer: 23,
  middle: 16,
  inner: 9,
};

/**
 * The orbit is designed to read clearly at twenty-one nodes across the four
 * rings. The rings themselves hold far more than that before they touch, so
 * this is an editorial limit rather than a geometric one — past it the
 * composition gets busy long before anything overlaps.
 */
export const MAX_ACTIVE_TECHNOLOGIES = 21;

export type StackTechRecord = {
  id: string;
  name: string;
  brandKey: string;
  logoPath: string;
  ring: OrbitRing;
  displayOrder: number;
  enabled: boolean;
  /** Optional CSS colour for the node disc. `null` keeps the stylesheet rule. */
  nodeBackground: string | null;
  iconMode: IconMode;
  /** When true, `angle` is honoured verbatim instead of being distributed. */
  manualAngle: boolean;
  angle: number | null;
  /**
   * Non-destructive framing of `logoPath` inside the circular node. The
   * uploaded file is never altered — see `src/lib/data/logo-fit.ts` for the
   * ranges and the shared clamps.
   */
  logoScale: number;
  logoOffsetX: number;
  logoOffsetY: number;
  updatedAt: string | null;
};

export type ProjectSection = {
  heading: string;
  body: string;
};

export type ProjectRecord = {
  id: string;
  slug: string;
  title: string;
  tag: string;
  image: string;
  gallery: string[];
  client: string;
  duration: string;
  previewUrl: string;
  templateLabel: string;
  templateUrl: string;
  intro: string;
  approach: string;
  sections: ProjectSection[];
  features: string;
  a11yNotes: string;
  conclusion: string;
  published: boolean;
  showOnHomepage: boolean;
  displayOrder: number;
  updatedAt: string | null;
};

/** The shape the public `ProjectCard` / `ProjectCase` components consume. */
export type PublicProject = ProjectRecord & { href: string };

export function toPublicProject(project: ProjectRecord): PublicProject {
  return { ...project, href: `/${project.slug}` };
}

export type OverviewStats = {
  publishedProjects: number;
  draftProjects: number;
  activeTechnologies: number;
  totalTechnologies: number;
  recentProjects: ProjectRecord[];
};
