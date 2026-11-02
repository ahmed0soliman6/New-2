import { useCallback, useEffect, useState } from 'react';
import { supabase, clinicId } from './supabase';
import { mapDocs, resolveTableName, type SupabaseDocRow } from './repositories/common';
import { meterRead } from './readMeter';
import type { Visit, Prescription, LabOrder, RadiologyOrder, FollowUp, Invoice, Payment } from '../types/database';

export interface PatientHistory {
  visits: Visit[];
  prescriptions: Prescription[];
  labOrders: LabOrder[];
  radiologyOrders: RadiologyOrder[];
  followUps: FollowUp[];
  invoices: Invoice[];
  payments: Payment[];
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: PatientHistory }>();

async function byPatient<T>(name: string, patientId: string): Promise<T[]> {
  if (!supabase) throw new Error('عميل Supabase غير مهيأ');
  const tableName = resolveTableName(name);
  const { data, error } = await supabase
    .from(tableName)
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) throw new Error(error.message);
  const all = mapDocs<T>(tableName, (data || []) as SupabaseDocRow[]);
  const matched = all.filter((item) => (item as Record<string, unknown>).patientId === patientId);
  meterRead('ملف مريض', Math.max(1, matched.length));
  return matched;
}

export async function fetchPatientHistory(patientId: string, force = false): Promise<PatientHistory> {
  if (!supabase) throw new Error('عميل Supabase غير مهيأ');
  const hit = cache.get(patientId);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const [visits, prescriptions, labOrders, radiologyOrders, followUps, invoices, payments] = await Promise.all([
    byPatient<Visit>('visits', patientId),
    byPatient<Prescription>('prescriptions', patientId),
    byPatient<LabOrder>('lab_orders', patientId),
    byPatient<RadiologyOrder>('radiology_orders', patientId),
    byPatient<FollowUp>('follow_ups', patientId),
    byPatient<Invoice>('invoices', patientId),
    byPatient<Payment>('payments', patientId),
  ]);
  const data = { visits, prescriptions, labOrders, radiologyOrders, followUps, invoices, payments };
  cache.set(patientId, { at: Date.now(), data });
  return data;
}

export function invalidatePatientHistory(patientId?: string) {
  if (patientId) cache.delete(patientId);
  else cache.clear();
}

const EMPTY: PatientHistory = {
  visits: [], prescriptions: [], labOrders: [], radiologyOrders: [], followUps: [], invoices: [], payments: [],
};

export function usePatientHistory(patientId?: string | null, enabled = true) {
  const [data, setData] = useState<PatientHistory>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (!enabled || !patientId) { setData(EMPTY); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await fetchPatientHistory(patientId, force));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [patientId, enabled]);

  useEffect(() => { void load(false); }, [load]);
  return { ...data, loading, error, reload: () => load(true) };
}
