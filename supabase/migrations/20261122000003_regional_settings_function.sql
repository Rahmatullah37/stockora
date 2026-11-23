-- =============================================================================
-- Stockora — Migration 3: atomic "regional & tax settings" update
-- =============================================================================
-- Country and currency live in `shops`; time zone, date format, language and tax
-- live in `shop_settings`. This function updates BOTH in one transaction, so a
-- half-saved state is impossible.
--
-- It is SECURITY INVOKER (the default): it runs with the caller's own rights,
-- so Row Level Security and column privileges still decide who may change what.
-- =============================================================================
create or replace function public.update_shop_regional_settings(
  p_shop_id     uuid,
  p_country     text,
  p_currency    text,
  p_timezone    text,
  p_date_format text,
  p_language    text,
  p_tax_enabled boolean,
  p_tax_name    text,
  p_tax_rate    numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
begin
  update public.shops
     set country = upper(p_country), currency = upper(p_currency)
   where id = p_shop_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  update public.shop_settings
     set timezone = p_timezone,
         date_format = p_date_format,
         language = p_language,
         tax_enabled = p_tax_enabled,
         tax_name = btrim(p_tax_name),
         tax_rate = p_tax_rate
   where shop_id = p_shop_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.update_shop_regional_settings(uuid, text, text, text, text, text, boolean, text, numeric)
  from public, anon;
grant execute on function public.update_shop_regional_settings(uuid, text, text, text, text, text, boolean, text, numeric)
  to authenticated;
