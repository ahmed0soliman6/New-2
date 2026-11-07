import React, { useEffect, useState } from 'react';
import {
  getPendingConflicts,
  resolveSyncConflict,
  SyncConflictItem,
} from '../../services/offlineSync';

const TABLE_ARABIC_NAMES: Record<string, string> = {
  patients: 'ملفات المرضى',
  visits: 'الزيارات والكشوفات',
  appointments: 'المواعيد والحجوزات',
  invoices: 'الفواتير',
  payments: 'المدفوعات',
  prescriptions: 'الروشتات الطبية',
  lab_orders: 'طلبات المعامل',
  radiology_orders: 'طلبات الأشعة',
  expenses: 'المصروفات',
  settings: 'إعدادات العيادة',
};

export const ConflictResolutionModal: React.FC = () => {
  const [conflicts, setConflicts] = useState<SyncConflictItem[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadConflicts = async () => {
    const list = await getPendingConflicts();
    setConflicts(list);
  };

  useEffect(() => {
    void loadConflicts();
    const handler = () => {
      void loadConflicts();
    };
    window.addEventListener('soli_sync_conflict_updated', handler);
    return () => {
      window.removeEventListener('soli_sync_conflict_updated', handler);
    };
  }, []);

  if (conflicts.length === 0) return null;

  const activeConflict = conflicts[0];
  const tableLabel = TABLE_ARABIC_NAMES[activeConflict.table] || activeConflict.table;

  const handleResolve = async (choice: 'keep_local' | 'keep_server') => {
    setResolvingId(activeConflict.conflictId);
    try {
      await resolveSyncConflict(activeConflict.conflictId, choice);
      await loadConflicts();
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in"
      dir="rtl"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-amber-500/40 bg-white dark:bg-[#111A2E] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">sync_problem</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>تعارض في مزامنة البيانات بين جهازين (Conflict Resolution)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                  {conflicts.length} تعارض معلق
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                تم تعديل نفس السجل في جدول <strong>{tableLabel}</strong> (المعرف:{' '}
                <code className="font-mono text-[11px]">{activeConflict.id}</code>) على جهاز آخر أثناء عملك دون اتصال. اختر النسخة المعتمدة لحفظها:
              </p>
            </div>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {/* Local Device Version */}
          <div className="rounded-xl border border-[#00c2cb]/40 bg-[#00c2cb]/5 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-[#00c2cb]/20 pb-2">
                <span className="font-bold text-xs text-[#008f97] dark:text-[#45dee7] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">devices</span>
                  <span>نسخة هذا الجهاز (تعديلك المحلي)</span>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7]">
                  _rev: {activeConflict.localRev}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                توقيت التعديل المحلي: <span dir="ltr">{activeConflict.localUpdatedAt}</span>
              </div>
              <pre
                dir="ltr"
                className="text-[11px] font-mono bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-x-auto max-h-64"
              >
                {JSON.stringify(activeConflict.localData, null, 2)}
              </pre>
            </div>

            <button
              type="button"
              disabled={resolvingId === activeConflict.conflictId}
              onClick={() => void handleResolve('keep_local')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              اعتماد نسخة هذا الجهاز وحفظها في الخادم
            </button>
          </div>

          {/* Server Version */}
          <div className="rounded-xl border border-purple-500/40 bg-purple-500/5 p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                <span className="font-bold text-xs text-purple-600 dark:text-purple-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">cloud_done</span>
                  <span>نسخة الخادم السحابية (الجهاز الآخر)</span>
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-300">
                  _rev: {activeConflict.serverRev}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                توقيت تعديل الخادم: <span dir="ltr">{activeConflict.serverUpdatedAt}</span>
              </div>
              <pre
                dir="ltr"
                className="text-[11px] font-mono bg-slate-900 text-purple-300 p-3 rounded-lg overflow-x-auto max-h-64"
              >
                {JSON.stringify(activeConflict.serverData, null, 2)}
              </pre>
            </div>

            <button
              type="button"
              disabled={resolvingId === activeConflict.conflictId}
              onClick={() => void handleResolve('keep_server')}
              className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              اعتماد نسخة الخادم السحابية وإلغاء التعديل المحلي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
