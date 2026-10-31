import { db } from '../services/firebase';
import { safeStorage, StorageKeys } from '../services/storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export const DEFAULT_LIFESTYLE_PRESETS = [
  'الامتناع التام عن الأطعمة الدسمة، الحارة، المقليات، والمشروبات الغازية.',
  'تقليل استهلاك ملح الطعام والمخللات إلى أقل من 2 جرام صوديوم يومياً.',
  'الامتناع عن السكريات والحلويات الصريحة والعصائر المحلاة والمخبوزات البيضاء.',
  'عدم الاستلقاء أو النوم مباشرة بعد تناول الطعام لمدة ساعتين على الأقل.',
  'شرب ما لا يقل عن 2.5 إلى 3 لترات ماء يومياً لحماية الكلى وتحسين التروية.',
  'ممارسة رياضة المشي المنتظم 30 دقيقة يومياً لمدة 5 أيام أسبوعياً.',
  'تجنب التوتر والضغط العصبي وأخذ قسط كافٍ من النوم (7-8 ساعات متواصلة).',
  'تناول وجبات صغيرة متكررة خفيفة بدلاً من الوجبات الكبيرة الثقيلة.',
];

let cachedLifestylePresets: string[] = DEFAULT_LIFESTYLE_PRESETS;

export function loadLifestylePresets(): string[] {
  const saved = safeStorage.getJSON<string[] | null>(StorageKeys.LIFESTYLE_PRESETS, null);
  if (Array.isArray(saved) && saved.length > 0) {
    cachedLifestylePresets = saved;
    return saved;
  }
  return cachedLifestylePresets;
}

export function saveLifestylePresets(presets: string[]): void {
  cachedLifestylePresets = presets;
  safeStorage.setJSON(StorageKeys.LIFESTYLE_PRESETS, presets);
  window.dispatchEvent(new CustomEvent('soli_lifestyle_updated', { detail: presets }));

  if (db) {
    setDoc(doc(db, 'settings', 'lifestyleAdvice'), {
      presets,
      updatedAt: new Date().toISOString(),
    }).catch((err) => console.warn('Firestore lifestyle sync notice:', err));
  }
}

export function addLifestylePreset(preset: string): string[] {
  const clean = preset.trim();
  if (!clean) return loadLifestylePresets();
  const current = loadLifestylePresets();
  if (current.includes(clean)) return current;
  const updated = [clean, ...current];
  saveLifestylePresets(updated);
  return updated;
}

export function removeLifestylePreset(preset: string): string[] {
  const current = loadLifestylePresets();
  const updated = current.filter((p) => p !== preset);
  saveLifestylePresets(updated);
  return updated;
}

export function subscribeToLifestylePresets(
  callback: (presets: string[]) => void
): () => void {
  // 1. Initial load
  callback(loadLifestylePresets());

  // 2. Window event listener
  const handleUpdate = (e: Event) => {
    const customEvt = e as CustomEvent<string[]>;
    if (customEvt.detail && Array.isArray(customEvt.detail)) {
      callback(customEvt.detail);
    } else {
      callback(loadLifestylePresets());
    }
  };
  window.addEventListener('soli_lifestyle_updated', handleUpdate);

  // 3. Storage event listener (cross-tab)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === StorageKeys.LIFESTYLE_PRESETS && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          cachedLifestylePresets = parsed;
          callback(parsed);
        }
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorage);

  // 4. Firestore sync if available
  let unsubFirestore: (() => void) | null = null;
  if (db) {
    try {
      unsubFirestore = onSnapshot(
        doc(db, 'settings', 'lifestyleAdvice'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.presets) && data.presets.length > 0) {
              cachedLifestylePresets = data.presets;
              safeStorage.setJSON(StorageKeys.LIFESTYLE_PRESETS, data.presets);
              callback(data.presets);
            }
          }
        },
        (err) => console.warn('Lifestyle subscription error:', err)
      );
    } catch {}
  }

  return () => {
    window.removeEventListener('soli_lifestyle_updated', handleUpdate);
    window.removeEventListener('storage', handleStorage);
    if (unsubFirestore) unsubFirestore();
  };
}
