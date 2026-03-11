/**
 * Validation for the `?next=` parameter carried through the login page.
 *
 * `value.startsWith("/dashboard")` is not enough on its own: the value is
 * attacker-controlled and un-normalised, so `/dashboard/../../../elsewhere`
 * passes the prefix test and then normalises to `/elsewhere` in the browser,
 * and `/dashboard-evil` passes a check that reads as "a dashboard route".
 *
 * Resolving against a throwaway origin normalises `..` and `.` segments first
 * and rejects anything carrying its own scheme or authority, so the decision is
 * made on the path the browser will actually visit.
 */

const DASHBOARD_ROOT = "/dashboard";

/** A dummy origin; only the resolved path is ever read back out. */
const RESOLUTION_BASE = "http://redirect.invalid";

export function safeDashboardPath(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string" || value === "") return null;

  // A backslash is treated as a path separator by browsers, so normalise it
  // before parsing rather than letting `//` slip through as an authority.
  const candidate = value.replace(/\\/g, "/");

  // Must be a site-relative path, and must not begin an authority ("//host").
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;

  let url: URL;
  try {
    url = new URL(candidate, RESOLUTION_BASE);
  } catch {
    return null;
  }

  // `new URL` would have resolved an absolute input against its own origin.
  if (url.origin !== RESOLUTION_BASE) return null;

  const { pathname } = url;
  const insideDashboard =
    pathname === DASHBOARD_ROOT || pathname.startsWith(`${DASHBOARD_ROOT}/`);
  if (!insideDashboard) return null;

  // The login page itself is not a useful destination.
  if (pathname === `${DASHBOARD_ROOT}/login`) return null;

  return `${pathname}${url.search}`;
}
