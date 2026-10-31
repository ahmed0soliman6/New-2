import type { VitalsData } from '../components/examination/VitalsCard';

const toNum = (v: string | undefined): number | null => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** يحوّل قيم البطاقة (نصوص) إلى شكل Visit.vitalSigns. الفارغ يصبح null */
export function vitalsToVisit(v: Partial<VitalsData>) {
  const bp = (v.bp || '').trim();
  return {
    bloodPressure: bp,
    pulse: toNum(v.pulse),
    temperature: toNum(v.temp),
    weight: toNum(v.weight),
    height: toNum(v.height),
    oxygenSaturation: toNum(v.spo2),
    randomBloodSugar: toNum(v.rbs),
  };
}

/** يعيد true إذا أدخل الطبيب أي قيمة فعلًا */
export function hasAnyVital(v: Partial<VitalsData>): boolean {
  return Object.values(v).some((x) => typeof x === 'string' && x.trim() !== '');
}
