import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { mapDocs } from './repositories/common';
import { meterQuery, type MeterSource } from './readMeter';
import type { Invoice, Payment } from '../types/database';

export async function fetchFinanceRange(fromKey: string, toKey: string, source?: MeterSource) {
  if (!db) throw new Error('Firestore غير مهيأ');
  const range = [where('dayKey', '>=', fromKey), where('dayKey', '<=', toKey)];
  const [pSnap, iSnap] = await Promise.all([
    getDocs(query(collection(db, 'payments'), ...range)),
    getDocs(query(collection(db, 'invoices'), ...range)),
  ]);
  meterQuery('financeRange:payments', pSnap, source);
  meterQuery('financeRange:invoices', iSnap, source);
  return { payments: mapDocs<Payment>('payments', pSnap), invoices: mapDocs<Invoice>('invoices', iSnap) };
}

export function useFinanceRange(fromKey: string, toKey: string, enabled: boolean, source?: MeterSource) {
  const [state, setState] = useState<{ payments: Payment[]; invoices: Invoice[] }>({ payments: [], invoices: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      setState(await fetchFinanceRange(fromKey, toKey, source));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fromKey, toKey, enabled, source]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, loading, error, reload };
}
