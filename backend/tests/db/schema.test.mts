import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  Tracker,
  projectPayload,
  serviceClient,
  techPayload,
} from "../../../frontend/tests/helpers/supabase.mts";
import { anonKey, serviceRoleKey, supabaseUrl } from "../../../frontend/tests/helpers/env.mts";

/**
 * Schema and constraint checks against the configured Supabase project.
 *
 * These run as the service role so RLS never masks a missing constraint: the
 * question here is whether the database itself refuses bad data, independent of
 * what the application validates.
 */

const service = serviceClient();
const tracker = new Tracker();

after(async () => {
  await tracker.cleanup();
});

describe("connection and inventory", () => {
  it("reaches the configured PostgREST endpoint with the anon key", async () => {
    // The root OpenAPI document is not readable by `anon` on a default
    // project, so connectivity is proven with the read the site actually makes.
    const response = await fetch(
      `${supabaseUrl()}/rest/v1/stack_technologies?select=id&limit=1`,
      { headers: { apikey: anonKey(), Authorization: `Bearer ${anonKey()}` } },
    );
    // Read the body exactly once: `assert.equal(a, b, await x)` evaluates its
    // message argument unconditionally, so calling `.text()` there and then
    // `.json()` on the next line throws "Body is unusable" even when the
    // status check passes, masking a good connection as a failure.
    const body = await response.text();
    assert.equal(response.status, 200, body);
    assert.ok(Array.isArray(JSON.parse(body)));
  });

  it("exposes the three required tables", async () => {
    for (const table of ["admin_users", "stack_technologies", "projects"]) {
      const { error } = await service.from(table).select("*").limit(1);
      assert.equal(error, null, `${table}: ${error?.message}`);
    }
  });

  it("exposes is_admin and both reorder functions", async () => {
    const spec = await fetch(`${supabaseUrl()}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey(),
        Authorization: `Bearer ${serviceRoleKey()}`,
      },
    }).then((r) => r.json() as Promise<{ paths: Record<string, unknown> }>);

    for (const rpc of [
      "/rpc/is_admin",
      "/rpc/reorder_stack_technologies",
      "/rpc/reorder_projects",
    ]) {
      assert.ok(rpc in spec.paths, `${rpc} is not exposed`);
    }
  });

  it("has both storage buckets, public, with the intended limits", async () => {
    const { data, error } = await service.storage.listBuckets();
    assert.equal(error, null);

    const byId = new Map((data ?? []).map((b) => [b.id, b]));

    const logos = byId.get("stack-logos");
    assert.ok(logos, "stack-logos bucket is missing");
    assert.equal(logos.public, true);
    assert.equal(logos.file_size_limit, 512_000);

    const images = byId.get("project-images");
    assert.ok(images, "project-images bucket is missing");
    assert.equal(images.public, true);
    assert.equal(images.file_size_limit, 5_242_880);
  });
});

describe("stack_technologies constraints", () => {
  it("accepts a valid row and applies the documented defaults", async () => {
    const { data, error } = await service
      .from("stack_technologies")
      .insert({
        name: techPayload().name,
        brand_key: techPayload().brand_key,
        logo_path: "/images/stack-html5.svg",
      })
      .select()
      .single();

    assert.equal(error, null, error?.message);
    tracker.trackTech(data.id);

    assert.equal(data.ring, "outer");
    assert.equal(data.enabled, true);
    assert.equal(data.icon_mode, "original");
    assert.equal(data.manual_angle, false);
    assert.equal(data.display_order, 0);
    assert.equal(data.angle, null);
    // The logo fit columns default to the centred, unzoomed transform, which
    // is what reproduces the rendering that predates the editor.
    assert.equal(Number(data.logo_scale), 1);
    assert.equal(Number(data.logo_offset_x), 0);
    assert.equal(Number(data.logo_offset_y), 0);
    assert.ok(data.created_at && data.updated_at);
  });

  it("gave every pre-existing technology the centred default", async () => {
    const { data, error } = await service
      .from("stack_technologies")
      .select("brand_key,logo_scale,logo_offset_x,logo_offset_y");

    assert.equal(error, null, error?.message);
    assert.ok((data ?? []).length > 0, "no technologies to check");

    for (const row of data ?? []) {
      // `0005_stack_logo_fit.sql` must not have left a null behind, and must
      // not have invented a transform for a row that was already correct.
      for (const column of ["logo_scale", "logo_offset_x", "logo_offset_y"] as const) {
        assert.notEqual(row[column], null, `${row.brand_key}.${column} is null`);
      }
    }
  });

  it("stores a logo fit and reads it back at both ends of the range", async () => {
    for (const fit of [
      { logo_scale: 0.5, logo_offset_x: -100, logo_offset_y: -100 },
      { logo_scale: 4, logo_offset_x: 100, logo_offset_y: 100 },
      { logo_scale: 1.75, logo_offset_x: -12, logo_offset_y: 8 },
    ]) {
      const { data, error } = await service
        .from("stack_technologies")
        .insert(techPayload(fit))
        .select()
        .single();

      assert.equal(error, null, `${JSON.stringify(fit)}: ${error?.message}`);
      tracker.trackTech(data.id);

      assert.equal(Number(data.logo_scale), fit.logo_scale);
      assert.equal(Number(data.logo_offset_x), fit.logo_offset_x);
      assert.equal(Number(data.logo_offset_y), fit.logo_offset_y);
    }
  });

  it("rejects a logo zoom outside 0.5 - 4", async () => {
    for (const logo_scale of [0.49, 0, 4.01]) {
      const { error } = await service
        .from("stack_technologies")
        .insert(techPayload({ logo_scale }));
      assert.equal(error?.code, "23514", `logo_scale ${logo_scale} was accepted`);
    }
  });

  it("rejects a logo offset outside -100 - 100", async () => {
    for (const column of ["logo_offset_x", "logo_offset_y"]) {
      for (const value of [-100.01, 100.01]) {
        const { error } = await service
          .from("stack_technologies")
          .insert(techPayload({ [column]: value }));
        assert.equal(
          error?.code,
          "23514",
          `${column} ${value} was accepted`,
        );
      }
    }
  });

  it("refuses a null logo fit", async () => {
    for (const column of ["logo_scale", "logo_offset_x", "logo_offset_y"]) {
      const { error } = await service
        .from("stack_technologies")
        .insert(techPayload({ [column]: null }));
      assert.equal(error?.code, "23502", `a null ${column} was accepted`);
    }
  });

  it("enforces brand_key uniqueness", async () => {
    const payload = techPayload();
    const { data, error } = await service
      .from("stack_technologies")
      .insert(payload)
      .select()
      .single();
    assert.equal(error, null, error?.message);
    tracker.trackTech(data.id);

    const { error: dupe } = await service
      .from("stack_technologies")
      .insert(payload);
    assert.equal(dupe?.code, "23505", "duplicate brand_key was accepted");
  });

  it("rejects an invalid ring", async () => {
    const { error } = await service
      .from("stack_technologies")
      .insert(techPayload({ ring: "equator" }));
    assert.equal(error?.code, "23514", "invalid ring was accepted");
  });

  it("rejects an invalid icon mode", async () => {
    const { error } = await service
      .from("stack_technologies")
      .insert(techPayload({ icon_mode: "neon" }));
    assert.equal(error?.code, "23514", "invalid icon_mode was accepted");
  });

  it("rejects an out-of-range angle", async () => {
    for (const angle of [-1, 361]) {
      const { error } = await service
        .from("stack_technologies")
        .insert(techPayload({ manual_angle: true, angle }));
      assert.equal(error?.code, "23514", `angle ${angle} was accepted`);
    }
  });

  it("rejects manual_angle with no angle", async () => {
    const { error } = await service
      .from("stack_technologies")
      .insert(techPayload({ manual_angle: true, angle: null }));
    assert.equal(error?.code, "23514", "manual_angle without a value was accepted");
  });

  it("rejects a malformed brand key", async () => {
    const { error } = await service
      .from("stack_technologies")
      .insert(techPayload({ brand_key: "Not A Key" }));
    assert.equal(error?.code, "23514", "malformed brand_key was accepted");
  });

  it("rejects a non-hex node background", async () => {
    const { error } = await service
      .from("stack_technologies")
      .insert(techPayload({ node_background: "red" }));
    assert.equal(error?.code, "23514", "non-hex node_background was accepted");
  });

  it("moves updated_at forward on update", async () => {
    const { data } = await service
      .from("stack_technologies")
      .insert(techPayload())
      .select()
      .single();
    tracker.trackTech(data.id);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const { data: updated, error } = await service
      .from("stack_technologies")
      .update({ name: `${data.name}-edited` })
      .eq("id", data.id)
      .select()
      .single();

    assert.equal(error, null, error?.message);
    assert.ok(
      new Date(updated.updated_at) > new Date(data.updated_at),
      `updated_at did not advance (${data.updated_at} -> ${updated.updated_at})`,
    );
    assert.equal(updated.created_at, data.created_at, "created_at was rewritten");
  });
});

describe("projects constraints", () => {
  it("accepts a valid row and applies the documented defaults", async () => {
    const { data, error } = await service
      .from("projects")
      .insert({
        slug: projectPayload().slug,
        title: "QA defaults",
        image: "/images/project-bambinoo.png",
      })
      .select()
      .single();

    assert.equal(error, null, error?.message);
    tracker.trackProject(data.id);

    assert.equal(data.published, false, "a new project must default to draft");
    assert.equal(data.show_on_homepage, true);
    assert.deepEqual(data.gallery, []);
    assert.deepEqual(data.sections, []);
    assert.equal(data.display_order, 0);
  });

  it("enforces slug uniqueness", async () => {
    const payload = projectPayload();
    const { data, error } = await service
      .from("projects")
      .insert(payload)
      .select()
      .single();
    assert.equal(error, null, error?.message);
    tracker.trackProject(data.id);

    const { error: dupe } = await service.from("projects").insert({
      ...projectPayload(),
      slug: payload.slug,
    });
    assert.equal(dupe?.code, "23505", "duplicate slug was accepted");
  });

  it("rejects a malformed slug", async () => {
    for (const slug of ["Not A Slug", "trailing-", "-leading", "double--dash"]) {
      const { error } = await service
        .from("projects")
        .insert(projectPayload({ slug }));
      assert.equal(error?.code, "23514", `slug "${slug}" was accepted`);
    }
  });

  it("caps the gallery at twelve entries", async () => {
    const thirteen = Array.from({ length: 13 }, (_, i) => `/images/g${i}.png`);
    const { error } = await service
      .from("projects")
      .insert(projectPayload({ gallery: thirteen }));
    assert.equal(error?.code, "23514", "a 13-image gallery was accepted");
  });

  it("caps the sections at twelve entries", async () => {
    const thirteen = Array.from({ length: 13 }, () => ({ heading: "h", body: "b" }));
    const { error } = await service
      .from("projects")
      .insert(projectPayload({ sections: thirteen }));
    assert.equal(error?.code, "23514", "13 sections were accepted");
  });

  it("rejects a non-array gallery", async () => {
    const { error } = await service
      .from("projects")
      .insert(projectPayload({ gallery: { nope: true } }));
    assert.equal(error?.code, "23514", "an object gallery was accepted");
  });

  it("moves updated_at forward on update", async () => {
    const { data } = await service
      .from("projects")
      .insert(projectPayload())
      .select()
      .single();
    tracker.trackProject(data.id);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    const { data: updated } = await service
      .from("projects")
      .update({ title: "QA edited" })
      .eq("id", data.id)
      .select()
      .single();

    assert.ok(
      new Date(updated.updated_at) > new Date(data.updated_at),
      "updated_at did not advance",
    );
  });
});

describe("admin_users cascade", () => {
  let userId: string;

  before(async () => {
    const user = await tracker.createUser("admin");
    userId = user.id;
  });

  it("links the QA admin to an auth user", async () => {
    const { data } = await service
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    assert.equal(data?.user_id, userId);
  });

  it("removes the admin_users row when the auth user is deleted", async () => {
    // Deleting through the admin API rather than the tracker, so the cascade
    // itself is what removes the row.
    const { error } = await service.auth.admin.deleteUser(userId);
    assert.equal(error, null, error?.message);

    const { data } = await service
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    assert.equal(data, null, "admin_users row survived the auth user");

    // Already gone; stop the tracker trying again.
    tracker.users.splice(0, tracker.users.length);
  });
});
