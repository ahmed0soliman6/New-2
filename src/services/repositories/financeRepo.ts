import type { Invoice, Payment } from '../../types/database';
import { FirestoreCollections, subscribeCollection, type DbClient } from './common';

export const subscribeToInvoices = (
  db: DbClient,
  next: (items: Invoice[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Invoice>(db, FirestoreCollections.INVOICES, next, error);

export const subscribeToPayments = (
  db: DbClient,
  next: (items: Payment[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<Payment>(db, FirestoreCollections.PAYMENTS, next, error);

export const subscribeToServices = (
  db: DbClient,
  next: (items: any[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<any>(db, FirestoreCollections.SERVICES, next, error);

export const subscribeToExpenses = (
  db: DbClient,
  next: (items: any[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<any>(db, FirestoreCollections.EXPENSES, next, error);

export const subscribeToExpenseCategories = (
  db: DbClient,
  next: (items: any[]) => void,
  error: (reason: Error) => void
) => subscribeCollection<any>(db, FirestoreCollections.EXPENSE_CATEGORIES, next, error);
