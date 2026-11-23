-- =============================================================================
-- Stockora — Migration 7: SaaS features (Phase 5)
-- =============================================================================
-- Employees & invitations, configurable role permissions, plan limits,
-- Super Admin tools, plan-change requests and extra shops per user.
-- No payment provider is connected: plan changes are made by the Super Admin
-- (see docs/BILLING.md for how a provider plugs in later).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Configurable permissions per shop (Business plan: "advanced permissions")
-- -----------------------------------------------------------------------------
-- Default permissions live in role_permissions. A shop may override single
-- permissions for a role here. The Owner role can never be changed.
create table public.shop_role_permissions (
  shop_id       uuid not null references public.shops (id) on delete cascade,
  role_id       uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  granted       boolean not null,
  primary key (shop_id, role_id, permission_id)
);
create trigger shop_role_permissions_audit after insert or update or delete on public.shop_role_permissions
  for each row execute function public.log_audit();

-- Replaces the Phase 1 version: now honours per-shop overrides.
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
    join public.roles r on r.id = m.role_id
    where m.shop_id = p_shop_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and s.is_active
      and case
        when r.key = 'owner' then exists (
          select 1 from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
           where rp.role_id = m.role_id and p.key = p_permission)
        else coalesce(
          -- override (only honoured while the plan includes advanced permissions)
          (select o.granted from public.shop_role_permissions o
             join public.permissions p on p.id = o.permission_id
            where o.shop_id = m.shop_id and o.role_id = m.role_id and p.key = p_permission
              and public.plan_has_feature(m.shop_id, 'advanced_permissions')),
          exists (
            select 1 from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
             where rp.role_id = m.role_id and p.key = p_permission))
      end
  );
$$;

-- All permission keys the current user has in a shop (used by the app to build menus).
create or replace function public.my_permissions(p_shop_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.key order by p.key), '{}')
    from public.permissions p
   where public.has_shop_permission(p_shop_id, p.key);
$$;

create or replace function public.set_role_permission(
  p_shop_id uuid, p_role_key text, p_permission_key text, p_granted boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid;
  v_perm uuid;
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  perform public.assert_feature(p_shop_id, 'advanced_permissions');
  if p_role_key = 'owner' then raise exception 'The owner role cannot be changed.'; end if;
  if p_permission_key = 'subscription.manage' then raise exception 'Billing access belongs to the owner only.'; end if;
  select id into v_role from public.roles where key = p_role_key;
  select id into v_perm from public.permissions where key = p_permission_key;
  if v_role is null or v_perm is null then raise exception 'Unknown role or permission.'; end if;
  insert into public.shop_role_permissions (shop_id, role_id, permission_id, granted)
  values (p_shop_id, v_role, v_perm, p_granted)
  on conflict (shop_id, role_id, permission_id) do update set granted = excluded.granted;
end;
$$;

create or replace function public.reset_role_permissions(p_shop_id uuid, p_role_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  delete from public.shop_role_permissions
   where shop_id = p_shop_id and role_id = (select id from public.roles where key = p_role_key);
end;
$$;

alter table public.shop_role_permissions enable row level security;
create policy "role overrides: read" on public.shop_role_permissions for select to authenticated
  using (public.is_shop_member(shop_id));
revoke all on public.shop_role_permissions from anon, authenticated;
grant select on public.shop_role_permissions to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Employees: invitations + member management
-- -----------------------------------------------------------------------------
create table public.shop_invitations (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  email      text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role_id    uuid not null references public.roles (id) on delete restrict,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index shop_invitations_pending_unique on public.shop_invitations (shop_id, email) where status = 'pending';
create index shop_invitations_email_idx on public.shop_invitations (email) where status = 'pending';
alter table public.shop_invitations enable row level security;
create policy "invitations: read" on public.shop_invitations for select to authenticated
  using (public.has_shop_permission(shop_id, 'employees.view'));
revoke all on public.shop_invitations from anon, authenticated;
grant select on public.shop_invitations to authenticated;

-- Plan limit: staff accounts (the owner does not count).
create or replace function public.enforce_employee_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := (public.shop_plan(new.shop_id)).max_employees;
  v_used integer;
begin
  if (select key from public.roles where id = new.role_id) = 'owner' then return new; end if;
  if v_max is not null then
    select count(*) into v_used from public.shop_members m join public.roles r on r.id = m.role_id
     where m.shop_id = new.shop_id and r.key <> 'owner' and m.status in ('active', 'invited');
    if v_used >= v_max then
      raise exception 'PLAN_LIMIT: your plan allows up to % staff accounts. Please upgrade.', v_max using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger shop_members_enforce_limit before insert on public.shop_members
  for each row execute function public.enforce_employee_limit();

create or replace function public.enforce_branch_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer := (public.shop_plan(new.shop_id)).max_branches;
begin
  if new.is_main then return new; end if;
  perform public.assert_feature(new.shop_id, 'branches');
  if v_max is not null and (select count(*) from public.branches where shop_id = new.shop_id) >= v_max then
    raise exception 'PLAN_LIMIT: your plan allows up to % branches. Please upgrade.', v_max using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger branches_enforce_limit before insert on public.branches
  for each row execute function public.enforce_branch_limit();

create or replace function public.invite_employee(p_shop_id uuid, p_email text, p_role_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  public.roles;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_max   integer;
  v_used  integer;
  v_id    uuid;
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  perform public.assert_feature(p_shop_id, 'employees');
  select * into v_role from public.roles where key = p_role_key;
  if v_role.id is null or v_role.key = 'owner' then raise exception 'Choose a valid role.'; end if;
  if v_email not like '%_@_%' then raise exception 'Enter a valid email address.'; end if;
  if exists (select 1 from public.shop_members m join public.profiles pr on pr.id = m.user_id
              join auth.users u on u.id = pr.id
              where m.shop_id = p_shop_id and lower(u.email) = v_email) then
    raise exception 'This person already works in your shop.';
  end if;

  if exists (select 1 from public.shop_invitations where shop_id = p_shop_id and email = v_email and status = 'pending') then
    raise exception 'This email has already been invited.';
  end if;

  v_max := (public.shop_plan(p_shop_id)).max_employees;
  if v_max is not null then
    select (select count(*) from public.shop_members m join public.roles r on r.id = m.role_id
             where m.shop_id = p_shop_id and r.key <> 'owner' and m.status in ('active', 'invited'))
         + (select count(*) from public.shop_invitations where shop_id = p_shop_id and status = 'pending')
      into v_used;
    if v_used >= v_max then
      raise exception 'PLAN_LIMIT: your plan allows up to % staff accounts. Please upgrade.', v_max using errcode = 'P0001';
    end if;
  end if;

  insert into public.shop_invitations (shop_id, email, role_id, invited_by)
  values (p_shop_id, v_email, v_role.id, auth.uid())
  returning id into v_id;
  perform public._audit(p_shop_id, 'create', 'shop_invitations', v_id, jsonb_build_object('email', v_email, 'role', p_role_key));
  return v_id;
end;
$$;

create or replace function public.revoke_invitation(p_shop_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  update public.shop_invitations set status = 'revoked'
   where id = p_invitation_id and shop_id = p_shop_id and status = 'pending';
end;
$$;

-- Called after login: turns invitations for the user's VERIFIED email into memberships.
create or replace function public.accept_pending_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_inv   record;
  v_count integer := 0;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  for v_inv in select * from public.shop_invitations where email = v_email and status = 'pending' for update loop
    begin
      insert into public.shop_members (shop_id, user_id, role_id) values (v_inv.shop_id, auth.uid(), v_inv.role_id)
      on conflict (shop_id, user_id) do nothing;
      update public.shop_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
      v_count := v_count + 1;
    exception when others then
      -- e.g. the shop's staff limit was reached since the invitation; leave it pending
      raise notice 'invitation % not accepted: %', v_inv.id, sqlerrm;
    end;
  end loop;
  return v_count;
end;
$$;

create or replace function public.set_member_role(p_shop_id uuid, p_member_id uuid, p_role_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.shop_members;
  v_role   public.roles;
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  select * into v_member from public.shop_members where id = p_member_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Staff member not found.'; end if;
  if v_member.user_id = auth.uid() then raise exception 'You cannot change your own role.'; end if;
  if (select key from public.roles where id = v_member.role_id) = 'owner' then raise exception 'The owner cannot be changed.'; end if;
  select * into v_role from public.roles where key = p_role_key;
  if v_role.id is null or v_role.key = 'owner' then raise exception 'Choose a valid role.'; end if;
  update public.shop_members set role_id = v_role.id where id = p_member_id;
end;
$$;

create or replace function public.set_member_status(p_shop_id uuid, p_member_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.shop_members;
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  if p_status not in ('active', 'disabled') then raise exception 'Invalid status.'; end if;
  select * into v_member from public.shop_members where id = p_member_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Staff member not found.'; end if;
  if v_member.user_id = auth.uid() then raise exception 'You cannot disable yourself.'; end if;
  if (select key from public.roles where id = v_member.role_id) = 'owner' then raise exception 'The owner cannot be changed.'; end if;
  update public.shop_members set status = p_status where id = p_member_id;
end;
$$;

create or replace function public.remove_member(p_shop_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.shop_members;
begin
  perform public.assert_permission(p_shop_id, 'employees.manage');
  select * into v_member from public.shop_members where id = p_member_id and shop_id = p_shop_id for update;
  if not found then raise exception 'Staff member not found.'; end if;
  if v_member.user_id = auth.uid() then raise exception 'You cannot remove yourself.'; end if;
  if (select key from public.roles where id = v_member.role_id) = 'owner' then raise exception 'The owner cannot be removed.'; end if;
  delete from public.shop_members where id = p_member_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Extra shops for one user ("multiple shops")
-- -----------------------------------------------------------------------------
create or replace function public.create_additional_shop(
  p_name text, p_country text, p_currency text, p_category text, p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_lang  text;
begin
  if auth.uid() is null then raise exception 'Please log in.' using errcode = '42501'; end if;
  if (select count(*) from public.shops where owner_id = auth.uid()) >= 5 then
    raise exception 'You can own up to 5 shops.';
  end if;
  select email into v_email from auth.users where id = auth.uid();
  select preferred_language into v_lang from public.profiles where id = auth.uid();
  return public.create_shop_for_user(auth.uid(), btrim(p_name), v_email, null, upper(p_country),
                                     nullif(btrim(coalesce(p_address, '')), ''), upper(p_currency),
                                     coalesce(nullif(p_category, ''), 'general'), coalesce(v_lang, 'en'));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Plan change requests (the owner asks, the Super Admin applies)
-- -----------------------------------------------------------------------------
create table public.plan_change_requests (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  plan_id      uuid not null references public.subscription_plans (id) on delete restrict,
  note         text,
  status       text not null default 'open' check (status in ('open', 'done', 'rejected')),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index plan_change_requests_shop_idx on public.plan_change_requests (shop_id, created_at desc);
alter table public.plan_change_requests enable row level security;
create policy "plan requests: read" on public.plan_change_requests for select to authenticated
  using (public.has_shop_permission(shop_id, 'subscription.manage') or public.is_super_admin());
revoke all on public.plan_change_requests from anon, authenticated;
grant select on public.plan_change_requests to authenticated;

create or replace function public.request_plan_change(p_shop_id uuid, p_plan_key text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan uuid;
  v_id   uuid;
begin
  perform public.assert_permission(p_shop_id, 'subscription.manage');
  select id into v_plan from public.subscription_plans where key = p_plan_key and is_active;
  if v_plan is null then raise exception 'Unknown plan.'; end if;
  update public.plan_change_requests set status = 'rejected', resolved_at = now()
   where shop_id = p_shop_id and status = 'open';       -- only the newest request stays open
  insert into public.plan_change_requests (shop_id, plan_id, note, requested_by)
  values (p_shop_id, v_plan, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Super Admin tools (all check is_super_admin() inside)
-- -----------------------------------------------------------------------------
create or replace function public._assert_super_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Platform administrators only.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public._assert_super_admin() from public, anon, authenticated;

create or replace function public.admin_list_shops(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  perform public._assert_super_admin();
  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb) into v_rows
  from (
    select s.id, s.name, s.country, s.currency, s.is_active, s.created_at, u.email as owner_email, pr.full_name as owner_name,
           (public.shop_plan(s.id)).key as plan_key,
           (public.shop_plan(s.id)).name as plan_name,
           (select sub.status from public.subscriptions sub where sub.shop_id = s.id and sub.status in ('trialing', 'active', 'past_due') limit 1) as subscription_status,
           (select sub.current_period_end from public.subscriptions sub where sub.shop_id = s.id and sub.status in ('trialing', 'active', 'past_due') limit 1) as period_end,
           (select count(*) from public.products p where p.shop_id = s.id and p.status <> 'archived') as products,
           (select count(*) from public.shop_members m where m.shop_id = s.id and m.status = 'active') as members,
           (select count(*) from public.sales sl where sl.shop_id = s.id) as sales
      from public.shops s
      join public.profiles pr on pr.id = s.owner_id
      left join auth.users u on u.id = s.owner_id
     where p_search is null or p_search = ''
        or s.name ilike '%' || p_search || '%' or u.email ilike '%' || p_search || '%'
  ) x;
  return v_rows;
end;
$$;

create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._assert_super_admin();
  return jsonb_build_object(
    'shops', (select count(*) from public.shops),
    'active_shops', (select count(*) from public.shops where is_active),
    'users', (select count(*) from public.profiles),
    'new_shops_30d', (select count(*) from public.shops where created_at > now() - interval '30 days'),
    'open_requests', (select count(*) from public.plan_change_requests where status = 'open'),
    'by_plan', (select coalesce(jsonb_agg(jsonb_build_object('plan', pl.name, 'shops',
                  (select count(*) from public.shops s where (public.shop_plan(s.id)).id = pl.id)) order by pl.sort_order), '[]')
                  from public.subscription_plans pl)
  );
end;
$$;

create or replace function public.admin_set_shop_active(p_shop_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._assert_super_admin();
  update public.shops set is_active = p_active where id = p_shop_id;
  perform public._audit(p_shop_id, 'update', 'shops', p_shop_id, jsonb_build_object('is_active', p_active, 'by', 'super_admin'));
end;
$$;

-- Upgrade / downgrade / grant a trial. Writes a NEW subscription row so the
-- old ones remain as the history.
create or replace function public.admin_change_plan(
  p_shop_id        uuid,
  p_plan_key       text,
  p_status         text,                 -- 'active' | 'trialing'
  p_period_end     timestamptz default null,
  p_payment_status text default 'not_required',
  p_request_id     uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan  public.subscription_plans;
  v_id    uuid;
  v_products integer;
  v_staff integer;
  v_branches integer;
begin
  perform public._assert_super_admin();
  select * into v_plan from public.subscription_plans where key = p_plan_key;
  if v_plan.id is null then raise exception 'Unknown plan.'; end if;
  if p_status not in ('active', 'trialing') then raise exception 'Invalid status.'; end if;
  if p_payment_status not in ('not_required', 'pending', 'paid', 'failed', 'refunded') then raise exception 'Invalid payment status.'; end if;

  -- Downgrade safety: the shop must already fit inside the new limits.
  select count(*) into v_products from public.products where shop_id = p_shop_id and status <> 'archived';
  select count(*) into v_staff from public.shop_members m join public.roles r on r.id = m.role_id
   where m.shop_id = p_shop_id and r.key <> 'owner' and m.status in ('active', 'invited');
  select count(*) into v_branches from public.branches where shop_id = p_shop_id;
  if v_plan.max_products is not null and v_products > v_plan.max_products then
    raise exception 'The shop has % products; the % plan allows %. Ask the owner to archive some first.', v_products, v_plan.name, v_plan.max_products;
  end if;
  if v_plan.max_employees is not null and v_staff > v_plan.max_employees then
    raise exception 'The shop has % staff accounts; the % plan allows %.', v_staff, v_plan.name, v_plan.max_employees;
  end if;
  if v_plan.max_branches is not null and v_branches > v_plan.max_branches then
    raise exception 'The shop has % branches; the % plan allows %.', v_branches, v_plan.name, v_plan.max_branches;
  end if;

  update public.subscriptions set status = 'canceled', canceled_at = now()
   where shop_id = p_shop_id and status in ('trialing', 'active', 'past_due');

  insert into public.subscriptions (shop_id, plan_id, status, payment_status, trial_ends_at, current_period_start, current_period_end)
  values (p_shop_id, v_plan.id, p_status, p_payment_status,
          case when p_status = 'trialing' then now() + make_interval(days => greatest(v_plan.trial_days, 1)) end,
          now(), p_period_end)
  returning id into v_id;

  if p_request_id is not null then
    update public.plan_change_requests set status = 'done', resolved_at = now() where id = p_request_id and shop_id = p_shop_id;
  end if;
  perform public._audit(p_shop_id, 'update', 'subscriptions', v_id,
    jsonb_build_object('plan', p_plan_key, 'status', p_status, 'by', 'super_admin'));
  return v_id;
end;
$$;

create or replace function public.admin_reject_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._assert_super_admin();
  update public.plan_change_requests set status = 'rejected', resolved_at = now() where id = p_request_id;
end;
$$;

-- Marks overdue trials/periods as expired (the shop falls back to Free limits).
create or replace function public.admin_expire_subscriptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform public._assert_super_admin();
  with expired as (
    update public.subscriptions set status = 'expired'
     where status in ('trialing', 'active', 'past_due')
       and ((status = 'trialing' and trial_ends_at is not null and trial_ends_at < now())
         or (current_period_end is not null and current_period_end < now()))
    returning 1)
  select count(*) into v_n from expired;
  return v_n;
end;
$$;

-- Plan editing by the Super Admin (prices & limits). Uses the RLS policies of Phase 1;
-- this function adds validation and an audit entry.
create or replace function public.admin_update_plan(
  p_plan_id uuid, p_price_monthly numeric, p_price_yearly numeric, p_currency text, p_trial_days integer,
  p_max_products integer, p_max_employees integer, p_max_branches integer, p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._assert_super_admin();
  update public.subscription_plans set
    price_monthly = p_price_monthly, price_yearly = p_price_yearly, currency = upper(p_currency),
    trial_days = p_trial_days, max_products = p_max_products, max_employees = p_max_employees,
    max_branches = p_max_branches, is_active = p_is_active
  where id = p_plan_id;
  perform public._audit(null, 'update', 'subscription_plans', p_plan_id,
    jsonb_build_object('price_monthly', p_price_monthly, 'max_products', p_max_products));
end;
$$;

-- Super admins can read everything for support: audit logs etc. are already covered by policies.

-- -----------------------------------------------------------------------------
-- 6. Function privileges
-- -----------------------------------------------------------------------------
revoke all on function public.enforce_employee_limit() from public, anon, authenticated;
revoke all on function public.enforce_branch_limit() from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'my_permissions(uuid)',
    'set_role_permission(uuid, text, text, boolean)',
    'reset_role_permissions(uuid, text)',
    'invite_employee(uuid, text, text)',
    'revoke_invitation(uuid, uuid)',
    'accept_pending_invitations()',
    'set_member_role(uuid, uuid, text)',
    'set_member_status(uuid, uuid, text)',
    'remove_member(uuid, uuid)',
    'create_additional_shop(text, text, text, text, text)',
    'request_plan_change(uuid, text, text)',
    'admin_list_shops(text)',
    'admin_platform_stats()',
    'admin_set_shop_active(uuid, boolean)',
    'admin_change_plan(uuid, text, text, timestamptz, text, uuid)',
    'admin_reject_request(uuid)',
    'admin_expire_subscriptions()',
    'admin_update_plan(uuid, numeric, numeric, text, integer, integer, integer, integer, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
