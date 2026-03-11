"use client";

import Image from "next/image";
import { useId, useRef } from "react";
import { useUpload } from "@/components/dashboard/useUpload";
import { describeRule, type UploadKind } from "@/lib/uploads";

/**
 * A single image slot: upload a new file, or paste the path of an asset that
 * already lives in `/public/images`.
 */
export function ImageField({
  label,
  kind,
  value,
  onChange,
  hint,
  error,
  round = false,
}: {
  label: string;
  kind: UploadKind;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  round?: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, progress, error: uploadError } = useUpload(kind);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const url = await upload(file);
    if (url) onChange(url);
    if (fileRef.current) fileRef.current.value = "";
  }

  const problem = error ?? uploadError ?? undefined;

  return (
    <div className="dashField">
      <label className="dashLabel" htmlFor={inputId}>
        {label}
      </label>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className={round ? "dashLogoThumb" : "dashThumb"} aria-hidden="true">
          {value ? (
            round ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" />
            ) : (
              <Image src={value} alt="" fill sizes="56px" unoptimized />
            )
          ) : null}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
          <input
            id={inputId}
            className="dashInput"
            type="text"
            value={value}
            placeholder="/images/example.svg"
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`${inputId}-hint`}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="dashButton dashButtonSmall"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? `Uploading ${progress}%` : value ? "Replace" : "Upload"}
            </button>
            {value ? (
              <button
                type="button"
                className="dashButton dashButtonSmall dashButtonGhost"
                onClick={() => onChange("")}
                disabled={uploading}
              >
                Remove
              </button>
            ) : null}
          </div>

          {uploading ? (
            <div
              className="dashProgress"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Uploading ${label}`}
            >
              <div className="dashProgressBar" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          <p className="dashHint" id={`${inputId}-hint`}>
            {hint ?? `Upload ${describeRule(kind)}, or point at an existing /images path.`}
          </p>
          {problem ? <p className="dashError">{problem}</p> : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="dashSrOnly"
        tabIndex={-1}
        aria-hidden="true"
        accept="image/png,image/jpeg,image/webp,image/avif,image/svg+xml"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
