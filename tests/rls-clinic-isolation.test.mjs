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
];

test('1. فحص سياسات العزل (RLS) في ملفات SQL لجميع جداول العيادات', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema.sql');
  assert.ok(fs.existsSync(schemaPath), 'ملف supabase/schema.sql يجب أن يكون موجوداً');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // التأكد من وجود دالة فحص عضوية العيادة
  assert.match(
    schemaSql,
    /create\s+or\s+replace\s+function\s+public\.is_clinic_member\s*\(\s*\w+\s+text\s*\)/i,
    'يجب تعريف الدالة is_clinic_member(cid text)'
  );

  // التأكد من تفعيل RLS على جدول المرضى وجميع الجداول الحساسة
  for (const table of PROTECTED_TABLES) {
    assert.ok(
      schemaSql.includes(`'${table}'`) || schemaSql.includes(`public.${table}`),
      `الجدول ${table} يجب أن يكون مشمولاً بسياسات RLS في schema.sql`
    );
  }
});

test('2. اختبار عزل بيانات العيادة A عن العيادة B عبر Supabase (Live RLS Isolation)', async (t) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    t.skip('تم تخطي الاتصال الحي لعدم ضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في البيئة.');
    return;
  }

  // الحالة الأولى: توفر SUPABASE_SERVICE_ROLE_KEY لإنشاء بيانات اختبارية مؤقتة في عيادتين وحذفها تلقائياً
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
      // 1. إنشاء العيادتين A و B
      await adminClient.from('clinics').upsert([
        { id: clinicA, name: 'Clinic A Test' },
        { id: clinicB, name: 'Clinic B Test' },
      ]);

      // 2. إنشاء مستخدم تابع للعيادة A فقط
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

      // 3. زرع بيانات خاصة بالعيادة B
      const { error: seedErr } = await adminClient.from('patients').insert({
        clinic_id: clinicB,
        id: secretPatientIdB,
        data: { patientId: secretPatientIdB, fullName: 'مريض سري في عيادة B', phone: '01000000000' },
      });
      assert.ifError(seedErr);

      // 4. تسجيل الدخول كمستخدم من العيادة A باستخدام المفتاح العام (Anon Key)
      const userAClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInErr } = await userAClient.auth.signInWithPassword({
        email: emailA,
        password: passwordA,
      });
      assert.ifError(signInErr);

      // أ) التحقق أن مستخدم العيادة A لا يستطيع قراءة مرضى العيادة B
      const { data: readB, error: readBErr } = await userAClient
        .from('patients')
        .select('id, clinic_id, data')
        .eq('clinic_id', clinicB);

      assert.ifError(readBErr);
      assert.equal(
        (readB || []).length,
        0,
        'مستخدم العيادة A يجب ألا يرى أي سجل من سجلات العيادة B'
      );

      // ب) التحقق أن مستخدم العيادة A لا يستطيع إضافة سجل داخل العيادة B
      const { error: insertBErr } = await userAClient.from('patients').insert({
        clinic_id: clinicB,
        id: `pat-intrude-${stamp}`,
        data: { fullName: 'محاولة اختراق' },
      });
      assert.ok(insertBErr, 'يجب أن ترفض قاعدة البيانات (RLS) إدخال بيانات في العيادة B من مستخدم العيادة A');

      // ج) التحقق أن مستخدم العيادة A يستطيع قراءة وكتابة بيانات عيادته A بشكل طبيعي
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
      // تنظيف جميع بيانات الاختبار المؤقتة
      await adminClient.from('patients').delete().in('clinic_id', [clinicA, clinicB]);
      await adminClient.from('clinic_members').delete().in('clinic_id', [clinicA, clinicB]);
      await adminClient.from('clinics').delete().in('id', [clinicA, clinicB]);
      if (userAId) {
        await adminClient.auth.admin.deleteUser(userAId);
      }
    }
    return;
  }

  // الحالة الثانية: التشغيل باستخدام حساب فعلي للعيادة A (بدون الحاجة إلى SERVICE_ROLE_KEY)
  if (!CLINIC_A_EMAIL || !CLINIC_A_PASSWORD) {
    t.skip(
      'لتشغيل الاختبار الحي بدون SUPABASE_SERVICE_ROLE_KEY، مرر TEST_CLINIC_A_EMAIL و TEST_CLINIC_A_PASSWORD.'
    );
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

  // محاولة قراءة بيانات عيادة أخرى (CLINIC_B_ID)
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

  // محاولة الكتابة في عيادة أخرى (CLINIC_B_ID) يجب أن تُرفض بواسطة RLS
  const { error: writeOtherClinicErr } = await userAClient.from('patients').insert({
    clinic_id: CLINIC_B_ID,
    id: `unauthorized-${Date.now()}`,
    data: { fullName: 'غير مصرح' },
  });
  assert.ok(
    writeOtherClinicErr,
    'يجب أن تمنع سياسات RLS مستخدم العيادة A من الكتابة في العيادة B'
  );
});
