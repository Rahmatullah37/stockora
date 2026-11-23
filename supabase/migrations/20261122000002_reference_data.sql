-- =============================================================================
-- Stockora — Migration 2: Reference data (roles, permissions, plans)
-- =============================================================================
-- This is SYSTEM configuration the app needs in every environment (including
-- production), so it lives in a migration and not in seed.sql.
-- It is safe to run more than once (uses ON CONFLICT).
-- =============================================================================

-- ---- Roles (shop-level). The platform Super Admin is a flag on profiles. -----
insert into public.roles (key, name, description) values
  ('owner',             'Shop Owner',        'Full control of the shop, including billing.'),
  ('manager',           'Shop Manager',      'Runs daily operations; cannot manage billing, staff or shop settings.'),
  ('cashier',           'Cashier',           'Uses the POS and manages customers.'),
  ('inventory_manager', 'Inventory Manager', 'Manages products, stock, purchases and suppliers.'),
  ('accountant',        'Accountant',        'Views financial data and manages expenses.')
on conflict (key) do update
  set name = excluded.name, description = excluded.description;

-- ---- Permission catalog (all modules, so later phases need no new keys) ------
insert into public.permissions (key, module, description) values
  ('products.view',       'products',     'View products'),
  ('products.manage',     'products',     'Create, edit and archive products'),
  ('inventory.view',      'inventory',    'View stock levels and history'),
  ('inventory.adjust',    'inventory',    'Adjust, transfer and write off stock'),
  ('sales.view',          'sales',        'View sales and invoices'),
  ('sales.create',        'sales',        'Use the POS to make sales'),
  ('sales.refund',        'sales',        'Process sales returns and refunds'),
  ('purchases.view',      'purchases',    'View purchases'),
  ('purchases.manage',    'purchases',    'Create and edit purchases'),
  ('customers.view',      'customers',    'View customers'),
  ('customers.manage',    'customers',    'Create and edit customers'),
  ('suppliers.view',      'suppliers',    'View suppliers'),
  ('suppliers.manage',    'suppliers',    'Create and edit suppliers'),
  ('expenses.view',       'expenses',     'View expenses'),
  ('expenses.manage',     'expenses',     'Create and edit expenses'),
  ('reports.view',        'reports',      'View reports and analytics'),
  ('finance.view',        'finance',      'View cost prices, profit and financial figures'),
  ('employees.view',      'employees',    'View staff members'),
  ('employees.manage',    'employees',    'Invite staff and change their roles'),
  ('settings.view',       'settings',     'View shop settings'),
  ('settings.manage',     'settings',     'Change shop settings'),
  ('audit.view',          'audit',        'View the audit log'),
  ('subscription.manage', 'subscription', 'Manage the shop subscription and billing')
on conflict (key) do update
  set module = excluded.module, description = excluded.description;

-- ---- Role -> permission mapping ---------------------------------------------
-- Owner: everything.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'owner'
on conflict do nothing;

-- Manager: everything except billing, staff management and shop settings changes.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.key = 'manager'
  and p.key not in ('subscription.manage', 'employees.manage', 'settings.manage')
on conflict do nothing;

-- The remaining roles get an explicit list.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('cashier', array[
    'products.view', 'inventory.view', 'sales.view', 'sales.create',
    'customers.view', 'customers.manage', 'settings.view'
  ]),
  ('inventory_manager', array[
    'products.view', 'products.manage', 'inventory.view', 'inventory.adjust',
    'purchases.view', 'purchases.manage', 'suppliers.view', 'suppliers.manage',
    'settings.view'
  ]),
  ('accountant', array[
    'sales.view', 'purchases.view', 'customers.view', 'suppliers.view',
    'expenses.view', 'expenses.manage', 'reports.view', 'finance.view',
    'audit.view', 'settings.view'
  ])
) as m (role_key, permission_keys)
join public.roles r on r.key = m.role_key
join public.permissions p on p.key = any (m.permission_keys)
on conflict do nothing;

-- ---- Subscription plans ------------------------------------------------------
-- NOTE: prices are 0 on purpose. Real pricing is a business decision; it will be
-- editable by the Super Admin in Phase 5. Limits below are starting defaults.
-- NULL limit = unlimited.
insert into public.subscription_plans
  (key, name, description, max_products, max_employees, max_branches, trial_days, sort_order, features)
values
  ('free',     'Free',     'Try Stockora with basic inventory and sales.',            50,   0,    1,    0,  1,
    '["Limited products", "Basic inventory", "Basic sales"]'::jsonb),
  ('starter',  'Starter',  'More products, QR scanning and POS for a growing shop.',  1000, 2,    1,    14, 2,
    '["More products", "QR scanning", "POS", "Basic reports"]'::jsonb),
  ('pro',      'Pro',      'Advanced analytics, staff accounts and financial reports.', 10000, 10, 1,  14, 3,
    '["Advanced analytics", "Employee accounts", "Advanced inventory", "Financial reports"]'::jsonb),
  ('business', 'Business', 'Multiple branches, advanced permissions and priority support.', null, null, null, 14, 4,
    '["Multiple branches", "Advanced permissions", "Detailed reporting", "Priority support"]'::jsonb)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      features = excluded.features,
      sort_order = excluded.sort_order;
-- (Limits and prices are NOT overwritten on re-run, so edits you make later stay.)
