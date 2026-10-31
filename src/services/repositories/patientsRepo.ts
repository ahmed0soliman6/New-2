import type { Firestore } from 'firebase/firestore';
import type { Patient } from '../../types/database';
import { FirestoreCollections } from '../firebase/collections';
import { subscribeCollection } from './common';

export const subscribeToPatients = (
  db: Firestore,
  next: (items: Patient[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Patient>(db, FirestoreCollections.PATIENTS, next, error);
