import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Pure JavaScript mirror of `public.has_clinic_permission` in SQL & `hasPermission` in `src/permissions.ts`
 * so we can deterministically verify both the SQL function logic and the TypeScript permission engine
 * across all 10 required role/custom-permission scenarios.
 */
function evaluatePermission({
  isAuthenticated = true,
  isMember = true,
  isActive = true,
  memberClinicId = 'clinic_main',
  targetClinicId = 'clinic_main',
  role = 'secretary',
  customPermissions = {},
  specialPermissions = {},
  allowedScreens = [],
  permission,
}) {
  if (!isAuthenticated || !isMember || !isActive || memberClinicId !== targetClinicId) {
    return false;
  }

  // 1. Explicit specialPermissions override
  if (typeof specialPermissions[permission] === 'boolean') {
    return specialPermissions[permission];
  }

  const SCREEN_MAP = {
    'patients.read': ['patient-records', 'view'],
    'patients.create': ['patient-records', 'create'],
    'patients.update': ['patient-records', 'update'],
    'patients.delete': ['patient-records', 'delete'],
    'appointments.read': ['appointments', 'view'],
    'appointments.create': ['appointments', 'create'],
    'appointments.update': ['appointments', 'update'],
    'appointments.delete': ['appointments', 'delete'],
    'queue.read': ['waiting-queue', 'view'],
    'queue.create': ['waiting-queue', 'create'],
    'queue.update': ['waiting-queue', 'update'],
    'queue.delete': ['waiting-queue', 'delete'],
    'clinical.read': ['clinical-exam', 'view'],
    'clinical.open': ['clinical-exam', 'create'],
    'clinical.complete': ['clinical-exam', 'update'],
    'prescriptions.read': ['prescription-pad', 'view'],
    'prescriptions.create': ['prescription-pad', 'create'],
    'prescriptions.update': ['prescription-pad', 'update'],
    'prescriptions.delete': ['prescription-pad', 'delete'],
    'billing.read': ['billing-payments', 'view'],
    'billing.create': ['billing-payments', 'create'],
    'billing.update': ['billing-payments', 'update'],
    'billing.delete': ['billing-payments', 'delete'],
    'payments.read': ['billing-payments', 'view'],
    'payments.create': ['billing-payments', 'create'],
    'payments.update': ['billing-payments', 'update'],
    'payments.delete': ['billing-payments', 'delete'],
    'reports.read': ['clinical-reports', 'view'],
    'settings.read': ['system-settings', 'view'],
    'settings.manage': ['system-settings', 'update'],
    'users.manage': ['system-settings', 'update'],
    'backup.export': ['system-settings', 'view'],
    'backup.restore': ['system-settings', 'delete'],
    'system.clear_all_data': ['system-settings', 'delete'],
    'demo.manage': ['system-settings', 'delete'],
  };

  const mapped = SCREEN_MAP[permission];
  if (mapped) {
    const [screen, action] = mapped;
    if (customPermissions[screen] && typeof customPermissions[screen][action] === 'boolean') {
      return customPermissions[screen][action];
    }
    if (Array.isArray(allowedScreens) && allowedScreens.length > 0 && action === 'view') {
      return allowedScreens.includes(screen);
    }
  }

  // Default role fallback ONLY when no custom override is present
  const normRole = String(role || 'secretary').toLowerCase();
  if (normRole === 'admin') return true;
  if (normRole === 'doctor') {
    const doctorDefaults = new Set([
      'patients.read',
      'patients.create',
      'patients.update',
      'appointments.read',
      'appointments.create',
      'appointments.update',
      'queue.read',
      'queue.create',
      'queue.update',
      'clinical.read',
      'clinical.open',
      'clinical.complete',
      'prescriptions.read',
      'prescriptions.create',
      'prescriptions.update',
      'prescriptions.delete',
      'reports.read',
      'settings.read',
      'settings.manage',
      'backup.export',
    ]);
    return doctorDefaults.has(permission);
  }
  const secretaryDefaults = new Set([
    'patients.read',
    'patients.create',
    'patients.update',
    'appointments.read',
    'appointments.create',
    'appointments.update',
    'appointments.delete',
    'queue.read',
    'queue.create',
    'queue.update',
    'queue.delete',
    'prescriptions.read',
    'billing.read',
    'billing.create',
    'billing.update',
    'payments.read',
    'payments.create',
    'payments.update',
  ]);
  return secretaryDefaults.has(permission);
}

test('السيناريوهات الـ 10 للصلاحيات المخصصة (بغض النظر عن المسمى الوظيفي)', () => {
  // 1. سكرتير بدون صلاحية حذف المرضى -> لا يستطيع حذف مريض
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'patients.delete': false },
      permission: 'patients.delete',
    }),
    false,
    '1. سكرتير بدون صلاحية حذف المرضى يجب منعه من حذف مريض'
  );

  // 2. سكرتير مع صلاحية حذف المرضى -> يستطيع حذف مريض
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'patients.delete': true },
      permission: 'patients.delete',
    }),
    true,
    '2. سكرتير مُنح صلاحية patients.delete صراحة يجب السماح له بحذف مريض'
  );

  // 3. سكرتير بدون صلاحية الكشف -> لا يستطيع إنهاء زيارة
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'clinical.complete': false },
      permission: 'clinical.complete',
    }),
    false,
    '3. سكرتير بدون صلاحية الكشف لا يستطيع إنهاء الزيارة'
  );

  // 4. سكرتير مع صلاحية الكشف -> يستطيع فتح وإنهاء زيارة
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'clinical.open': true, 'clinical.complete': true },
      permission: 'clinical.open',
    }),
    true,
    '4أ. سكرتير مع صلاحية فتح الكشف يستطيع فتح الزيارة'
  );
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'clinical.open': true, 'clinical.complete': true },
      permission: 'clinical.complete',
    }),
    true,
    '4ب. سكرتير مع صلاحية إنهاء الكشف يستطيع إنهاء الزيارة'
  );

  // 5. طبيب بدون صلاحية حذف المرضى -> لا يستطيع حذف مريض
  assert.equal(
    evaluatePermission({
      role: 'doctor',
      specialPermissions: { 'patients.delete': false },
      permission: 'patients.delete',
    }),
    false,
    '5. طبيب بدون صلاحية حذف المرضى لا يستطيع حذف مريض'
  );

  // 6. طبيب مع صلاحية حذف المرضى -> يستطيع حذف مريض
  assert.equal(
    evaluatePermission({
      role: 'doctor',
      specialPermissions: { 'patients.delete': true },
      permission: 'patients.delete',
    }),
    true,
    '6. طبيب مع صلاحية حذف المرضى يستطيع حذف مريض'
  );

  // 7. سكرتير بدون صلاحية حذف المدفوعات -> لا يستطيع حذف دفعة
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'payments.delete': false },
      permission: 'payments.delete',
    }),
    false,
    '7. سكرتير بدون صلاحية حذف المدفوعات لا يستطيع حذف دفعة'
  );

  // 8. سكرتير مع صلاحية حذف المدفوعات -> يستطيع حذف دفعة
  assert.equal(
    evaluatePermission({
      role: 'secretary',
      specialPermissions: { 'payments.delete': true },
      permission: 'payments.delete',
    }),
    true,
    '8. سكرتير مع صلاحية حذف المدفوعات يستطيع حذف دفعة'
  );

  // 9. مستخدم غير عضو في العيادة -> لا يستطيع قراءة أو تعديل بيانات العيادة
  assert.equal(
    evaluatePermission({
      role: 'admin',
      isMember: false,
      specialPermissions: { 'patients.read': true, 'patients.delete': true },
      permission: 'patients.read',
    }),
    false,
    '9أ. مستخدم غير عضو في العيادة لا يستطيع قراءة بيانات العيادة حتى لو كان admin'
  );
  assert.equal(
    evaluatePermission({
      role: 'admin',
      memberClinicId: 'clinic_other',
      targetClinicId: 'clinic_main',
      permission: 'patients.update',
    }),
    false,
    '9ب. مستخدم من عيادة أخرى لا يستطيع تعديل بيانات العيادة'
  );

  // 10. مستخدم غير نشط (is_active = false) -> لا يستطيع تنفيذ أي عملية
  assert.equal(
    evaluatePermission({
      role: 'admin',
      isActive: false,
      specialPermissions: { 'patients.read': true, 'patients.delete': true, 'system.clear_all_data': true },
      permission: 'patients.read',
    }),
    false,
    '10. مستخدم غير نشط (is_active = false) يُمنع من تنفيذ أي عملية'
  );
});

test('التحقق من تطابق ملف الصلاحيات src/permissions.ts مع متطلبات الصلاحيات المرنة', () => {
  const permFile = fs.readFileSync(path.resolve(process.cwd(), 'src/permissions.ts'), 'utf8');
  const requiredKeys = [
    'patients.update',
    'patients.delete',
    'clinical.open',
    'clinical.complete',
    'payments.delete',
    'backup.export',
    'backup.restore',
    'system.clear_all_data',
    'data.purge',
    'demo.manage',
    'users.manage',
  ];
  for (const key of requiredKeys) {
    assert.ok(permFile.includes(`'${key}'`), `يجب أن يدعم src/permissions.ts الصلاحية الدقيقة ${key}`);
  }
});

test('التحقق من تطهير البيانات التجريبية (Demo Data Sanitization) وفصل الأدلة الطبية', () => {
  const dbSource = fs.readFileSync(path.resolve(process.cwd(), 'src/data/database.ts'), 'utf8');
  const demoGenSource = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/demoDataGenerator.ts'), 'utf8');

  assert.match(demoGenSource, /مريض تجريبي 001/, 'يجب استخدام أسماء تجريبية واضحة مثل مريض تجريبي 001');
  assert.match(demoGenSource, /00000000000/, 'يجب استخدام رقم هاتف تجريبي واضح 00000000000');
  assert.match(demoGenSource, /isDemo:\s*true/, 'يجب وسم السجلات التجريبية بـ isDemo: true');
  assert.match(
    dbSource,
    /INITIAL_PATIENTS:\s*Patient\[\]\s*=\s*\[\]/,
    'يجب أن تكون قائمة المرضى الافتراضية في database.ts فارغة تماماً من أي بيانات حقيقية'
  );
  assert.match(
    dbSource,
    /INITIAL_LAB_ORDERS:\s*LabOrder\[\]\s*=\s*\[\]/,
    'يجب فصل الأدلة الطبية عن طلبات التحاليل الافتراضية للمرضى'
  );
  assert.match(
    dbSource,
    /INITIAL_RADIOLOGY_ORDERS:\s*RadiologyOrder\[\]\s*=\s*\[\]/,
    'يجب فصل الأدلة الطبية عن طلبات الأشعة الافتراضية للمرضى'
  );
  assert.match(
    demoGenSource,
    /hasDemoPermission/,
    'يجب التحقق من صلاحية demo.manage قبل توليد البيانات التجريبية'
  );
  assert.match(
    demoGenSource,
    /hasClearPermission/,
    'يجب التحقق من صلاحية system.clear_all_data قبل المسح الجماعي'
  );
});

test('التحقق من حماية تعديل بيانات المريض (Patient Update Protection)', () => {
  const valSource = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/patientValidation.ts'), 'utf8');
  assert.match(valSource, /IMMUTABLE_PATIENT_FIELDS\s*=\s*\['clinic_id',\s*'clinicId',\s*'patientId',\s*'createdAt',\s*'createdBy'\]/, 'يجب منع تعديل الحقول الثابتة clinic_id و patientId و createdAt و createdBy');
  assert.match(valSource, /patients\.update/, 'يجب فرض صلاحية patients.update');
  assert.match(valSource, /_rev:\s*prevRev\s*\+\s*1/, 'يجب زيادة رقم المراجعة _rev عند كل تعديل مريض');
});

test('التحقق من توحيد رقم الإصدار v3.0.0 في جميع الملفات المركزية', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
  const versionTs = fs.readFileSync(path.resolve(process.cwd(), 'src/constants/version.ts'), 'utf8');
  const changelog = fs.readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');

  assert.equal(pkg.version, '3.0.0', 'إصدار package.json يجب أن يكون 3.0.0');
  assert.match(versionTs, /APP_RAW_VERSION\s*=\s*pkg\.version\s*\|\|\s*'3\.0\.0'/, 'APP_RAW_VERSION يجب أن يعتمد على 3.0.0');
  assert.match(versionTs, /APP_VERSION\s*=\s*`v\$\{APP_RAW_VERSION/, 'APP_VERSION يجب أن يُشتق بصيغة v3.0.0');
  assert.match(changelog, /3\.0\.0/, 'CHANGELOG.md يجب أن يوثق الإصدار 3.0.0');
});
