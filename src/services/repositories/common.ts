import { supabase, clinicId } from '../supabase';
import {
  getCachedTableRows,
  putCachedTableRows,
  deleteCachedTableRow,
  enqueueOfflineMutation,
  syncTableIncremental,
  notifyTableMutated,
  markLocalWrite,
} from '../offlineSync';

export type DbClient = unknown;
export type UnsubscribeFn = () => void;

export const FirestoreCollections = {
  PATIENTS: 'patients',
  APPOINTMENTS: 'appointments',
  FOLLOW_UPS: 'follow_ups',
  VISITS: 'visits',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PRESCRIPTIONS: 'prescriptions',
  LAB_ORDERS: 'lab_orders',
  RADIOLOGY_ORDERS: 'radiology_orders',
  MEDICATIONS: 'medications',
  LAB_TESTS: 'lab_tests',
  RADIOLOGY_TYPES: 'radiology_types',
  DIAGNOSES: 'diagnoses',
  SYMPTOMS: 'symptoms',
  CHRONIC_DISEASES: 'chronic_diseases',
  SERVICES: 'services',
  EXPENSES: 'expenses',
  EXPENSE_CATEGORIES: 'expense_categories',
  USERS: 'clinic_members',
  BACKUPS: 'backups',
  SETTINGS: 'settings',
} as const;

export type FirestoreCollectionName =
  (typeof FirestoreCollections)[keyof typeof FirestoreCollections];

export const SettingsDocs = {
  DOCTOR_SETTINGS: 'doctorSettings',
  DOCTOR_PROFILE: 'doctorProfile',
  SYSTEM_SETTINGS: 'systemSettings',
  PRESCRIPTION_SETTINGS: 'prescriptionSettings',
  PRINTER_SETTINGS: 'printerSettings',
  LIFESTYLE_PRESETS: 'lifestylePresets',
  ALERT_SETTINGS: 'alertSettings',
  CLINIC_STATUS: 'clinicStatus',
  RECURRING_TEMPLATES: 'recurringTemplates',
  VISIT_TYPES: 'visitTypes',
  LATEST_ALERT: 'latestAlert',
} as const;

export type SettingsDocId =
  (typeof SettingsDocs)[keyof typeof SettingsDocs];

/**
 * Maps legacy camelCase collection names and current names to the exact Postgres table name in schema.sql
 */
export const TABLE_NAME_MAP: Record<string, string> = {
  patients: 'patients',
  appointments: 'appointments',
  followUps: 'follow_ups',
  follow_ups: 'follow_ups',
  visits: 'visits',
  invoices: 'invoices',
  payments: 'payments',
  transactions: 'transactions',
  prescriptions: 'prescriptions',
  labOrders: 'lab_orders',
  lab_orders: 'lab_orders',
  radiologyOrders: 'radiology_orders',
  radiology_orders: 'radiology_orders',
  medications: 'medications',
  labTests: 'lab_tests',
  lab_tests: 'lab_tests',
  radiologyTypes: 'radiology_types',
  radiology_types: 'radiology_types',
  diagnoses: 'diagnoses',
  symptoms: 'symptoms',
  chronicDiseases: 'chronic_diseases',
  chronic_diseases: 'chronic_diseases',
  services: 'services',
  expenses: 'expenses',
  expenseCategories: 'expense_categories',
  expense_categories: 'expense_categories',
  backups: 'backups',
  settings: 'settings',
  counters: 'counters',
  users: 'clinic_members',
  clinic_members: 'clinic_members',
};

export function resolveTableName(name: string): string {
  return TABLE_NAME_MAP[name] || name;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): Error {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path,
  };
  const jsonString = JSON.stringify(errInfo);
  console.warn('[Data Sync Info]', jsonString);
  return new Error(jsonString);
}

export function normalize(value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)])
    );
  }
  return value;
}

export const ID_FIELD_MAP: Record<string, string> = {
  patients: 'patientId',
  appointments: 'appointmentId',
  visits: 'visitId',
  invoices: 'invoiceId',
  payments: 'paymentId',
  prescriptions: 'prescriptionId',
  follow_ups: 'followUpId',
  followUps: 'followUpId',
  lab_orders: 'labOrderId',
  labOrders: 'labOrderId',
  radiology_orders: 'radiologyOrderId',
  radiologyOrders: 'radiologyOrderId',
  medications: 'medicationId',
  lab_tests: 'labTestId',
  labTests: 'labTestId',
  radiology_types: 'radiologyId',
  radiologyTypes: 'radiologyId',
  diagnoses: 'diagnosisId',
  symptoms: 'symptomId',
  chronic_diseases: 'diseaseId',
  chronicDiseases: 'diseaseId',
};

export interface SupabaseDocRow {
  id: string;
  data: Record<string, unknown>;
  updated_at?: string;
}

export function mapDocs<T>(
  name: string,
  source:
    | SupabaseDocRow[]
    | { docs: Array<{ id: string; data: () => Record<string, unknown> }> }
): T[] {
  const idField = ID_FIELD_MAP[name] || ID_FIELD_MAP[resolveTableName(name)] || 'id';
  if (Array.isArray(source)) {
    return source.map((row) => {
      const data = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>;
      return normalize({
        ...data,
        [idField]: data[idField] || row.id,
      }) as T;
    });
  }
  return source.docs.map((item) => {
    const data = item.data();
    return normalize({
      ...data,
      [idField]: data[idField] || item.id,
    }) as T;
  });
}

function evaluateConstraints<T>(items: T[], constraints: unknown[]): T[] {
  if (!constraints || constraints.length === 0) return items;
  let result = [...items];

  for (const rawConstraint of constraints) {
    if (!rawConstraint || typeof rawConstraint !== 'object') continue;
    const c = rawConstraint as Record<string, any>;
    const type = c.type;

    if (type === 'where') {
      const segments: string[] | undefined = c._field?.segments;
      const fieldName = Array.isArray(segments) && segments.length > 0 ? segments[0] : c.field;
      const op: string | undefined = c._op ?? c.op;
      const targetVal = c._value ?? c.value;
      if (!fieldName || !op) continue;

      result = result.filter((item) => {
        const rec = item as Record<string, any>;
        const actualVal = rec[fieldName];
        switch (op) {
          case '==':
            return actualVal === targetVal;
          case '!=':
            return actualVal !== targetVal;
          case '>=':
            return actualVal !== undefined && actualVal !== null && actualVal >= targetVal;
          case '<=':
            return actualVal !== undefined && actualVal !== null && actualVal <= targetVal;
          case '>':
            return actualVal !== undefined && actualVal !== null && actualVal > targetVal;
          case '<':
            return actualVal !== undefined && actualVal !== null && actualVal < targetVal;
          case 'in':
            return Array.isArray(targetVal) && targetVal.includes(actualVal);
          default:
            return true;
        }
      });
    } else if (type === 'limit') {
      const limitCount = Number(c._limit ?? c.limit);
      if (Number.isFinite(limitCount) && limitCount > 0) {
        result = result.slice(0, limitCount);
      }
    }
  }

  return result;
}

const SYNC_POLL_INTERVAL_MS = 15000;

export function subscribeQuery<T>(
  _db: DbClient,
  name: FirestoreCollectionName | string,
  constraints: unknown[],
  next: (items: T[]) => void,
  error: (reason: Error) => void,
  _label?: string
): UnsubscribeFn {
  const tableName = resolveTableName(String(name));
  let isCancelled = false;

  const emitRows = (rows: SupabaseDocRow[]) => {
    if (isCancelled) return;
    const mapped = mapDocs<T>(tableName, rows);
    const filtered = evaluateConstraints<T>(mapped, constraints);
    next(filtered);
  };

  const runSync = async (forceFull = false) => {
    try {
      const { rows, error: syncErr } = await syncTableIncremental(tableName, forceFull);
      if (isCancelled) return;
      if (syncErr && !rows.length) {
        error(handleFirestoreError(syncErr, OperationType.LIST, tableName));
        return;
      }
      emitRows(rows);
    } catch (err) {
      if (!isCancelled) {
        error(handleFirestoreError(err, OperationType.LIST, tableName));
      }
    }
  };

  // 1. Emit immediately from IndexedDB cache if available, then sync with Supabase
  void getCachedTableRows(tableName).then((cached) => {
    if (!isCancelled && cached.length > 0) {
      emitRows(cached);
    }
    if (!isCancelled) {
      void runSync(cached.length === 0);
    }
  });

  // 2. Listen for local mutations / online recovery events
  const handleMutated = (evt: Event) => {
    if (isCancelled) return;
    const detail = (evt as CustomEvent<{ tables?: string[]; forceFull?: boolean }>).detail;
    const tables = detail?.tables || [];
    if (tables.includes('*') || tables.includes(tableName)) {
      void runSync(Boolean(detail?.forceFull));
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('soli_supabase_mutated', handleMutated);
  }

  // 3. Incremental polling via updated_at (no Realtime channels)
  const intervalId = setInterval(() => {
    if (!isCancelled && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
      void runSync(false);
    }
  }, SYNC_POLL_INTERVAL_MS);

  return () => {
    isCancelled = true;
    clearInterval(intervalId);
    if (typeof window !== 'undefined') {
      window.removeEventListener('soli_supabase_mutated', handleMutated);
    }
  };
}

export function subscribeCollection<T>(
  db: DbClient,
  name: FirestoreCollectionName | string,
  next: (items: T[]) => void,
  error: (reason: Error) => void
): UnsubscribeFn {
  return subscribeQuery<T>(db, name, [], next, error);
}

export async function saveCatalogItem<T extends Record<string, unknown>>(
  _db: DbClient,
  collectionName: FirestoreCollectionName | string,
  itemId: string,
  data: T
): Promise<void> {
  const tableName = resolveTableName(String(collectionName));
  const nowIso = new Date().toISOString();

  const cachedRows = await getCachedTableRows(tableName);
  const cachedExisting = cachedRows.find((r) => r.id === itemId);
  const localPrev =
    cachedExisting?.data && typeof cachedExisting.data === 'object'
      ? cachedExisting.data
      : {};

  const optimisticMerged = { ...localPrev, ...data };
  markLocalWrite(tableName, itemId, optimisticMerged, nowIso);
  await putCachedTableRows(tableName, [{ id: itemId, data: optimisticMerged, updated_at: nowIso }]);

  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    await enqueueOfflineMutation('upsert', tableName, itemId, optimisticMerged, nowIso);
    notifyTableMutated(tableName, false);
    return;
  }

  try {
    const { data: existing } = await supabase
      .from(tableName)
      .select('data')
      .eq('clinic_id', clinicId)
      .eq('id', itemId)
      .maybeSingle();

    const prevData =
      existing?.data && typeof existing.data === 'object'
        ? (existing.data as Record<string, unknown>)
        : localPrev;

    const mergedData = {
      ...prevData,
      ...localPrev,
      ...data,
    };

    markLocalWrite(tableName, itemId, mergedData, nowIso);

    const { error: upsertErr } = await supabase.from(tableName).upsert(
      {
        clinic_id: clinicId,
        id: itemId,
        data: mergedData,
      },
      { onConflict: 'clinic_id,id' }
    );

    if (upsertErr) {
      throw new Error(upsertErr.message);
    }

    await putCachedTableRows(tableName, [{ id: itemId, data: mergedData, updated_at: nowIso }]);
    notifyTableMutated(tableName, false);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, `${tableName}/${itemId}`);
  }
}

export async function removeCatalogItem(
  _db: DbClient,
  collectionName: FirestoreCollectionName | string,
  itemId: string
): Promise<void> {
  const tableName = resolveTableName(String(collectionName));

  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    await deleteCachedTableRow(tableName, itemId);
    await enqueueOfflineMutation('delete', tableName, itemId);
    notifyTableMutated(tableName, false);
    return;
  }

  try {
    const { error: delErr } = await supabase
      .from(tableName)
      .delete()
      .eq('clinic_id', clinicId)
      .eq('id', itemId);

    if (delErr) {
      throw new Error(delErr.message);
    }

    await deleteCachedTableRow(tableName, itemId);
    notifyTableMutated(tableName, false);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, `${tableName}/${itemId}`);
  }
}

export async function saveSettingsDocument<T extends Record<string, unknown>>(
  _db: DbClient,
  docName: SettingsDocId | string,
  data: T
): Promise<void> {
  await saveCatalogItem(_db, FirestoreCollections.SETTINGS, String(docName), data);
}

