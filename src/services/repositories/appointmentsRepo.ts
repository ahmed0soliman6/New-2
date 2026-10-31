import type { Firestore } from 'firebase/firestore';
import type { Appointment, FollowUp } from '../../types/database';
import { FirestoreCollections } from '../firebase/collections';
import { subscribeCollection } from './common';

export const subscribeToAppointments = (
  db: Firestore,
  next: (items: Appointment[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Appointment>(db, FirestoreCollections.APPOINTMENTS, next, error);

export const subscribeToFollowUps = (
  db: Firestore,
  next: (items: FollowUp[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<FollowUp>(db, FirestoreCollections.FOLLOW_UPS, next, error);
