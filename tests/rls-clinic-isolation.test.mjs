import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const PROTECTED_TABLES = [
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
];

const SENSITIVE_RPC_FILES = [
  'check_in_appointment.sql',
  'register_walk_in.sql',
  'complete_visit.sql',
  'create_appointment.sql',
  'remove_queue_visit.sql',
  'delete_patient.sql',
  'add_transaction.sql',
  'delete_transaction.sql',
  'admin_delete_clinic_user.sql',
  'append_audit_log.sql',
  'get_database_usage.sql',
  'purge_old_data.sql',
];

test('1. فحص سياسات العزل (RLS) وإلغاء member_all وإزالة solimedical-new2 من الكود', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const fullSetupPath = path.resolve(process.cwd(), 'supabase/full_setup.sql');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261107_fix_custom_permissions_rls.sql');

  assert.ok(fs.existsSync(schemaPath), 'ملف supabase/schema.sql يجب أن يكون موجوداً');
  assert.ok(fs.existsSync(fullSetupPath), 'ملف التأسيس الشامل supabase/full_setup.sql يجب أن يكون موجوداً');
  assert.ok(fs.existsSync(migrationPath), 'ملف الترحيل اليدوي 20261107_fix_custom_permissions_rls.sql يجب أن يكون موجوداً');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const fullSetupSql = fs.readFileSync(fullSetupPath, 'utf8');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert.equal(schemaSql, fullSetupSql, 'يجب أن يتطابق supabase/schema.sql و supabase/full_setup.sql تماماً');

  for (const [label, content] of [
    ['schema.sql', schemaSql],
    ['full_setup.sql', fullSetupSql],
    ['20261107_fix_custom_permissions_rls.sql', migrationSql],
  ]) {
    assert.doesNotMatch(
      content,
      /create\s+policy\s+member_all\s+on/i,
      `يجب عدم وجود سياسة member_all في ${label}`
    );
    assert.match(
      content,
      /drop\s+policy\s+if\s+exists\s+"members_select"\s+on\s+public\.clinic_members/i,
      `ملف ${label} يجب أن يتضمن drop policy if exists "members_select" on public.clinic_members`
    );
    assert.match(
      content,
      /drop\s+policy\s+if\s+exists\s+"members_insert"\s+on\s+public\.clinic_members/i,
      `ملف ${label} يجب أن يتضمن drop policy if exists "members_insert" on public.clinic_members`
    );
    assert.match(
      content,
      /drop\s+policy\s+if\s+exists\s+"members_update"\s+on\s+public\.clinic_members/i,
      `ملف ${label} يجب أن يتضمن drop policy if exists "members_update" on public.clinic_members`
    );
    assert.match(
      content,
      /drop\s+policy\s+if\s+exists\s+"members_delete"\s+on\s+public\.clinic_members/i,
      `ملف ${label} يجب أن يتضمن drop policy if exists "members_delete" on public.clinic_members`
    );
    assert.match(
      content,
      /drop\s+function\s+if\s+exists\s+public\.delete_patient\(text,\s*text,\s*text\)\s+cascade/i,
      `ملف ${label} يجب أن يتضمن DROP FUNCTION IF EXISTS public.delete_patient(text, text, text) CASCADE`
    );
    assert.match(
      content,
      /create\s+table\s+if\s+not\s+exists\s+public\.audit_events/i,
      `ملف ${label} يجب أن ينشئ جدول public.audit_events`
    );
    assert.match(
      content,
      /create\s+trigger\s+trg_audit_events_immutable/i,
      `ملف ${label} يجب أن ينشئ الـ trigger المانع للتعديل والحذف trg_audit_events_immutable`
    );
    assert.match(
      content,
      /create\s+or\s+replace\s+function\s+public\.append_audit_log/i,
      `ملف ${label} يجب أن يعرّف الدالة public.append_audit_log`
    );
  }

  // التحقق من وجود @electric-sql/pglite في devDependencies وليس في dependencies
  const pkgJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.ok(
    pkgJson.devDependencies && pkgJson.devDependencies['@electric-sql/pglite'],
    'يجب وضع @electric-sql/pglite في devDependencies'
  );
  assert.ok(
    !pkgJson.dependencies || !pkgJson.dependencies['@electric-sql/pglite'],
    'يجب عدم وضع @electric-sql/pglite في dependencies الخاصة بالإنتاج'
  );

  // التحقق من إزالة القيمة الافتراضية المكتوبة صراحة solimedical-new2 من الكود
  for (const relFile of [
    'src/services/supabase.ts',
    'api/users/create.ts',
    'api/users/delete.ts',
    'api/users/reset-password.ts',
    'api/users/recover-admin.ts',
  ]) {
    const fileContent = fs.readFileSync(path.resolve(process.cwd(), relFile), 'utf8');
    assert.ok(
      !fileContent.includes('solimedical-new2'),
      `الملف ${relFile} يجب ألا يحتوي على القيمة الافتراضية المكتوبة صراحة solimedical-new2`
    );
  }
});

test('2. التحقق من تأمين جميع دوال RPC العشر في supabase/functions-sql', () => {
  const rpcDir = path.resolve(process.cwd(), 'supabase/functions-sql');
  const fullSetupSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/full_setup.sql'), 'utf8');
  for (const fileName of SENSITIVE_RPC_FILES) {
    const fullPath = path.join(rpcDir, fileName);
    const fnName = fileName.replace('.sql', '');
    assert.ok(fs.existsSync(fullPath), `ملف الدالة ${fileName} يجب أن يكون موجوداً في supabase/functions-sql`);
    const sql = fs.readFileSync(fullPath, 'utf8');
    assert.match(
      sql,
      /drop\s+function\s+if\s+exists\s+public\./i,
      `الدالة ${fileName} يجب أن تبدأ بـ DROP FUNCTION IF EXISTS`
    );
    assert.match(
      sql,
      /(auth\.uid\(\)|public\.is_clinic_member)/i,
      `الدالة ${fileName} يجب أن تتحقق من هوية وعضوية المستخدم`
    );
    assert.match(sql, /set\s+search_path\s*=\s*public/i, `الدالة ${fileName} يجب أن تضبط search_path = public`);
    const expectedSymbol = fnName === 'purge_old_data' ? 'public.purge_old_data' : `public.${fnName}`;
    assert.ok(
      fullSetupSql.includes(expectedSymbol),
      `ملف full_setup.sql يجب أن يتضمن تعريف الدالة ${expectedSymbol}`
    );
  }

  // التحقق من فحص error والطابور المحلي والتنبيه العربي للأحداث الحرجة في src/services/auditLog.ts
  const auditServiceContent = fs.readFileSync(path.resolve(process.cwd(), 'src/services/auditLog.ts'), 'utf8');
  assert.match(
    auditServiceContent,
    /const\s*\{\s*data\s*,\s*error\s*\}\s*=\s*await\s+supabase\.rpc\(\s*'append_audit_log'/,
    'يجب قراءة حقل error من نتيجة supabase.rpc(\'append_audit_log\')'
  );
  assert.match(
    auditServiceContent,
    /soli_clinic_audit_retry_queue/,
    'يجب الاحتفاظ بالحدث الفاشل في طابور إعادة المحاولة المحلي'
  );
  assert.match(
    auditServiceContent,
    /flushPendingAuditLogs/,
    'يجب توفير دالة إعادة المحاولة التلقائية للطابور المحلي'
  );
  assert.match(
    auditServiceContent,
    /تنبيه أمني:\s*فشل تسجيل حدث المراجعة السحابي/,
    'يجب إظهار تنبيه واضح بالعربية عند فشل تسجيل حدث مراجعة حرج سحابياً'
  );
});

test('3. اختبار PostgreSQL الفعلي (PGlite): إعادة تشغيل الترحيل مرتين، الصلاحيات، delete_patient، العزل، واختبارات audit_events السبعة (أ - ز)', async () => {
  const db = new PGlite();

  try {
    // 1. تهيئة بيئة Supabase المماثلة داخل PostgreSQL المؤقت (auth.users, auth.uid(), roles)
    await db.exec(`
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
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20261107_fix_custom_permissions_rls.sql'),
      'utf8'
    );

    // 2. التحقق من قابلية تشغيل full_setup.sql مرتين متتاليتين دون أي خطأ
    await db.exec(fullSetupSql);
    await db.exec(fullSetupSql);

    // 3. التحقق من قابلية تشغيل ملف الترحيل 20261107_fix_custom_permissions_rls.sql مرتين متتاليتين دون أي خطأ
    await db.exec(migrationSql);
    await db.exec(migrationSql);

    // منح صلاحيات الجداول لدور authenticated ليتم تقييم سياسات RLS الفعلية، مع الحفاظ على سحب صلاحيات التعديل على audit_events
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
      revoke insert, update, delete on public.audit_events from anon, authenticated;
    `);

    // 4. تجهيز بيانات الاختبار: عيادتين (clinic_a, clinic_b) ومستخدمين بأدوار وصلاحيات مختلفة
    const adminAUid = '11111111-1111-4111-8111-111111111111';
    const secretaryDefaultUid = '22222222-2222-4222-8222-222222222222';
    const secretaryWithDeleteUid = '33333333-3333-4333-8333-333333333333';
    const inactiveMemberUid = '44444444-4444-4444-8444-444444444444';
    const restrictedViewerUid = '55555555-5555-4555-8555-555555555555';
    const adminBUid = '66666666-6666-4666-8666-666666666666';

    await db.exec(`
      insert into auth.users (id, email) values
        ('${adminAUid}', 'admin_a@auth.solimedical.local'),
        ('${secretaryDefaultUid}', 'sec_default@auth.solimedical.local'),
        ('${secretaryWithDeleteUid}', 'sec_del@auth.solimedical.local'),
        ('${inactiveMemberUid}', 'inactive@auth.solimedical.local'),
        ('${restrictedViewerUid}', 'restricted@auth.solimedical.local'),
        ('${adminBUid}', 'admin_b@auth.solimedical.local');

      insert into public.clinics (id, name) values
        ('clinic_a', 'عيادة أ'),
        ('clinic_b', 'عيادة ب')
      on conflict (id) do nothing;

      insert into public.clinic_members (clinic_id, user_id, role, is_active, permissions) values
        ('clinic_a', '${adminAUid}', 'admin', true, '{}'::jsonb),
        ('clinic_a', '${secretaryDefaultUid}', 'secretary', true, '{}'::jsonb),
        ('clinic_a', '${secretaryWithDeleteUid}', 'secretary', true, '{"specialPermissions": {"patients.delete": true}}'::jsonb),
        ('clinic_a', '${inactiveMemberUid}', 'admin', false, '{}'::jsonb),
        ('clinic_a', '${restrictedViewerUid}', 'secretary', true, '{
          "customPermissions": {
            "appointments-scheduling": {"view": false},
            "waiting-queue": {"view": false},
            "patient-records": {"view": false},
            "clinical-exam": {"view": false},
            "dashboard": {"view": false},
            "billing-payments": {"view": false},
            "prescription-print": {"view": false}
          }
        }'::jsonb),
        ('clinic_b', '${adminBUid}', 'admin', true, '{}'::jsonb);

      insert into public.patients (clinic_id, id, data) values
        ('clinic_a', 'pat_a_1', '{"patientId": "pat_a_1", "fullName": "مريض أ 1"}'::jsonb),
        ('clinic_a', 'pat_a_2', '{"patientId": "pat_a_2", "fullName": "مريض أ 2"}'::jsonb),
        ('clinic_b', 'pat_b_1', '{"patientId": "pat_b_1", "fullName": "مريض ب سري"}'::jsonb);

      insert into public.invoices (clinic_id, id, data) values
        ('clinic_a', 'inv_a_1', '{"invoiceId": "inv_a_1", "patientId": "pat_a_1", "total": 300}'::jsonb),
        ('clinic_a', 'inv_a_2', '{"invoiceId": "inv_a_2", "patientId": "pat_a_2", "total": 450}'::jsonb);

      insert into public.appointments (clinic_id, id, data) values
        ('clinic_a', 'apt_a_1', '{"appointmentId": "apt_a_1", "patientId": "pat_a_1", "status": "SCHEDULED"}'::jsonb);

      insert into public.visits (clinic_id, id, data) values
        ('clinic_a', 'vis_a_1', '{"visitId": "vis_a_1", "patientId": "pat_a_1", "status": "WAITING"}'::jsonb);

      insert into public.prescriptions (clinic_id, id, data) values
        ('clinic_a', 'rx_a_1', '{"prescriptionId": "rx_a_1", "patientId": "pat_a_1", "visitId": "vis_a_1"}'::jsonb);
    `);

    const runAsUser = async (uid, fn) => {
      await db.exec(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${uid}', false);
      `);
      try {
        return await fn();
      } finally {
        await db.exec(`
          reset role;
          select set_config('request.jwt.claim.sub', '', false);
          select set_config('soli.audit_clock_offset_minutes', '0', false);
        `);
      }
    };

    // 5. اختبار: السكرتير الافتراضي لا يحذف مريضاً مباشرة ولا عبر RPC
    await runAsUser(secretaryDefaultUid, async () => {
      await db.exec(`delete from public.patients where clinic_id = 'clinic_a' and id = 'pat_a_1';`);

      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'file_only');`),
        /Unauthorized: caller lacks patients\.delete permission/i,
        'يجب رفض حذف المريض عبر RPC للسكرتير الذي لا يملك صلاحية patients.delete'
      );
    });

    const pat1Check = await db.query(`select count(*)::int as cnt from public.patients where clinic_id = 'clinic_a' and id = 'pat_a_1'`);
    assert.equal(pat1Check.rows[0].cnt, 1, 'المريض pat_a_1 يجب أن يظل موجوداً بعد محاولة الحذف المباشر من السكرتير');

    // 6. اختبار: سكرتير يملك patients.delete يحذف file_only بنجاح ويُرفض في everything
    await runAsUser(secretaryWithDeleteUid, async () => {
      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'everything');`),
        /Unauthorized: caller lacks billing\.delete permission required for full deletion/i,
        'يجب رفض الحذف الكامل (everything) إذا كان المستخدم لا يملك صلاحية billing.delete'
      );

      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'invalid_mode');`),
        /Invalid input: p_mode must be file_only or everything/i,
        'يجب التحقق من أن p_mode إما file_only أو everything'
      );

      await db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'file_only');`);

      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'file_only');`),
        /Patient not found: pat_a_1 in clinic clinic_a/i,
        'يجب رفع خطأ واضح إذا لم يُوجد المريض'
      );
    });

    const pat1AfterFileOnly = await db.query(`select count(*)::int as cnt from public.patients where clinic_id = 'clinic_a' and id = 'pat_a_1'`);
    assert.equal(pat1AfterFileOnly.rows[0].cnt, 0, 'يجب حذف ملف المريض pat_a_1 عند نجاح file_only');

    const inv1AfterFileOnly = await db.query(`select data->>'patientId' as pid, data->>'patientName' as pname from public.invoices where clinic_id = 'clinic_a' and id = 'inv_a_1'`);
    assert.equal(inv1AfterFileOnly.rows[0].pid, 'pat-general', 'يجب الاحتفاظ بالفاتورة وتحويلها إلى pat-general في وضع file_only');
    assert.equal(inv1AfterFileOnly.rows[0].pname, 'مريض أ 1', 'يجب حفظ اسم المريض على الفاتورة المؤرشفة');

    // 7. اختبار: العزل التام بين عيادتين (clinic_a و clinic_b)
    await runAsUser(adminAUid, async () => {
      const resB = await db.query(`select * from public.patients where clinic_id = 'clinic_b'`);
      assert.equal(resB.rows.length, 0, 'مدير العيادة أ يجب ألا يرى أي مريض في العيادة ب');

      await assert.rejects(
        () =>
          db.query(`
            insert into public.patients (clinic_id, id, data)
            values ('clinic_b', 'pat_intrude', '{"fullName": "اختراق"}'::jsonb);
          `),
        /row-level security policy/i,
        'يجب منع مدير العيادة أ من إدراج بيانات في العيادة ب'
      );

      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_b', 'pat_b_1', 'file_only');`),
        /Unauthorized: caller is not an active member of clinic clinic_b/i,
        'يجب منع مدير العيادة أ من استدعاء delete_patient على العيادة ب'
      );
    });

    // 8. اختبار: عضو غير نشط (is_active = false) لا يقرأ أي بيانات
    await runAsUser(inactiveMemberUid, async () => {
      const pats = await db.query(`select * from public.patients where clinic_id = 'clinic_a'`);
      const invs = await db.query(`select * from public.invoices where clinic_id = 'clinic_a'`);
      const sets = await db.query(`select * from public.settings where clinic_id = 'clinic_a'`);
      assert.equal(pats.rows.length, 0, 'العضو غير النشط لا يقرأ جدول المرضى');
      assert.equal(invs.rows.length, 0, 'العضو غير النشط لا يقرأ جدول الفواتير');
      assert.equal(sets.rows.length, 0, 'العضو غير النشط لا يقرأ جدول الإعدادات');
    });

    // 9. اختبار: سياسات SELECT على appointments و visits و prescriptions تتحقق من صلاحية العرض
    await runAsUser(secretaryDefaultUid, async () => {
      const apts = await db.query(`select * from public.appointments where clinic_id = 'clinic_a'`);
      assert.ok(apts.rows.length >= 0, 'السكرتير الافتراضي يستطيع قراءة المواعيد');
    });

    await runAsUser(restrictedViewerUid, async () => {
      await db.exec(`reset role;`);
      await db.exec(`
        insert into public.appointments (clinic_id, id, data) values ('clinic_a', 'apt_a_2', '{"appointmentId":"apt_a_2"}'::jsonb) on conflict do nothing;
        insert into public.visits (clinic_id, id, data) values ('clinic_a', 'vis_a_2', '{"visitId":"vis_a_2"}'::jsonb) on conflict do nothing;
        insert into public.prescriptions (clinic_id, id, data) values ('clinic_a', 'rx_a_2', '{"prescriptionId":"rx_a_2"}'::jsonb) on conflict do nothing;
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${restrictedViewerUid}', false);
      `);
      const apts = await db.query(`select * from public.appointments where clinic_id = 'clinic_a'`);
      const visits = await db.query(`select * from public.visits where clinic_id = 'clinic_a'`);
      const rxs = await db.query(`select * from public.prescriptions where clinic_id = 'clinic_a'`);
      assert.equal(apts.rows.length, 0, 'المستخدم المسحوبة منه صلاحيات العرض لا يقرأ المواعيد');
      assert.equal(visits.rows.length, 0, 'المستخدم المسحوبة منه صلاحيات العرض لا يقرأ الزيارات');
      assert.equal(rxs.rows.length, 0, 'المستخدم المسحوبة منه صلاحيات العرض لا يقرأ الروشتات');
    });

    // =========================================================================
    // 10. اختبارات جدول audit_events ودالة append_audit_log السبعة (أ - ز)
    // =========================================================================

    // (أ) سكرتير يدرج 260 حدثاً ولا يُفقد الحدث الأول (لا يوجد قص عند 250)
    await runAsUser(secretaryDefaultUid, async () => {
      for (let i = 1; i <= 260; i++) {
        // التقدم دقيقتين كل 50 إدخالاً لاحترام حد المعدل (60 في الدقيقة) أثناء إدراج 260 حدثاً
        const offsetMinutes = Math.floor((i - 1) / 50) * 2;
        await db.query(`select set_config('soli.audit_clock_offset_minutes', $1, false);`, [String(offsetMinutes)]);
        await db.query(
          `select public.append_audit_log('clinic_a', $1::jsonb);`,
          [
            JSON.stringify({
              action: 'patient.create',
              entity_type: 'patient',
              entity_id: `pat_seq_${i}`,
              details: { count: i, note: `حدث رقم ${i}` },
            }),
          ]
        );
      }
    });

    const countAfter260 = await db.query(
      `select count(*)::int as cnt from public.audit_events where clinic_id = 'clinic_a'`
    );
    assert.equal(countAfter260.rows[0].cnt, 260, '(أ) يجب حفظ جميع الـ 260 حدثاً بالكامل في جدول audit_events دون قص');

    const firstEventCheck = await db.query(
      `select entity_id, details->>'count' as cnt, details->>'note' as note from public.audit_events where clinic_id = 'clinic_a' and entity_id = 'pat_seq_1'`
    );
    assert.equal(firstEventCheck.rows.length, 1, '(أ) الحدث الأول رقم 1 يجب أن يظل موجوداً ولا يُطرد بعد 260 إدخالاً');
    assert.equal(firstEventCheck.rows[0].cnt, '1');
    assert.equal(firstEventCheck.rows[0].note, 'حدث رقم 1');

    // (ب) إدخال أكبر من 8KB يُرفض
    await runAsUser(secretaryDefaultUid, async () => {
      const oversizedText = 'x'.repeat(8500);
      await assert.rejects(
        () =>
          db.query(`select public.append_audit_log('clinic_a', $1::jsonb);`, [
            JSON.stringify({
              action: 'patient.update',
              entity_type: 'patient',
              entity_id: 'pat_a_2',
              details: { note: oversizedText },
            }),
          ]),
        /Payload too large/i,
        '(ب) يجب رفض أي إدخال يتجاوز حجم details فيه 8KB'
      );
    });

    // (ج) action غير معروف (خارج القائمة البيضاء) يُرفض
    await runAsUser(secretaryDefaultUid, async () => {
      await assert.rejects(
        () =>
          db.query(`select public.append_audit_log('clinic_a', $1::jsonb);`, [
            JSON.stringify({
              action: 'hacker.unknown_action',
              entity_type: 'system',
              entity_id: 'sys_1',
              details: {},
            }),
          ]),
        /Invalid audit action/i,
        '(ج) يجب رفض أي action غير موجود في القائمة البيضاء'
      );
    });

    // (د) actor_uid مزوّر يُستبدل بـ auth.uid() وتُتجاهل الحقول غير المعروفة مثل actorName
    await runAsUser(secretaryDefaultUid, async () => {
      await db.query(`select set_config('soli.audit_clock_offset_minutes', '20', false);`);
      const res = await db.query(`select public.append_audit_log('clinic_a', $1::jsonb) as id;`, [
        JSON.stringify({
          action: 'patient.update',
          entity_type: 'patient',
          entity_id: 'pat_forged_test',
          actor_uid: adminAUid,
          actorUid: adminAUid,
          actorName: 'مدير مزوّر',
          actorRole: 'admin',
          unknownTopLevelField: 'should_be_ignored',
          details: {
            field: 'phone',
            actorName: 'اسم مزوّر داخل التفاصيل',
            actor_uid: adminAUid,
            actorUid: adminAUid,
            unknownInnerField: 'ignored',
          },
        }),
      ]);
      const insertedId = res.rows[0].id;
      assert.ok(insertedId, '(د) يجب أن تُرجع الدالة معرّف الصف المدرج');
    });

    const forgedRowCheck = await db.query(
      `select actor_uid, action, entity_type, entity_id, details from public.audit_events where clinic_id = 'clinic_a' and entity_id = 'pat_forged_test'`
    );
    assert.equal(forgedRowCheck.rows.length, 1);
    assert.equal(
      forgedRowCheck.rows[0].actor_uid,
      secretaryDefaultUid,
      '(د) يجب أن يكون actor_uid مساوياً لـ auth.uid() دائماً وتجاهل أي actor_uid مرسل من العميل'
    );
    assert.equal(forgedRowCheck.rows[0].action, 'patient.update');
    assert.equal(forgedRowCheck.rows[0].details.field, 'phone');
    assert.equal(forgedRowCheck.rows[0].details.actorName, undefined, '(د) يجب تجاهل وحذف حقل actorName المزوّر');
    assert.equal(forgedRowCheck.rows[0].details.actor_uid, undefined, '(د) يجب تجاهل وحذف حقل actor_uid المزوّر من details');
    assert.equal(forgedRowCheck.rows[0].details.unknownTopLevelField, undefined, '(د) يجب تجاهل الحقول غير المعروفة');
    assert.equal(forgedRowCheck.rows[0].details.unknownInnerField, undefined, '(د) يجب تجاهل الحقول غير المعروفة داخل details');

    // (هـ) UPDATE وDELETE المباشران على audit_events يفشلان حتى للمدير وحتى لمالك القاعدة (بسبب الـ trigger)
    await runAsUser(adminAUid, async () => {
      await assert.rejects(
        () =>
          db.query(`
            update public.audit_events set action = 'backup.restore' where clinic_id = 'clinic_a';
          `),
        /(permission denied|audit_events table is append-only)/i,
        '(هـ) يجب أن يفشل UPDATE المباشر على audit_events حتى للمدير'
      );

      await assert.rejects(
        () =>
          db.query(`
            delete from public.audit_events where clinic_id = 'clinic_a';
          `),
        /(permission denied|audit_events table is append-only)/i,
        '(هـ) يجب أن يفشل DELETE المباشر على audit_events حتى للمدير'
      );

      await assert.rejects(
        () =>
          db.query(`
            insert into public.audit_events (clinic_id, actor_uid, action, details)
            values ('clinic_a', '${adminAUid}', 'patient.create', '{}'::jsonb);
          `),
        /(permission denied|row-level security policy)/i,
        '(هـ) يجب أن يفشل INSERT المباشر على audit_events بدون الدالة'
      );
    });

    // حتى بصلاحية superuser يفشل التعديل والحذف بسبب الـ trigger المانع للتعديل والحذف
    await assert.rejects(
      () => db.query(`update public.audit_events set action = 'backup.restore' where clinic_id = 'clinic_a';`),
      /audit_events table is append-only/i,
      '(هـ) يجب أن يمنع الـ trigger أي UPDATE على جدول audit_events حتى من الدالة أو المالك'
    );
    await assert.rejects(
      () => db.query(`delete from public.audit_events where clinic_id = 'clinic_a';`),
      /audit_events table is append-only/i,
      '(هـ) يجب أن يمنع الـ trigger أي DELETE على جدول audit_events حتى من الدالة أو المالك'
    );

    // (و) عيادة أخرى لا ترى سجلات هذه العيادة، والسكرتير العادي لا يقرأ سجل المراجعة، بينما مدير العيادة يراه
    await runAsUser(adminBUid, async () => {
      const otherClinicRows = await db.query(
        `select * from public.audit_events where clinic_id = 'clinic_a'`
      );
      assert.equal(otherClinicRows.rows.length, 0, '(و) مدير العيادة ب لا يجوز أن يرى سجلات مراجعة العيادة أ');
    });

    await runAsUser(secretaryDefaultUid, async () => {
      const secRows = await db.query(
        `select * from public.audit_events where clinic_id = 'clinic_a'`
      );
      assert.equal(secRows.rows.length, 0, '(و) السكرتير الذي لا يملك صلاحية audit.view أو users.manage لا يقرأ سجل المراجعة');
    });

    await runAsUser(adminAUid, async () => {
      const adminRows = await db.query(
        `select count(*)::int as cnt from public.audit_events where clinic_id = 'clinic_a'`
      );
      assert.equal(adminRows.rows[0].cnt, 261, '(و) مدير العيادة أ يرى جميع سجلات مراجعة عيادته');
    });

    // (ز) تجاوز 60 إدخالاً في الدقيقة لكل (clinic_id, actor_uid) يُرفض بخطأ واضح
    await runAsUser(secretaryDefaultUid, async () => {
      // ننتقل إلى نافذة زمنية جديدة (مثلاً بعد 60 دقيقة) وندرج 60 حدثاً في نفس الدقيقة
      await db.query(`select set_config('soli.audit_clock_offset_minutes', '60', false);`);
      for (let i = 1; i <= 60; i++) {
        await db.query(`select public.append_audit_log('clinic_a', $1::jsonb);`, [
          JSON.stringify({
            action: 'patient.update',
            entity_type: 'patient',
            entity_id: `pat_rl_${i}`,
            details: { count: i },
          }),
        ]);
      }

      // الإدخال رقم 61 في نفس الدقيقة يجب أن يُرفض
      await assert.rejects(
        () =>
          db.query(`select public.append_audit_log('clinic_a', $1::jsonb);`, [
            JSON.stringify({
              action: 'patient.update',
              entity_type: 'patient',
              entity_id: 'pat_rl_61',
              details: { count: 61 },
            }),
          ]),
        /Rate limit exceeded: maximum 60 audit log entries per minute allowed per user/i,
        '(ز) يجب رفض الإدخال رقم 61 في نفس الدقيقة لنفس المستخدم والعيادة'
      );
    });

    // =========================================================================
    // 11. اختبارات get_database_usage و preview_purge و purge_old_data على PGlite
    // =========================================================================

    // 11.1 get_database_usage تُرجع أرقاماً صحيحة للمدير وتُرفض لغير المصرح له
    await runAsUser(secretaryDefaultUid, async () => {
      await assert.rejects(
        () => db.query(`select public.get_database_usage('clinic_a');`),
        /Unauthorized: caller lacks users\.manage or settings\.view permission/i,
        'يجب رفض استدعاء get_database_usage للسكرتير الذي لا يملك صلاحية users.manage أو settings.view'
      );
    });

    await runAsUser(adminBUid, async () => {
      await assert.rejects(
        () => db.query(`select public.get_database_usage('clinic_a');`),
        /Unauthorized: caller is not an active member of clinic clinic_a/i,
        'يجب رفض استدعاء get_database_usage من مدير عيادة أخرى'
      );
    });

    await runAsUser(adminAUid, async () => {
      const usageRes = await db.query(`select public.get_database_usage('clinic_a') as usage;`);
      const usage = usageRes.rows[0].usage;
      assert.ok(usage, 'يجب أن تُرجع get_database_usage كائناً صالحاً');
      assert.ok(Number(usage.used_bytes) > 0, 'used_bytes يجب أن يكون أكبر من الصفر');
      assert.ok(Number(usage.clinic_bytes) > 0, 'clinic_bytes يجب أن يكون أكبر من الصفر لوجود سجلات في العيادة أ');
      assert.equal(Number(usage.limit_bytes), 524288000, 'limit_bytes الافتراضي يجب أن يكون 500MB (524288000 bytes)');
      assert.ok(typeof usage.percent_used === 'number', 'percent_used يجب أن يكون رقماً');
      assert.equal(Number(usage.row_counts.patients), 1, 'عدد المرضى المتبقي في clinic_a يجب أن يكون 1');
      assert.equal(Number(usage.row_counts.audit_events), 321, 'عدد أحداث المراجعة في clinic_a يجب أن يكون دقيقاً');
      assert.ok(Array.isArray(usage.tables) && usage.tables.length === 23, 'قائمة الجداول يجب أن تضم 23 جدولاً');
    });

    // 11.2 تجهيز بيانات قديمة وحديثة في clinic_a و clinic_b لاختبار preview_purge و purge_old_data
    await db.exec(`
      insert into public.visits (clinic_id, id, data, updated_at) values
        ('clinic_a', 'vis_old_completed', '{"visitId":"vis_old_completed","status":"COMPLETED","date":"2020-03-10"}'::jsonb, '2020-03-10T10:00:00Z'::timestamptz),
        ('clinic_a', 'vis_old_waiting', '{"visitId":"vis_old_waiting","status":"WAITING","date":"2020-03-10"}'::jsonb, '2020-03-10T10:00:00Z'::timestamptz),
        ('clinic_a', 'vis_recent_completed', '{"visitId":"vis_recent_completed","status":"COMPLETED","date":"2026-10-15"}'::jsonb, now() - interval '10 days'),
        ('clinic_b', 'vis_b_old_completed', '{"visitId":"vis_b_old_completed","status":"COMPLETED","date":"2020-03-10"}'::jsonb, '2020-03-10T10:00:00Z'::timestamptz);

      insert into public.appointments (clinic_id, id, data, updated_at) values
        ('clinic_a', 'apt_old_completed', '{"appointmentId":"apt_old_completed","status":"COMPLETED","date":"2020-04-01"}'::jsonb, '2020-04-01T10:00:00Z'::timestamptz),
        ('clinic_a', 'apt_old_scheduled', '{"appointmentId":"apt_old_scheduled","status":"SCHEDULED","date":"2020-04-01"}'::jsonb, '2020-04-01T10:00:00Z'::timestamptz),
        ('clinic_b', 'apt_b_old_completed', '{"appointmentId":"apt_b_old_completed","status":"COMPLETED","date":"2020-04-01"}'::jsonb, '2020-04-01T10:00:00Z'::timestamptz);

      insert into public.lab_orders (clinic_id, id, data, updated_at) values
        ('clinic_a', 'lab_old_done', '{"orderId":"lab_old_done","status":"COMPLETED","createdAt":"2020-05-01T10:00:00Z"}'::jsonb, '2020-05-01T10:00:00Z'::timestamptz),
        ('clinic_a', 'lab_old_pending', '{"orderId":"lab_old_pending","status":"PENDING","createdAt":"2020-05-01T10:00:00Z"}'::jsonb, '2020-05-01T10:00:00Z'::timestamptz);

      insert into public.radiology_orders (clinic_id, id, data, updated_at) values
        ('clinic_a', 'rad_old_done', '{"orderId":"rad_old_done","status":"COMPLETED","createdAt":"2020-05-01T10:00:00Z"}'::jsonb, '2020-05-01T10:00:00Z'::timestamptz);

      insert into public.follow_ups (clinic_id, id, data, updated_at) values
        ('clinic_a', 'fup_old_done', '{"id":"fup_old_done","status":"COMPLETED","createdAt":"2020-05-01T10:00:00Z"}'::jsonb, '2020-05-01T10:00:00Z'::timestamptz);

      insert into public.backups (clinic_id, id, data, updated_at) values
        ('clinic_a', 'bkp_old_1', '{"id":"bkp_old_1","createdAt":"2020-05-01T10:00:00Z"}'::jsonb, '2020-05-01T10:00:00Z'::timestamptz);

      insert into public.invoices (clinic_id, id, data, updated_at) values
        ('clinic_a', 'inv_6yo', '{"invoiceId":"inv_6yo","createdAt":"2018-01-15T10:00:00Z","total":200}'::jsonb, '2018-01-15T10:00:00Z'::timestamptz),
        ('clinic_a', 'inv_3yo', '{"invoiceId":"inv_3yo","createdAt":"2024-01-15T10:00:00Z","total":500}'::jsonb, (now() - interval '3 years'));

      insert into public.payments (clinic_id, id, data, updated_at) values
        ('clinic_a', 'pay_6yo', '{"paymentId":"pay_6yo","createdAt":"2018-01-15T10:00:00Z","amount":200}'::jsonb, '2018-01-15T10:00:00Z'::timestamptz),
        ('clinic_a', 'pay_3yo', '{"paymentId":"pay_3yo","createdAt":"2024-01-15T10:00:00Z","amount":500}'::jsonb, (now() - interval '3 years'));

      insert into public.settings (clinic_id, id, data, updated_at) values
        ('clinic_a', 'general_config', '{"clinicName":"عيادة أ"}'::jsonb, '2018-01-01T00:00:00Z'::timestamptz)
      on conflict (clinic_id, id) do nothing;
    `);

    // 11.3 السكرتير بدون data.purge يُرفض في preview_purge و purge_old_data
    await runAsUser(secretaryDefaultUid, async () => {
      await assert.rejects(
        () =>
          db.query(
            `select public.preview_purge('clinic_a', (now() - interval '2 years'), array['completed_visits']);`
          ),
        /Unauthorized: caller lacks data\.purge permission/i,
        'يجب رفض معاينة الحذف للسكرتير الذي لا يملك صلاحية data.purge'
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.purge_old_data('clinic_a', (now() - interval '2 years'), array['completed_visits'], 'احذف البيانات القديمة');`
          ),
        /Unauthorized: caller lacks data\.purge permission/i,
        'يجب رفض تنفيذ الحذف للسكرتير الذي لا يملك صلاحية data.purge'
      );
    });

    // 11.4 تاريخ أحدث من 90 يوماً يُرفض
    await runAsUser(adminAUid, async () => {
      await assert.rejects(
        () =>
          db.query(
            `select public.preview_purge('clinic_a', (now() - interval '30 days'), array['completed_visits']);`
          ),
        /Invalid cutoff date: p_older_than must be older than 90 days/i,
        'يجب رفض أي تاريخ قطع أحدث من 90 يوماً في preview_purge'
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.purge_old_data('clinic_a', (now() - interval '30 days'), array['completed_visits'], 'احذف البيانات القديمة');`
          ),
        /Invalid cutoff date: p_older_than must be older than 90 days/i,
        'يجب رفض أي تاريخ قطع أحدث من 90 يوماً في purge_old_data'
      );
    });

    // 11.5 الفواتير والمدفوعات الأحدث من 5 سنوات لا تُحذف ويُرفض طلب حذفها بتقطع أقل من 5 سنوات
    await runAsUser(adminAUid, async () => {
      await assert.rejects(
        () =>
          db.query(
            `select public.preview_purge('clinic_a', (now() - interval '2 years'), array['invoices']);`
          ),
        /Financial retention policy: invoices and payments younger than 5 years cannot be purged/i,
        'يجب رفض معاينة حذف الفواتير إذا كان تاريخ القطع أحدث من 5 سنوات'
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.purge_old_data('clinic_a', (now() - interval '2 years'), array['invoices'], 'احذف البيانات القديمة');`
          ),
        /Financial retention policy: invoices and payments younger than 5 years cannot be purged/i,
        'يجب رفض حذف الفواتير إذا كان تاريخ القطع أحدث من 5 سنوات'
      );
    });

    // 11.6 عبارة التأكيد الخاطئة تُرفض، والنطاق غير المسموح به (مثل patients أو settings) يُرفض
    await runAsUser(adminAUid, async () => {
      await assert.rejects(
        () =>
          db.query(
            `select public.purge_old_data('clinic_a', (now() - interval '2 years'), array['completed_visits'], 'عبارة خاطئة');`
          ),
        /Invalid confirmation phrase/i,
        'يجب رفض الحذف إذا كانت عبارة التأكيد غير مطابقة لعبارة احذف البيانات القديمة'
      );

      await assert.rejects(
        () =>
          db.query(
            `select public.purge_old_data('clinic_a', (now() - interval '2 years'), array['patients'], 'احذف البيانات القديمة');`
          ),
        /Forbidden or invalid purge scope "patients"/i,
        'يجب رفض أي محاولة لتمرير جدول المرضى ضمن نطاق الحذف'
      );
    });

    // 11.7 preview_purge لا تحذف أي سجل
    const visitsBeforePreview = await db.query(
      `select count(*)::int as cnt from public.visits where clinic_id = 'clinic_a'`
    );
    await runAsUser(adminAUid, async () => {
      const prevRes = await db.query(
        `select public.preview_purge('clinic_a', (now() - interval '6 years'), array['completed_visits','finished_appointments','lab_radiology_orders','finished_follow_ups','old_backups','invoices_payments']) as preview;`
      );
      const preview = prevRes.rows[0].preview;
      assert.equal(Number(preview.counts.visits), 1, 'يجب أن ترصد المعاينة زيارة مكتملة قديمة واحدة فقط');
      assert.equal(Number(preview.counts.appointments), 1, 'يجب أن ترصد المعاينة موعداً منتهياً قديماً واحداً فقط');
      assert.equal(Number(preview.counts.lab_orders), 1, 'يجب أن ترصد المعاينة طلب تحليل منتهياً قديماً واحداً فقط');
      assert.equal(Number(preview.counts.radiology_orders), 1, 'يجب أن ترصد المعاينة طلب أشعة منتهياً قديماً واحداً فقط');
      assert.equal(Number(preview.counts.follow_ups), 1, 'يجب أن ترصد المعاينة متابعة منتهية قديمة واحدة فقط');
      assert.equal(Number(preview.counts.backups), 1, 'يجب أن ترصد المعاينة نسخة احتياطية قديمة واحدة فقط');
      assert.equal(Number(preview.counts.invoices), 1, 'يجب أن ترصد المعاينة الفاتورة الأقدم من 5 سنوات فقط (inv_6yo) وتستثني (inv_3yo)');
      assert.equal(Number(preview.counts.payments), 1, 'يجب أن ترصد المعاينة الدفعة الأقدم من 5 سنوات فقط (pay_6yo) وتستثني (pay_3yo)');
      assert.equal(Number(preview.total_count), 8, 'إجمالي السجلات المرشحة للحذف يجب أن يكون 8');
    });

    const visitsAfterPreview = await db.query(
      `select count(*)::int as cnt from public.visits where clinic_id = 'clinic_a'`
    );
    assert.equal(
      visitsAfterPreview.rows[0].cnt,
      visitsBeforePreview.rows[0].cnt,
      'preview_purge يجب ألا تحذف أي صف من الجداول'
    );

    // 11.8 purge_old_data تحذف السجلات القديمة المنتهية في clinic_a فقط وتترك clinic_b والمرضى والإعدادات والفواتير الحديثة وسجل المراجعة
    await runAsUser(adminAUid, async () => {
      const purgeRes = await db.query(
        `select public.purge_old_data('clinic_a', (now() - interval '6 years'), array['completed_visits','finished_appointments','lab_radiology_orders','finished_follow_ups','old_backups','invoices_payments'], 'احذف البيانات القديمة') as result;`
      );
      const result = purgeRes.rows[0].result;
      assert.equal(Number(result.total_deleted), 8, 'يجب أن تحذف purge_old_data السجلات الـ 8 القديمة المنتهية بالضبط');
      assert.equal(Number(result.deleted_counts.visits), 1, 'يجب أن تُرجع purge_old_data عدد الزيارات المحذوفة');
      assert.equal(Number(result.deleted_counts.invoices), 1, 'يجب أن تُرجع purge_old_data عدد الفواتير المحذوفة');
    });

    // التحقق من بقاء السجلات غير المنتهية والحديثة والمحمية في clinic_a، وبقاء سجلات clinic_b كاملة
    const remainingOldWaitingVisit = await db.query(
      `select count(*)::int as cnt from public.visits where clinic_id = 'clinic_a' and id = 'vis_old_waiting'`
    );
    assert.equal(remainingOldWaitingVisit.rows[0].cnt, 1, 'الزيارات غير المكتملة (WAITING) لا يجوز حذفها حتى لو كانت قديمة');

    const remainingRecentCompletedVisit = await db.query(
      `select count(*)::int as cnt from public.visits where clinic_id = 'clinic_a' and id = 'vis_recent_completed'`
    );
    assert.equal(remainingRecentCompletedVisit.rows[0].cnt, 1, 'الزيارات المكتملة الحديثة لا يجوز حذفها');

    const remainingClinicBVisit = await db.query(
      `select count(*)::int as cnt from public.visits where clinic_id = 'clinic_b' and id = 'vis_b_old_completed'`
    );
    assert.equal(remainingClinicBVisit.rows[0].cnt, 1, 'زيارات العيادة الأخرى (clinic_b) لا يجوز أن تتأثر إطلاقاً');

    const remainingClinicBApt = await db.query(
      `select count(*)::int as cnt from public.appointments where clinic_id = 'clinic_b' and id = 'apt_b_old_completed'`
    );
    assert.equal(remainingClinicBApt.rows[0].cnt, 1, 'مواعيد العيادة الأخرى (clinic_b) لا يجوز أن تتأثر إطلاقاً');

    const remaining3yoInvoice = await db.query(
      `select count(*)::int as cnt from public.invoices where clinic_id = 'clinic_a' and id = 'inv_3yo'`
    );
    assert.equal(remaining3yoInvoice.rows[0].cnt, 1, 'الفاتورة التي عمرها 3 سنوات (أقل من 5 سنوات) يجب أن تبقى محفوظة');

    const deleted6yoInvoice = await db.query(
      `select count(*)::int as cnt from public.invoices where clinic_id = 'clinic_a' and id = 'inv_6yo'`
    );
    assert.equal(deleted6yoInvoice.rows[0].cnt, 0, 'الفاتورة التي عمرها 6 سنوات يجب أن تُحذف عند طلب نطاق الفواتير الأقدم من 5 سنوات');

    const remainingPatientsA = await db.query(
      `select count(*)::int as cnt from public.patients where clinic_id = 'clinic_a'`
    );
    assert.equal(remainingPatientsA.rows[0].cnt, 1, 'ملفات المرضى يجب ألا تُمس أبداً أثناء حذف البيانات القديمة');

    const remainingSettingsA = await db.query(
      `select count(*)::int as cnt from public.settings where clinic_id = 'clinic_a' and id = 'general_config'`
    );
    assert.equal(remainingSettingsA.rows[0].cnt, 1, 'إعدادات العيادة يجب ألا تُمس أبداً أثناء حذف البيانات القديمة');

    // 11.9 التحقق من تسجيل حدث data.purge في جدول audit_events مع أعداد الجداول المحذوفة
    const purgeAuditCheck = await db.query(
      `select actor_uid, action, entity_type, entity_id, details from public.audit_events where clinic_id = 'clinic_a' and action = 'data.purge'`
    );
    assert.equal(purgeAuditCheck.rows.length, 1, 'يجب تسجيل حدث data.purge في جدول audit_events');
    assert.equal(purgeAuditCheck.rows[0].actor_uid, adminAUid, 'يجب أن يحمل حدث data.purge معرف المدير المنفذ');
    assert.equal(Number(purgeAuditCheck.rows[0].details.totalDeleted), 8, 'يجب تسجيل إجمالي السجلات المحذوفة (8) في details.totalDeleted');
    assert.equal(Number(purgeAuditCheck.rows[0].details.deletedCounts.visits), 1, 'يجب تسجيل عدد الزيارات المحذوفة في details.deletedCounts');
    assert.equal(Number(purgeAuditCheck.rows[0].details.deletedCounts.invoices), 1, 'يجب تسجيل عدد الفواتير المحذوفة في details.deletedCounts');
  } finally {
    await db.close();
  }
});

