import { supabase, clinicId } from './supabase';

export const REQUIRED_PURGE_CONFIRMATION_PHRASE = 'احذف البيانات القديمة';

export interface TableUsageItem {
  table_name: string;
  row_count: number;
  bytes: number;
}

export interface DatabaseUsageSnapshot {
  clinic_id: string;
  used_bytes: number;
  clinic_bytes: number;
  limit_bytes: number;
  remaining_bytes: number;
  percent_used: number;
  row_counts: Record<string, number>;
  table_bytes: Record<string, number>;
  tables: TableUsageItem[];
}

export interface PurgePreviewResult {
  clinic_id: string;
  older_than: string;
  counts: Record<string, number>;
  total_count: number;
}

export interface PurgeExecutionResult {
  clinic_id: string;
  older_than: string;
  deleted_counts: Record<string, number>;
  total_deleted: number;
}

export interface PurgeScopeOption {
  id: string;
  label: string;
  description: string;
  tables: string[];
  requiresFiveYears?: boolean;
}

export const ALLOWED_PURGE_SCOPE_OPTIONS: PurgeScopeOption[] = [
  {
    id: 'completed_visits',
    label: 'الزيارات المكتملة (visits)',
    description: 'حذف الزيارات المنتهية والمكتملة فقط (لا يمس الزيارات الجارية في الانتظار).',
    tables: ['visits'],
  },
  {
    id: 'finished_appointments',
    label: 'المواعيد المنتهية والملغاة (appointments)',
    description: 'حذف المواعيد المكتملة أو الملغاة أو الفائتة (لا يمس المواعيد المجدولة القادمة).',
    tables: ['appointments'],
  },
  {
    id: 'lab_radiology_orders',
    label: 'الطلبات المعملية والإشعاعية المنتهية (lab_orders & radiology_orders)',
    description: 'حذف طلبات التحاليل والأشعة المكتملة أو الملغاة الأقدم من تاريخ القطع.',
    tables: ['lab_orders', 'radiology_orders'],
  },
  {
    id: 'finished_follow_ups',
    label: 'المتابعات المنتهية (follow_ups)',
    description: 'حذف سجلات المتابعة والاستشارة المكتملة أو منتهية الصلاحية.',
    tables: ['follow_ups'],
  },
  {
    id: 'old_backups',
    label: 'النسخ الاحتياطية السحابية القديمة (backups)',
    description: 'حذف لقطات النسخ الاحتياطي القديمة المخزنة في جدول backups.',
    tables: ['backups'],
  },
  {
    id: 'invoices_payments',
    label: 'الفواتير والمدفوعات الأقدم من 5 سنوات (invoices & payments)',
    description: 'يتطلب أن يكون تاريخ القطع أقدم من 5 سنوات على الأقل التزاماً بسياسة الاحتفاظ المالي.',
    tables: ['invoices', 'payments'],
    requiresFiveYears: true,
  },
];

export const TABLE_ARABIC_LABELS: Record<string, string> = {
  patients: 'ملفات المرضى (patients)',
  appointments: 'المواعيد والحجوزات (appointments)',
  visits: 'الزيارات والكشوفات (visits)',
  invoices: 'الفواتير (invoices)',
  payments: 'المدفوعات (payments)',
  transactions: 'الحركات المالية (transactions)',
  prescriptions: 'الروشتات الطبية (prescriptions)',
  lab_orders: 'طلبات التحاليل (lab_orders)',
  radiology_orders: 'طلبات الأشعة (radiology_orders)',
  follow_ups: 'المتابعات (follow_ups)',
  medications: 'دليل الأدوية (medications)',
  lab_tests: 'دليل التحاليل (lab_tests)',
  radiology_types: 'دليل الأشعة (radiology_types)',
  diagnoses: 'دليل التشخيصات (diagnoses)',
  symptoms: 'دليل الأعراض (symptoms)',
  chronic_diseases: 'الأمراض المزمنة (chronic_diseases)',
  services: 'الخدمات الطبية (services)',
  expenses: 'المصروفات (expenses)',
  expense_categories: 'بنود المصروفات (expense_categories)',
  settings: 'الإعدادات (settings)',
  backups: 'النسخ الاحتياطية (backups)',
  counters: 'العدادات (counters)',
  audit_events: 'سجل المراجعة الأمني (audit_events)',
};

export function formatBytesToMB(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.00 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.01) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${mb.toFixed(2)} MB`;
}

export function getManualAuditCleanupSql(targetClinicId: string = clinicId): string {
  const safeClinicId = (targetClinicId || 'clinic_main').replace(/'/g, "''");
  return `begin;
alter table public.audit_events disable trigger trg_audit_events_immutable;

delete from public.audit_events
 where clinic_id = '${safeClinicId}'
   and created_at < now() - interval '365 days';

alter table public.audit_events enable trigger trg_audit_events_immutable;
commit;`;
}

export async function fetchDatabaseUsage(): Promise<DatabaseUsageSnapshot> {
  if (!supabase || !clinicId) {
    throw new Error('عميل قاعدة البيانات السحابية غير متصل حالياً.');
  }

  const { data, error } = await supabase.rpc('get_database_usage', {
    p_clinic_id: clinicId,
  });

  if (error) {
    throw new Error(error.message || 'تعذر قراءة استهلاك مساحة قاعدة البيانات.');
  }

  const raw = (data || {}) as Record<string, any>;
  const usedBytes = Number(raw.used_bytes ?? 0);
  const clinicBytes = Number(raw.clinic_bytes ?? 0);
  const limitBytes = Number(raw.limit_bytes ?? 524288000);
  const remainingBytes = Number(raw.remaining_bytes ?? Math.max(limitBytes - usedBytes, 0));
  const percentUsed = Number(raw.percent_used ?? ((usedBytes / Math.max(limitBytes, 1)) * 100));

  const tables: TableUsageItem[] = Array.isArray(raw.tables)
    ? raw.tables.map((t: any) => ({
        table_name: String(t.table_name || ''),
        row_count: Number(t.row_count ?? 0),
        bytes: Number(t.bytes ?? 0),
      }))
    : [];

  return {
    clinic_id: String(raw.clinic_id || clinicId),
    used_bytes: usedBytes,
    clinic_bytes: clinicBytes,
    limit_bytes: limitBytes,
    remaining_bytes: remainingBytes,
    percent_used: Number(percentUsed.toFixed(2)),
    row_counts: (raw.row_counts && typeof raw.row_counts === 'object' ? raw.row_counts : {}) as Record<string, number>,
    table_bytes: (raw.table_bytes && typeof raw.table_bytes === 'object' ? raw.table_bytes : {}) as Record<string, number>,
    tables,
  };
}

export async function previewOldDataPurge(
  olderThanIso: string,
  scopes: string[]
): Promise<PurgePreviewResult> {
  if (!supabase || !clinicId) {
    throw new Error('عميل قاعدة البيانات السحابية غير متصل حالياً.');
  }

  const { data, error } = await supabase.rpc('preview_purge', {
    p_clinic_id: clinicId,
    p_older_than: olderThanIso,
    p_scope: scopes,
  });

  if (error) {
    throw new Error(error.message || 'تعذر تنفيذ معاينة الحذف.');
  }

  const raw = (data || {}) as Record<string, any>;
  return {
    clinic_id: String(raw.clinic_id || clinicId),
    older_than: String(raw.older_than || olderThanIso),
    counts: (raw.counts && typeof raw.counts === 'object' ? raw.counts : {}) as Record<string, number>,
    total_count: Number(raw.total_count ?? 0),
  };
}

export async function executeOldDataPurge(
  olderThanIso: string,
  scopes: string[],
  confirmationPhrase: string
): Promise<PurgeExecutionResult> {
  if (!supabase || !clinicId) {
    throw new Error('عميل قاعدة البيانات السحابية غير متصل حالياً.');
  }

  const { data, error } = await supabase.rpc('purge_old_data', {
    p_clinic_id: clinicId,
    p_older_than: olderThanIso,
    p_scope: scopes,
    p_confirm: confirmationPhrase,
  });

  if (error) {
    throw new Error(error.message || 'تعذر تنفيذ حذف البيانات القديمة.');
  }

  const raw = (data || {}) as Record<string, any>;
  return {
    clinic_id: String(raw.clinic_id || clinicId),
    older_than: String(raw.older_than || olderThanIso),
    deleted_counts: (raw.deleted_counts && typeof raw.deleted_counts === 'object'
      ? raw.deleted_counts
      : {}) as Record<string, number>,
    total_deleted: Number(raw.total_deleted ?? 0),
  };
}
