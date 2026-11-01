import {
  ID_FIELD_MAP,
  resolveTableName,
  subscribeQuery,
  type DbClient,
  type UnsubscribeFn,
} from './common';

/**
 * يشترك في عدة استعلامات على نفس المجموعة ويدمج نتائجها (اتحاد حسب المعرّف).
 * لا يُرسل أي نتيجة حتى يصل أول رد من كل الاستعلامات لتفادي حالات وسيطة خاطئة.
 */
export function subscribeMerged<T extends Record<string, any>>(
  db: DbClient,
  name: string,
  queries: unknown[][],
  next: (items: T[]) => void,
  error: (reason: Error) => void,
  label?: string
): UnsubscribeFn {
  const tableName = resolveTableName(name);
  const idField = ID_FIELD_MAP[name] || ID_FIELD_MAP[tableName] || 'id';
  const maps: Map<string, T>[] = queries.map(() => new Map());
  const ready: boolean[] = queries.map(() => false);

  const emit = () => {
    if (!ready.every(Boolean)) return;
    const merged = new Map<string, T>();
    maps.forEach((m) => m.forEach((v, k) => merged.set(k, v)));
    next([...merged.values()]);
  };

  const unsubs = queries.map((constraints, i) =>
    subscribeQuery<T>(
      db,
      tableName,
      constraints,
      (items) => {
        const m = new Map<string, T>();
        items.forEach((item) => m.set(String((item as any)[idField]), item));
        maps[i] = m;
        ready[i] = true;
        emit();
      },
      error,
      `${label ?? tableName}#${i}`
    )
  );

  return () => unsubs.forEach((u) => u());
}
