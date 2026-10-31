import { collection, onSnapshot, query, type Firestore, type QueryConstraint, type Unsubscribe } from 'firebase/firestore';
import { ID_FIELD_MAP, mapDocs, handleFirestoreError, OperationType } from './common';
import { meterQuery } from '../readMeter';

/**
 * يشترك في عدة استعلامات على نفس المجموعة ويدمج نتائجها (اتحاد حسب المعرّف).
 * لا يُرسل أي نتيجة حتى يصل أول رد من كل الاستعلامات لتفادي حالات وسيطة خاطئة.
 */
export function subscribeMerged<T extends Record<string, any>>(
  db: Firestore,
  name: string,
  queries: QueryConstraint[][],
  next: (items: T[]) => void,
  error: (reason: Error) => void,
  label?: string
): Unsubscribe {
  const idField = ID_FIELD_MAP[name] || 'id';
  const maps: Map<string, T>[] = queries.map(() => new Map());
  const ready: boolean[] = queries.map(() => false);

  const emit = () => {
    if (!ready.every(Boolean)) return;
    const merged = new Map<string, T>();
    maps.forEach((m) => m.forEach((v, k) => merged.set(k, v)));
    next([...merged.values()]);
  };

  const unsubs = queries.map((constraints, i) =>
    onSnapshot(
      query(collection(db, name), ...constraints),
      (snap) => {
        meterQuery(`${label ?? name}#${i}`, snap);
        const m = new Map<string, T>();
        mapDocs<T>(name, snap).forEach((item) => m.set(String((item as any)[idField]), item));
        maps[i] = m;
        ready[i] = true;
        emit();
      },
      (reason) => error(handleFirestoreError(reason, OperationType.LIST, name))
    )
  );
  return () => unsubs.forEach((u) => u());
}
