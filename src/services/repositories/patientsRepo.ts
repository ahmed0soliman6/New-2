import type { Patient } from '../../types/database';
import { FirestoreCollections, subscribeCollection, type DbClient } from './common';

export const subscribeToPatients = (
  db: DbClient,
  next: (items: Patient[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Patient>(db, FirestoreCollections.PATIENTS, next, error);
