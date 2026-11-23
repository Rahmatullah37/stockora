-- =============================================================================
-- Stockora — Migration 6: Expenses, financial reports and dashboard (Phase 4)
-- =============================================================================
-- PROFIT DEFINITIONS (used by every report, so numbers always agree):
--   Gross sales     = sum of (quantity x selling price) of sold lines
--   Discounts       = gross sales - what customers were actually charged (before tax)
--   Returns         = value (before tax) of goods customers brought back
--   Net revenue     = gross sales - discounts - returns          (tax is NOT revenue)
--   COGS            = cost of goods sold - cost of returned goods
--                     (cost = the weighted average cost frozen on each sale line)
--   Gross profit    = net revenue - COGS
--   Stock losses    = cost of damaged / expired stock written off
--   Expenses        = rent, electricity, salaries, ... (not voided)
--   Net profit      = gross profit - expenses - stock losses
--   Profit margin % = gross profit / net revenue x 100
--   Markup %        = gross profit / COGS x 100
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Expenses
-- -----------------------------------------------------------------------------
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  category     text not null check (category in ('rent', 'electricity', 'salaries', 'transportation', 'other')),
  description  text not null check (char_length(btrim(description)) >= 1),
  amount       numeric(14, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  method       text not null default 'cash' check (method in ('cash', 'bank_transfer', 'card', 'mobile_payment')),
  status       text not null default 'active' check (status in ('active', 'void')),
  void_reason  text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index expenses_shop_date_idx on public.expenses (shop_id, expense_date desc);

create or replace function public.record_expense(
  p_shop_id uuid, p_category text, p_description text, p_amount numeric, p_date date, p_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  perform public.assert_permission(p_shop_id, 'expenses.manage');
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a valid amount.'; end if;
  insert into public.expenses (id, shop_id, category, description, amount, expense_date, method, created_by)
  values (v_id, p_shop_id, p_category, btrim(p_description), p_amount, coalesce(p_date, current_date),
          coalesce(p_method, 'cash'), auth.uid());
  insert into public.financial_transactions
    (shop_id, direction, category, amount, method, reference_type, reference_id, description, occurred_at, created_by)
  values (p_shop_id, 'out', 'expense', p_amount, coalesce(p_method, 'cash'), 'expense', v_id,
          initcap(p_category) || ': ' || btrim(p_description), now(), auth.uid());
  perform public._audit(p_shop_id, 'create', 'expenses', v_id,
    jsonb_build_object('category', p_category, 'amount', p_amount));
  return v_id;
end;
$$;

-- Expenses are never deleted: a mistaken one is VOIDED, which adds a reversing cash entry.
create or replace function public.void_expense(p_shop_id uuid, p_expense_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.expenses;
begin
  perform public.assert_permission(p_shop_id, 'expenses.manage');
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Please enter a reason.'; end if;
  select * into v from public.expenses where id = p_expense_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Expense not found.'; end if;
  if v.status = 'void' then raise exception 'This expense is already voided.'; end if;
  update public.expenses set status = 'void', void_reason = btrim(p_reason) where id = p_expense_id;
  insert into public.financial_transactions
    (shop_id, direction, category, amount, method, reference_type, reference_id, description, created_by)
  values (p_shop_id, 'in', 'expense_void', v.amount, v.method, 'expense', v.id,
          'Voided expense: ' || v.description, auth.uid());
  perform public._audit(p_shop_id, 'update', 'expenses', p_expense_id,
    jsonb_build_object('status', 'void', 'reason', p_reason));
end;
$$;

alter table public.expenses enable row level security;
create policy "expenses: read" on public.expenses for select to authenticated
  using (public.has_shop_permission(shop_id, 'expenses.view'));
revoke all on public.expenses from anon, authenticated;
grant select on public.expenses to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Helpers
-- -----------------------------------------------------------------------------
create or replace function public._day_start(p_shop_id uuid, p_date date)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select (p_date::timestamp) at time zone
         coalesce((select timezone from public.shop_settings where shop_id = p_shop_id), 'UTC');
$$;

create or replace function public._shop_today(p_shop_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone coalesce((select timezone from public.shop_settings where shop_id = p_shop_id), 'UTC'))::date;
$$;

-- The one place where profit is calculated (see the definitions at the top).
create or replace function public._profit_figures(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0 timestamptz := public._day_start(p_shop_id, p_from);
  t1 timestamptz := public._day_start(p_shop_id, p_to + 1);
  v_gross numeric; v_net_lines numeric; v_cogs_sold numeric; v_tax numeric; v_invoices integer;
  v_ret_net numeric; v_ret_cogs numeric; v_expenses numeric; v_losses numeric;
  v_net_rev numeric; v_cogs numeric; v_gp numeric;
begin
  select coalesce(sum(i.gross_amount), 0), coalesce(sum(i.net_amount), 0),
         coalesce(sum(i.quantity * c.unit_cost), 0), coalesce(sum(i.tax_amount), 0),
         count(distinct s.id)
    into v_gross, v_net_lines, v_cogs_sold, v_tax, v_invoices
    from public.sales s
    join public.sale_items i on i.sale_id = s.id
    left join public.sale_item_costs c on c.sale_item_id = i.id
   where s.shop_id = p_shop_id and s.sold_at >= t0 and s.sold_at < t1;

  select coalesce(sum(ri.net_amount), 0), coalesce(sum(ri.quantity * c.unit_cost), 0)
    into v_ret_net, v_ret_cogs
    from public.sales_returns r
    join public.sales_return_items ri on ri.return_id = r.id
    join public.sale_item_costs c on c.sale_item_id = ri.sale_item_id
   where r.shop_id = p_shop_id and r.created_at >= t0 and r.created_at < t1;

  select coalesce(sum(amount), 0) into v_expenses from public.expenses
   where shop_id = p_shop_id and status = 'active' and expense_date between p_from and p_to;

  select coalesce(sum(-m.quantity_change * coalesce(m.unit_cost, 0)), 0) into v_losses
    from public.inventory_movements m
   where m.shop_id = p_shop_id and m.movement_type in ('damaged', 'expired')
     and m.created_at >= t0 and m.created_at < t1;

  v_net_rev := v_net_lines - v_ret_net;
  v_cogs    := v_cogs_sold - v_ret_cogs;
  v_gp      := v_net_rev - v_cogs;

  return jsonb_build_object(
    'invoice_count', v_invoices,
    'gross_sales',   v_gross,
    'discounts',     v_gross - v_net_lines,
    'returns',       v_ret_net,
    'net_revenue',   v_net_rev,
    'tax_collected', v_tax,
    'cogs',          v_cogs,
    'gross_profit',  v_gp,
    'expenses',      v_expenses,
    'stock_losses',  v_losses,
    'net_profit',    v_gp - v_expenses - v_losses,
    'margin_pct',    case when v_net_rev > 0 then round(v_gp / v_net_rev * 100, 2) else 0 end,
    'markup_pct',    case when v_cogs > 0 then round(v_gp / v_cogs * 100, 2) else 0 end
  );
end;
$$;
revoke all on function public._day_start(uuid, date) from public, anon, authenticated;
revoke all on function public._shop_today(uuid) from public, anon, authenticated;
revoke all on function public._profit_figures(uuid, date, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Reports (each checks the caller's permission)
-- -----------------------------------------------------------------------------
-- Profit & Loss + cash flow + receivables/payables for a date range.
create or replace function public.report_profit_loss(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0 timestamptz;
  t1 timestamptz;
  v_exp jsonb;
  v_cash jsonb;
begin
  perform public.assert_permission(p_shop_id, 'finance.view');
  perform public.assert_feature(p_shop_id, 'financial_reports');
  t0 := public._day_start(p_shop_id, p_from);
  t1 := public._day_start(p_shop_id, p_to + 1);

  select coalesce(jsonb_agg(jsonb_build_object('category', category, 'amount', total) order by total desc), '[]')
    into v_exp
    from (select category, sum(amount) as total from public.expenses
           where shop_id = p_shop_id and status = 'active' and expense_date between p_from and p_to
           group by category) e;

  select jsonb_build_object(
           'cash_in',  coalesce(sum(amount) filter (where direction = 'in'), 0),
           'cash_out', coalesce(sum(amount) filter (where direction = 'out'), 0),
           'net_cash_flow', coalesce(sum(case direction when 'in' then amount else -amount end), 0))
    into v_cash
    from public.financial_transactions
   where shop_id = p_shop_id and occurred_at >= t0 and occurred_at < t1;

  return public._profit_figures(p_shop_id, p_from, p_to) || jsonb_build_object(
    'expenses_by_category', v_exp,
    'cash_flow', v_cash,
    'receivables', (select coalesce(sum(balance_due), 0) from public.sales where shop_id = p_shop_id),
    'payables', (select coalesce(sum(balance_due), 0) from public.purchases where shop_id = p_shop_id and status = 'received')
  );
end;
$$;

-- Sales grouped by day / week / month / year.
create or replace function public.report_sales(p_shop_id uuid, p_from date, p_to date, p_group text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0 timestamptz;
  t1 timestamptz;
  v_tz text := coalesce((select timezone from public.shop_settings where shop_id = p_shop_id), 'UTC');
  v_can_profit boolean;
  v_rows jsonb;
begin
  perform public.assert_permission(p_shop_id, 'reports.view');
  perform public.assert_feature(p_shop_id, 'basic_reports');
  if p_group not in ('day', 'week', 'month', 'year') then raise exception 'Invalid grouping.'; end if;
  v_can_profit := public.has_shop_permission(p_shop_id, 'finance.view');
  t0 := public._day_start(p_shop_id, p_from);
  t1 := public._day_start(p_shop_id, p_to + 1);

  with lines as (
    select date_trunc(p_group, s.sold_at at time zone v_tz)::date as period,
           s.id as sale_id, i.gross_amount, i.net_amount, i.tax_amount,
           i.quantity * coalesce(c.unit_cost, 0) as cost
      from public.sales s
      join public.sale_items i on i.sale_id = s.id
      left join public.sale_item_costs c on c.sale_item_id = i.id
     where s.shop_id = p_shop_id and s.sold_at >= t0 and s.sold_at < t1
  ), sold as (
    select period, count(distinct sale_id) as invoices, sum(gross_amount) as gross, sum(net_amount) as net,
           sum(tax_amount) as tax, sum(cost) as cogs
      from lines group by period
  ), rets as (
    select date_trunc(p_group, r.created_at at time zone v_tz)::date as period,
           sum(ri.net_amount) as net, sum(ri.quantity * coalesce(c.unit_cost, 0)) as cost
      from public.sales_returns r
      join public.sales_return_items ri on ri.return_id = r.id
      left join public.sale_item_costs c on c.sale_item_id = ri.sale_item_id
     where r.shop_id = p_shop_id and r.created_at >= t0 and r.created_at < t1
     group by 1
  ), periods as (
    select period from sold union select period from rets
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'period', p.period,
      'invoices', coalesce(s.invoices, 0),
      'gross_sales', coalesce(s.gross, 0),
      'discounts', coalesce(s.gross, 0) - coalesce(s.net, 0),
      'returns', coalesce(r.net, 0),
      'net_revenue', coalesce(s.net, 0) - coalesce(r.net, 0),
      'tax', coalesce(s.tax, 0),
      'cogs', case when v_can_profit then coalesce(s.cogs, 0) - coalesce(r.cost, 0) end,
      'gross_profit', case when v_can_profit then (coalesce(s.net, 0) - coalesce(r.net, 0)) - (coalesce(s.cogs, 0) - coalesce(r.cost, 0)) end
    ) order by p.period), '[]'::jsonb)
    into v_rows
    from periods p
    left join sold s on s.period = p.period
    left join rets r on r.period = p.period;
  return v_rows;
end;
$$;

-- Per-product performance (best sellers, slow movers, product-level profit).
create or replace function public.report_product_performance(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0 timestamptz;
  t1 timestamptz;
  v_can_profit boolean;
  v_rows jsonb;
begin
  perform public.assert_permission(p_shop_id, 'reports.view');
  perform public.assert_feature(p_shop_id, 'basic_reports');
  v_can_profit := public.has_shop_permission(p_shop_id, 'finance.view');
  t0 := public._day_start(p_shop_id, p_from);
  t1 := public._day_start(p_shop_id, p_to + 1);

  select coalesce(jsonb_agg(row_to_json(x) order by x.qty_sold desc, x.name), '[]'::jsonb) into v_rows
  from (
    select p.id as product_id, p.name, p.sku, p.current_stock, p.status,
           coalesce(sold.qty, 0) - coalesce(ret.qty, 0)                       as qty_sold,
           coalesce(sold.net, 0) - coalesce(ret.net, 0)                       as net_revenue,
           case when v_can_profit then coalesce(sold.net, 0) - coalesce(ret.net, 0)
                                       - (coalesce(sold.cost, 0) - coalesce(ret.cost, 0)) end as gross_profit,
           (select max(s2.sold_at) from public.sale_items i2 join public.sales s2 on s2.id = i2.sale_id
             where i2.product_id = p.id)                                      as last_sold_at
      from public.products p
      left join (
        select i.product_id, sum(i.quantity) qty, sum(i.net_amount) net, sum(i.quantity * coalesce(c.unit_cost, 0)) cost
          from public.sales s join public.sale_items i on i.sale_id = s.id
          left join public.sale_item_costs c on c.sale_item_id = i.id
         where s.shop_id = p_shop_id and s.sold_at >= t0 and s.sold_at < t1
         group by i.product_id) sold on sold.product_id = p.id
      left join (
        select ri.product_id, sum(ri.quantity) qty, sum(ri.net_amount) net, sum(ri.quantity * coalesce(c.unit_cost, 0)) cost
          from public.sales_returns r join public.sales_return_items ri on ri.return_id = r.id
          left join public.sale_item_costs c on c.sale_item_id = ri.sale_item_id
         where r.shop_id = p_shop_id and r.created_at >= t0 and r.created_at < t1
         group by ri.product_id) ret on ret.product_id = p.id
     where p.shop_id = p_shop_id and p.status <> 'archived'
  ) x;
  return v_rows;
end;
$$;

-- Stock valuation (needs cost visibility).
create or replace function public.report_inventory_valuation(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform public.assert_permission(p_shop_id, 'finance.view');
  select coalesce(jsonb_agg(row_to_json(x) order by x.stock_value desc), '[]'::jsonb) into v_rows
  from (
    select p.id as product_id, p.name, p.sku, p.unit, p.current_stock, c.avg_cost,
           round(p.current_stock * c.avg_cost, 2)        as stock_value,
           round(p.current_stock * p.selling_price, 2)   as retail_value
      from public.products p join public.product_costs c on c.product_id = p.id
     where p.shop_id = p_shop_id and p.status <> 'archived' and p.current_stock > 0
  ) x;
  return v_rows;
end;
$$;

-- Money by payment method + cash flow per day.
create or replace function public.report_payments(p_shop_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t0 timestamptz;
  t1 timestamptz;
  v_tz text := coalesce((select timezone from public.shop_settings where shop_id = p_shop_id), 'UTC');
  v_methods jsonb;
  v_daily jsonb;
begin
  perform public.assert_permission(p_shop_id, 'finance.view');
  t0 := public._day_start(p_shop_id, p_from);
  t1 := public._day_start(p_shop_id, p_to + 1);

  select coalesce(jsonb_agg(jsonb_build_object('method', method, 'money_in', money_in, 'money_out', money_out) order by method), '[]')
    into v_methods
    from (select method,
                 coalesce(sum(amount) filter (where direction = 'in'), 0) as money_in,
                 coalesce(sum(amount) filter (where direction = 'out'), 0) as money_out
            from public.financial_transactions
           where shop_id = p_shop_id and occurred_at >= t0 and occurred_at < t1
           group by method) m;

  select coalesce(jsonb_agg(jsonb_build_object('date', d, 'money_in', money_in, 'money_out', money_out) order by d), '[]')
    into v_daily
    from (select (occurred_at at time zone v_tz)::date as d,
                 coalesce(sum(amount) filter (where direction = 'in'), 0) as money_in,
                 coalesce(sum(amount) filter (where direction = 'out'), 0) as money_out
            from public.financial_transactions
           where shop_id = p_shop_id and occurred_at >= t0 and occurred_at < t1
           group by 1) d;

  return jsonb_build_object('by_method', v_methods, 'daily', v_daily);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Dashboard (every number is computed from real records)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_summary(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_can_sales boolean := public.has_shop_permission(p_shop_id, 'sales.view');
  v_can_fin   boolean := public.has_shop_permission(p_shop_id, 'finance.view');
  v_can_purch boolean := public.has_shop_permission(p_shop_id, 'purchases.view');
  v_can_exp   boolean := public.has_shop_permission(p_shop_id, 'expenses.view');
  v_can_prod  boolean := public.has_shop_permission(p_shop_id, 'products.view');
  v_can_cust  boolean := public.has_shop_permission(p_shop_id, 'customers.view');
  v_can_supp  boolean := public.has_shop_permission(p_shop_id, 'suppliers.view');
  v_tz text;
  t0 timestamptz;
  t1 timestamptz;
  v_today_fig jsonb;
  v_month_fig jsonb;
  v_out jsonb := '{}'::jsonb;
  v_daily jsonb;
  v_monthly jsonb;
  v_pe jsonb := '[]'::jsonb;
  v_top jsonb;
  v_recent jsonb;
  v_alerts jsonb;
  m date;
  f jsonb;
begin
  if not public.is_shop_member(p_shop_id) then
    raise exception 'You do not have permission to do this.' using errcode = '42501';
  end if;
  v_today := public._shop_today(p_shop_id);
  v_tz := coalesce((select timezone from public.shop_settings where shop_id = p_shop_id), 'UTC');
  t0 := public._day_start(p_shop_id, v_today);
  t1 := public._day_start(p_shop_id, v_today + 1);

  if v_can_prod then
    v_out := v_out || jsonb_build_object(
      'total_products', (select count(*) from public.products where shop_id = p_shop_id and status <> 'archived'),
      'low_stock_count', (select count(*) from public.products
                           where shop_id = p_shop_id and status = 'active' and current_stock <= min_stock_level));
  end if;
  if v_can_fin then
    v_out := v_out || jsonb_build_object(
      'stock_value', (select coalesce(sum(p.current_stock * c.avg_cost), 0)
                        from public.products p join public.product_costs c on c.product_id = p.id
                       where p.shop_id = p_shop_id and p.status <> 'archived'));
  end if;
  if v_can_cust then
    v_out := v_out || jsonb_build_object('total_customers', (select count(*) from public.customers where shop_id = p_shop_id and is_active));
  end if;
  if v_can_supp then
    v_out := v_out || jsonb_build_object('total_suppliers', (select count(*) from public.suppliers where shop_id = p_shop_id and is_active));
  end if;
  if v_can_sales then
    v_today_fig := public._profit_figures(p_shop_id, v_today, v_today);
    v_out := v_out || jsonb_build_object(
      'today_sales', (v_today_fig ->> 'net_revenue')::numeric,
      'today_invoices', (v_today_fig ->> 'invoice_count')::integer,
      'receivables', (select coalesce(sum(balance_due), 0) from public.sales where shop_id = p_shop_id));
  end if;
  if v_can_purch then
    v_out := v_out || jsonb_build_object(
      'today_purchases', (select coalesce(sum(total), 0) from public.purchases
                           where shop_id = p_shop_id and status = 'received' and received_at >= t0 and received_at < t1),
      'payables', (select coalesce(sum(balance_due), 0) from public.purchases where shop_id = p_shop_id and status = 'received'));
  end if;
  if v_can_exp then
    v_out := v_out || jsonb_build_object(
      'today_expenses', (select coalesce(sum(amount), 0) from public.expenses
                          where shop_id = p_shop_id and status = 'active' and expense_date = v_today));
  end if;
  if v_can_fin then
    v_month_fig := public._profit_figures(p_shop_id, date_trunc('month', v_today)::date, v_today);
    v_out := v_out || jsonb_build_object(
      'today_gross_profit', (v_today_fig ->> 'gross_profit')::numeric,
      -- Estimated net profit of the month so far (profit - expenses - stock losses)
      'month_net_profit', (v_month_fig ->> 'net_profit')::numeric,
      'month_gross_profit', (v_month_fig ->> 'gross_profit')::numeric,
      'month_expenses', (v_month_fig ->> 'expenses')::numeric,
      'today_net_profit', (v_today_fig ->> 'net_profit')::numeric);
  end if;

  if v_can_sales then
    -- daily sales (net of returns): last 14 days
    select jsonb_agg(jsonb_build_object('date', g.d::date, 'sales', coalesce(x.net, 0) - coalesce(r.net, 0)) order by g.d) into v_daily
      from generate_series(v_today - 13, v_today, interval '1 day') g(d)
      left join (
        select (s.sold_at at time zone v_tz)::date as day, sum(i.net_amount) as net
          from public.sales s join public.sale_items i on i.sale_id = s.id
         where s.shop_id = p_shop_id and s.sold_at >= public._day_start(p_shop_id, v_today - 13)
         group by 1) x on x.day = g.d::date
      left join (
        select (rt.created_at at time zone v_tz)::date as day, sum(ri.net_amount) as net
          from public.sales_returns rt join public.sales_return_items ri on ri.return_id = rt.id
         where rt.shop_id = p_shop_id and rt.created_at >= public._day_start(p_shop_id, v_today - 13)
         group by 1) r on r.day = g.d::date;
    -- monthly sales (net of returns): last 12 months
    select jsonb_agg(jsonb_build_object('month', g.d::date, 'sales', coalesce(x.net, 0) - coalesce(r.net, 0)) order by g.d) into v_monthly
      from generate_series(date_trunc('month', v_today) - interval '11 months', date_trunc('month', v_today), interval '1 month') g(d)
      left join (
        select date_trunc('month', s.sold_at at time zone v_tz)::date as mon, sum(i.net_amount) as net
          from public.sales s join public.sale_items i on i.sale_id = s.id
         where s.shop_id = p_shop_id
           and s.sold_at >= public._day_start(p_shop_id, (date_trunc('month', v_today) - interval '11 months')::date)
         group by 1) x on x.mon = g.d::date
      left join (
        select date_trunc('month', rt.created_at at time zone v_tz)::date as mon, sum(ri.net_amount) as net
          from public.sales_returns rt join public.sales_return_items ri on ri.return_id = rt.id
         where rt.shop_id = p_shop_id
           and rt.created_at >= public._day_start(p_shop_id, (date_trunc('month', v_today) - interval '11 months')::date)
         group by 1) r on r.mon = g.d::date;
    v_out := v_out || jsonb_build_object('daily_sales', coalesce(v_daily, '[]'), 'monthly_sales', coalesce(v_monthly, '[]'));

    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top from (
      select i.product_name as name, sum(i.quantity - i.returned_qty) as qty, sum(i.net_amount - i.returned_net) as revenue
        from public.sales s join public.sale_items i on i.sale_id = s.id
       where s.shop_id = p_shop_id and s.sold_at >= public._day_start(p_shop_id, v_today - 29)
       group by i.product_id, i.product_name
       order by sum(i.quantity - i.returned_qty) desc limit 5) t;
    v_out := v_out || jsonb_build_object('top_products', v_top);

    select coalesce(jsonb_agg(row_to_json(t) order by t.at desc), '[]'::jsonb) into v_recent from (
      select 'sale' as kind, s.invoice_no as ref, s.total as amount, s.sold_at as at, s.payment_status as status
        from public.sales s where s.shop_id = p_shop_id order by s.sold_at desc limit 8) t;
    v_out := v_out || jsonb_build_object('recent_transactions', v_recent);
  end if;

  if v_can_fin then
    for m in select (date_trunc('month', v_today) - (n || ' months')::interval)::date from generate_series(5, 0, -1) n loop
      f := public._profit_figures(p_shop_id, m, least((m + interval '1 month - 1 day')::date, v_today));
      v_pe := v_pe || jsonb_build_object('month', m, 'gross_profit', (f ->> 'gross_profit')::numeric,
                                         'expenses', (f ->> 'expenses')::numeric, 'net_profit', (f ->> 'net_profit')::numeric);
    end loop;
    v_out := v_out || jsonb_build_object('profit_vs_expense', v_pe);
  end if;

  if v_can_prod then
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_alerts from (
      select id, name, sku, current_stock, min_stock_level, unit,
             case when current_stock <= 0 then 'out_of_stock'
                  when current_stock <= min_stock_level then 'low_stock'
                  else 'expiring' end as alert, expiry_date
        from public.products
       where shop_id = p_shop_id and status = 'active'
         and (current_stock <= min_stock_level or (expiry_date is not null and expiry_date <= v_today + 30))
       order by current_stock asc limit 10) t;
    v_out := v_out || jsonb_build_object('stock_alerts', v_alerts);
  end if;

  return v_out;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'record_expense(uuid, text, text, numeric, date, text)',
    'void_expense(uuid, uuid, text)',
    'report_profit_loss(uuid, date, date)',
    'report_sales(uuid, date, date, text)',
    'report_product_performance(uuid, date, date)',
    'report_inventory_valuation(uuid)',
    'report_payments(uuid, date, date)',
    'dashboard_summary(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
