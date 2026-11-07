-- Soli Medical: Append-Only Security Audit Log RPC
-- Protects public.settings (id = '_audit_log') from direct client UPDATE or DELETE while allowing active clinic members to append audit events.

drop function if exists public.append_audit_log(text, jsonb) cascade;

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
  v_current_data jsonb;
  v_prev_entries jsonb;
  v_sanitized_entry jsonb;
  v_next_entries jsonb;
  v_now_iso text;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then
    raise exception 'Invalid input: p_entry must be a JSON object';
  end if;

  if coalesce(btrim(p_entry->>'action'), '') = '' then
    raise exception 'Invalid input: audit log action is required';
  end if;

  v_now_iso := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  v_sanitized_entry := p_entry || jsonb_build_object(
    'clinicId', p_clinic_id,
    'actorUid', coalesce(auth.uid()::text, p_entry->>'actorUid', 'unknown'),
    'recordedAt', v_now_iso
  );

  insert into public.settings (clinic_id, id, data)
  values (
    p_clinic_id,
    '_audit_log',
    jsonb_build_object('entries', '[]'::jsonb, 'updatedAt', v_now_iso)
  )
  on conflict (clinic_id, id) do nothing;

  select data
    into v_current_data
    from public.settings
   where clinic_id = p_clinic_id
     and id = '_audit_log'
   for update;

  if v_current_data is not null and jsonb_typeof(v_current_data->'entries') = 'array' then
    v_prev_entries := v_current_data->'entries';
  else
    v_prev_entries := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_next_entries
    from (
      select elem
        from jsonb_array_elements(jsonb_build_array(v_sanitized_entry) || v_prev_entries) with ordinality as t(elem, ord)
       where ord <= 250
       order by ord
    ) sub;

  update public.settings
     set data = jsonb_build_object(
       'entries', v_next_entries,
       'updatedAt', v_now_iso
     ),
     updated_at = now()
   where clinic_id = p_clinic_id
     and id = '_audit_log';

  return v_sanitized_entry;
end;
$$;

revoke execute on function public.append_audit_log(text, jsonb) from public, anon;
grant execute on function public.append_audit_log(text, jsonb) to authenticated;
