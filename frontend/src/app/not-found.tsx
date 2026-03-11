import Link from "next/link";
import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";
import { TopNav } from "@/components/layout/TopNav";

export default function NotFound() {
  return (
    <>
      <TopNav />
      <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 pt-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/star-teal.png"
          alt=""
          className="pointer-events-none absolute right-[10%] top-[20%] w-[240px] select-none"
          aria-hidden
        />
        <p className="text-[clamp(80px,12vw,160px)] font-semibold leading-none tracking-[var(--tracking-display)] text-ink">
          404
        </p>
        <h1 className="mt-4 text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] text-ink">
          <TextReveal>Page not found</TextReveal>
        </h1>
        <p className="mt-3 text-base font-medium leading-[var(--leading-body)] text-ink-muted">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-10 flex h-[72px] items-center rounded-pill bg-surface-hover px-12 text-2xl font-semibold text-ink"
        >
          Back home
        </Link>
      </main>
      <Contact />
    </>
  );
}
