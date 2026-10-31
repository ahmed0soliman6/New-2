import {
  doc,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  DoctorSettings,
  SystemSettings,
  DoctorProfile,
} from '../../types/database';
import { FirestoreCollections, SettingsDocs } from '../firebase/collections';
import { handleFirestoreError, normalize, OperationType } from './common';
import { meterDoc } from '../readMeter';

export interface ClinicStatusState {
  status: 'available' | 'break';
  updatedAt: string;
  updatedBy: string;
  message?: string;
}

export const subscribeToDoctorSettings = (
  db: Firestore,
  next: (settings: DoctorSettings | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.DOCTOR_SETTINGS),
    (snap) => {
      meterDoc('settings/doctorSettings', snap);
      if (snap.exists()) {
        next(normalize(snap.data()) as DoctorSettings);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.DOCTOR_SETTINGS}`));
    }
  );
};

export const subscribeToVisitTypes = (
  db: Firestore,
  next: (types: { id: string; name: string; fee: number }[] | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.VISIT_TYPES),
    (snap) => {
      meterDoc('settings/visitTypes', snap);
      if (snap.exists()) {
        const data = snap.data();
        next(((data.items || data.types || []) as { id: string; name: string; fee: number }[]));
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.VISIT_TYPES}`));
    }
  );
};

export const subscribeToPrinterSettings = <T = Record<string, unknown>>(
  db: Firestore,
  next: (settings: T | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.PRINTER_SETTINGS),
    (snap) => {
      meterDoc('settings/printerSettings', snap);
      if (snap.exists()) {
        next(normalize(snap.data()) as T);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.PRINTER_SETTINGS}`));
    }
  );
};

export const subscribeToLifestylePresets = (
  db: Firestore,
  next: (presets: string[] | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.LIFESTYLE_PRESETS),
    (snap) => {
      meterDoc('settings/lifestylePresets', snap);
      if (snap.exists()) {
        const data = snap.data();
        next((data.items as string[]) || []);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.LIFESTYLE_PRESETS}`));
    }
  );
};

export const subscribeToAlertSettings = (
  db: Firestore,
  next: (settings: any | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.ALERT_SETTINGS),
    (snap) => {
      meterDoc('settings/alertSettings', snap);
      if (snap.exists()) {
        next(normalize(snap.data()));
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.ALERT_SETTINGS}`));
    }
  );
};

export const subscribeToClinicStatus = (
  db: Firestore,
  next: (status: ClinicStatusState | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.CLINIC_STATUS),
    (snap) => {
      meterDoc('settings/clinicStatus', snap);
      if (snap.exists()) {
        next(snap.data() as ClinicStatusState);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.CLINIC_STATUS}`));
    }
  );
};

export const updateClinicStatusInFirestore = async (
  db: Firestore,
  status: 'available' | 'break',
  updatedBy: string
) => {
  const ref = doc(db, FirestoreCollections.SETTINGS, SettingsDocs.CLINIC_STATUS);
  await setDoc(
    ref,
    {
      status,
      updatedAt: new Date().toISOString(),
      updatedBy,
      message: status === 'break' ? 'الطبيب في فترة استراحة ☕' : 'الطبيب متاح الآن للكشف 🟢',
    },
    { merge: true }
  );
};

export const subscribeToRecurringTemplates = (
  db: Firestore,
  next: (templates: any[] | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.RECURRING_TEMPLATES),
    (snap) => {
      meterDoc('settings/recurringTemplates', snap);
      if (snap.exists()) {
        const data = snap.data();
        next((data.items as any[]) || []);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.RECURRING_TEMPLATES}`));
    }
  );
};

export const subscribeToDoctorProfile = (
  db: Firestore,
  next: (profile: DoctorProfile | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.DOCTOR_PROFILE),
    (snap) => {
      meterDoc('settings/doctorProfile', snap);
      if (snap.exists()) {
        next(normalize(snap.data()) as DoctorProfile);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.DOCTOR_PROFILE}`));
    }
  );
};

export const subscribeToSystemSettings = (
  db: Firestore,
  next: (settings: SystemSettings | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.SYSTEM_SETTINGS),
    (snap) => {
      meterDoc('settings/systemSettings', snap);
      if (snap.exists()) {
        next(normalize(snap.data()) as SystemSettings);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.SYSTEM_SETTINGS}`));
    }
  );
};

export const subscribeToPrescriptionSettings = <T = Record<string, unknown>>(
  db: Firestore,
  next: (settings: T | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.PRESCRIPTION_SETTINGS),
    (snap) => {
      meterDoc('settings/prescriptionSettings', snap);
      if (snap.exists()) {
        next(normalize(snap.data()) as T);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.PRESCRIPTION_SETTINGS}`));
    }
  );
};

export const subscribeToLatestAlert = <T = Record<string, unknown>>(
  db: Firestore,
  next: (alert: T | null) => void,
  error: (reason: Error) => void
): Unsubscribe => {
  return onSnapshot(
    doc(db, FirestoreCollections.SETTINGS, SettingsDocs.LATEST_ALERT),
    (snap) => {
      meterDoc('settings/latestAlert', snap);
      if (snap.exists()) {
        next(normalize(snap.data()) as T);
      } else {
        next(null);
      }
    },
    (reason) => {
      error(handleFirestoreError(reason, OperationType.GET, `${FirestoreCollections.SETTINGS}/${SettingsDocs.LATEST_ALERT}`));
    }
  );
};

export async function publishAlert(
  db: Firestore,
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
  const ref = doc(db, FirestoreCollections.SETTINGS, SettingsDocs.LATEST_ALERT);
  await setDoc(ref, {
    ...alert,
    updatedAt: new Date().toISOString(),
  });
}

