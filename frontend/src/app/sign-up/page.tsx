"use client";

import { useState } from "react";
import Link from "next/link";
import { Contact } from "@/components/layout/Contact";
import { TextReveal } from "@/components/effects/TextReveal";

const RULES = [
  { id: "len", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "upper", label: "At least one uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", label: "At least one lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "digit", label: "At least one digit", test: (v: string) => /\d/.test(v) },
  { id: "special", label: "At least one special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export default function SignUpPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

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

      <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 pt-28 pb-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/svc-sphere-orange.png" alt="" className="pointer-events-none absolute left-[6%] top-[18%] w-[220px] select-none" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/svc-heart-yellow.png" alt="" className="pointer-events-none absolute right-[8%] top-[16%] w-[220px] select-none" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/svc-circle-purple.png" alt="" className="pointer-events-none absolute bottom-[8%] right-[12%] w-[220px] select-none" aria-hidden />

        <h1 className="relative z-10 text-center text-[length:var(--type-display)] font-semibold leading-[var(--leading-display)] tracking-[var(--tracking-display)] text-ink">
          <TextReveal>Sign up</TextReveal>
        </h1>
        <p className="relative z-10 mt-2 text-base font-medium leading-[var(--leading-body)] text-ink-muted">Hey, welcome! 👋</p>

        <form
          className="relative z-10 mt-8 w-full max-w-[420px] space-y-3"
          onSubmit={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-indigo/40 text-sm font-medium text-ink"
          >
            <span className="text-base">G</span> Sign Up with Google
          </button>
          <input
            type="text"
            placeholder="Name"
            className="h-12 w-full rounded-card border border-black/10 px-4 text-base text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo"
          />
          <input
            type="email"
            placeholder="Email"
            className="h-12 w-full rounded-card border border-black/10 px-4 text-base text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo"
          />
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-card border border-black/10 px-4 pr-12 text-base text-ink outline-none placeholder:text-ink-muted/70 focus:border-indigo"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-label="Toggle password visibility"
            >
              {show ? "🙈" : "👁"}
            </button>
          </div>
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-card bg-indigo text-base font-medium text-white"
          >
            Sign Up
          </button>
          <ul className="space-y-1 pt-2 text-sm text-ink-muted">
            {RULES.map((r) => {
              const ok = r.test(password);
              return (
                <li key={r.id} className={ok ? "text-green" : ""}>
                  {ok ? "✓" : "✕"} {r.label}
                </li>
              );
            })}
          </ul>
          <p className="pt-3 text-center text-sm text-ink-muted">
            Already have an account yet?{" "}
            <Link href="/sign-in" className="text-indigo underline">
              Sign in
            </Link>
          </p>
        </form>
      </main>
      <Contact />
    </>
  );
}
