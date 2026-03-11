import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROJECT_COLUMNS,
  STACK_COLUMNS,
  toProject,
  toStackTech,
  type ProjectRow,
  type StackTechRow,
} from "@/lib/data/mappers";
import {
  RepositoryError,
  type PortfolioRepository,
} from "@/lib/data/repository";
import type { ProjectInput, StackTechInput } from "@/lib/data/schemas";
import type {
  OrbitRing,
  OverviewStats,
  ProjectRecord,
  StackTechRecord,
} from "@/lib/data/types";

type PostgrestError = { code?: string; message: string };

function fail(context: string, error: PostgrestError): never {
  if (error.code === "42501") {
    throw new RepositoryError(
      "Your account is not allowed to change this content.",
    );
  }
  throw new RepositoryError(`${context}: ${error.message}`);
}

function stackPayload(input: StackTechInput) {
  return {
    name: input.name,
    brand_key: input.brandKey,
    logo_path: input.logoPath,
    ring: input.ring,
    enabled: input.enabled,
    node_background: input.nodeBackground || null,
    icon_mode: input.iconMode,
    manual_angle: input.manualAngle,
    angle: input.manualAngle ? input.angle : null,
    logo_scale: input.logoScale,
    logo_offset_x: input.logoOffsetX,
    logo_offset_y: input.logoOffsetY,
  };
}

function projectPayload(input: ProjectInput) {
  return {
    slug: input.slug,
    title: input.title,
    tag: input.tag,
    image: input.image,
    gallery: input.gallery,
    client: input.client,
    duration: input.duration,
    preview_url: input.previewUrl,
    template_label: input.templateLabel,
    template_url: input.templateUrl,
    intro: input.intro,
    approach: input.approach,
    sections: input.sections,
    features: input.features,
    a11y_notes: input.a11yNotes,
    conclusion: input.conclusion,
    published: input.published,
    show_on_homepage: input.showOnHomepage,
  };
}

/**
 * Supabase-backed repository. Instantiated with a session-bound client, so
 * every statement runs as the signed-in administrator and RLS is the real
 * authorisation boundary.
 */
export class SupabasePortfolioRepository implements PortfolioRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listStack(): Promise<StackTechRecord[]> {
    const { data, error } = await this.client
      .from("stack_technologies")
      .select(STACK_COLUMNS)
      .order("ring", { ascending: true })
      .order("display_order", { ascending: true });

    if (error) fail("Could not load technologies", error);
    return (data as StackTechRow[]).map(toStackTech);
  }

  async createStackTech(input: StackTechInput): Promise<StackTechRecord> {
    const siblings = await this.listStack();
    const nextOrder =
      siblings
        .filter((item) => item.ring === input.ring)
        .reduce((max, item) => Math.max(max, item.displayOrder), -1) + 1;

    const { data, error } = await this.client
      .from("stack_technologies")
      .insert({ ...stackPayload(input), display_order: nextOrder })
      .select(STACK_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new RepositoryError(
          "That brand key is already used by another technology.",
          "brandKey",
        );
      }
      fail("Could not add the technology", error);
    }
    return toStackTech(data as StackTechRow);
  }

  async updateStackTech(
    id: string,
    input: StackTechInput,
  ): Promise<StackTechRecord> {
    const { data, error } = await this.client
      .from("stack_technologies")
      .update(stackPayload(input))
      .eq("id", id)
      .select(STACK_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new RepositoryError(
          "That brand key is already used by another technology.",
          "brandKey",
        );
      }
      fail("Could not save the technology", error);
    }
    return toStackTech(data as StackTechRow);
  }

  async deleteStackTech(id: string): Promise<void> {
    const { error } = await this.client
      .from("stack_technologies")
      .delete()
      .eq("id", id);
    if (error) fail("Could not remove the technology", error);
  }

  async reorderStack(ring: OrbitRing, ids: string[]): Promise<void> {
    const { error } = await this.client.rpc("reorder_stack_technologies", {
      target_ring: ring,
      ordered_ids: ids,
    });
    if (error) fail("Could not save the new order", error);
  }

  async listProjects(): Promise<ProjectRecord[]> {
    const { data, error } = await this.client
      .from("projects")
      .select(PROJECT_COLUMNS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) fail("Could not load projects", error);
    return (data as ProjectRow[]).map(toProject);
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const { data, error } = await this.client
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) fail("Could not load the project", error);
    return data ? toProject(data as ProjectRow) : null;
  }

  async getProjectBySlug(slug: string): Promise<ProjectRecord | null> {
    const { data, error } = await this.client
      .from("projects")
      .select(PROJECT_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();

    if (error) fail("Could not load the project", error);
    return data ? toProject(data as ProjectRow) : null;
  }

  async createProject(input: ProjectInput): Promise<ProjectRecord> {
    const { data: maxRow } = await this.client
      .from("projects")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder =
      ((maxRow as { display_order: number } | null)?.display_order ?? -1) + 1;

    const { data, error } = await this.client
      .from("projects")
      .insert({ ...projectPayload(input), display_order: nextOrder })
      .select(PROJECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new RepositoryError("That slug is already taken.", "slug");
      }
      fail("Could not create the project", error);
    }
    return toProject(data as ProjectRow);
  }

  async updateProject(id: string, input: ProjectInput): Promise<ProjectRecord> {
    const { data, error } = await this.client
      .from("projects")
      .update(projectPayload(input))
      .eq("id", id)
      .select(PROJECT_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new RepositoryError("That slug is already taken.", "slug");
      }
      fail("Could not save the project", error);
    }
    return toProject(data as ProjectRow);
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await this.client.from("projects").delete().eq("id", id);
    if (error) fail("Could not delete the project", error);
  }

  async reorderProjects(ids: string[]): Promise<void> {
    const { error } = await this.client.rpc("reorder_projects", {
      ordered_ids: ids,
    });
    if (error) fail("Could not save the new order", error);
  }

  async isSlugAvailable(slug: string, exceptId?: string): Promise<boolean> {
    let query = this.client.from("projects").select("id").eq("slug", slug);
    if (exceptId) query = query.neq("id", exceptId);

    const { data, error } = await query.limit(1);
    if (error) fail("Could not check the slug", error);
    return (data ?? []).length === 0;
  }

  async overview(): Promise<OverviewStats> {
    const [projects, stack] = await Promise.all([
      this.listProjects(),
      this.listStack(),
    ]);

    const recentProjects = [...projects]
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      .slice(0, 5);

    return {
      publishedProjects: projects.filter((project) => project.published).length,
      draftProjects: projects.filter((project) => !project.published).length,
      activeTechnologies: stack.filter((item) => item.enabled).length,
      totalTechnologies: stack.length,
      recentProjects,
    };
  }
}
