# Backend

Supabase is the hosted backend. This package holds the migrations, the seed
import and the read-only audit; nothing here is deployed. Run every command
below from `backend/` after `npm ci`.

## Commands

```bash
cd backend
npm ci
```

| Command | What it does |
| --- | --- |
| `npm run seed` | Import the bundled content. Idempotent — existing rows are left alone; `--force` overwrites them |
| `npm run test:audit` | Read-only inventory of the live project. Writes nothing |
| `npm run test:unit` | Audit logic against a stub client. Touches no database |
| `npm run test:db` | Schema and RLS suites. **Writes** `qa-`prefixed rows and removes them afterwards — do not point these at production |
| `npm run typecheck` | `tsc` over the seed script, tools and suites |
| `npm test` | `test:unit`, `test:db` and `test:audit` |

Migrations are never applied by any of these. Run them by hand in the Supabase
SQL Editor, in numerical order, as described below.

## Dashboard setup

The admin dashboard at `/dashboard` stores the **Stack Orbit** and **Projects**
content in Supabase. Until Supabase is configured the portfolio renders the
bundled content in `frontend/src/content/portfolio-seed.ts` and the dashboard shows a
setup notice instead of the editor — nothing breaks, it is just read-only.

---

## 1. Create the project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → Data API** and copy:
   - the **Project URL**
   - the **anon / public** key
   - the **service_role** key (keep this one secret)

## 2. Run the migrations

Open **SQL Editor** in the Supabase dashboard and run the files in
`backend/supabase/migrations/` **in order**:

| File | What it does |
| --- | --- |
| `0001_portfolio_schema.sql` | Tables, indexes, the `admin_users` allow-list, `is_admin()`, and the two reorder functions |
| `0002_rls_policies.sql` | Row level security: anon reads published/enabled rows only, admins write |
| `0003_storage.sql` | The `stack-logos` and `project-images` buckets and their policies |
| `0004_far_outer_ring.sql` | Widens `stack_technologies.ring` to allow the fourth ring |
| `0005_stack_logo_fit.sql` | Adds `logo_scale`, `logo_offset_x` and `logo_offset_y` for the Logo fit editor |

All of them are idempotent, so re-running them is safe.

`0004` and `0005` are incremental: `create table if not exists` leaves an
existing table alone, so a database created before those changes needs them
even though `0001` now describes the finished shape. Until `0005` has run the
public site logs `Supabase read failed for "stack_technologies": 400` and falls
back to the bundled seed content, because the app asks for three columns the
database does not have yet.

## 3. Configure the environment

```bash
cd backend
cp .env.example .env.local
```

The frontend has its own `frontend/.env.local` for the two `NEXT_PUBLIC_`
variables. `SUPABASE_SERVICE_ROLE_KEY` and `SEED_ADMIN_EMAIL` belong only
here — the deployed application never reads this file.

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`.

> `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix on purpose. It
> bypasses row level security and is read **only** by `npm run seed`, the audit
> and the QA suites. The running application never touches it, so it never
> reaches the browser.

### What goes to Vercel

**Do not add these variables to Vercel.** The deployment builds `frontend/`,
and only three variables belong there:

| Variable | Vercel |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `NEXT_PUBLIC_SITE_URL` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | **never** |
| `SEED_ADMIN_EMAIL` | **never** |

`SUPABASE_SERVICE_ROLE_KEY` bypasses row level security entirely; anything
holding it can read and write every row regardless of policy. `SEED_ADMIN_EMAIL`
names the account that gets dashboard access. Neither is read by the
application, so adding them to the frontend or to Vercel buys nothing and
widens the blast radius of a leaked build log or a compromised deployment.
Both belong in `backend/.env.local` on a maintainer's machine only.

## 4. Create your admin account

1. In Supabase, go to **Authentication → Users → Add user**, and create your
   account with a password. (Email sign-ups from the public site are not wired
   to the dashboard — administrators are added deliberately.)
2. Put that email in `SEED_ADMIN_EMAIL` in `.env.local`.

Being an authenticated Supabase user is not enough on its own: the account also
has to be listed in `public.admin_users`, which is what `is_admin()` and every
RLS policy check. The seed script adds it for you, or do it by hand:

```sql
insert into public.admin_users (user_id, email)
select id, email from auth.users where email = 'you@example.com';
```

## 5. Import the existing content

```bash
cd backend
npm run seed
```

This imports the twenty-one orbit technologies and the six project case studies
that shipped with the portfolio, then grants `SEED_ADMIN_EMAIL` dashboard
access. It is idempotent — existing rows are left alone, so a second run never
overwrites your edits. Pass `--force` if you deliberately want to reset the
seeded rows back to their original content.

## 6. Start the app

```bash
cd frontend
npm run dev
```

Open <http://localhost:3000/dashboard> and sign in.

---

## How it fits together

```
Public pages ──► frontend/src/lib/data/public.ts ──► PostgREST over fetch (anon key)
                                            cached under portfolio:stack /
                                            portfolio:projects tags

Dashboard    ──► Server Actions ──► PortfolioRepository ──► supabase-js
                 (Zod validation)   (frontend/src/lib/data)  (session bound)
                        │
                        └──► revalidateTag + revalidatePath
```

- **Reads** on the public site go through plain `fetch` so they land in the
  Next.js Data Cache. That keeps `/` and every `/[slug]` statically prerendered
  and lets a publish invalidate exactly the pages that changed.
- **Writes** go through `supabase-js` bound to the signed-in administrator's
  session, so Postgres RLS is the authorisation boundary. Nothing in the app
  runs as `service_role`.
- **Storage** uploads go to `/api/dashboard/upload`, which re-checks the admin
  session, sniffs the magic bytes, refuses SVGs containing script or event
  handlers, and only then writes to the bucket.

## Swapping the backend

The dashboard is written against the `PortfolioRepository` interface in
`frontend/src/lib/data/repository.ts`. To move off Supabase, add a second implementation
alongside `SupabasePortfolioRepository` and return it from `getAdminSession()` in
`frontend/src/lib/auth.ts`. No page or component imports Supabase directly.

## Troubleshooting

**"That account does not have dashboard access."** The user exists in Supabase
Auth but is not in `admin_users`. Run the `insert` from step 4.

**The dashboard shows the setup notice.** One of the two `NEXT_PUBLIC_` variables
is missing or empty. Restart the dev server after editing `.env.local` —
`NEXT_PUBLIC_` values are inlined at build time.

**Images do not load after upload.** `next.config.ts` derives its
`images.remotePatterns` entry from `NEXT_PUBLIC_SUPABASE_URL`. If that variable
was added after the last build, rebuild.

**A published change is not on the live site.** Publishing calls
`revalidateTag(..., "max")`, which is stale-while-revalidate: the first visitor
after the change gets the old page and triggers the refresh in the background.
The second request has the new content.
