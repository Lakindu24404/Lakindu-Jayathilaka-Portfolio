/**
 * Environment access for the QA suites.
 *
 * Values are read here and never logged. `describeEnv()` exists so a failing
 * run can say what was missing without printing what was present.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Run the db/api suites with --env-file=.env.local.`,
    );
  }
  return value;
}

export const supabaseUrl = (): string =>
  required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
export const anonKey = (): string => required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const serviceRoleKey = (): string => required("SUPABASE_SERVICE_ROLE_KEY");

export const appOrigin = (): string =>
  process.env.QA_APP_ORIGIN?.trim() || "http://localhost:3000";

/** Every row, object and auth user this run creates carries this prefix. */
export const QA_PREFIX = `qa-${process.env.QA_RUN_ID ?? Date.now()}-`;

/** Non-guessable password for throwaway QA auth users. Never logged. */
export function throwawayPassword(): string {
  return `Qa!${crypto.randomUUID()}`;
}
