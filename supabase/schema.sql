-- Soli Medical: Supabase schema (draft, multi-clinic, JSON-document model)
-- Each Firestore collection becomes a table with clinic_id + jsonb data.
-- Run once in Supabase SQL Editor. Test RLS with two users from two clinics before real data.

create extension if not exists pgcrypto;

-- ===== Core tenancy =====
create table if not exists public.clinics (
  id text primary key,
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  clinic_id text not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff',
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  primary key (clinic_id, user_id)
);

-- Helper: does the current user belong to this clinic (and is active)?
create or replace function public.is_clinic_member(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members m
    where m.clinic_id = cid and m.user_id = auth.uid() and m.is_active
  );
$$;

create or replace function public.is_clinic_admin(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members m
    where m.clinic_id = cid and m.user_id = auth.uid() and m.is_active and m.role = 'admin'
  );
$$;

create or replace function public.is_clinic_doctor_or_admin(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clinic_members m
    where m.clinic_id = cid and m.user_id = auth.uid() and m.is_active and m.role in ('admin', 'doctor')
  );
$$;

-- ===== Generic clinic-scoped document tables =====
do $$
declare
  t text;
  tables text[] := array[
    'patients','appointments','visits','invoices','payments','transactions',
    'expenses','expense_categories','prescriptions','follow_ups','lab_orders',
    'radiology_orders','medications','lab_tests','radiology_types','diagnoses',
    'symptoms','chronic_diseases','services','backups','settings','counters'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create table if not exists public.%I (
        clinic_id text not null references public.clinics(id) on delete cascade,
        id text not null,
        data jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        primary key (clinic_id, id)
      )$f$, t);
    execute format('create index if not exists %I on public.%I (clinic_id, updated_at)',
      t || '_clinic_updated_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "member_all" on public.%I', t);
    execute format($f$
      create policy "member_all" on public.%I
      for all to authenticated
      using (public.is_clinic_member(clinic_id))
      with check (public.is_clinic_member(clinic_id))
    $f$, t);
  end loop;
end $$;

-- ===== Clinic settings & backups are admin-writable only; prescriptions are doctor/admin-writable =====
drop policy if exists "member_all" on public.settings;
-- Non-admin members can read all settings EXCEPT internal system recovery row
create policy "settings_read" on public.settings for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (id <> '_system_recovery' or public.is_clinic_admin(clinic_id))
  );
create policy "settings_write" on public.settings for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

drop policy if exists "member_all" on public.backups;
create policy "backups_read" on public.backups for select to authenticated
  using (public.is_clinic_admin(clinic_id));
create policy "backups_write" on public.backups for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

drop policy if exists "member_all" on public.prescriptions;
create policy "prescriptions_read" on public.prescriptions for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "prescriptions_write" on public.prescriptions for all to authenticated
  using (public.is_clinic_doctor_or_admin(clinic_id))
  with check (public.is_clinic_doctor_or_admin(clinic_id));

-- ===== Granular Deletion Guards (Admins Only for Patient & Financial records) =====
-- Patients: Only admin can permanently delete a patient file
drop policy if exists "patients_delete_guard" on public.patients;
create policy "patients_delete_guard" on public.patients for delete to authenticated
  using (public.is_clinic_admin(clinic_id));

-- Financials: Invoices, Payments, Transactions, Expenses can only be deleted by Admin
drop policy if exists "invoices_delete_guard" on public.invoices;
create policy "invoices_delete_guard" on public.invoices for delete to authenticated
  using (public.is_clinic_admin(clinic_id));

drop policy if exists "payments_delete_guard" on public.payments;
create policy "payments_delete_guard" on public.payments for delete to authenticated
  using (public.is_clinic_admin(clinic_id));

drop policy if exists "transactions_delete_guard" on public.transactions;
create policy "transactions_delete_guard" on public.transactions for delete to authenticated
  using (public.is_clinic_admin(clinic_id));

drop policy if exists "expenses_delete_guard" on public.expenses;
create policy "expenses_delete_guard" on public.expenses for delete to authenticated
  using (public.is_clinic_admin(clinic_id));

-- Clinical orders: Lab & Radiology write/delete restricted to doctor or admin
drop policy if exists "lab_orders_write_guard" on public.lab_orders;
create policy "lab_orders_write_guard" on public.lab_orders for all to authenticated
  using (public.is_clinic_doctor_or_admin(clinic_id))
  with check (public.is_clinic_doctor_or_admin(clinic_id));

drop policy if exists "radiology_orders_write_guard" on public.radiology_orders;
create policy "radiology_orders_write_guard" on public.radiology_orders for all to authenticated
  using (public.is_clinic_doctor_or_admin(clinic_id))
  with check (public.is_clinic_doctor_or_admin(clinic_id));

-- ===== Clinics & members =====
alter table public.clinics enable row level security;
create policy "clinic_read_own" on public.clinics for select to authenticated
  using (public.is_clinic_member(id));

alter table public.clinic_members enable row level security;
create policy "members_read_own_clinic" on public.clinic_members for select to authenticated
  using (user_id = auth.uid() or public.is_clinic_admin(clinic_id));
create policy "members_admin_write" on public.clinic_members for all to authenticated
  using (public.is_clinic_admin(clinic_id))
  with check (public.is_clinic_admin(clinic_id));

-- ===== Usernames: needed for username login (no email) =====
create table if not exists public.usernames (
  username_lower text primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.usernames enable row level security;
-- No direct client access; resolved through a server function or the login flow.

-- Keep updated_at fresh
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','appointments','visits','invoices','payments','transactions',
    'expenses','expense_categories','prescriptions','follow_ups','lab_orders','radiology_orders',
    'medications','lab_tests','radiology_types','diagnoses','symptoms','chronic_diseases',
    'services','backups','settings','counters'] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
