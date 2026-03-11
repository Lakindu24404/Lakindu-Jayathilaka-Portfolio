import { STORAGE_BUCKETS } from "@/lib/supabase/config";

/**
 * Upload validation shared by the browser (fast feedback) and the route
 * handler (the decision that actually counts).
 */

export type UploadKind = "logo" | "project";

type Rule = {
  bucket: string;
  maxBytes: number;
  mimeTypes: string[];
  extensions: string[];
  label: string;
};

export const UPLOAD_RULES: Record<UploadKind, Rule> = {
  logo: {
    bucket: STORAGE_BUCKETS.stackLogos,
    maxBytes: 512_000,
    mimeTypes: ["image/svg+xml", "image/png", "image/webp"],
    extensions: ["svg", "png", "webp"],
    label: "SVG, PNG or WebP up to 500 KB",
  },
  project: {
    bucket: STORAGE_BUCKETS.projectImages,
    maxBytes: 5_242_880,
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/svg+xml",
    ],
    extensions: ["png", "jpg", "jpeg", "webp", "avif", "svg"],
    label: "PNG, JPEG, WebP, AVIF or SVG up to 5 MB",
  },
};

export function isUploadKind(value: unknown): value is UploadKind {
  return value === "logo" || value === "project";
}

export function describeRule(kind: UploadKind): string {
  return UPLOAD_RULES[kind].label;
}

/** Quick client-side gate. The route handler repeats and extends this. */
export function checkFile(kind: UploadKind, file: File): string | null {
  const rule = UPLOAD_RULES[kind];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!rule.extensions.includes(extension)) {
    return `Unsupported file type. Accepted: ${rule.label}.`;
  }
  if (file.type && !rule.mimeTypes.includes(file.type)) {
    return `Unsupported file type. Accepted: ${rule.label}.`;
  }
  if (file.size > rule.maxBytes) {
    return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(rule.maxBytes)}.`;
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Magic-byte sniffing, so a `.png` that is really something else is rejected
 * regardless of the extension or the declared content type.
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  const startsWith = (...signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return "image/png";
  }
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";

  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));

  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && ascii(8, 4).startsWith("avi")) {
    return "image/avif";
  }
  return null;
}

const SVG_FORBIDDEN: Array<[RegExp, string]> = [
  [/<\s*script/i, "an inline <script>"],
  [/<\s*foreignObject/i, "a <foreignObject> element"],
  [/<\s*!ENTITY/i, "an XML entity declaration"],
  [/\son[a-z]+\s*=/i, "an inline event handler"],
  [/javascript\s*:/i, "a javascript: URL"],
  [/<\s*(iframe|embed|object|use\s[^>]*href\s*=\s*["']https?)/i, "an external reference"],
];

/**
 * Validate an SVG before it is stored.
 *
 * Uploads are already limited to administrators, but an SVG served from the
 * portfolio's own asset host should not be able to carry script, so anything
 * active is refused rather than quietly stripped.
 */
export function validateSvg(source: string): string | null {
  const text = source.trim();

  if (!/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(text)) {
    return "That file does not look like an SVG.";
  }
  for (const [pattern, description] of SVG_FORBIDDEN) {
    if (pattern.test(text)) {
      return `That SVG contains ${description}, which is not allowed.`;
    }
  }
  return null;
}

/** A collision-proof, path-traversal-proof object name. */
export function safeObjectName(originalName: string): string {
  const extension =
    originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ??
    "bin";

  const stem = originalName
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "asset";

  const unique = crypto.randomUUID().slice(0, 8);
  return `${stem}-${unique}.${extension}`;
}
