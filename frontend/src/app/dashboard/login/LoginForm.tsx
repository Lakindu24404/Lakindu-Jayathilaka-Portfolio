"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type ActionResult } from "@/app/dashboard/actions";
import { TextField } from "@/components/dashboard/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="dashButton dashButtonPrimary"
      style={{ width: "100%" }}
      disabled={pending}
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<
    ActionResult<undefined> | null,
    FormData
  >(signIn, null);

  const errors = state && !state.ok ? state.errors : undefined;

  return (
    <form action={formAction} style={{ display: "grid", gap: 14 }} noValidate>
      <input type="hidden" name="next" value={next ?? ""} />

      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        required
        error={errors?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errors?.password}
      />

      {state && !state.ok ? (
        <p className="dashNotice dashNoticeError" role="alert">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
