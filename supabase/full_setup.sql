-- =============================================================================
-- Soli Medical Clinic System v3.0.0 — Complete Master Database Setup
-- File: supabase/full_setup.sql
-- =============================================================================
-- متى تستخدم هذا الملف؟
-- 1. عند نقل المشروع إلى قاعدة بيانات أو حساب Supabase جديد بالكامل (تأسيس من الصفر).
-- 2. عند الرغبة في تحديث قاعدة بيانات حالية للتأكد من وجود جميع الجداول، الفهارس،
--    سياسات العزل والصلاحيات المخصصة (RLS)، دوال الـ RPC التسع، والبث اللحظي (Realtime)،
--    وتهيئة سجل العيادة الافتراضية (clinic_main).
--
-- طريقة التشغيل اليدوي:
-- افتح Supabase Dashboard -> SQL Editor -> New Query -> الصق محتوى هذا الملف بالكامل -> اضغط Run.
-- =============================================================================

begin;

-- =============================================================================
-- 1. الجداول التأسيسية للعيادات والأعضاء وأسماء المستخدمين (Core Multi-Clinic Tables)
-- =============================================================================

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

-- =============================================================================
-- 2. دوال التحقق من العضوية والصلاحيات المخصصة المرنة (Custom Permission Engine)
-- =============================================================================

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
    when 'audit.view' then v_screen_id := 'system-settings'; v_mapped_action := 'view'; v_special_key := 'audit.view';
    when 'backup.export' then v_screen_id := 'system-settings'; v_mapped_action := 'view'; v_special_key := 'backup.export';
    when 'backup.restore' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'backup.restore';
    when 'system.clear_all_data' then v_screen_id := 'system-settings'; v_mapped_action := 'delete'; v_special_key := 'system.clear_all_data';
    when 'demo.manage' then v_screen_id := 'system-settings'; v_mapped_action := 'update'; v_special_key := 'demo.manage';
    else
      null;
  end case;

  -- Priority 1: Explicit specialPermissions override
  if v_special is not null and jsonb_typeof(v_special) = 'object' then
    if v_special ? p_permission and jsonb_typeof(v_special->p_permission) = 'boolean' then
      return (v_special->>p_permission)::boolean;
    end if;
    if v_special ? v_special_key and jsonb_typeof(v_special->v_special_key) = 'boolean' then
      return (v_special->>v_special_key)::boolean;
    end if;
  end if;

  -- Priority 2: Explicit customPermissions screen matrix
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

  -- Priority 3: Legacy allowedScreens array
  if v_allowed is not null and jsonb_typeof(v_allowed) = 'array' then
    if not (v_allowed ? v_screen_id) then
      return false;
    end if;
  end if;

  -- Priority 4: Default Role Template Fallback
  if v_role = 'admin' then
    return true;
  elsif v_role = 'doctor' then
    if v_special_key in ('patients.delete', 'billing.delete', 'payments.delete', 'system.clear_all_data', 'backup.restore', 'users.manage', 'demo.manage', 'audit.view') then
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

-- =============================================================================
-- 3. إنشاء جميع جداول العيادة الـ 22 وتفعيل RLS وإزالة أي سياسة عامة قديمة
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

    -- Drop any existing policies on this table (including permissive member_all)
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
-- 4. سياسات العزل والصلاحيات المنفصلة لكل جدول (SELECT / INSERT / UPDATE / DELETE)
-- =============================================================================

-- 4.1 PATIENTS
create policy "patients_select" on public.patients for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'patients.view', 'view')
      or public.has_clinic_permission(clinic_id, 'patient-intake', 'view')
      or public.has_clinic_permission(clinic_id, 'waiting-queue', 'view')
      or public.has_clinic_permission(clinic_id, 'clinical-exam', 'view')
    )
  );
create policy "patients_insert" on public.patients for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'patients.create', 'create')
      or public.has_clinic_permission(clinic_id, 'patient-records', 'create')
    )
  );
create policy "patients_update" on public.patients for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'patients.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'patients.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "patients_delete" on public.patients for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

-- 4.2 APPOINTMENTS
create policy "appointments_select" on public.appointments for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'appointments.view', 'view')
      or public.has_clinic_permission(clinic_id, 'queue.view', 'view')
      or public.has_clinic_permission(clinic_id, 'patients.view', 'view')
      or public.has_clinic_permission(clinic_id, 'clinical.view', 'view')
      or public.has_clinic_permission(clinic_id, 'dashboard', 'view')
    )
  );
create policy "appointments_insert" on public.appointments for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and public.has_clinic_permission(clinic_id, 'appointments.create', 'create')
  );
create policy "appointments_update" on public.appointments for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
      or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
      or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
    )
  );
create policy "appointments_delete" on public.appointments for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'appointments.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

-- 4.3 VISITS
create policy "visits_select" on public.visits for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'queue.view', 'view')
      or public.has_clinic_permission(clinic_id, 'clinical.view', 'view')
      or public.has_clinic_permission(clinic_id, 'patients.view', 'view')
      or public.has_clinic_permission(clinic_id, 'billing.view', 'view')
      or public.has_clinic_permission(clinic_id, 'dashboard', 'view')
    )
  );
create policy "visits_insert" on public.visits for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'queue.create', 'create')
      or public.has_clinic_permission(clinic_id, 'patients.create', 'create')
      or public.has_clinic_permission(clinic_id, 'clinical.open', 'create')
    )
  );
create policy "visits_update" on public.visits for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'queue.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.open', 'create')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'queue.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.open', 'create')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "visits_delete" on public.visits for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'clinical.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

-- 4.4 PRESCRIPTIONS
create policy "prescriptions_select" on public.prescriptions for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'prescriptions.view', 'view')
      or public.has_clinic_permission(clinic_id, 'clinical.view', 'view')
      or public.has_clinic_permission(clinic_id, 'patients.view', 'view')
    )
  );
create policy "prescriptions_insert" on public.prescriptions for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'prescriptions.create', 'create')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "prescriptions_update" on public.prescriptions for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'prescriptions.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'prescriptions.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "prescriptions_delete" on public.prescriptions for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'prescriptions.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

-- 4.5 LAB_ORDERS & RADIOLOGY_ORDERS & FOLLOW_UPS
create policy "lab_orders_select" on public.lab_orders for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "lab_orders_insert" on public.lab_orders for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'lab.create', 'create')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "lab_orders_update" on public.lab_orders for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'lab.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'lab.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "lab_orders_delete" on public.lab_orders for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'lab.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

create policy "radiology_orders_select" on public.radiology_orders for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "radiology_orders_insert" on public.radiology_orders for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'radiology.create', 'create')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "radiology_orders_update" on public.radiology_orders for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'radiology.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'radiology.update', 'update')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
    )
  );
create policy "radiology_orders_delete" on public.radiology_orders for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'radiology.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

create policy "follow_ups_select" on public.follow_ups for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "follow_ups_insert" on public.follow_ups for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'appointments.create', 'create')
    )
  );
create policy "follow_ups_update" on public.follow_ups for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'appointments.update', 'update')
    )
  );
create policy "follow_ups_delete" on public.follow_ups for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'clinical.complete', 'update')
      or public.has_clinic_permission(clinic_id, 'appointments.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

-- 4.6 INVOICES, PAYMENTS, TRANSACTIONS
create policy "invoices_select" on public.invoices for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'billing.view', 'view')
      or public.has_clinic_permission(clinic_id, 'patient-intake', 'view')
      or public.has_clinic_permission(clinic_id, 'waiting-queue', 'view')
    )
  );
create policy "invoices_insert" on public.invoices for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'billing.create', 'create')
      or public.has_clinic_permission(clinic_id, 'patients.create', 'create')
      or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
    )
  );
create policy "invoices_update" on public.invoices for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'billing.update', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'billing.update', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    )
  );
create policy "invoices_delete" on public.invoices for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'billing.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'payments.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

create policy "payments_select" on public.payments for select to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'payments.view', 'view')
      or public.has_clinic_permission(clinic_id, 'patient-intake', 'view')
      or public.has_clinic_permission(clinic_id, 'waiting-queue', 'view')
    )
  );
create policy "payments_insert" on public.payments for insert to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'payments.create', 'create')
      or public.has_clinic_permission(clinic_id, 'patients.create', 'create')
      or public.has_clinic_permission(clinic_id, 'appointments.checkin', 'update')
    )
  );
create policy "payments_update" on public.payments for update to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'payments.update', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'payments.update', 'update')
      or public.has_clinic_permission(clinic_id, 'patients.delete', 'delete')
    )
  );
create policy "payments_delete" on public.payments for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'payments.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'billing.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'queue.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

create policy "transactions_select" on public.transactions for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.view', 'view'));
create policy "transactions_insert" on public.transactions for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.create', 'create'));
create policy "transactions_update" on public.transactions for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.update', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'billing.update', 'update'));
create policy "transactions_delete" on public.transactions for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'payments.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'billing.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

-- 4.7 EXPENSES & EXPENSE_CATEGORIES
create policy "expenses_select" on public.expenses for select to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.view', 'view'));
create policy "expenses_insert" on public.expenses for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.create', 'create'));
create policy "expenses_update" on public.expenses for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'));
create policy "expenses_delete" on public.expenses for delete to authenticated
  using (
    public.is_clinic_member(clinic_id)
    and (
      public.has_clinic_permission(clinic_id, 'expenses.delete', 'delete')
      or public.has_clinic_permission(clinic_id, 'system.clear_all_data', 'delete')
    )
  );

create policy "expense_categories_select" on public.expense_categories for select to authenticated
  using (public.is_clinic_member(clinic_id));
create policy "expense_categories_insert" on public.expense_categories for insert to authenticated
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.create', 'create'));
create policy "expense_categories_update" on public.expense_categories for update to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'))
  with check (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.update', 'update'));
create policy "expense_categories_delete" on public.expense_categories for delete to authenticated
  using (public.is_clinic_member(clinic_id) and public.has_clinic_permission(clinic_id, 'expenses.delete', 'delete'));

-- 4.8 MEDICAL CATALOGS
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

-- 4.9 SETTINGS, BACKUPS, COUNTERS
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

-- 4.10 CLINICS, CLINIC_MEMBERS, USERNAMES
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

-- =============================================================================
-- 5. دوال تحديث الطابع الزمني التلقائي (updated_at Triggers)
-- =============================================================================

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

-- =============================================================================
-- 6. دوال الـ RPC العشر المحصنة (Hardened Atomic RPCs — With DROP FUNCTION IF EXISTS)
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

-- 6.1 check_in_appointment
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

-- 6.2 register_walk_in
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

-- 6.3 complete_visit
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

-- 6.4 create_appointment
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

-- 6.5 delete_patient
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

-- 6.6 remove_queue_visit
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

-- 6.7 add_transaction
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

-- 6.8 delete_transaction
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

-- 6.9 admin_delete_clinic_user
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

-- 6.10 audit_events Table, RLS, Immutability Trigger & append_audit_log RPC
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

-- =============================================================================
-- 7. تفعيل البث اللحظي (Supabase Realtime Publication)
-- =============================================================================

do $$
declare
  rt text;
  realtime_tables text[] := array[
    'patients','appointments','visits','invoices','payments','transactions',
    'expenses','expense_categories','prescriptions','follow_ups','lab_orders',
    'radiology_orders','medications','lab_tests','radiology_types','diagnoses',
    'symptoms','chronic_diseases','services','settings','counters','clinic_members'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach rt in array realtime_tables loop
      if not exists (
        select 1
          from pg_publication_tables
         where pubname = 'supabase_realtime'
           and schemaname = 'public'
           and tablename = rt
      ) then
        execute format('alter publication supabase_realtime add table public.%I', rt);
      end if;
    end loop;
  end if;
end $$;

-- =============================================================================
-- 8. تهيئة العيادة الافتراضية والوثائق الأساسية (Default Clinic Seed — clinic_main)
-- =============================================================================

insert into public.clinics (id, name)
values ('clinic_main', 'عيادة سولي الطبية - Soli Medical Clinic')
on conflict (id) do nothing;

commit;
