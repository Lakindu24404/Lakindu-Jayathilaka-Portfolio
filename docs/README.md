# Portfolio

Lakindu Jayathilaka's portfolio: a Next.js 16 App Router site with a Supabase
backend and an admin dashboard at `/dashboard`.

The repository is split into two independent packages.

```
.
├── frontend/        the Next.js application — this is what Vercel deploys
├── backend/         Supabase migrations, the seed import and database checks
├── docs/            detailed setup and design documentation
├── README.md        client handover and deployment checklist
└── .gitignore       keeps secrets, caches and local tooling out of GitHub
```

Each package has its own `package.json` and lockfile. Local `.env.local` files,
dependency folders, build output and editor/tool metadata are deliberately
excluded from Git and from the client handover archive.

---

## Frontend

```bash
cd frontend
npm ci
npm run dev
```

The dev server runs at <http://localhost:3000>. On Windows you can instead
double-click `frontend/Start Portfolio.bat`, which changes to its own folder,
starts the dev server and opens the browser when the site answers.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc` over the app and the test sources |
| `npm run test:unit` | Node test runner over `tests/unit`. Read-only, no database |
| `npm run test:api` | **Mutating.** Public HTTP surface, against a running server |
| `npm run test:e2e` | **Mutating.** Playwright — builds and serves on port 3100 itself |
| `npm run qa` | **Mutating.** Build, serve, run the HTTP and browser suites, check the artifact |
| `npm test` | `test:unit` then `qa` — **mutating**, because of `qa` |

### Mutating vs read-only suites

`test:api` and several e2e specs create rows, upload storage objects and create
throwaway auth users, then delete them again. They are **not** read-only, and a
failed or interrupted run can leave `qa-` prefixed rows behind. Point them at a
scratch Supabase project — never at production.

| Suite | Writes to Supabase |
| --- | --- |
| `tests/api/public-reads` | **yes** — inserts projects and technologies to assert they render |
| `tests/e2e/projects-crud` | **yes** — full create/update/delete cycle |
| `tests/e2e/stack-crud` | **yes** — full create/update/delete cycle |
| `tests/e2e/auth` | **yes** — creates and deletes a throwaway admin user |
| `tests/e2e/upload` | **yes** — writes and removes storage objects |
| `tests/e2e/publish-cache` | **yes** — publishes and unpublishes rows |
| `tests/e2e/responsive-a11y` | **yes** — inserts a project for the case-study checks |
| `tests/e2e/hero` | no |
| `tests/e2e/about-title-motion` | no |
| `tests/e2e/folira-typography` | no |
| `tests/e2e/home-refresh` | no |
| `tests/e2e/navigation` | no |
| `tests/e2e/statistics-bar` | no |
| `tests/e2e/typography-motion` | no |

The read-only browser specs can be run on their own against any server:

```bash
cd frontend
QA_APP_ORIGIN=http://localhost:3000 npx playwright test tests/e2e/hero.spec.ts
```

### How those suites get their credentials

The mutating suites need an admin client, so `test:api`, `test:e2e` and the
child processes `qa` spawns load `../backend/.env.local` **in addition to**
`frontend/.env.local`. The backend file is listed first so the frontend's public
values still win for the two keys both files define.

`SUPABASE_SERVICE_ROLE_KEY` is deliberately **not** copied into
`frontend/.env.local`. It exists only in the test runner's own process: both
`scripts/qa.mjs` and `playwright.config.ts` strip it (and `SEED_ADMIN_EMAIL`)
from the environment they hand to the Next.js server they start, so the
application under test never sees it. `next dev`, `next build` and `next start`
read `frontend/.env.local` and nothing else.

## Backend

```bash
cd backend
npm ci
```

| Command | What it does |
| --- | --- |
| `npm run seed` | **Writes.** Imports the bundled content (idempotent; `--force` overwrites) |
| `npm run test:audit` | Read-only inventory of the live project. Safe against production |
| `npm run test:unit` | Audit logic against a stub client. Read-only, no database |
| `npm run test:db` | **Mutating.** Schema and RLS suites — creates `qa-` rows, then removes them |
| `npm run typecheck` | `tsc` over the seed script, tools and suites |
| `npm test` | All three suites — **mutating**, because of `test:db` |

Migrations live in `backend/supabase/migrations/` and are run by hand in the
Supabase SQL Editor, in numerical order. See [backend/README.md](../backend/README.md).

`backend/scripts/seed.mts` and the audit import the bundled content from
`frontend/src/content/portfolio-seed.ts` — the same module the site falls back
to when Supabase is unreachable, so one file defines both. That is the only
direction dependencies cross: backend reads from frontend, never the reverse.

## Environment

Each package has its own `.env.local`, both git-ignored, both with a committed
`.env.example` listing the variable names.

| | `frontend/.env.local` | `backend/.env.local` |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes (the RLS suite needs the anon role) |
| `NEXT_PUBLIC_SITE_URL` | yes | — |
| `SUPABASE_SERVICE_ROLE_KEY` | — | yes |
| `SEED_ADMIN_EMAIL` | — | yes |

The service-role key is deliberately absent from the frontend: it bypasses row
level security and must never reach the browser or Vercel's client variables.

## Content

Published content lives in Supabase and is edited at `/dashboard`. When Supabase
is not configured or unreachable the site renders the bundled content in
`frontend/src/content/portfolio-seed.ts`, so it shows the same six project case
studies and twenty-one stack technologies either way.

## Deploying

> **Manual step required.** The Vercel project's **Root Directory** must be
> changed to `frontend`. Until someone does that in the Vercel dashboard
> (Settings → General → Root Directory), builds will fail: the repository root
> no longer has a `package.json`. This cannot be set from the repository.

Under Settings → Environment Variables, Vercel gets exactly three:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`

**`SUPABASE_SERVICE_ROLE_KEY` and `SEED_ADMIN_EMAIL` must never be added to the
frontend or to Vercel.** The service-role key bypasses row level security, so
anything holding it can read and write every row regardless of policy. Neither
variable is read by the application; both belong in `backend/.env.local` on a
maintainer's machine only.

Supabase stays the hosted backend; nothing in `backend/` is deployed.

## Design

[docs/DESIGN.md](DESIGN.md) records the visual direction, the measured type and
motion tokens, and what each section is derived from.
