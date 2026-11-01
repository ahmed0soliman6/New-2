import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Legacy compatibility stub while completing migration to Supabase.
 * Does NOT read any VITE_FIREBASE_* variables or initialize Firebase.
 */
export const firebaseConfig: Record<string, string | undefined> = {};

export const firebaseConfigured = false;
export const firebaseConfigError: string | null = null;
export const firebaseApp: FirebaseApp | null = null;
export const auth: Auth | null = null;
export const db: Firestore | null = null;

export function requireFirebase(): { auth: Auth; db: Firestore } {
  throw new Error('تم إيقاف Firebase نهائياً والانتقال إلى Supabase.');
}
