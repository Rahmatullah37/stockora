-- =============================================================================
-- Stockora — Migration 4: Inventory core (Phase 2)
-- =============================================================================
-- Creates: plan feature flags, branches, categories, brands, suppliers,
-- customers, products (+ costs, barcodes, QR codes), inventory ledger, branch
-- stock, stock transfers, and the secure functions that change stock.
--
-- GOLDEN RULES
--   * Every table has shop_id. RLS only shows rows of shops you belong to.
--   * Stock is NEVER edited directly. products.current_stock only changes
--     inside _change_stock(), which ALSO writes a row to inventory_movements
--     (the ledger) with a reason and a reference. The ledger is append-only.
--   * Cost prices live in product_costs, readable only with `finance.view`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Permission mapping tweaks (cashiers must not see cost data)
-- -----------------------------------------------------------------------------
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.key = 'cashier' and p.key = 'inventory.view';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'inventory_manager' and p.key in ('finance.view', 'reports.view')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 1. Plan feature flags (what each plan may use)
-- -----------------------------------------------------------------------------
alter table public.subscription_plans
  add column if not exists feature_flags text[] not null default '{}';

update public.subscription_plans set feature_flags = case key
  when 'free'     then array[]::text[]
  when 'starter'  then array['scanner', 'basic_reports']
  when 'pro'      then array['scanner', 'basic_reports', 'analytics', 'employees', 'advanced_inventory', 'financial_reports']
  when 'business' then array['scanner', 'basic_reports', 'analytics', 'employees', 'advanced_inventory', 'financial_reports', 'branches', 'advanced_permissions', 'detailed_reports']
  else feature_flags end;

-- The plan a shop is really on right now. Expired trials / periods fall back to Free.
create or replace function public.shop_plan(p_shop_id uuid)
returns public.subscription_plans
language sql
stable
security definer
set search_path = ''
as $$
  select p.*
  from public.subscription_plans p
  where p.id = coalesce(
    (select s.plan_id
       from public.subscriptions s
      where s.shop_id = p_shop_id
        and s.status in ('trialing', 'active', 'past_due')
        and (s.status <> 'trialing' or s.trial_ends_at is null or s.trial_ends_at > now())
        and (s.current_period_end is null or s.current_period_end > now())
      limit 1),
    (select id from public.subscription_plans where key = 'free')
  );
$$;

create or replace function public.plan_has_feature(p_shop_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_feature = any ((public.shop_plan(p_shop_id)).feature_flags);
$$;

-- -----------------------------------------------------------------------------
-- 2. Shared helper functions
-- -----------------------------------------------------------------------------
-- Raises "permission denied" unless the current user has the permission in the shop.
create or replace function public.assert_permission(p_shop_id uuid, p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_shop_permission(p_shop_id, p_permission) then
    raise exception 'You do not have permission to do this.' using errcode = '42501';
  end if;
end;
$$;

-- Raises unless the shop's plan includes a feature (e.g. 'scanner', 'branches').
create or replace function public.assert_feature(p_shop_id uuid, p_feature text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.plan_has_feature(p_shop_id, p_feature) then
    raise exception 'PLAN_FEATURE: your current plan does not include "%". Please upgrade.', p_feature
      using errcode = 'P0001';
  end if;
end;
$$;

-- Per-shop running numbers (invoice numbers, SKU numbers, ...). Atomic: two
-- people saving at the same moment can never get the same number.
create table public.shop_counters (
  shop_id uuid not null references public.shops (id) on delete cascade,
  name    text not null,
  value   bigint not null default 0,
  primary key (shop_id, name)
);
alter table public.shop_counters enable row level security;
-- no policies: only internal functions touch this table.

create or replace function public.next_number(p_shop_id uuid, p_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value bigint;
begin
  insert into public.shop_counters (shop_id, name, value)
  values (p_shop_id, p_name, 1)
  on conflict (shop_id, name) do update set value = public.shop_counters.value + 1
  returning value into v_value;
  return v_value;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. branches (every shop has one "main" branch; more on the Business plan)
-- -----------------------------------------------------------------------------
create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  address    text,
  is_main    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);
create unique index branches_one_main_per_shop on public.branches (shop_id) where is_main;
create unique index branches_name_unique on public.branches (shop_id, lower(name));
create trigger branches_set_updated_at before update on public.branches
  for each row execute function public.set_updated_at();

-- Create the main branch automatically for every new shop (and existing ones).
create or replace function public.create_main_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.branches (shop_id, name, is_main) values (new.id, 'Main branch', true);
  return new;
end;
$$;
create trigger shops_create_main_branch after insert on public.shops
  for each row execute function public.create_main_branch();
insert into public.branches (shop_id, name, is_main)
select s.id, 'Main branch', true from public.shops s
where not exists (select 1 from public.branches b where b.shop_id = s.id and b.is_main);

-- -----------------------------------------------------------------------------
-- 4. categories, brands
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);
create unique index categories_name_unique on public.categories (shop_id, lower(name));
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);
create unique index brands_name_unique on public.brands (shop_id, lower(name));
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. suppliers, customers
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  phone      text,
  email      text,
  address    text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);
create index suppliers_shop_name_idx on public.suppliers (shop_id, lower(name));
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  phone      text,
  email      text,
  address    text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);
create index customers_shop_name_idx on public.customers (shop_id, lower(name));
create trigger customers_set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. products (+ costs, barcodes, QR codes)
-- -----------------------------------------------------------------------------
create table public.products (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  name              text not null check (char_length(btrim(name)) between 1 and 200),
  sku               text not null check (char_length(btrim(sku)) between 1 and 60),
  category_id       uuid,
  brand_id          uuid,
  supplier_id       uuid,
  description       text,
  unit              text not null default 'pcs' check (char_length(btrim(unit)) between 1 and 20),
  image_path        text,   -- path inside the "product-images" Storage bucket
  selling_price     numeric(14, 2) not null default 0 check (selling_price >= 0),
  wholesale_price   numeric(14, 2) check (wholesale_price is null or wholesale_price >= 0),
  min_selling_price numeric(14, 2) check (min_selling_price is null or min_selling_price >= 0),
  -- Changed ONLY by _change_stock(). Never edit directly.
  current_stock     numeric(14, 3) not null default 0,
  min_stock_level   numeric(14, 3) not null default 0 check (min_stock_level >= 0),
  expiry_date       date,
  status            text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (shop_id, id),
  foreign key (shop_id, category_id) references public.categories (shop_id, id) on delete set null (category_id),
  foreign key (shop_id, brand_id)    references public.brands (shop_id, id)     on delete set null (brand_id),
  foreign key (shop_id, supplier_id) references public.suppliers (shop_id, id)  on delete set null (supplier_id)
);
create unique index products_sku_unique on public.products (shop_id, lower(sku));
create index products_shop_name_idx on public.products (shop_id, lower(name));
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);
create index products_supplier_idx on public.products (supplier_id);
create index products_status_idx on public.products (shop_id, status);
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- Cost data in its own table so RLS can hide it from cashiers (finance.view).
create table public.product_costs (
  product_id     uuid primary key references public.products (id) on delete cascade,
  shop_id        uuid not null references public.shops (id) on delete cascade,
  -- Latest purchase price (reference value shown in the product form).
  purchase_price numeric(14, 2) not null default 0 check (purchase_price >= 0),
  -- Weighted average cost: the cost used for profit calculations.
  avg_cost       numeric(14, 4) not null default 0 check (avg_cost >= 0),
  updated_at     timestamptz not null default now()
);
create index product_costs_shop_idx on public.product_costs (shop_id);

create table public.product_barcodes (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  barcode    text not null check (char_length(btrim(barcode)) between 1 and 64),
  created_at timestamptz not null default now()
);
create unique index product_barcodes_unique on public.product_barcodes (shop_id, barcode);
create index product_barcodes_product_idx on public.product_barcodes (product_id);

-- The QR code holds a random, permanent token (NOT the price, NOT the product id).
-- Scanning looks the token up and loads the latest product data.
create table public.product_qr_codes (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  product_id uuid not null unique references public.products (id) on delete cascade,
  code       uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create index product_qr_codes_shop_idx on public.product_qr_codes (shop_id);

-- Every product automatically receives its QR code.
create or replace function public.create_product_qr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.product_qr_codes (shop_id, product_id) values (new.shop_id, new.id);
  return new;
end;
$$;
create trigger products_create_qr after insert on public.products
  for each row execute function public.create_product_qr();

-- Plan limit: max products (archived products do not count).
create or replace function public.enforce_product_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max   integer := (public.shop_plan(new.shop_id)).max_products;
  v_count integer;
begin
  if v_max is not null and new.status <> 'archived' then
    select count(*) into v_count from public.products
     where shop_id = new.shop_id and status <> 'archived';
    if v_count >= v_max then
      raise exception 'PLAN_LIMIT: your plan allows up to % products. Please upgrade.', v_max
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger products_enforce_limit before insert on public.products
  for each row execute function public.enforce_product_limit();

-- -----------------------------------------------------------------------------
-- 7. inventory ledger, branch stock, transfers
-- -----------------------------------------------------------------------------
create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete restrict,
  movement_type   text not null check (movement_type in (
                    'opening', 'stock_in', 'stock_out', 'adjustment', 'damaged', 'expired',
                    'purchase', 'purchase_return', 'sale', 'sale_return', 'transfer')),
  quantity_change numeric(14, 3) not null,          -- + adds stock, - removes stock
  stock_after     numeric(14, 3) not null,
  unit_cost       numeric(14, 4),                   -- average cost at that moment
  reason          text not null check (char_length(btrim(reason)) >= 1),
  reference_type  text,                             -- 'sale', 'purchase', 'sales_return', ...
  reference_id    uuid,
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index inventory_movements_shop_created_idx on public.inventory_movements (shop_id, created_at desc);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);
create index inventory_movements_reference_idx on public.inventory_movements (reference_type, reference_id);

-- The ledger is append-only: nobody (not even the app) can edit or delete rows.
create or replace function public.block_ledger_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The inventory ledger is append-only.';
end;
$$;
create trigger inventory_movements_no_update before update or delete on public.inventory_movements
  for each row execute function public.block_ledger_changes();

-- Stock that is held in NON-main branches. The main branch holds the rest
-- (current_stock minus everything allocated here). Sales/purchases use main stock.
create table public.branch_stock (
  shop_id    uuid not null references public.shops (id) on delete cascade,
  branch_id  uuid not null references public.branches (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity   numeric(14, 3) not null default 0 check (quantity >= 0),
  primary key (branch_id, product_id)
);
create index branch_stock_product_idx on public.branch_stock (product_id);
create index branch_stock_shop_idx on public.branch_stock (shop_id);

create table public.stock_transfers (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  transfer_no    text not null,
  from_branch_id uuid not null references public.branches (id) on delete restrict,
  to_branch_id   uuid not null references public.branches (id) on delete restrict,
  product_id     uuid not null references public.products (id) on delete restrict,
  quantity       numeric(14, 3) not null check (quantity > 0),
  note           text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  check (from_branch_id <> to_branch_id),
  unique (shop_id, transfer_no)
);
create index stock_transfers_shop_created_idx on public.stock_transfers (shop_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 8. INTERNAL stock functions (not callable from the browser)
-- -----------------------------------------------------------------------------
-- Changes a product's stock AND writes the ledger row, atomically.
create or replace function public._change_stock(
  p_shop_id        uuid,
  p_product_id     uuid,
  p_delta          numeric,
  p_type           text,
  p_reason         text,
  p_reference_type text default null,
  p_reference_id   uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock numeric;
  v_name  text;
  v_cost  numeric;
begin
  -- Lock the product row so two cashiers can never oversell the same item.
  select current_stock, name into v_stock, v_name
    from public.products
   where id = p_product_id and shop_id = p_shop_id
   for update;
  if not found then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  if v_stock + p_delta < 0 then
    raise exception 'Not enough stock for "%". Available: %, needed: %.', v_name, v_stock, abs(p_delta)
      using errcode = 'P0001';
  end if;

  update public.products set current_stock = v_stock + p_delta where id = p_product_id;
  select avg_cost into v_cost from public.product_costs where product_id = p_product_id;

  insert into public.inventory_movements
    (shop_id, product_id, movement_type, quantity_change, stock_after, unit_cost,
     reason, reference_type, reference_id, created_by)
  values
    (p_shop_id, p_product_id, p_type, p_delta, v_stock + p_delta, v_cost,
     p_reason, p_reference_type, p_reference_id, auth.uid());

  return v_stock + p_delta;
end;
$$;

-- Weighted average cost: new_avg = (old_stock*old_avg + qty*cost) / (old_stock + qty)
-- Call this BEFORE _change_stock (it needs the stock level before the purchase).
create or replace function public._apply_weighted_cost(
  p_product_id uuid,
  p_qty        numeric,
  p_unit_cost  numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock numeric;
  v_avg   numeric;
begin
  select p.current_stock, c.avg_cost into v_stock, v_avg
    from public.products p
    join public.product_costs c on c.product_id = p.id
   where p.id = p_product_id
   for update of p;

  if v_stock <= 0 then
    v_avg := p_unit_cost;
  else
    v_avg := (v_stock * v_avg + p_qty * p_unit_cost) / (v_stock + p_qty);
  end if;

  update public.product_costs
     set avg_cost = round(v_avg, 4), updated_at = now()
   where product_id = p_product_id;
end;
$$;

-- Stock available in the MAIN branch (what POS and purchases work with).
create or replace function public._main_stock(p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select p.current_stock - coalesce((select sum(b.quantity) from public.branch_stock b where b.product_id = p.id), 0)
    from public.products p where p.id = p_product_id;
$$;

revoke all on function public._change_stock(uuid, uuid, numeric, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public._apply_weighted_cost(uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public._main_stock(uuid) from public, anon, authenticated;
revoke all on function public.create_main_branch() from public, anon, authenticated;
revoke all on function public.create_product_qr() from public, anon, authenticated;
revoke all on function public.enforce_product_limit() from public, anon, authenticated;
revoke all on function public.next_number(uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 9. PUBLIC functions (called from the app; each one checks permissions itself)
-- -----------------------------------------------------------------------------
create or replace function public.create_product(p_shop_id uuid, p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_sku     text := nullif(btrim(p ->> 'sku'), '');
  v_barcode text := nullif(btrim(p ->> 'barcode'), '');
  v_price   numeric := coalesce(nullif(p ->> 'purchase_price', '')::numeric, 0);
  v_open    numeric := coalesce(nullif(p ->> 'opening_stock', '')::numeric, 0);
begin
  perform public.assert_permission(p_shop_id, 'products.manage');

  if v_sku is null then
    v_sku := 'SKU-' || lpad(public.next_number(p_shop_id, 'sku')::text, 6, '0');
  end if;

  insert into public.products
    (shop_id, name, sku, category_id, brand_id, supplier_id, description, unit, image_path,
     selling_price, wholesale_price, min_selling_price, min_stock_level, expiry_date, status)
  values (
    p_shop_id, btrim(p ->> 'name'), v_sku,
    nullif(p ->> 'category_id', '')::uuid, nullif(p ->> 'brand_id', '')::uuid,
    nullif(p ->> 'supplier_id', '')::uuid, nullif(btrim(p ->> 'description'), ''),
    coalesce(nullif(btrim(p ->> 'unit'), ''), 'pcs'), nullif(p ->> 'image_path', ''),
    coalesce(nullif(p ->> 'selling_price', '')::numeric, 0),
    nullif(p ->> 'wholesale_price', '')::numeric, nullif(p ->> 'min_selling_price', '')::numeric,
    coalesce(nullif(p ->> 'min_stock_level', '')::numeric, 0),
    nullif(p ->> 'expiry_date', '')::date, coalesce(nullif(p ->> 'status', ''), 'active')
  )
  returning id into v_id;

  insert into public.product_costs (product_id, shop_id, purchase_price, avg_cost)
  values (v_id, p_shop_id, v_price, v_price);

  if v_barcode is not null then
    insert into public.product_barcodes (shop_id, product_id, barcode) values (p_shop_id, v_id, v_barcode);
  end if;

  if v_open > 0 then
    perform public._change_stock(p_shop_id, v_id, v_open, 'opening', 'Opening stock', 'product', v_id);
  end if;

  insert into public.audit_logs (shop_id, user_id, action, entity_type, entity_id, new_data)
  values (p_shop_id, auth.uid(), 'create', 'products', v_id, p);
  return v_id;
end;
$$;

create or replace function public.update_product(p_shop_id uuid, p_product_id uuid, p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_barcode text := nullif(btrim(p ->> 'barcode'), '');
  v_old     jsonb;
begin
  perform public.assert_permission(p_shop_id, 'products.manage');

  select to_jsonb(pr) into v_old from public.products pr where pr.id = p_product_id and pr.shop_id = p_shop_id;
  if v_old is null then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  update public.products set
    name = btrim(p ->> 'name'),
    sku = coalesce(nullif(btrim(p ->> 'sku'), ''), sku),
    category_id = nullif(p ->> 'category_id', '')::uuid,
    brand_id = nullif(p ->> 'brand_id', '')::uuid,
    supplier_id = nullif(p ->> 'supplier_id', '')::uuid,
    description = nullif(btrim(p ->> 'description'), ''),
    unit = coalesce(nullif(btrim(p ->> 'unit'), ''), 'pcs'),
    image_path = case when p ? 'image_path' then nullif(p ->> 'image_path', '') else image_path end,
    selling_price = coalesce(nullif(p ->> 'selling_price', '')::numeric, 0),
    wholesale_price = nullif(p ->> 'wholesale_price', '')::numeric,
    min_selling_price = nullif(p ->> 'min_selling_price', '')::numeric,
    min_stock_level = coalesce(nullif(p ->> 'min_stock_level', '')::numeric, 0),
    expiry_date = nullif(p ->> 'expiry_date', '')::date,
    status = coalesce(nullif(p ->> 'status', ''), status)
  where id = p_product_id and shop_id = p_shop_id;

  -- Only the reference purchase price changes here. avg_cost is changed by purchases only.
  if p ? 'purchase_price' and nullif(p ->> 'purchase_price', '') is not null then
    update public.product_costs
       set purchase_price = (p ->> 'purchase_price')::numeric, updated_at = now()
     where product_id = p_product_id;
  end if;

  -- One main barcode per product (edit form); replace or remove it.
  if p ? 'barcode' then
    delete from public.product_barcodes where product_id = p_product_id;
    if v_barcode is not null then
      insert into public.product_barcodes (shop_id, product_id, barcode) values (p_shop_id, p_product_id, v_barcode);
    end if;
  end if;

  insert into public.audit_logs (shop_id, user_id, action, entity_type, entity_id, old_data, new_data)
  values (p_shop_id, auth.uid(), 'update', 'products', p_product_id, v_old, p);
end;
$$;

-- Stock In / Stock Out / Adjustment (count) / Damaged / Expired
create or replace function public.adjust_stock(
  p_shop_id    uuid,
  p_product_id uuid,
  p_kind       text,       -- stock_in | stock_out | adjustment | damaged | expired
  p_quantity   numeric,    -- for 'adjustment' this is the NEW counted quantity
  p_reason     text,
  p_unit_cost  numeric default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current numeric;
  v_delta   numeric;
begin
  perform public.assert_permission(p_shop_id, 'inventory.adjust');
  if p_kind not in ('stock_in', 'stock_out', 'adjustment', 'damaged', 'expired') then
    raise exception 'Unknown stock operation.';
  end if;
  if p_kind in ('damaged', 'expired') then
    perform public.assert_feature(p_shop_id, 'advanced_inventory');
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for every stock change.';
  end if;
  if p_quantity is null or p_quantity < 0 or (p_kind <> 'adjustment' and p_quantity = 0) then
    raise exception 'Enter a valid quantity.';
  end if;

  select current_stock into v_current from public.products
   where id = p_product_id and shop_id = p_shop_id for update;
  if not found then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  v_delta := case p_kind
    when 'stock_in' then p_quantity
    when 'adjustment' then p_quantity - v_current
    else -p_quantity end;

  if v_delta = 0 then
    raise exception 'The counted quantity equals the current stock. Nothing to adjust.';
  end if;

  if p_kind = 'stock_in' and p_unit_cost is not null then
    perform public._apply_weighted_cost(p_product_id, p_quantity, p_unit_cost);
  end if;

  return public._change_stock(p_shop_id, p_product_id, v_delta, p_kind, btrim(p_reason), 'manual', null);
end;
$$;

-- Move stock between branches (Business plan). Total stock does not change.
create or replace function public.transfer_stock(
  p_shop_id        uuid,
  p_from_branch_id uuid,
  p_to_branch_id   uuid,
  p_product_id     uuid,
  p_quantity       numeric,
  p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from  public.branches;
  v_to    public.branches;
  v_id    uuid;
  v_stock numeric;
  v_no    text;
begin
  perform public.assert_permission(p_shop_id, 'inventory.adjust');
  perform public.assert_feature(p_shop_id, 'branches');
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Enter a valid quantity.';
  end if;

  select * into v_from from public.branches where id = p_from_branch_id and shop_id = p_shop_id;
  select * into v_to   from public.branches where id = p_to_branch_id   and shop_id = p_shop_id;
  if v_from.id is null or v_to.id is null or v_from.id = v_to.id then
    raise exception 'Choose two different branches.';
  end if;

  -- lock the product so concurrent sales/transfers are serialized
  perform 1 from public.products where id = p_product_id and shop_id = p_shop_id for update;
  if not found then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  if v_from.is_main then
    if public._main_stock(p_product_id) < p_quantity then
      raise exception 'Not enough stock in the main branch.';
    end if;
  else
    select quantity into v_stock from public.branch_stock
     where branch_id = v_from.id and product_id = p_product_id for update;
    if coalesce(v_stock, 0) < p_quantity then
      raise exception 'Not enough stock in branch "%".', v_from.name;
    end if;
    update public.branch_stock set quantity = quantity - p_quantity
     where branch_id = v_from.id and product_id = p_product_id;
  end if;

  if not v_to.is_main then
    insert into public.branch_stock (shop_id, branch_id, product_id, quantity)
    values (p_shop_id, v_to.id, p_product_id, p_quantity)
    on conflict (branch_id, product_id) do update set quantity = public.branch_stock.quantity + p_quantity;
  end if;

  v_no := 'TR-' || lpad(public.next_number(p_shop_id, 'transfer')::text, 5, '0');
  insert into public.stock_transfers
    (shop_id, transfer_no, from_branch_id, to_branch_id, product_id, quantity, note, created_by)
  values (p_shop_id, v_no, v_from.id, v_to.id, p_product_id, p_quantity, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;

  -- Ledger entry (quantity_change is 0: the shop's TOTAL stock did not change).
  insert into public.inventory_movements
    (shop_id, product_id, movement_type, quantity_change, stock_after, unit_cost, reason, reference_type, reference_id, created_by)
  select p_shop_id, p_product_id, 'transfer', 0, p.current_stock, c.avg_cost,
         format('Transfer %s: %s units from %s to %s', v_no, p_quantity, v_from.name, v_to.name),
         'stock_transfer', v_id, auth.uid()
    from public.products p join public.product_costs c on c.product_id = p.id
   where p.id = p_product_id;

  return v_id;
end;
$$;

-- Find a product from whatever was scanned: QR token, barcode, or SKU (USB scanners).
create or replace function public.find_product_by_code(p_shop_id uuid, p_code text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := btrim(coalesce(p_code, ''));
  v_id   uuid;
begin
  perform public.assert_permission(p_shop_id, 'products.view');
  if v_code = '' then
    return null;
  end if;
  -- QR codes are printed as "STK:<token>"
  if v_code like 'STK:%' then
    v_code := substr(v_code, 5);
    select q.product_id into v_id from public.product_qr_codes q
     where q.shop_id = p_shop_id and q.code::text = lower(v_code);
    return v_id;
  end if;
  select b.product_id into v_id from public.product_barcodes b
   where b.shop_id = p_shop_id and b.barcode = v_code;
  if v_id is null then
    select p.id into v_id from public.products p
     where p.shop_id = p_shop_id and lower(p.sku) = lower(v_code);
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Row Level Security + privileges for the new tables
-- -----------------------------------------------------------------------------
alter table public.branches            enable row level security;
alter table public.categories          enable row level security;
alter table public.brands              enable row level security;
alter table public.suppliers           enable row level security;
alter table public.customers           enable row level security;
alter table public.products            enable row level security;
alter table public.product_costs       enable row level security;
alter table public.product_barcodes    enable row level security;
alter table public.product_qr_codes    enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.branch_stock        enable row level security;
alter table public.stock_transfers     enable row level security;

-- Read policies
create policy "branches: read"   on public.branches   for select to authenticated using (public.is_shop_member(shop_id) or public.is_super_admin());
create policy "categories: read" on public.categories for select to authenticated using (public.has_shop_permission(shop_id, 'products.view'));
create policy "brands: read"     on public.brands     for select to authenticated using (public.has_shop_permission(shop_id, 'products.view'));
create policy "products: read"   on public.products   for select to authenticated using (public.has_shop_permission(shop_id, 'products.view') or public.has_shop_permission(shop_id, 'sales.create') or public.has_shop_permission(shop_id, 'purchases.view'));
create policy "product_costs: read" on public.product_costs for select to authenticated using (public.has_shop_permission(shop_id, 'finance.view'));
create policy "barcodes: read"   on public.product_barcodes for select to authenticated using (public.has_shop_permission(shop_id, 'products.view'));
create policy "qr: read"         on public.product_qr_codes for select to authenticated using (public.has_shop_permission(shop_id, 'products.view'));
create policy "suppliers: read"  on public.suppliers  for select to authenticated using (public.has_shop_permission(shop_id, 'suppliers.view'));
create policy "customers: read"  on public.customers  for select to authenticated using (public.has_shop_permission(shop_id, 'customers.view') or public.has_shop_permission(shop_id, 'sales.create'));
create policy "movements: read"  on public.inventory_movements for select to authenticated using (public.has_shop_permission(shop_id, 'inventory.view'));
create policy "branch_stock: read" on public.branch_stock for select to authenticated using (public.has_shop_permission(shop_id, 'inventory.view'));
create policy "transfers: read"  on public.stock_transfers for select to authenticated using (public.has_shop_permission(shop_id, 'inventory.view'));

-- Simple master-data writes (the plan features/limits are checked in the app + functions)
create policy "branches: manage" on public.branches for all to authenticated
  using (public.has_shop_permission(shop_id, 'settings.manage'))
  with check (public.has_shop_permission(shop_id, 'settings.manage'));
create policy "categories: manage" on public.categories for all to authenticated
  using (public.has_shop_permission(shop_id, 'products.manage'))
  with check (public.has_shop_permission(shop_id, 'products.manage'));
create policy "brands: manage" on public.brands for all to authenticated
  using (public.has_shop_permission(shop_id, 'products.manage'))
  with check (public.has_shop_permission(shop_id, 'products.manage'));
create policy "suppliers: manage" on public.suppliers for all to authenticated
  using (public.has_shop_permission(shop_id, 'suppliers.manage'))
  with check (public.has_shop_permission(shop_id, 'suppliers.manage'));
create policy "customers: manage" on public.customers for all to authenticated
  using (public.has_shop_permission(shop_id, 'customers.manage'))
  with check (public.has_shop_permission(shop_id, 'customers.manage'));
-- products: no direct insert/update (use create_product / update_product); delete allowed
-- (foreign keys block deleting a product that has history -> archive it instead).
create policy "products: delete" on public.products for delete to authenticated
  using (public.has_shop_permission(shop_id, 'products.manage'));

revoke all on public.branches, public.categories, public.brands, public.suppliers, public.customers,
              public.products, public.product_costs, public.product_barcodes, public.product_qr_codes,
              public.inventory_movements, public.branch_stock, public.stock_transfers
  from anon, authenticated;

grant select on public.branches, public.categories, public.brands, public.suppliers, public.customers,
                public.products, public.product_costs, public.product_barcodes, public.product_qr_codes,
                public.inventory_movements, public.branch_stock, public.stock_transfers
  to authenticated;
grant insert, delete on public.branches, public.categories, public.brands to authenticated;
grant update (name, address) on public.branches to authenticated;
grant update (name) on public.categories, public.brands to authenticated;
grant insert, update (name, phone, email, address, notes, is_active), delete on public.suppliers to authenticated;
grant insert, update (name, phone, email, address, notes, is_active), delete on public.customers to authenticated;
-- (shop_id can be set on INSERT only; it cannot be changed afterwards)
grant delete on public.products to authenticated;

-- Audit trail
create trigger products_audit_delete after delete on public.products
  for each row execute function public.log_audit();
create trigger suppliers_audit after update or delete on public.suppliers
  for each row execute function public.log_audit();
create trigger customers_audit after update or delete on public.customers
  for each row execute function public.log_audit();

-- Function privileges
do $$
declare
  f text;
begin
  foreach f in array array[
    'create_product(uuid, jsonb)',
    'update_product(uuid, uuid, jsonb)',
    'adjust_stock(uuid, uuid, text, numeric, text, numeric)',
    'transfer_stock(uuid, uuid, uuid, uuid, numeric, text)',
    'find_product_by_code(uuid, text)',
    'assert_permission(uuid, text)',
    'assert_feature(uuid, text)',
    'shop_plan(uuid)',
    'plan_has_feature(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Storage: product images (public bucket; paths start with the shop id)
-- Run only on Supabase (the storage schema exists there).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    -- Anyone may VIEW images (they are only product photos); only staff with
    -- products.manage may upload/change/delete files inside their OWN shop folder.
    execute $p$create policy "product images: manage own shop folder" on storage.objects
      for all to authenticated
      using (bucket_id = 'product-images'
             and public.has_shop_permission(((storage.foldername(name))[1])::uuid, 'products.manage'))
      with check (bucket_id = 'product-images'
             and public.has_shop_permission(((storage.foldername(name))[1])::uuid, 'products.manage'))$p$;
  end if;
end $$;
