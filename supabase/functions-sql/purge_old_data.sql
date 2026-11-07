-- Soli Medical: Old Data Purge Preview & Execution RPCs
-- Enforces data.purge permission, >= 90 days cutoff, >= 5 years cutoff for invoices/payments,
-- protects patients/settings/users/catalogs/audit_events, and logs data.purge in audit_events.

drop function if exists public.extract_record_timestamp(jsonb, timestamptz) cascade;
drop function if exists public.preview_purge(text, timestamptz, text[]) cascade;
drop function if exists public.purge_old_data(text, timestamptz, text[], text) cascade;

create or replace function public.extract_record_timestamp(
  p_data jsonb,
  p_fallback timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  v_raw text;
  v_parsed timestamptz;
begin
  if p_data is not null and jsonb_typeof(p_data) = 'object' then
    v_raw := nullif(btrim(coalesce(
      p_data->>'completedAt',
      p_data->>'updatedAt',
      p_data->>'createdAt',
      p_data->>'dueDate',
      p_data->>'date',
      p_data->>'timestamp',
      ''
    )), '');
    if v_raw is not null then
      begin
        v_parsed := v_raw::timestamptz;
      exception when others then
        v_parsed := null;
      end;
    end if;
  end if;

  if v_parsed is not null and p_fallback is not null then
    return least(v_parsed, p_fallback);
  end if;

  return coalesce(v_parsed, p_fallback, now());
end;
$$;

create or replace function public.preview_purge(
  p_clinic_id text,
  p_older_than timestamptz,
  p_scope text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
  v_norm text;
  v_cnt bigint;
  v_total bigint := 0;
  v_counts jsonb := '{}'::jsonb;
  v_do_visits boolean := false;
  v_do_appointments boolean := false;
  v_do_lab boolean := false;
  v_do_radiology boolean := false;
  v_do_follow_ups boolean := false;
  v_do_backups boolean := false;
  v_do_invoices boolean := false;
  v_do_payments boolean := false;
begin
  -- 1. Verify active clinic membership & data.purge permission
  if auth.uid() is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not public.has_clinic_permission(p_clinic_id, 'data.purge', 'delete') then
    raise exception 'Unauthorized: caller lacks data.purge permission in clinic %', p_clinic_id;
  end if;

  -- 2. Reject p_older_than newer than 90 days
  if p_older_than is null or p_older_than > (clock_timestamp() - interval '90 days') then
    raise exception 'Invalid cutoff date: p_older_than must be older than 90 days';
  end if;

  -- 3. Validate p_scope against allowed scopes
  if p_scope is null or coalesce(array_length(p_scope, 1), 0) = 0 then
    raise exception 'Invalid input: p_scope cannot be empty';
  end if;

  foreach v_item in array p_scope loop
    v_norm := lower(btrim(coalesce(v_item, '')));
    case v_norm
      when 'visits', 'completed_visits' then
        v_do_visits := true;
      when 'appointments', 'finished_appointments' then
        v_do_appointments := true;
      when 'lab_orders', 'finished_lab_orders' then
        v_do_lab := true;
      when 'radiology_orders', 'finished_radiology_orders' then
        v_do_radiology := true;
      when 'lab_radiology_orders' then
        v_do_lab := true;
        v_do_radiology := true;
      when 'follow_ups', 'finished_follow_ups' then
        v_do_follow_ups := true;
      when 'backups', 'old_backups' then
        v_do_backups := true;
      when 'invoices' then
        v_do_invoices := true;
      when 'payments' then
        v_do_payments := true;
      when 'invoices_payments' then
        v_do_invoices := true;
        v_do_payments := true;
      else
        raise exception 'Forbidden or invalid purge scope "%": patients, settings, users, medical catalogs, and audit_events cannot be purged', v_item;
    end case;
  end loop;

  -- 4. Enforce minimum 5 years retention for invoices and payments
  if (v_do_invoices or v_do_payments) and p_older_than > (clock_timestamp() - interval '5 years') then
    raise exception 'Financial retention policy: invoices and payments younger than 5 years cannot be purged';
  end if;

  -- 5. Compute preview counts per table for p_clinic_id only
  if v_do_visits then
    select count(*)::bigint into v_cnt
      from public.visits
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'ARCHIVED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('visits', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_appointments then
    select count(*)::bigint into v_cnt
      from public.appointments
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'CANCELLED', 'NO_SHOW', 'DONE', 'FINISHED', 'CHECKED_IN', 'EXPIRED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('appointments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_lab then
    select count(*)::bigint into v_cnt
      from public.lab_orders
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('lab_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_radiology then
    select count(*)::bigint into v_cnt
      from public.radiology_orders
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('radiology_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_follow_ups then
    select count(*)::bigint into v_cnt
      from public.follow_ups
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'EXPIRED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('follow_ups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_backups then
    select count(*)::bigint into v_cnt
      from public.backups
     where clinic_id = p_clinic_id
       and public.extract_record_timestamp(data, created_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('backups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_invoices then
    select count(*)::bigint into v_cnt
      from public.invoices
     where clinic_id = p_clinic_id
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('invoices', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_payments then
    select count(*)::bigint into v_cnt
      from public.payments
     where clinic_id = p_clinic_id
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('payments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'older_than', p_older_than,
    'counts', v_counts,
    'total_count', v_total
  );
end;
$$;

create or replace function public.purge_old_data(
  p_clinic_id text,
  p_older_than timestamptz,
  p_scope text[],
  p_confirm text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
  v_norm text;
  v_cnt bigint;
  v_total bigint := 0;
  v_counts jsonb := '{}'::jsonb;
  v_do_visits boolean := false;
  v_do_appointments boolean := false;
  v_do_lab boolean := false;
  v_do_radiology boolean := false;
  v_do_follow_ups boolean := false;
  v_do_backups boolean := false;
  v_do_invoices boolean := false;
  v_do_payments boolean := false;
begin
  -- 1. Verify active clinic membership & data.purge permission
  if auth.uid() is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not public.has_clinic_permission(p_clinic_id, 'data.purge', 'delete') then
    raise exception 'Unauthorized: caller lacks data.purge permission in clinic %', p_clinic_id;
  end if;

  -- 2. Verify exact Arabic confirmation phrase
  if btrim(coalesce(p_confirm, '')) <> 'احذف البيانات القديمة' then
    raise exception 'Invalid confirmation phrase: p_confirm must match "احذف البيانات القديمة"';
  end if;

  -- 3. Reject p_older_than newer than 90 days
  if p_older_than is null or p_older_than > (clock_timestamp() - interval '90 days') then
    raise exception 'Invalid cutoff date: p_older_than must be older than 90 days';
  end if;

  -- 4. Validate p_scope against allowed scopes
  if p_scope is null or coalesce(array_length(p_scope, 1), 0) = 0 then
    raise exception 'Invalid input: p_scope cannot be empty';
  end if;

  foreach v_item in array p_scope loop
    v_norm := lower(btrim(coalesce(v_item, '')));
    case v_norm
      when 'visits', 'completed_visits' then
        v_do_visits := true;
      when 'appointments', 'finished_appointments' then
        v_do_appointments := true;
      when 'lab_orders', 'finished_lab_orders' then
        v_do_lab := true;
      when 'radiology_orders', 'finished_radiology_orders' then
        v_do_radiology := true;
      when 'lab_radiology_orders' then
        v_do_lab := true;
        v_do_radiology := true;
      when 'follow_ups', 'finished_follow_ups' then
        v_do_follow_ups := true;
      when 'backups', 'old_backups' then
        v_do_backups := true;
      when 'invoices' then
        v_do_invoices := true;
      when 'payments' then
        v_do_payments := true;
      when 'invoices_payments' then
        v_do_invoices := true;
        v_do_payments := true;
      else
        raise exception 'Forbidden or invalid purge scope "%": patients, settings, users, medical catalogs, and audit_events cannot be purged', v_item;
    end case;
  end loop;

  -- 5. Enforce minimum 5 years retention for invoices and payments
  if (v_do_invoices or v_do_payments) and p_older_than > (clock_timestamp() - interval '5 years') then
    raise exception 'Financial retention policy: invoices and payments younger than 5 years cannot be purged';
  end if;

  -- 6. Execute deletions strictly scoped to p_clinic_id
  if v_do_visits then
    with deleted as (
      delete from public.visits
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'ARCHIVED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('visits', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_appointments then
    with deleted as (
      delete from public.appointments
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'CANCELLED', 'NO_SHOW', 'DONE', 'FINISHED', 'CHECKED_IN', 'EXPIRED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('appointments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_lab then
    with deleted as (
      delete from public.lab_orders
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('lab_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_radiology then
    with deleted as (
      delete from public.radiology_orders
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('radiology_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_follow_ups then
    with deleted as (
      delete from public.follow_ups
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'EXPIRED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('follow_ups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_backups then
    with deleted as (
      delete from public.backups
       where clinic_id = p_clinic_id
         and public.extract_record_timestamp(data, created_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('backups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_invoices then
    with deleted as (
      delete from public.invoices
       where clinic_id = p_clinic_id
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('invoices', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_payments then
    with deleted as (
      delete from public.payments
       where clinic_id = p_clinic_id
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('payments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  -- 7. Record data.purge event in public.audit_events
  perform public.append_audit_log(
    p_clinic_id,
    jsonb_build_object(
      'action', 'data.purge',
      'entity_type', 'clinic_data',
      'entity_id', p_clinic_id,
      'details', jsonb_build_object(
        'summary', format('حذف البيانات القديمة الأقدم من %s (إجمالي %s سجل)', to_char(p_older_than at time zone 'UTC', 'YYYY-MM-DD'), v_total),
        'status', 'SUCCESS',
        'permissionUsed', 'data.purge',
        'olderThan', to_char(p_older_than at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'scope', to_jsonb(p_scope),
        'deletedCounts', v_counts,
        'recordCounts', v_counts,
        'totalDeleted', v_total
      )
    )
  );

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'older_than', p_older_than,
    'deleted_counts', v_counts,
    'total_deleted', v_total
  );
end;
$$;

revoke execute on function public.preview_purge(text, timestamptz, text[]) from public, anon;
grant execute on function public.preview_purge(text, timestamptz, text[]) to authenticated;

revoke execute on function public.purge_old_data(text, timestamptz, text[], text) from public, anon;
grant execute on function public.purge_old_data(text, timestamptz, text[], text) to authenticated;
