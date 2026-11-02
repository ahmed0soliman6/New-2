import { useCallback, useEffect, useState } from 'react';
import { supabase, clinicId } from './supabase';
import { mapDocs, type SupabaseDocRow } from './repositories/common';
import { meterRead, type MeterSource } from './readMeter';
import { toDayKey } from '../utils/dayKey';
import type { Invoice, Payment } from '../types/database';

function matchesDayRange(dayKey: string | undefined, fallbackIso: string | undefined, fromKey: string, toKey: string): boolean {
  const resolved = dayKey || (fallbackIso ? toDayKey(fallbackIso) || fallbackIso.slice(0, 10) : '');
  if (!resolved) return false;
  if (fromKey && resolved < fromKey) return false;
  if (toKey && resolved > toKey) return false;
  return true;
}

export async function fetchFinanceRange(fromKey: string, toKey: string, source?: MeterSource) {
  if (!supabase) throw new Error('عميل Supabase غير مهيأ');
  const [pRes, iRes] = await Promise.all([
    supabase.from('payments').select('id, data, updated_at').eq('clinic_id', clinicId),
    supabase.from('invoices').select('id, data, updated_at').eq('clinic_id', clinicId),
  ]);
  if (pRes.error) throw new Error(pRes.error.message);
  if (iRes.error) throw new Error(iRes.error.message);

  const payments = mapDocs<Payment>('payments', (pRes.data || []) as SupabaseDocRow[]).filter((p) =>
    matchesDayRange(p.dayKey, p.paidAt, fromKey, toKey)
  );
  const invoices = mapDocs<Invoice>('invoices', (iRes.data || []) as SupabaseDocRow[]).filter((inv) =>
    matchesDayRange(inv.dayKey, inv.createdAt, fromKey, toKey)
  );

  meterRead(source || 'مالية', Math.max(1, payments.length + invoices.length));
  return { payments, invoices };
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
