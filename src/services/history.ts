import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import { db } from './firebase';
import { mapDocs } from './repositories/common';
import { meterQuery } from './readMeter';
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

async function byPatient<T>(d: Firestore, name: string, patientId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(d, name), where('patientId', '==', patientId)));
  meterQuery(`history:${name}`, snap);
  return mapDocs<T>(name, snap);
}

export async function fetchPatientHistory(patientId: string, force = false): Promise<PatientHistory> {
  if (!db) throw new Error('Firestore غير مهيأ');
  const hit = cache.get(patientId);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const [visits, prescriptions, labOrders, radiologyOrders, followUps, invoices, payments] = await Promise.all([
    byPatient<Visit>(db, 'visits', patientId),
    byPatient<Prescription>(db, 'prescriptions', patientId),
    byPatient<LabOrder>(db, 'labOrders', patientId),
    byPatient<RadiologyOrder>(db, 'radiologyOrders', patientId),
    byPatient<FollowUp>(db, 'followUps', patientId),
    byPatient<Invoice>(db, 'invoices', patientId),
    byPatient<Payment>(db, 'payments', patientId),
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
