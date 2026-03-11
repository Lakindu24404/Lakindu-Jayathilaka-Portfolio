import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROJECT_COLUMNS,
  STACK_COLUMNS,
  toProject,
  toStackTech,
  type ProjectRow,
  type StackTechRow,
} from "@/lib/data/mappers";

const stackRow: StackTechRow = {
  id: "1",
  name: "HTML",
  brand_key: "html",
  logo_path: "/images/stack-html5.svg",
  ring: "outer",
  display_order: 3,
  enabled: true,
  node_background: null,
  icon_mode: "original",
  manual_angle: false,
  angle: null,
  logo_scale: 1,
  logo_offset_x: 0,
  logo_offset_y: 0,
  updated_at: "2026-01-01T00:00:00Z",
};

const projectRow: ProjectRow = {
  id: "1",
  slug: "example",
  title: "Example",
  tag: "Web Design",
  image: "/images/a.png",
  gallery: ["/images/a.png", "/images/b.png"],
  client: "ACME",
  duration: "4 weeks",
  preview_url: "https://example.com",
  template_label: "Get Template",
  template_url: "https://example.com/buy",
  intro: "intro",
  approach: "approach",
  sections: [{ heading: "h", body: "b" }],
  features: "features",
  a11y_notes: "a11y",
  conclusion: "conclusion",
  published: true,
  show_on_homepage: true,
  display_order: 2,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("toStackTech", () => {
  it("maps every snake_case column onto the domain type", () => {
    assert.deepEqual(toStackTech(stackRow), {
      id: "1",
      name: "HTML",
      brandKey: "html",
      logoPath: "/images/stack-html5.svg",
      ring: "outer",
      displayOrder: 3,
      enabled: true,
      nodeBackground: null,
      iconMode: "original",
      manualAngle: false,
      angle: null,
      logoScale: 1,
      logoOffsetX: 0,
      logoOffsetY: 0,
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("coerces PostgREST's numeric-as-string angle to a number", () => {
    // `numeric` columns come back as strings over the REST API.
    const mapped = toStackTech({ ...stackRow, angle: "225.00" });
    assert.equal(mapped.angle, 225);
    assert.equal(typeof mapped.angle, "number");
  });

  it("coerces PostgREST's numeric-as-string logo fit to numbers", () => {
    // `numeric(4, 2)` and `numeric(5, 2)` also come back as strings.
    const mapped = toStackTech({
      ...stackRow,
      logo_scale: "1.75",
      logo_offset_x: "-12.00",
      logo_offset_y: "8.00",
    });
    assert.equal(mapped.logoScale, 1.75);
    assert.equal(mapped.logoOffsetX, -12);
    assert.equal(mapped.logoOffsetY, 8);
    for (const value of [
      mapped.logoScale,
      mapped.logoOffsetX,
      mapped.logoOffsetY,
    ]) {
      assert.equal(typeof value, "number");
    }
  });

  it("centres a legacy row that predates the logo fit columns", () => {
    // A database that has not run `0005_stack_logo_fit.sql` simply has no such
    // columns, so PostgREST omits them entirely.
    const legacy = { ...stackRow } as Record<string, unknown>;
    delete legacy.logo_scale;
    delete legacy.logo_offset_x;
    delete legacy.logo_offset_y;

    const mapped = toStackTech(legacy as StackTechRow);
    assert.equal(mapped.logoScale, 1);
    assert.equal(mapped.logoOffsetX, 0);
    assert.equal(mapped.logoOffsetY, 0);
  });

  it("falls back to the centred default for null or unparseable fit values", () => {
    const nulls = toStackTech({
      ...stackRow,
      logo_scale: null,
      logo_offset_x: null,
      logo_offset_y: null,
    });
    assert.deepEqual(
      [nulls.logoScale, nulls.logoOffsetX, nulls.logoOffsetY],
      [1, 0, 0],
    );

    const junk = toStackTech({
      ...stackRow,
      logo_scale: "not a number",
      logo_offset_x: "",
      logo_offset_y: "NaN",
    });
    assert.deepEqual(
      [junk.logoScale, junk.logoOffsetX, junk.logoOffsetY],
      [1, 0, 0],
    );
  });

  it("clamps a fit value that is outside the stored range", () => {
    const low = toStackTech({
      ...stackRow,
      logo_scale: "0.1",
      logo_offset_x: "-500",
      logo_offset_y: "-500",
    });
    assert.deepEqual(
      [low.logoScale, low.logoOffsetX, low.logoOffsetY],
      [0.5, -100, -100],
    );

    const high = toStackTech({
      ...stackRow,
      logo_scale: "9",
      logo_offset_x: "500",
      logo_offset_y: "500",
    });
    assert.deepEqual(
      [high.logoScale, high.logoOffsetX, high.logoOffsetY],
      [4, 100, 100],
    );
  });

  it("falls back to a safe ring and icon mode for unknown values", () => {
    const mapped = toStackTech({
      ...stackRow,
      ring: "equator",
      icon_mode: "neon",
    });
    assert.equal(mapped.ring, "outer");
    assert.equal(mapped.iconMode, "original");
  });
});

describe("toProject", () => {
  it("maps every snake_case column onto the domain type", () => {
    const mapped = toProject(projectRow);
    assert.equal(mapped.a11yNotes, "a11y");
    assert.equal(mapped.previewUrl, "https://example.com");
    assert.equal(mapped.templateUrl, "https://example.com/buy");
    assert.equal(mapped.showOnHomepage, true);
    assert.deepEqual(mapped.gallery, ["/images/a.png", "/images/b.png"]);
    assert.deepEqual(mapped.sections, [{ heading: "h", body: "b" }]);
  });

  it("discards non-string gallery entries rather than rendering undefined", () => {
    const mapped = toProject({
      ...projectRow,
      gallery: ["/images/a.png", 42, null, { url: "x" }],
    });
    assert.deepEqual(mapped.gallery, ["/images/a.png"]);
  });

  it("discards malformed sections", () => {
    const mapped = toProject({
      ...projectRow,
      sections: [
        { heading: "ok", body: "ok" },
        { heading: "missing body" },
        "not an object",
        null,
      ],
    });
    assert.deepEqual(mapped.sections, [{ heading: "ok", body: "ok" }]);
  });

  it("tolerates a null or non-array jsonb column", () => {
    const mapped = toProject({ ...projectRow, gallery: null, sections: null });
    assert.deepEqual(mapped.gallery, []);
    assert.deepEqual(mapped.sections, []);
  });
});

/**
 * The public read path asks PostgREST for an explicit column list. If a column
 * is missing from it the mapper silently produces `undefined`, so the lists are
 * checked against the mapper's own output shape.
 */
describe("column lists cover every mapped field", () => {
  it("STACK_COLUMNS selects everything toStackTech reads", () => {
    const selected = new Set(STACK_COLUMNS.split(","));
    for (const column of Object.keys(stackRow)) {
      assert.ok(selected.has(column), `STACK_COLUMNS is missing "${column}"`);
    }
  });

  it("PROJECT_COLUMNS selects everything toProject reads", () => {
    const selected = new Set(PROJECT_COLUMNS.split(","));
    for (const column of Object.keys(projectRow)) {
      assert.ok(selected.has(column), `PROJECT_COLUMNS is missing "${column}"`);
    }
  });
});
