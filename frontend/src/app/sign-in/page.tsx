"use client";

import Link from "next/link";
import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";

export default function SignInPage() {
  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 pt-6 sm:px-10">
        <Link
          href="/"
          className="flex h-12 items-center gap-2 rounded-[24px] bg-white px-5 text-sm font-medium text-ink-muted shadow-[0_5px_20px_rgb(0_0_0/0.05)] hover:text-ink"
        >
          ← Back
        </Link>
        <Link
          href="/sign-up"
          className="flex h-12 items-center rounded-[24px] bg-white px-5 text-sm font-medium text-ink-muted shadow-[0_5px_20px_rgb(0_0_0/0.05)]"
        >
          Sign Up
        </Link>
      </header>
      <main className="relative flex min-h-svh flex-col items-center justify-center px-6 pt-28 pb-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/svc-sphere-orange.png" alt="" className="pointer-events-none absolute left-[6%] top-[18%] w-[220px] select-none" aria-hidden />
        <h1 className="text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-ink">
          <TextReveal>Sign in</TextReveal>
        </h1>
        <p className="mt-2 text-base font-medium leading-[var(--leading-body)] text-ink-muted">Welcome back.</p>
        <form className="mt-8 w-full max-w-[420px] space-y-3" onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Email" className="h-12 w-full rounded-card border border-black/10 px-4 text-base outline-none focus:border-indigo" />
          <input type="password" placeholder="Password" className="h-12 w-full rounded-card border border-black/10 px-4 text-base outline-none focus:border-indigo" />
          <button type="submit" className="flex h-12 w-full items-center justify-center rounded-card bg-indigo text-base font-medium text-white">
            Sign in
          </button>
          <p className="pt-3 text-center text-sm text-ink-muted">
            No account?{" "}
            <Link href="/sign-up" className="text-indigo underline">
              Sign up
            </Link>
          </p>
        </form>
      </main>
      <Contact />
    </>
  );
}
