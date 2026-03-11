import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";
import { TopNav } from "@/components/layout/TopNav";

export const metadata = { title: "Licensing — Lakindu Jayathilaka" };

export default function LicensingPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-ink">
          <TextReveal>Licensing</TextReveal>
        </h1>
        <p className="mt-6 text-base font-medium leading-[var(--leading-body)] text-ink-muted">
          This recreation is a local visual clone of the Cohesion Framer
          template by UIhub.design for personal / portfolio use. The original
          template is a commercial product — purchase a license from the author
          if you intend to publish or sell a site based on it.
        </p>
      </main>
      <Contact />
    </>
  );
}
