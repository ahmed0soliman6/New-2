import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

// 1. Alert Deduplication Unit Tests
test('1. اختبار منع تكرار التنبيهات واحتفاظها لمدة 24 ساعة (Alert Deduplication)', async () => {
  const memoryStorage = new Map();
  const STORAGE_KEY = 'soli_seen_clinic_alerts_v1';
  const RETENTION_MS = 24 * 60 * 60 * 1000;

  function isAlertAlreadySeen(alertId) {
    if (!alertId) return false;
    const raw = memoryStorage.get(STORAGE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      const seenAt = parsed[alertId];
      if (typeof seenAt === 'number' && Date.now() - seenAt < RETENTION_MS) {
        return true;
      }
    } catch {}
    return false;
  }

  function markAlertAsSeen(alertId) {
    if (!alertId) return;
    const raw = memoryStorage.get(STORAGE_KEY);
    let store = {};
    if (raw) {
      try {
        store = JSON.parse(raw);
      } catch {}
    }
    const now = Date.now();
    for (const [k, t] of Object.entries(store)) {
      if (typeof t === 'number' && now - t >= RETENTION_MS) {
        delete store[k];
      }
    }
    store[alertId] = now;
    memoryStorage.set(STORAGE_KEY, JSON.stringify(store));
  }

  const alert1 = 'new-visit-101';
  assert.equal(isAlertAlreadySeen(alert1), false, 'تنبيه جديد يجب ألا يكون مسجلاً');

  markAlertAsSeen(alert1);
  assert.equal(isAlertAlreadySeen(alert1), true, 'بعد التسجيل يجب أن يكون مسجلاً');

  // Verify expired after 24h
  const raw = JSON.parse(memoryStorage.get(STORAGE_KEY));
  raw[alert1] = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
  memoryStorage.set(STORAGE_KEY, JSON.stringify(raw));
  assert.equal(isAlertAlreadySeen(alert1), false, 'بعد 24 ساعة يجب أن ينتهي التنبيه ويعتبر غير مسجل');
});

// 2. Initial Page Load Alert Suppression Test
test('2. اختبار تجاهل التنبيهات القديمة عند تحميل الصفحة لأول مرة (Initial Load Filter)', () => {
  const now = Date.now();
  const visits = [
    { visitId: 'old-1', status: 'WAITING', createdAt: new Date(now - 400_000).toISOString() }, // 6.6 min ago (> 5m)
    { visitId: 'old-2', status: 'COMPLETED', createdAt: new Date(now - 100_000).toISOString() }, // Completed
    { visitId: 'fresh-1', status: 'WAITING', createdAt: new Date(now - 60_000).toISOString() }, // 1 min ago (<= 5m)
  ];

  const triggeredAlerts = [];
  const seenAlerts = new Set();

  visits.forEach((v) => {
    const visitTs = v.createdAt ? new Date(v.createdAt).getTime() : 0;
    const isFresh = visitTs > 0 && now - visitTs <= 300_000;
    const alertId = `new-${v.visitId}`;

    if (isFresh && v.status === 'WAITING' && !seenAlerts.has(alertId)) {
      triggeredAlerts.push(alertId);
      seenAlerts.add(alertId);
    } else {
      seenAlerts.add(alertId);
    }
  });

  assert.deepEqual(triggeredAlerts, ['new-fresh-1'], 'فقط الزيارة الحديثة في قائمة الانتظار خلال 5 دقائق تُصدر تنبيهاً');
  assert.equal(seenAlerts.has('new-old-1'), true, 'الزيارات القديمة تُسجل كمرئية لمنع ظهورها لاحقاً');
});

// 3. Real PostgreSQL (PGlite) test for Secretary Appointment creation and Doctor Break
test('3. اختبار PostgreSQL الفعلي (PGlite): صلاحيات السكرتير لإنشاء المواعيد وتحديث حالة الاستراحة والتطهير السحابي', async () => {
  const pg = new PGlite();
  
  await pg.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
      end if;
    end $$;

    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text
    );

    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $fn$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $fn$;

    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to public, anon, authenticated;
  `);

  const fullSetupSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/full_setup.sql'), 'utf8');
  await pg.exec(fullSetupSql);

  const migrationSql = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/migrations/20261107_fix_custom_permissions_rls.sql'),
    'utf8'
  );
  await pg.exec(migrationSql);

  // Grant table-level permissions to authenticated so RLS policies can be tested
  await pg.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    revoke insert, update, delete on public.audit_events from anon, authenticated;
  `);

  const clinicId = 'clinic_test';
  const adminUid = '00000000-0000-0000-0000-000000000001';
  const secUid = '00000000-0000-0000-0000-000000000002';
  const docUid = '00000000-0000-0000-0000-000000000003';

  // Seed clinic
  await pg.query(`insert into public.clinics (id, name) values ($1, 'عيادة الاختبار') on conflict (id) do nothing`, [clinicId]);

  // Seed auth users (as superuser)
  await pg.query(`
    insert into auth.users (id, email) values 
      ($1, 'admin@example.com'),
      ($2, 'sec@example.com'),
      ($3, 'doc@example.com')
    on conflict (id) do nothing
  `, [adminUid, secUid, docUid]);

  // Seed admin member
  await pg.query(`
    insert into public.clinic_members (clinic_id, user_id, role, is_active)
    values ($1, $2, 'admin', true)
    on conflict (clinic_id, user_id) do nothing
  `, [clinicId, adminUid]);

  // Seed secretary member
  await pg.query(`
    insert into public.clinic_members (clinic_id, user_id, role, is_active, permissions)
    values ($1, $2, 'secretary', true, '{"customPermissions": {"appointments-scheduling": {"create": true, "view": true, "update": true}}}'::jsonb)
    on conflict (clinic_id, user_id) do nothing
  `, [clinicId, secUid]);

  // Seed doctor member
  await pg.query(`
    insert into public.clinic_members (clinic_id, user_id, role, is_active)
    values ($1, $2, 'doctor', true)
    on conflict (clinic_id, user_id) do nothing
  `, [clinicId, docUid]);

  // Authenticate as secretary
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${secUid}', false);
  `);

  // Verify has_clinic_permission for secretary
  const permRes = await pg.query(
    `select public.has_clinic_permission($1, 'appointments.create', 'create') as allowed`,
    [clinicId]
  );
  assert.equal(permRes.rows[0].allowed, true, 'السكرتير يملك صلاحية appointments.create');

  // Secretary creates appointment via create_appointment RPC
  const apptId = 'appt_sec_101';
  const patientId = 'pat_sec_101';
  await pg.query(`
    select public.create_appointment(
      $1,
      $2,
      $3,
      $4::jsonb,
      $5,
      $6::jsonb
    )
  `, [
    clinicId,
    new Date().toISOString(),
    apptId,
    JSON.stringify({ appointmentId: apptId, patientName: 'مريض تجريبي', status: 'BOOKED' }),
    patientId,
    JSON.stringify({ patientId, fullName: 'مريض تجريبي', phone: '01000000000' })
  ]);

  // Verify appointment and patient exist
  const apptRow = await pg.query(`select data from public.appointments where clinic_id = $1 and id = $2`, [clinicId, apptId]);
  assert.equal(apptRow.rows.length, 1, 'تم حفظ الموعد في جدول appointments');
  assert.equal(apptRow.rows[0].data.patientName, 'مريض تجريبي');

  const patRow = await pg.query(`select data from public.patients where clinic_id = $1 and id = $2`, [clinicId, patientId]);
  assert.equal(patRow.rows.length, 1, 'تم حفظ المريض في جدول patients');

  // Authenticate as doctor
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${docUid}', false);
  `);

  // Doctor updates break status in settings
  await pg.query(`
    insert into public.settings (clinic_id, id, data)
    values ($1, 'clinic_status', '{"status": "break", "updatedBy": "د. أحمد"}'::jsonb)
    on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now()
  `, [clinicId]);

  // Switch to admin user
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${adminUid}', false);
  `);

  // Admin executes clear_all_data simulation and updates _database_generation
  const newGen = 'gen-' + Date.now();
  await pg.query(`
    insert into public.settings (clinic_id, id, data)
    values ($1, '_database_generation', jsonb_build_object('generation', $2::text, 'timestamp', now()))
    on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now()
  `, [clinicId, newGen]);

  const genRow = await pg.query(`select data from public.settings where clinic_id = $1 and id = '_database_generation'`, [clinicId]);
  assert.equal(genRow.rows[0].data.generation, newGen, 'تم تحديث _database_generation لمزامنة الحذف السحابي بين كافة الأجهزة');
});
