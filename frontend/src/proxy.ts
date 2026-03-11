import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Keeps the Supabase session cookie fresh and turns unauthenticated dashboard
 * requests away before a page renders.
 *
 * This is a convenience, not the security boundary: the real checks are
 * `requireAdmin()` inside every dashboard page and Server Action, plus the RLS
 * policies in Postgres. Renamed from `middleware` per Next.js 16.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const result = readSupabaseConfig();
  // Without configuration there is no session to refresh; the dashboard
  // renders its own setup screen instead of redirecting into a loop.
  if (!result.ok) return response;

  const supabase = createServerClient(
    result.config.url,
    result.config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/dashboard/login";

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/login";
    url.search = "";
    if (pathname !== "/dashboard") {
      url.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(url);
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Only the dashboard. The public portfolio never pays for this.
  matcher: ["/dashboard/:path*", "/dashboard"],
};
