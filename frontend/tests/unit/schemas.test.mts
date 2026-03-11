import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  externalUrl,
  fieldErrors,
  projectInput,
  slugSchema,
  slugify,
  stackTechInput,
} from "@/lib/data/schemas";

describe("slugify", () => {
  it("reproduces the seeded slugs from their titles", () => {
    assert.equal(
      slugify("Reelio - Photography & film studio Framer template"),
      "reelio-photography-film-studio-framer-template",
    );
    assert.equal(
      slugify("Kudos - Design Agency Website"),
      "kudos-design-agency-website",
    );
  });

  it("strips diacritics and punctuation", () => {
    assert.equal(slugify("  Café Déjà Vu!  "), "cafe-deja-vu");
  });

  it("never emits a slug the schema would then reject", () => {
    // A 120-character cut can land on a separator; the result must still pass.
    const awkward = `${"a".repeat(119)} bcd`;
    const slug = slugify(awkward);
    assert.ok(slug.length <= 120);
    assert.equal(slugSchema.safeParse(slug).success, true, slug);
  });

  it("yields an empty string for input with no slug characters", () => {
    assert.equal(slugify("---"), "");
    assert.equal(slugSchema.safeParse("").success, false);
  });
});

describe("externalUrl", () => {
  for (const good of [
    "",
    "https://example.com",
    "http://example.com/path?q=1",
    "https://buy.polar.sh/polar_cl_ABC",
  ]) {
    it(`accepts ${JSON.stringify(good)}`, () => {
      assert.equal(externalUrl.safeParse(good).success, true);
    });
  }

  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "example.com",
    "/relative",
    "ftp://example.com/x",
  ]) {
    it(`rejects ${JSON.stringify(bad)}`, () => {
      assert.equal(externalUrl.safeParse(bad).success, false);
    });
  }
});

describe("stackTechInput", () => {
  const base = {
    name: "Example",
    brandKey: "example",
    logoPath: "/images/stack-html5.svg",
    ring: "outer" as const,
    enabled: true,
    nodeBackground: null,
    iconMode: "original" as const,
    manualAngle: false,
    angle: null,
    logoScale: 1,
    logoOffsetX: 0,
    logoOffsetY: 0,
  };

  it("accepts a valid node", () => {
    assert.equal(stackTechInput.safeParse(base).success, true);
  });

  it("accepts the centred default and both ends of every fit range", () => {
    for (const fit of [
      { logoScale: 1, logoOffsetX: 0, logoOffsetY: 0 },
      { logoScale: 0.5, logoOffsetX: -100, logoOffsetY: -100 },
      { logoScale: 4, logoOffsetX: 100, logoOffsetY: 100 },
      { logoScale: 2.35, logoOffsetX: 37, logoOffsetY: -8 },
    ]) {
      assert.equal(
        stackTechInput.safeParse({ ...base, ...fit }).success,
        true,
        JSON.stringify(fit),
      );
    }
  });

  it("rejects a zoom outside 0.5 - 4", () => {
    for (const logoScale of [0.49, 0, -1, 4.01, 10]) {
      const result = stackTechInput.safeParse({ ...base, logoScale });
      assert.equal(result.success, false, `logoScale ${logoScale}`);
      if (!result.success) {
        assert.ok("logoScale" in fieldErrors(result.error));
      }
    }
  });

  it("rejects an offset outside -100 - 100", () => {
    for (const offset of [-101, 101, 1000]) {
      for (const field of ["logoOffsetX", "logoOffsetY"] as const) {
        const result = stackTechInput.safeParse({ ...base, [field]: offset });
        assert.equal(result.success, false, `${field} ${offset}`);
        if (!result.success) {
          assert.ok(field in fieldErrors(result.error));
        }
      }
    }
  });

  it("rejects a fit value that is not a number at all", () => {
    for (const field of ["logoScale", "logoOffsetX", "logoOffsetY"] as const) {
      // `readStackForm` leaves an unparseable form field as NaN precisely so
      // it surfaces here as a field error rather than being silently dropped.
      assert.equal(
        stackTechInput.safeParse({ ...base, [field]: Number.NaN }).success,
        false,
        field,
      );
      assert.equal(
        stackTechInput.safeParse({ ...base, [field]: "1" }).success,
        false,
        `${field} as a string`,
      );
    }
  });

  it("rejects an unknown ring", () => {
    assert.equal(
      stackTechInput.safeParse({ ...base, ring: "equator" }).success,
      false,
    );
  });

  it("rejects an unknown icon mode", () => {
    assert.equal(
      stackTechInput.safeParse({ ...base, iconMode: "neon" }).success,
      false,
    );
  });

  it("rejects a manual angle with no value", () => {
    const result = stackTechInput.safeParse({
      ...base,
      manualAngle: true,
      angle: null,
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(fieldErrors(result.error).angle !== undefined, true);
    }
  });

  it("rejects an out-of-range angle", () => {
    for (const angle of [-1, 361]) {
      assert.equal(
        stackTechInput.safeParse({ ...base, manualAngle: true, angle }).success,
        false,
        `angle ${angle}`,
      );
    }
  });

  it("rejects a brand key with uppercase or spaces", () => {
    for (const brandKey of ["Example", "two words", "semi;colon"]) {
      assert.equal(
        stackTechInput.safeParse({ ...base, brandKey }).success,
        false,
        brandKey,
      );
    }
  });

  it("rejects a non-hex node background", () => {
    assert.equal(
      stackTechInput.safeParse({ ...base, nodeBackground: "red" }).success,
      false,
    );
    assert.equal(
      stackTechInput.safeParse({ ...base, nodeBackground: "#6670FF" }).success,
      true,
    );
  });

  it("rejects a logo path that is neither site-relative nor https", () => {
    for (const logoPath of ["javascript:x", "images/x.svg", "http://x/y.svg"]) {
      assert.equal(
        stackTechInput.safeParse({ ...base, logoPath }).success,
        false,
        logoPath,
      );
    }
  });
});

describe("projectInput", () => {
  const base = {
    title: "Example",
    slug: "example",
    tag: "Web Design",
    image: "/images/project-bambinoo.png",
    gallery: [],
    client: "",
    duration: "",
    previewUrl: "",
    templateLabel: "",
    templateUrl: "",
    intro: "",
    approach: "",
    sections: [],
    features: "",
    a11yNotes: "",
    conclusion: "",
    published: false,
    showOnHomepage: true,
  };

  it("accepts a minimal draft", () => {
    assert.equal(projectInput.safeParse(base).success, true);
  });

  it("rejects an uppercase or spaced slug", () => {
    for (const slug of ["Example", "two words", "trailing-"]) {
      assert.equal(
        projectInput.safeParse({ ...base, slug }).success,
        false,
        slug,
      );
    }
  });

  it("caps the gallery at twelve images", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `/images/g${i}.png`);
    assert.equal(
      projectInput.safeParse({ ...base, gallery: twelve }).success,
      true,
    );
    assert.equal(
      projectInput.safeParse({
        ...base,
        gallery: [...twelve, "/images/g12.png"],
      }).success,
      false,
    );
  });

  it("caps the content sections at twelve", () => {
    const section = { heading: "h", body: "b" };
    assert.equal(
      projectInput.safeParse({
        ...base,
        sections: Array.from({ length: 13 }, () => section),
      }).success,
      false,
    );
  });

  it("rejects a section with an empty heading or body", () => {
    assert.equal(
      projectInput.safeParse({
        ...base,
        sections: [{ heading: "", body: "b" }],
      }).success,
      false,
    );
    assert.equal(
      projectInput.safeParse({
        ...base,
        sections: [{ heading: "h", body: "  " }],
      }).success,
      false,
    );
  });

  it("rejects a javascript: preview or template URL", () => {
    assert.equal(
      projectInput.safeParse({ ...base, previewUrl: "javascript:alert(1)" })
        .success,
      false,
    );
    assert.equal(
      projectInput.safeParse({ ...base, templateUrl: "javascript:alert(1)" })
        .success,
      false,
    );
  });

  it("reports errors under a dotted path the editor can index", () => {
    const result = projectInput.safeParse({
      ...base,
      sections: [{ heading: "ok", body: "ok" }, { heading: "", body: "ok" }],
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok("sections.1.heading" in fieldErrors(result.error));
    }
  });
});
