import { safeStorage, StorageKeys } from '../services/storage';

export interface ExamDisplaySettings {
  showVitals: boolean;
  showLabs: boolean;
  showRadiology: boolean;
}

export const DEFAULT_EXAM_DISPLAY_SETTINGS: ExamDisplaySettings = {
  showVitals: true,
  showLabs: true,
  showRadiology: true,
};

export const loadExamDisplaySettings = (): ExamDisplaySettings => {
  const saved = safeStorage.getJSON<Partial<ExamDisplaySettings> | null>(
    StorageKeys.EXAM_DISPLAY_SETTINGS,
    null
  );
  if (saved) {
    return { ...DEFAULT_EXAM_DISPLAY_SETTINGS, ...saved };
  }
  return DEFAULT_EXAM_DISPLAY_SETTINGS;
};

export const saveExamDisplaySettings = (settings: ExamDisplaySettings): void => {
  safeStorage.setJSON(StorageKeys.EXAM_DISPLAY_SETTINGS, settings);
};
