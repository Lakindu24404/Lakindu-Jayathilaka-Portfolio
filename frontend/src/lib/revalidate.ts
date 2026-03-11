import { revalidatePath, updateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/data/tags";

/**
 * Push a dashboard change out to the public site.
 *
 * `updateTag` rather than `revalidateTag(tag, "max")`: the latter is
 * stale-while-revalidate, so a reader immediately after a save can be served
 * the pre-change page while a refresh runs behind it. `updateTag` expires the
 * entry, so the next reader waits for fresh data and sees the write.
 *
 * In this app the two behave the same in practice, because the
 * `revalidatePath` calls below already cover every route that reads these
 * tags — measured in `tests/e2e/publish-cache.spec.ts`. `updateTag` is used
 * anyway so the guarantee does not silently depend on that overlap holding.
 *
 * `updateTag` is Server-Action-only. Every caller lives in
 * `src/app/dashboard/actions.ts`, a `"use server"` module; a route handler
 * that needed to invalidate would have to use `revalidateTag` instead.
 */
export function revalidateProjects(slug?: string, previousSlug?: string): void {
  updateTag(CACHE_TAGS.projects);
  revalidatePath("/");
  revalidatePath("/[slug]", "page");

  for (const value of new Set([slug, previousSlug])) {
    if (value) revalidatePath(`/${value}`);
  }
}

export function revalidateStack(): void {
  updateTag(CACHE_TAGS.stack);
  revalidatePath("/");
}
