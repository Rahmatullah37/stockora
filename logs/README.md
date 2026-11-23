# Logs
Snapshots from 2026-11-22 (Phase 1). Re-generate with:
  npx tsc --noEmit > logs/typescript-check.log 2>&1
  npx eslint > logs/eslint.log 2>&1
  npm run build > logs/build.log 2>&1
Runtime errors: check the terminal running `npm run dev`, Vercel -> Deployments -> Logs, and Supabase -> Logs (Auth / Postgres).
Also see docs/DEVELOPMENT_LOG.md.
