import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SupabasePortfolioRepository } from "@/lib/data/supabase-repository";
import type { PortfolioRepository } from "@/lib/data/repository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AdminSession = {
  user: User;
  client: SupabaseClient;
  repository: PortfolioRepository;
};

/**
 * Resolve the signed-in administrator for this request.
 *
 * `getUser()` is used rather than `getSession()` because it revalidates the
 * JWT with the Supabase auth server instead of trusting the cookie. Membership
 * of `admin_users` is checked in Postgres, and the same check backs every RLS
 * policy, so a caller who bypasses the UI still cannot write.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  if (!isSupabaseConfigured()) return null;

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data, error } = await client.rpc("is_admin");
  if (error || data !== true) return null;

  return {
    user,
    client,
    repository: new SupabasePortfolioRepository(client),
  };
});

/**
 * Guard for dashboard pages and every Server Action.
 *
 * Server Actions are reachable by direct POST, so calling this inside the
 * action — not just rendering the page behind a guard — is what makes the
 * permission real.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/dashboard/login");
  return session;
}

/** Non-redirecting variant, for Server Actions that return an error result. */
export async function requireAdminOrThrow(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("You need to sign in as an administrator to do that.");
  }
  return session;
}
