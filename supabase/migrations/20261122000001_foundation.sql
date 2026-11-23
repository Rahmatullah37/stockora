-- =============================================================================
-- Stockora — Migration 1: Foundation (Phase 1)
-- =============================================================================
-- Creates the multi-tenant foundation:
--   profiles, roles, permissions, role_permissions, subscription_plans,
--   shops, shop_members, subscriptions, shop_settings, audit_logs
--
-- HOW MULTI-TENANCY WORKS
--   * Every business table carries a `shop_id`.
--   * Row Level Security (RLS) lets a user see a row only if they are an
--     ACTIVE member of that shop (checked by the helper functions below).
--   * RLS is enforced by the database itself, so even a bug in the app code
--     cannot leak Shop A's data to Shop B.
--
-- No credentials are stored in this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Generic helper: keep `updated_at` correct automatically
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. profiles — one row per login user (extends Supabase's auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null default '',
  phone              text,
  avatar_url         text,
  preferred_language text not null default 'en'
                       check (preferred_language in ('en', 'ur', 'ps')),
  -- Platform-level super admin (the SaaS owner). NOT a shop role.
  -- Users can never change this themselves (see column grants below).
  is_super_admin     boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. roles / permissions — who can do what inside a shop
-- -----------------------------------------------------------------------------
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+$'),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z_]+\.[a-z_]+$'), -- e.g. products.manage
  module      text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- Which permissions each role has (the default mapping for every shop).
create table public.role_permissions (
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);
create index role_permissions_permission_id_idx on public.role_permissions (permission_id);

-- -----------------------------------------------------------------------------
-- 4. subscription_plans — FREE / STARTER / PRO / BUSINESS (editable data)
-- -----------------------------------------------------------------------------
create table public.subscription_plans (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique check (key ~ '^[a-z_]+$'),
  name          text not null,
  description   text,
  price_monthly numeric(12, 2) not null default 0 check (price_monthly >= 0),
  price_yearly  numeric(12, 2) not null default 0 check (price_yearly >= 0),
  currency      char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  trial_days    integer not null default 0 check (trial_days >= 0),
  -- Plan limits. NULL means "unlimited".
  max_products  integer check (max_products is null or max_products >= 0),
  max_employees integer check (max_employees is null or max_employees >= 0),
  max_branches  integer check (max_branches is null or max_branches >= 0),
  features      jsonb not null default '[]'::jsonb,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger subscription_plans_set_updated_at
  before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. shops — one row per business (the "tenant")
-- -----------------------------------------------------------------------------
create table public.shops (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete restrict,
  name              text not null check (char_length(btrim(name)) between 2 and 120),
  email             text,
  phone             text,
  country           char(2) not null check (country ~ '^[A-Z]{2}$'),   -- ISO 3166-1 alpha-2
  address           text,
  currency          char(3) not null check (currency ~ '^[A-Z]{3}$'),  -- ISO 4217
  business_category text not null default 'general'
                      check (business_category in (
                        'grocery', 'clothing', 'electronics', 'cosmetics',
                        'general', 'wholesale', 'distributor', 'other')),
  -- Super admin can suspend a shop (e.g. unpaid subscription).
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index shops_owner_id_idx on public.shops (owner_id);

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. shop_members — which user belongs to which shop, with which role
-- -----------------------------------------------------------------------------
create table public.shop_members (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    uuid not null references public.roles (id) on delete restrict,
  status     text not null default 'active'
               check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id)
);
create index shop_members_user_id_idx on public.shop_members (user_id);
create index shop_members_role_id_idx on public.shop_members (role_id);

create trigger shop_members_set_updated_at
  before update on public.shop_members
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. subscriptions — a shop's plan history (one row per subscription period)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  shop_id                  uuid not null references public.shops (id) on delete cascade,
  plan_id                  uuid not null references public.subscription_plans (id) on delete restrict,
  status                   text not null
                             check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  payment_status           text not null default 'not_required'
                             check (payment_status in ('not_required', 'pending', 'paid', 'failed', 'refunded')),
  trial_ends_at            timestamptz,
  current_period_start     timestamptz not null default now(),
  current_period_end       timestamptz,
  canceled_at              timestamptz,
  -- Filled in later when a real payment provider is connected.
  payment_provider         text,
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index subscriptions_shop_id_idx on public.subscriptions (shop_id);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
-- A shop may have only ONE current subscription; older rows are its history.
create unique index subscriptions_one_current_per_shop
  on public.subscriptions (shop_id)
  where status in ('trialing', 'active', 'past_due');

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 8. shop_settings — regional + business preferences (one row per shop)
-- -----------------------------------------------------------------------------
create table public.shop_settings (
  shop_id        uuid primary key references public.shops (id) on delete cascade,
  language       text not null default 'en' check (language in ('en', 'ur', 'ps')),
  date_format    text not null default 'dd/MM/yyyy'
                   check (date_format in ('dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd')),
  timezone       text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  tax_enabled    boolean not null default false,
  tax_name       text not null default 'Tax' check (char_length(btrim(tax_name)) between 1 and 30),
  tax_rate       numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  -- Inventory costing method. Only weighted average for now (see project docs).
  costing_method text not null default 'weighted_average'
                   check (costing_method in ('weighted_average')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger shop_settings_set_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 9. audit_logs — append-only history of important changes
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid references public.shops (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,            -- create / update / delete / custom
  entity_type text not null,            -- table name, e.g. 'shops'
  entity_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_shop_created_idx on public.audit_logs (shop_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_user_id_idx on public.audit_logs (user_id);

-- =============================================================================
-- HELPER FUNCTIONS used by RLS policies
-- They are SECURITY DEFINER so they can read shop_members without triggering
-- RLS recursion. `set search_path = ''` is a Supabase security best practice.
-- =============================================================================

-- Is the current user the platform super admin?
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Is the current user an ACTIVE member of this shop (and is the shop active)?
create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    join public.shops s on s.id = m.shop_id
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and s.is_active
  );
$$;

-- Does the current user have a specific permission (e.g. 'products.manage') in this shop?
create or replace function public.has_shop_permission(p_shop_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_members m
    join public.shops s on s.id = m.shop_id
    join public.role_permissions rp on rp.role_id = m.role_id
    join public.permissions p on p.id = rp.permission_id
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and s.is_active
      and p.key = p_permission
  );
$$;

-- May the current user read this person's profile?
-- Yes if it's themselves, or they may view employees of a shop the person belongs to.
create or replace function public.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid()
    or public.is_super_admin()
    or exists (
      select 1
      from public.shop_members t
      where t.user_id = p_user_id
        and public.has_shop_permission(t.shop_id, 'employees.view')
    );
$$;

-- =============================================================================
-- AUDIT TRIGGER FUNCTION (reusable for any table that has shop_id or is `shops`)
-- =============================================================================
create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     jsonb;
  v_shop_id uuid;
  v_entity  uuid;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  if tg_table_name = 'shops' then
    v_shop_id := (v_row ->> 'id')::uuid;
  else
    v_shop_id := (v_row ->> 'shop_id')::uuid;
  end if;

  -- Most tables have an `id`; shop_settings uses shop_id as its key.
  v_entity := coalesce((v_row ->> 'id')::uuid, v_shop_id);

  insert into public.audit_logs (shop_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_shop_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger shops_audit
  after update on public.shops
  for each row execute function public.log_audit();

create trigger shop_settings_audit
  after update on public.shop_settings
  for each row execute function public.log_audit();

create trigger shop_members_audit
  after update or delete on public.shop_members
  for each row execute function public.log_audit();

-- =============================================================================
-- SHOP CREATION (internal) + SIGN-UP TRIGGER
-- =============================================================================
-- Creates a shop together with its owner membership, default settings and a
-- FREE subscription — all in ONE transaction (if any step fails, nothing is
-- saved). Not callable from the browser (privileges revoked below).
create or replace function public.create_shop_for_user(
  p_user_id           uuid,
  p_name              text,
  p_email             text,
  p_phone             text,
  p_country           text,
  p_address           text,
  p_currency          text,
  p_business_category text,
  p_language          text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop_id    uuid;
  v_owner_role uuid;
  v_free_plan  uuid;
begin
  select id into v_owner_role from public.roles where key = 'owner';
  select id into v_free_plan from public.subscription_plans where key = 'free';

  if v_owner_role is null or v_free_plan is null then
    raise exception 'Reference data missing (roles/plans). Apply ALL migrations first.';
  end if;

  insert into public.shops (owner_id, name, email, phone, country, address, currency, business_category)
  values (p_user_id, p_name, p_email, p_phone, p_country, p_address, p_currency, p_business_category)
  returning id into v_shop_id;

  insert into public.shop_members (shop_id, user_id, role_id)
  values (v_shop_id, p_user_id, v_owner_role);

  insert into public.shop_settings (shop_id, language)
  values (v_shop_id, case when p_language in ('en', 'ur', 'ps') then p_language else 'en' end);

  insert into public.subscriptions (shop_id, plan_id, status, payment_status)
  values (v_shop_id, v_free_plan, 'active', 'not_required');

  insert into public.audit_logs (shop_id, user_id, action, entity_type, entity_id, new_data)
  values (v_shop_id, p_user_id, 'create', 'shops', v_shop_id,
          jsonb_build_object('name', p_name, 'country', p_country, 'currency', p_currency));

  return v_shop_id;
end;
$$;

-- Runs automatically whenever someone signs up (a row appears in auth.users).
-- The sign-up form sends the shop details as "user metadata"; we turn them into
-- a profile + shop. This works even when email verification is required,
-- because it doesn't need the user to be logged in yet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_language text  := case when v_meta ->> 'language' in ('en', 'ur', 'ps') then v_meta ->> 'language' else 'en' end;
begin
  insert into public.profiles (id, full_name, phone, preferred_language)
  values (
    new.id,
    coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    nullif(btrim(v_meta ->> 'phone_number'), ''),
    v_language
  );

  -- Only create a shop when the sign-up included shop details.
  -- (Invited employees, added in a later phase, sign up without them.)
  if nullif(btrim(v_meta ->> 'shop_name'), '') is not null then
    perform public.create_shop_for_user(
      new.id,
      btrim(v_meta ->> 'shop_name'),
      new.email,
      nullif(btrim(v_meta ->> 'phone_number'), ''),
      upper(btrim(coalesce(v_meta ->> 'country', ''))),
      nullif(btrim(v_meta ->> 'address'), ''),
      upper(btrim(coalesce(v_meta ->> 'currency', ''))),
      coalesce(nullif(btrim(v_meta ->> 'business_category'), ''), 'general'),
      v_language
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Internal functions must not be callable through the public API.
revoke all on function public.create_shop_for_user(uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.log_audit() from public, anon, authenticated;

-- RLS helper functions: only logged-in users need them.
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.is_shop_member(uuid) from public, anon;
revoke all on function public.has_shop_permission(uuid, text) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_shop_member(uuid) to authenticated;
grant execute on function public.has_shop_permission(uuid, text) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles           enable row level security;
alter table public.roles              enable row level security;
alter table public.permissions        enable row level security;
alter table public.role_permissions   enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.shops              enable row level security;
alter table public.shop_members       enable row level security;
alter table public.subscriptions      enable row level security;
alter table public.shop_settings      enable row level security;
alter table public.audit_logs         enable row level security;

-- ---- profiles ---------------------------------------------------------------
create policy "profiles: read own or permitted"
  on public.profiles for select to authenticated
  using (public.can_view_profile(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---- reference data (everyone logged in may read; only super admin writes plans)
create policy "roles: read" on public.roles for select to authenticated using (true);
create policy "permissions: read" on public.permissions for select to authenticated using (true);
create policy "role_permissions: read" on public.role_permissions for select to authenticated using (true);

create policy "plans: read" on public.subscription_plans for select to authenticated using (true);
create policy "plans: super admin insert" on public.subscription_plans for insert to authenticated
  with check (public.is_super_admin());
create policy "plans: super admin update" on public.subscription_plans for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "plans: super admin delete" on public.subscription_plans for delete to authenticated
  using (public.is_super_admin());

-- ---- shops ------------------------------------------------------------------
-- Members can always read their own shop row (even if suspended, so the app can
-- show a "shop suspended" message).
create policy "shops: read own shops"
  on public.shops for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.shop_members m
      where m.shop_id = shops.id and m.user_id = auth.uid() and m.status = 'active'
    )
  );

create policy "shops: update with settings permission"
  on public.shops for update to authenticated
  using (public.has_shop_permission(id, 'settings.manage'))
  with check (public.has_shop_permission(id, 'settings.manage'));
-- No INSERT / DELETE policies: shops are created by create_shop_for_user() only.

-- ---- shop_members -----------------------------------------------------------
create policy "shop_members: read own or permitted"
  on public.shop_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_shop_permission(shop_id, 'employees.view')
    or public.is_super_admin()
  );
-- Writes happen from trusted server code in a later phase (employee management).

-- ---- subscriptions ----------------------------------------------------------
create policy "subscriptions: members read"
  on public.subscriptions for select to authenticated
  using (public.is_shop_member(shop_id) or public.is_super_admin());
-- Writes: only the server (service role) or super admin tooling — no client policies.

-- ---- shop_settings ----------------------------------------------------------
create policy "shop_settings: members read"
  on public.shop_settings for select to authenticated
  using (public.is_shop_member(shop_id) or public.is_super_admin());

create policy "shop_settings: update with settings permission"
  on public.shop_settings for update to authenticated
  using (public.has_shop_permission(shop_id, 'settings.manage'))
  with check (public.has_shop_permission(shop_id, 'settings.manage'));

-- ---- audit_logs (read-only for clients; written by triggers/functions) -------
create policy "audit_logs: read with audit permission"
  on public.audit_logs for select to authenticated
  using (
    public.is_super_admin()
    or (shop_id is not null and public.has_shop_permission(shop_id, 'audit.view'))
  );

-- =============================================================================
-- TABLE PRIVILEGES (defense in depth, on top of RLS)
-- Supabase grants broad access by default; we remove everything and add back
-- only what the app needs. Anonymous (not logged in) users get nothing.
-- =============================================================================
revoke all on public.profiles, public.roles, public.permissions, public.role_permissions,
              public.subscription_plans, public.shops, public.shop_members,
              public.subscriptions, public.shop_settings, public.audit_logs
  from anon, authenticated;

grant select on public.profiles, public.roles, public.permissions, public.role_permissions,
                public.subscription_plans, public.shops, public.shop_members,
                public.subscriptions, public.shop_settings, public.audit_logs
  to authenticated;

-- Users may change ONLY these columns (so nobody can make themselves super admin
-- or transfer a shop's ownership from the browser).
grant update (full_name, phone, avatar_url, preferred_language) on public.profiles to authenticated;
grant update (name, email, phone, country, address, currency, business_category) on public.shops to authenticated;
grant update (language, date_format, timezone, tax_enabled, tax_name, tax_rate) on public.shop_settings to authenticated;

-- Super admin plan management (RLS policies above restrict this to super admins).
grant insert, update, delete on public.subscription_plans to authenticated;
