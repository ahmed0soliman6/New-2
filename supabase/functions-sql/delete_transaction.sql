-- Soli Medical: Atomic Delete Financial Transaction
-- Tables affected atomically: payments, invoices, transactions
-- Do NOT execute automatically on production; review and run in Supabase SQL Editor.

drop function if exists public.delete_transaction(text, text, text, text) cascade;

create or replace function public.delete_transaction(
  p_clinic_id text,
  p_payment_id text,
  p_invoice_id text,
  p_tx_id text
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
    public.has_clinic_permission(p_clinic_id, 'payments.delete', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'billing.delete', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'billing-payments', 'delete')
  ) then
    raise exception 'Unauthorized: caller lacks payments.delete / billing.delete permission';
  end if;

  if (p_payment_id is null or btrim(p_payment_id) = '')
     and (p_invoice_id is null or btrim(p_invoice_id) = '')
     and (p_tx_id is null or btrim(p_tx_id) = '') then
    raise exception 'Invalid input: transaction identifier is required';
  end if;

  delete from public.payments
   where clinic_id = p_clinic_id
     and (
       id = coalesce(p_payment_id, '')
       or id = coalesce(p_tx_id, '')
       or data->>'invoiceId' = coalesce(p_invoice_id, '')
     );

  delete from public.invoices
   where clinic_id = p_clinic_id
     and (
       id = coalesce(p_invoice_id, '')
       or id = coalesce(p_tx_id, '')
     );

  delete from public.transactions
   where clinic_id = p_clinic_id
     and (
       id = coalesce(p_tx_id, '')
       or id = coalesce(p_payment_id, '')
       or id = coalesce(p_invoice_id, '')
     );
end;
$$;

revoke execute on function public.delete_transaction(text, text, text, text) from public, anon;
grant execute on function public.delete_transaction(text, text, text, text) to authenticated;
