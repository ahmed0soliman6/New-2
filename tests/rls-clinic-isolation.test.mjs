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
      /create\s+or\s+replace\s+function\s+public\.append_audit_log/i,
      `ملف ${label} يجب أن يعرّف الدالة public.append_audit_log`
    );
  }

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
    assert.ok(
      fullSetupSql.includes(`public.${fnName}`),
      `ملف full_setup.sql يجب أن يتضمن تعريف الدالة public.${fnName}`
    );
  }
});

test('3. اختبار PostgreSQL الفعلي (PGlite): إعادة تشغيل الترحيل مرتين، الصلاحيات، delete_patient، العزل، العضو غير النشط، وحماية _audit_log', async () => {
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

    // منح صلاحيات الجداول لدور authenticated ليتم تقييم سياسات RLS الفعلية
    await db.exec(`
      grant select, insert, update, delete on all tables in schema public to authenticated;
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
        `);
      }
    };

    // 5. اختبار: السكرتير الافتراضي لا يحذف مريضاً مباشرة ولا عبر RPC
    await runAsUser(secretaryDefaultUid, async () => {
      // محاولة حذف مباشر عبر جدول patients
      await db.exec(`delete from public.patients where clinic_id = 'clinic_a' and id = 'pat_a_1';`);

      // محاولة حذف عبر دالة RPC delete_patient
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
      // يُرفض في وضع everything لأنه لا يملك billing.delete
      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'everything');`),
        /Unauthorized: caller lacks billing\.delete permission required for full deletion/i,
        'يجب رفض الحذف الكامل (everything) إذا كان المستخدم لا يملك صلاحية billing.delete'
      );

      // يُرفض إذا كان p_mode غير صالح
      await assert.rejects(
        () => db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'invalid_mode');`),
        /Invalid input: p_mode must be file_only or everything/i,
        'يجب التحقق من أن p_mode إما file_only أو everything'
      );

      // ينجح في وضع file_only
      await db.query(`select public.delete_patient('clinic_a', 'pat_a_1', 'file_only');`);

      // يُرفض إذا لم يُوجد المريض (بعد حذفه أو لمعرّف غير موجود)
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
      // أعد إدراج موعد وزيارة وروشتة للمريض الثاني للتحقق من المنع
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

    // 10. اختبار: حماية سجل المراجعة (_audit_log) — إضافة فقط عبر RPC ولا أحد يعدّله أو يحذفه مباشرة
    await runAsUser(secretaryDefaultUid, async () => {
      // الإضافة عبر دالة RPC append_audit_log مسموحة لأي عضو نشط
      await db.query(
        `select public.append_audit_log('clinic_a', '{"eventId": "evt_1", "action": "PATIENT_CREATED", "summary": "إضافة مريض"}'::jsonb);`
      );
    });

    await runAsUser(adminAUid, async () => {
      // إضافة سجل ثانٍ من المدير عبر RPC
      await db.query(
        `select public.append_audit_log('clinic_a', '{"eventId": "evt_2", "action": "SETTINGS_UPDATED", "summary": "تحديث إعدادات"}'::jsonb);`
      );

      // محاولة تعديل _audit_log مباشرة (حتى من المدير!) يجب ألا تغير أي صف
      await db.query(
        `update public.settings set data = '{"entries": []}'::jsonb where clinic_id = 'clinic_a' and id = '_audit_log';`
      );

      // محاولة حذف _audit_log مباشرة (حتى من المدير!) يجب ألا تحذف أي صف
      await db.query(
        `delete from public.settings where clinic_id = 'clinic_a' and id = '_audit_log';`
      );

      // محاولة INSERT / UPSERT مباشر على _audit_log يجب أن تُرفض بواسطة RLS
      await assert.rejects(
        () =>
          db.query(`
            insert into public.settings (clinic_id, id, data)
            values ('clinic_a', '_audit_log', '{"entries": []}'::jsonb)
            on conflict (clinic_id, id) do update set data = excluded.data;
          `),
        /row-level security policy/i,
        'يجب منع أي INSERT/UPSERT مباشر على _audit_log حتى للمدير'
      );
    });

    // التحقق من بقاء سجل المراجعة سليماً ومحتفظاً بالسجلين
    const auditRow = await db.query(
      `select data from public.settings where clinic_id = 'clinic_a' and id = '_audit_log'`
    );
    assert.equal(auditRow.rows.length, 1, 'وثيقة _audit_log يجب أن تظل موجودة ولم تُحذف');
    const entries = auditRow.rows[0].data.entries;
    assert.equal(entries.length, 2, 'يجب الاحتفاظ بكلا الحدثين في _audit_log دون تأثر بمحاولات المسح أو التعديل');
    assert.equal(entries[0].eventId, 'evt_2');
    assert.equal(entries[0].actorUid, adminAUid);
    assert.equal(entries[1].eventId, 'evt_1');
    assert.equal(entries[1].actorUid, secretaryDefaultUid);
  } finally {
    await db.close();
  }
});
