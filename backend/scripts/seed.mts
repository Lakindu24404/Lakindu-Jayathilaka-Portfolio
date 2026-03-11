/**
 * Import the bundled portfolio content into Supabase.
 *
 *   npm run seed
 *
 * Reads .env.local (or the ambient environment) and uses the service-role key,
 * which is why this is a one-off script and not something the app can call.
 * It is idempotent: rows are upserted on their natural key (brand_key / slug),
 * so re-running it restores the original content without creating duplicates.
 *
 * Run with `--force` to overwrite rows that already exist. Without it, existing
 * rows are left alone so a re-run never clobbers dashboard edits.
 * Run with `--project=<slug>` to seed only one project without touching the
 * stack or admin tables.
 *
 * Executed by Node's built-in TypeScript support, so no build step is needed.
 */

import { createClient } from "@supabase/supabase-js";
import { projectSeed, stackSeed } from "../../frontend/src/content/portfolio-seed.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim();
const force = process.argv.includes("--force");
const projectSlug = process.argv
  .find((argument) => argument.startsWith("--project="))
  ?.slice("--project=".length)
  .trim();

if (!url || !serviceRoleKey) {
  console.error(
    [
      "Supabase is not configured.",
      "",
      "  1. Copy .env.example to .env.local",
      "  2. Fill in NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      "  3. Run the migrations in backend/supabase/migrations, then `npm run seed`",
      "",
      "See backend/README.md for the full walkthrough.",
    ].join("\n"),
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function bail(step: string, error: { message: string }): never {
  console.error(`✗ ${step}: ${error.message}`);
  process.exit(1);
}

async function seedAdmin() {
  if (!adminEmail) {
    console.log(
      "ℹ SEED_ADMIN_EMAIL not set — skipping admin_users. Add your user by hand:",
    );
    console.log(
      "  insert into public.admin_users (user_id, email)\n  select id, email from auth.users where email = 'you@example.com';",
    );
    return;
  }

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) bail("Listing auth users", error);

  const user = data.users.find(
    (candidate) => candidate.email?.toLowerCase() === adminEmail.toLowerCase(),
  );

  if (!user) {
    console.warn(
      `⚠ No auth user found for ${adminEmail}. Create it in Supabase → Authentication → Users, then re-run.`,
    );
    return;
  }

  const { error: insertError } = await supabase
    .from("admin_users")
    .upsert({ user_id: user.id, email: user.email }, { onConflict: "user_id" });

  if (insertError) bail("Granting admin access", insertError);
  console.log(`✓ ${adminEmail} can sign in to /dashboard`);
}

async function seedStack() {
  const { data: existing, error: readError } = await supabase
    .from("stack_technologies")
    .select("brand_key");
  if (readError) bail("Reading stack_technologies", readError);

  const known = new Set((existing ?? []).map((row) => row.brand_key));
  const rows = stackSeed
    .filter((item) => force || !known.has(item.brandKey))
    .map((item) => ({
      name: item.name,
      brand_key: item.brandKey,
      logo_path: item.logoPath,
      ring: item.ring,
      display_order: item.displayOrder,
      enabled: item.enabled,
      node_background: item.nodeBackground,
      icon_mode: item.iconMode,
      manual_angle: item.manualAngle,
      angle: item.angle,
      logo_scale: item.logoScale,
      logo_offset_x: item.logoOffsetX,
      logo_offset_y: item.logoOffsetY,
    }));

  if (rows.length === 0) {
    console.log("✓ Stack Orbit already seeded (use --force to overwrite)");
    return;
  }

  const { error } = await supabase
    .from("stack_technologies")
    .upsert(rows, { onConflict: "brand_key" });
  if (error) bail("Seeding stack_technologies", error);
  console.log(`✓ ${rows.length} orbit technologies imported`);
}

async function seedProjects() {
  const selectedProjects = projectSlug
    ? projectSeed.filter((project) => project.slug === projectSlug)
    : projectSeed;

  if (projectSlug && selectedProjects.length === 0) {
    console.error(`✗ Unknown project slug: ${projectSlug}`);
    process.exit(1);
  }

  const { data: existing, error: readError } = await supabase
    .from("projects")
    .select("slug");
  if (readError) bail("Reading projects", readError);

  const known = new Set((existing ?? []).map((row) => row.slug));
  const rows = selectedProjects
    .filter((project) => force || !known.has(project.slug))
    .map((project) => ({
      slug: project.slug,
      title: project.title,
      tag: project.tag,
      image: project.image,
      gallery: project.gallery,
      client: project.client,
      duration: project.duration,
      preview_url: project.previewUrl,
      template_label: project.templateLabel,
      template_url: project.templateUrl,
      intro: project.intro,
      approach: project.approach,
      sections: project.sections,
      features: project.features,
      a11y_notes: project.a11yNotes,
      conclusion: project.conclusion,
      published: project.published,
      show_on_homepage: project.showOnHomepage,
      display_order: project.displayOrder,
    }));

  if (rows.length === 0) {
    console.log("✓ Projects already seeded (use --force to overwrite)");
    return;
  }

  const { error } = await supabase
    .from("projects")
    .upsert(rows, { onConflict: "slug" });
  if (error) bail("Seeding projects", error);
  console.log(`✓ ${rows.length} projects imported`);
}

if (projectSlug) {
  await seedProjects();
} else {
  await seedStack();
  await seedProjects();
  await seedAdmin();
}

console.log("\nDone. Start the app and open /dashboard.");
