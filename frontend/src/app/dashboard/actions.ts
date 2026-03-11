"use server";

import { redirect } from "next/navigation";
import { requireAdminOrThrow } from "@/lib/auth";
import { LOGO_OFFSET, LOGO_SCALE } from "@/lib/data/logo-fit";
import { RepositoryError } from "@/lib/data/repository";
import {
  fieldErrors,
  projectInput,
  reorderInput,
  slugify,
  stackTechInput,
  type ProjectInput,
  type StackTechInput,
} from "@/lib/data/schemas";
import { revalidateProjects, revalidateStack } from "@/lib/revalidate";
import { safeDashboardPath } from "@/lib/safe-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ORBIT_RINGS,
  type OrbitRing,
  type StackTechRecord,
} from "@/lib/data/types";
import { z } from "zod";

/**
 * Every mutation the dashboard can perform.
 *
 * Server Actions are reachable by direct POST, so each one starts by resolving
 * the caller's admin session — rendering the form behind a guard is not a
 * permission check. Payloads are then validated with Zod before they reach the
 * repository, and Postgres RLS refuses anything that slips past both.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string; errors?: Record<string, string> };

async function run<T>(work: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RepositoryError) {
      return {
        ok: false,
        message: error.message,
        errors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    console.error("[dashboard] action failed:", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };
  }
}

function invalid<T>(error: z.ZodError): ActionResult<T> {
  return {
    ok: false,
    message: "Please fix the highlighted fields.",
    errors: fieldErrors(error),
  };
}

// --------------------------------------------------------------------- auth

export async function signIn(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const parsed = z
    .object({
      email: z.email("Enter a valid email address"),
      password: z.string().min(1, "Enter your password"),
      next: z.string().optional(),
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
      next: formData.get("next"),
    });

  if (!parsed.success) return invalid(parsed.error);

  let client;
  try {
    client = await createSupabaseServerClient();
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Supabase is not configured.",
    };
  }

  const { error } = await client.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Deliberately vague: do not confirm whether an address has an account.
  if (error) {
    return { ok: false, message: "That email and password did not match." };
  }

  const { data: isAdmin } = await client.rpc("is_admin");
  if (isAdmin !== true) {
    await client.auth.signOut();
    return {
      ok: false,
      message: "That account does not have dashboard access.",
    };
  }

  // `next` is attacker-controlled, so it is normalised and re-checked here
  // rather than trusted from the query string. See `safeDashboardPath`.
  redirect(safeDashboardPath(parsed.data.next) ?? "/dashboard");
}

export async function signOut(): Promise<void> {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/dashboard/login");
}

// -------------------------------------------------------------- stack orbit

/**
 * Read one logo-fit number off the form.
 *
 * A field that is absent or blank falls back to the centred default, so a post
 * from an older client still saves rather than failing validation. A field that
 * is present but not a number stays `NaN`, which `stackTechInput` reports as a
 * field error instead of silently discarding what the administrator set.
 */
function readLogoFitField(value: FormDataEntryValue | null, fallback: number) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  return Number(value);
}

function readStackForm(formData: FormData): unknown {
  const manualAngle = formData.get("manualAngle") === "on";
  const rawAngle = formData.get("angle");

  return {
    name: formData.get("name"),
    brandKey: formData.get("brandKey"),
    logoPath: formData.get("logoPath"),
    ring: formData.get("ring"),
    enabled: formData.get("enabled") === "on",
    nodeBackground: (formData.get("nodeBackground") as string) || null,
    iconMode: formData.get("iconMode"),
    manualAngle,
    angle:
      manualAngle && typeof rawAngle === "string" && rawAngle !== ""
        ? Number(rawAngle)
        : null,
    logoScale: readLogoFitField(formData.get("logoScale"), LOGO_SCALE.default),
    logoOffsetX: readLogoFitField(
      formData.get("logoOffsetX"),
      LOGO_OFFSET.default,
    ),
    logoOffsetY: readLogoFitField(
      formData.get("logoOffsetY"),
      LOGO_OFFSET.default,
    ),
  };
}

export async function saveStackTech(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<StackTechRecord>> {
  return run<StackTechRecord>(async () => {
    const { repository } = await requireAdminOrThrow();

    const parsed = stackTechInput.safeParse(readStackForm(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input: StackTechInput = parsed.data;
    const saved = id
      ? await repository.updateStackTech(id, input)
      : await repository.createStackTech(input);

    revalidateStack();
    return {
      ok: true,
      // Return the database's canonical row. The dashboard can then render the
      // latest saved values immediately instead of reconstructing a row from
      // a draft that may differ from server-side normalization.
      data: saved,
      message: id ? "Technology saved." : `${saved.name} added to the orbit.`,
    };
  });
}

export async function deleteStackTech(id: string): Promise<ActionResult> {
  return run<undefined>(async () => {
    const { repository } = await requireAdminOrThrow();
    await repository.deleteStackTech(id);
    revalidateStack();
    return { ok: true, data: undefined, message: "Technology removed." };
  });
}

export async function reorderStackRing(
  ring: string,
  ids: string[],
): Promise<ActionResult> {
  return run<undefined>(async () => {
    const { repository } = await requireAdminOrThrow();

    const parsed = reorderInput.safeParse({ ring, ids });
    if (!parsed.success) return invalid(parsed.error);

    await repository.reorderStack(parsed.data.ring as OrbitRing, parsed.data.ids);
    revalidateStack();
    return { ok: true, data: undefined, message: "Order saved." };
  });
}

export async function setStackTechRing(
  id: string,
  ring: string,
  orderedIds: string[],
): Promise<ActionResult> {
  return run<undefined>(async () => {
    const { repository } = await requireAdminOrThrow();

    if (!(ORBIT_RINGS as readonly string[]).includes(ring)) {
      return { ok: false, message: "Unknown orbit ring." };
    }
    if (!orderedIds.includes(id)) {
      return { ok: false, message: "That technology is not on the target ring." };
    }

    // `reorder_stack_technologies` writes the ring as well as the order, so a
    // move between rings is the same single statement as a reorder.
    await repository.reorderStack(ring as OrbitRing, orderedIds);
    revalidateStack();
    return { ok: true, data: undefined, message: "Moved." };
  });
}

// ----------------------------------------------------------------- projects

function readProjectForm(formData: FormData): unknown {
  const json = (key: string, fallback: unknown) => {
    const raw = formData.get(key);
    if (typeof raw !== "string" || raw === "") return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  };

  return {
    title: formData.get("title"),
    slug: formData.get("slug"),
    tag: formData.get("tag"),
    image: formData.get("image"),
    gallery: json("gallery", []),
    client: formData.get("client"),
    duration: formData.get("duration"),
    previewUrl: formData.get("previewUrl"),
    templateLabel: formData.get("templateLabel"),
    templateUrl: formData.get("templateUrl"),
    intro: formData.get("intro"),
    approach: formData.get("approach"),
    sections: json("sections", []),
    features: formData.get("features"),
    a11yNotes: formData.get("a11yNotes"),
    conclusion: formData.get("conclusion"),
    published: formData.get("published") === "on",
    showOnHomepage: formData.get("showOnHomepage") === "on",
  };
}

export async function saveProject(
  id: string | null,
  formData: FormData,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return run<{ id: string; slug: string }>(async () => {
    const { repository } = await requireAdminOrThrow();

    const parsed = projectInput.safeParse(readProjectForm(formData));
    if (!parsed.success) return invalid(parsed.error);

    const input: ProjectInput = parsed.data;

    if (!(await repository.isSlugAvailable(input.slug, id ?? undefined))) {
      return {
        ok: false,
        message: "That slug is already used by another project.",
        errors: { slug: "Already in use — try a different slug." },
      };
    }

    const previous = id ? await repository.getProject(id) : null;
    const saved = id
      ? await repository.updateProject(id, input)
      : await repository.createProject(input);

    revalidateProjects(saved.slug, previous?.slug);

    return {
      ok: true,
      data: { id: saved.id, slug: saved.slug },
      message: saved.published
        ? "Saved and published."
        : "Saved as a draft.",
    };
  });
}

export async function duplicateProject(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  return run<{ id: string }>(async () => {
    const { repository } = await requireAdminOrThrow();

    const source = await repository.getProject(id);
    if (!source) return { ok: false, message: "That project no longer exists." };

    // Find a free slug rather than failing on the unique constraint.
    const base = slugify(`${source.slug}-copy`);
    let slug = base;
    for (let attempt = 2; !(await repository.isSlugAvailable(slug)); attempt++) {
      slug = `${base}-${attempt}`;
      if (attempt > 50) {
        return { ok: false, message: "Could not find a free slug for the copy." };
      }
    }

    const copy = await repository.createProject({
      title: `${source.title} (copy)`,
      slug,
      tag: source.tag,
      image: source.image,
      gallery: source.gallery,
      client: source.client,
      duration: source.duration,
      previewUrl: source.previewUrl,
      templateLabel: source.templateLabel,
      templateUrl: source.templateUrl,
      intro: source.intro,
      approach: source.approach,
      sections: source.sections,
      features: source.features,
      a11yNotes: source.a11yNotes,
      conclusion: source.conclusion,
      // A copy always starts as a draft, so duplicating never publishes.
      published: false,
      showOnHomepage: source.showOnHomepage,
    });

    revalidateProjects();
    return {
      ok: true,
      data: { id: copy.id },
      message: "Duplicated as a draft.",
    };
  });
}

export async function deleteProject(id: string): Promise<ActionResult> {
  return run<undefined>(async () => {
    const { repository } = await requireAdminOrThrow();

    const project = await repository.getProject(id);
    await repository.deleteProject(id);
    revalidateProjects(undefined, project?.slug);

    return { ok: true, data: undefined, message: "Project deleted." };
  });
}

export async function setProjectPublished(
  id: string,
  published: boolean,
): Promise<ActionResult> {
  return run<undefined>(async () => {
    const { repository } = await requireAdminOrThrow();

    const project = await repository.getProject(id);
    if (!project) return { ok: false, message: "That project no longer exists." };

    await repository.updateProject(id, {
      title: project.title,
      slug: project.slug,
      tag: project.tag,
      image: project.image,
      gallery: project.gallery,
      client: project.client,
      duration: project.duration,
      previewUrl: project.previewUrl,
      templateLabel: project.templateLabel,
      templateUrl: project.templateUrl,
      intro: project.intro,
      approach: project.approach,
      sections: project.sections,
      features: project.features,
      a11yNotes: project.a11yNotes,
      conclusion: project.conclusion,
      published,
      showOnHomepage: project.showOnHomepage,
    });

    revalidateProjects(project.slug);
    return {
      ok: true,
      data: undefined,
      message: published ? "Published." : "Moved back to drafts.",
    };
  });
}

export async function reorderProjects(ids: string[]): Promise<ActionResult> {
  return run<undefined>(async () => {
    const { repository } = await requireAdminOrThrow();

    const parsed = reorderInput.safeParse({ ids });
    if (!parsed.success) return invalid(parsed.error);

    await repository.reorderProjects(parsed.data.ids);
    revalidateProjects();
    return { ok: true, data: undefined, message: "Order saved." };
  });
}
