import type { Visit, LabOrder, RadiologyOrder } from '../../types/database';
import { FirestoreCollections, subscribeCollection, type DbClient } from './common';

export const subscribeToVisits = (
  db: DbClient,
  next: (items: Visit[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Visit>(db, FirestoreCollections.VISITS, next, error);

export const subscribeToLabOrders = (
  db: DbClient,
  next: (items: LabOrder[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<LabOrder>(db, FirestoreCollections.LAB_ORDERS, next, error);

export const subscribeToRadiologyOrders = (
  db: DbClient,
  next: (items: RadiologyOrder[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<RadiologyOrder>(db, FirestoreCollections.RADIOLOGY_ORDERS, next, error);
