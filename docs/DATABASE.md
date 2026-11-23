# Database (Supabase PostgreSQL)

## Applying migrations
Option A — SQL Editor (easiest): Supabase Dashboard → **SQL Editor** → New query. Paste and run, **in this order**:
1. `supabase/migrations/20261122000001_foundation.sql`
2. `supabase/migrations/20261122000002_reference_data.sql`
3. `supabase/migrations/20261122000003_regional_settings_function.sql`

Option B — Supabase CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.

`seed.sql` is empty on purpose in Phase 1 (roles, permissions and plans are required everywhere, so they are in migration 2).

## Tables created in Phase 1
`profiles`, `roles`, `permissions`, `role_permissions`, `subscription_plans`, `shops`, `shop_members`,
`subscriptions`, `shop_settings`, `audit_logs`.

Still to be created in later phases: categories, brands, products, product_barcodes, product_qr_codes,
suppliers, customers, purchases (+items, payments, returns), sales (+items, payments, returns),
inventory_movements, stock_transfers, expenses, financial_transactions.

## Security model
- RLS is enabled on every table. Helper functions: `is_super_admin()`, `is_shop_member()`,
  `has_shop_permission()`, `can_view_profile()`.
- Table privileges are revoked and re-granted minimally; `anon` has none.
- Internal functions (`create_shop_for_user`, `handle_new_user`, `log_audit`) cannot be called from the API.
- Audit triggers record changes to shops, shop settings and members in `audit_logs`.

## Make yourself Super Admin (manual step)
After you register, run once in the SQL Editor (use your own email):
```sql
update public.profiles set is_super_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

## Roles
owner, manager, cashier, inventory_manager, accountant (shop-level); super admin is a flag on `profiles`.
