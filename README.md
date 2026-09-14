# Lakindu Jayathilaka Portfolio

Production-ready portfolio built with Next.js 16 and Supabase. The repository
contains two packages:

- `frontend/`  — the website and admin dashboard deployed to Vercel
- `backend/` — Supabase migrations, seed import and database checks

## Local setup

Use Node.js 22 or newer.

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>. Without Supabase credentials, the public site
still renders the bundled portfolio content; the dashboard remains read-only.

## Supabase setup

1. Create a Supabase project.
2. Run every SQL file in `backend/supabase/migrations/` in numerical order.
3. Copy `frontend/.env.example` to `frontend/.env.local` and add the project URL
   and anon/public key.
4. Copy `backend/.env.example` to `backend/.env.local`. Add the same project URL
   and anon key, plus the service-role key and the admin account email.
5. Create that user in Supabase Authentication, then run:

```bash
cd backend
npm ci
npm run seed
```

Never commit either `.env.local` file. Never expose
`SUPABASE_SERVICE_ROLE_KEY` in the frontend or in Vercel.

## Vercel deployment

1. Upload this repository to GitHub and import it into Vercel.
2. In Vercel **Settings → General**, set **Root Directory** to `frontend`.
3. Add these Vercel environment variables for Production, Preview and
   Development:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (the final production origin, including `https://`)

4. Keep the detected framework as Next.js and deploy.

Do not add `SUPABASE_SERVICE_ROLE_KEY` or `SEED_ADMIN_EMAIL` to Vercel. The
`backend/` directory is setup tooling and is not deployed.

## Verification

Run these from `frontend/` before a release:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Detailed setup, test safety notes and troubleshooting are in
[`docs/README.md`](docs/README.md). Supabase-specific instructions are in
[`backend/README.md`](backend/README.md).
