/**
 * Supabase configuration, resolved once and reported as data rather than by
 * throwing at import time — a missing key must not take the public portfolio
 * down, it should only disable the dashboard.
 */

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export type ConfigResult =
  | { ok: true; config: SupabaseConfig }
  | { ok: false; missing: string[] };

const PUBLIC_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

export function readSupabaseConfig(): ConfigResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const missing = PUBLIC_VARS.filter((name) => !process.env[name]?.trim());
  if (!url || !anonKey) return { ok: false, missing };

  return { ok: true, config: { url: url.replace(/\/+$/, ""), anonKey } };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig().ok;
}

/** For code paths that genuinely cannot continue without a connection. */
export function requireSupabaseConfig(): SupabaseConfig {
  const result = readSupabaseConfig();
  if (!result.ok) {
    throw new SupabaseConfigError(result.missing);
  }
  return result.config;
}

export class SupabaseConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(
      `Supabase is not configured. Missing environment variable${
        missing.length === 1 ? "" : "s"
      }: ${missing.join(", ")}. Copy .env.example to .env.local and see backend/README.md.`,
    );
    this.name = "SupabaseConfigError";
    this.missing = missing;
  }
}

/** The public storage origin, used to allow-list images in `next.config.ts`. */
export function supabaseStorageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export const STORAGE_BUCKETS = {
  stackLogos: "stack-logos",
  projectImages: "project-images",
} as const;
