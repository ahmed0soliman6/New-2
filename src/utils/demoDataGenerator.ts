import { supabase, clinicId } from '../services/supabase';
import { resolveTableName } from '../services/repositories/common';
import { notifyTableMutated, clearCachedTables } from '../services/offlineSync';
import { saveClinicExpenses } from './financeManager';
import { recordAuditLog } from '../services/auditLog';
import { toDayKey } from './dayKey';
import type {
  Patient,
  Appointment,
  Visit,
  Invoice,
  Payment,
} from '../types/database';

export const REQUIRED_CLEAR_CONFIRMATION_PHRASE = 'احذف بيانات العيادة';

// Sanitized synthetic demo pool — zero real names, zero real phone numbers, zero real national IDs
export const DEMO_PATIENTS_POOL = [
  { id: 'pat-demo-1', name: 'مريض تجريبي 001', phone: '00000000000', gender: 'male', dob: '1985-05-12', doc: 'DEMO-001' },
  { id: 'pat-demo-2', name: 'مريض تجريبي 002', phone: '00000000000', gender: 'female', dob: '1990-09-22', doc: 'DEMO-002' },
  { id: 'pat-demo-3', name: 'مريض تجريبي 003', phone: '00000000000', gender: 'male', dob: '1978-01-15', doc: 'DEMO-003' },
  { id: 'pat-demo-4', name: 'مريض تجريبي 004', phone: '00000000000', gender: 'female', dob: '1995-11-30', doc: 'DEMO-004' },
  { id: 'pat-demo-5', name: 'مريض تجريبي 005', phone: '00000000000', gender: 'female', dob: '1965-04-05', doc: 'DEMO-005' },
  { id: 'pat-demo-6', name: 'مريض تجريبي 006', phone: '00000000000', gender: 'male', dob: '2012-08-18', doc: 'DEMO-006' },
  { id: 'pat-demo-7', name: 'مريض تجريبي 007', phone: '00000000000', gender: 'male', dob: '1992-03-25', doc: 'DEMO-007' },
  { id: 'pat-demo-8', name: 'مريض تجريبي 008', phone: '00000000000', gender: 'male', dob: '2000-07-07', doc: 'DEMO-008' },
];

const DIAGNOSES_POOL = [
  'نزلات برد حادة والتهاب الجيوب الأنفية',
  'متابعة ضغط الدم المرتفع والسكري',
  'التهاب المفاصل والفقرات القطنية',
  'التهاب الشعب الهوائية الحاد',
  'اضطرابات القولون العصبي وعسر الهضم',
  'صداع نصفي وإجهاد مزمن',
  'حساسية صدرية وربو شعبي',
  'متابعة دورية وفحص عام',
];

const COMPLAINTS_POOL = [
  'صداع مستمر وارتفاع طفيف في درجة الحرارة مع رشح وكحة جافة',
  'ألم أسفل الظهر يمتد للرجل اليمنى وصعوبة في الحركة المستمرة',
  'ألم وتقلصات شديدة بالبطن مع غازات وانتفاخ بعد تناول الوجبات الدسمة',
  'نهجان شديد وضيق في الصدر مع كحة مستمرة خاصة أثناء النوم',
  'متابعة مستوى السكر التراكمي وقياسات ضغط الدم على مدار الأسبوعين الماضيين',
  'دوخة مستمرة مع زغللة في العين وكسل وخمول عام بالجسم',
  'ألم حاد في الأذن والبلعوم وصعوبة في بلع الأطعمة الجافة',
  'رغبة في إجراء فحص كامل ومراجعة الفحوصات والتحاليل الدورية السنوية',
];

function generateDateInMonth(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  const day = Math.floor(Math.random() * 26) + 1;
  d.setDate(day);
  d.setHours(Math.floor(Math.random() * 7) + 13);
  d.setMinutes(Math.floor(Math.random() * 4) * 15);
  d.setSeconds(0);
  return d.toISOString();
}

export interface ClearDatabaseOptions {
  confirmationText?: string;
  hasClearPermission?: boolean;
  actor?: {
    uid?: string;
    username?: string;
    role?: string;
  };
}

export interface ClearDatabaseResult {
  deletedCounts: Record<string, number>;
  succeededTables: string[];
  failedTables: string[];
  preservedTables: string[];
  totalDeleted: number;
  timestamp: string;
}

export const TRANSACTIONAL_TABLES_TO_CLEAR = [
  'patients',
  'appointments',
  'visits',
  'invoices',
  'payments',
  'followUps',
  'prescriptions',
  'labOrders',
  'radiologyOrders',
  'expenses',
  'transactions',
  'counters',
];

export const PRESERVED_SYSTEM_TABLES = [
  'settings',
  'medications',
  'lab_tests',
  'radiology_types',
  'diagnoses',
  'symptoms',
  'chronic_diseases',
  'services',
  'expense_categories',
  'clinic_members',
];

/**
 * Generates 1 year of synthetic demo data with `isDemo: true` on every generated record.
 */
export async function generateOneYearDemoData(options?: {
  hasDemoPermission?: boolean;
  actor?: { uid?: string; username?: string; role?: string };
}): Promise<void> {
  if (options && options.hasDemoPermission === false) {
    throw new Error('غير مصرح: ليس لديك صلاحية إدارة وتوليد البيانات التجريبية (demo.manage).');
  }

  const generatedPatients: Array<Patient & { isDemo: boolean }> = [];
  const generatedAppointments: Array<Appointment & { isDemo: boolean }> = [];
  const generatedVisits: Array<Visit & { isDemo: boolean }> = [];
  const generatedInvoices: Array<Invoice & { isDemo: boolean }> = [];
  const generatedPayments: Array<Payment & { isDemo: boolean }> = [];
  const generatedExpenses: any[] = [];

  const timestamp = new Date().toISOString();

  // 1. Generate Synthetic Demo Patients
  DEMO_PATIENTS_POOL.forEach((p, index) => {
    const paddedIndex = String(index + 1).padStart(2, '0');
    generatedPatients.push({
      patientId: p.id,
      fullName: p.name,
      phone: p.phone,
      gender: p.gender as 'male' | 'female',
      dateOfBirth: p.dob,
      nationalId: `000000000000${paddedIndex}`,
      governorate: 'بيانات تجريبية',
      address: 'عنوان تجريبي للاختبار فقط',
      fileNumber: index + 101,
      medicalCode: p.doc,
      bloodType: ['O+', 'A+', 'B+', 'AB+'][index % 4],
      allergies: index % 3 === 0 ? ['البنسلين'] : [],
      chronicDiseases: index % 2 === 0 ? ['السكري', 'ارتفاع ضغط الدم'] : [],
      emergencyContact: { name: `مرافق تجريبي ${paddedIndex}`, relation: 'قريب تجريبي', phone: '00000000000' },
      createdAt: generateDateInMonth(11),
      updatedAt: timestamp,
      createdBy: 'demo_generator',
      isDemo: true,
    });
  });

  // 2. Generate 12 Months of Synthetic Transactions
  for (let m = 0; m < 12; m++) {
    const visitsCount = Math.floor(Math.random() * 5) + 5;
    for (let v = 0; v < visitsCount; v++) {
      const patient = generatedPatients[Math.floor(Math.random() * generatedPatients.length)];
      const dateStr = generateDateInMonth(m);
      const visitId = `vis-demo-${m}-${v}-${Math.random().toString(36).slice(2, 7)}`;
      const apptId = `appt-demo-${m}-${v}-${Math.random().toString(36).slice(2, 7)}`;
      const invoiceId = `inv-demo-${m}-${v}-${Math.random().toString(36).slice(2, 7)}`;
      const paymentId = `pay-demo-${m}-${v}-${Math.random().toString(36).slice(2, 7)}`;
      const queueNum = v + 1;

      const visitPrice = m % 3 === 0 ? 150 : 300;
      const visitTypeName = visitPrice === 150 ? 'متابعة واستشارة' : 'كشف جديد';

      generatedAppointments.push({
        appointmentId: apptId,
        patientId: patient.patientId,
        clinicLocationId: 'loc-main',
        scheduledDate: dateStr.split('T')[0],
        scheduledTime: '06:00 م',
        visitType: visitTypeName,
        status: 'ARRIVED',
        notes: 'حجز تجريبي مولد للاختبار فقط',
        createdAt: dateStr,
        updatedAt: dateStr,
        createdBy: 'demo_generator',
        isDemo: true,
      });

      generatedVisits.push({
        visitId,
        patientId: patient.patientId,
        appointmentId: apptId,
        clinicLocationId: 'loc-main',
        visitType: visitPrice === 150 ? 'FOLLOW_UP' : 'NEW',
        source: 'APPOINTMENT',
        status: 'COMPLETED',
        queueNumber: queueNum,
        receptionistData: {
          symptoms: 'كشف دوري تجريبي',
          chronicDiseases: [],
          notes: `بيانات تجريبية (${visitPrice} ج.م)`,
        },
        clinicalData: {
          chiefComplaint: COMPLAINTS_POOL[Math.floor(Math.random() * COMPLAINTS_POOL.length)],
          history: 'سجل تجريبي للاختبار',
          examination: 'العلامات الحيوية مستقرة (بيانات تجريبية).',
          diagnosis: [DIAGNOSES_POOL[Math.floor(Math.random() * DIAGNOSES_POOL.length)]],
          treatment: 'خطة علاجية تجريبية للعرض فقط.',
        },
        vitalSigns: {
          bloodPressure: `${110 + Math.floor(Math.random() * 25)}/${70 + Math.floor(Math.random() * 15)}`,
          pulse: 70 + Math.floor(Math.random() * 20),
          temperature: 36.5 + Math.random() * 1.2,
          weight: 60 + Math.floor(Math.random() * 30),
          height: 160 + Math.floor(Math.random() * 20),
          oxygenSaturation: 97 + Math.floor(Math.random() * 3),
          randomBloodSugar: 90 + Math.floor(Math.random() * 60),
        },
        startedAt: dateStr,
        completedAt: dateStr,
        createdAt: dateStr,
        updatedAt: dateStr,
        createdBy: 'demo_generator',
        doctorId: 'demo_doctor',
        dayKey: toDayKey(dateStr),
        isDemo: true,
      });

      generatedInvoices.push({
        invoiceId,
        patientId: patient.patientId,
        visitId,
        clinicLocationId: 'loc-main',
        items: [
          {
            serviceId: visitPrice === 150 ? 'srv-follow-up' : 'srv-new-exam',
            nameAr: visitTypeName,
            quantity: 1,
            unitPrice: visitPrice,
            total: visitPrice,
          },
        ],
        subtotal: visitPrice,
        discount: 0,
        total: visitPrice,
        paidAmount: visitPrice,
        remainingAmount: 0,
        status: 'PAID',
        createdAt: dateStr,
        updatedAt: dateStr,
        dayKey: toDayKey(dateStr),
        isDemo: true,
      });

      generatedPayments.push({
        paymentId,
        patientId: patient.patientId,
        visitId,
        invoiceId,
        clinicLocationId: 'loc-main',
        amount: visitPrice,
        method: 'CASH',
        status: 'PAID',
        receiptNumber: `DEMO-REC-${m}-${v}-${1000 + v}`,
        paidAt: dateStr,
        receivedBy: 'demo_generator',
        dayKey: toDayKey(dateStr),
        isDemo: true,
      });
    }

    const expenseDate = generateDateInMonth(m).split('T')[0];
    generatedExpenses.push(
      {
        id: `exp-demo-${m}-rent`,
        category: 'إيجار العيادة',
        amount: 3000,
        date: expenseDate,
        time: '12:00 م',
        notes: `إيجار تجريبي - شهر ${12 - m}`,
        createdAt: timestamp,
        isDemo: true,
      },
      {
        id: `exp-demo-${m}-salary`,
        category: 'رواتب الموظفين',
        amount: 4000,
        date: expenseDate,
        time: '01:00 م',
        notes: 'رواتب تجريبية للاختبار',
        createdAt: timestamp,
        isDemo: true,
      }
    );
  }

  if (supabase) {
    const nowIso = new Date().toISOString();
    const tableBatches: Array<{
      table: string;
      rows: Array<{ clinic_id: string; id: string; data: unknown; updated_at: string }>;
    }> = [
      {
        table: 'patients',
        rows: generatedPatients.map((p) => ({
          clinic_id: clinicId,
          id: p.patientId,
          data: p,
          updated_at: nowIso,
        })),
      },
      {
        table: 'appointments',
        rows: generatedAppointments.map((a) => ({
          clinic_id: clinicId,
          id: a.appointmentId,
          data: a,
          updated_at: nowIso,
        })),
      },
      {
        table: 'visits',
        rows: generatedVisits.map((v) => ({
          clinic_id: clinicId,
          id: v.visitId,
          data: v,
          updated_at: nowIso,
        })),
      },
      {
        table: 'invoices',
        rows: generatedInvoices.map((i) => ({
          clinic_id: clinicId,
          id: i.invoiceId,
          data: i,
          updated_at: nowIso,
        })),
      },
      {
        table: 'payments',
        rows: generatedPayments.map((pay) => ({
          clinic_id: clinicId,
          id: pay.paymentId,
          data: pay,
          updated_at: nowIso,
        })),
      },
    ];

    for (const group of tableBatches) {
      if (group.rows.length > 0) {
        await supabase.from(group.table).upsert(group.rows, { onConflict: 'clinic_id,id' });
      }
    }
    notifyTableMutated(['patients', 'appointments', 'visits', 'invoices', 'payments'], true);
  }

  saveClinicExpenses(generatedExpenses);

  await recordAuditLog({
    action: 'demo.generate_data',
    actorUid: options?.actor?.uid,
    actorUsername: options?.actor?.username,
    actorRole: options?.actor?.role,
    targetType: 'clinic_demo_data',
    targetId: clinicId,
    summary: 'تم توليد بيانات تجريبية معزولة (isDemo: true) للعيادة.',
    details: {
      patientsCount: generatedPatients.length,
      visitsCount: generatedVisits.length,
    },
  });
}

/**
 * Counts transactional records per table before bulk clear so the UI can display accurate numbers.
 */
export async function previewDatabaseCollectionsCounts(): Promise<{
  counts: Record<string, number>;
  totalRecords: number;
  affectedTables: string[];
  preservedTables: string[];
}> {
  const counts: Record<string, number> = {};
  let totalRecords = 0;
  const affectedTables = TRANSACTIONAL_TABLES_TO_CLEAR.map(resolveTableName);

  if (supabase) {
    for (const tableName of affectedTables) {
      try {
        const { count } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinicId);
        const c = typeof count === 'number' ? count : 0;
        counts[tableName] = c;
        totalRecords += c;
      } catch {
        counts[tableName] = 0;
      }
    }
  }

  return {
    counts,
    totalRecords,
    affectedTables,
    preservedTables: PRESERVED_SYSTEM_TABLES,
  };
}

/**
 * Clears transactional/patient collections from the database while preserving
 * settings, medical catalogs, users, and permissions.
 */
export async function clearAllDatabaseCollections(
  options?: ClearDatabaseOptions
): Promise<ClearDatabaseResult> {
  if (options && options.hasClearPermission === false) {
    throw new Error('غير مصرح: ليس لديك صلاحية مسح بيانات العيادة (system.clear_all_data).');
  }

  if (
    options?.confirmationText !== undefined &&
    options.confirmationText.trim() !== REQUIRED_CLEAR_CONFIRMATION_PHRASE
  ) {
    throw new Error(
      `فشل التحقق من عبارة التأكيد. يجب كتابة "${REQUIRED_CLEAR_CONFIRMATION_PHRASE}" بدقة.`
    );
  }

  const deletedCounts: Record<string, number> = {};
  const succeededTables: string[] = [];
  const failedTables: string[] = [];
  let totalDeleted = 0;
  const timestamp = new Date().toISOString();

  saveClinicExpenses([]);
  try {
    localStorage.setItem('soli_clinic_db_initialized', 'true');
  } catch {}

  const resolvedTables = Array.from(new Set(TRANSACTIONAL_TABLES_TO_CLEAR.map(resolveTableName)));

  if (supabase) {
    for (const tableName of resolvedTables) {
      try {
        const { count } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true })
          .eq('clinic_id', clinicId);
        const beforeCount = typeof count === 'number' ? count : 0;

        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq('clinic_id', clinicId);

        if (error) {
          failedTables.push(tableName);
        } else {
          deletedCounts[tableName] = beforeCount;
          totalDeleted += beforeCount;
          succeededTables.push(tableName);
        }
      } catch {
        failedTables.push(tableName);
      }
    }

    // Record new database epoch generation marker in settings so all other clients detect the cloud purge
    const newDbEpoch = Date.now();
    try {
      await supabase.from('settings').upsert({
        clinic_id: clinicId,
        id: '_database_generation',
        data: {
          dbEpoch: newDbEpoch,
          clearedAt: timestamp,
          clearedBy: options?.actor?.username || options?.actor?.uid || 'admin',
        },
      }, { onConflict: 'clinic_id,id' });

      // Import and broadcast realtime clear to other clients
      const { broadcastRealtimeDatabaseClear } = await import('../services/realtimeSync');
      await broadcastRealtimeDatabaseClear(newDbEpoch);
    } catch {}
  } else {
    for (const tableName of resolvedTables) {
      deletedCounts[tableName] = 0;
      succeededTables.push(tableName);
    }
  }

  // Clear local IndexedDB cached tables immediately
  try {
    const { clearCachedTables, notifyTableMutated } = await import('../services/offlineSync');
    await clearCachedTables(resolvedTables);
    notifyTableMutated(resolvedTables, true);
  } catch {}

  if (failedTables.length > 0) {
    await recordAuditLog({
      action: 'system.clear_all_data.failed',
      actorUid: options?.actor?.uid,
      actorUsername: options?.actor?.username,
      actorRole: options?.actor?.role,
      targetType: 'clinic_database',
      targetId: clinicId,
      summary: `فشل جزئي أثناء مسح بيانات العيادة في الجداول: ${failedTables.join(', ')}`,
      details: { deletedCounts, succeededTables, failedTables },
    });
    throw new Error(
      `تعذر مسح بعض الجداول الأساسية من قاعدة البيانات (${failedTables.join(', ')}). يرجى التحقق من الصلاحيات أو الاتصال.`
    );
  }

  await clearCachedTables(resolvedTables);
  notifyTableMutated(['*'], true);

  await recordAuditLog({
    action: 'system.clear_all_data',
    actorUid: options?.actor?.uid,
    actorUsername: options?.actor?.username,
    actorRole: options?.actor?.role,
    targetType: 'clinic_database',
    targetId: clinicId,
    summary: `تم مسح بيانات التشغيل للعيادة بنجاح (إجمالي السجلات المحذوفة: ${totalDeleted}).`,
    details: {
      deletedCounts,
      succeededTables,
      preservedTables: PRESERVED_SYSTEM_TABLES,
      totalDeleted,
    },
  });

  return {
    deletedCounts,
    succeededTables,
    failedTables,
    preservedTables: PRESERVED_SYSTEM_TABLES,
    totalDeleted,
    timestamp,
  };
}
