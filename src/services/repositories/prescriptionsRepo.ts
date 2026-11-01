import type {
  Prescription,
  Medication,
  LabTest,
  RadiologyType,
  Diagnosis,
  Symptom,
  ChronicDisease,
} from '../../types/database';
import { FirestoreCollections, subscribeCollection, type DbClient } from './common';

export const subscribeToPrescriptions = (
  db: DbClient,
  next: (items: Prescription[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Prescription>(db, FirestoreCollections.PRESCRIPTIONS, next, error);

export const subscribeToMedications = (
  db: DbClient,
  next: (items: Medication[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Medication>(db, FirestoreCollections.MEDICATIONS, next, error);

export const subscribeToLabTests = (
  db: DbClient,
  next: (items: LabTest[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<LabTest>(db, FirestoreCollections.LAB_TESTS, next, error);

export const subscribeToRadiologyTypes = (
  db: DbClient,
  next: (items: RadiologyType[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<RadiologyType>(db, FirestoreCollections.RADIOLOGY_TYPES, next, error);

export const subscribeToDiagnoses = (
  db: DbClient,
  next: (items: Diagnosis[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Diagnosis>(db, FirestoreCollections.DIAGNOSES, next, error);

export const subscribeToSymptoms = (
  db: DbClient,
  next: (items: Symptom[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Symptom>(db, FirestoreCollections.SYMPTOMS, next, error);

export const subscribeToChronicDiseases = (
  db: DbClient,
  next: (items: ChronicDisease[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<ChronicDisease>(db, FirestoreCollections.CHRONIC_DISEASES, next, error);
