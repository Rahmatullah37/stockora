# Architecture

## Layers (and why they are separate)
| Folder | Purpose |
|---|---|
| `src/app/` | Pages and routes only. Thin: they load data and render components. |
| `src/components/ui` | Generic building blocks (Button, Input, Card, Alert, Badge). |
| `src/components/layout` | App shell, sidebar, language switcher. |
| `src/components/shared` | Reusable pieces (PageHeader, FormField, StatusScreen). |
| `src/features/<module>/` | One folder per business module: its components + **Server Actions** (`actions.ts`). |
| `src/lib/supabase` | Supabase clients (server + session refresh in the proxy). |
| `src/lib/auth` | `session.ts` (who is logged in, which shop, which permissions) and `guards.ts` (server permission check). |
| `src/lib/validations` | Zod schemas, shared by forms and Server Actions. |
| `src/lib/permissions` | Permission keys (must match the `permissions` table). |
| `src/lib/i18n` | Translation system (en/ur/ps), cookie-based language. |
| `src/config` | Static lists: navigation, countries/currencies, business categories. |
| `supabase/migrations` | Database schema (the source of truth). |

## Key decisions
1. **Multi-tenancy by `shop_id` + RLS.** Security lives in the database, so an app bug cannot leak
   another shop's data.
2. **Sign-up creates the shop in a database trigger** (`handle_new_user`). It works even before the
   email is verified and runs as one transaction: no half-created accounts.
3. **Server Actions re-validate everything** with Zod and call `requireShopPermission()`; the browser
   is never trusted. RLS checks again underneath.
4. **Next.js 16 "proxy"** (`src/proxy.ts`, formerly middleware) redirects logged-out users to `/login`
   and shows `/setup` if Supabase variables are missing.
5. **Money is `numeric(12,2)` in the database** (never floats). Calculation helpers will go in
   `src/lib/calculations` in Phase 2/4.
6. **Users can only update whitelisted columns** (column-level grants), so nobody can make themselves
   super admin or change a shop's owner from the browser.
7. **Roles are data** (`roles`, `permissions`, `role_permissions`), so permissions can later be made
   configurable per shop without code changes.

> Note: this Next.js version has breaking changes. Read `node_modules/next/dist/docs/` before using
> an API you are unsure about (see `AGENTS.md`).
