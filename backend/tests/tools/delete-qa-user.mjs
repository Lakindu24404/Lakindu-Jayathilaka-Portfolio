/** Deletes QA auth users and their admin_users rows by email prefix. */
import { createClient } from "@supabase/supabase-js";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } },
);

const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
if (error) throw error;

const targets = data.users.filter((u) => /^qa-\d{10,}-/.test(u.email ?? ""));
for (const user of targets) {
  await db.from("admin_users").delete().eq("user_id", user.id);
  await db.auth.admin.deleteUser(user.id);
  console.log("deleted auth user " + user.id);
}
console.log(`removed ${targets.length} QA auth user(s)`);
