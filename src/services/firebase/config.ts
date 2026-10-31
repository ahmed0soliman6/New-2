import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';

/**
 * Single source of truth for Firebase configuration across Soli Medical.
 * Loaded from Vite environment variables (VITE_FIREBASE_*).
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

export const firebaseConfigError = firebaseConfigured
  ? null
  : 'أضف إعدادات Firebase في متغيرات VITE_FIREBASE_* قبل تسجيل الدخول.';

export const firebaseApp: FirebaseApp | null = firebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

// Initialize Firestore with robust fallback mechanism for sandboxed Iframe environments where IndexedDB might be restricted
let dbInstance: Firestore | null = null;
if (firebaseApp) {
  try {
    dbInstance = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      experimentalForceLongPolling: true,
    });
  } catch (err) {
    console.warn(
      'Persistent local cache failed to initialize (usually due to IndexedDB being blocked in nested iframe sandboxes). Falling back to memory cache:',
      err
    );
    try {
      dbInstance = initializeFirestore(firebaseApp, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
      });
    } catch (fallbackErr) {
      console.error('Firestore fallback memory cache initialization failed:', fallbackErr);
    }
  }
}

export const db: Firestore | null = dbInstance;

export function requireFirebase(): { auth: Auth; db: Firestore } {
  if (!auth || !db) throw new Error(firebaseConfigError ?? 'Firebase is not configured');
  return { auth, db };
}
