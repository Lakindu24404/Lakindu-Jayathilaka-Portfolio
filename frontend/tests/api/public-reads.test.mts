import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { appOrigin } from "../helpers/env.mts";
import {
  Tracker,
  projectPayload,
  serviceClient,
  techPayload,
} from "../helpers/supabase.mts";

/**
 * The public HTTP surface, checked against a running server.
 *
 * Strict by design: if nothing answers at `QA_APP_ORIGIN` the suite fails
 * instead of skipping. An earlier version skipped every test when the server
 * was down, which let the aggregate `npm test` report success while this suite
 * had not actually asserted anything.
 *
 * `npm run qa` builds, serves and points this suite at that server. To run it
 * against a server you already have, set `QA_APP_ORIGIN`. `QA_API_ALLOW_SKIP=1`
 * restores the old lenient behaviour for local poking; no CI or aggregate
 * command sets it.
 */

const origin = appOrigin();

/** Opt-in escape hatch. Never set by `npm test` or `npm run qa`. */
const allowSkip = process.env.QA_API_ALLOW_SKIP === "1";

/** Titles carry `&` and quotes, which React escapes into entities. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True when `needle` appears in `html`, escaped or not. */
function renders(html: string, needle: string): boolean {
  return html.includes(needle) || html.includes(escapeHtml(needle));
}

const service = serviceClient();
const tracker = new Tracker();

let serverUp = false;

before(async () => {
  let detail = "no response";
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(4000) });
    serverUp = response.ok;
    if (!serverUp) detail = `responded ${response.status}`;
  } catch (error) {
    serverUp = false;
    detail = error instanceof Error ? error.name : "connection failed";
  }

  // Only the target origin is named — never a key or any other env value.
  if (!serverUp && !allowSkip) {
    throw new Error(
      [
        `No application server answered at ${origin} (${detail}).`,
        "These tests assert on real HTTP responses, so the suite fails rather than skipping.",
        "Run `npm run qa` to build, serve and test in one step, or set QA_APP_ORIGIN to a running server.",
        "QA_API_ALLOW_SKIP=1 restores skipping for local work.",
      ].join("\n  "),
    );
  }
});

after(async () => {
  await tracker.cleanup();
});

describe("public routes", () => {
  it("serves the homepage", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);
    const response = await fetch(origin);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  });

  it("renders the orbit and the project grid from the database", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);
    const html = await (await fetch(origin)).text();

    // Every enabled technology name appears in the orbit's screen-reader text.
    const { data: techs } = await service
      .from("stack_technologies")
      .select("name")
      .eq("enabled", true);
    for (const tech of techs ?? []) {
      assert.ok(
        renders(html, tech.name),
        `the orbit is missing "${tech.name}"`,
      );
    }

    // And every published, homepage-visible project has a card.
    const { data: projects } = await service
      .from("projects")
      .select("title")
      .eq("published", true)
      .eq("show_on_homepage", true);
    for (const project of projects ?? []) {
      assert.ok(
        renders(html, project.title),
        `the project grid is missing "${project.title}"`,
      );
    }
  });

  it("returns 404 for an unknown slug", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);
    const response = await fetch(`${origin}/no-such-project-${Date.now()}`);
    assert.equal(response.status, 404);
  });

  it("returns 404 for a draft project and leaks none of its copy", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);

    const marker = `QA-DRAFT-MARKER-${Date.now()}`;
    const { data, error } = await service
      .from("projects")
      .insert(projectPayload({ published: false, intro: marker }))
      .select()
      .single();
    if (error) throw new Error(error.message);
    tracker.trackProject(data.id);

    const response = await fetch(`${origin}/${data.slug}`);
    assert.equal(response.status, 404, "a draft project was served publicly");
    assert.ok(
      !renders(await response.text(), marker),
      "draft copy leaked into the 404 page",
    );
  });

  it("keeps a disabled technology out of the rendered orbit", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);

    const payload = techPayload({ enabled: false, name: `QA-HIDDEN-${Date.now()}` });
    const { data, error } = await service
      .from("stack_technologies")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    tracker.trackTech(data.id);

    const html = await (await fetch(origin)).text();
    assert.ok(
      !renders(html, payload.name as string),
      "a disabled technology reached the public orbit",
    );
  });

  it("serves every seeded case study with its metadata", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);

    const { data: projects } = await service
      .from("projects")
      .select("slug,title")
      .eq("published", true)
      .not("slug", "like", "qa-%");

    for (const project of projects ?? []) {
      const response = await fetch(`${origin}/${project.slug}`);
      assert.equal(response.status, 200, `/${project.slug} did not render`);

      const html = await response.text();
      assert.ok(
        renders(html, project.title),
        `/${project.slug} lost its title`,
      );
      assert.ok(
        html.includes('property="og:title"') || html.includes('name="twitter:title"'),
        `/${project.slug} is missing Open Graph metadata`,
      );
      assert.ok(
        html.includes('rel="canonical"'),
        `/${project.slug} is missing a canonical link`,
      );
    }
  });

  it("keeps the dashboard out of search results", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);
    const response = await fetch(`${origin}/dashboard/login`);
    const html = await response.text();
    assert.match(html, /noindex/, "the dashboard login page is indexable");
  });
});

describe("credential hygiene", () => {
  it("never ships the service-role key in a public response", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
    for (const path of ["/", "/dashboard/login"]) {
      const html = await (await fetch(`${origin}${path}`)).text();
      assert.ok(
        !html.includes(serviceKey),
        `the service-role key is present in ${path}`,
      );
    }
  });

  it("does not expose PostgREST writes to the anon key over HTTP", async (t) => {
    if (!serverUp) return t.skip(`no server at ${origin}`);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/+$/, "");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

    const response = await fetch(`${url}/rest/v1/projects`, {
      method: "POST",
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projectPayload()),
    });
    assert.ok(
      response.status >= 400,
      `the anon key could POST a project (${response.status})`,
    );
  });
});
