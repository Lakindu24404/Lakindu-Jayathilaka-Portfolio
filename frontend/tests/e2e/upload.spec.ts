import { QA_PREFIX, expect, test } from "./fixtures";

/**
 * `POST /api/dashboard/upload`, exercised through a real authenticated
 * browser session rather than by calling the validators directly.
 *
 * Every accepted upload is recorded so cleanup removes the stored object.
 */

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
]);
const SAFE_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>',
);

/** Uploads through the signed-in page context, so the session cookie applies. */
async function upload(
  page: import("@playwright/test").Page,
  kind: string,
  file: { name: string; type: string; bytes: number[] } | null,
) {
  return page.evaluate(
    async ({ kind, file }) => {
      const body = new FormData();
      body.set("kind", kind);
      if (file) {
        body.set(
          "file",
          new File([new Uint8Array(file.bytes)], file.name, { type: file.type }),
        );
      }
      const response = await fetch("/api/dashboard/upload", {
        method: "POST",
        body,
      });
      let payload: Record<string, unknown> = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      return { status: response.status, payload };
    },
    { kind, file },
  );
}

const asBytes = (buffer: Buffer) => [...buffer];

test("an authenticated admin can upload a valid PNG", async ({
  adminPage,
  recorder,
  request,
}) => {
  await adminPage.goto("/dashboard/projects");

  const result = await upload(adminPage, "project", {
    name: `${QA_PREFIX}card.png`,
    type: "image/png",
    bytes: asBytes(PNG),
  });

  expect(result.status, JSON.stringify(result.payload)).toBe(200);
  const url = String(result.payload.url ?? "");
  const name = String(result.payload.name ?? "");
  expect(url).toContain("/storage/v1/object/public/project-images/");
  recorder.objects.push(["project-images", name]);

  // The returned URL must actually serve the bytes.
  const fetched = await request.get(url);
  expect(fetched.status(), "the returned public URL does not load").toBe(200);
  expect(fetched.headers()["content-type"]).toContain("image/png");
});

test("an authenticated admin can upload a safe SVG logo", async ({
  adminPage,
  recorder,
  request,
}) => {
  await adminPage.goto("/dashboard/stack");

  const result = await upload(adminPage, "logo", {
    name: `${QA_PREFIX}logo.svg`,
    type: "image/svg+xml",
    bytes: asBytes(SAFE_SVG),
  });

  expect(result.status, JSON.stringify(result.payload)).toBe(200);
  const url = String(result.payload.url ?? "");
  expect(url).toContain("/storage/v1/object/public/stack-logos/");
  recorder.objects.push(["stack-logos", String(result.payload.name ?? "")]);

  expect((await request.get(url)).status()).toBe(200);
});

test("the endpoint refuses malformed and hostile uploads", async ({
  adminPage,
}) => {
  await adminPage.goto("/dashboard/projects");

  const cases: Array<[string, Parameters<typeof upload>[1], Parameters<typeof upload>[2]]> = [
    ["no file at all", "project", null],
    [
      "an unknown upload kind",
      "avatar",
      { name: "a.png", type: "image/png", bytes: asBytes(PNG) },
    ],
    [
      "an unsupported extension",
      "project",
      { name: "a.gif", type: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
    ],
    [
      "JPEG in the logo bucket, which only takes SVG/PNG/WebP",
      "logo",
      { name: "a.jpg", type: "image/jpeg", bytes: [0xff, 0xd8, 0xff, 0xe0] },
    ],
    [
      "a .png that is really HTML",
      "project",
      {
        name: "a.png",
        type: "image/png",
        bytes: [...Buffer.from("<html><body>not an image</body></html>")],
      },
    ],
    [
      "an SVG carrying a script element",
      "logo",
      {
        name: "a.svg",
        type: "image/svg+xml",
        bytes: [
          ...Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
          ),
        ],
      },
    ],
    [
      "an SVG carrying an onload handler",
      "logo",
      {
        name: "a.svg",
        type: "image/svg+xml",
        bytes: [
          ...Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
          ),
        ],
      },
    ],
    [
      "an SVG carrying an external entity",
      "logo",
      {
        name: "a.svg",
        type: "image/svg+xml",
        bytes: [
          ...Buffer.from(
            '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"/>',
          ),
        ],
      },
    ],
    ["an empty file", "project", { name: "a.png", type: "image/png", bytes: [] }],
  ];

  for (const [label, kind, file] of cases) {
    const result = await upload(adminPage, kind, file);
    expect(
      result.status,
      `${label} was accepted (status ${result.status})`,
    ).toBeGreaterThanOrEqual(400);
    expect(result.status).toBeLessThan(500);
    expect(String(result.payload.error ?? ""), `${label} had no message`)
      .not.toBe("");
  }
});

test("an oversized file is rejected by the endpoint", async ({ adminPage }) => {
  await adminPage.goto("/dashboard/stack");

  // 600 KB of PNG, over the 500 KB logo limit.
  const oversized = [
    ...PNG,
    ...new Array(600 * 1024).fill(0x00),
  ];
  const result = await upload(adminPage, "logo", {
    name: `${QA_PREFIX}big.png`,
    type: "image/png",
    bytes: oversized,
  });

  expect(result.status, JSON.stringify(result.payload)).toBe(413);
});

test("a signed-in non-admin cannot upload", async ({ page, db }) => {
  const email = `${QA_PREFIX}uploader@qa.invalid`;
  const password = `Qa!${crypto.randomUUID()}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message);

  try {
    // Sign in through the Supabase client in the page, so the session cookie
    // is set exactly as it would be for a real non-admin visitor.
    await page.goto("/dashboard/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.locator("p[role=alert]").waitFor();

    const result = await upload(page, "logo", {
      name: "a.png",
      type: "image/png",
      bytes: asBytes(PNG),
    });
    expect(result.status, "a non-admin was allowed to upload").toBe(401);
  } finally {
    await db.auth.admin.deleteUser(data.user.id);
  }
});
