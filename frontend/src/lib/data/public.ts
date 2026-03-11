import { projectSeed, stackSeed } from "@/content/portfolio-seed";
import {
  PROJECT_COLUMNS,
  STACK_COLUMNS,
  toProject,
  toStackTech,
  type ProjectRow,
  type StackTechRow,
} from "@/lib/data/mappers";
import { CACHE_TAGS } from "@/lib/data/tags";
import { restSelect } from "@/lib/supabase/rest";
import {
  toPublicProject,
  type ProjectRecord,
  type PublicProject,
  type StackTechRecord,
} from "@/lib/data/types";

/**
 * Read side of the data layer used by the public portfolio.
 *
 * Every function degrades to the bundled seed content when Supabase is not
 * configured or is unreachable, so the site never renders empty because of an
 * environment problem.
 */

export async function getPublicStack(): Promise<StackTechRecord[]> {
  const rows = await restSelect<StackTechRow>(
    "stack_technologies",
    `select=${STACK_COLUMNS}&enabled=eq.true&order=ring.asc,display_order.asc`,
    [CACHE_TAGS.stack],
  );

  if (!rows) return stackSeed;
  if (rows.length === 0) return [];
  return rows.map(toStackTech);
}

export async function getPublishedProjects(): Promise<PublicProject[]> {
  const rows = await restSelect<ProjectRow>(
    "projects",
    `select=${PROJECT_COLUMNS}&published=eq.true&order=display_order.asc,created_at.asc`,
    [CACHE_TAGS.projects],
  );

  const records: ProjectRecord[] = rows ? rows.map(toProject) : projectSeed;
  return records.map(toPublicProject);
}

export async function getHomepageProjects(): Promise<PublicProject[]> {
  const all = await getPublishedProjects();
  return all.filter((project) => project.showOnHomepage);
}

export async function getPublishedProject(
  slug: string,
): Promise<PublicProject | null> {
  const projects = await getPublishedProjects();
  return projects.find((project) => project.slug === slug) ?? null;
}

/** The four cards shown under "Other Projects" on a case study. */
export function relatedProjects(
  projects: PublicProject[],
  slug: string,
): PublicProject[] {
  return projects.filter((project) => project.slug !== slug).slice(0, 4);
}
