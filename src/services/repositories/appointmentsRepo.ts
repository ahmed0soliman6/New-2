import type { Appointment, FollowUp } from '../../types/database';
import { FirestoreCollections, subscribeCollection, type DbClient } from './common';

export const subscribeToAppointments = (
  db: DbClient,
  next: (items: Appointment[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Appointment>(db, FirestoreCollections.APPOINTMENTS, next, error);

export const subscribeToFollowUps = (
  db: DbClient,
  next: (items: FollowUp[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<FollowUp>(db, FirestoreCollections.FOLLOW_UPS, next, error);
