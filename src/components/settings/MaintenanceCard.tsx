import { useState } from 'react';
import { db } from '../../services/firebase';
import { backfillDayKeys, backfillPatientClinicalFlags } from '../../services/migrations/backfillDayKeys';

export function MaintenanceCard() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const push = (m: string) => setLog((l) => [...l.slice(-30), m]);

  const run = async () => {
    if (!db || busy) return;
    if (!window.confirm('أغلق النظام على كل الأجهزة الأخرى قبل البدء. متابعة؟')) return;
    setBusy(true);
    try {
      const r1 = await backfillDayKeys(db, push);
      push('انتهى ترحيل التواريخ: ' + JSON.stringify(r1));
      const r2 = await backfillPatientClinicalFlags(db);
      push('انتهى ترحيل ملفات المرضى: ' + JSON.stringify(r2));
    } catch (e) {
      push('خطأ: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-5 space-y-4 shadow-sm" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
          <span className="material-symbols-outlined text-xl">build</span>
        </div>
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">أدوات الصيانة — ترحيل الحقول (dayKey)</h3>
          <p className="text-xs text-slate-500 dark:text-[#859394]">
            شغّلها مرة واحدة فقط، والأجهزة الأخرى مغلقة (كل تعديل يُحسب قراءة على كل جهاز مفتوح).
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={run}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-xs"
        >
          <span className="material-symbols-outlined text-base">
            {busy ? 'hourglass_top' : 'play_arrow'}
          </span>
          <span>{busy ? 'جارٍ الترحيل…' : 'بدء الترحيل'}</span>
        </button>
      </div>
      {log.length > 0 && (
        <pre className="text-xs max-h-48 overflow-auto whitespace-pre-wrap bg-slate-950 text-slate-100 p-3 rounded-xl border border-slate-800 font-mono">
          {log.join('\n')}
        </pre>
      )}
    </div>
  );
}
