import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { meterRead } from './readMeter';

export async function fetchVisitCounts(fromKey?: string, toKey?: string) {
  if (!db) throw new Error('Firestore غير مهيأ');
  const base = [
    ...(fromKey ? [where('dayKey', '>=', fromKey)] : []),
    ...(toKey ? [where('dayKey', '<=', toKey)] : []),
  ];
  const [all, done] = await Promise.all([
    getCountFromServer(query(collection(db, 'visits'), ...base)),
    getCountFromServer(query(collection(db, 'visits'), where('status', '==', 'COMPLETED'), ...base)),
  ]);
  meterRead('لوحة التحكم', 1);
  meterRead('لوحة التحكم', 1);
  return { total: all.data().count, completed: done.data().count };
}
