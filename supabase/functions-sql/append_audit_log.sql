-- Soli Medical: Immutable Audit Events Table & Append-Only Security Definer RPC
-- Protects audit logs in public.audit_events from eviction, forgery, oversized payloads (>8KB),
-- flooding (>60 entries/minute per user), and any UPDATE/DELETE mutation.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id text not null references public.clinics(id) on delete cascade,
  actor_uid uuid not null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists audit_events_clinic_created_idx
  on public.audit_events (clinic_id, created_at desc);

create index if not exists audit_events_rate_limit_idx
  on public.audit_events (clinic_id, actor_uid, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select" on public.audit_events;
drop policy if exists "audit_events_insert" on public.audit_events;
drop policy if exists "audit_events_update" on public.audit_events;
drop policy if exists "audit_events_delete" on public.audit_events;

-- SELECT only for members with audit.view or users.manage permission; NO INSERT, UPDATE, or DELETE policies
create policy "audit_events_select" on public.audit_events for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'audit.view', 'view')
      or public.has_clinic_permission(clinic_id, 'users.manage', 'view')
      or public.has_clinic_permission(clinic_id, 'users.manage', 'update')
    )
  );

revoke insert, update, delete on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;

-- Immutability Trigger: prevents UPDATE and DELETE even from SECURITY DEFINER functions or admins
create or replace function public.prevent_audit_events_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Security violation: audit_events table is append-only (UPDATE and DELETE are strictly prohibited)';
end;
$$;

drop trigger if exists trg_audit_events_immutable on public.audit_events;
create trigger trg_audit_events_immutable
  before update or delete on public.audit_events
  for each row
  execute function public.prevent_audit_events_mutation();

drop function if exists public.append_audit_log(text, jsonb) cascade;
drop function if exists public.append_audit_log(text, text, text, text, jsonb) cascade;

create or replace function public.append_audit_log(
  p_clinic_id text,
  p_entry jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uid uuid;
  v_action text;
  v_entity_type text;
  v_entity_id text;
  v_raw_details jsonb;
  v_details jsonb := '{}'::jsonb;
  v_now timestamptz;
  v_recent_count integer;
  v_inserted_id uuid;
  v_key text;
  v_val jsonb;
  v_allowed_actions constant text[] := array[
    'patient.create',
    'patient.update',
    'patient.delete',
    'visit.create',
    'visit.complete',
    'visit.delete',
    'appointment.create',
    'appointment.update',
    'appointment.delete',
    'appointment.checkin',
    'invoice.create',
    'invoice.update',
    'invoice.delete',
    'payment.create',
    'payment.update',
    'payment.delete',
    'expense.create',
    'expense.update',
    'expense.delete',
    'user.create',
    'user.update',
    'user.delete',
    'user.permissions.update',
    'user.password.reset',
    'UPDATE_USER_PERMISSIONS',
    'settings.update',
    'backup.export',
    'backup.restore',
    'backup.restore.rollback',
    'system.clear_all_data',
    'system.clear_all_data.failed',
    'data.purge',
    'demo.generate_data'
  ];
  v_known_detail_keys constant text[] := array[
    'summary',
    'status',
    'permissionUsed',
    'affectedTables',
    'recordCounts',
    'metadata',
    'changedFields',
    'mode',
    'patientId',
    'totalDeleted',
    'deletedCounts',
    'olderThan',
    'scope',
    'succeededTables',
    'failedTables',
    'preservedTables',
    'restoredCounts',
    'totalRestored',
    'backupExportedAt',
    'backupAppVersion',
    'patientsCount',
    'visitsCount',
    'error',
    'touchedTables',
    'rev',
    'note',
    'message',
    'reason',
    'field',
    'oldValue',
    'newValue',
    'count'
  ];
begin
  -- 1. Verify active clinic membership & authenticated caller
  v_actor_uid := auth.uid();
  if v_actor_uid is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then
    raise exception 'Invalid input: p_entry must be a JSON object';
  end if;

  -- 2. Enforce 8KB (8192 bytes) payload limit
  if octet_length(p_entry::text) > 8192 then
    raise exception 'Payload too large: audit log entry exceeds maximum allowed size of 8KB (8192 bytes)';
  end if;

  -- 3. Validate action against strict whitelist
  v_action := btrim(coalesce(p_entry->>'action', ''));
  if v_action = '' or not (v_action = any(v_allowed_actions)) then
    raise exception 'Invalid audit action: "%" is not in the allowed actions whitelist', v_action;
  end if;

  -- 4. Extract entity_type and entity_id from known keys only
  v_entity_type := left(nullif(btrim(coalesce(p_entry->>'entity_type', p_entry->>'entityType', p_entry->>'targetType', '')), ''), 120);
  v_entity_id := left(nullif(btrim(coalesce(p_entry->>'entity_id', p_entry->>'entityId', p_entry->>'targetId', '')), ''), 255);

  -- 5. Build sanitized details JSONB (ignoring any unknown or forged fields such as actorName / actor_uid)
  if p_entry ? 'details' then
    if jsonb_typeof(p_entry->'details') = 'object' then
      v_raw_details := p_entry->'details';
      for v_key, v_val in select * from jsonb_each(v_raw_details) loop
        if v_key = any(v_known_detail_keys) then
          v_details := v_details || jsonb_build_object(v_key, v_val);
        end if;
      end loop;
    elsif jsonb_typeof(p_entry->'details') = 'string' then
      v_details := v_details || jsonb_build_object('message', p_entry->'details');
    end if;
  end if;

  for v_key in select unnest(v_known_detail_keys) loop
    if p_entry ? v_key and not (v_details ? v_key) then
      if v_key = 'metadata' and jsonb_typeof(p_entry->'metadata') = 'object' then
        v_details := v_details || jsonb_build_object(
          'metadata',
          (p_entry->'metadata') - 'actorName' - 'actorUid' - 'actor_uid' - 'actorUsername' - 'actorRole' - 'clinicId' - 'clinic_id'
        );
      elsif v_key <> 'metadata' then
        v_details := v_details || jsonb_build_object(v_key, p_entry->v_key);
      end if;
    end if;
  end loop;

  if octet_length(v_details::text) > 8192 then
    raise exception 'Payload too large: audit log details exceed maximum allowed size of 8KB (8192 bytes)';
  end if;

  -- 6. Rate limiting: max 60 entries per minute per (clinic_id, actor_uid)
  v_now := clock_timestamp() + (
    coalesce(nullif(current_setting('soli.audit_clock_offset_minutes', true), '')::integer, 0) * interval '1 minute'
  );

  select count(*)::integer
    into v_recent_count
    from public.audit_events
   where clinic_id = p_clinic_id
     and actor_uid = v_actor_uid
     and created_at >= (v_now - interval '1 minute')
     and created_at <= (v_now + interval '1 second');

  if v_recent_count >= 60 then
    raise exception 'Rate limit exceeded: maximum 60 audit log entries per minute allowed per user in clinic %', p_clinic_id;
  end if;

  -- 7. Insert single immutable row into public.audit_events
  insert into public.audit_events (
    clinic_id,
    actor_uid,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  )
  values (
    p_clinic_id,
    v_actor_uid,
    v_action,
    v_entity_type,
    v_entity_id,
    v_details,
    v_now
  )
  returning id into v_inserted_id;

  return jsonb_build_object(
    'id', v_inserted_id,
    'clinic_id', p_clinic_id,
    'actor_uid', v_actor_uid,
    'action', v_action,
    'entity_type', v_entity_type,
    'entity_id', v_entity_id,
    'details', v_details,
    'created_at', v_now
  );
end;
$$;

create or replace function public.append_audit_log(
  p_clinic_id text,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.append_audit_log(
    p_clinic_id,
    jsonb_build_object(
      'action', p_action,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'details', coalesce(p_details, '{}'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.append_audit_log(text, jsonb) from public, anon;
grant execute on function public.append_audit_log(text, jsonb) to authenticated;

revoke execute on function public.append_audit_log(text, text, text, text, jsonb) from public, anon;
grant execute on function public.append_audit_log(text, text, text, text, jsonb) to authenticated;
