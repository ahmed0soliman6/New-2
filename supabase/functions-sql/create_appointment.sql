-- Soli Medical: Atomic Create Appointment Transaction
-- Tables affected atomically: patients (optional upsert), appointments
-- Do NOT execute automatically; review and run in Supabase SQL Editor.

create or replace function public.create_appointment(
  p_clinic_id text,
  p_timestamp text,
  p_appointment_id text,
  p_appointment_data jsonb,
  p_patient_id text default null,
  p_patient_data jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing_patient jsonb;
  v_final_patient jsonb;
  v_final_appointment jsonb;
begin
  -- 1. Enforce multi-clinic membership guard
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  -- 2. If patient is provided: insert with ON CONFLICT DO NOTHING, or touch updatedAt preserving createdAt
  if p_patient_id is not null and p_patient_id <> '' and p_patient_data is not null then
    v_final_patient := p_patient_data || jsonb_build_object(
      'createdAt', coalesce(nullif(p_patient_data->>'createdAt', ''), p_timestamp),
      'updatedAt', p_timestamp
    );

    insert into public.patients (clinic_id, id, data)
    values (p_clinic_id, p_patient_id, v_final_patient)
    on conflict (clinic_id, id) do nothing;

    if not found then
      select data
        into v_existing_patient
        from public.patients
       where clinic_id = p_clinic_id
         and id = p_patient_id
       for update;

      if v_existing_patient is not null then
        update public.patients
           set data = v_existing_patient || jsonb_build_object(
             'createdAt', coalesce(nullif(v_existing_patient->>'createdAt', ''), p_timestamp),
             'updatedAt', p_timestamp
           ),
           updated_at = now()
         where clinic_id = p_clinic_id
           and id = p_patient_id;
      end if;
    end if;
  end if;

  -- 3. Upsert appointment document: add createdAt only on new insert, preserve old createdAt on update
  v_final_appointment := coalesce(p_appointment_data, '{}'::jsonb) || jsonb_build_object(
    'createdAt', coalesce(nullif(p_appointment_data->>'createdAt', ''), p_timestamp),
    'updatedAt', p_timestamp
  );

  insert into public.appointments (clinic_id, id, data)
  values (p_clinic_id, p_appointment_id, v_final_appointment)
  on conflict (clinic_id, id) do update
    set data = excluded.data || jsonb_build_object(
          'createdAt', coalesce(nullif(public.appointments.data->>'createdAt', ''), excluded.data->>'createdAt', p_timestamp),
          'updatedAt', p_timestamp
        ),
        updated_at = now();
end;
$$;

revoke execute on function public.create_appointment(
  text, text, text, jsonb, text, jsonb
) from public, anon;

grant execute on function public.create_appointment(
  text, text, text, jsonb, text, jsonb
) to authenticated;
