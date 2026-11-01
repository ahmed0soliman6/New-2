import type {
  DoctorSettings,
  SystemSettings,
  DoctorProfile,
} from '../../types/database';
import { supabase, clinicId } from '../supabase';
import {
  FirestoreCollections,
  SettingsDocs,
  handleFirestoreError,
  normalize,
  OperationType,
  saveSettingsDocument,
  type DbClient,
  type UnsubscribeFn,
} from './common';

export interface ClinicStatusState {
  status: 'available' | 'break';
  updatedAt: string;
  updatedBy: string;
  message?: string;
}

let settingsChannelSeq = 0;

function subscribeSettingDoc<T>(
  docId: string,
  extract: (raw: Record<string, any>) => T | null,
  next: (val: T | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn {
  if (!supabase) {
    error(new Error('عميل Supabase غير مهيأ.'));
    return () => {};
  }

  const client = supabase;
  let isCancelled = false;

  const fetchDoc = async () => {
    try {
      const { data: row, error: queryErr } = await client
        .from(FirestoreCollections.SETTINGS)
        .select('id, data, updated_at')
        .eq('clinic_id', clinicId)
        .eq('id', docId)
        .maybeSingle();

      if (isCancelled) return;

      if (queryErr) {
        error(
          handleFirestoreError(
            new Error(queryErr.message),
            OperationType.GET,
            `${FirestoreCollections.SETTINGS}/${docId}`
          )
        );
        return;
      }

      if (row && row.data && typeof row.data === 'object') {
        const normalized = normalize(row.data) as Record<string, any>;
        next(extract(normalized));
      } else {
        next(null);
      }
    } catch (err) {
      if (!isCancelled) {
        error(
          handleFirestoreError(
            err,
            OperationType.GET,
            `${FirestoreCollections.SETTINGS}/${docId}`
          )
        );
      }
    }
  };

  void fetchDoc();

  const channelName = `settings_${docId}_${clinicId}_${++settingsChannelSeq}`;
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: FirestoreCollections.SETTINGS,
        filter: `clinic_id=eq.${clinicId}`,
      },
      (payload) => {
        if (isCancelled) return;
        const newRow = payload.new as { id?: string } | undefined;
        const oldRow = payload.old as { id?: string } | undefined;
        if (!newRow?.id && !oldRow?.id) {
          void fetchDoc();
          return;
        }
        if (newRow?.id === docId || oldRow?.id === docId) {
          void fetchDoc();
        }
      }
    )
    .subscribe();

  return () => {
    isCancelled = true;
    void client.removeChannel(channel);
  };
}

export const subscribeToDoctorSettings = (
  _db: DbClient,
  next: (settings: DoctorSettings | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<DoctorSettings>(
    SettingsDocs.DOCTOR_SETTINGS,
    (data) => data as DoctorSettings,
    next,
    error
  );
};

export const subscribeToVisitTypes = (
  _db: DbClient,
  next: (types: { id: string; name: string; fee: number }[] | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<{ id: string; name: string; fee: number }[]>(
    SettingsDocs.VISIT_TYPES,
    (data) => ((data.items || data.types || []) as { id: string; name: string; fee: number }[]),
    next,
    error
  );
};

export const subscribeToPrinterSettings = <T = Record<string, unknown>>(
  _db: DbClient,
  next: (settings: T | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<T>(
    SettingsDocs.PRINTER_SETTINGS,
    (data) => data as T,
    next,
    error
  );
};

export const subscribeToLifestylePresets = (
  _db: DbClient,
  next: (presets: string[] | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<string[]>(
    SettingsDocs.LIFESTYLE_PRESETS,
    (data) => (data.items as string[]) || [],
    next,
    error
  );
};

export const subscribeToAlertSettings = (
  _db: DbClient,
  next: (settings: any | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<any>(
    SettingsDocs.ALERT_SETTINGS,
    (data) => data,
    next,
    error
  );
};

export const subscribeToClinicStatus = (
  _db: DbClient,
  next: (status: ClinicStatusState | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<ClinicStatusState>(
    SettingsDocs.CLINIC_STATUS,
    (data) => data as ClinicStatusState,
    next,
    error
  );
};

export const updateClinicStatusInFirestore = async (
  db: DbClient,
  status: 'available' | 'break',
  updatedBy: string
) => {
  await saveSettingsDocument(db, SettingsDocs.CLINIC_STATUS, {
    status,
    updatedAt: new Date().toISOString(),
    updatedBy,
    message: status === 'break' ? 'الطبيب في فترة استراحة ☕' : 'الطبيب متاح الآن للكشف 🟢',
  });
};

export const subscribeToRecurringTemplates = (
  _db: DbClient,
  next: (templates: any[] | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<any[]>(
    SettingsDocs.RECURRING_TEMPLATES,
    (data) => (data.items as any[]) || [],
    next,
    error
  );
};

export const subscribeToDoctorProfile = (
  _db: DbClient,
  next: (profile: DoctorProfile | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<DoctorProfile>(
    SettingsDocs.DOCTOR_PROFILE,
    (data) => data as DoctorProfile,
    next,
    error
  );
};

export const subscribeToSystemSettings = (
  _db: DbClient,
  next: (settings: SystemSettings | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<SystemSettings>(
    SettingsDocs.SYSTEM_SETTINGS,
    (data) => data as SystemSettings,
    next,
    error
  );
};

export const subscribeToPrescriptionSettings = <T = Record<string, unknown>>(
  _db: DbClient,
  next: (settings: T | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<T>(
    SettingsDocs.PRESCRIPTION_SETTINGS,
    (data) => data as T,
    next,
    error
  );
};

export const subscribeToLatestAlert = <T = Record<string, unknown>>(
  _db: DbClient,
  next: (alert: T | null) => void,
  error: (reason: Error) => void
): UnsubscribeFn => {
  return subscribeSettingDoc<T>(
    SettingsDocs.LATEST_ALERT,
    (data) => data as T,
    next,
    error
  );
};

export async function publishAlert(
  db: DbClient,
  alert: {
    id: string;
    type: string;
    title: string;
    message: string;
    ticket?: string;
    timestamp: string;
    patientId?: string;
    visitId?: string;
    senderId?: string;
  }
): Promise<void> {
  await saveSettingsDocument(db, SettingsDocs.LATEST_ALERT, {
    ...alert,
    updatedAt: new Date().toISOString(),
  });
}
