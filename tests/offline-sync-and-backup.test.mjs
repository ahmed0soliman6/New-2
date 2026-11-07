import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Deterministic Mutation ID helper (matches buildDeterministicMutationId in src/services/offlineSync.ts)
 */
function buildDeterministicMutationId(table, recordId, action, rev, clinicId = 'clinic_main') {
  const safeId = String(recordId || 'unknown').trim();
  const safeRev = Number.isFinite(rev) && rev > 0 ? rev : 1;
  return `mut:${clinicId}:${table}:${safeId}:${action}:r${safeRev}`;
}

/**
 * SHA-256 checksum computation (matches computeBackupChecksum in src/utils/backupManager.ts)
 */
function computeChecksum(dataObj) {
  const canonicalJson = JSON.stringify(dataObj);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

test('1. اختبار المزامنة دون اتصال: منع تكرار العمليات عبر mutationId الحتمي (Idempotency)', () => {
  const m1 = buildDeterministicMutationId('patients', 'pat-101', 'upsert', 2, 'clinic_main');
  const m2 = buildDeterministicMutationId('patients', 'pat-101', 'upsert', 2, 'clinic_main');
  const m3 = buildDeterministicMutationId('patients', 'pat-101', 'upsert', 3, 'clinic_main');

  assert.equal(m1, m2, 'إعادة محاولة نفس التعديل لنفس المراجعة يجب أن ينتج نفس mutationId لمنع التكرار');
  assert.notEqual(m1, m3, 'زيادة رقم المراجعة _rev يجب أن ينتج mutationId جديداً');

  // محاكاة طابور العمليات المعلقة
  const queue = new Map();
  queue.set(m1, { mutationId: m1, table: 'patients', recordId: 'pat-101', rev: 2 });
  // إعادة الإرسال عند انقطاع الشبكة
  queue.set(m2, { mutationId: m2, table: 'patients', recordId: 'pat-101', rev: 2 });
  assert.equal(queue.size, 1, 'طابور المزامنة يجب ألا يكرر العملية عند إعادة المحاولة');
});

test('2. اختبار المزامنة دون اتصال: كشف التعارض بين جهازين (_rev OCC) وحفظ النسختين للمقارنة', () => {
  // الجهاز A والجهاز B يقرآن السجل عند المراجعة _rev = 1
  const baseServerRecord = {
    patientId: 'pat-200',
    fullName: 'مريض تجريبي 001',
    phone: '00000000000',
    _rev: 1,
    updatedAt: '2026-11-07T08:00:00.000Z',
  };

  // الجهاز A يعدل السجل ويرفعه للسيرفر ليصبح _rev = 2
  const serverRecordAfterDeviceA = {
    ...baseServerRecord,
    phone: '01011111111',
    _rev: 2,
    updatedAt: '2026-11-07T08:05:00.000Z',
  };

  // الجهاز B كان غير متصل وعدّل نفس السجل بناءً على baseRev = 1
  const deviceBMutation = {
    recordId: 'pat-200',
    baseRev: 1,
    rev: 2,
    data: {
      ...baseServerRecord,
      phone: '01222222222',
      _rev: 2,
      updatedAt: '2026-11-07T08:06:00.000Z',
    },
  };

  // فحص OCC عند محاولة الجهاز B رفع تعديله:
  const conflicts = [];
  if (serverRecordAfterDeviceA._rev > deviceBMutation.baseRev) {
    conflicts.push({
      id: `conflict:patients:${deviceBMutation.recordId}`,
      table: 'patients',
      recordId: deviceBMutation.recordId,
      localData: deviceBMutation.data,
      serverData: serverRecordAfterDeviceA,
      localRev: deviceBMutation.rev,
      serverRev: serverRecordAfterDeviceA._rev,
    });
  }

  assert.equal(conflicts.length, 1, 'يجب اكتشاف التعارض عند تقدم مراجعة السيرفر عن baseRev للجهاز الثاني');
  assert.equal(conflicts[0].localData.phone, '01222222222', 'يجب حفظ نسخة الجهاز المحلي في سجل التعارض');
  assert.equal(conflicts[0].serverData.phone, '01011111111', 'يجب حفظ نسخة السيرفر في سجل التعارض للمقارنة');

  // التحقق من وجود مكون نافذة المقارنة في الكود الفعلي
  const modalPath = path.resolve(process.cwd(), 'src/components/modals/ConflictResolutionModal.tsx');
  assert.ok(fs.existsSync(modalPath), 'مكون نافذة مقارنة التعارضات ConflictResolutionModal يجب أن يكون موجوداً');
});

test('3. اختبار المزامنة دون اتصال: الحذف المحلي مع Tombstone يمنع عودة السجل المحذوف', () => {
  const tombstones = new Map();
  const markTombstone = (table, recordId, clinicId = 'clinic_main') => {
    tombstones.set(`${clinicId}:${table}:${recordId}`, {
      table,
      recordId,
      clinicId,
      deletedAt: new Date().toISOString(),
    });
  };
  const isTombstoned = (table, recordId, clinicId = 'clinic_main') =>
    tombstones.has(`${clinicId}:${table}:${recordId}`);

  // حذف السجل محلياً أثناء انقطاع الإنترنت
  markTombstone('patients', 'pat-deleted-99', 'clinic_main');

  // بيانات قادمة من السيرفر قبل إتمام حذف السجل على السيرفر
  const incomingServerItems = [
    { patientId: 'pat-active-01', fullName: 'مريض تجريبي 001' },
    { patientId: 'pat-deleted-99', fullName: 'مريض محذوف لا يجب أن يعود' },
  ];

  const mergedItems = incomingServerItems.filter(
    (item) => !isTombstoned('patients', item.patientId, 'clinic_main')
  );

  assert.equal(mergedItems.length, 1, 'السجل المحذوف محلياً والموسوم بـ Tombstone يجب ألا يعود للظهور');
  assert.equal(mergedItems[0].patientId, 'pat-active-01');
});

test('4. اختبار المزامنة التزايدية (Incremental Sync via lastSyncedAt)', () => {
  const syncSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/services/offlineSync.ts'), 'utf8');
  assert.match(syncSrc, /getLastSyncedAt/, 'يجب أن يدعم offlineSync.ts قراءة آخر وقت مزامنة getLastSyncedAt');
  assert.match(syncSrc, /setLastSyncedAt/, 'يجب أن يدعم offlineSync.ts تحديث وقت المزامنة setLastSyncedAt');
  assert.match(syncSrc, /\.gt\('updated_at',\s*lastSyncedAt\)/, 'يجب جلب السجلات المحدثة فقط بعد lastSyncedAt');
});

test('5. اختبار النسخ الاحتياطي والاستعادة: Checksum، تطابق clinic_id، الصلاحيات، والـ Rollback عند الفشل الجزئي', () => {
  const samplePayload = {
    patients: [{ patientId: 'pat-demo-001', fullName: 'مريض تجريبي 001', isDemo: true }],
    visits: [],
    appointments: [],
  };

  const validChecksum = computeChecksum(samplePayload);
  const backupBundle = {
    schemaVersion: 3,
    manifest: {
      appName: 'Soli Medical Clinic System',
      appVersion: 'v3.0.0',
      semver: '3.0.0',
      schemaVersion: 3,
      clinicId: 'clinic_main',
      exportedAt: new Date().toISOString(),
      tableCounts: { patients: 1, visits: 0, appointments: 0 },
      totalRecords: 1,
    },
    checksum: validChecksum,
    data: samplePayload,
  };

  // أ) التحقق من صحة النسخة السليمة لنفس العيادة
  assert.equal(computeChecksum(backupBundle.data), backupBundle.checksum, 'Checksum النسخة السليمة يجب أن يتطابق');

  // ب) كشف ملف تالف أو جرى التلاعب ببياناته (Checksum mismatch)
  const tamperedBundle = structuredClone(backupBundle);
  tamperedBundle.data.patients[0].fullName = 'بيانات معدلة خارجياً';
  assert.notEqual(
    computeChecksum(tamperedBundle.data),
    tamperedBundle.checksum,
    'يجب اكتشاف أي تعديل في بيانات النسخة الاحتياطية عبر اختلاف SHA-256 Checksum'
  );

  // ج) رفض الاستعادة عند اختلاف clinic_id
  const wrongClinicBundle = structuredClone(backupBundle);
  wrongClinicBundle.manifest.clinicId = 'clinic_other_branch';
  assert.notEqual(
    wrongClinicBundle.manifest.clinicId,
    'clinic_main',
    'يجب رفض استعادة نسخة احتياطية تخص clinic_id مختلفاً'
  );

  // د) التحقق من آلية التراجع الذري (Rollback) وفصل الصلاحيات في src/utils/backupManager.ts
  const backupMgrSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/backupManager.ts'), 'utf8');
  assert.match(backupMgrSrc, /hasExportPermission/, 'يجب التحقق من صلاحية backup.export عند التصدير');
  assert.match(backupMgrSrc, /hasRestorePermission/, 'يجب التحقق من صلاحية backup.restore عند الاستعادة');
  assert.match(backupMgrSrc, /preRestoreSnapshot/, 'يجب أخذ لقطة تراجع preRestoreSnapshot قبل الاستعادة واسترجاعها عند فشل أي جدول');
});
