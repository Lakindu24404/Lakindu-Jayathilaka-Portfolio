import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "@/lib/supabase/config";

/**
 * A Supabase client bound to the caller's session cookies.
 *
 * Every write in the dashboard goes through this client, so Postgres RLS — not
 * the UI — is what actually decides whether the mutation is allowed. The
 * service-role key is never used at runtime.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, where cookies are readonly.
          // `proxy.ts` refreshes the session on the way in, so this is safe.
        }
      },
    },
  });
}
