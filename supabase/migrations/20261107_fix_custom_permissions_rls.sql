-- =============================================================================
-- Soli Medical v3.0.0 — Custom Permissions & Granular RLS Migration
-- File: supabase/migrations/20261107_fix_custom_permissions_rls.sql
-- =============================================================================
-- تعليمات التشغيل اليدوية (Manual Execution Instructions):
-- 1. افتح لوحة تحكم Supabase الخاصة بالمشروع (Supabase Dashboard).
-- 2. انتقل إلى قسم SQL Editor ثم اضغط New Query.
-- 3. انسخ محتوى هذا الملف بالكامل والصقه في المحرر ثم اضغط Run.
-- 4. ملاحظة أمنية: هذا السكربت يحذف السياسة العامة القديمة (member_all) التي كانت
--    تسمح لأي عضو بالحذف أو التعديل، ويستبدلها بسياسات منفصلة (SELECT / INSERT / UPDATE / DELETE)
--    تعتمد على دالة public.has_clinic_permission(clinic_id, permission, action)
--    التي تقرأ الصلاحيات المخصصة الفردية من clinic_members.permissions بغض النظر عن المسمى الوظيفي.
-- =============================================================================

begin;

-- 1. Core Membership Helper
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

-- 2. Flexible Custom Permission Evaluator (Role is only a default fallback!)
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

  -- Map permission token or screen name to canonical (v_screen_id, v_mapped_action, v_special_key)
  v_screen_id := p_permission;
  v_special_key := p_permission;

  case p_permission
    when 'patients.view' then v_screen_id := 'patient-records'; v_mapped_action := 'view';
    when 'patients.create' then v_screen_id := 'patient-intake'; v_mapped_action := 'create';
    when 'patients.update' then v_screen_id := 'patient-records'; v_mapped_action := 'update';
    when 'patients.delete' then v_screen_id := 'patient-records'; v_mapped_action := 'delete';
    when 'appointments.view' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'view';
    when 'appointments.create' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'create';
    when 'appointments.update', 'appointments.checkin' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'update';
    when 'appointments.delete', 'appointments.cancel' then v_screen_id := 'appointments-scheduling'; v_mapped_action := 'delete';
    when 'queue.view' then v_screen_id := 'waiting-queue'; v_mapped_action := 'view';
    when 'queue.create' then v_screen_id := 'waiting-queue'; v_mapped_action := 'create';
    when 'queue.update' then v_screen_id := 'waiting-queue'; v_mapped_action := 'update';
    when 'queue.delete' then v_screen_id := 'waiting-queue'; v_mapped_action := 'delete';
    when 'clinical.view' then v_screen_id := 'clinical-exam'; v_mapped_action := 'view';
    when 'clinical.open', 'clinical.create' then v_screen_id := 'clinical-exam'; v_mapped_action := 'create'; v_special_key := 'clinical.open';
    when 'clinical.complete', 'clinical.update' then v_screen_id := 'clinical-exam'; v_mapped_action := 'update'; v_special_key := 'clinical.complete';
    when 'clinical.delete' then v_screen_id := 'clinical-exam'; v_mapped_action := 'delete';
    when 'prescriptions.view' then v_screen_id := 'prescription-print'; v_mapped_action := 'view';
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
    when 'billing.view', 'payments.view' then v_screen_id := 'billing-payments'; v_mapped_action := 'view';
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
    when 'settings.view' then v_screen_id := 'system-settings'; v_mapped_action := 'view';
    when 'settings.update' then v_screen_id := 'system-settings'; v_mapped_action := 'update';
    when 'users.manage' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'users.manage';
    when 'audit.view' then v_screen_id := 'system-settings'; v_mapped_action := 'view'; v_special_key := 'audit.view';
    when 'backup.export' then v_screen_id := 'system-settings'; v_mapped_action := 'view'; v_special_key := 'backup.export';
    when 'backup.restore' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'backup.restore';
    when 'system.clear_all_data' then v_screen_id := 'system-settings'; v_mapped_action := 'delete'; v_special_key := 'system.clear_all_data';
    when 'data.purge' then v_screen_id := 'system-settings'; v_mapped_action := 'delete'; v_special_key := 'data.purge';
    when 'demo.manage' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'demo.manage';
    else
      null;
  end case;

  -- Priority 1: Explicit specialPermissions override in clinic_members.permissions
  if v_special is not null and jsonb_typeof(v_special) = 'object' then
    if v_special ? p_permission and jsonb_typeof(v_special->p_permission) = 'boolean' then
      return (v_special->>p_permission)::boolean;
    end if;
    if v_special ? v_special_key and jsonb_typeof(v_special->v_special_key) = 'boolean' then
      return (v_special->>v_special_key)::boolean;
    end if;
  end if;

  -- Standalone high-sensitivity permissions (data.purge is strictly separate from system.clear_all_data and defaults to admin only)
  if v_special_key in ('data.purge', 'system.clear_all_data', 'backup.restore', 'demo.manage') then
    return v_role = 'admin';
  end if;

  -- Priority 2: Explicit customPermissions screen action matrix in clinic_members.permissions
  if v_custom is not null and jsonb_typeof(v_custom) = 'object' then
    if v_custom ? v_screen_id and jsonb_typeof(v_custom->v_screen_id) = 'object' then
      if (v_custom->v_screen_id) ? v_mapped_action then
        return coalesce((v_custom->v_screen_id->>v_mapped_action)::boolean, false);
      end if;
    end if;
    -- Also allow patient-records.create if checking patient-intake.create
    if v_screen_id = 'patient-intake' and (v_custom ? 'patient-records') then
      return coalesce((v_custom->'patient-records'->>v_mapped_action)::boolean, false);
    end if;
  end if;

  -- Priority 3: Legacy allowedScreens array check
  if v_allowed is not null and jsonb_typeof(v_allowed) = 'array' then
    if not (v_allowed ? v_screen_id) then
      return false;
    end if;
  end if;

  -- Priority 4: Default Role Template Fallback (used ONLY when not explicitly customized)
  if v_role = 'admin' then
    return true;
  elsif v_role = 'doctor' then
    if v_special_key in ('patients.delete', 'billing.delete', 'payments.delete', 'system.clear_all_data', 'data.purge', 'backup.restore', 'users.manage', 'demo.manage', 'audit.view') then
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
    -- Secretary default template
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

-- Keep legacy helpers delegating to custom permissions where appropriate
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

-- =============================================================================
-- 3. Drop legacy permissive "member_all" and old policies on all 22 tables
-- =============================================================================
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
    for p in
      select policyname
        from pg_policies
       where schemaname = 'public'
         and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- =============================================================================
-- 4. Granular Per-Table Policies (SELECT / INSERT / UPDATE / DELETE)
-- =============================================================================

-- 4.1 PATIENTS
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

-- 4.2 APPOINTMENTS
create policy "appointments_select" on public.appointments for select to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'appointments.view', 'view')
    or public.has_clinic_permission(clinic_id, 'queue.view', 'view')
    or public.has_clinic_permission(clinic_id, 'patients.view', 'view')
    or public.has_clinic_permission(clinic_id, 'clinical.view', 'view')
    or public.has_clinic_permission(clinic_id, 'dashboard', 'view')
  ));
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

-- 4.3 VISITS
create policy "visits_select" on public.visits for select to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'queue.view', 'view')
    or public.has_clinic_permission(clinic_id, 'clinical.view', 'view')
    or public.has_clinic_permission(clinic_id, 'patients.view', 'view')
    or public.has_clinic_permission(clinic_id, 'billing.view', 'view')
    or public.has_clinic_permission(clinic_id, 'dashboard', 'view')
  ));
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
    or public.has_clinic_permission(clinic_id, 'clinical.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

-- 4.4 PRESCRIPTIONS
create policy "prescriptions_select" on public.prescriptions for select to authenticated
  using (public.is_clinic_member(clinic_id) and (
    public.has_clinic_permission(clinic_id, 'prescriptions.view', 'view')
    or public.has_clinic_permission(clinic_id, 'clinical.view', 'view')
    or public.has_clinic_permission(clinic_id, 'patients.view', 'view')
  ));
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

-- 4.5 LAB_ORDERS & RADIOLOGY_ORDERS & FOLLOW_UPS
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

-- 4.6 INVOICES, PAYMENTS, TRANSACTIONS
create policy "invoices_select" on public.invoices for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.view', 'view'));
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
    or public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
    or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
  ));

create policy "payments_select" on public.payments for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'payments.view', 'view'));
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

-- 4.7 EXPENSES & EXPENSE_CATEGORIES
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

-- 4.8 MEDICAL CATALOGS (medications, lab_tests, radiology_types, diagnoses, symptoms, chronic_diseases, services)
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

-- 4.9 SETTINGS (with protection for _system_recovery and append-only _audit_log)
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
    and id <> '_audit_log'
    and id not like '_audit_log:%'
    and public.has_clinic_permission(clinic_id, 'settings.update', 'update')
  );
create policy "settings_update" on public.settings for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and id <> '_audit_log'
    and id not like '_audit_log:%'
    and public.has_clinic_permission(clinic_id, 'settings.update', 'update')
  )
  with check (
    public.is_clinic_member(clinic_id)
    and id <> '_audit_log'
    and id not like '_audit_log:%'
    and public.has_clinic_permission(clinic_id, 'settings.update', 'update')
  );
create policy "settings_delete" on public.settings for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and id not in ('_system_recovery', '_audit_log')
    and id not like '_audit_log:%'
    and public.has_clinic_permission(clinic_id, 'settings.update', 'delete')
  );

-- 4.10 BACKUPS
create policy "backups_select" on public.backups for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.export', 'view'));
create policy "backups_insert" on public.backups for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.export', 'create'));
create policy "backups_update" on public.backups for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.restore', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.restore', 'update'));
create policy "backups_delete" on public.backups for delete to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'backup.restore', 'delete'));

-- 4.11 COUNTERS
create policy "counters_select" on public.counters for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "counters_insert" on public.counters for insert to authenticated
  with check (public.is_clinic_member(clinic_id));
create policy "counters_update" on public.counters for update to authenticated
  using (public.is_clinic_member(clinic_id))
  with check (public.is_clinic_member(clinic_id));
create policy "counters_delete" on public.counters for delete to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete'));

-- 4.12 CLINIC_MEMBERS
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

-- =============================================================================
-- 5. Hardened RPC Functions (Enforcing Membership + Custom Permissions + Input Validation)
--    IMPORTANT: Drop any existing versions first to prevent PostgreSQL Error 42P13
--    ("cannot change return type of existing function") when upgrading from older schemas.
-- =============================================================================

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
drop function if exists public.append_audit_log(text, jsonb) cascade;

-- Dynamic cleanup of any other overloaded signatures for these 10 RPC names
do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'check_in_appointment',
         'register_walk_in',
         'complete_visit',
         'create_appointment',
         'remove_queue_visit',
         'delete_patient',
         'add_transaction',
         'delete_transaction',
         'admin_delete_clinic_user',
         'append_audit_log'
       )
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;

-- 5.1 check_in_appointment
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
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'appointments.checkin', 'update')
    or public.has_clinic_permission(p_clinic_id, 'waiting-queue', 'create')
    or public.has_clinic_permission(p_clinic_id, 'queue.create', 'create')
  ) then
    raise exception 'Unauthorized: missing permission appointments.checkin / waiting-queue.create';
  end if;

  if p_appointment_id is null or btrim(p_appointment_id) = '' then
    raise exception 'Invalid input: p_appointment_id is required';
  end if;
  if p_visit_id is null or btrim(p_visit_id) = '' then
    raise exception 'Invalid input: p_visit_id is required';
  end if;
  if p_payment_amount is null or p_payment_amount < 0 then
    raise exception 'Invalid input: p_payment_amount cannot be negative';
  end if;

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

  update public.counters
     set data = coalesce(v_counter_data, '{}'::jsonb) || jsonb_build_object(
       'lastNumber', v_assigned_queue,
       'date', p_today
     ),
     updated_at = now()
   where clinic_id = p_clinic_id
     and id = ('queue_' || p_today);

  v_updated_appointment := v_appointment || jsonb_build_object(
    'status', 'ARRIVED',
    'updatedAt', p_timestamp
  );

  update public.appointments
     set data = v_updated_appointment,
         updated_at = now()
   where clinic_id = p_clinic_id
     and id = p_appointment_id;

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

-- 5.2 register_walk_in
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
security definer
set search_path = public
as $$
declare
  v_counter_data jsonb;
  v_assigned_queue integer;
  v_visit_type text;
  v_visit jsonb;
  v_invoice jsonb;
  v_payment jsonb;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'patients.create', 'create')
    or public.has_clinic_permission(p_clinic_id, 'queue.create', 'create')
    or public.has_clinic_permission(p_clinic_id, 'patient-intake', 'create')
    or public.has_clinic_permission(p_clinic_id, 'waiting-queue', 'create')
  ) then
    raise exception 'Unauthorized: missing permission patients.create / queue.create';
  end if;

  if p_patient_id is null or btrim(p_patient_id) = '' then
    raise exception 'Invalid input: p_patient_id is required';
  end if;
  if p_visit_id is null or btrim(p_visit_id) = '' then
    raise exception 'Invalid input: p_visit_id is required';
  end if;
  if p_payment_amount is null or p_payment_amount < 0 then
    raise exception 'Invalid input: p_payment_amount cannot be negative';
  end if;
  if coalesce(btrim(p_patient_data->>'fullName'), '') = '' then
    raise exception 'Invalid input: patient fullName is required';
  end if;

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

  v_visit_type := case when p_payment_amount = 0 then 'FOLLOW_UP' else 'NEW' end;

  update public.counters
     set data = coalesce(v_counter_data, '{}'::jsonb) || jsonb_build_object(
       'lastNumber', v_assigned_queue,
       'date', p_today
     ),
     updated_at = now()
   where clinic_id = p_clinic_id
     and id = ('queue_' || p_today);

  insert into public.patients (clinic_id, id, data)
  values (p_clinic_id, p_patient_id, p_patient_data - 'clinic_id')
  on conflict (clinic_id, id) do update
    set data = (public.patients.data || (excluded.data - 'clinic_id' - 'createdAt' - 'createdBy')),
        updated_at = now();

  v_invoice := jsonb_build_object(
    'invoiceId', p_invoice_id,
    'patientId', p_patient_id,
    'visitId', p_visit_id,
    'clinicLocationId', p_clinic_location_id,
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

  v_payment := jsonb_build_object(
    'paymentId', p_payment_id,
    'patientId', p_patient_id,
    'visitId', p_visit_id,
    'invoiceId', p_invoice_id,
    'clinicLocationId', p_clinic_location_id,
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

  v_visit := jsonb_build_object(
    'visitId', p_visit_id,
    'patientId', p_patient_id,
    'appointmentId', p_appointment_id,
    'clinicLocationId', p_clinic_location_id,
    'visitType', v_visit_type,
    'source', case when p_appointment_id is not null and p_appointment_id <> '' then 'APPOINTMENT' else 'WALK_IN' end,
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

-- 5.3 complete_visit
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
security definer
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
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;
  if not (
    public.has_clinic_permission(p_clinic_id, 'clinical.complete', 'update')
    or public.has_clinic_permission(p_clinic_id, 'clinical-exam', 'update')
  ) then
    raise exception 'Unauthorized: caller lacks clinical.complete permission in clinic %', p_clinic_id;
  end if;
  if p_visit_id is null or btrim(p_visit_id) = '' then
    raise exception 'Invalid input: p_visit_id is required';
  end if;

  select data into v_visit_data from public.visits where clinic_id = p_clinic_id and id = p_visit_id for update;
  if v_visit_data is null then return; end if;

  v_patient_id := v_visit_data->>'patientId';
  v_already_completed := (coalesce(v_visit_data->>'status', '') = 'COMPLETED');

  if v_patient_id is not null and v_patient_id <> '' then
    select data into v_patient_data from public.patients where clinic_id = p_clinic_id and id = v_patient_id for update;
  end if;

  update public.visits
     set data = v_visit_data || jsonb_build_object(
       'status', 'COMPLETED',
       'doctorId', p_doctor_id,
       'clinicalData', coalesce(p_clinical_data, '{}'::jsonb),
       'vitalSigns', coalesce(p_vital_signs, '{}'::jsonb),
       'completedAt', p_timestamp,
       'updatedAt', p_timestamp
     ),
     updated_at = now()
   where clinic_id = p_clinic_id and id = p_visit_id;

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
     where clinic_id = p_clinic_id and id = v_patient_id;
  end if;

  delete from public.prescriptions where clinic_id = p_clinic_id and data->>'visitId' = p_visit_id;
  if p_prescription is not null and (p_prescription->>'prescriptionId') is not null then
    insert into public.prescriptions (clinic_id, id, data)
    values (p_clinic_id, p_prescription->>'prescriptionId', p_prescription)
    on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now();
  end if;

  delete from public.lab_orders where clinic_id = p_clinic_id and data->>'visitId' = p_visit_id;
  if p_lab_orders is not null and jsonb_typeof(p_lab_orders) = 'array' then
    for v_item in select * from jsonb_array_elements(p_lab_orders) loop
      if (v_item->>'labOrderId') is not null then
        insert into public.lab_orders (clinic_id, id, data)
        values (p_clinic_id, v_item->>'labOrderId', v_item)
        on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now();
      end if;
    end loop;
  end if;

  delete from public.radiology_orders where clinic_id = p_clinic_id and data->>'visitId' = p_visit_id;
  if p_radiology_orders is not null and jsonb_typeof(p_radiology_orders) = 'array' then
    for v_item in select * from jsonb_array_elements(p_radiology_orders) loop
      if (v_item->>'radiologyOrderId') is not null then
        insert into public.radiology_orders (clinic_id, id, data)
        values (p_clinic_id, v_item->>'radiologyOrderId', v_item)
        on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now();
      end if;
    end loop;
  end if;

  delete from public.follow_ups where clinic_id = p_clinic_id and data->>'sourceVisitId' = p_visit_id;
  if p_follow_up is not null and (p_follow_up->>'followUpId') is not null then
    insert into public.follow_ups (clinic_id, id, data)
    values (p_clinic_id, p_follow_up->>'followUpId', p_follow_up)
    on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now();
  end if;
end;
$$;

revoke execute on function public.complete_visit(
  text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.complete_visit(
  text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;

-- 5.4 create_appointment
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
security definer
set search_path = public
as $$
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'appointments.create', 'create')
    or public.has_clinic_permission(p_clinic_id, 'appointments-scheduling', 'create')
  ) then
    raise exception 'Unauthorized: missing permission appointments.create';
  end if;

  if p_appointment_id is null or btrim(p_appointment_id) = '' or p_appointment_data is null then
    raise exception 'Invalid input: p_appointment_id and p_appointment_data are required';
  end if;

  if p_patient_id is not null and p_patient_id <> '' and p_patient_data is not null then
    insert into public.patients (clinic_id, id, data)
    values (p_clinic_id, p_patient_id, p_patient_data - 'clinic_id')
    on conflict (clinic_id, id) do update
      set data = (public.patients.data || (excluded.data - 'clinic_id' - 'createdAt' - 'createdBy')),
          updated_at = now();
  end if;

  insert into public.appointments (clinic_id, id, data)
  values (p_clinic_id, p_appointment_id, p_appointment_data - 'clinic_id')
  on conflict (clinic_id, id) do update
    set data = excluded.data - 'clinic_id',
        updated_at = now();
end;
$$;

revoke execute on function public.create_appointment(
  text, text, text, jsonb, text, jsonb
) from public, anon;
grant execute on function public.create_appointment(
  text, text, text, jsonb, text, jsonb
) to authenticated;

-- 5.5 delete_patient
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
  if p_mode is null or p_mode not in ('file_only', 'everything') then
    raise exception 'Invalid input: p_mode must be file_only or everything';
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

  select data into v_pat from public.patients where clinic_id = p_clinic_id and id = p_patient_id for update;
  if not found or v_pat is null then
    raise exception 'Patient not found: % in clinic %', p_patient_id, p_clinic_id;
  end if;
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
    update public.invoices
       set data = data || jsonb_build_object('patientId', 'pat-general', 'patientName', coalesce(nullif(data->>'patientName', ''), v_patient_name)),
           updated_at = now()
     where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
    update public.payments
       set data = data || jsonb_build_object('patientId', 'pat-general', 'patientName', coalesce(nullif(data->>'patientName', ''), v_patient_name)),
           updated_at = now()
     where clinic_id = p_clinic_id and data->>'patientId' = p_patient_id;
  end if;

  delete from public.patients where clinic_id = p_clinic_id and id = p_patient_id;
end;
$$;

revoke execute on function public.delete_patient(text, text, text) from public, anon;
grant execute on function public.delete_patient(text, text, text) to authenticated;

-- 5.6 remove_queue_visit
create or replace function public.remove_queue_visit(
  p_clinic_id text,
  p_visit_id text
)
returns void
language plpgsql
security definer
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

  select data into v_visit from public.visits where clinic_id = p_clinic_id and id = p_visit_id for update;
  if v_visit is null then return; end if;

  if coalesce(v_visit->>'status', '') = 'COMPLETED' then
    raise exception 'Completed visit cannot be removed from waiting queue';
  end if;

  v_appointment_id := nullif(v_visit->>'appointmentId', '');

  delete from public.payments
   where clinic_id = p_clinic_id
     and (data->>'visitId' = p_visit_id or data->>'invoiceId' in (select id from public.invoices where clinic_id = p_clinic_id and data->>'visitId' = p_visit_id));
  delete from public.invoices where clinic_id = p_clinic_id and data->>'visitId' = p_visit_id;
  delete from public.visits where clinic_id = p_clinic_id and id = p_visit_id;

  if v_appointment_id is not null then
    update public.appointments
       set data = data || jsonb_build_object('status', 'CANCELLED'),
           updated_at = now()
     where clinic_id = p_clinic_id and id = v_appointment_id;
  end if;
end;
$$;

revoke execute on function public.remove_queue_visit(text, text) from public, anon;
grant execute on function public.remove_queue_visit(text, text) to authenticated;

-- 5.7 add_transaction
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

  if p_patient_id is not null and btrim(p_patient_id) <> '' and p_patient_data is not null then
    insert into public.patients (clinic_id, id, data)
    values (p_clinic_id, p_patient_id, p_patient_data - 'clinic_id')
    on conflict (clinic_id, id) do nothing;
  end if;

  insert into public.invoices (clinic_id, id, data)
  values (p_clinic_id, p_invoice_id, p_invoice_data - 'clinic_id')
  on conflict (clinic_id, id) do update set data = excluded.data - 'clinic_id', updated_at = now();

  if p_payment_id is not null and btrim(p_payment_id) <> '' and p_payment_data is not null then
    insert into public.payments (clinic_id, id, data)
    values (p_clinic_id, p_payment_id, p_payment_data - 'clinic_id')
    on conflict (clinic_id, id) do update set data = excluded.data - 'clinic_id', updated_at = now();
  end if;
end;
$$;

revoke execute on function public.add_transaction(
  text, text, text, jsonb, text, jsonb, text, jsonb
) from public, anon;
grant execute on function public.add_transaction(
  text, text, text, jsonb, text, jsonb, text, jsonb
) to authenticated;

-- 5.8 delete_transaction
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

  delete from public.payments
   where clinic_id = p_clinic_id
     and (id = coalesce(p_payment_id, '') or id = coalesce(p_tx_id, '') or data->>'invoiceId' = coalesce(p_invoice_id, ''));
  delete from public.invoices
   where clinic_id = p_clinic_id
     and (id = coalesce(p_invoice_id, '') or id = coalesce(p_tx_id, ''));
  delete from public.transactions
   where clinic_id = p_clinic_id
     and (id = coalesce(p_tx_id, '') or id = coalesce(p_payment_id, '') or id = coalesce(p_invoice_id, ''));
end;
$$;

revoke execute on function public.delete_transaction(text, text, text, text) from public, anon;
grant execute on function public.delete_transaction(text, text, text, text) to authenticated;

-- 5.9 admin_delete_clinic_user
create or replace function public.admin_delete_clinic_user(
  p_clinic_id text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;
  if not (
    public.has_clinic_permission(p_clinic_id, 'users.manage', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'system-settings', 'delete')
  ) then
    raise exception 'Unauthorized: caller lacks users.manage permission';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own active account';
  end if;

  select exists(select 1 from public.clinic_members where clinic_id = p_clinic_id and user_id = p_user_id) into v_exists;
  if not v_exists then
    raise exception 'User is not a member of this clinic';
  end if;

  delete from public.clinic_members where clinic_id = p_clinic_id and user_id = p_user_id;
  if not exists (select 1 from public.clinic_members where user_id = p_user_id) then
    delete from public.usernames where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.admin_delete_clinic_user(text, uuid) from public, anon;
grant execute on function public.admin_delete_clinic_user(text, uuid) to authenticated;

-- 5.10 audit_events Table, RLS, Immutability Trigger & append_audit_log RPC
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id text not null references public.clinics(id) on delete cascade,
  actor_uid uuid not null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists audit_events_clinic_created_idx
  on public.audit_events (clinic_id, created_at desc);

create index if not exists audit_events_rate_limit_idx
  on public.audit_events (clinic_id, actor_uid, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "audit_events_select" on public.audit_events;
drop policy if exists "audit_events_insert" on public.audit_events;
drop policy if exists "audit_events_update" on public.audit_events;
drop policy if exists "audit_events_delete" on public.audit_events;

create policy "audit_events_select" on public.audit_events for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'audit.view', 'view')
      or public.has_clinic_permission(clinic_id, 'users.manage', 'view')
      or public.has_clinic_permission(clinic_id, 'users.manage', 'update')
    )
  );

revoke insert, update, delete on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;

create or replace function public.prevent_audit_events_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Security violation: audit_events table is append-only (UPDATE and DELETE are strictly prohibited)';
end;
$$;

drop trigger if exists trg_audit_events_immutable on public.audit_events;
create trigger trg_audit_events_immutable
  before update or delete on public.audit_events
  for each row
  execute function public.prevent_audit_events_mutation();

create or replace function public.append_audit_log(
  p_clinic_id text,
  p_entry jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_uid uuid;
  v_action text;
  v_entity_type text;
  v_entity_id text;
  v_raw_details jsonb;
  v_details jsonb := '{}'::jsonb;
  v_now timestamptz;
  v_recent_count integer;
  v_inserted_id uuid;
  v_key text;
  v_val jsonb;
  v_allowed_actions constant text[] := array[
    'patient.create',
    'patient.update',
    'patient.delete',
    'visit.create',
    'visit.complete',
    'visit.delete',
    'appointment.create',
    'appointment.update',
    'appointment.delete',
    'appointment.checkin',
    'invoice.create',
    'invoice.update',
    'invoice.delete',
    'payment.create',
    'payment.update',
    'payment.delete',
    'expense.create',
    'expense.update',
    'expense.delete',
    'user.create',
    'user.update',
    'user.delete',
    'user.permissions.update',
    'user.password.reset',
    'UPDATE_USER_PERMISSIONS',
    'settings.update',
    'backup.export',
    'backup.restore',
    'backup.restore.rollback',
    'system.clear_all_data',
    'system.clear_all_data.failed',
    'data.purge',
    'demo.generate_data'
  ];
  v_known_detail_keys constant text[] := array[
    'summary',
    'status',
    'permissionUsed',
    'affectedTables',
    'recordCounts',
    'metadata',
    'changedFields',
    'mode',
    'patientId',
    'totalDeleted',
    'deletedCounts',
    'olderThan',
    'scope',
    'succeededTables',
    'failedTables',
    'preservedTables',
    'restoredCounts',
    'totalRestored',
    'backupExportedAt',
    'backupAppVersion',
    'patientsCount',
    'visitsCount',
    'error',
    'touchedTables',
    'rev',
    'note',
    'message',
    'reason',
    'field',
    'oldValue',
    'newValue',
    'count'
  ];
begin
  v_actor_uid := auth.uid();
  if v_actor_uid is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then
    raise exception 'Invalid input: p_entry must be a JSON object';
  end if;

  if octet_length(p_entry::text) > 8192 then
    raise exception 'Payload too large: audit log entry exceeds maximum allowed size of 8KB (8192 bytes)';
  end if;

  v_action := btrim(coalesce(p_entry->>'action', ''));
  if v_action = '' or not (v_action = any(v_allowed_actions)) then
    raise exception 'Invalid audit action: "%" is not in the allowed actions whitelist', v_action;
  end if;

  v_entity_type := left(nullif(btrim(coalesce(p_entry->>'entity_type', p_entry->>'entityType', p_entry->>'targetType', '')), ''), 120);
  v_entity_id := left(nullif(btrim(coalesce(p_entry->>'entity_id', p_entry->>'entityId', p_entry->>'targetId', '')), ''), 255);

  if p_entry ? 'details' then
    if jsonb_typeof(p_entry->'details') = 'object' then
      v_raw_details := p_entry->'details';
      for v_key, v_val in select * from jsonb_each(v_raw_details) loop
        if v_key = any(v_known_detail_keys) then
          v_details := v_details || jsonb_build_object(v_key, v_val);
        end if;
      end loop;
    elsif jsonb_typeof(p_entry->'details') = 'string' then
      v_details := v_details || jsonb_build_object('message', p_entry->'details');
    end if;
  end if;

  for v_key in select unnest(v_known_detail_keys) loop
    if p_entry ? v_key and not (v_details ? v_key) then
      if v_key = 'metadata' and jsonb_typeof(p_entry->'metadata') = 'object' then
        v_details := v_details || jsonb_build_object(
          'metadata',
          (p_entry->'metadata') - 'actorName' - 'actorUid' - 'actor_uid' - 'actorUsername' - 'actorRole' - 'clinicId' - 'clinic_id'
        );
      elsif v_key <> 'metadata' then
        v_details := v_details || jsonb_build_object(v_key, p_entry->v_key);
      end if;
    end if;
  end loop;

  if octet_length(v_details::text) > 8192 then
    raise exception 'Payload too large: audit log details exceed maximum allowed size of 8KB (8192 bytes)';
  end if;

  v_now := clock_timestamp() + (
    coalesce(nullif(current_setting('soli.audit_clock_offset_minutes', true), '')::integer, 0) * interval '1 minute'
  );

  select count(*)::integer
    into v_recent_count
    from public.audit_events
   where clinic_id = p_clinic_id
     and actor_uid = v_actor_uid
     and created_at >= (v_now - interval '1 minute')
     and created_at <= (v_now + interval '1 second');

  if v_recent_count >= 60 then
    raise exception 'Rate limit exceeded: maximum 60 audit log entries per minute allowed per user in clinic %', p_clinic_id;
  end if;

  insert into public.audit_events (
    clinic_id,
    actor_uid,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  )
  values (
    p_clinic_id,
    v_actor_uid,
    v_action,
    v_entity_type,
    v_entity_id,
    v_details,
    v_now
  )
  returning id into v_inserted_id;

  return jsonb_build_object(
    'id', v_inserted_id,
    'clinic_id', p_clinic_id,
    'actor_uid', v_actor_uid,
    'action', v_action,
    'entity_type', v_entity_type,
    'entity_id', v_entity_id,
    'details', v_details,
    'created_at', v_now
  );
end;
$$;

create or replace function public.append_audit_log(
  p_clinic_id text,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.append_audit_log(
    p_clinic_id,
    jsonb_build_object(
      'action', p_action,
      'entity_type', p_entity_type,
      'entity_id', p_entity_id,
      'details', coalesce(p_details, '{}'::jsonb)
    )
  );
end;
$$;

revoke execute on function public.append_audit_log(text, jsonb) from public, anon;
grant execute on function public.append_audit_log(text, jsonb) to authenticated;

revoke execute on function public.append_audit_log(text, text, text, text, jsonb) from public, anon;
grant execute on function public.append_audit_log(text, text, text, text, jsonb) to authenticated;

-- 5.11 get_database_usage
drop function if exists public.get_database_usage(text) cascade;

create or replace function public.get_database_usage(
  p_clinic_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used_bytes bigint := 0;
  v_clinic_bytes bigint := 0;
  v_limit_bytes bigint := 524288000;
  v_custom_limit text;
  v_percent_used numeric := 0;
  v_row_counts jsonb := '{}'::jsonb;
  v_table_bytes jsonb := '{}'::jsonb;
  v_tables jsonb := '[]'::jsonb;
  v_tbl text;
  v_row_cnt bigint;
  v_tbl_bytes bigint;
  v_all_tables constant text[] := array[
    'patients',
    'appointments',
    'visits',
    'invoices',
    'payments',
    'transactions',
    'prescriptions',
    'lab_orders',
    'radiology_orders',
    'follow_ups',
    'medications',
    'lab_tests',
    'radiology_types',
    'diagnoses',
    'symptoms',
    'chronic_diseases',
    'services',
    'expenses',
    'expense_categories',
    'settings',
    'backups',
    'counters',
    'audit_events'
  ];
begin
  if auth.uid() is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'users.manage', 'view')
    or public.has_clinic_permission(p_clinic_id, 'users.manage', 'update')
    or public.has_clinic_permission(p_clinic_id, 'settings.view', 'view')
  ) then
    raise exception 'Unauthorized: caller lacks users.manage or settings.view permission in clinic %', p_clinic_id;
  end if;

  select pg_database_size(current_database())::bigint into v_used_bytes;

  select coalesce(
    data->>'limit_bytes',
    data->>'databaseLimitBytes'
  )
    into v_custom_limit
    from public.settings
   where clinic_id = p_clinic_id
     and id in ('database_quota', 'general')
     and (data ? 'limit_bytes' or data ? 'databaseLimitBytes')
   order by case when id = 'database_quota' then 0 else 1 end
   limit 1;

  if v_custom_limit is not null and v_custom_limit ~ '^[0-9]+$' then
    v_limit_bytes := greatest(v_custom_limit::bigint, 1048576);
  end if;

  foreach v_tbl in array v_all_tables loop
    execute format(
      'select count(*)::bigint, coalesce(sum(pg_column_size(t.*)), 0)::bigint from public.%I t where t.clinic_id = $1',
      v_tbl
    )
    into v_row_cnt, v_tbl_bytes
    using p_clinic_id;

    v_clinic_bytes := v_clinic_bytes + coalesce(v_tbl_bytes, 0);
    v_row_counts := v_row_counts || jsonb_build_object(v_tbl, coalesce(v_row_cnt, 0));
    v_table_bytes := v_table_bytes || jsonb_build_object(v_tbl, coalesce(v_tbl_bytes, 0));
    v_tables := v_tables || jsonb_build_array(
      jsonb_build_object(
        'table_name', v_tbl,
        'row_count', coalesce(v_row_cnt, 0),
        'bytes', coalesce(v_tbl_bytes, 0)
      )
    );
  end loop;

  select coalesce(
    jsonb_agg(elem order by (elem->>'bytes')::bigint desc, (elem->>'row_count')::bigint desc, elem->>'table_name' asc),
    '[]'::jsonb
  )
    into v_tables
    from jsonb_array_elements(v_tables) as elem;

  v_percent_used := round((v_used_bytes::numeric / v_limit_bytes::numeric) * 100.0, 2);

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'used_bytes', v_used_bytes,
    'clinic_bytes', v_clinic_bytes,
    'limit_bytes', v_limit_bytes,
    'remaining_bytes', greatest(v_limit_bytes - v_used_bytes, 0),
    'percent_used', v_percent_used,
    'row_counts', v_row_counts,
    'table_bytes', v_table_bytes,
    'tables', v_tables
  );
end;
$$;

revoke execute on function public.get_database_usage(text) from public, anon;
grant execute on function public.get_database_usage(text) to authenticated;

-- 5.12 extract_record_timestamp, preview_purge, and purge_old_data
drop function if exists public.extract_record_timestamp(jsonb, timestamptz) cascade;
drop function if exists public.preview_purge(text, timestamptz, text[]) cascade;
drop function if exists public.purge_old_data(text, timestamptz, text[], text) cascade;

create or replace function public.extract_record_timestamp(
  p_data jsonb,
  p_fallback timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  v_raw text;
  v_parsed timestamptz;
begin
  if p_data is not null and jsonb_typeof(p_data) = 'object' then
    v_raw := nullif(btrim(coalesce(
      p_data->>'completedAt',
      p_data->>'updatedAt',
      p_data->>'createdAt',
      p_data->>'dueDate',
      p_data->>'date',
      p_data->>'timestamp',
      ''
    )), '');
    if v_raw is not null then
      begin
        v_parsed := v_raw::timestamptz;
      exception when others then
        v_parsed := null;
      end;
    end if;
  end if;

  if v_parsed is not null and p_fallback is not null then
    return least(v_parsed, p_fallback);
  end if;

  return coalesce(v_parsed, p_fallback, now());
end;
$$;

create or replace function public.preview_purge(
  p_clinic_id text,
  p_older_than timestamptz,
  p_scope text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
  v_norm text;
  v_cnt bigint;
  v_total bigint := 0;
  v_counts jsonb := '{}'::jsonb;
  v_do_visits boolean := false;
  v_do_appointments boolean := false;
  v_do_lab boolean := false;
  v_do_radiology boolean := false;
  v_do_follow_ups boolean := false;
  v_do_backups boolean := false;
  v_do_invoices boolean := false;
  v_do_payments boolean := false;
begin
  if auth.uid() is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not public.has_clinic_permission(p_clinic_id, 'data.purge', 'delete') then
    raise exception 'Unauthorized: caller lacks data.purge permission in clinic %', p_clinic_id;
  end if;

  if p_older_than is null or p_older_than > (clock_timestamp() - interval '90 days') then
    raise exception 'Invalid cutoff date: p_older_than must be older than 90 days';
  end if;

  if p_scope is null or coalesce(array_length(p_scope, 1), 0) = 0 then
    raise exception 'Invalid input: p_scope cannot be empty';
  end if;

  foreach v_item in array p_scope loop
    v_norm := lower(btrim(coalesce(v_item, '')));
    case v_norm
      when 'visits', 'completed_visits' then
        v_do_visits := true;
      when 'appointments', 'finished_appointments' then
        v_do_appointments := true;
      when 'lab_orders', 'finished_lab_orders' then
        v_do_lab := true;
      when 'radiology_orders', 'finished_radiology_orders' then
        v_do_radiology := true;
      when 'lab_radiology_orders' then
        v_do_lab := true;
        v_do_radiology := true;
      when 'follow_ups', 'finished_follow_ups' then
        v_do_follow_ups := true;
      when 'backups', 'old_backups' then
        v_do_backups := true;
      when 'invoices' then
        v_do_invoices := true;
      when 'payments' then
        v_do_payments := true;
      when 'invoices_payments' then
        v_do_invoices := true;
        v_do_payments := true;
      else
        raise exception 'Forbidden or invalid purge scope "%": patients, settings, users, medical catalogs, and audit_events cannot be purged', v_item;
    end case;
  end loop;

  if (v_do_invoices or v_do_payments) and p_older_than > (clock_timestamp() - interval '5 years') then
    raise exception 'Financial retention policy: invoices and payments younger than 5 years cannot be purged';
  end if;

  if v_do_visits then
    select count(*)::bigint into v_cnt
      from public.visits
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'ARCHIVED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('visits', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_appointments then
    select count(*)::bigint into v_cnt
      from public.appointments
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'CANCELLED', 'NO_SHOW', 'DONE', 'FINISHED', 'CHECKED_IN', 'EXPIRED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('appointments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_lab then
    select count(*)::bigint into v_cnt
      from public.lab_orders
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('lab_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_radiology then
    select count(*)::bigint into v_cnt
      from public.radiology_orders
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('radiology_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_follow_ups then
    select count(*)::bigint into v_cnt
      from public.follow_ups
     where clinic_id = p_clinic_id
       and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'EXPIRED')
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('follow_ups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_backups then
    select count(*)::bigint into v_cnt
      from public.backups
     where clinic_id = p_clinic_id
       and public.extract_record_timestamp(data, created_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('backups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_invoices then
    select count(*)::bigint into v_cnt
      from public.invoices
     where clinic_id = p_clinic_id
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('invoices', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_payments then
    select count(*)::bigint into v_cnt
      from public.payments
     where clinic_id = p_clinic_id
       and public.extract_record_timestamp(data, updated_at) < p_older_than;
    v_counts := v_counts || jsonb_build_object('payments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'older_than', p_older_than,
    'counts', v_counts,
    'total_count', v_total
  );
end;
$$;

create or replace function public.purge_old_data(
  p_clinic_id text,
  p_older_than timestamptz,
  p_scope text[],
  p_confirm text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item text;
  v_norm text;
  v_cnt bigint;
  v_total bigint := 0;
  v_counts jsonb := '{}'::jsonb;
  v_do_visits boolean := false;
  v_do_appointments boolean := false;
  v_do_lab boolean := false;
  v_do_radiology boolean := false;
  v_do_follow_ups boolean := false;
  v_do_backups boolean := false;
  v_do_invoices boolean := false;
  v_do_payments boolean := false;
begin
  if auth.uid() is null or not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not public.has_clinic_permission(p_clinic_id, 'data.purge', 'delete') then
    raise exception 'Unauthorized: caller lacks data.purge permission in clinic %', p_clinic_id;
  end if;

  if btrim(coalesce(p_confirm, '')) <> 'احذف البيانات القديمة' then
    raise exception 'Invalid confirmation phrase: p_confirm must match "احذف البيانات القديمة"';
  end if;

  if p_older_than is null or p_older_than > (clock_timestamp() - interval '90 days') then
    raise exception 'Invalid cutoff date: p_older_than must be older than 90 days';
  end if;

  if p_scope is null or coalesce(array_length(p_scope, 1), 0) = 0 then
    raise exception 'Invalid input: p_scope cannot be empty';
  end if;

  foreach v_item in array p_scope loop
    v_norm := lower(btrim(coalesce(v_item, '')));
    case v_norm
      when 'visits', 'completed_visits' then
        v_do_visits := true;
      when 'appointments', 'finished_appointments' then
        v_do_appointments := true;
      when 'lab_orders', 'finished_lab_orders' then
        v_do_lab := true;
      when 'radiology_orders', 'finished_radiology_orders' then
        v_do_radiology := true;
      when 'lab_radiology_orders' then
        v_do_lab := true;
        v_do_radiology := true;
      when 'follow_ups', 'finished_follow_ups' then
        v_do_follow_ups := true;
      when 'backups', 'old_backups' then
        v_do_backups := true;
      when 'invoices' then
        v_do_invoices := true;
      when 'payments' then
        v_do_payments := true;
      when 'invoices_payments' then
        v_do_invoices := true;
        v_do_payments := true;
      else
        raise exception 'Forbidden or invalid purge scope "%": patients, settings, users, medical catalogs, and audit_events cannot be purged', v_item;
    end case;
  end loop;

  if (v_do_invoices or v_do_payments) and p_older_than > (clock_timestamp() - interval '5 years') then
    raise exception 'Financial retention policy: invoices and payments younger than 5 years cannot be purged';
  end if;

  if v_do_visits then
    with deleted as (
      delete from public.visits
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'ARCHIVED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('visits', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_appointments then
    with deleted as (
      delete from public.appointments
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'CANCELLED', 'NO_SHOW', 'DONE', 'FINISHED', 'CHECKED_IN', 'EXPIRED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('appointments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_lab then
    with deleted as (
      delete from public.lab_orders
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('lab_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_radiology then
    with deleted as (
      delete from public.radiology_orders
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'DELIVERED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('radiology_orders', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_follow_ups then
    with deleted as (
      delete from public.follow_ups
       where clinic_id = p_clinic_id
         and upper(coalesce(data->>'status', 'COMPLETED')) in ('COMPLETED', 'DONE', 'FINISHED', 'CANCELLED', 'EXPIRED')
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('follow_ups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_backups then
    with deleted as (
      delete from public.backups
       where clinic_id = p_clinic_id
         and public.extract_record_timestamp(data, created_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('backups', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_invoices then
    with deleted as (
      delete from public.invoices
       where clinic_id = p_clinic_id
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('invoices', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  if v_do_payments then
    with deleted as (
      delete from public.payments
       where clinic_id = p_clinic_id
         and public.extract_record_timestamp(data, updated_at) < p_older_than
      returning 1
    )
    select count(*)::bigint into v_cnt from deleted;
    v_counts := v_counts || jsonb_build_object('payments', v_cnt);
    v_total := v_total + v_cnt;
  end if;

  perform public.append_audit_log(
    p_clinic_id,
    jsonb_build_object(
      'action', 'data.purge',
      'entity_type', 'clinic_data',
      'entity_id', p_clinic_id,
      'details', jsonb_build_object(
        'summary', format('حذف البيانات القديمة الأقدم من %s (إجمالي %s سجل)', to_char(p_older_than at time zone 'UTC', 'YYYY-MM-DD'), v_total),
        'status', 'SUCCESS',
        'permissionUsed', 'data.purge',
        'olderThan', to_char(p_older_than at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'scope', to_jsonb(p_scope),
        'deletedCounts', v_counts,
        'recordCounts', v_counts,
        'totalDeleted', v_total
      )
    )
  );

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'older_than', p_older_than,
    'deleted_counts', v_counts,
    'total_deleted', v_total
  );
end;
$$;

revoke execute on function public.preview_purge(text, timestamptz, text[]) from public, anon;
grant execute on function public.preview_purge(text, timestamptz, text[]) to authenticated;

revoke execute on function public.purge_old_data(text, timestamptz, text[], text) from public, anon;
grant execute on function public.purge_old_data(text, timestamptz, text[], text) to authenticated;

commit;

