-- Soli Medical: Atomic Add Financial Transaction
-- Tables affected atomically: patients (optional), invoices, payments
-- Do NOT execute automatically on production; review and run in Supabase SQL Editor.

drop function if exists public.add_transaction(text, text, text, jsonb, text, jsonb, text, jsonb) cascade;

create or replace function public.add_transaction(
  p_clinic_id text,
  p_timestamp text,
  p_invoice_id text,
  p_invoice_data jsonb,
  p_payment_id text default null,
  p_payment_data jsonb default null,
  p_patient_id text default null,
  p_patient_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'billing.create', 'create')
    or public.has_clinic_permission(p_clinic_id, 'payments.create', 'create')
    or public.has_clinic_permission(p_clinic_id, 'billing-payments', 'create')
  ) then
    raise exception 'Unauthorized: caller lacks billing.create / payments.create permission';
  end if;

  if p_invoice_id is null or btrim(p_invoice_id) = '' or p_invoice_data is null then
    raise exception 'Invalid input: p_invoice_id and p_invoice_data are required';
  end if;

  if coalesce((p_invoice_data->>'total')::numeric, 0) < 0 then
    raise exception 'Invalid input: invoice total cannot be negative';
  end if;

  if p_patient_id is not null and btrim(p_patient_id) <> '' and p_patient_data is not null then
    insert into public.patients (clinic_id, id, data)
    values (p_clinic_id, p_patient_id, p_patient_data)
    on conflict (clinic_id, id) do nothing;
  end if;

  insert into public.invoices (clinic_id, id, data)
  values (p_clinic_id, p_invoice_id, p_invoice_data)
  on conflict (clinic_id, id) do update
    set data = excluded.data,
        updated_at = now();

  if p_payment_id is not null and btrim(p_payment_id) <> '' and p_payment_data is not null then
    if coalesce((p_payment_data->>'amount')::numeric, 0) < 0 then
      raise exception 'Invalid input: payment amount cannot be negative';
    end if;

    insert into public.payments (clinic_id, id, data)
    values (p_clinic_id, p_payment_id, p_payment_data)
    on conflict (clinic_id, id) do update
      set data = excluded.data,
          updated_at = now();
  end if;
end;
$$;

revoke execute on function public.add_transaction(text, text, text, jsonb, text, jsonb, text, jsonb) from public, anon;
grant execute on function public.add_transaction(text, text, text, jsonb, text, jsonb, text, jsonb) to authenticated;
