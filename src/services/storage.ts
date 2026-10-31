/**
 * Soli Medical - Centralized Storage Adapter & Keys
 * Provides safe, typed read/write access to LocalStorage with automatic JSON parse/serialize error handling.
 */

export const StorageKeys = {
  THEME: 'soli_clinic_theme',
  LANGUAGE: 'soli_clinic_language',
  ACTIVE_SCREEN: 'soli_clinic_active_screen',
  PRESCRIPTION_SETTINGS: 'soli_prescription_settings',
  CLINIC_BRANCHES: 'soli_clinic_branches',
  CLINIC_DB_INITIALIZED: 'soli_clinic_db_initialized',
  CLINIC_EXPENSES: 'soli_clinic_expenses',
  VISIT_TYPES: 'soli_visit_types',
  FREE_FOLLOWUP_DAYS: 'soli_free_followup_days',
  RECURRING_TEMPLATES: 'soli_recurring_templates',
  PRINTER_PAPER: 'soli_printer_paper',
  AUTO_PRINT: 'soli_auto_print',
  EXAM_DISPLAY_SETTINGS: 'soli_clinic_exam_display_settings_v1',
  LIFESTYLE_PRESETS: 'soli_lifestyle_presets',
  CLINIC_STATUS_EVENT: 'soli_clinic_status_event',
  // Catalogs cache
  MEDICATIONS_CATALOG: 'soli_medications_catalog',
  LAB_CATALOG: 'soli_lab_catalog',
  RADIOLOGY_CATALOG: 'soli_radiology_catalog',
  DIAGNOSES_CATALOG: 'soli_diagnoses_catalog',
  SYMPTOMS_CATALOG: 'soli_symptoms_catalog',
  CHRONIC_DISEASES_CATALOG: 'soli_chronic_diseases_catalog',
  // Finance
  SERVICES: 'soli_medical_services',
  EXPENSE_CATEGORIES: 'soli_expense_categories',
  EXPENSES: 'soli_clinic_expenses',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys] | string;

export const safeStorage = {
  /**
   * Get raw string value from localStorage safely
   */
  getItem(key: StorageKey, defaultValue: string | null = null): string | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
      const val = window.localStorage.getItem(key);
      return val !== null ? val : defaultValue;
    } catch (err) {
      console.warn(`[Storage] Failed to read key "${key}":`, err);
      return defaultValue;
    }
  },

  /**
   * Set raw string value to localStorage safely
   */
  setItem(key: StorageKey, value: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.warn(`[Storage] Failed to set key "${key}":`, err);
      return false;
    }
  },

  /**
   * Get parsed JSON object safely from localStorage
   */
  getJSON<T>(key: StorageKey, defaultValue: T): T {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
      const raw = window.localStorage.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[Storage] Failed to parse JSON for key "${key}":`, err);
      return defaultValue;
    }
  },

  /**
   * Serialize and store JSON object safely in localStorage
   */
  setJSON<T>(key: StorageKey, data: T): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn(`[Storage] Failed to serialize JSON for key "${key}":`, err);
      return false;
    }
  },

  /**
   * Remove item from localStorage safely
   */
  removeItem(key: StorageKey): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      window.localStorage.removeItem(key);
      return true;
    } catch (err) {
      console.warn(`[Storage] Failed to remove key "${key}":`, err);
      return false;
    }
  },
};
