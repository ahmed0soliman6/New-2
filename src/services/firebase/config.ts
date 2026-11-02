import { supabase } from '../supabase';

/**
 * Legacy compatibility stub after migration to Supabase.
 * Does NOT read any VITE_FIREBASE_* variables or initialize Firebase.
 */
export const firebaseConfig: Record<string, string | undefined> = {};

export const firebaseConfigured = Boolean(supabase);
export const firebaseConfigError: string | null = null;
export const firebaseApp: unknown = null;
export const auth: unknown = null;
export const db: unknown = supabase;

export function requireFirebase(): { auth: any; db: any } {
  throw new Error('تم إيقاف Firebase نهائياً والانتقال إلى Supabase.');
}

