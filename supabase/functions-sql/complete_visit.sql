-- Soli Medical: Atomic Complete Visit Transaction
-- Tables affected atomically: visits, patients, prescriptions, lab_orders, radiology_orders, follow_ups
-- Do NOT execute automatically; review and run in Supabase SQL Editor.

create or replace function public.complete_visit(
  p_clinic_id text,
  p_visit_id text,
  p_doctor_id text,
  p_timestamp text,
  p_clinical_data jsonb,
  p_vital_signs jsonb,
  p_prescription jsonb default null,
  p_lab_orders jsonb default '[]'::jsonb,
  p_radiology_orders jsonb default '[]'::jsonb,
  p_follow_up jsonb default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_visit_data jsonb;
  v_patient_id text;
  v_patient_data jsonb;
  v_already_completed boolean;
  v_prev_visits_count integer;
  v_next_visits_count integer;
  v_first_diagnosis text;
  v_item jsonb;
begin
  -- 1. Enforce multi-clinic membership guard
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  -- 2. Lock and read visit row (if it does not exist, exit gracefully like Firestore workflow)
  select data
    into v_visit_data
    from public.visits
   where clinic_id = p_clinic_id
     and id = p_visit_id
   for update;

  if v_visit_data is null then
    return;
  end if;

  v_patient_id := v_visit_data->>'patientId';
  v_already_completed := (coalesce(v_visit_data->>'status', '') = 'COMPLETED');

  -- 3. Lock and read patient row before writes
  if v_patient_id is not null and v_patient_id <> '' then
    select data
      into v_patient_data
      from public.patients
     where clinic_id = p_clinic_id
       and id = v_patient_id
     for update;
  end if;

  -- 4. Update visit to COMPLETED
  update public.visits
     set data = v_visit_data || jsonb_build_object(
       'status', 'COMPLETED',
       'doctorId', p_doctor_id,
       'clinicalData', p_clinical_data,
       'vitalSigns', p_vital_signs,
       'completedAt', p_timestamp,
       'updatedAt', p_timestamp
     ),
     updated_at = now()
   where clinic_id = p_clinic_id
     and id = p_visit_id;

  -- 5. Update patient clinical aggregate fields if patient exists
  if v_patient_data is not null then
    v_prev_visits_count := coalesce((v_patient_data->>'visitsCount')::integer, 0);
    if v_already_completed then
      v_next_visits_count := case when v_prev_visits_count > 0 then v_prev_visits_count else 1 end;
    else
      v_next_visits_count := v_prev_visits_count + 1;
    end if;

    v_first_diagnosis := coalesce(p_clinical_data->'diagnosis'->>0, '');

    update public.patients
       set data = v_patient_data || jsonb_build_object(
         'hasClinicalFile', true,
         'visitsCount', v_next_visits_count,
         'lastVisitAt', p_timestamp,
         'lastDiagnosis', v_first_diagnosis,
         'updatedAt', p_timestamp
       ),
       updated_at = now()
     where clinic_id = p_clinic_id
       and id = v_patient_id;
  end if;

  -- 6. Insert prescription if provided
  if p_prescription is not null and (p_prescription->>'prescriptionId') is not null then
    insert into public.prescriptions (clinic_id, id, data)
    values (
      p_clinic_id,
      p_prescription->>'prescriptionId',
      p_prescription
    )
    on conflict (clinic_id, id) do update
      set data = excluded.data,
          updated_at = now();
  end if;

  -- 7. Insert lab orders if provided
  if p_lab_orders is not null and jsonb_typeof(p_lab_orders) = 'array' then
    for v_item in select * from jsonb_array_elements(p_lab_orders)
    loop
      if (v_item->>'labOrderId') is not null then
        insert into public.lab_orders (clinic_id, id, data)
        values (
          p_clinic_id,
          v_item->>'labOrderId',
          v_item
        )
        on conflict (clinic_id, id) do update
          set data = excluded.data,
              updated_at = now();
      end if;
    end loop;
  end if;

  -- 8. Insert radiology orders if provided
  if p_radiology_orders is not null and jsonb_typeof(p_radiology_orders) = 'array' then
    for v_item in select * from jsonb_array_elements(p_radiology_orders)
    loop
      if (v_item->>'radiologyOrderId') is not null then
        insert into public.radiology_orders (clinic_id, id, data)
        values (
          p_clinic_id,
          v_item->>'radiologyOrderId',
          v_item
        )
        on conflict (clinic_id, id) do update
          set data = excluded.data,
              updated_at = now();
      end if;
    end loop;
  end if;

  -- 9. Insert follow-up if provided
  if p_follow_up is not null and (p_follow_up->>'followUpId') is not null then
    insert into public.follow_ups (clinic_id, id, data)
    values (
      p_clinic_id,
      p_follow_up->>'followUpId',
      p_follow_up
    )
    on conflict (clinic_id, id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke execute on function public.complete_visit(
  text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon;

grant execute on function public.complete_visit(
  text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;
