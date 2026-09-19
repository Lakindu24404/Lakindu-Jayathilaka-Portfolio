import { readdirSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import type { NextConfig } from "next";

const PRIVATE_IPV4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * This machine's own private network addresses. The dev server only trusts
 * `localhost` by default, so opening `npm run dev` on a phone over Wi-Fi
 * (http://192.168.x.x:3000) served the page but blocked the dev resources it
 * needs to hydrate — no lava, no reveals, no animation at all. Allowing just
 * this machine's LAN addresses fixes on-device testing; production builds
 * never read this option.
 */
function lanDevOrigins() {
  return Object.values(networkInterfaces())
    .flat()
    .filter(
      (net) =>
        net !== undefined &&
        net.family === "IPv4" &&
        !net.internal &&
        PRIVATE_IPV4.test(net.address),
    )
    .map((net) => net!.address);
}

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

/**
 * Keep project rows saved before the bundled PNGs were converted working.
 * The rewrite list is derived from the files that actually exist, so the two
 * PNGs that were already smaller than lossless WebP remain untouched.
 */
function legacyBundledImageRewrites() {
  try {
    return readdirSync(join(process.cwd(), "public", "images"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
      .map((entry) => ({
        source: `/images/${entry.name.replace(/\.webp$/, ".png")}`,
        destination: `/images/${entry.name}`,
      }));
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  async rewrites() {
    return legacyBundledImageRewrites();
  },
  images: {
    remotePatterns: supabaseImagePattern(),
    // 85 is for project screenshots, whose small UI type shows artefacts at
    // the default 75 (see ProjectCard).
    qualities: [75, 85],
  },
};

export default nextConfig;
