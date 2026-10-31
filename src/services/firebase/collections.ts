/**
 * Soli Medical - Firestore Collections and Documents Constants
 * Single Source of Truth for collection names and settings document IDs.
 * Note: Values MUST match existing Firestore database schema exactly.
 */

export const FirestoreCollections = {
  PATIENTS: 'patients',
  APPOINTMENTS: 'appointments',
  FOLLOW_UPS: 'followUps',
  VISITS: 'visits',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PRESCRIPTIONS: 'prescriptions',
  LAB_ORDERS: 'labOrders',
  RADIOLOGY_ORDERS: 'radiologyOrders',
  MEDICATIONS: 'medications',
  LAB_TESTS: 'labTests',
  RADIOLOGY_TYPES: 'radiologyTypes',
  DIAGNOSES: 'diagnoses',
  SYMPTOMS: 'symptoms',
  CHRONIC_DISEASES: 'chronicDiseases',
  SERVICES: 'services',
  EXPENSES: 'expenses',
  EXPENSE_CATEGORIES: 'expenseCategories',
  USERS: 'users',
  BACKUPS: 'backups',
  SETTINGS: 'settings',
} as const;

export type FirestoreCollectionName =
  (typeof FirestoreCollections)[keyof typeof FirestoreCollections];

export const SettingsDocs = {
  DOCTOR_SETTINGS: 'doctorSettings',
  DOCTOR_PROFILE: 'doctorProfile',
  SYSTEM_SETTINGS: 'systemSettings',
  PRESCRIPTION_SETTINGS: 'prescriptionSettings',
  PRINTER_SETTINGS: 'printerSettings',
  LIFESTYLE_PRESETS: 'lifestylePresets',
  ALERT_SETTINGS: 'alertSettings',
  CLINIC_STATUS: 'clinicStatus',
  RECURRING_TEMPLATES: 'recurringTemplates',
  VISIT_TYPES: 'visitTypes',
  LATEST_ALERT: 'latestAlert',
} as const;

export type SettingsDocId =
  (typeof SettingsDocs)[keyof typeof SettingsDocs];
