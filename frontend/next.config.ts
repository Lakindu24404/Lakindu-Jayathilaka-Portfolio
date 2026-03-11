import type { NextConfig } from "next";

/**
 * Supabase Storage serves uploaded logos and project imagery, so its host has
 * to be allow-listed for `next/image`. The pattern is derived from the
 * configured project URL rather than hard-coded, and simply omitted when the
 * project is running on bundled content only.
 */
function supabaseImagePattern() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return [];

  try {
    const { hostname } = new URL(url);
    return [
      {
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseImagePattern(),
  },
};

export default nextConfig;
