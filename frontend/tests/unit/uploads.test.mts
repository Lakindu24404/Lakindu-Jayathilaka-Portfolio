import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  UPLOAD_RULES,
  checkFile,
  isUploadKind,
  safeObjectName,
  sniffImageType,
  validateSvg,
} from "@/lib/uploads";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const WEBP = new Uint8Array([
  ...[0x52, 0x49, 0x46, 0x46], ...[0, 0, 0, 0], ...[0x57, 0x45, 0x42, 0x50],
]);
const AVIF = new Uint8Array([
  ...[0, 0, 0, 0], ...[0x66, 0x74, 0x79, 0x70], ...[0x61, 0x76, 0x69, 0x66],
]);

describe("sniffImageType", () => {
  it("identifies the supported raster formats from their magic bytes", () => {
    assert.equal(sniffImageType(PNG), "image/png");
    assert.equal(sniffImageType(JPEG), "image/jpeg");
    assert.equal(sniffImageType(WEBP), "image/webp");
    assert.equal(sniffImageType(AVIF), "image/avif");
  });

  it("returns null for content that is not a supported image", () => {
    assert.equal(sniffImageType(new TextEncoder().encode("<html>")), null);
    assert.equal(sniffImageType(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), null);
    assert.equal(sniffImageType(new Uint8Array([])), null);
  });

  it("does not mistake a GIF for a supported format", () => {
    assert.equal(sniffImageType(new TextEncoder().encode("GIF89a")), null);
  });
});

describe("validateSvg", () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

  it("accepts a plain SVG", () => {
    assert.equal(validateSvg(safe), null);
  });

  it("accepts an SVG behind an XML declaration, comment or doctype", () => {
    assert.equal(validateSvg(`<?xml version="1.0"?>${safe}`), null);
    assert.equal(validateSvg(`<!-- generated -->\n${safe}`), null);
    assert.equal(
      validateSvg(
        `<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">${safe}`,
      ),
      null,
    );
  });

  for (const [label, source] of [
    ["a script element", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["a spaced script element", '<svg xmlns="http://www.w3.org/2000/svg">< script >alert(1)</script></svg>'],
    ["an onload handler", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'],
    ["an onclick handler", '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)"/></svg>'],
    ["a javascript: href", '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)">x</a></svg>'],
    ["a foreignObject", '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body/></foreignObject></svg>'],
    ["an entity declaration", '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"/>'],
    ["an iframe", '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="//evil"/></svg>'],
    ["an external use reference", '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil/x#y"/></svg>'],
  ] as const) {
    it(`rejects ${label}`, () => {
      assert.notEqual(validateSvg(source), null, source);
    });
  }

  it("rejects HTML wearing an .svg name", () => {
    assert.notEqual(validateSvg("<html><body>hi</body></html>"), null);
  });
});

describe("safeObjectName", () => {
  it("keeps a readable stem and the extension", () => {
    const name = safeObjectName("My Logo (final).SVG");
    assert.match(name, /^my-logo-final-[0-9a-f]{8}\.svg$/);
  });

  it("cannot produce a path traversal or a nested key", () => {
    for (const input of ["../../etc/passwd", "a/b/c.png", "..\\..\\x.png"]) {
      const name = safeObjectName(input);
      assert.ok(!name.includes("/"), name);
      assert.ok(!name.includes("\\"), name);
      assert.ok(!name.includes(".."), name);
    }
  });

  it("is unique across calls with the same input", () => {
    const names = new Set(
      Array.from({ length: 50 }, () => safeObjectName("logo.png")),
    );
    assert.equal(names.size, 50);
  });

  it("falls back to a stem when the name has none", () => {
    assert.match(safeObjectName("---.png"), /^asset-[0-9a-f]{8}\.png$/);
  });
});

describe("checkFile", () => {
  const file = (name: string, type: string, size: number) =>
    ({ name, type, size }) as File;

  it("accepts an in-policy logo and project image", () => {
    assert.equal(checkFile("logo", file("a.svg", "image/svg+xml", 1000)), null);
    assert.equal(checkFile("project", file("a.png", "image/png", 1000)), null);
  });

  it("rejects an extension the bucket does not allow", () => {
    assert.notEqual(checkFile("logo", file("a.gif", "image/gif", 10)), null);
    // JPEG is fine for project images but not for orbit logos.
    assert.notEqual(checkFile("logo", file("a.jpg", "image/jpeg", 10)), null);
    assert.equal(checkFile("project", file("a.jpg", "image/jpeg", 10)), null);
  });

  it("rejects a declared type that contradicts the extension", () => {
    assert.notEqual(
      checkFile("project", file("a.png", "text/html", 10)),
      null,
    );
  });

  it("rejects an oversized file at each bucket's limit", () => {
    assert.notEqual(
      checkFile("logo", file("a.png", "image/png", UPLOAD_RULES.logo.maxBytes + 1)),
      null,
    );
    assert.notEqual(
      checkFile("project", file("a.png", "image/png", UPLOAD_RULES.project.maxBytes + 1)),
      null,
    );
  });

  it("rejects an empty file", () => {
    assert.notEqual(checkFile("project", file("a.png", "image/png", 0)), null);
  });
});

describe("isUploadKind", () => {
  it("accepts only the two known kinds", () => {
    assert.equal(isUploadKind("logo"), true);
    assert.equal(isUploadKind("project"), true);
    for (const bad of ["avatar", "", null, undefined, 1, {}]) {
      assert.equal(isUploadKind(bad), false, String(bad));
    }
  });
});
