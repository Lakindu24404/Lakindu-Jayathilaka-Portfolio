/**
 * Restores the seeded `display_order` values.
 *
 * A reorder normalises the whole ring from zero, so a QA reorder on a ring that
 * also holds seeded nodes renumbers those seeded rows too. Rendering is
 * unaffected (order within the ring is preserved), but the stored values should
 * be put back. Run with `node --env-file=.env.local tests/tools/restore-seed-order.mjs`.
 */
import { createClient } from "@supabase/supabase-js";
import { projectSeed, stackSeed } from "../../../frontend/src/content/portfolio-seed.ts";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } },
);

let fixed = 0;

for (const tech of stackSeed) {
  const { data } = await db
    .from("stack_technologies")
    .select("id,display_order")
    .eq("brand_key", tech.brandKey)
    .maybeSingle();
  if (!data || data.display_order === tech.displayOrder) continue;
  await db
    .from("stack_technologies")
    .update({ display_order: tech.displayOrder })
    .eq("id", data.id);
  console.log(`  ${tech.brandKey}: ${data.display_order} -> ${tech.displayOrder}`);
  fixed++;
}

for (const project of projectSeed) {
  const { data } = await db
    .from("projects")
    .select("id,display_order")
    .eq("slug", project.slug)
    .maybeSingle();
  if (!data || data.display_order === project.displayOrder) continue;
  await db
    .from("projects")
    .update({ display_order: project.displayOrder })
    .eq("id", data.id);
  console.log(`  ${project.slug}: ${data.display_order} -> ${project.displayOrder}`);
  fixed++;
}

console.log(fixed === 0 ? "Seeded display_order already matches." : `Restored ${fixed} row(s).`);
