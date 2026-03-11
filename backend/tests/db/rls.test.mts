import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Tracker,
  anonClient,
  projectPayload,
  serviceClient,
  techPayload,
  userClient,
  type QaUser,
} from "../../../frontend/tests/helpers/supabase.mts";

/**
 * Row level security, exercised as all three roles the deployed system has.
 *
 * The service role appears only to create the fixtures; every assertion about
 * what may be seen or written is made through an `anon` or end-user client, so
 * these tests describe the protection an attacker actually meets.
 */

const service = serviceClient();
const tracker = new Tracker();

let admin: QaUser;
let member: QaUser;
let adminDb: SupabaseClient;
let memberDb: SupabaseClient;
const anonDb = anonClient();

/** A draft project and a disabled technology: the rows anon must not see. */
let hiddenProjectId = "";
let hiddenTechId = "";
let visibleProjectId = "";
let visibleTechId = "";

before(async () => {
  admin = await tracker.createUser("admin");
  member = await tracker.createUser("member");
  adminDb = userClient(admin.accessToken);
  memberDb = userClient(member.accessToken);

  const { data: hiddenProject, error: e1 } = await service
    .from("projects")
    .insert(projectPayload({ published: false }))
    .select()
    .single();
  if (e1) throw new Error(e1.message);
  hiddenProjectId = tracker.trackProject(hiddenProject.id);

  const { data: visibleProject, error: e2 } = await service
    .from("projects")
    .insert(projectPayload({ published: true }))
    .select()
    .single();
  if (e2) throw new Error(e2.message);
  visibleProjectId = tracker.trackProject(visibleProject.id);

  const { data: hiddenTech, error: e3 } = await service
    .from("stack_technologies")
    .insert(techPayload({ enabled: false }))
    .select()
    .single();
  if (e3) throw new Error(e3.message);
  hiddenTechId = tracker.trackTech(hiddenTech.id);

  const { data: visibleTech, error: e4 } = await service
    .from("stack_technologies")
    .insert(techPayload({ enabled: true }))
    .select()
    .single();
  if (e4) throw new Error(e4.message);
  visibleTechId = tracker.trackTech(visibleTech.id);
});

after(async () => {
  await tracker.cleanup();
});

describe("anonymous reads", () => {
  it("sees enabled technologies but never a disabled one", async () => {
    const { data, error } = await anonDb
      .from("stack_technologies")
      .select("id,enabled");
    assert.equal(error, null);
    const ids = (data ?? []).map((r) => r.id);
    assert.ok(ids.includes(visibleTechId), "enabled technology was hidden");
    assert.ok(!ids.includes(hiddenTechId), "DISABLED TECHNOLOGY LEAKED TO ANON");
    assert.equal((data ?? []).filter((r) => !r.enabled).length, 0);
  });

  it("cannot reach a disabled technology even by id", async () => {
    const { data } = await anonDb
      .from("stack_technologies")
      .select("id")
      .eq("id", hiddenTechId);
    assert.deepEqual(data, []);
  });

  it("sees published projects but never a draft", async () => {
    const { data, error } = await anonDb
      .from("projects")
      .select("id,published");
    assert.equal(error, null);
    const ids = (data ?? []).map((r) => r.id);
    assert.ok(ids.includes(visibleProjectId), "published project was hidden");
    assert.ok(!ids.includes(hiddenProjectId), "DRAFT PROJECT LEAKED TO ANON");
    assert.equal((data ?? []).filter((r) => !r.published).length, 0);
  });

  it("cannot reach a draft project even by id or slug", async () => {
    const { data: byId } = await anonDb
      .from("projects")
      .select("id")
      .eq("id", hiddenProjectId);
    assert.deepEqual(byId, []);
  });

  it("cannot read admin_users", async () => {
    const { data } = await anonDb.from("admin_users").select("user_id,email");
    assert.deepEqual(data, [], "admin_users is readable anonymously");
  });
});

describe("anonymous writes", () => {
  it("cannot insert a technology or a project", async () => {
    const { error: t } = await anonDb
      .from("stack_technologies")
      .insert(techPayload());
    assert.notEqual(t, null, "ANON INSERTED A TECHNOLOGY");

    const { error: p } = await anonDb.from("projects").insert(projectPayload());
    assert.notEqual(p, null, "ANON INSERTED A PROJECT");
  });

  it("cannot update a visible row", async () => {
    await anonDb
      .from("projects")
      .update({ title: "anon owned" })
      .eq("id", visibleProjectId);

    const { data } = await service
      .from("projects")
      .select("title")
      .eq("id", visibleProjectId)
      .single();
    assert.notEqual(data?.title, "anon owned", "ANON UPDATED A PROJECT");
  });

  it("cannot delete a visible row", async () => {
    await anonDb.from("projects").delete().eq("id", visibleProjectId);
    const { data } = await service
      .from("projects")
      .select("id")
      .eq("id", visibleProjectId)
      .maybeSingle();
    assert.notEqual(data, null, "ANON DELETED A PROJECT");
  });

  it("cannot call either reorder function", async () => {
    const { error: a } = await anonDb.rpc("reorder_projects", {
      ordered_ids: [visibleProjectId],
    });
    assert.notEqual(a, null, "ANON REORDERED PROJECTS");

    const { error: b } = await anonDb.rpc("reorder_stack_technologies", {
      target_ring: "inner",
      ordered_ids: [visibleTechId],
    });
    assert.notEqual(b, null, "ANON REORDERED TECHNOLOGIES");
  });

  it("cannot grant itself admin", async () => {
    const { error } = await anonDb
      .from("admin_users")
      .insert({ user_id: crypto.randomUUID(), email: "attacker@qa.invalid" });
    assert.notEqual(error, null, "ANON WROTE TO admin_users");
  });
});

describe("authenticated non-admin", () => {
  it("is_admin() reports false", async () => {
    const { data, error } = await memberDb.rpc("is_admin");
    assert.equal(error, null);
    assert.equal(data, false);
  });

  it("cannot see drafts or disabled technologies", async () => {
    const { data: projects } = await memberDb.from("projects").select("id");
    assert.ok(
      !(projects ?? []).some((r) => r.id === hiddenProjectId),
      "DRAFT LEAKED TO A SIGNED-IN NON-ADMIN",
    );

    const { data: techs } = await memberDb
      .from("stack_technologies")
      .select("id");
    assert.ok(
      !(techs ?? []).some((r) => r.id === hiddenTechId),
      "DISABLED TECHNOLOGY LEAKED TO A SIGNED-IN NON-ADMIN",
    );
  });

  it("cannot insert, update or delete either resource", async () => {
    const { error: insertTech } = await memberDb
      .from("stack_technologies")
      .insert(techPayload());
    assert.notEqual(insertTech, null, "NON-ADMIN INSERTED A TECHNOLOGY");

    const { error: insertProject } = await memberDb
      .from("projects")
      .insert(projectPayload());
    assert.notEqual(insertProject, null, "NON-ADMIN INSERTED A PROJECT");

    await memberDb
      .from("projects")
      .update({ title: "member owned" })
      .eq("id", visibleProjectId);
    const { data: after } = await service
      .from("projects")
      .select("title")
      .eq("id", visibleProjectId)
      .single();
    assert.notEqual(after?.title, "member owned", "NON-ADMIN UPDATED A PROJECT");

    await memberDb.from("projects").delete().eq("id", visibleProjectId);
    const { data: stillThere } = await service
      .from("projects")
      .select("id")
      .eq("id", visibleProjectId)
      .maybeSingle();
    assert.notEqual(stillThere, null, "NON-ADMIN DELETED A PROJECT");
  });

  it("cannot call either reorder function", async () => {
    const { error: a } = await memberDb.rpc("reorder_projects", {
      ordered_ids: [visibleProjectId],
    });
    assert.notEqual(a, null, "NON-ADMIN REORDERED PROJECTS");

    const { error: b } = await memberDb.rpc("reorder_stack_technologies", {
      target_ring: "inner",
      ordered_ids: [visibleTechId],
    });
    assert.notEqual(b, null, "NON-ADMIN REORDERED TECHNOLOGIES");
  });

  it("cannot promote itself by writing to admin_users", async () => {
    const { error } = await memberDb
      .from("admin_users")
      .insert({ user_id: member.id, email: member.email });
    assert.notEqual(error, null, "NON-ADMIN PROMOTED ITSELF");

    const { data } = await service
      .from("admin_users")
      .select("user_id")
      .eq("user_id", member.id)
      .maybeSingle();
    assert.equal(data, null, "NON-ADMIN IS NOW AN ADMIN");
  });
});

describe("authenticated admin", () => {
  it("is_admin() reports true", async () => {
    const { data, error } = await adminDb.rpc("is_admin");
    assert.equal(error, null);
    assert.equal(data, true);
  });

  it("sees drafts and disabled technologies", async () => {
    const { data: projects } = await adminDb.from("projects").select("id");
    assert.ok(
      (projects ?? []).some((r) => r.id === hiddenProjectId),
      "admin cannot see drafts",
    );

    const { data: techs } = await adminDb
      .from("stack_technologies")
      .select("id");
    assert.ok(
      (techs ?? []).some((r) => r.id === hiddenTechId),
      "admin cannot see disabled technologies",
    );
  });

  it("can create, update and delete a technology", async () => {
    const { data: created, error } = await adminDb
      .from("stack_technologies")
      .insert(techPayload())
      .select()
      .single();
    assert.equal(error, null, error?.message);
    tracker.trackTech(created.id);

    const { error: updateError } = await adminDb
      .from("stack_technologies")
      .update({ name: "QA renamed" })
      .eq("id", created.id);
    assert.equal(updateError, null, updateError?.message);

    const { error: deleteError } = await adminDb
      .from("stack_technologies")
      .delete()
      .eq("id", created.id);
    assert.equal(deleteError, null, deleteError?.message);

    const { data: gone } = await service
      .from("stack_technologies")
      .select("id")
      .eq("id", created.id)
      .maybeSingle();
    assert.equal(gone, null, "admin delete did not remove the row");
  });

  it("can create, update and delete a project", async () => {
    const { data: created, error } = await adminDb
      .from("projects")
      .insert(projectPayload())
      .select()
      .single();
    assert.equal(error, null, error?.message);
    tracker.trackProject(created.id);

    const { error: updateError } = await adminDb
      .from("projects")
      .update({ title: "QA renamed", published: true })
      .eq("id", created.id);
    assert.equal(updateError, null, updateError?.message);

    const { error: deleteError } = await adminDb
      .from("projects")
      .delete()
      .eq("id", created.id);
    assert.equal(deleteError, null, deleteError?.message);
  });

  it("can reorder technologies and move one between rings", async () => {
    const made = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await service
        .from("stack_technologies")
        .insert(techPayload({ ring: "middle", display_order: 500 + i }))
        .select()
        .single();
      made.push(tracker.trackTech(data.id));
    }

    const reversed = [...made].reverse();
    const { error } = await adminDb.rpc("reorder_stack_technologies", {
      target_ring: "inner",
      ordered_ids: reversed,
    });
    assert.equal(error, null, error?.message);

    const { data: rows } = await service
      .from("stack_technologies")
      .select("id,ring,display_order")
      .in("id", made);

    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    reversed.forEach((id, index) => {
      assert.equal(byId.get(id)?.display_order, index, `position of ${id}`);
      assert.equal(byId.get(id)?.ring, "inner", "ring was not moved");
    });
  });

  it("can reorder projects", async () => {
    const made = [];
    for (let i = 0; i < 3; i++) {
      const { data } = await service
        .from("projects")
        .insert(projectPayload({ display_order: 500 + i }))
        .select()
        .single();
      made.push(tracker.trackProject(data.id));
    }

    const reversed = [...made].reverse();
    const { error } = await adminDb.rpc("reorder_projects", {
      ordered_ids: reversed,
    });
    assert.equal(error, null, error?.message);

    const { data: rows } = await service
      .from("projects")
      .select("id,display_order")
      .in("id", made);

    const byId = new Map((rows ?? []).map((r) => [r.id, r]));
    reversed.forEach((id, index) => {
      assert.equal(byId.get(id)?.display_order, index, `position of ${id}`);
    });
  });

  it("cannot edit admin_users through the browser client", async () => {
    const { error } = await adminDb
      .from("admin_users")
      .insert({ user_id: crypto.randomUUID(), email: "escalate@qa.invalid" });
    assert.notEqual(
      error,
      null,
      "an admin can add other admins from the browser",
    );
  });
});
