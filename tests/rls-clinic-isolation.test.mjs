import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const CLINIC_A_EMAIL = (process.env.TEST_CLINIC_A_EMAIL || '').trim();
const CLINIC_A_PASSWORD = (process.env.TEST_CLINIC_A_PASSWORD || '').trim();
const CLINIC_A_ID = (process.env.TEST_CLINIC_A_ID || 'clinic_a_test').trim();
const CLINIC_B_ID = (process.env.TEST_CLINIC_B_ID || 'clinic_b_test').trim();

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
];

test('1. فحص سياسات العزل (RLS) وإلغاء member_all في schema.sql و full_setup.sql وملف الترحيل', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  const fullSetupPath = path.resolve(process.cwd(), 'supabase/full_setup.sql');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261107_fix_custom_permissions_rls.sql');

  assert.ok(fs.existsSync(schemaPath), 'ملف supabase/schema.sql يجب أن يكون موجوداً');
  assert.ok(fs.existsSync(fullSetupPath), 'ملف التأسيس الشامل supabase/full_setup.sql يجب أن يكون موجوداً');
  assert.ok(fs.existsSync(migrationPath), 'ملف الترحيل اليدوي 20261107_fix_custom_permissions_rls.sql يجب أن يكون موجوداً');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const fullSetupSql = fs.readFileSync(fullSetupPath, 'utf8');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // التأكد من عدم وجود أي CREATE POLICY member_all FOR ALL
  assert.doesNotMatch(
    schemaSql,
    /create\s+policy\s+member_all\s+on/i,
    'يجب إزالة سياسة member_all (FOR ALL) تماماً من schema.sql'
  );
  assert.doesNotMatch(
    fullSetupSql,
    /create\s+policy\s+member_all\s+on/i,
    'يجب ألا ينشئ ملف full_setup.sql سياسة member_all عامة'
  );
  assert.doesNotMatch(
    migrationSql,
    /create\s+policy\s+member_all\s+on/i,
    'يجب ألا ينشئ ملف الترحيل سياسة member_all عامة'
  );

  // التأكد من وجود DROP FUNCTION IF EXISTS لمنع خطأ PostgreSQL 42P13
  for (const [label, content] of [
    ['schema.sql', schemaSql],
    ['full_setup.sql', fullSetupSql],
    ['20261107_fix_custom_permissions_rls.sql', migrationSql],
  ]) {
    assert.match(
      content,
      /drop\s+function\s+if\s+exists\s+public\.delete_patient\(text,\s*text,\s*text\)\s+cascade/i,
      `ملف ${label} يجب أن يتضمن DROP FUNCTION IF EXISTS public.delete_patient(text, text, text) CASCADE لمنع خطأ 42P13`
    );
  }

  // التأكد من تهيئة العيادة الافتراضية clinic_main في full_setup.sql و schema.sql
  assert.match(fullSetupSql, /'clinic_main'/i, 'ملف full_setup.sql يجب أن يهيئ العيادة الافتراضية clinic_main');
  assert.match(fullSetupSql, /supabase_realtime/i, 'ملف full_setup.sql يجب أن يضبط منشور supabase_realtime');

  // التأكد من تعريف دالة فحص الصلاحيات المخصصة على مستوى الصفوف
  assert.match(
    schemaSql,
    /create\s+or\s+replace\s+function\s+public\.has_clinic_permission/i,
    'يجب تعريف الدالة public.has_clinic_permission في schema.sql'
  );
  assert.match(
    fullSetupSql,
    /create\s+or\s+replace\s+function\s+public\.has_clinic_permission/i,
    'يجب تعريف الدالة public.has_clinic_permission في full_setup.sql'
  );
  assert.match(
    migrationSql,
    /create\s+or\s+replace\s+function\s+public\.has_clinic_permission/i,
    'يجب تعريف الدالة public.has_clinic_permission في ملف الترحيل'
  );

  // التأكد من وجود سياسات منفصلة SELECT / INSERT / UPDATE / DELETE لجميع الجداول
  for (const table of PROTECTED_TABLES) {
    assert.ok(
      schemaSql.includes(`'${table}'`) || schemaSql.includes(`public.${table}`),
      `الجدول ${table} يجب أن يكون مشمولاً بسياسات RLS المنفصلة في schema.sql`
    );
    assert.ok(
      fullSetupSql.includes(`'${table}'`) || fullSetupSql.includes(`public.${table}`),
      `الجدول ${table} يجب أن يكون مشمولاً بسياسات RLS المنفصلة في full_setup.sql`
    );
    assert.ok(
      migrationSql.includes(`'${table}'`) || migrationSql.includes(`public.${table}`),
      `الجدول ${table} يجب أن يكون مشمولاً بسياسات RLS المنفصلة في ملف الترحيل`
    );
  }
});

test('2. التحقق من تأمين جميع دوال RPC التسع الحساسة بالصلاحيات المخصصة و clinic_id و DROP FUNCTION', () => {
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
      `الدالة ${fileName} يجب أن تبدأ بـ DROP FUNCTION IF EXISTS لمنع خطأ 42P13`
    );
    assert.match(
      sql,
      /(auth\.uid\(\)|public\.is_clinic_member)/i,
      `الدالة ${fileName} يجب أن تتحقق من هوية وعضوية المستخدم`
    );
    assert.match(sql, /public\.has_clinic_permission/i, `الدالة ${fileName} يجب أن تتحقق من الصلاحيات عبر has_clinic_permission`);
    assert.match(sql, /set\s+search_path\s*=\s*public/i, `الدالة ${fileName} يجب أن تضبط search_path = public`);
    assert.ok(
      fullSetupSql.includes(`public.${fnName}`),
      `ملف full_setup.sql يجب أن يتضمن تعريف الدالة public.${fnName}`
    );
  }
});

test('3. اختبار عزل بيانات العيادة A عن العيادة B عبر Supabase (Live RLS Isolation)', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    t.skip('تم تخطي الاتصال الحي لعدم ضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في البيئة.');
    return;
  }

  if (SERVICE_ROLE_KEY) {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const stamp = Date.now();
    const clinicA = `rls_clinic_a_${stamp}`;
    const clinicB = `rls_clinic_b_${stamp}`;
    const emailA = `user_a_${stamp}@auth.solimedical.local`;
    const passwordA = `TestPass!${stamp}`;
    const secretPatientIdB = `pat-secret-b-${stamp}`;

    let userAId = null;

    try {
      await adminClient.from('clinics').upsert([
        { id: clinicA, name: 'Clinic A Test' },
        { id: clinicB, name: 'Clinic B Test' },
      ]);

      const { data: createdUser, error: createErr } = await adminClient.auth.admin.createUser({
        email: emailA,
        password: passwordA,
        email_confirm: true,
      });
      assert.ifError(createErr);
      userAId = createdUser.user.id;

      await adminClient.from('clinic_members').insert({
        clinic_id: clinicA,
        user_id: userAId,
        role: 'admin',
        is_active: true,
        permissions: { username: `user_a_${stamp}` },
      });

      const { error: seedErr } = await adminClient.from('patients').insert({
        clinic_id: clinicB,
        id: secretPatientIdB,
        data: { patientId: secretPatientIdB, fullName: 'مريض سري في عيادة B', phone: '00000000000' },
      });
      assert.ifError(seedErr);

      const userAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInErr } = await userAClient.auth.signInWithPassword({
        email: emailA,
        password: passwordA,
      });
      assert.ifError(signInErr);

      const { data: readB, error: readBErr } = await userAClient
        .from('patients')
        .select('id, clinic_id, data')
        .eq('clinic_id', clinicB);

      assert.ifError(readBErr);
      assert.equal((readB || []).length, 0, 'مستخدم العيادة A يجب ألا يرى أي سجل من سجلات العيادة B');

      const { error: insertBErr } = await userAClient.from('patients').insert({
        clinic_id: clinicB,
        id: `pat-intrude-${stamp}`,
        data: { fullName: 'محاولة اختراق' },
      });
      assert.ok(insertBErr, 'يجب أن ترفض قاعدة البيانات (RLS) إدخال بيانات في العيادة B من مستخدم العيادة A');

      const ownPatientId = `pat-own-a-${stamp}`;
      const { error: insertAErr } = await userAClient.from('patients').insert({
        clinic_id: clinicA,
        id: ownPatientId,
        data: { patientId: ownPatientId, fullName: 'مريض عيادة A' },
      });
      assert.ifError(insertAErr);

      const { data: readA, error: readAErr } = await userAClient
        .from('patients')
        .select('id')
        .eq('clinic_id', clinicA)
        .eq('id', ownPatientId);
      assert.ifError(readAErr);
      assert.equal((readA || []).length, 1, 'مستخدم العيادة A يجب أن يقرأ بيانات عيادته A بنجاح');
    } finally {
      await adminClient.from('patients').delete().in('clinic_id', [clinicA, clinicB]);
      await adminClient.from('clinic_members').delete().in('clinic_id', [clinicA, clinicB]);
      await adminClient.from('clinics').delete().in('id', [clinicA, clinicB]);
      if (userAId) {
        await adminClient.auth.admin.deleteUser(userAId);
      }
    }
    return;
  }

  if (!CLINIC_A_EMAIL || !CLINIC_A_PASSWORD) {
    t.skip('لتشغيل الاختبار الحي بدون SUPABASE_SERVICE_ROLE_KEY، مرر TEST_CLINIC_A_EMAIL و TEST_CLINIC_A_PASSWORD.');
    return;
  }

  const userAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: loginErr } = await userAClient.auth.signInWithPassword({
    email: CLINIC_A_EMAIL,
    password: CLINIC_A_PASSWORD,
  });
  assert.ifError(loginErr);

  for (const table of ['patients', 'visits', 'invoices', 'payments', 'appointments']) {
    const { data: rowsB, error: errB } = await userAClient
      .from(table)
      .select('id, clinic_id')
      .eq('clinic_id', CLINIC_B_ID);

    assert.ifError(errB);
    assert.equal(
      (rowsB || []).length,
      0,
      `مستخدم العيادة (${CLINIC_A_ID}) يجب ألا يقرأ أي صف من جدول ${table} للعيادة (${CLINIC_B_ID})`
    );
  }
});
