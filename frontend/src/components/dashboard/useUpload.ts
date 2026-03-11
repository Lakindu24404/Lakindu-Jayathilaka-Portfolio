"use client";

import { useCallback, useRef, useState } from "react";
import { checkFile, type UploadKind } from "@/lib/uploads";

type UploadState = {
  uploading: boolean;
  /** 0-100, from the browser's own upload progress events. */
  progress: number;
  error: string | null;
};

const IDLE: UploadState = { uploading: false, progress: 0, error: null };

/**
 * Upload one file to `/api/dashboard/upload` with progress.
 *
 * XHR rather than `fetch` because only XHR exposes upload progress events.
 * The route handler re-runs every check, so the local `checkFile` here is a
 * convenience, not a gate.
 */
export function useUpload(kind: UploadKind) {
  const [state, setState] = useState<UploadState>(IDLE);
  const request = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => setState(IDLE), []);

  const upload = useCallback(
    (file: File): Promise<string | null> => {
      const localProblem = checkFile(kind, file);
      if (localProblem) {
        setState({ uploading: false, progress: 0, error: localProblem });
        return Promise.resolve(null);
      }

      setState({ uploading: true, progress: 0, error: null });

      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        request.current = xhr;

        const body = new FormData();
        body.set("kind", kind);
        body.set("file", file);

        xhr.upload.addEventListener("progress", (event) => {
          if (!event.lengthComputable) return;
          setState((current) => ({
            ...current,
            progress: Math.round((event.loaded / event.total) * 100),
          }));
        });

        xhr.addEventListener("load", () => {
          request.current = null;
          let payload: { url?: string; error?: string } = {};
          try {
            payload = JSON.parse(xhr.responseText);
          } catch {
            payload = {};
          }

          if (xhr.status >= 200 && xhr.status < 300 && payload.url) {
            setState({ uploading: false, progress: 100, error: null });
            resolve(payload.url);
          } else {
            setState({
              uploading: false,
              progress: 0,
              error: payload.error ?? "The upload failed. Try again.",
            });
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          request.current = null;
          setState({
            uploading: false,
            progress: 0,
            error: "The upload failed. Check your connection and try again.",
          });
          resolve(null);
        });

        xhr.addEventListener("abort", () => {
          request.current = null;
          setState(IDLE);
          resolve(null);
        });

        xhr.open("POST", "/api/dashboard/upload");
        xhr.send(body);
      });
    },
    [kind],
  );

  const cancel = useCallback(() => request.current?.abort(), []);

  return { ...state, upload, cancel, reset };
}
