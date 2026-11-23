-- =============================================================================
-- Stockora — Migration 5: Sales, purchases, returns, payments (Phase 3)
-- =============================================================================
-- Money rules used everywhere:
--   * All money columns are numeric(14,2) — never floating point.
--   * Prices, totals, discounts and tax are ALWAYS calculated here in the
--     database. The browser only sends product ids, quantities and payments.
--   * Historical values are frozen: sale_items keep the price used, and
--     sale_item_costs keep the cost used, so later price changes never rewrite
--     old profit.
--   * Whole operations (sale + stock + payments + cash ledger) are ONE
--     transaction: a PostgreSQL function either completes fully or not at all.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. financial_transactions — the cash ledger (money in / money out)
-- -----------------------------------------------------------------------------
create table public.financial_transactions (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  direction      text not null check (direction in ('in', 'out')),
  category       text not null check (category in (
                   'sale_payment', 'customer_refund', 'purchase_payment', 'supplier_refund',
                   'expense', 'expense_void')),
  amount         numeric(14, 2) not null check (amount > 0),
  method         text check (method in ('cash', 'bank_transfer', 'card', 'mobile_payment')),
  reference_type text,
  reference_id   uuid,
  description    text,
  occurred_at    timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null
);
create index financial_transactions_shop_time_idx on public.financial_transactions (shop_id, occurred_at desc);
create index financial_transactions_reference_idx on public.financial_transactions (reference_type, reference_id);
create trigger financial_transactions_no_update before update or delete on public.financial_transactions
  for each row execute function public.block_ledger_changes();

-- -----------------------------------------------------------------------------
-- 2. SALES
-- -----------------------------------------------------------------------------
create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  invoice_no      text not null,
  customer_id     uuid,
  cashier_id      uuid references public.profiles (id) on delete set null,
  status          text not null default 'completed'
                    check (status in ('completed', 'partially_returned', 'returned')),
  subtotal        numeric(14, 2) not null check (subtotal >= 0),     -- sum of line prices
  discount_amount numeric(14, 2) not null default 0 check (discount_amount >= 0),
  tax_rate        numeric(5, 2)  not null default 0,
  tax_amount      numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total           numeric(14, 2) not null check (total >= 0),        -- subtotal - discount + tax
  amount_paid     numeric(14, 2) not null default 0 check (amount_paid >= 0),
  returned_value  numeric(14, 2) not null default 0 check (returned_value >= 0),
  refunded_amount numeric(14, 2) not null default 0 check (refunded_amount >= 0),
  balance_due     numeric(14, 2) not null default 0 check (balance_due >= 0),
  payment_status  text not null default 'unpaid' check (payment_status in ('paid', 'partial', 'unpaid')),
  notes           text,
  idempotency_key uuid not null,
  sold_at         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (shop_id, id),
  unique (shop_id, invoice_no),
  unique (shop_id, idempotency_key),     -- protects against double-clicks / retries
  foreign key (shop_id, customer_id) references public.customers (shop_id, id) on delete set null (customer_id)
);
create index sales_shop_sold_idx on public.sales (shop_id, sold_at desc);
create index sales_customer_idx on public.sales (customer_id);
create index sales_open_balance_idx on public.sales (shop_id, customer_id) where balance_due > 0;

create table public.sale_items (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  sale_id       uuid not null references public.sales (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete restrict,
  product_name  text not null,          -- frozen copy
  sku           text not null,          -- frozen copy
  unit          text not null,
  quantity      numeric(14, 3) not null check (quantity > 0),
  unit_price    numeric(14, 2) not null check (unit_price >= 0),   -- frozen selling price
  gross_amount  numeric(14, 2) not null,                          -- quantity * unit_price
  net_amount    numeric(14, 2) not null,                          -- after this line's share of the discount, before tax
  tax_amount    numeric(14, 2) not null default 0,
  returned_qty  numeric(14, 3) not null default 0 check (returned_qty >= 0),
  returned_net  numeric(14, 2) not null default 0,
  returned_tax  numeric(14, 2) not null default 0,
  unique (shop_id, id),
  check (returned_qty <= quantity)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- Cost of each sold line (readable only with finance.view -> hidden from cashiers).
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete cascade,
  shop_id      uuid not null references public.shops (id) on delete cascade,
  unit_cost    numeric(14, 4) not null check (unit_cost >= 0)
);
create index sale_item_costs_shop_idx on public.sale_item_costs (shop_id);

create table public.sale_payments (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  sale_id     uuid not null references public.sales (id) on delete cascade,
  method      text not null check (method in ('cash', 'bank_transfer', 'card', 'mobile_payment')),
  amount      numeric(14, 2) not null check (amount > 0),
  reference   text,
  received_by uuid references public.profiles (id) on delete set null,
  paid_at     timestamptz not null default now()
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);
create index sale_payments_shop_paid_idx on public.sale_payments (shop_id, paid_at desc);

create table public.sales_returns (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  return_no     text not null,
  sale_id       uuid not null references public.sales (id) on delete restrict,
  return_value  numeric(14, 2) not null check (return_value > 0),   -- net + tax
  net_value     numeric(14, 2) not null,
  tax_value     numeric(14, 2) not null default 0,
  credit_applied numeric(14, 2) not null default 0,                 -- reduced the customer's unpaid balance
  refund_amount numeric(14, 2) not null default 0,                  -- money handed back
  refund_method text check (refund_method in ('cash', 'bank_transfer', 'card', 'mobile_payment')),
  reason        text not null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (shop_id, return_no)
);
create index sales_returns_shop_idx on public.sales_returns (shop_id, created_at desc);
create index sales_returns_sale_idx on public.sales_returns (sale_id);

create table public.sales_return_items (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  return_id    uuid not null references public.sales_returns (id) on delete cascade,
  sale_item_id uuid not null references public.sale_items (id) on delete restrict,
  product_id   uuid not null references public.products (id) on delete restrict,
  quantity     numeric(14, 3) not null check (quantity > 0),
  net_amount   numeric(14, 2) not null,
  tax_amount   numeric(14, 2) not null default 0
);
create index sales_return_items_return_idx on public.sales_return_items (return_id);

-- -----------------------------------------------------------------------------
-- 3. PURCHASES
-- -----------------------------------------------------------------------------
create table public.purchases (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  purchase_no      text not null,
  supplier_id      uuid not null,
  supplier_invoice text,
  status           text not null default 'ordered' check (status in ('ordered', 'received', 'cancelled')),
  subtotal         numeric(14, 2) not null check (subtotal >= 0),
  discount_amount  numeric(14, 2) not null default 0 check (discount_amount >= 0),
  additional_costs numeric(14, 2) not null default 0 check (additional_costs >= 0),  -- freight, duties...
  total            numeric(14, 2) not null check (total >= 0),   -- subtotal - discount + additional costs
  amount_paid      numeric(14, 2) not null default 0 check (amount_paid >= 0),
  returned_value   numeric(14, 2) not null default 0 check (returned_value >= 0),
  refunded_amount  numeric(14, 2) not null default 0 check (refunded_amount >= 0),
  balance_due      numeric(14, 2) not null default 0 check (balance_due >= 0),
  payment_status   text not null default 'unpaid' check (payment_status in ('paid', 'partial', 'unpaid')),
  notes            text,
  idempotency_key  uuid not null,
  ordered_at       timestamptz not null default now(),
  received_at      timestamptz,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (shop_id, id),
  unique (shop_id, purchase_no),
  unique (shop_id, idempotency_key),
  foreign key (shop_id, supplier_id) references public.suppliers (shop_id, id) on delete restrict
);
create index purchases_shop_ordered_idx on public.purchases (shop_id, ordered_at desc);
create index purchases_supplier_idx on public.purchases (supplier_id);

create table public.purchase_items (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  purchase_id       uuid not null references public.purchases (id) on delete cascade,
  product_id        uuid not null references public.products (id) on delete restrict,
  product_name      text not null,
  quantity          numeric(14, 3) not null check (quantity > 0),
  unit_price        numeric(14, 2) not null check (unit_price >= 0),
  line_total        numeric(14, 2) not null,
  net_amount        numeric(14, 2) not null,           -- after the line's share of the discount
  landed_unit_cost  numeric(14, 4),                    -- set on receiving: (net + share of extra costs) / qty
  returned_qty      numeric(14, 3) not null default 0 check (returned_qty >= 0),
  returned_value    numeric(14, 2) not null default 0,
  check (returned_qty <= quantity)
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_product_idx on public.purchase_items (product_id);

create table public.purchase_payments (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  method      text not null check (method in ('cash', 'bank_transfer', 'card', 'mobile_payment')),
  amount      numeric(14, 2) not null check (amount > 0),
  reference   text,
  paid_by     uuid references public.profiles (id) on delete set null,
  paid_at     timestamptz not null default now()
);
create index purchase_payments_purchase_idx on public.purchase_payments (purchase_id);

create table public.purchase_returns (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  return_no      text not null,
  purchase_id    uuid not null references public.purchases (id) on delete restrict,
  return_value   numeric(14, 2) not null check (return_value > 0),
  credit_applied numeric(14, 2) not null default 0,   -- reduced what we still owe the supplier
  refund_amount  numeric(14, 2) not null default 0,   -- money the supplier gave back
  refund_method  text check (refund_method in ('cash', 'bank_transfer', 'card', 'mobile_payment')),
  reason         text not null,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (shop_id, return_no)
);
create index purchase_returns_shop_idx on public.purchase_returns (shop_id, created_at desc);

create table public.purchase_return_items (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  return_id        uuid not null references public.purchase_returns (id) on delete cascade,
  purchase_item_id uuid not null references public.purchase_items (id) on delete restrict,
  product_id       uuid not null references public.products (id) on delete restrict,
  quantity         numeric(14, 3) not null check (quantity > 0),
  value            numeric(14, 2) not null
);
create index purchase_return_items_return_idx on public.purchase_return_items (return_id);

-- -----------------------------------------------------------------------------
-- 4. Balance views (what customers owe us / what we owe suppliers)
-- -----------------------------------------------------------------------------
create view public.customer_balances with (security_invoker = true) as
select c.shop_id,
       c.id as customer_id,
       coalesce(sum(s.balance_due), 0)::numeric(14, 2)                 as outstanding,
       coalesce(sum(s.total - s.returned_value), 0)::numeric(14, 2)    as total_purchases,
       count(s.id)::integer                                            as sales_count,
       max(s.sold_at)                                                  as last_sale_at
  from public.customers c
  left join public.sales s on s.customer_id = c.id
 group by c.shop_id, c.id;

create view public.supplier_balances with (security_invoker = true) as
select sp.shop_id,
       sp.id as supplier_id,
       coalesce(sum(p.balance_due) filter (where p.status = 'received'), 0)::numeric(14, 2) as outstanding,
       coalesce(sum(p.total - p.returned_value) filter (where p.status = 'received'), 0)::numeric(14, 2) as total_purchases,
       (count(p.id) filter (where p.status <> 'cancelled'))::integer     as purchase_count,
       max(p.ordered_at)                                                 as last_purchase_at
  from public.suppliers sp
  left join public.purchases p on p.supplier_id = sp.id
 group by sp.shop_id, sp.id;

-- -----------------------------------------------------------------------------
-- 5. INTERNAL helpers
-- -----------------------------------------------------------------------------
create or replace function public._audit(p_shop_id uuid, p_action text, p_entity text, p_entity_id uuid, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (shop_id, user_id, action, entity_type, entity_id, new_data)
  values (p_shop_id, auth.uid(), p_action, p_entity, p_entity_id, p_data);
$$;

-- Recomputes what a customer still owes on one sale.
--   balance = (total - returned) - (paid - refunded)
create or replace function public._refresh_sale_balance(p_sale_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.sales s set
    balance_due = greatest(s.total - s.returned_value - (s.amount_paid - s.refunded_amount), 0),
    payment_status = case
      when greatest(s.total - s.returned_value - (s.amount_paid - s.refunded_amount), 0) = 0 then 'paid'
      when s.amount_paid - s.refunded_amount > 0 then 'partial'
      else 'unpaid' end
  where s.id = p_sale_id;
$$;

create or replace function public._refresh_purchase_balance(p_purchase_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.purchases p set
    balance_due = greatest(p.total - p.returned_value - (p.amount_paid - p.refunded_amount), 0),
    payment_status = case
      when greatest(p.total - p.returned_value - (p.amount_paid - p.refunded_amount), 0) = 0 then 'paid'
      when p.amount_paid - p.refunded_amount > 0 then 'partial'
      else 'unpaid' end
  where p.id = p_purchase_id;
$$;

-- Records ONE payment received on a sale (+ cash ledger row).
create or replace function public._apply_sale_payment(
  p_shop_id uuid, p_sale_id uuid, p_method text, p_amount numeric, p_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sale_payments (shop_id, sale_id, method, amount, reference, received_by)
  values (p_shop_id, p_sale_id, p_method, p_amount, nullif(btrim(coalesce(p_reference, '')), ''), auth.uid());

  update public.sales set amount_paid = amount_paid + p_amount where id = p_sale_id;
  perform public._refresh_sale_balance(p_sale_id);

  insert into public.financial_transactions
    (shop_id, direction, category, amount, method, reference_type, reference_id, description, created_by)
  select p_shop_id, 'in', 'sale_payment', p_amount, p_method, 'sale', p_sale_id,
         'Payment for ' || s.invoice_no, auth.uid()
    from public.sales s where s.id = p_sale_id;
end;
$$;

create or replace function public._apply_purchase_payment(
  p_shop_id uuid, p_purchase_id uuid, p_method text, p_amount numeric, p_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.purchase_payments (shop_id, purchase_id, method, amount, reference, paid_by)
  values (p_shop_id, p_purchase_id, p_method, p_amount, nullif(btrim(coalesce(p_reference, '')), ''), auth.uid());

  update public.purchases set amount_paid = amount_paid + p_amount where id = p_purchase_id;
  perform public._refresh_purchase_balance(p_purchase_id);

  insert into public.financial_transactions
    (shop_id, direction, category, amount, method, reference_type, reference_id, description, created_by)
  select p_shop_id, 'out', 'purchase_payment', p_amount, p_method, 'purchase', p_purchase_id,
         'Payment for ' || p.purchase_no, auth.uid()
    from public.purchases p where p.id = p_purchase_id;
end;
$$;

revoke all on function public._audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._refresh_sale_balance(uuid) from public, anon, authenticated;
revoke all on function public._refresh_purchase_balance(uuid) from public, anon, authenticated;
revoke all on function public._apply_sale_payment(uuid, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public._apply_purchase_payment(uuid, uuid, text, numeric, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. complete_sale — the heart of the POS
-- -----------------------------------------------------------------------------
-- p_items    : [{ "product_id": uuid, "quantity": 2, "price_type": "retail"|"wholesale" }]
-- p_payments : [{ "method": "cash", "amount": 500, "reference": "..." }]  (anything unpaid = credit)
-- The browser NEVER sends prices or totals; everything is calculated here.
create or replace function public.complete_sale(
  p_shop_id        uuid,
  p_idempotency_key uuid,
  p_customer_id    uuid,
  p_items          jsonb,
  p_discount_type  text,        -- 'none' | 'amount' | 'percent'
  p_discount_value numeric,
  p_payments       jsonb,
  p_notes          text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id   uuid := gen_random_uuid();
  v_existing  uuid;
  v_settings  public.shop_settings;
  v_tax_rate  numeric := 0;
  v_rec       record;
  v_prod      record;
  v_price     numeric;
  v_item_id   uuid;
  v_subtotal  numeric;
  v_discount  numeric := 0;
  v_net_total numeric;
  v_tax       numeric;
  v_total     numeric;
  v_paid      numeric := 0;
  v_cash      numeric := 0;
  v_over      numeric := 0;
  v_pay       jsonb;
  v_amount    numeric;
  v_invoice   text;
  v_bad       record;
  v_diff      numeric;
begin
  perform public.assert_permission(p_shop_id, 'sales.create');

  -- Duplicate protection: the same key returns the sale that already exists.
  select id into v_existing from public.sales where shop_id = p_shop_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return v_existing;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty.';
  end if;
  if p_customer_id is not null and not exists
     (select 1 from public.customers where id = p_customer_id and shop_id = p_shop_id) then
    raise exception 'Customer not found.';
  end if;
  if coalesce(p_discount_value, 0) < 0 then
    raise exception 'Discount cannot be negative.';
  end if;

  select * into v_settings from public.shop_settings where shop_id = p_shop_id;
  if v_settings.tax_enabled then v_tax_rate := v_settings.tax_rate; end if;

  v_invoice := 'INV-' || lpad(public.next_number(p_shop_id, 'invoice')::text, 6, '0');

  begin
    insert into public.sales (id, shop_id, invoice_no, customer_id, cashier_id, subtotal, total,
                              tax_rate, notes, idempotency_key)
    values (v_sale_id, p_shop_id, v_invoice, p_customer_id, auth.uid(), 0, 0,
            v_tax_rate, nullif(btrim(coalesce(p_notes, '')), ''), p_idempotency_key);
  exception when unique_violation then
    -- a parallel request with the same key won the race
    select id into v_existing from public.sales where shop_id = p_shop_id and idempotency_key = p_idempotency_key;
    if v_existing is not null then return v_existing; end if;
    raise;
  end;

  -- ---- lines: prices come from the database, stock is checked and reduced ----
  for v_rec in
    select (x ->> 'product_id')::uuid as product_id,
           coalesce(nullif(x ->> 'price_type', ''), 'retail') as price_type,
           sum((x ->> 'quantity')::numeric) as quantity
      from jsonb_array_elements(p_items) x
     group by 1, 2
     order by 1, 2   -- fixed order avoids deadlocks between two cashiers
  loop
    if v_rec.quantity is null or v_rec.quantity <= 0 then
      raise exception 'Quantity must be greater than zero.';
    end if;

    select p.*, c.avg_cost into v_prod
      from public.products p join public.product_costs c on c.product_id = p.id
     where p.id = v_rec.product_id and p.shop_id = p_shop_id;
    if not found then
      raise exception 'A product in the cart no longer exists.';
    end if;
    if v_prod.status <> 'active' then
      raise exception '"%" is not active and cannot be sold.', v_prod.name;
    end if;
    if v_prod.expiry_date is not null and v_prod.expiry_date < current_date then
      raise exception '"%" has expired and cannot be sold.', v_prod.name;
    end if;

    if v_rec.price_type = 'wholesale' then
      if v_prod.wholesale_price is null then
        raise exception '"%" has no wholesale price.', v_prod.name;
      end if;
      v_price := v_prod.wholesale_price;
    else
      v_price := v_prod.selling_price;
    end if;

    if public._main_stock(v_prod.id) < v_rec.quantity then
      raise exception 'Not enough stock for "%". Available: %.', v_prod.name, public._main_stock(v_prod.id);
    end if;

    insert into public.sale_items
      (shop_id, sale_id, product_id, product_name, sku, unit, quantity, unit_price, gross_amount, net_amount)
    values
      (p_shop_id, v_sale_id, v_prod.id, v_prod.name, v_prod.sku, v_prod.unit, v_rec.quantity, v_price,
       round(v_rec.quantity * v_price, 2), round(v_rec.quantity * v_price, 2))
    returning id into v_item_id;

    -- Freeze the cost at the moment of sale (weighted average cost).
    insert into public.sale_item_costs (sale_item_id, shop_id, unit_cost) values (v_item_id, p_shop_id, v_prod.avg_cost);

    perform public._change_stock(p_shop_id, v_prod.id, -v_rec.quantity, 'sale', 'Sale ' || v_invoice, 'sale', v_sale_id);
  end loop;

  -- ---- discount, spread over the lines in proportion to their value ----
  select sum(gross_amount) into v_subtotal from public.sale_items where sale_id = v_sale_id;
  if p_discount_type = 'amount' then
    v_discount := least(round(coalesce(p_discount_value, 0), 2), v_subtotal);
  elsif p_discount_type = 'percent' then
    if p_discount_value > 100 then raise exception 'Discount cannot be more than 100%%.'; end if;
    v_discount := round(v_subtotal * coalesce(p_discount_value, 0) / 100, 2);
  end if;
  v_net_total := v_subtotal - v_discount;

  if v_subtotal > 0 then
    update public.sale_items
       set net_amount = round(gross_amount * v_net_total / v_subtotal, 2)
     where sale_id = v_sale_id;
    -- put any 1-cent rounding difference on the biggest line so the sum is exact
    select v_net_total - sum(net_amount) into v_diff from public.sale_items where sale_id = v_sale_id;
    if v_diff <> 0 then
      update public.sale_items set net_amount = net_amount + v_diff
       where id = (select id from public.sale_items where sale_id = v_sale_id order by gross_amount desc, id limit 1);
    end if;
  end if;

  -- Never let a discount push a line below its minimum selling price.
  select i.product_name, p.min_selling_price into v_bad
    from public.sale_items i join public.products p on p.id = i.product_id
   where i.sale_id = v_sale_id
     and p.min_selling_price is not null
     and i.net_amount / i.quantity < p.min_selling_price - 0.01
   limit 1;
  if found then
    raise exception 'The discount makes "%" cheaper than its minimum selling price (%).', v_bad.product_name, v_bad.min_selling_price;
  end if;

  -- ---- tax ----
  update public.sale_items set tax_amount = round(net_amount * v_tax_rate / 100, 2) where sale_id = v_sale_id;
  select coalesce(sum(tax_amount), 0) into v_tax from public.sale_items where sale_id = v_sale_id;
  v_total := v_net_total + v_tax;

  -- ---- payments (anything not paid now stays as customer credit) ----
  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if v_pay ->> 'method' = 'credit' then continue; end if;
    v_amount := coalesce((v_pay ->> 'amount')::numeric, 0);
    if v_amount < 0 or (v_pay ->> 'method') not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then
      raise exception 'Invalid payment.';
    end if;
    v_paid := v_paid + v_amount;
    if v_pay ->> 'method' = 'cash' then v_cash := v_cash + v_amount; end if;
  end loop;

  if v_paid > v_total then
    v_over := round(v_paid - v_total, 2);   -- change handed back; only cash can have change
    if v_over > v_cash then
      raise exception 'Payments are more than the total.';
    end if;
  end if;

  update public.sales set subtotal = v_subtotal, discount_amount = v_discount, tax_amount = v_tax, total = v_total
   where id = v_sale_id;

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if v_pay ->> 'method' = 'credit' then continue; end if;
    v_amount := coalesce((v_pay ->> 'amount')::numeric, 0);
    if v_pay ->> 'method' = 'cash' and v_over > 0 then
      v_amount := v_amount - least(v_amount, v_over);
      v_over := v_over - least((v_pay ->> 'amount')::numeric, v_over);
    end if;
    if v_amount > 0 then
      perform public._apply_sale_payment(p_shop_id, v_sale_id, v_pay ->> 'method', v_amount, v_pay ->> 'reference');
    end if;
  end loop;

  perform public._refresh_sale_balance(v_sale_id);

  if (select balance_due from public.sales where id = v_sale_id) > 0 and p_customer_id is null then
    raise exception 'Select a customer to sell on credit or with a partial payment.';
  end if;

  perform public._audit(p_shop_id, 'create', 'sales', v_sale_id,
    jsonb_build_object('invoice_no', v_invoice, 'total', v_total, 'customer_id', p_customer_id));
  return v_sale_id;
end;
$$;

-- Money received later for ONE invoice
create or replace function public.add_sale_payment(
  p_shop_id uuid, p_sale_id uuid, p_method text, p_amount numeric, p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due numeric;
begin
  perform public.assert_permission(p_shop_id, 'sales.create');
  if p_method not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then
    raise exception 'Choose a payment method.';
  end if;
  select balance_due into v_due from public.sales where id = p_sale_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Sale not found.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a valid amount.'; end if;
  if p_amount > v_due then raise exception 'The amount is more than the balance due (%).', v_due; end if;
  perform public._apply_sale_payment(p_shop_id, p_sale_id, p_method, p_amount, p_reference);
end;
$$;

-- Customer pays down their account: applied to the OLDEST unpaid invoices first.
create or replace function public.record_customer_payment(
  p_shop_id uuid, p_customer_id uuid, p_amount numeric, p_method text, p_reference text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left numeric := p_amount;
  v_sale record;
  v_apply numeric;
  v_outstanding numeric;
begin
  perform public.assert_permission(p_shop_id, 'sales.create');
  if p_method not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then
    raise exception 'Choose a payment method.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a valid amount.'; end if;

  select coalesce(sum(balance_due), 0) into v_outstanding
    from public.sales where shop_id = p_shop_id and customer_id = p_customer_id;
  if p_amount > v_outstanding then
    raise exception 'The amount is more than the outstanding balance (%).', v_outstanding;
  end if;

  for v_sale in
    select id, balance_due from public.sales
     where shop_id = p_shop_id and customer_id = p_customer_id and balance_due > 0
     order by sold_at, id
     for update
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, v_sale.balance_due);
    perform public._apply_sale_payment(p_shop_id, v_sale.id, p_method, v_apply, p_reference);
    v_left := v_left - v_apply;
  end loop;
  return p_amount;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. complete_sales_return — customer brings goods back
-- -----------------------------------------------------------------------------
-- p_items: [{ "sale_item_id": uuid, "quantity": 1 }]
create or replace function public.complete_sales_return(
  p_shop_id       uuid,
  p_sale_id       uuid,
  p_items         jsonb,
  p_refund_method text,
  p_reason        text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale     public.sales;
  v_rec      record;
  v_item     public.sale_items;
  v_cost     numeric;
  v_net      numeric;
  v_tax      numeric;
  v_sum_net  numeric := 0;
  v_sum_tax  numeric := 0;
  v_value    numeric;
  v_credit   numeric;
  v_refund   numeric;
  v_return   uuid := gen_random_uuid();
  v_no       text;
  v_remaining_qty numeric;
begin
  perform public.assert_permission(p_shop_id, 'sales.refund');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Please enter a reason for the return.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to return.';
  end if;

  select * into v_sale from public.sales where id = p_sale_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Sale not found.'; end if;

  v_no := 'RET-' || lpad(public.next_number(p_shop_id, 'sales_return')::text, 5, '0');
  insert into public.sales_returns (id, shop_id, return_no, sale_id, return_value, net_value, tax_value, reason, created_by)
  values (v_return, p_shop_id, v_no, p_sale_id, 0.01, 0, 0, btrim(p_reason), auth.uid());   -- totals fixed below

  for v_rec in
    select (x ->> 'sale_item_id')::uuid as sale_item_id, sum((x ->> 'quantity')::numeric) as quantity
      from jsonb_array_elements(p_items) x group by 1 order by 1
  loop
    if v_rec.quantity is null or v_rec.quantity <= 0 then
      raise exception 'Return quantity must be greater than zero.';
    end if;
    select * into v_item from public.sale_items where id = v_rec.sale_item_id and sale_id = p_sale_id for update;
    if not found then raise exception 'Item does not belong to this sale.'; end if;

    v_remaining_qty := v_item.quantity - v_item.returned_qty;
    if v_rec.quantity > v_remaining_qty then
      raise exception 'Cannot return % of "%": only % left to return.', v_rec.quantity, v_item.product_name, v_remaining_qty;
    end if;

    -- value of the returned part = its share of what the customer really paid for the line
    if v_rec.quantity = v_remaining_qty then
      v_net := v_item.net_amount - v_item.returned_net;
      v_tax := v_item.tax_amount - v_item.returned_tax;
    else
      v_net := round(v_item.net_amount * v_rec.quantity / v_item.quantity, 2);
      v_tax := round(v_item.tax_amount * v_rec.quantity / v_item.quantity, 2);
    end if;

    update public.sale_items
       set returned_qty = returned_qty + v_rec.quantity,
           returned_net = returned_net + v_net,
           returned_tax = returned_tax + v_tax
     where id = v_item.id;

    insert into public.sales_return_items (shop_id, return_id, sale_item_id, product_id, quantity, net_amount, tax_amount)
    values (p_shop_id, v_return, v_item.id, v_item.product_id, v_rec.quantity, v_net, v_tax);

    -- Goods go back on the shelf at the cost they were sold at (weighted average).
    select unit_cost into v_cost from public.sale_item_costs where sale_item_id = v_item.id;
    perform public._apply_weighted_cost(v_item.product_id, v_rec.quantity, v_cost);
    perform public._change_stock(p_shop_id, v_item.product_id, v_rec.quantity, 'sale_return',
                                 'Return ' || v_no || ' of ' || v_sale.invoice_no, 'sales_return', v_return);

    v_sum_net := v_sum_net + v_net;
    v_sum_tax := v_sum_tax + v_tax;
  end loop;

  v_value  := v_sum_net + v_sum_tax;
  if v_value <= 0 then raise exception 'Nothing to return.'; end if;
  v_credit := least(v_sale.balance_due, v_value);     -- first cancel what the customer still owes
  v_refund := v_value - v_credit;                     -- the rest is paid back

  if v_refund > 0 and p_refund_method not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then
    raise exception 'Choose how the refund is paid.';
  end if;

  update public.sales_returns
     set return_value = v_value, net_value = v_sum_net, tax_value = v_sum_tax,
         credit_applied = v_credit, refund_amount = v_refund,
         refund_method = case when v_refund > 0 then p_refund_method end
   where id = v_return;

  update public.sales
     set returned_value = returned_value + v_value,
         refunded_amount = refunded_amount + v_refund
   where id = p_sale_id;
  perform public._refresh_sale_balance(p_sale_id);

  update public.sales s set status = case
      when (select sum(quantity - returned_qty) from public.sale_items where sale_id = s.id) = 0 then 'returned'
      else 'partially_returned' end
   where s.id = p_sale_id;

  if v_refund > 0 then
    insert into public.financial_transactions
      (shop_id, direction, category, amount, method, reference_type, reference_id, description, created_by)
    values (p_shop_id, 'out', 'customer_refund', v_refund, p_refund_method, 'sales_return', v_return,
            'Refund ' || v_no || ' (' || v_sale.invoice_no || ')', auth.uid());
  end if;

  perform public._audit(p_shop_id, 'create', 'sales_returns', v_return,
    jsonb_build_object('return_no', v_no, 'sale', v_sale.invoice_no, 'value', v_value, 'refund', v_refund));
  return v_return;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. PURCHASES
-- -----------------------------------------------------------------------------
-- Spread discount and extra costs over the lines and put the goods in stock.
create or replace function public._receive_purchase_stock(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p     public.purchases;
  v_item  record;
  v_net_sum numeric;
  v_landed  numeric;
begin
  select * into v_p from public.purchases where id = p_purchase_id for update;
  select coalesce(sum(net_amount), 0) into v_net_sum from public.purchase_items where purchase_id = p_purchase_id;

  for v_item in select * from public.purchase_items where purchase_id = p_purchase_id order by product_id loop
    -- landed cost per unit = (net price of the line + its share of freight etc.) / quantity
    v_landed := (v_item.net_amount
                 + case when v_net_sum > 0 then v_p.additional_costs * v_item.net_amount / v_net_sum else 0 end)
                / v_item.quantity;
    update public.purchase_items set landed_unit_cost = round(v_landed, 4) where id = v_item.id;

    perform public._apply_weighted_cost(v_item.product_id, v_item.quantity, round(v_landed, 4));
    update public.product_costs set purchase_price = v_item.unit_price where product_id = v_item.product_id;
    perform public._change_stock(v_p.shop_id, v_item.product_id, v_item.quantity, 'purchase',
                                 'Purchase ' || v_p.purchase_no, 'purchase', v_p.id);
  end loop;

  update public.purchases set status = 'received', received_at = now() where id = p_purchase_id;
end;
$$;
revoke all on function public._receive_purchase_stock(uuid) from public, anon, authenticated;

-- p_items: [{ "product_id": uuid, "quantity": 10, "unit_price": 120.50 }]
-- (Unlike sales, the purchase price IS entered by the user — it comes from the supplier's invoice.)
create or replace function public.create_purchase(
  p_shop_id         uuid,
  p_idempotency_key uuid,
  p_supplier_id     uuid,
  p_items           jsonb,
  p_discount        numeric,
  p_additional_costs numeric,
  p_payments        jsonb,
  p_receive         boolean,          -- true = goods arrived now; false = purchase order only
  p_supplier_invoice text default null,
  p_notes           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id        uuid := gen_random_uuid();
  v_existing  uuid;
  v_rec       record;
  v_prod      public.products;
  v_subtotal  numeric;
  v_discount  numeric := least(greatest(coalesce(p_discount, 0), 0), 1e12);
  v_extra     numeric := greatest(coalesce(p_additional_costs, 0), 0);
  v_net_total numeric;
  v_total     numeric;
  v_diff      numeric;
  v_pay       jsonb;
  v_paid      numeric := 0;
  v_no        text;
begin
  perform public.assert_permission(p_shop_id, 'purchases.manage');

  select id into v_existing from public.purchases where shop_id = p_shop_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then return v_existing; end if;

  if not exists (select 1 from public.suppliers where id = p_supplier_id and shop_id = p_shop_id) then
    raise exception 'Select a supplier.';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product.';
  end if;

  v_no := 'PUR-' || lpad(public.next_number(p_shop_id, 'purchase')::text, 5, '0');
  begin
    insert into public.purchases (id, shop_id, purchase_no, supplier_id, supplier_invoice, subtotal, total,
                                  notes, idempotency_key, created_by)
    values (v_id, p_shop_id, v_no, p_supplier_id, nullif(btrim(coalesce(p_supplier_invoice, '')), ''), 0, 0,
            nullif(btrim(coalesce(p_notes, '')), ''), p_idempotency_key, auth.uid());
  exception when unique_violation then
    select id into v_existing from public.purchases where shop_id = p_shop_id and idempotency_key = p_idempotency_key;
    if v_existing is not null then return v_existing; end if;
    raise;
  end;

  for v_rec in
    select (x ->> 'product_id')::uuid as product_id,
           sum((x ->> 'quantity')::numeric) as quantity,
           max((x ->> 'unit_price')::numeric) as unit_price
      from jsonb_array_elements(p_items) x group by 1 order by 1
  loop
    if v_rec.quantity is null or v_rec.quantity <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
    if v_rec.unit_price is null or v_rec.unit_price < 0 then raise exception 'Enter a valid purchase price.'; end if;
    select * into v_prod from public.products where id = v_rec.product_id and shop_id = p_shop_id;
    if not found then raise exception 'A product in the list no longer exists.'; end if;
    insert into public.purchase_items (shop_id, purchase_id, product_id, product_name, quantity, unit_price, line_total, net_amount)
    values (p_shop_id, v_id, v_prod.id, v_prod.name, v_rec.quantity, round(v_rec.unit_price, 2),
            round(v_rec.quantity * v_rec.unit_price, 2), round(v_rec.quantity * v_rec.unit_price, 2));
  end loop;

  select sum(line_total) into v_subtotal from public.purchase_items where purchase_id = v_id;
  v_discount := least(v_discount, v_subtotal);
  v_net_total := v_subtotal - v_discount;
  if v_subtotal > 0 then
    update public.purchase_items set net_amount = round(line_total * v_net_total / v_subtotal, 2) where purchase_id = v_id;
    select v_net_total - sum(net_amount) into v_diff from public.purchase_items where purchase_id = v_id;
    if v_diff <> 0 then
      update public.purchase_items set net_amount = net_amount + v_diff
       where id = (select id from public.purchase_items where purchase_id = v_id order by line_total desc, id limit 1);
    end if;
  end if;
  v_total := v_net_total + v_extra;

  update public.purchases
     set subtotal = v_subtotal, discount_amount = v_discount, additional_costs = v_extra, total = v_total,
         balance_due = v_total, payment_status = case when v_total = 0 then 'paid' else 'unpaid' end
   where id = v_id;

  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if v_pay ->> 'method' = 'credit' then continue; end if;
    if (v_pay ->> 'method') not in ('cash', 'bank_transfer', 'card', 'mobile_payment') or coalesce((v_pay ->> 'amount')::numeric, 0) < 0 then
      raise exception 'Invalid payment.';
    end if;
    v_paid := v_paid + coalesce((v_pay ->> 'amount')::numeric, 0);
  end loop;
  if v_paid > v_total then raise exception 'Payments are more than the purchase total.'; end if;
  for v_pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if v_pay ->> 'method' = 'credit' or coalesce((v_pay ->> 'amount')::numeric, 0) = 0 then continue; end if;
    perform public._apply_purchase_payment(p_shop_id, v_id, v_pay ->> 'method', (v_pay ->> 'amount')::numeric, v_pay ->> 'reference');
  end loop;

  if p_receive then
    perform public._receive_purchase_stock(v_id);
  end if;

  perform public._audit(p_shop_id, 'create', 'purchases', v_id,
    jsonb_build_object('purchase_no', v_no, 'total', v_total, 'received', p_receive));
  return v_id;
end;
$$;

-- Goods of a purchase order arrived.
create or replace function public.receive_purchase(p_shop_id uuid, p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.assert_permission(p_shop_id, 'purchases.manage');
  select status into v_status from public.purchases where id = p_purchase_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Purchase not found.'; end if;
  if v_status <> 'ordered' then raise exception 'Only an ordered purchase can be received.'; end if;
  perform public._receive_purchase_stock(p_purchase_id);
  perform public._audit(p_shop_id, 'update', 'purchases', p_purchase_id, jsonb_build_object('status', 'received'));
end;
$$;

create or replace function public.cancel_purchase(p_shop_id uuid, p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases;
begin
  perform public.assert_permission(p_shop_id, 'purchases.manage');
  select * into v from public.purchases where id = p_purchase_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Purchase not found.'; end if;
  if v.status <> 'ordered' then raise exception 'Only an ordered (not yet received) purchase can be cancelled.'; end if;
  if v.amount_paid > 0 then raise exception 'This order already has payments. Refund them first.'; end if;
  update public.purchases set status = 'cancelled', balance_due = 0 where id = p_purchase_id;
  perform public._audit(p_shop_id, 'update', 'purchases', p_purchase_id, jsonb_build_object('status', 'cancelled'));
end;
$$;

create or replace function public.add_purchase_payment(
  p_shop_id uuid, p_purchase_id uuid, p_method text, p_amount numeric, p_reference text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.purchases;
begin
  perform public.assert_permission(p_shop_id, 'purchases.manage');
  if p_method not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then raise exception 'Choose a payment method.'; end if;
  select * into v from public.purchases where id = p_purchase_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Purchase not found.'; end if;
  if v.status = 'cancelled' then raise exception 'This purchase was cancelled.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a valid amount.'; end if;
  if p_amount > v.balance_due then raise exception 'The amount is more than the balance due (%).', v.balance_due; end if;
  perform public._apply_purchase_payment(p_shop_id, p_purchase_id, p_method, p_amount, p_reference);
end;
$$;

-- Pay a supplier: applied to the oldest unpaid received purchases first.
create or replace function public.record_supplier_payment(
  p_shop_id uuid, p_supplier_id uuid, p_amount numeric, p_method text, p_reference text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left numeric := p_amount;
  v_row record;
  v_apply numeric;
  v_outstanding numeric;
begin
  perform public.assert_permission(p_shop_id, 'purchases.manage');
  if p_method not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then raise exception 'Choose a payment method.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a valid amount.'; end if;
  select coalesce(sum(balance_due), 0) into v_outstanding from public.purchases
   where shop_id = p_shop_id and supplier_id = p_supplier_id and status = 'received';
  if p_amount > v_outstanding then raise exception 'The amount is more than what you owe this supplier (%).', v_outstanding; end if;

  for v_row in
    select id, balance_due from public.purchases
     where shop_id = p_shop_id and supplier_id = p_supplier_id and status = 'received' and balance_due > 0
     order by ordered_at, id for update
  loop
    exit when v_left <= 0;
    v_apply := least(v_left, v_row.balance_due);
    perform public._apply_purchase_payment(p_shop_id, v_row.id, p_method, v_apply, p_reference);
    v_left := v_left - v_apply;
  end loop;
  return p_amount;
end;
$$;

-- Goods sent back to the supplier. p_items: [{ "purchase_item_id": uuid, "quantity": 2 }]
create or replace function public.complete_purchase_return(
  p_shop_id       uuid,
  p_purchase_id   uuid,
  p_items         jsonb,
  p_refund_method text,
  p_reason        text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p       public.purchases;
  v_rec     record;
  v_item    public.purchase_items;
  v_remaining numeric;
  v_value   numeric;
  v_sum     numeric := 0;
  v_credit  numeric;
  v_refund  numeric;
  v_return  uuid := gen_random_uuid();
  v_no      text;
begin
  perform public.assert_permission(p_shop_id, 'purchases.manage');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Please enter a reason for the return.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one item to return.';
  end if;
  select * into v_p from public.purchases where id = p_purchase_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Purchase not found.'; end if;
  if v_p.status <> 'received' then raise exception 'Only received purchases can be returned.'; end if;

  v_no := 'PRT-' || lpad(public.next_number(p_shop_id, 'purchase_return')::text, 5, '0');
  insert into public.purchase_returns (id, shop_id, return_no, purchase_id, return_value, reason, created_by)
  values (v_return, p_shop_id, v_no, p_purchase_id, 0.01, btrim(p_reason), auth.uid());

  for v_rec in
    select (x ->> 'purchase_item_id')::uuid as purchase_item_id, sum((x ->> 'quantity')::numeric) as quantity
      from jsonb_array_elements(p_items) x group by 1 order by 1
  loop
    if v_rec.quantity is null or v_rec.quantity <= 0 then raise exception 'Return quantity must be greater than zero.'; end if;
    select * into v_item from public.purchase_items where id = v_rec.purchase_item_id and purchase_id = p_purchase_id for update;
    if not found then raise exception 'Item does not belong to this purchase.'; end if;
    v_remaining := v_item.quantity - v_item.returned_qty;
    if v_rec.quantity > v_remaining then
      raise exception 'Cannot return % of "%": only % left.', v_rec.quantity, v_item.product_name, v_remaining;
    end if;
    if public._main_stock(v_item.product_id) < v_rec.quantity then
      raise exception 'Not enough stock of "%" to send back.', v_item.product_name;
    end if;

    -- value credited by the supplier = the line's net price (extra costs are not refunded)
    if v_rec.quantity = v_remaining then
      v_value := v_item.net_amount - v_item.returned_value;
    else
      v_value := round(v_item.net_amount * v_rec.quantity / v_item.quantity, 2);
    end if;

    update public.purchase_items set returned_qty = returned_qty + v_rec.quantity, returned_value = returned_value + v_value
     where id = v_item.id;
    insert into public.purchase_return_items (shop_id, return_id, purchase_item_id, product_id, quantity, value)
    values (p_shop_id, v_return, v_item.id, v_item.product_id, v_rec.quantity, v_value);

    perform public._change_stock(p_shop_id, v_item.product_id, -v_rec.quantity, 'purchase_return',
                                 'Return ' || v_no || ' of ' || v_p.purchase_no, 'purchase_return', v_return);
    v_sum := v_sum + v_value;
  end loop;

  if v_sum <= 0 then raise exception 'Nothing to return.'; end if;
  v_credit := least(v_p.balance_due, v_sum);
  v_refund := v_sum - v_credit;
  if v_refund > 0 and p_refund_method not in ('cash', 'bank_transfer', 'card', 'mobile_payment') then
    raise exception 'Choose how the supplier refunds you.';
  end if;

  update public.purchase_returns
     set return_value = v_sum, credit_applied = v_credit, refund_amount = v_refund,
         refund_method = case when v_refund > 0 then p_refund_method end
   where id = v_return;
  update public.purchases set returned_value = returned_value + v_sum, refunded_amount = refunded_amount + v_refund
   where id = p_purchase_id;
  perform public._refresh_purchase_balance(p_purchase_id);

  if v_refund > 0 then
    insert into public.financial_transactions
      (shop_id, direction, category, amount, method, reference_type, reference_id, description, created_by)
    values (p_shop_id, 'in', 'supplier_refund', v_refund, p_refund_method, 'purchase_return', v_return,
            'Supplier refund ' || v_no, auth.uid());
  end if;
  perform public._audit(p_shop_id, 'create', 'purchase_returns', v_return,
    jsonb_build_object('return_no', v_no, 'value', v_sum, 'refund', v_refund));
  return v_return;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RLS + privileges
-- -----------------------------------------------------------------------------
alter table public.financial_transactions  enable row level security;
alter table public.sales                   enable row level security;
alter table public.sale_items              enable row level security;
alter table public.sale_item_costs         enable row level security;
alter table public.sale_payments           enable row level security;
alter table public.sales_returns           enable row level security;
alter table public.sales_return_items      enable row level security;
alter table public.purchases               enable row level security;
alter table public.purchase_items          enable row level security;
alter table public.purchase_payments       enable row level security;
alter table public.purchase_returns        enable row level security;
alter table public.purchase_return_items   enable row level security;

create policy "fin: read"          on public.financial_transactions for select to authenticated using (public.has_shop_permission(shop_id, 'finance.view'));
create policy "sales: read"        on public.sales               for select to authenticated using (public.has_shop_permission(shop_id, 'sales.view'));
create policy "sale_items: read"   on public.sale_items          for select to authenticated using (public.has_shop_permission(shop_id, 'sales.view'));
create policy "sale_costs: read"   on public.sale_item_costs     for select to authenticated using (public.has_shop_permission(shop_id, 'finance.view'));
create policy "sale_pay: read"     on public.sale_payments       for select to authenticated using (public.has_shop_permission(shop_id, 'sales.view'));
create policy "sales_ret: read"    on public.sales_returns       for select to authenticated using (public.has_shop_permission(shop_id, 'sales.view'));
create policy "sales_ret_i: read"  on public.sales_return_items  for select to authenticated using (public.has_shop_permission(shop_id, 'sales.view'));
create policy "purchases: read"    on public.purchases           for select to authenticated using (public.has_shop_permission(shop_id, 'purchases.view'));
create policy "purchase_i: read"   on public.purchase_items      for select to authenticated using (public.has_shop_permission(shop_id, 'purchases.view'));
create policy "purchase_pay: read" on public.purchase_payments   for select to authenticated using (public.has_shop_permission(shop_id, 'purchases.view'));
create policy "purchase_ret: read" on public.purchase_returns    for select to authenticated using (public.has_shop_permission(shop_id, 'purchases.view'));
create policy "purchase_ret_i: read" on public.purchase_return_items for select to authenticated using (public.has_shop_permission(shop_id, 'purchases.view'));

revoke all on public.financial_transactions, public.sales, public.sale_items, public.sale_item_costs,
              public.sale_payments, public.sales_returns, public.sales_return_items,
              public.purchases, public.purchase_items, public.purchase_payments,
              public.purchase_returns, public.purchase_return_items, public.customer_balances, public.supplier_balances
  from anon, authenticated;
-- READ ONLY from the browser. All changes go through the functions above.
grant select on public.financial_transactions, public.sales, public.sale_items, public.sale_item_costs,
                public.sale_payments, public.sales_returns, public.sales_return_items,
                public.purchases, public.purchase_items, public.purchase_payments,
                public.purchase_returns, public.purchase_return_items, public.customer_balances, public.supplier_balances
  to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'complete_sale(uuid, uuid, uuid, jsonb, text, numeric, jsonb, text)',
    'add_sale_payment(uuid, uuid, text, numeric, text)',
    'record_customer_payment(uuid, uuid, numeric, text, text)',
    'complete_sales_return(uuid, uuid, jsonb, text, text)',
    'create_purchase(uuid, uuid, uuid, jsonb, numeric, numeric, jsonb, boolean, text, text)',
    'receive_purchase(uuid, uuid)',
    'cancel_purchase(uuid, uuid)',
    'add_purchase_payment(uuid, uuid, text, numeric, text)',
    'record_supplier_payment(uuid, uuid, numeric, text, text)',
    'complete_purchase_return(uuid, uuid, jsonb, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
