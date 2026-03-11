import type { Metadata } from "next";
import { Geist, Inter, PT_Serif } from "next/font/google";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { SplashScreen } from "@/components/layout/SplashScreen";
import "./globals.css";

/** Folira's single-family system: Geist, self-hosted by Next with no layout shift. */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

/**
 * Scoped to the splash screen, which reproduces Fabrica®'s preloader down to
 * its Inter SemiBold wordmark. `block` keeps the fallback face from flashing
 * through the middle of a 2.4s animation the visitor cannot replay.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: "600",
  display: "block",
});

/** The one intentional serif accent in the system: the Stack heading word. */
const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: "700",
  style: "italic",
});

/**
 * Absolute URLs for the project case studies' Open Graph images. Vercel sets
 * VERCEL_PROJECT_PRODUCTION_URL for us; NEXT_PUBLIC_SITE_URL overrides it for a
 * custom domain, and localhost keeps development quiet.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Lakindu Jayathilaka | Web Developer",
  description:
    "Portfolio of Lakindu Jayathilaka — web development, backend engineering, and digital experiences.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${inter.variable} ${ptSerif.variable} ${geist.className} antialiased`}
    >
      <body className="bg-white text-ink-muted">
        <SplashScreen />
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
