"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type SelectHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/** Small, shared building blocks for the dashboard forms. */

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
};

export function Field({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="dashField">
      <label className="dashLabel" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p className="dashHint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="dashError" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "className"
> & { label: string; hint?: string; error?: string };

export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          id={id}
          className="dashInput"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

type TextAreaFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "id" | "className"
> & { label: string; hint?: string; error?: string };

export function TextAreaField({
  label,
  hint,
  error,
  ...rest
}: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          id={id}
          className="dashTextarea"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        />
      )}
    </Field>
  );
}

type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "id" | "className"
> & { label: string; hint?: string; error?: string; children: ReactNode };

export function SelectField({
  label,
  hint,
  error,
  children,
  ...rest
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select
          {...rest}
          id={id}
          className="dashSelect"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
        >
          {children}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="dashCheckbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="dashCheckboxText">
        <strong>{label}</strong>
        {hint ? <span className="dashHint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function DragHandleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="currentColor"
    >
      <circle cx="6" cy="3" r="1.3" />
      <circle cx="10" cy="3" r="1.3" />
      <circle cx="6" cy="8" r="1.3" />
      <circle cx="10" cy="8" r="1.3" />
      <circle cx="6" cy="13" r="1.3" />
      <circle cx="10" cy="13" r="1.3" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="dashEmpty">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

/**
 * A confirmation step in front of anything destructive, using the native
 * `<dialog>` so focus trapping and Escape come from the platform.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dashDialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="dashDialogActions">
        <button
          type="button"
          className="dashButton dashButtonGhost"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="dashButton dashButtonPrimary"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

/**
 * Warn before a browser navigation or reload discards unsaved edits.
 *
 * In-app navigation is handled where it is initiated (the editor intercepts its
 * own links), because the App Router gives no cancellable navigation event.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
