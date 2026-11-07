import { APP_VERSION } from '../constants/version';
import { clinicId as defaultClinicId, supabase } from '../services/supabase';
import { recordAuditLog } from '../services/auditLog';
import { notifyTableMutated } from '../services/offlineSync';

export const BACKUP_SCHEMA_VERSION = 3;

export interface BackupManifest {
  appVersion: string;
  schemaVersion: number;
  clinicId: string;
  exportedAt: string;
  tableCounts: Record<string, number>;
  totalRecords: number;
}

export interface BackupPayloadV3 {
  schemaVersion: number;
  version: string;
  appName: string;
  exportedAt: string;
  clinicId: string;
  manifest: BackupManifest;
  checksum: string;
  summary: {
    patientsCount: number;
    appointmentsCount: number;
    visitsCount: number;
    invoicesCount: number;
    paymentsCount: number;
    prescriptionsCount: number;
    catalogsCount: number;
  };
  patients: any[];
  appointments: any[];
  visits: any[];
  invoices: any[];
  payments: any[];
  prescriptions: any[];
  labOrders: any[];
  radiologyOrders: any[];
  followUps: any[];
  visitTypes?: any[];
  freeFollowupDays?: number;
  medicalServices?: any[];
  expenseCategories?: any[];
  alertConfig?: any;
  examDisplayConfig?: any;
  recurringTemplates?: any[];
  radiologyCatalog?: any[];
  labCatalog?: any[];
  drugCatalog?: any[];
  diagnosesCatalog?: any[];
  symptomsCatalog?: any[];
  chronicConditions?: any[];
}

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  payload?: BackupPayloadV3;
  preview?: {
    appVersion: string;
    schemaVersion: number;
    clinicId: string;
    exportedAt: string;
    tableCounts: Record<string, number>;
    totalRecords: number;
    checksumVerified: boolean;
  };
}

function canonicalizeForChecksum(payload: Partial<BackupPayloadV3>): string {
  const core = {
    schemaVersion: payload.schemaVersion ?? BACKUP_SCHEMA_VERSION,
    clinicId: payload.clinicId ?? payload.manifest?.clinicId ?? '',
    patients: Array.isArray(payload.patients) ? payload.patients : [],
    appointments: Array.isArray(payload.appointments) ? payload.appointments : [],
    visits: Array.isArray(payload.visits) ? payload.visits : [],
    invoices: Array.isArray(payload.invoices) ? payload.invoices : [],
    payments: Array.isArray(payload.payments) ? payload.payments : [],
    prescriptions: Array.isArray(payload.prescriptions) ? payload.prescriptions : [],
    labOrders: Array.isArray(payload.labOrders) ? payload.labOrders : [],
    radiologyOrders: Array.isArray(payload.radiologyOrders) ? payload.radiologyOrders : [],
    followUps: Array.isArray(payload.followUps) ? payload.followUps : [],
  };
  return JSON.stringify(core);
}

export async function computeBackupChecksum(payload: Partial<BackupPayloadV3>): Promise<string> {
  const canonical = canonicalizeForChecksum(payload);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const encoded = new TextEncoder().encode(canonical);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Deterministic fallback hash if crypto.subtle is unavailable
  let h1 = 0xdeadbeef ^ canonical.length;
  let h2 = 0x41c6ce57 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export async function createBackupPayload(params: {
  clinicId?: string;
  hasExportPermission?: boolean;
  patients?: any[];
  appointments?: any[];
  visits?: any[];
  invoices?: any[];
  payments?: any[];
  prescriptions?: any[];
  labOrders?: any[];
  radiologyOrders?: any[];
  followUps?: any[];
  visitTypes?: any[];
  freeFollowupDays?: number;
  medicalServices?: any[];
  expenseCategories?: any[];
  alertConfig?: any;
  examDisplayConfig?: any;
  recurringTemplates?: any[];
  radiologyCatalog?: any[];
  labCatalog?: any[];
  drugCatalog?: any[];
  diagnosesCatalog?: any[];
  symptomsCatalog?: any[];
  chronicConditions?: any[];
}): Promise<BackupPayloadV3> {
  if (params.hasExportPermission === false) {
    throw new Error('غير مصرح: ليس لديك صلاحية تصدير النسخة الاحتياطية (backup.export).');
  }

  const targetClinicId = params.clinicId || defaultClinicId;
  const exportedAt = new Date().toISOString();

  const patients = Array.isArray(params.patients) ? params.patients : [];
  const appointments = Array.isArray(params.appointments) ? params.appointments : [];
  const visits = Array.isArray(params.visits) ? params.visits : [];
  const invoices = Array.isArray(params.invoices) ? params.invoices : [];
  const payments = Array.isArray(params.payments) ? params.payments : [];
  const prescriptions = Array.isArray(params.prescriptions) ? params.prescriptions : [];
  const labOrders = Array.isArray(params.labOrders) ? params.labOrders : [];
  const radiologyOrders = Array.isArray(params.radiologyOrders) ? params.radiologyOrders : [];
  const followUps = Array.isArray(params.followUps) ? params.followUps : [];

  const tableCounts: Record<string, number> = {
    patients: patients.length,
    appointments: appointments.length,
    visits: visits.length,
    invoices: invoices.length,
    payments: payments.length,
    prescriptions: prescriptions.length,
    lab_orders: labOrders.length,
    radiology_orders: radiologyOrders.length,
    follow_ups: followUps.length,
  };

  const totalRecords = Object.values(tableCounts).reduce((sum, n) => sum + n, 0);

  const draft: Omit<BackupPayloadV3, 'checksum'> = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    version: APP_VERSION,
    appName: 'Soli Medical Clinic System',
    exportedAt,
    clinicId: targetClinicId,
    manifest: {
      appVersion: APP_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      clinicId: targetClinicId,
      exportedAt,
      tableCounts,
      totalRecords,
    },
    summary: {
      patientsCount: patients.length,
      appointmentsCount: appointments.length,
      visitsCount: visits.length,
      invoicesCount: invoices.length,
      paymentsCount: payments.length,
      prescriptionsCount: prescriptions.length,
      catalogsCount:
        (params.drugCatalog?.length || 0) +
        (params.radiologyCatalog?.length || 0) +
        (params.labCatalog?.length || 0),
    },
    patients,
    appointments,
    visits,
    invoices,
    payments,
    prescriptions,
    labOrders,
    radiologyOrders,
    followUps,
    visitTypes: params.visitTypes,
    freeFollowupDays: params.freeFollowupDays,
    medicalServices: params.medicalServices,
    expenseCategories: params.expenseCategories,
    alertConfig: params.alertConfig,
    examDisplayConfig: params.examDisplayConfig,
    recurringTemplates: params.recurringTemplates,
    radiologyCatalog: params.radiologyCatalog,
    labCatalog: params.labCatalog,
    drugCatalog: params.drugCatalog,
    diagnosesCatalog: params.diagnosesCatalog,
    symptomsCatalog: params.symptomsCatalog,
    chronicConditions: params.chronicConditions,
  };

  const checksum = await computeBackupChecksum(draft);
  return {
    ...draft,
    checksum,
  };
}

export async function validateBackupPayload(
  rawInput: string | Record<string, unknown>,
  expectedClinicId = defaultClinicId
): Promise<BackupValidationResult> {
  const errors: string[] = [];
  let parsed: any;

  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      return {
        valid: false,
        errors: ['ملف النسخة الاحتياطية تالف أو ليس بصيغة JSON صالحة.'],
      };
    }
  } else {
    parsed = rawInput;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ['بنية ملف النسخة الاحتياطية غير صالحة.'],
    };
  }

  const schemaVersion = Number(parsed.schemaVersion ?? parsed.manifest?.schemaVersion ?? 0);
  if (!schemaVersion || schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_VERSION) {
    errors.push(
      `إصدار هيكل النسخة الاحتياطية (schemaVersion: ${schemaVersion || 'غير محدد'}) غير مدعوم. الإصدار المطلوب: ${BACKUP_SCHEMA_VERSION}.`
    );
  }

  const payloadClinicId = String(parsed.clinicId ?? parsed.manifest?.clinicId ?? '').trim();
  if (!payloadClinicId) {
    errors.push('ملف النسخة الاحتياطية يفتقد معرف العيادة (clinicId).');
  } else if (payloadClinicId !== expectedClinicId) {
    errors.push(
      `لا يمكن استعادة نسخة احتياطية تخص عيادة أخرى (${payloadClinicId}) داخل العيادة الحالية (${expectedClinicId}).`
    );
  }

  const arrayFields = [
    'patients',
    'appointments',
    'visits',
    'invoices',
    'payments',
    'prescriptions',
  ];
  for (const field of arrayFields) {
    if (parsed[field] !== undefined && !Array.isArray(parsed[field])) {
      errors.push(`الحقل "${field}" في النسخة الاحتياطية يجب أن يكون مصفوفة صالحة.`);
    }
  }

  let checksumVerified = false;
  if (!parsed.checksum || typeof parsed.checksum !== 'string') {
    errors.push('ملف النسخة الاحتياطية يفتقد البصمة الرقمية للتحقق من السلامة (checksum).');
  } else {
    const computed = await computeBackupChecksum(parsed);
    if (computed !== parsed.checksum) {
      errors.push('فشل التحقق من سلامة النسخة الاحتياطية (Checksum Mismatch): الملف معدل أو تالف.');
    } else {
      checksumVerified = true;
    }
  }

  const tableCounts: Record<string, number> = {
    patients: Array.isArray(parsed.patients) ? parsed.patients.length : 0,
    appointments: Array.isArray(parsed.appointments) ? parsed.appointments.length : 0,
    visits: Array.isArray(parsed.visits) ? parsed.visits.length : 0,
    invoices: Array.isArray(parsed.invoices) ? parsed.invoices.length : 0,
    payments: Array.isArray(parsed.payments) ? parsed.payments.length : 0,
    prescriptions: Array.isArray(parsed.prescriptions) ? parsed.prescriptions.length : 0,
    lab_orders: Array.isArray(parsed.labOrders) ? parsed.labOrders.length : 0,
    radiology_orders: Array.isArray(parsed.radiologyOrders) ? parsed.radiologyOrders.length : 0,
    follow_ups: Array.isArray(parsed.followUps) ? parsed.followUps.length : 0,
  };
  const totalRecords = Object.values(tableCounts).reduce((s, n) => s + n, 0);

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    payload: parsed as BackupPayloadV3,
    preview: {
      appVersion: String(parsed.manifest?.appVersion || parsed.version || APP_VERSION),
      schemaVersion,
      clinicId: payloadClinicId,
      exportedAt: String(parsed.exportedAt || parsed.manifest?.exportedAt || ''),
      tableCounts,
      totalRecords,
      checksumVerified,
    },
  };
}

export interface RestoreBackupOptions {
  hasRestorePermission: boolean;
  expectedClinicId?: string;
  actor?: {
    uid?: string;
    username?: string;
    role?: string;
  };
  /**
   * Optional custom table writer for testing atomic rollback on partial failure
   */
  customTableWriter?: (table: string, rows: Array<{ id: string; data: any }>) => Promise<void>;
  customSnapshotReader?: (table: string) => Promise<Array<{ id: string; data: any }>>;
}

export async function restoreBackupWithRollback(
  rawPayload: string | Record<string, unknown>,
  options: RestoreBackupOptions
): Promise<{ restoredCounts: Record<string, number>; totalRestored: number }> {
  if (!options.hasRestorePermission) {
    throw new Error('غير مصرح: ليس لديك صلاحية استعادة النسخة الاحتياطية (backup.restore).');
  }

  const targetClinicId = options.expectedClinicId || defaultClinicId;
  const validation = await validateBackupPayload(rawPayload, targetClinicId);
  if (!validation.valid || !validation.payload) {
    throw new Error(validation.errors.join(' | '));
  }

  const data = validation.payload;
  const tableBatches: Array<{
    table: string;
    rows: Array<{ id: string; data: any }>;
  }> = [
    {
      table: 'patients',
      rows: (data.patients || [])
        .filter((p: any) => p && (p.patientId || p.id))
        .map((p: any) => ({ id: String(p.patientId || p.id), data: p })),
    },
    {
      table: 'appointments',
      rows: (data.appointments || [])
        .filter((a: any) => a && (a.appointmentId || a.id))
        .map((a: any) => ({ id: String(a.appointmentId || a.id), data: a })),
    },
    {
      table: 'visits',
      rows: (data.visits || [])
        .filter((v: any) => v && (v.visitId || v.id))
        .map((v: any) => ({ id: String(v.visitId || v.id), data: v })),
    },
    {
      table: 'invoices',
      rows: (data.invoices || [])
        .filter((i: any) => i && (i.invoiceId || i.id))
        .map((i: any) => ({ id: String(i.invoiceId || i.id), data: i })),
    },
    {
      table: 'payments',
      rows: (data.payments || [])
        .filter((pay: any) => pay && (pay.paymentId || pay.id))
        .map((pay: any) => ({ id: String(pay.paymentId || pay.id), data: pay })),
    },
    {
      table: 'prescriptions',
      rows: (data.prescriptions || [])
        .filter((rx: any) => rx && (rx.prescriptionId || rx.id))
        .map((rx: any) => ({ id: String(rx.prescriptionId || rx.id), data: rx })),
    },
    {
      table: 'lab_orders',
      rows: (data.labOrders || [])
        .filter((lo: any) => lo && (lo.labOrderId || lo.id))
        .map((lo: any) => ({ id: String(lo.labOrderId || lo.id), data: lo })),
    },
    {
      table: 'radiology_orders',
      rows: (data.radiologyOrders || [])
        .filter((ro: any) => ro && (ro.radiologyOrderId || ro.id))
        .map((ro: any) => ({ id: String(ro.radiologyOrderId || ro.id), data: ro })),
    },
    {
      table: 'follow_ups',
      rows: (data.followUps || [])
        .filter((f: any) => f && (f.followUpId || f.id))
        .map((f: any) => ({ id: String(f.followUpId || f.id), data: f })),
    },
  ];

  // 1. Capture pre-restore snapshot for rollback safety
  const preRestoreSnapshot = new Map<string, Array<{ id: string; data: any }>>();
  for (const batch of tableBatches) {
    if (options.customSnapshotReader) {
      preRestoreSnapshot.set(batch.table, await options.customSnapshotReader(batch.table));
    } else if (supabase) {
      const { data: existingRows } = await supabase
        .from(batch.table)
        .select('id, data')
        .eq('clinic_id', targetClinicId);
      preRestoreSnapshot.set(
        batch.table,
        ((existingRows || []) as Array<{ id: string; data: any }>).map((r) => ({
          id: r.id,
          data: r.data,
        }))
      );
    }
  }

  const restoredCounts: Record<string, number> = {};
  const touchedTables: string[] = [];
  let totalRestored = 0;

  try {
    for (const batch of tableBatches) {
      touchedTables.push(batch.table);
      if (options.customTableWriter) {
        await options.customTableWriter(batch.table, batch.rows);
      } else if (supabase && batch.rows.length > 0) {
        const nowIso = new Date().toISOString();
        const payloadRows = batch.rows.map((r) => ({
          clinic_id: targetClinicId,
          id: r.id,
          data: r.data,
          updated_at: nowIso,
        }));
        const { error } = await supabase
          .from(batch.table)
          .upsert(payloadRows, { onConflict: 'clinic_id,id' });
        if (error) {
          throw new Error(`فشل استعادة جدول ${batch.table}: ${error.message}`);
        }
      }
      restoredCounts[batch.table] = batch.rows.length;
      totalRestored += batch.rows.length;
    }
  } catch (err) {
    // Atomic Rollback: restore pre-restore snapshot for all touched tables
    for (const table of touchedTables) {
      const snapshotRows = preRestoreSnapshot.get(table) || [];
      try {
        if (options.customTableWriter) {
          await options.customTableWriter(table, snapshotRows);
        } else if (supabase) {
          await supabase.from(table).delete().eq('clinic_id', targetClinicId);
          if (snapshotRows.length > 0) {
            const nowIso = new Date().toISOString();
            await supabase.from(table).upsert(
              snapshotRows.map((r) => ({
                clinic_id: targetClinicId,
                id: r.id,
                data: r.data,
                updated_at: nowIso,
              })),
              { onConflict: 'clinic_id,id' }
            );
          }
        }
      } catch {
        // Best-effort rollback
      }
    }

    await recordAuditLog({
      action: 'backup.restore.rollback',
      actorUid: options.actor?.uid,
      actorUsername: options.actor?.username,
      actorRole: options.actor?.role,
      targetType: 'clinic_backup',
      targetId: targetClinicId,
      summary: 'فشل أثناء استعادة النسخة الاحتياطية وتم التراجع التلقائي (Rollback) لحماية البيانات.',
      details: {
        error: err instanceof Error ? err.message : 'Unknown error',
        touchedTables,
      },
    });

    throw err;
  }

  notifyTableMutated(['*'], true);

  await recordAuditLog({
    action: 'backup.restore',
    actorUid: options.actor?.uid,
    actorUsername: options.actor?.username,
    actorRole: options.actor?.role,
    targetType: 'clinic_backup',
    targetId: targetClinicId,
    summary: `تمت استعادة النسخة الاحتياطية بنجاح (${totalRestored} سجل).`,
    details: {
      restoredCounts,
      totalRestored,
      backupExportedAt: data.exportedAt,
      backupAppVersion: data.manifest?.appVersion || data.version,
    },
  });

  return {
    restoredCounts,
    totalRestored,
  };
}
