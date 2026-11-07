-- Soli Medical: Database Storage & Clinic Table Usage RPC
-- Returns database size, clinic-specific bytes across all 22 tables + audit_events,
-- quota limit (from settings or default 500MB), percentage used, and per-table row counts & byte sizes.

drop function if exists public.get_database_usage(text) cascade;

create or replace function public.get_database_usage(
  p_clinic_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used_bytes bigint := 0;
  v_clinic_bytes bigint := 0;
  v_limit_bytes bigint := 524288000; -- Default 500 MB (500 * 1024 * 1024)
  v_custom_limit text;
  v_percent_used numeric := 0;
  v_row_counts jsonb := '{}'::jsonb;
  v_table_bytes jsonb := '{}'::jsonb;
  v_tables jsonb := '[]'::jsonb;
  v_tbl text;
  v_row_cnt bigint;
  v_tbl_bytes bigint;
  v_all_tables constant text[] := array[
    'patients',
    'appointments',
    'visits',
    'invoices',
    'payments',
    'transactions',
    'prescriptions',
    'lab_orders',
    'radiology_orders',
    'follow_ups',
    'medications',
    'lab_tests',
    'radiology_types',
    'diagnoses',
    'symptoms',
    'chronic_diseases',
    'services',
    'expenses',
    'expense_categories',
    'settings',
    'backups',
    'counters',
    'audit_events'
  ];
begin
  -- 1. Verify active clinic membership
  if auth.uid() is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  -- 2. Verify users.manage or settings.view permission
  if not (
    public.has_clinic_permission(p_clinic_id, 'users.manage', 'view')
    or public.has_clinic_permission(p_clinic_id, 'users.manage', 'update')
    or public.has_clinic_permission(p_clinic_id, 'settings.view', 'view')
  ) then
    raise exception 'Unauthorized: caller lacks users.manage or settings.view permission in clinic %', p_clinic_id;
  end if;

  -- 3. Total PostgreSQL database size
  select pg_database_size(current_database())::bigint into v_used_bytes;

  -- 4. Optional custom limit from clinic settings (id = 'database_quota' or 'general')
  select coalesce(
    data->>'limit_bytes',
    data->>'databaseLimitBytes'
  )
    into v_custom_limit
    from public.settings
   where clinic_id = p_clinic_id
     and id in ('database_quota', 'general')
     and (data ? 'limit_bytes' or data ? 'databaseLimitBytes')
   order by case when id = 'database_quota' then 0 else 1 end
   limit 1;

  if v_custom_limit is not null and v_custom_limit ~ '^[0-9]+$' then
    v_limit_bytes := greatest(v_custom_limit::bigint, 1048576);
  end if;

  -- 5. Compute clinic_bytes and row count per table for the 22 tables + audit_events
  foreach v_tbl in array v_all_tables loop
    execute format(
      'select count(*)::bigint, coalesce(sum(pg_column_size(t.*)), 0)::bigint from public.%I t where t.clinic_id = $1',
      v_tbl
    )
    into v_row_cnt, v_tbl_bytes
    using p_clinic_id;

    v_clinic_bytes := v_clinic_bytes + coalesce(v_tbl_bytes, 0);
    v_row_counts := v_row_counts || jsonb_build_object(v_tbl, coalesce(v_row_cnt, 0));
    v_table_bytes := v_table_bytes || jsonb_build_object(v_tbl, coalesce(v_tbl_bytes, 0));
    v_tables := v_tables || jsonb_build_array(
      jsonb_build_object(
        'table_name', v_tbl,
        'row_count', coalesce(v_row_cnt, 0),
        'bytes', coalesce(v_tbl_bytes, 0)
      )
    );
  end loop;

  -- Sort tables array descending by bytes then row_count
  select coalesce(
    jsonb_agg(elem order by (elem->>'bytes')::bigint desc, (elem->>'row_count')::bigint desc, elem->>'table_name' asc),
    '[]'::jsonb
  )
    into v_tables
    from jsonb_array_elements(v_tables) as elem;

  v_percent_used := round((v_used_bytes::numeric / v_limit_bytes::numeric) * 100.0, 2);

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'used_bytes', v_used_bytes,
    'clinic_bytes', v_clinic_bytes,
    'limit_bytes', v_limit_bytes,
    'remaining_bytes', greatest(v_limit_bytes - v_used_bytes, 0),
    'percent_used', v_percent_used,
    'row_counts', v_row_counts,
    'table_bytes', v_table_bytes,
    'tables', v_tables
  );
end;
$$;

revoke execute on function public.get_database_usage(text) from public, anon;
grant execute on function public.get_database_usage(text) to authenticated;
