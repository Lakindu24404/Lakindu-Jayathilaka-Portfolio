import {
  clampLogoOffset,
  clampLogoScale,
  LOGO_OFFSET,
  LOGO_SCALE,
  readLogoFitValue,
} from "@/lib/data/logo-fit";
import type {
  IconMode,
  OrbitRing,
  ProjectRecord,
  ProjectSection,
  StackTechRecord,
} from "@/lib/data/types";
import { ICON_MODES, ORBIT_RINGS } from "@/lib/data/types";

/** Database row shapes, snake_case as PostgREST returns them. */
export type StackTechRow = {
  id: string;
  name: string;
  brand_key: string;
  logo_path: string;
  ring: string;
  display_order: number;
  enabled: boolean;
  node_background: string | null;
  icon_mode: string;
  manual_angle: boolean;
  angle: number | string | null;
  // `numeric` columns arrive as strings over PostgREST, and are absent
  // altogether on a database that has not run `0005_stack_logo_fit.sql`.
  logo_scale: number | string | null;
  logo_offset_x: number | string | null;
  logo_offset_y: number | string | null;
  updated_at: string | null;
};

export type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  tag: string;
  image: string;
  gallery: unknown;
  client: string;
  duration: string;
  preview_url: string;
  template_label: string;
  template_url: string;
  intro: string;
  approach: string;
  sections: unknown;
  features: string;
  a11y_notes: string;
  conclusion: string;
  published: boolean;
  show_on_homepage: boolean;
  display_order: number;
  updated_at: string | null;
};

function asRing(value: string): OrbitRing {
  return (ORBIT_RINGS as readonly string[]).includes(value)
    ? (value as OrbitRing)
    : "outer";
}

function asIconMode(value: string): IconMode {
  return (ICON_MODES as readonly string[]).includes(value)
    ? (value as IconMode)
    : "original";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asSections(value: unknown): ProjectSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { heading, body } = entry as Record<string, unknown>;
    if (typeof heading !== "string" || typeof body !== "string") return [];
    return [{ heading, body }];
  });
}

export function toStackTech(row: StackTechRow): StackTechRecord {
  return {
    id: row.id,
    name: row.name,
    brandKey: row.brand_key,
    logoPath: row.logo_path,
    ring: asRing(row.ring),
    displayOrder: row.display_order,
    enabled: row.enabled,
    nodeBackground: row.node_background,
    iconMode: asIconMode(row.icon_mode),
    manualAngle: row.manual_angle,
    angle: row.angle === null ? null : Number(row.angle),
    logoScale: readLogoFitValue(row.logo_scale, clampLogoScale, LOGO_SCALE.default),
    logoOffsetX: readLogoFitValue(
      row.logo_offset_x,
      clampLogoOffset,
      LOGO_OFFSET.default,
    ),
    logoOffsetY: readLogoFitValue(
      row.logo_offset_y,
      clampLogoOffset,
      LOGO_OFFSET.default,
    ),
    updatedAt: row.updated_at,
  };
}

export function toProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tag: row.tag,
    image: row.image,
    gallery: asStringArray(row.gallery),
    client: row.client,
    duration: row.duration,
    previewUrl: row.preview_url,
    templateLabel: row.template_label,
    templateUrl: row.template_url,
    intro: row.intro,
    approach: row.approach,
    sections: asSections(row.sections),
    features: row.features,
    a11yNotes: row.a11y_notes,
    conclusion: row.conclusion,
    published: row.published,
    showOnHomepage: row.show_on_homepage,
    displayOrder: row.display_order,
    updatedAt: row.updated_at,
  };
}

export const STACK_COLUMNS =
  "id,name,brand_key,logo_path,ring,display_order,enabled,node_background,icon_mode,manual_angle,angle,logo_scale,logo_offset_x,logo_offset_y,updated_at";

export const PROJECT_COLUMNS =
  "id,slug,title,tag,image,gallery,client,duration,preview_url,template_label,template_url,intro,approach,sections,features,a11y_notes,conclusion,published,show_on_homepage,display_order,updated_at";
