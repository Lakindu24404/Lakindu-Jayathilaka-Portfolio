import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";
import { TopNav } from "@/components/layout/TopNav";

export const metadata = { title: "Cookie Policy — Lakindu Jayathilaka" };

export default function CookiePage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-ink">
          <TextReveal>Cookie Policy</TextReveal>
        </h1>
        <p className="mt-6 text-base font-medium leading-[var(--leading-body)] text-ink-muted">
          This demo does not set tracking cookies. Only essential cookies that
          your browser may store for local development are used.
        </p>
      </main>
      <Contact />
    </>
  );
}
