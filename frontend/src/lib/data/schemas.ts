import { z } from "zod";
import { LOGO_OFFSET, LOGO_SCALE } from "@/lib/data/logo-fit";
import { ICON_MODES, ORBIT_RINGS } from "@/lib/data/types";

/**
 * Server-side validation for every mutation. Server Actions are reachable by
 * direct POST, so nothing is trusted until it has been through one of these.
 */

const trimmed = z.string().trim();

/** An `/images/...` path, a Supabase storage URL, or any other https asset. */
export const assetPath = trimmed
  .min(1, "An image is required")
  .max(2048)
  .refine(
    (value) => value.startsWith("/") || /^https:\/\//i.test(value),
    "Use a site-relative path or an https URL",
  );

export const optionalAssetPath = z.union([assetPath, z.literal("")]);

/** External destinations must be absolute http(s) — never javascript: or data:. */
export const externalUrl = trimmed
  .max(2048)
  .refine(
    (value) => value === "" || /^https?:\/\/[^\s]+\.[^\s]+/i.test(value),
    "Enter a full URL starting with http:// or https://",
  );

export const slugSchema = trimmed
  .min(1, "A slug is required")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens",
  );

const hexColour = trimmed.regex(
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
  "Use a hex colour such as #6670FF",
);

export const stackTechInput = z
  .object({
    name: trimmed.min(1, "A name is required").max(80),
    brandKey: trimmed
      .min(1, "A brand key is required")
      .max(48)
      .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
    logoPath: assetPath,
    ring: z.enum(ORBIT_RINGS),
    enabled: z.boolean(),
    nodeBackground: z.union([hexColour, z.literal("")]).nullable(),
    iconMode: z.enum(ICON_MODES),
    manualAngle: z.boolean(),
    angle: z.number().min(0).max(360).nullable(),
    // Display-only framing. The bounds mirror the database check constraints
    // in `0005_stack_logo_fit.sql`, so anything the form accepts here is
    // storable and anything Postgres would refuse is caught as a field error.
    logoScale: z
      .number()
      .min(LOGO_SCALE.min, "Zoom is between 50% and 400%")
      .max(LOGO_SCALE.max, "Zoom is between 50% and 400%"),
    logoOffsetX: z
      .number()
      .min(LOGO_OFFSET.min, "Horizontal position is between -100 and 100")
      .max(LOGO_OFFSET.max, "Horizontal position is between -100 and 100"),
    logoOffsetY: z
      .number()
      .min(LOGO_OFFSET.min, "Vertical position is between -100 and 100")
      .max(LOGO_OFFSET.max, "Vertical position is between -100 and 100"),
  })
  .refine(
    (value) => !value.manualAngle || value.angle !== null,
    { path: ["angle"], message: "Set an angle or turn manual placement off" },
  );

export type StackTechInput = z.infer<typeof stackTechInput>;

export const reorderInput = z.object({
  ring: z.enum(ORBIT_RINGS).optional(),
  ids: z.array(z.string().min(1)).min(1),
});

export const projectSectionInput = z.object({
  heading: trimmed.min(1, "Section heading is required").max(160),
  body: trimmed.min(1, "Section body is required").max(4000),
});

export const projectInput = z.object({
  title: trimmed.min(1, "A title is required").max(200),
  slug: slugSchema,
  tag: trimmed.min(1, "A category is required").max(80),
  image: assetPath,
  gallery: z.array(assetPath).max(12, "Up to 12 gallery images"),
  client: trimmed.max(120),
  duration: trimmed.max(80),
  previewUrl: externalUrl,
  templateLabel: trimmed.max(80),
  templateUrl: externalUrl,
  intro: trimmed.max(4000),
  approach: trimmed.max(4000),
  sections: z.array(projectSectionInput).max(12, "Up to 12 sections"),
  features: trimmed.max(4000),
  a11yNotes: trimmed.max(4000),
  conclusion: trimmed.max(4000),
  published: z.boolean(),
  showOnHomepage: z.boolean(),
});

export type ProjectInput = z.infer<typeof projectInput>;

export const credentialsInput = z.object({
  email: z.email("Enter a valid email").trim().min(1, "Email is required"),
  password: z.string().min(8, "Passwords are at least 8 characters"),
});

/** Slugify a title the same way on the client preview and the server. */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 120)
      // Trimmed after the slice, so a cut that lands on a separator does not
      // leave a trailing hyphen that `slugSchema` would then reject.
      .replace(/^-+|-+$/g, "")
  );
}

/** Flatten a ZodError into `{ field: message }` for the form UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
