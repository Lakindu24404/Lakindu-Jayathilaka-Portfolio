import { readSupabaseConfig } from "@/lib/supabase/config";
import type { CacheTag } from "@/lib/data/tags";

/**
 * Read-only PostgREST access for the public site.
 *
 * Public pages use plain `fetch` with the anon key rather than `supabase-js`
 * so the responses participate in the Next.js Data Cache. That keeps
 * `/` and `/[slug]` statically prerendered and lets the dashboard invalidate
 * them with `revalidateTag` after a publish. Row-level security still applies,
 * so the anon key can only ever see enabled/published rows.
 */
export async function restSelect<T>(
  table: string,
  query: string,
  tags: CacheTag[],
): Promise<T[] | null> {
  const result = readSupabaseConfig();
  if (!result.ok) return null;

  const { url, anonKey } = result.config;
  const endpoint = `${url}/rest/v1/${table}?${query}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
      cache: process.env.NODE_ENV === "development" ? "no-store" : "force-cache",
      next:
        process.env.NODE_ENV === "development"
          ? undefined
          : { tags, revalidate: 3600 },
    });

    if (!response.ok) {
      console.error(
        `[portfolio] Supabase read failed for "${table}": ${response.status} ${response.statusText}`,
      );
      return null;
    }

    return (await response.json()) as T[];
  } catch (error) {
    console.error(`[portfolio] Supabase read threw for "${table}":`, error);
    return null;
  }
}
