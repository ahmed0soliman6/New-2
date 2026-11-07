-- Soli Medical: Atomic Check-In Appointment Transaction
-- Tables affected atomically: appointments, counters, invoices, payments, visits
-- Do NOT execute automatically on production; review and run in Supabase SQL Editor.

drop function if exists public.check_in_appointment(text, text, text, text, integer, text, text, text, text, numeric, text, text, jsonb) cascade;

create or replace function public.check_in_appointment(
  p_clinic_id text,
  p_appointment_id text,
  p_today text,
  p_timestamp text,
  p_requested_queue_number integer,
  p_visit_id text,
  p_invoice_id text,
  p_payment_id text,
  p_receipt_number text,
  p_payment_amount numeric,
  p_payment_method text,
  p_received_by text,
  p_receptionist_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment jsonb;
  v_counter_data jsonb;
  v_assigned_queue integer;
  v_patient_id text;
  v_clinic_location_id text;
  v_visit_type text;
  v_updated_appointment jsonb;
  v_visit jsonb;
  v_invoice jsonb;
  v_payment jsonb;
begin
  -- 1. Enforce multi-clinic membership and custom permission guard
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'appointments.checkin', 'update')
    or public.has_clinic_permission(p_clinic_id, 'waiting-queue', 'create')
  ) then
    raise exception 'Unauthorized: missing permission appointments.checkin / waiting-queue.create';
  end if;

  -- 2. Input validation
  if p_appointment_id is null or btrim(p_appointment_id) = '' then
    raise exception 'Invalid input: p_appointment_id is required';
  end if;
  if p_visit_id is null or btrim(p_visit_id) = '' then
    raise exception 'Invalid input: p_visit_id is required';
  end if;
  if p_payment_amount is null or p_payment_amount < 0 then
    raise exception 'Invalid input: p_payment_amount cannot be negative';
  end if;

  -- 3. Lock and read the appointment row
  select data
    into v_appointment
    from public.appointments
   where clinic_id = p_clinic_id
     and id = p_appointment_id
   for update;

  if v_appointment is null then
    raise exception 'Appointment not found';
  end if;

  if coalesce(v_appointment->>'status', '') <> 'SCHEDULED' then
    raise exception 'Only scheduled appointments can be checked in';
  end if;

  -- 4. Ensure daily queue counter row exists, then lock it with FOR UPDATE
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

  v_patient_id := coalesce(v_appointment->>'patientId', '');
  v_clinic_location_id := nullif(v_appointment->>'clinicLocationId', '');
  v_visit_type := case when p_payment_amount = 0 then 'FOLLOW_UP' else 'NEW' end;

  -- 5. Update daily queue counter
  update public.counters
     set data = coalesce(v_counter_data, '{}'::jsonb) || jsonb_build_object(
       'lastNumber', v_assigned_queue,
       'date', p_today
     ),
     updated_at = now()
   where clinic_id = p_clinic_id
     and id = ('queue_' || p_today);

  -- 6. Update appointment status to ARRIVED
  v_updated_appointment := v_appointment || jsonb_build_object(
    'status', 'ARRIVED',
    'updatedAt', p_timestamp
  );

  update public.appointments
     set data = v_updated_appointment,
         updated_at = now()
   where clinic_id = p_clinic_id
     and id = p_appointment_id;

  -- 7. Build and insert invoice
  v_invoice := jsonb_build_object(
    'invoiceId', p_invoice_id,
    'patientId', v_patient_id,
    'visitId', p_visit_id,
    'clinicLocationId', v_clinic_location_id,
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

  -- 8. Build and insert payment
  v_payment := jsonb_build_object(
    'paymentId', p_payment_id,
    'patientId', v_patient_id,
    'visitId', p_visit_id,
    'invoiceId', p_invoice_id,
    'clinicLocationId', v_clinic_location_id,
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

  -- 9. Build and insert visit
  v_visit := jsonb_build_object(
    'visitId', p_visit_id,
    'patientId', v_patient_id,
    'appointmentId', coalesce(v_appointment->>'appointmentId', p_appointment_id),
    'clinicLocationId', v_clinic_location_id,
    'visitType', v_visit_type,
    'source', 'APPOINTMENT',
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

  return jsonb_build_object(
    'appointment', v_updated_appointment,
    'visit', v_visit
  );
end;
$$;

revoke execute on function public.check_in_appointment(
  text, text, text, text, integer, text, text, text, text, numeric, text, text, jsonb
) from public, anon;

grant execute on function public.check_in_appointment(
  text, text, text, text, integer, text, text, text, text, numeric, text, text, jsonb
) to authenticated;
