import type { Firestore } from 'firebase/firestore';
import type { Visit, LabOrder, RadiologyOrder } from '../../types/database';
import { FirestoreCollections } from '../firebase/collections';
import { subscribeCollection } from './common';

export const subscribeToVisits = (
  db: Firestore,
  next: (items: Visit[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Visit>(db, FirestoreCollections.VISITS, next, error);

export const subscribeToLabOrders = (
  db: Firestore,
  next: (items: LabOrder[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<LabOrder>(db, FirestoreCollections.LAB_ORDERS, next, error);

export const subscribeToRadiologyOrders = (
  db: Firestore,
  next: (items: RadiologyOrder[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<RadiologyOrder>(db, FirestoreCollections.RADIOLOGY_ORDERS, next, error);
