import type { Firestore } from 'firebase/firestore';
import type { Invoice, Payment } from '../../types/database';
import { FirestoreCollections } from '../firebase/collections';
import { subscribeCollection } from './common';

export const subscribeToInvoices = (
  db: Firestore,
  next: (items: Invoice[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Invoice>(db, FirestoreCollections.INVOICES, next, error);

export const subscribeToPayments = (
  db: Firestore,
  next: (items: Payment[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Payment>(db, FirestoreCollections.PAYMENTS, next, error);

export const subscribeToServices = (
  db: Firestore,
  next: (items: any[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<any>(db, FirestoreCollections.SERVICES, next, error);

export const subscribeToExpenses = (
  db: Firestore,
  next: (items: any[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<any>(db, FirestoreCollections.EXPENSES, next, error);

export const subscribeToExpenseCategories = (
  db: Firestore,
  next: (items: any[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<any>(db, FirestoreCollections.EXPENSE_CATEGORIES, next, error);
