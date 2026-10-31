import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  type QueryConstraint,
  type QuerySnapshot,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import { meterQuery } from '../readMeter';
import { auth } from '../firebase';
import { FirestoreCollections, SettingsDocs, type FirestoreCollectionName, type SettingsDocId } from '../firebase/collections';

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): Error {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
    },
    operationType,
    path,
  };
  const jsonString = JSON.stringify(errInfo);
  console.warn('[Firestore Sync Info]', jsonString);
  return new Error(jsonString);
}

export function normalize(value: unknown): unknown {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

export const ID_FIELD_MAP: Record<string, string> = {
  [FirestoreCollections.PATIENTS]: 'patientId',
  [FirestoreCollections.APPOINTMENTS]: 'appointmentId',
  [FirestoreCollections.VISITS]: 'visitId',
  [FirestoreCollections.INVOICES]: 'invoiceId',
  [FirestoreCollections.PAYMENTS]: 'paymentId',
  [FirestoreCollections.PRESCRIPTIONS]: 'prescriptionId',
  [FirestoreCollections.FOLLOW_UPS]: 'followUpId',
  [FirestoreCollections.LAB_ORDERS]: 'labOrderId',
  [FirestoreCollections.RADIOLOGY_ORDERS]: 'radiologyOrderId',
  [FirestoreCollections.MEDICATIONS]: 'medicationId',
  [FirestoreCollections.LAB_TESTS]: 'labTestId',
  [FirestoreCollections.RADIOLOGY_TYPES]: 'radiologyId',
  [FirestoreCollections.DIAGNOSES]: 'diagnosisId',
  [FirestoreCollections.SYMPTOMS]: 'symptomId',
  [FirestoreCollections.CHRONIC_DISEASES]: 'diseaseId',
};

export function mapDocs<T>(name: string, snapshot: QuerySnapshot): T[] {
  const idField = ID_FIELD_MAP[name] || 'id';
  return snapshot.docs.map((item) => {
    const data = item.data();
    return normalize({ ...data, [idField]: data[idField] || item.id }) as T;
  });
}

export function subscribeQuery<T>(
  db: Firestore,
  name: FirestoreCollectionName | string,
  constraints: QueryConstraint[],
  next: (items: T[]) => void,
  error: (reason: Error) => void,
  label?: string
): Unsubscribe {
  return onSnapshot(
    query(collection(db, name), ...constraints),
    (snapshot) => {
      meterQuery(label ?? name, snapshot);
      next(mapDocs<T>(name, snapshot));
    },
    (reason) => error(handleFirestoreError(reason, OperationType.LIST, name))
  );
}

export function subscribeCollection<T>(
  db: Firestore,
  name: FirestoreCollectionName | string,
  next: (items: T[]) => void,
  error: (reason: Error) => void
): Unsubscribe {
  return subscribeQuery<T>(db, name, [], next, error);
}

export async function saveCatalogItem<T extends Record<string, unknown>>(
  db: Firestore,
  collectionName: FirestoreCollectionName | string,
  itemId: string,
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, itemId);
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${itemId}`);
  }
}

export async function removeCatalogItem(
  db: Firestore,
  collectionName: FirestoreCollectionName | string,
  itemId: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, itemId);
    await deleteDoc(docRef);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${itemId}`);
  }
}

export async function saveSettingsDocument<T extends Record<string, unknown>>(
  db: Firestore,
  docName: SettingsDocId | string,
  data: T
): Promise<void> {
  try {
    const docRef = doc(db, FirestoreCollections.SETTINGS, docName);
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, `${FirestoreCollections.SETTINGS}/${docName}`);
  }
}
