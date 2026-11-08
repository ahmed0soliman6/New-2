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

  // Grant select on settings to anon for RLS testing
  await pg.exec(`
    reset role;
    grant select on public.settings to anon;
  `);

  // Authenticate as Doctor and save prescriptionSettings + clinicBranches ("ميت عزون", "طناح")
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${docUid}', false);
  `);

  const realBranches = [
    { id: 'b-mit-azzoun', name: 'ميت عزون', address: 'المنصورة - ميت عزون', phone: '01092847162', workingHours: 'السبت، الإثنين، الأربعاء 04:00 م - 10:00 م' },
    { id: 'b-tanah', name: 'طناح', address: 'المنصورة - طناح', phone: '01092847162', workingHours: 'الأحد، الثلاثاء، الخميس 05:00 م - 10:00 م' },
  ];

  await pg.query(
    `insert into public.settings (clinic_id, id, data)
     values ($1, 'prescriptionSettings', $2::jsonb)
     on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now()`,
    [
      clinicId,
      JSON.stringify({
        doctorName: 'د. أحمد سليمان',
        specialtyAr: 'استشاري الباطنة العامة والقلب',
        degreesAr: 'دكتوراه الباطنة والقلب',
        phone: '01092847162',
        branches: realBranches,
      }),
    ]
  );

  await pg.query(
    `insert into public.settings (clinic_id, id, data)
     values ($1, 'clinicBranches', $2::jsonb)
     on conflict (clinic_id, id) do update set data = excluded.data, updated_at = now()`,
    [clinicId, JSON.stringify({ branches: realBranches })]
  );

  // Switch to unauthenticated external visitor (anon)
  await pg.exec(`
    set role anon;
    select set_config('request.jwt.claim.sub', '', false);
  `);

  // 1) Anon visitor reads clinic config via get_public_booking_config RPC
  const publicCfgRes = await pg.query(`select public.get_public_booking_config($1) as cfg`, [clinicId]);
  const publicCfg = publicCfgRes.rows[0].cfg;
  assert.equal(publicCfg.prescriptionSettings.doctorName, 'د. أحمد سليمان', 'يظهر اسم الطبيب الحقيقي للزائر الخارجي');
  assert.equal(publicCfg.prescriptionSettings.branches.length, 2, 'تظهر الفروع الحقيقية للزائر الخارجي');
  assert.equal(publicCfg.prescriptionSettings.branches[0].name, 'ميت عزون');
  assert.equal(publicCfg.prescriptionSettings.branches[1].name, 'طناح');

  // 2) Anon visitor books first appointment via create_public_booking RPC
  const bookingRes1 = await pg.query(
    `select public.create_public_booking($1, $2, $3, $4::jsonb, $5::jsonb, $6) as res`,
    [
      clinicId,
      'app-pub-1',
      'pat-pub-1',
      JSON.stringify({ fullName: 'محمود السيد علي', phone: '01012345678' }),
      JSON.stringify({
        patientName: 'محمود السيد علي',
        phone: '01012345678',
        clinicLocationId: 'b-mit-azzoun',
        branch: 'ميت عزون',
        branchName: 'ميت عزون',
        scheduledDate: '2026-11-09',
        scheduledTime: '04:30 م',
        visitType: 'كشف جديد',
        expectedFee: 300,
      }),
      'fp-brave-visitor-1',
    ]
  );
  assert.equal(bookingRes1.rows[0].res.status, 'SCHEDULED', 'تم حفظ الحجز الإلكتروني الأول بنجاح');

  // 3) Duplicate booking on the same day (2026-11-09) for the same phone (01012345678) must be rejected
  await assert.rejects(
    async () => {
      await pg.query(
        `select public.create_public_booking($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [
          clinicId,
          'app-pub-dup',
          'pat-pub-dup',
          JSON.stringify({ fullName: 'محمود السيد علي', phone: '01012345678' }),
          JSON.stringify({
            patientName: 'محمود السيد علي',
            phone: '01012345678',
            clinicLocationId: 'b-mit-azzoun',
            branch: 'ميت عزون',
            scheduledDate: '2026-11-09',
            scheduledTime: '05:00 م',
            visitType: 'كشف جديد',
          }),
          'fp-brave-visitor-1',
        ]
      );
    },
    /DUPLICATE_BOOKING_SAME_DAY/,
    'يمنع تكرار الحجز لنفس رقم الهاتف في نفس اليوم'
  );

  // 4) Second booking on a different date from the same browser fingerprint succeeds (up to max 2/day)
  const bookingRes2 = await pg.query(
    `select public.create_public_booking($1, $2, $3, $4::jsonb, $5::jsonb, $6) as res`,
    [
      clinicId,
      'app-pub-2',
      'pat-pub-2',
      JSON.stringify({ fullName: 'محمود السيد علي', phone: '01012345678' }),
      JSON.stringify({
        patientName: 'محمود السيد علي',
        phone: '01012345678',
        clinicLocationId: 'b-tanah',
        branch: 'طناح',
        scheduledDate: '2026-11-10',
        scheduledTime: '06:00 م',
        visitType: 'استشارة / متابعة',
      }),
      'fp-brave-visitor-1',
    ]
  );
  assert.equal(bookingRes2.rows[0].res.status, 'SCHEDULED', 'يسمح بالحجز الثاني في يوم مختلف حتى حد 2 في اليوم');

  // 5) Third booking on the same day from the same phone or browser fingerprint is rejected (RATE_LIMIT_DAILY_MAX_2)
  await assert.rejects(
    async () => {
      await pg.query(
        `select public.create_public_booking($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [
          clinicId,
          'app-pub-3',
          'pat-pub-3',
          JSON.stringify({ fullName: 'زائر آخر نفس المتصفح', phone: '01099998888' }),
          JSON.stringify({
            patientName: 'زائر آخر نفس المتصفح',
            phone: '01099998888',
            clinicLocationId: 'b-mit-azzoun',
            branch: 'ميت عزون',
            scheduledDate: '2026-11-11',
            scheduledTime: '07:00 م',
            visitType: 'كشف جديد',
          }),
          'fp-brave-visitor-1',
        ]
      );
    },
    /RATE_LIMIT_DAILY_MAX_2/,
    'يرفض الحجز الثالث في نفس اليوم لنفس الهاتف أو المتصفح'
  );

  // 6) Anon visitor on existing deployed frontend calling create_appointment directly with Arabic digits succeeds
  await pg.query(
    `select public.create_appointment($1, $2, $3, $4::jsonb, $5, $6::jsonb)`,
    [
      clinicId,
      new Date().toISOString(),
      'app-pub-legacy-1',
      JSON.stringify({
        appointmentId: 'app-pub-legacy-1',
        patientName: 'سمير عبد الرحمن',
        phone: '٠١٠٥٥٥٥٤٤٤٤',
        branch: 'ميت عزون',
        scheduledDate: '2026-11-12',
        scheduledTime: '06:30 م',
        visitType: 'كشف جديد',
        status: 'SCHEDULED',
        createdBy: 'online_booking',
      }),
      'pat-pub-legacy-1',
      JSON.stringify({
        patientId: 'pat-pub-legacy-1',
        fullName: 'سمير عبد الرحمن',
        phone: '٠١٠٥٥٥٥٤٤٤٤',
        createdBy: 'online_booking',
      }),
    ]
  );

  // Verify the appointment was saved via create_appointment -> create_public_booking bridge
  await pg.exec(`
    set role authenticated;
    select set_config('request.jwt.claim.sub', '${secUid}', false);
  `);
  const legacyApptCheck = await pg.query(
    `select data from public.appointments where clinic_id = $1 and id = 'app-pub-legacy-1'`,
    [clinicId]
  );
  assert.equal(legacyApptCheck.rows.length, 1, 'تم حفظ الحجز القادم عبر create_appointment للزائر بنجاح');
  assert.equal(legacyApptCheck.rows[0].data.bookingStatus, 'حجز إلكتروني');

  // Switch back to anon and verify duplicate detection works across Arabic/ASCII numerals on the same day
  await pg.exec(`
    set role anon;
    select set_config('request.jwt.claim.sub', '', false);
  `);
  await assert.rejects(
    async () => {
      await pg.query(
        `select public.create_appointment($1, $2, $3, $4::jsonb, $5, $6::jsonb)`,
        [
          clinicId,
          new Date().toISOString(),
          'app-pub-legacy-dup',
          JSON.stringify({
            appointmentId: 'app-pub-legacy-dup',
            patientName: 'سمير عبد الرحمن',
            phone: '01055554444',
            branch: 'ميت عزون',
            scheduledDate: '2026-11-12',
            scheduledTime: '07:00 م',
            visitType: 'كشف جديد',
            status: 'SCHEDULED',
            createdBy: 'online_booking',
          }),
          'pat-pub-legacy-dup',
          JSON.stringify({
            patientId: 'pat-pub-legacy-dup',
            fullName: 'سمير عبد الرحمن',
            phone: '01055554444',
            createdBy: 'online_booking',
          }),
        ]
      );
    },
    /DUPLICATE_BOOKING_SAME_DAY/,
    'يكتشف تكرار رقم الهاتف في نفس اليوم حتى عند اختلاف الأرقام العربية والإنجليزية'
  );
});

// 4. Test Notification Badge and Alert History Deduplication
test('4. اختبار دمج الإشعارات ومنع احتساب التنبيه المكرر في العداد (Badge & Alert History Deduplication)', () => {
  // Simulating alert history update with deduplication
  function addAlertWithDeduplication(prevAlerts, alertItem) {
    let filtered = prevAlerts;
    if (alertItem.type === 'finish' && alertItem.patientId) {
      filtered = filtered.filter((a) => a.patientId !== alertItem.patientId);
    }
    filtered = filtered.filter((a) => {
      if (a.id === alertItem.id) return false;
      if (alertItem.patientId && a.patientId === alertItem.patientId && a.type === alertItem.type) return false;
      if (alertItem.visitId && a.visitId === alertItem.visitId && a.type === alertItem.type) return false;
      if (a.title === alertItem.title && a.message === alertItem.message) return false;
      return true;
    });
    return [alertItem, ...filtered].slice(0, 20);
  }

  let history = [];
  // 1. New visit alert arrives
  history = addAlertWithDeduplication(history, {
    id: 'new-v1',
    type: 'new_visit',
    patientId: 'p1',
    visitId: 'v1',
    title: 'زيارة جديدة',
    message: 'المريض أحمد',
    timestamp: '10:00 ص',
  });
  assert.equal(history.length, 1);

  // 2. Duplicate alert with slightly different ID arrives (should be merged/replaced, not added as a second row)
  history = addAlertWithDeduplication(history, {
    id: 'new-v1-broadcast',
    type: 'new_visit',
    patientId: 'p1',
    visitId: 'v1',
    title: 'زيارة جديدة',
    message: 'المريض أحمد',
    timestamp: '10:00 ص',
  });
  assert.equal(history.length, 1, 'التنبيه المكرر لنفس المريض والنوع لا يُضاف مرتين في السجل');

  // 3. Exam finish alert arrives for p1 -> should remove previous waiting/calling alert
  history = addAlertWithDeduplication(history, {
    id: 'finish-v1',
    type: 'finish',
    patientId: 'p1',
    visitId: 'v1',
    title: 'انتهاء الكشف',
    message: 'تم فحص المريض أحمد',
    timestamp: '10:15 ص',
  });
  assert.equal(history.length, 1);
  assert.equal(history[0].type, 'finish', 'إشعار انتهاء الكشف يستبدل ويحذف إشعار الانتظار لنفس المريض');

  // 4. Test Notification Badge Count calculation (prevent double counting queue items + alerts)
  const waitingQueue = [{ id: 'v2', patientId: 'p2', patientName: 'سارة' }];
  const recentAlerts = [
    { id: 'new-v2', type: 'new_visit', patientId: 'p2', title: 'زيارة جديدة', message: 'سارة' }, // In queue!
    { id: 'avail-1', type: 'call', title: 'الطبيب متاح', message: 'جاهز' }, // Standalone alert
  ];
  const urgentFollowUps = [];

  const seenKeys = new Set();
  let uniqueAlertsCount = 0;
  for (const a of recentAlerts) {
    const key = a.patientId ? `${a.type}:${a.patientId}` : (a.visitId ? `${a.type}:${a.visitId}` : a.id);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const isInQueue = a.patientId && waitingQueue.some((q) => q.patientId === a.patientId);
      if (!isInQueue) {
        uniqueAlertsCount++;
      }
    }
  }

  const totalActionCount = waitingQueue.length + uniqueAlertsCount + urgentFollowUps.length;
  // waitingQueue (1) + standalone alert (1) = 2, NOT 3 (the new_visit alert for p2 is not double counted!)
  assert.equal(totalActionCount, 2, 'العداد لا يحتسب المريض في الانتظار وإشعاره مرتين');
});

// 5. Test Realtime DELETE State Filter
test('5. اختبار تصفية السجل المحذوف لحظياً من الحالة المركزية (Realtime DELETE state removal)', () => {
  let patients = [
    { patientId: 'p100', fullName: 'مريض 1' },
    { patientId: 'p200', fullName: 'مريض 2' },
  ];

  function onTableDelete(table, deletedId) {
    if (table === 'patients') {
      patients = patients.filter((p) => p.patientId !== deletedId && p.id !== deletedId);
    }
  }

  onTableDelete('patients', 'p100');
  assert.equal(patients.length, 1, 'يتم حذف السجل فوراً من مصفوفة المرضى');
  assert.equal(patients[0].patientId, 'p200');
});
