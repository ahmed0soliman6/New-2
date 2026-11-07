-- Soli Medical: Atomic Delete Patient Transaction
-- Tables affected atomically: patients, visits, appointments, prescriptions, lab_orders, radiology_orders, follow_ups, and optionally invoices & payments
-- Do NOT execute automatically on production; review and run in Supabase SQL Editor.

drop function if exists public.delete_patient(text, text, text) cascade;
drop function if exists public.delete_patient(text, text) cascade;

create or replace function public.delete_patient(
  p_clinic_id text,
  p_patient_id text,
  p_mode text default 'file_only'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pat jsonb;
  v_patient_name text;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'patient-records', 'delete')
  ) then
    raise exception 'Unauthorized: caller lacks patients.delete permission';
  end if;

  if p_mode = 'everything' and not (
    public.has_clinic_permission(p_clinic_id, 'billing.delete', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'billing-payments', 'delete')
  ) then
    raise exception 'Unauthorized: caller lacks billing.delete permission required for full deletion';
  end if;

  if p_patient_id is null or btrim(p_patient_id) = '' then
    raise exception 'Invalid input: p_patient_id is required';
  end if;

  select data
    into v_pat
    from public.patients
   where clinic_id = p_clinic_id
     and id = p_patient_id
   for update;

  v_patient_name := coalesce(v_pat->>'fullName', v_pat->>'name', '');

  delete from public.prescriptions where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  delete from public.lab_orders where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  delete from public.radiology_orders where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  delete from public.follow_ups where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  delete from public.appointments where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  delete from public.visits where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;

  if p_mode = 'everything' then
    delete from public.payments where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
    delete from public.invoices where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  else
    -- Preserve financial records with archived patient name
    update public.invoices
       set data = data || jsonb_build_object(
         'patientId', 'pat-general',
         'patientName', coalesce(nullif(data->>'patientName', ''), v_patient_name)
       ),
       updated_at = now()
     where clinic_id = p_clinic_id
       and data->>'patientId' = p_patient_id;

    update public.payments
       set data = data || jsonb_build_object(
         'patientId', 'pat-general',
         'patientName', coalesce(nullif(data->>'patientName', ''), v_patient_name)
       ),
       updated_at = now()
     where clinic_id = p_clinic_id
       and data->>'patientId' = p_patient_id;
  end if;

  delete from public.patients where clinic_id = p_clinic_id and id = p_patient_id;
end;
$$;

revoke execute on function public.delete_patient(text, text, text) from public, anon;
grant execute on function public.delete_patient(text, text, text) to authenticated;
