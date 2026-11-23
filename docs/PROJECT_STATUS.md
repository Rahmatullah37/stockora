# Project Status

_Last updated: 2026-11-23 (interim build)_

## Summary
| Area | State |
|---|---|
| Phase 1 — auth, shop registration, settings, i18n | Built (earlier) |
| Database for ALL phases (migrations 1–7) | **Written and tested on a local PostgreSQL** (stock, weighted-average cost, sales, returns, purchases, payments, reports, employees, plan limits, super admin, RLS tenant isolation) |
| Shared foundation (formatter, error mapping, CSV, tables, modal, plan gates, shop switcher, multi-shop session) | Built |
| Server Actions + validation for sales, purchases, customers, suppliers, expenses | Written (compile clean), **no screens yet** |
| Screens: products/QR/scanner/inventory, POS, purchases, customers, suppliers, expenses, dashboard, reports, employees, admin, subscriptions | **NOT built yet** (sidebar links exist but the pages do not) |

## What was verified
- `tsc --noEmit` and `eslint`: clean.
- SQL behaviour tested against a real Postgres: weighted average cost (106 after buying 10@102 and 10@110), sale totals with 10% discount, idempotent sale (same key = same sale), stock errors, minimum-price guard, partial returns with credit offset, customer payments, profit/loss numbers (revenue 270, COGS 212, gross profit 58), tenant isolation (shop B sees nothing of shop A), cashier cannot read costs/ledger, staff invitation flow, per-shop permission override, downgrade guard.
- NOT verified: any browser screen, Supabase hosted project, email flows.

## Next
Build the screens for the modules above, one module at a time, then a full build + docs.
