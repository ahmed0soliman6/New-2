import {
  collection, doc, documentId, getDocs, limit, orderBy, query, startAfter,
  where, writeBatch, type Firestore, type QueryDocumentSnapshot,
} from 'firebase/firestore';
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
const PAGE = 300;            // أقل من حد 500 للدفعة
const WRITE_BUDGET = 8000;   // حد أمان لكل تشغيلة (الحد اليومي المجاني 20,000 كتابة)
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export type BackfillReport = Record<string, { scanned: number; updated: number; skipped: number; noDate: number }> & {
  stoppedEarly?: boolean;
};

export async function backfillDayKeys(db: Firestore, onProgress?: (msg: string) => void): Promise<BackfillReport> {
  const report: BackfillReport = {} as BackfillReport;
  let writes = 0;

  for (const t of TARGETS) {
    report[t.name] = { scanned: 0, updated: 0, skipped: 0, noDate: 0 };
    let cursor: QueryDocumentSnapshot | undefined;

    for (;;) {
      const base = [orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(PAGE)];
      const snap = await getDocs(query(collection(db, t.name), ...base));
      if (snap.empty) break;

      const batch = writeBatch(db);
      let inBatch = 0;
      for (const d of snap.docs) {
        report[t.name].scanned++;
        const data = d.data();
        if (typeof data.dayKey === 'string' && DAY_RE.test(data.dayKey)) { report[t.name].skipped++; continue; }
        const raw = t.dateFields.map((f) => data[f]).find(Boolean);
        if (!toDate(raw)) { report[t.name].noDate++; continue; }
        batch.update(d.ref, { dayKey: toDayKey(raw) });
        inBatch++;
      }
      if (inBatch) {
        if (writes + inBatch > WRITE_BUDGET) { report.stoppedEarly = true; return report; }
        await batch.commit();
        writes += inBatch;
        report[t.name].updated += inBatch;
      }
      onProgress?.(`${t.name}: فُحص ${report[t.name].scanned} / حُدّث ${report[t.name].updated}`);
      cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE) break;
    }
  }
  return report;
}

/** يضبط hasClinicalFile / visitsCount / lastVisitAt / lastDiagnosis للمرضى الحاليين */
export async function backfillPatientClinicalFlags(db: Firestore) {
  const [visitsSnap, rxSnap, patientsSnap] = await Promise.all([
    getDocs(query(collection(db, 'visits'), where('status', '==', 'COMPLETED'))),
    getDocs(collection(db, 'prescriptions')),
    getDocs(collection(db, 'patients')),
  ]);

  const stats = new Map<string, { count: number; last: Date | null; diag: string }>();
  visitsSnap.forEach((d) => {
    const v = d.data();
    if (!v.patientId) return;
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
  rxSnap.forEach((d) => { const pid = d.data().patientId; if (pid) withRx.add(pid); });

  const existing = new Set(patientsSnap.docs.map((d) => d.id));
  const ids = new Set<string>([...stats.keys(), ...withRx]);

  let batch = writeBatch(db);
  let n = 0;
  let total = 0;
  for (const pid of ids) {
    if (!existing.has(pid)) continue;
    const s = stats.get(pid);
    batch.update(doc(db, 'patients', pid), {
      hasClinicalFile: true,
      visitsCount: s?.count ?? 0,
      lastDiagnosis: s?.diag ?? '',
      ...(s?.last ? { lastVisitAt: s.last.toISOString() } : {}),
    });
    n++; total++;
    if (n === 400) { await batch.commit(); batch = writeBatch(db); n = 0; }
  }
  if (n) await batch.commit();
  return { patientsUpdated: total };
}
