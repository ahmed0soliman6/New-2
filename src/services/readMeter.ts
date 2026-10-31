import type { DocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

export type MeterSource =
  | 'تحميل أول'
  | 'تحديثات حية'
  | 'ملف مريض'
  | 'مالية'
  | 'لوحة التحكم'
  | 'حجوزات'
  | 'إعدادات'
  | 'أخرى';

const STORAGE_KEY = 'soli_read_stats';
const seenLabels = new Set<string>(); // لتحديد التحميل الأول لكل مستمع

interface DayStats {
  date: string;                       // YYYY-MM-DD بتوقيت القاهرة
  reads: Partial<Record<MeterSource, number>>;
  writes: number;
  initialByListener?: Record<string, number>;
}

const initialByListener: Record<string, number> = {};

function todayCairo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
}

function load(): DayStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DayStats;
      if (parsed.date === todayCairo()) {
        if (parsed.initialByListener) {
          Object.assign(initialByListener, parsed.initialByListener);
        }
        return parsed;
      }
    }
  } catch { /* تجاهل */ }
  return { date: todayCairo(), reads: {}, writes: 0, initialByListener: {} };
}

let stats: DayStats = load();

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch { /* تجاهل */ }
  window.dispatchEvent(new Event('soli_read_stats_updated'));
}

function sourceOf(label: string): MeterSource {
  if (label.startsWith('history:')) return 'ملف مريض';
  if (label.startsWith('financePage:')) return 'مالية';
  if (label.startsWith('financeRange:dashboard')) return 'لوحة التحكم';
  if (label.startsWith('financeRange:')) return 'مالية';
  if (label.startsWith('booking:')) return 'حجوزات';
  if (label.startsWith('settings/')) return 'إعدادات';
  return 'أخرى';
}

function add(source: MeterSource, n: number) {
  if (stats.date !== todayCairo()) stats = { date: todayCairo(), reads: {}, writes: 0, initialByListener: {} };
  stats.reads[source] = (stats.reads[source] ?? 0) + n;
  persist();
}

function recordInitialListenerCount(label: string, docCount: number) {
  if (stats.date !== todayCairo()) stats = { date: todayCairo(), reads: {}, writes: 0, initialByListener: {} };
  initialByListener[label] = docCount;
  stats.initialByListener = { ...(stats.initialByListener || {}), [label]: docCount };
  persist();
}

/** يعدّ docChanges من الخادم فقط. أول لقطة لكل مستمع تُصنف "تحميل أول" والباقي "تحديثات حية" */
export function meterQuery(label: string, snap: QuerySnapshot, source?: MeterSource) {
  if (snap.metadata.fromCache) return;
  const base = source ?? sourceOf(label);
  const first = !seenLabels.has(label);
  seenLabels.add(label);
  if (first) {
    recordInitialListenerCount(label, snap.docs.length);
  }
  const n = first ? snap.docs.length : snap.docChanges().length;
  const finalSource: MeterSource = base === 'مالية' || base === 'ملف مريض' || base === 'حجوزات' || base === 'لوحة التحكم'
    ? base
    : first ? 'تحميل أول' : 'تحديثات حية';
  if (n > 0) add(finalSource, n);
}

export function meterDoc(label: string, snap: DocumentSnapshot, source?: MeterSource) {
  if (snap.metadata.fromCache) return;
  const first = !seenLabels.has(label);
  seenLabels.add(label);
  if (first) {
    recordInitialListenerCount(label, snap.exists() ? 1 : 0);
  }
  const base = source ?? sourceOf(label);
  const finalSource: MeterSource = base === 'إعدادات' ? (first ? 'تحميل أول' : 'تحديثات حية') : base;
  add(finalSource, 1);
}

/** عدّ قراءة مباشرة (استعلامات التجميع أو getDocs المستقلة) */
export function meterRead(source: MeterSource, count: number) {
  if (count > 0) add(source, count);
}

/** الكتابات (ليست قراءات) */
export function meterWrite(count = 1) {
  if (stats.date !== todayCairo()) stats = { date: todayCairo(), reads: {}, writes: 0, initialByListener: {} };
  stats.writes += count;
  persist();
}

export function getTodayStats(): DayStats {
  return stats.date === todayCairo() ? stats : { date: todayCairo(), reads: {}, writes: 0, initialByListener: {} };
}

export function resetTodayStats() {
  stats = { date: todayCairo(), reads: {}, writes: 0, initialByListener: {} };
  seenLabels.clear();
  for (const k of Object.keys(initialByListener)) delete initialByListener[k];
  persist();
}

if (typeof window !== 'undefined') {
  (window as any).__soliReads = () => {
    const s = getTodayStats();
    const total = Object.values(s.reads).reduce((a, b) => a + (b ?? 0), 0);
    const byListener = s.initialByListener && Object.keys(s.initialByListener).length > 0
      ? s.initialByListener
      : initialByListener;
    console.table(s.reads);
    console.log('القراءات الأولية لكل مستمعة (label -> عدد المستندات):');
    console.table(byListener);
    console.log('الإجمالي اليوم:', total, '| الكتابات:', s.writes);
    return { total, writes: s.writes, reads: s.reads, initialByListener: byListener };
  };
}

