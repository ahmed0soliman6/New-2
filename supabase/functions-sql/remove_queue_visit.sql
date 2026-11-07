-- Soli Medical: Atomic Remove Queue Visit Transaction
-- Tables affected atomically: visits, invoices, payments, appointments
-- Do NOT execute automatically on production; review and run in Supabase SQL Editor.

create or replace function public.remove_queue_visit(
  p_clinic_id text,
  p_visit_id text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_visit jsonb;
  v_appointment_id text;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'queue.delete', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'waiting-queue', 'delete')
  ) then
    raise exception 'Unauthorized: caller lacks waiting-queue.delete permission';
  end if;

  if p_visit_id is null or btrim(p_visit_id) = '' then
    raise exception 'Invalid input: p_visit_id is required';
  end if;

  select data
    into v_visit
    from public.visits
   where clinic_id = p_clinic_id
     and id = p_visit_id
   for update;

  if v_visit is null then
    return;
  end if;

  v_appointment_id := nullif(v_visit->>'appointmentId', '');

  -- Remove associated payments and invoices for this visit
  delete from public.payments
   where clinic_id = p_clinic_id
     and (
       data->>'visitId' = p_visit_id
       or data->>'invoiceId' in (
         select id from public.invoices
          where clinic_id = p_clinic_id
            and data->>'visitId' = p_visit_id
       )
     );

  delete from public.invoices
   where clinic_id = p_clinic_id
     and data->>'visitId' = p_visit_id;

  delete from public.visits
   where clinic_id = p_clinic_id
     and id = p_visit_id;

  if v_appointment_id is not null then
    update public.appointments
       set data = data || jsonb_build_object('status', 'CANCELLED', 'updatedAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
           updated_at = now()
     where clinic_id = p_clinic_id
       and id = v_appointment_id;
  end if;
end;
$$;

revoke execute on function public.remove_queue_visit(text, text) from public, anon;
grant execute on function public.remove_queue_visit(text, text) to authenticated;
