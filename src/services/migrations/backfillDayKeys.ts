import { supabase, clinicId } from '../supabase';
import { resolveTableName } from '../repositories/common';
import { notifyTableMutated } from '../offlineSync';
import { toDate, toDayKey } from '../../utils/dayKey';

const TARGETS: { name: string; dateFields: string[] }[] = [
  { name: 'visits', dateFields: ['createdAt'] },
  { name: 'invoices', dateFields: ['createdAt'] },
  { name: 'payments', dateFields: ['paidAt', 'createdAt'] },
  { name: 'prescriptions', dateFields: ['createdAt'] },
  { name: 'labOrders', dateFields: ['orderedAt', 'createdAt'] },
  { name: 'radiologyOrders', dateFields: ['orderedAt', 'createdAt'] },
  { name: 'followUps', dateFields: ['createdAt'] },
];
const WRITE_BUDGET = 8000;   // حد أمان لكل تشغيلة (الحد اليومي المجاني 20,000 كتابة)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type BackfillReport = Record<string, { scanned: number; updated: number; skipped: number; noDate: number }> & {
  stoppedEarly?: boolean;
};

export async function backfillDayKeys(_db: unknown, onProgress?: (msg: string) => void): Promise<BackfillReport> {
  const report: BackfillReport = {} as BackfillReport;
  if (!supabase) return report;

  let writes = 0;

  for (const t of TARGETS) {
    report[t.name] = { scanned: 0, updated: 0, skipped: 0, noDate: 0 };
    const tableName = resolveTableName(t.name);

    const { data: rows, error } = await supabase
      .from(tableName)
      .select('id, data')
      .eq('clinic_id', clinicId);

    if (error || !rows) continue;

    const toUpsert: Array<{ clinic_id: string; id: string; data: Record<string, any>; updated_at: string }> = [];
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      report[t.name].scanned++;
      const data = (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, any>;
      if (typeof data.dayKey === 'string' && DAY_RE.test(data.dayKey)) {
        report[t.name].skipped++;
        continue;
      }
      const raw = t.dateFields.map((f) => data[f]).find(Boolean);
      if (!toDate(raw)) {
        report[t.name].noDate++;
        continue;
      }
      toUpsert.push({
        clinic_id: clinicId,
        id: row.id,
        data: { ...data, dayKey: toDayKey(raw) },
        updated_at: nowIso,
      });
    }

    if (toUpsert.length > 0) {
      if (writes + toUpsert.length > WRITE_BUDGET) {
        report.stoppedEarly = true;
        return report;
      }
      const { error: upsertErr } = await supabase
        .from(tableName)
        .upsert(toUpsert, { onConflict: 'clinic_id,id' });
      if (!upsertErr) {
        writes += toUpsert.length;
        report[t.name].updated += toUpsert.length;
        notifyTableMutated(tableName, false);
      }
    }

    onProgress?.(`${t.name}: فُحص ${report[t.name].scanned} / حُدّث ${report[t.name].updated}`);
  }
  return report;
}

/** يضبط hasClinicalFile / visitsCount / lastVisitAt / lastDiagnosis للمرضى الحاليين */
export async function backfillPatientClinicalFlags(_db: unknown) {
  if (!supabase) return { patientsUpdated: 0 };

  const [visitsRes, rxRes, patientsRes] = await Promise.all([
    supabase.from('visits').select('id, data').eq('clinic_id', clinicId),
    supabase.from('prescriptions').select('id, data').eq('clinic_id', clinicId),
    supabase.from('patients').select('id, data').eq('clinic_id', clinicId),
  ]);

  const stats = new Map<string, { count: number; last: Date | null; diag: string }>();
  (visitsRes.data || []).forEach((row) => {
    const v = (row.data || {}) as Record<string, any>;
    if (v.status !== 'COMPLETED' || !v.patientId) return;
    const s = stats.get(v.patientId) ?? { count: 0, last: null, diag: '' };
    s.count++;
    const when = toDate(v.completedAt ?? v.createdAt);
    if (when && (!s.last || when > s.last)) {
      s.last = when;
      s.diag = v.clinicalData?.diagnosis?.[0] ?? s.diag;
    }
    stats.set(v.patientId, s);
  });

  const withRx = new Set<string>();
  (rxRes.data || []).forEach((row) => {
    const pid = (row.data as Record<string, any>)?.patientId;
    if (pid) withRx.add(pid);
  });

  const patientsMap = new Map<string, Record<string, any>>();
  (patientsRes.data || []).forEach((row) => {
    patientsMap.set(row.id, (row.data || {}) as Record<string, any>);
  });

  const ids = new Set<string>([...stats.keys(), ...withRx]);
  const nowIso = new Date().toISOString();
  const toUpsert: Array<{ clinic_id: string; id: string; data: Record<string, any>; updated_at: string }> = [];

  for (const pid of ids) {
    const existingData = patientsMap.get(pid);
    if (!existingData) continue;
    const s = stats.get(pid);
    toUpsert.push({
      clinic_id: clinicId,
      id: pid,
      data: {
        ...existingData,
        hasClinicalFile: true,
        visitsCount: s?.count ?? 0,
        lastDiagnosis: s?.diag ?? '',
        ...(s?.last ? { lastVisitAt: s.last.toISOString() } : {}),
      },
      updated_at: nowIso,
    });
  }

  if (toUpsert.length > 0) {
    await supabase.from('patients').upsert(toUpsert, { onConflict: 'clinic_id,id' });
    notifyTableMutated('patients', false);
  }

  return { patientsUpdated: toUpsert.length };
}

