-- Soli Medical: Atomic Register Walk-In Transaction
-- Tables affected atomically: counters, patients, invoices, payments, visits
-- Do NOT execute automatically; review and run in Supabase SQL Editor.

create or replace function public.register_walk_in(
  p_clinic_id text,
  p_today text,
  p_timestamp text,
  p_requested_queue_number integer,
  p_patient_id text,
  p_patient_data jsonb,
  p_visit_id text,
  p_invoice_id text,
  p_payment_id text,
  p_receipt_number text,
  p_payment_amount numeric,
  p_payment_method text,
  p_received_by text,
  p_clinic_location_id text,
  p_appointment_id text,
  p_receptionist_data jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_counter_data jsonb;
  v_existing_patient jsonb;
  v_assigned_queue integer;
  v_visit_type text;
  v_merged_patient jsonb;
  v_invoice jsonb;
  v_payment jsonb;
  v_visit jsonb;
begin
  -- 1. Enforce multi-clinic membership guard
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  -- 2. Ensure daily queue counter row exists, then lock it with FOR UPDATE
  insert into public.counters (clinic_id, id, data)
  values (
    p_clinic_id,
    'queue_' || p_today,
    jsonb_build_object('lastNumber', 0, 'date', p_today)
  )
  on conflict (clinic_id, id) do nothing;

  select data
    into v_counter_data
    from public.counters
   where clinic_id = p_clinic_id
     and id = ('queue_' || p_today)
   for update;

  if p_requested_queue_number is not null and p_requested_queue_number > 0 then
    v_assigned_queue := p_requested_queue_number;
  else
    v_assigned_queue := coalesce((v_counter_data->>'lastNumber')::integer, 0) + 1;
  end if;

  -- 3. Update daily queue counter
  update public.counters
     set data = coalesce(v_counter_data, '{}'::jsonb) || jsonb_build_object(
       'lastNumber', v_assigned_queue,
       'date', p_today
     ),
     updated_at = now()
   where clinic_id = p_clinic_id
     and id = ('queue_' || p_today);

  -- 4. Upsert patient with merge semantics
  select data
    into v_existing_patient
    from public.patients
   where clinic_id = p_clinic_id
     and id = p_patient_id
   for update;

  v_merged_patient := coalesce(v_existing_patient, '{}'::jsonb)
    || coalesce(p_patient_data, '{}'::jsonb)
    || jsonb_build_object('updatedAt', p_timestamp);

  insert into public.patients (clinic_id, id, data)
  values (p_clinic_id, p_patient_id, v_merged_patient)
  on conflict (clinic_id, id) do update
    set data = excluded.data,
        updated_at = now();

  -- 5. Build and insert invoice
  v_invoice := jsonb_build_object(
    'invoiceId', p_invoice_id,
    'patientId', p_patient_id,
    'visitId', p_visit_id,
    'clinicLocationId', nullif(p_clinic_location_id, ''),
    'items', '[]'::jsonb,
    'subtotal', p_payment_amount,
    'discount', 0,
    'total', p_payment_amount,
    'paidAmount', p_payment_amount,
    'remainingAmount', 0,
    'status', 'PAID',
    'createdAt', p_timestamp,
    'updatedAt', p_timestamp,
    'dayKey', p_today
  );

  insert into public.invoices (clinic_id, id, data)
  values (p_clinic_id, p_invoice_id, v_invoice)
  on conflict (clinic_id, id) do update
    set data = excluded.data,
        updated_at = now();

  -- 6. Build and insert payment
  v_payment := jsonb_build_object(
    'paymentId', p_payment_id,
    'patientId', p_patient_id,
    'visitId', p_visit_id,
    'invoiceId', p_invoice_id,
    'clinicLocationId', nullif(p_clinic_location_id, ''),
    'amount', p_payment_amount,
    'method', p_payment_method,
    'status', 'PAID',
    'receiptNumber', p_receipt_number,
    'paidAt', p_timestamp,
    'receivedBy', p_received_by,
    'dayKey', p_today
  );

  insert into public.payments (clinic_id, id, data)
  values (p_clinic_id, p_payment_id, v_payment)
  on conflict (clinic_id, id) do update
    set data = excluded.data,
        updated_at = now();

  -- 7. Build and insert visit
  v_visit_type := case when p_payment_amount = 0 then 'FOLLOW_UP' else 'NEW' end;

  v_visit := jsonb_build_object(
    'visitId', p_visit_id,
    'patientId', p_patient_id,
    'appointmentId', case when p_appointment_id is null or p_appointment_id = '' then null else p_appointment_id end,
    'clinicLocationId', nullif(p_clinic_location_id, ''),
    'visitType', v_visit_type,
    'source', 'WALK_IN',
    'status', 'WAITING',
    'queueNumber', v_assigned_queue,
    'receptionistData', coalesce(p_receptionist_data, jsonb_build_object('symptoms', '', 'chronicDiseases', '[]'::jsonb, 'notes', '')),
    'clinicalData', jsonb_build_object(
      'chiefComplaint', '',
      'history', '',
      'examination', '',
      'diagnosis', '[]'::jsonb,
      'treatment', ''
    ),
    'vitalSigns', jsonb_build_object(
      'bloodPressure', '',
      'pulse', null,
      'temperature', null,
      'weight', null,
      'height', null,
      'oxygenSaturation', null,
      'randomBloodSugar', null
    ),
    'startedAt', null,
    'completedAt', null,
    'createdAt', p_timestamp,
    'updatedAt', p_timestamp,
    'createdBy', p_received_by,
    'doctorId', '',
    'dayKey', p_today
  );

  insert into public.visits (clinic_id, id, data)
  values (p_clinic_id, p_visit_id, v_visit)
  on conflict (clinic_id, id) do update
    set data = excluded.data,
        updated_at = now();

  return v_visit;
end;
$$;

revoke execute on function public.register_walk_in(
  text, text, text, integer, text, jsonb, text, text, text, text, numeric, text, text, text, text, jsonb
) from public, anon;

grant execute on function public.register_walk_in(
  text, text, text, integer, text, jsonb, text, text, text, text, numeric, text, text, text, text, jsonb
) to authenticated;
