import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  QA_PREFIX,
  anonKey,
  serviceRoleKey,
  supabaseUrl,
  throwawayPassword,
} from "./env.mts";

/**
 * Client factories and temporary-resource bookkeeping for the QA suites.
 *
 * Everything created here carries `QA_PREFIX`. `Tracker` records each id at
 * creation time so cleanup can delete exactly what this run made and nothing
 * else, even if a test throws part-way through.
 */

const noPersist = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/** Unauthenticated public client — what a site visitor gets. */
export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), noPersist);
}

/** Bypasses RLS. Test setup and cleanup only, never used to assert access. */
export function serviceClient(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), noPersist);
}

/** A client carrying a specific user's session, so RLS sees that user. */
export function userClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), {
    ...noPersist,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type QaUser = {
  id: string;
  email: string;
  password: string;
  accessToken: string;
};

/**
 * Records every temporary resource so `cleanup()` can remove it.
 *
 * Deletions are keyed on recorded ids, never on a broad match, so a bug in a
 * filter can never reach the seeded content.
 */
export class Tracker {
  readonly techIds: string[] = [];
  readonly projectIds: string[] = [];
  readonly users: QaUser[] = [];
  /** `[bucket, objectName]` pairs. */
  readonly objects: Array<[string, string]> = [];

  private readonly service = serviceClient();

  async createUser(role: "admin" | "member"): Promise<QaUser> {
    // Node's test runner executes DB files concurrently. A timestamp-only
    // prefix can therefore be identical in two workers; the UUID keeps each
    // throwaway account isolated while retaining the auditable QA prefix.
    const email = `${QA_PREFIX}${role}-${randomUUID()}@qa.invalid`;
    const password = throwawayPassword();

    const { data, error } = await this.service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new Error(`Could not create QA ${role} user: ${error?.message}`);
    }

    if (role === "admin") {
      const { error: grantError } = await this.service
        .from("admin_users")
        .insert({ user_id: data.user.id, email });
      if (grantError) {
        throw new Error(`Could not grant QA admin: ${grantError.message}`);
      }
    }

    const { data: session, error: signInError } = await anonClient()
      .auth.signInWithPassword({ email, password });
    if (signInError || !session.session) {
      throw new Error(`Could not sign in QA ${role}: ${signInError?.message}`);
    }

    const user: QaUser = {
      id: data.user.id,
      email,
      password,
      accessToken: session.session.access_token,
    };
    this.users.push(user);
    return user;
  }

  trackTech(id: string): string {
    this.techIds.push(id);
    return id;
  }

  trackProject(id: string): string {
    this.projectIds.push(id);
    return id;
  }

  trackObject(bucket: string, name: string): void {
    this.objects.push([bucket, name]);
  }

  /** Removes only ids recorded by this run. Safe to call more than once. */
  async cleanup(): Promise<void> {
    for (const [bucket, name] of this.objects.splice(0)) {
      await this.service.storage.from(bucket).remove([name]);
    }
    if (this.projectIds.length > 0) {
      await this.service
        .from("projects")
        .delete()
        .in("id", this.projectIds.splice(0));
    }
    if (this.techIds.length > 0) {
      await this.service
        .from("stack_technologies")
        .delete()
        .in("id", this.techIds.splice(0));
    }
    for (const user of this.users.splice(0)) {
      // `admin_users.user_id` cascades from `auth.users`, but the row is
      // removed explicitly so the cascade itself stays testable.
      await this.service.from("admin_users").delete().eq("user_id", user.id);
      await this.service.auth.admin.deleteUser(user.id);
    }
  }
}

/** Minimal valid technology payload, unique per call. */
export function techPayload(overrides: Record<string, unknown> = {}) {
  const key = `${QA_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `${QA_PREFIX}tech`,
    brand_key: key,
    logo_path: "/images/stack-html5.svg",
    ring: "outer",
    display_order: 900,
    enabled: true,
    icon_mode: "original",
    manual_angle: false,
    angle: null,
    ...overrides,
  };
}

/** Minimal valid project payload, unique per call. */
export function projectPayload(overrides: Record<string, unknown> = {}) {
  const slug = `${QA_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
  return {
    slug,
    title: `${QA_PREFIX}project`,
    tag: "QA",
    image: "/images/project-bambinoo.png",
    gallery: [],
    sections: [],
    published: false,
    show_on_homepage: true,
    display_order: 900,
    ...overrides,
  };
}
