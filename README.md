# Stockora

**Smart Inventory. Smarter Business.**

A QR/barcode-based inventory, POS, accounting and multi-tenant SaaS platform for retail shops.
Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase.

> Current status: **Phase 1 (Foundation) is built.** See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

## What works today (Phase 1)

- Sign up (with shop registration), login, logout, forgot/reset password, email verification
- Every sign-up creates an isolated **shop** + owner membership + default settings + Free plan (one database transaction)
- Multi-tenant database with Row Level Security (RLS), roles and permissions
- Shop profile, regional settings (currency, tax, date format, time zone, language) and account settings
- English, Urdu and Pashto texts (Urdu/Pashto switch the layout to right-to-left)
- Dashboard shell with sidebar navigation (module pages arrive in later phases)

## Quick start (Windows, VS Code terminal)

```bash
npm install
copy .env.example .env.local     # then open .env.local and fill in the values
npm run dev
```

Open http://localhost:3000. If the Supabase variables are missing, the app shows a
setup guide automatically.

### 1. Create the Supabase project
1. Go to https://supabase.com → **New project**.
2. **Project Settings → API**: copy the *Project URL* and the *anon/publishable key* into `.env.local`.
3. Apply the database migrations (see [docs/DATABASE.md](docs/DATABASE.md)).
4. **Authentication → URL Configuration**: set *Site URL* to `http://localhost:3000` and add
   `http://localhost:3000/auth/callback` to *Redirect URLs*.

### 2. Environment variables

| Variable | Where it is used | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | no |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server (protected by RLS) | no |
| `NEXT_PUBLIC_SITE_URL` | email links (verify / reset) | no |
| `SUPABASE_SERVICE_ROLE_KEY` | server only, Phase 5+ | **YES — never commit it** |

## Useful commands

```bash
npm run dev      # start the development server
npm run lint     # ESLint
npx tsc --noEmit # TypeScript check
npm run build    # production build
```

## Documentation

- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — what is done / what is next
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the code is organised and why
- [docs/DATABASE.md](docs/DATABASE.md) — tables, security, how to apply migrations
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GitHub + Vercel + Supabase checklist
- [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) — history of decisions
