-- =============================================================================
-- Soli Medical Clinic System v3.0.0 — Canonical Database Schema
-- File: supabase/schema.sql (Synchronized with supabase/full_setup.sql)
-- =============================================================================

begin;

-- 1. Core Multi-Clinic Tables
create table if not exists public.clinics (
  id text primary key,
  name text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.clinic_members (
  clinic_id text not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'doctor', -- 'admin' | 'doctor' | 'secretary' (default template only)
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create index if not exists clinic_members_user_idx on public.clinic_members(user_id);
create index if not exists clinic_members_clinic_active_idx on public.clinic_members(clinic_id, is_active);

create table if not exists public.usernames (
  username_lower text primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);

-- 2. Custom Permission & Membership Helper Functions
create or replace function public.is_clinic_member(cid text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.clinic_members m
     where m.clinic_id = cid
       and m.user_id = auth.uid()
       and m.is_active = true
  );
$$;

create or replace function public.has_clinic_permission(
  p_clinic_id text,
  p_permission text,
  p_action text default 'view'
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_is_active boolean;
  v_perms jsonb;
  v_special jsonb;
  v_custom jsonb;
  v_allowed jsonb;
  v_screen_id text;
  v_mapped_action text;
  v_special_key text;
begin
  if auth.uid() is null or p_clinic_id is null or btrim(p_clinic_id) = '' then
    return false;
  end if;

  select lower(coalesce(m.role, 'secretary')),
         coalesce(m.is_active, false),
         coalesce(m.permissions, '{}'::jsonb)
    into v_role, v_is_active, v_perms
    from public.clinic_members m
   where m.clinic_id = p_clinic_id
     and m.user_id = auth.uid();

  if not found or v_is_active is distinct from true then
    return false;
  end if;

  v_special := v_perms->'specialPermissions';
  v_custom := v_perms->'customPermissions';
  v_allowed := v_perms->'allowedScreens';
  v_mapped_action := lower(coalesce(nullif(btrim(p_action), ''), 'view'));

  v_screen_id := p_permission;
  v_special_key := p_permission;

  case p_permission
    when 'patients.view', 'patients.read' then v_screen_id := 'patient-records'; v_mapped_action := 'view';
    when 'patients.create' then v_screen_id := 'patient-intake'; v_mapped_action := 'create';
    when 'patients.update' then v_screen_id := 'patient-records'; v_mapped_action := 'update';
    when 'patients.delete' then v_screen_id := 'patient-records'; v_mapped_action := 'delete';
    when 'appointments.view', 'appointments.read' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'view';
    when 'appointments.create' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'create';
    when 'appointments.update', 'appointments.checkin' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'update';
    when 'appointments.delete', 'appointments.cancel' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'delete';
    when 'queue.view', 'queue.read' then v_screen_id := 'waiting-queue'; v_mapped_action := 'view';
    when 'queue.create' then v_screen_id := 'waiting-queue'; v_mapped_action := 'create';
    when 'queue.update' then v_screen_id := 'waiting-queue'; v_mapped_action := 'update';
    when 'queue.delete' then v_screen_id := 'waiting-queue'; v_mapped_action := 'delete';
    when 'clinical.view', 'clinical.read' then v_screen_id := 'clinical-exam'; v_mapped_action := 'view';
    when 'clinical.open', 'clinical.create' then v_screen_id := 'clinical-exam'; v_mapped_action := 'create'; v_special_key := 'clinical.open';
    when 'clinical.complete', 'clinical.update' then v_screen_id := 'clinical-exam'; v_mapped_action := 'update'; v_special_key := 'clinical.complete';
    when 'clinical.delete' then v_screen_id := 'clinical-exam'; v_mapped_action := 'delete';
    when 'prescriptions.view', 'prescriptions.read' then v_screen_id := 'prescription-print'; v_mapped_action := 'view';
    when 'prescriptions.create' then v_screen_id := 'prescription-print'; v_mapped_action := 'create';
    when 'prescriptions.update' then v_screen_id := 'prescription-print'; v_mapped_action := 'update';
    when 'prescriptions.delete' then v_screen_id := 'prescription-print'; v_mapped_action := 'delete';
    when 'lab.view' then v_screen_id := 'clinical-exam'; v_mapped_action := 'view';
    when 'lab.create' then v_screen_id := 'clinical-exam'; v_mapped_action := 'create';
    when 'lab.update' then v_screen_id := 'clinical-exam'; v_mapped_action := 'update';
    when 'lab.delete' then v_screen_id := 'clinical-exam'; v_mapped_action := 'delete';
    when 'radiology.view' then v_screen_id := 'clinical-exam'; v_mapped_action := 'view';
    when 'radiology.create' then v_screen_id := 'clinical-exam'; v_mapped_action := 'create';
    when 'radiology.update' then v_screen_id := 'clinical-exam'; v_mapped_action := 'update';
    when 'radiology.delete' then v_screen_id := 'clinical-exam'; v_mapped_action := 'delete';
    when 'billing.view', 'billing.read', 'payments.view', 'payments.read' then v_screen_id := 'billing-payments'; v_mapped_action := 'view';
    when 'billing.create', 'payments.create' then v_screen_id := 'billing-payments'; v_mapped_action := 'create';
    when 'billing.update', 'payments.update' then v_screen_id := 'billing-payments'; v_mapped_action := 'update';
    when 'billing.delete' then v_screen_id := 'billing-payments'; v_mapped_action := 'delete'; v_special_key := 'billing.delete';
    when 'payments.delete' then v_screen_id := 'billing-payments'; v_mapped_action := 'delete'; v_special_key := 'payments.delete';
    when 'expenses.view' then v_screen_id := 'daily-expenses'; v_mapped_action := 'view';
    when 'expenses.create' then v_screen_id := 'daily-expenses'; v_mapped_action := 'create';
    when 'expenses.update' then v_screen_id := 'daily-expenses'; v_mapped_action := 'update';
    when 'expenses.delete' then v_screen_id := 'daily-expenses'; v_mapped_action := 'delete';
    when 'catalogs.view' then v_screen_id := 'medical-catalogs'; v_mapped_action := 'view';
    when 'catalogs.create' then v_screen_id := 'medical-catalogs'; v_mapped_action := 'create';
    when 'catalogs.update' then v_screen_id := 'medical-catalogs'; v_mapped_action := 'update';
    when 'catalogs.delete' then v_screen_id := 'medical-catalogs'; v_mapped_action := 'delete';
    when 'settings.view', 'settings.read' then v_screen_id := 'system-settings'; v_mapped_action := 'view';
    when 'settings.update', 'settings.manage' then v_screen_id := 'system-settings'; v_mapped_action := 'update';
    when 'users.manage' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'users.manage';
    when 'backup.export' then v_screen_id := 'system-settings'; v_mapped_action := 'view'; v_special_key := 'backup.export';
    when 'backup.restore' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'backup.restore';
    when 'system.clear_all_data' then v_screen_id := 'system-settings'; v_mapped_action := 'delete'; v_special_key := 'system.clear_all_data';
    when 'demo.manage' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'demo.manage';
    else
      null;
  end case;

  if v_special is not null and jsonb_typeof(v_special) = 'object' then
    if v_special ? p_permission and jsonb_typeof(v_special->p_permission) = 'boolean' then
      return (v_special->>p_permission)::boolean;
    end if;
    if v_special ? v_special_key and jsonb_typeof(v_special->v_special_key) = 'boolean' then
      return (v_special->>v_special_key)::boolean;
    end if;
  end if;

  if v_custom is not null and jsonb_typeof(v_custom) = 'object' then
    if v_custom ? v_screen_id and jsonb_typeof(v_custom->v_screen_id) = 'object' then
      if (v_custom->v_screen_id) ? v_mapped_action then
        return coalesce((v_custom->v_screen_id->>v_mapped_action)::boolean, false);
      end if;
    end if;
    if v_screen_id = 'patient-intake' and (v_custom ? 'patient-records') then
      return coalesce((v_custom->'patient-records'->>v_mapped_action)::boolean, false);
    end if;
  end if;

  if v_allowed is not null and jsonb_typeof(v_allowed) = 'array' then
    if not (v_allowed ? v_screen_id) then
      return false;
    end if;
  end if;

  if v_role = 'admin' then
    return true;
  elsif v_role = 'doctor' then
    if v_special_key in ('patients.delete', 'billing.delete', 'payments.delete', 'system.clear_all_data', 'backup.restore', 'users.manage', 'demo.manage') then
      return false;
    end if;
    if v_screen_id in ('system-settings', 'daily-expenses') and v_mapped_action <> 'view' then
      return false;
    end if;
    if v_screen_id = 'patient-records' and v_mapped_action = 'delete' then
      return false;
    end if;
    if v_screen_id = 'billing-payments' and v_mapped_action in ('create', 'update', 'delete') then
      return false;
    end if;
    return true;
  else
    if v_screen_id in ('dashboard', 'patient-intake', 'waiting-queue', 'appointments-scheduling') then
      return true;
    end if;
    if v_screen_id = 'patient-records' then
      return v_mapped_action in ('view', 'create', 'update');
    end if;
    if v_screen_id in ('billing-payments', 'daily-expenses') then
      return v_mapped_action in ('view', 'create', 'update');
    end if;
    if v_screen_id = 'prescription-print' then
      return v_mapped_action = 'view';
    end if;
    if v_screen_id = 'medical-catalogs' then
      return v_mapped_action = 'view';
    end if;
    return false;
  end if;
end;
$$;

create or replace function public.is_clinic_admin(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_clinic_permission(cid, 'users.manage', 'update')
      or public.has_clinic_permission(cid, 'system-settings', 'update');
$$;

create or replace function public.is_clinic_doctor_or_admin(cid text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_clinic_permission(cid, 'clinical.complete', 'update')
      or public.has_clinic_permission(cid, 'clinical-exam', 'update');
$$;

-- 3. Generic clinic-scoped document tables (NO permissive member_all policy)
do $$
declare
  t text;
  p record;
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
    for p in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- 4. Granular Per-Table Policies (SELECT / INSERT / UPDATE / DELETE)
create policy "patients_select" on public.patients for select to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'patients.view', 'view')
    or public.has_clinic_permission(clinic_id, 'patient-intake', 'view')
    or public.has_clinic_permission(clinic_id, 'waiting-queue', 'view')
    or public.has_clinic_permission(clinic_id, 'clinical-exam', 'view')
  ));
create policy "patients_insert" on public.patients for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'patients.create', 'create')
    or public.has_clinic_permission(clinic_id, 'patient-records', 'create')
  ));
create policy "patients_update" on public.patients for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'patients.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'patients.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "patients_delete" on public.patients for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "appointments_select" on public.appointments for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "appointments_insert" on public.appointments for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'appointments.create', 'create'));
create policy "appointments_update" on public.appointments for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
    or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
    or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
  ));
create policy "appointments_delete" on public.appointments for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'appointments.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "visits_select" on public.visits for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "visits_insert" on public.visits for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'queue.create', 'create')
    or public.has_clinic_permission(clinic_id, 'patients.create', 'create')
    or public.has_clinic_permission(clinic_id, 'clinical.open', 'create')
  ));
create policy "visits_update" on public.visits for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'queue.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.open', 'create')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'queue.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.open', 'create')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "visits_delete" on public.visits for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "prescriptions_select" on public.prescriptions for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "prescriptions_insert" on public.prescriptions for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'prescriptions.create', 'create')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "prescriptions_update" on public.prescriptions for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'prescriptions.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'prescriptions.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "prescriptions_delete" on public.prescriptions for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'prescriptions.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "lab_orders_select" on public.lab_orders for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "lab_orders_insert" on public.lab_orders for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'lab.create', 'create')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "lab_orders_update" on public.lab_orders for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'lab.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'lab.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "lab_orders_delete" on public.lab_orders for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'lab.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "radiology_orders_select" on public.radiology_orders for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "radiology_orders_insert" on public.radiology_orders for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'radiology.create', 'create')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "radiology_orders_update" on public.radiology_orders for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'radiology.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'radiology.update', 'update')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
  ));
create policy "radiology_orders_delete" on public.radiology_orders for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'radiology.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "follow_ups_select" on public.follow_ups for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "follow_ups_insert" on public.follow_ups for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'appointments.create', 'create')
  ));
create policy "follow_ups_update" on public.follow_ups for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
  ));
create policy "follow_ups_delete" on public.follow_ups for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(clinic_id, 'appointments.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "invoices_select" on public.invoices for select to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'billing.view', 'view')
    or public.has_clinic_permission(clinic_id, 'patient-intake', 'view')
    or public.has_clinic_permission(clinic_id, 'waiting-queue', 'view')
  ));
create policy "invoices_insert" on public.invoices for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'billing.create', 'create')
    or public.has_clinic_permission(clinic_id, 'patients.create', 'create')
    or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
  ));
create policy "invoices_update" on public.invoices for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'billing.update', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'billing.update', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
  ));
create policy "invoices_delete" on public.invoices for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'billing.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'payments.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "payments_select" on public.payments for select to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'payments.view', 'view')
    or public.has_clinic_permission(clinic_id, 'patient-intake', 'view')
    or public.has_clinic_permission(clinic_id, 'waiting-queue', 'view')
  ));
create policy "payments_insert" on public.payments for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'payments.create', 'create')
    or public.has_clinic_permission(clinic_id, 'patients.create', 'create')
    or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
  ));
create policy "payments_update" on public.payments for update to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'payments.update', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
  ))
  with check (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'payments.update', 'update')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
  ));
create policy "payments_delete" on public.payments for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'payments.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'billing.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "transactions_select" on public.transactions for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.view', 'view'));
create policy "transactions_insert" on public.transactions for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.create', 'create'));
create policy "transactions_update" on public.transactions for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.update', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.update', 'update'));
create policy "transactions_delete" on public.transactions for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'payments.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'billing.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "expenses_select" on public.expenses for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.view', 'view'));
create policy "expenses_insert" on public.expenses for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.create', 'create'));
create policy "expenses_update" on public.expenses for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'));
create policy "expenses_delete" on public.expenses for delete to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'expenses.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "expense_categories_select" on public.expense_categories for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "expense_categories_insert" on public.expense_categories for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.create', 'create'));
create policy "expense_categories_update" on public.expense_categories for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'));
create policy "expense_categories_delete" on public.expense_categories for delete to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.delete', 'delete'));

do $$
declare
  ct text;
  catalog_tables text[] := array[
    'medications','lab_tests','radiology_types','diagnoses','symptoms','chronic_diseases','services'
  ];
begin
  foreach ct in array catalog_tables loop
    execute format($f$
      create policy "%1$s_select" on public.%1$I for select to authenticated
        using (public.is_clinic_member(clinic_id));
      create policy "%1$s_insert" on public.%1$I for insert to authenticated
        with check (public.is_clinic_member(clinic_id) and (
          public.has_clinic_permission(clinic_id, 'catalogs.create', 'create')
          or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
        ));
      create policy "%1$s_update" on public.%1$I for update to authenticated
        using (public.is_clinic_member(clinic_id) and (
          public.has_clinic_permission(clinic_id, 'catalogs.update', 'update')
          or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
        ))
        with check (public.is_clinic_member(clinic_id) and (
          public.has_clinic_permission(clinic_id, 'catalogs.update', 'update')
          or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
        ));
      create policy "%1$s_delete" on public.%1$I for delete to authenticated
        using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'catalogs.delete', 'delete'));
    $f$, ct);
  end loop;
end $$;

create policy "settings_select" on public.settings for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      id <> '_system_recovery'
      or public.has_clinic_permission(clinic_id, 'users.manage', 'update')
    )
  );
create policy "settings_insert" on public.settings for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      id = '_audit_log'
      or public.has_clinic_permission(clinic_id, 'settings.update', 'update')
    )
  );
create policy "settings_update" on public.settings for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      id = '_audit_log'
      or public.has_clinic_permission(clinic_id, 'settings.update', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      id = '_audit_log'
      or public.has_clinic_permission(clinic_id, 'settings.update', 'update')
    )
  );
create policy "settings_delete" on public.settings for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and id not in ('_system_recovery', '_audit_log')
    and public.has_clinic_permission(clinic_id, 'settings.update', 'delete')
  );

create policy "backups_select" on public.backups for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.export', 'view'));
create policy "backups_insert" on public.backups for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.export', 'create'));
create policy "backups_update" on public.backups for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.restore', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.restore', 'update'));
create policy "backups_delete" on public.backups for delete to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.restore', 'delete'));

create policy "counters_select" on public.counters for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "counters_insert" on public.counters for insert to authenticated
  with check (public.is_clinic_member(clinic_id));
create policy "counters_update" on public.counters for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));
create policy "counters_delete" on public.counters for delete to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete'));

alter table public.clinics enable row level security;
drop policy if exists "clinic_read_own" on public.clinics;
create policy "clinic_read_own" on public.clinics for select to authenticated
  using (public.is_clinic_member(id));

alter table public.clinic_members enable row level security;
drop policy if exists "members_read_own_clinic" on public.clinic_members;
drop policy if exists "members_admin_write" on public.clinic_members;
drop policy if exists "members_select" on public.clinic_members;
drop policy if exists "members_insert" on public.clinic_members;
drop policy if exists "members_update" on public.clinic_members;
drop policy if exists "members_delete" on public.clinic_members;

create policy "members_select" on public.clinic_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_clinic_permission(clinic_id, 'users.manage', 'view')
    or public.has_clinic_permission(clinic_id, 'system-settings', 'view')
  );
create policy "members_insert" on public.clinic_members for insert to authenticated
  with check (
    public.has_clinic_permission(clinic_id, 'users.manage', 'create')
    or public.has_clinic_permission(clinic_id, 'system-settings', 'create')
  );
create policy "members_update" on public.clinic_members for update to authenticated
  using (
    public.has_clinic_permission(clinic_id, 'users.manage', 'update')
    or public.has_clinic_permission(clinic_id, 'system-settings', 'update')
  )
  with check (
    public.has_clinic_permission(clinic_id, 'users.manage', 'update')
    or public.has_clinic_permission(clinic_id, 'system-settings', 'update')
  );
create policy "members_delete" on public.clinic_members for delete to authenticated
  using (
    user_id <> auth.uid()
    and (
      public.has_clinic_permission(clinic_id, 'users.manage', 'delete')
      or public.has_clinic_permission(clinic_id, 'system-settings', 'delete')
    )
  );

alter table public.usernames enable row level security;

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

-- 5. Hardened RPC Functions (With DROP FUNCTION IF EXISTS to prevent Error 42P13)
drop function if exists public.delete_patient(text, text, text) cascade;
drop function if exists public.delete_patient(text, text) cascade;
drop function if exists public.remove_queue_visit(text, text) cascade;
drop function if exists public.add_transaction(text, text, text, jsonb, text, jsonb, text, jsonb) cascade;
drop function if exists public.delete_transaction(text, text, text, text) cascade;
drop function if exists public.admin_delete_clinic_user(text, uuid) cascade;
drop function if exists public.complete_visit(text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) cascade;
drop function if exists public.check_in_appointment(text, text, text, text, integer, text, text, text, text, numeric, text, text, jsonb) cascade;
drop function if exists public.register_walk_in(text, text, text, integer, text, jsonb, text, text, text, text, numeric, text, text, text, text, jsonb) cascade;
drop function if exists public.create_appointment(text, text, text, jsonb, text, jsonb) cascade;

-- 6. Default Clinic Seed (clinic_main)
insert into public.clinics (id, name)
values ('clinic_main', 'عيادة سولي الطبية - Soli Medical Clinic')
on conflict (id) do nothing;

insert into public.settings (clinic_id, id, data)
values (
  'clinic_main',
  '_audit_log',
  jsonb_build_object('entries', '[]'::jsonb, 'updatedAt', now())
)
on conflict (clinic_id, id) do nothing;

commit;
