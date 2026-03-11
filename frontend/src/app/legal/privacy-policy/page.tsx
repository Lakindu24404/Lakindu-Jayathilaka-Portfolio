import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";
import { TopNav } from "@/components/layout/TopNav";

export const metadata = { title: "Privacy Policy — Lakindu Jayathilaka" };

export default function PrivacyPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-32">
        <h1 className="text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-ink">
          <TextReveal>Privacy Policy</TextReveal>
        </h1>
        <p className="mt-6 text-base font-medium leading-[var(--leading-body)] text-ink-muted">
          This demo site does not collect personal data. Any form submissions
          stay in your browser and are not sent to a server.
        </p>
      </main>
      <Contact />
    </>
  );
}
