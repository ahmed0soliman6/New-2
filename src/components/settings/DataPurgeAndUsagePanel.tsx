import React, { useState, useEffect, useCallback } from 'react';
import {
  DatabaseUsageSnapshot,
  PurgePreviewResult,
  PurgeExecutionResult,
  ALLOWED_PURGE_SCOPE_OPTIONS,
  REQUIRED_PURGE_CONFIRMATION_PHRASE,
  TABLE_ARABIC_LABELS,
  fetchDatabaseUsage,
  previewOldDataPurge,
  executeOldDataPurge,
  formatBytesToMB,
  getManualAuditCleanupSql,
} from '../../services/databaseMaintenance';
import { clinicId } from '../../services/supabase';

const TEN_MINUTES_MS = 10 * 60 * 1000;

interface DatabaseUsageIndicatorProps {
  canViewUsage: boolean;
  onExportBackup: () => Promise<void>;
  onOpenPurgeSection?: () => void;
  refreshTrigger?: number;
}

export const DatabaseUsageIndicator: React.FC<DatabaseUsageIndicatorProps> = ({
  canViewUsage,
  onExportBackup,
  onOpenPurgeSection,
  refreshTrigger = 0,
}) => {
  const [usage, setUsage] = useState<DatabaseUsageSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAllTables, setShowAllTables] = useState(false);

  const loadUsage = useCallback(async () => {
    if (!canViewUsage) return;
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchDatabaseUsage();
      setUsage(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة مساحة قاعدة البيانات');
    } finally {
      setLoading(false);
    }
  }, [canViewUsage]);

  useEffect(() => {
    if (!canViewUsage) return;
    void loadUsage();
    const timer = window.setInterval(() => {
      void loadUsage();
    }, TEN_MINUTES_MS);
    return () => window.clearInterval(timer);
  }, [canViewUsage, loadUsage, refreshTrigger]);

  if (!canViewUsage) {
    return null;
  }

  const pct = usage ? usage.percent_used : 0;
  const isRed = pct > 90;
  const isHighWarning = pct >= 90;
  const isYellow = pct >= 70 && pct <= 90;

  const badgeColorClasses = isRed
    ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-500/40'
    : isYellow
    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/40'
    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

  const topFiveTables = usage ? usage.tables.slice(0, 5) : [];

  return (
    <>
      {/* Compact Database Disk Icon + Percentage Button */}
      <button
        type="button"
        onClick={() => {
          setShowModal(true);
          if (!usage && !loading) {
            void loadUsage();
          }
        }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${badgeColorClasses}`}
        title="عرض المساحة المتبقية واستهلاك قاعدة البيانات والجداول"
      >
        <span className="material-symbols-outlined text-base">hard_drive</span>
        <span className="font-mono tabular-nums" dir="ltr">
          {loading && !usage ? '...' : usage ? `${pct.toFixed(1)}%` : '--%'}
        </span>
      </button>

      {/* Proactive >= 90% Capacity Warning Banner */}
      {usage && isHighWarning && (
        <div className="w-full mt-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-xl text-rose-600 dark:text-rose-400 shrink-0">
              warning
            </span>
            <div>
              <strong className="font-bold block">
                تنبيه امتلاء مساحة قاعدة البيانات ({pct.toFixed(1)}% مستهلك):
              </strong>
              <span>
                اقتربت قاعدة البيانات من الحد الأقصى المسموح ({formatBytesToMB(usage.used_bytes)} من{' '}
                {formatBytesToMB(usage.limit_bytes)}). يُنصح بتصدير نسخة احتياطية كاملة الآن ثم حذف البيانات القديمة لتفريغ المساحة.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void onExportBackup()}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
            >
              تصدير نسخة احتياطية
            </button>
            {onOpenPurgeSection && (
              <button
                type="button"
                onClick={onOpenPurgeSection}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#111A2E] border border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold text-xs cursor-pointer"
              >
                فتح أداة حذف البيانات القديمة
              </button>
            )}
          </div>
        </div>
      )}

      {/* Database Usage Details Popover Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          dir="rtl"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 p-5 shadow-2xl space-y-4 text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${badgeColorClasses}`}>
                  <span className="material-symbols-outlined text-xl">hard_drive</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    استهلاك مساحة قاعدة البيانات السحابية
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                    العيادة الحالية: <span className="font-mono">{clinicId}</span> • يُحدَّث كل 10 دقائق
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void loadUsage()}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer disabled:opacity-50"
                  title="تحديث القراءة الآن"
                >
                  <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold">
                {error}
              </div>
            )}

            {usage ? (
              <div className="space-y-4 text-xs">
                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-700 dark:text-slate-200">نسبة الاستهلاك الكلي للقاعدة:</span>
                    <span
                      className={`font-mono tabular-nums ${
                        isRed ? 'text-rose-600 dark:text-rose-400' : isYellow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                      dir="ltr"
                    >
                      {usage.percent_used.toFixed(2)}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isRed ? 'bg-rose-500' : isYellow ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(Math.max(usage.percent_used, 1), 100)}%` }}
                    />
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/10">
                    <span className="text-[11px] text-slate-500 dark:text-[#859394] block">المستهلك الكلي:</span>
                    <strong className="font-mono tabular-nums text-sm text-slate-900 dark:text-white" dir="ltr">
                      {formatBytesToMB(usage.used_bytes)}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/10">
                    <span className="text-[11px] text-slate-500 dark:text-[#859394] block">المساحة المتبقية:</span>
                    <strong className="font-mono tabular-nums text-sm text-emerald-600 dark:text-emerald-400" dir="ltr">
                      {formatBytesToMB(usage.remaining_bytes)}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/10">
                    <span className="text-[11px] text-slate-500 dark:text-[#859394] block">حجم بيانات هذه العيادة:</span>
                    <strong className="font-mono tabular-nums text-sm text-[#008f97] dark:text-[#45dee7]" dir="ltr">
                      {formatBytesToMB(usage.clinic_bytes)}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/10">
                    <span className="text-[11px] text-slate-500 dark:text-[#859394] block">الحد الأقصى للخطة:</span>
                    <strong className="font-mono tabular-nums text-sm text-slate-700 dark:text-slate-300" dir="ltr">
                      {formatBytesToMB(usage.limit_bytes)}
                    </strong>
                  </div>
                </div>

                {/* Top 5 Largest Tables */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      أكبر 5 جداول في هذه العيادة:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllTables((v) => !v)}
                      className="text-[11px] font-bold text-[#008f97] dark:text-[#45dee7] hover:underline cursor-pointer"
                    >
                      {showAllTables ? 'عرض أكبر 5 فقط' : `عرض جميع الجداول (${usage.tables.length})`}
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200/60 dark:divide-white/5">
                    {(showAllTables ? usage.tables : topFiveTables).map((tbl) => (
                      <div key={tbl.table_name} className="py-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-700 dark:text-slate-200 font-medium truncate">
                          {TABLE_ARABIC_LABELS[tbl.table_name] || tbl.table_name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums" dir="ltr">
                          <span className="text-slate-500 dark:text-slate-400">{tbl.row_count} rows</span>
                          <strong className="text-slate-900 dark:text-white min-w-16 text-right">
                            {formatBytesToMB(tbl.bytes)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">جاري تحميل بيانات المساحة...</div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface OldDataPurgeCardProps {
  canPurgeData: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onExportBackup: () => Promise<void>;
  onPurgeCompleted?: () => void;
}

export const OldDataPurgeCard: React.FC<OldDataPurgeCardProps> = ({
  canPurgeData,
  isOpen,
  onToggleOpen,
  onExportBackup,
  onPurgeCompleted,
}) => {
  // Default cutoff date: 1 year ago (YYYY-MM-DD)
  const [cutoffDate, setCutoffDate] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });

  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'completed_visits',
    'finished_appointments',
    'lab_radiology_orders',
    'finished_follow_ups',
    'old_backups',
  ]);

  const [previewResult, setPreviewResult] = useState<PurgePreviewResult | null>(null);
  const [executionResult, setExecutionResult] = useState<PurgeExecutionResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [hasExportedBackupFirst, setHasExportedBackupFirst] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showManualAuditSql, setShowManualAuditSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  if (!canPurgeData) {
    return null;
  }

  const applyShortcutYears = (years: number) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setDate(d.getDate() - 1);
    setCutoffDate(d.toISOString().slice(0, 10));
    setPreviewResult(null);
    setExecutionResult(null);
    setErrorMessage(null);
  };

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
    setPreviewResult(null);
    setExecutionResult(null);
    setErrorMessage(null);
  };

  const getCutoffIso = (): string => {
    return `${cutoffDate}T00:00:00.000Z`;
  };

  const handlePreview = async () => {
    if (isPreviewing || isPurging) return;
    setErrorMessage(null);
    setExecutionResult(null);

    if (!cutoffDate) {
      setErrorMessage('يرجى تحديد تاريخ القطع أولاً.');
      return;
    }
    if (selectedScopes.length === 0) {
      setErrorMessage('يرجى اختيار نطاق واحد على الأقل للمعاينة.');
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await previewOldDataPurge(getCutoffIso(), selectedScopes);
      setPreviewResult(res);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر تنفيذ معاينة الحذف.');
      setPreviewResult(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleMandatoryBackupExport = async () => {
    if (isExportingBackup || isPurging) return;
    setIsExportingBackup(true);
    setErrorMessage(null);
    try {
      await onExportBackup();
      setHasExportedBackupFirst(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر تصدير النسخة الاحتياطية.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleExecutePurge = async () => {
    if (isPurging || isPreviewing || isExportingBackup) return;
    setErrorMessage(null);

    if (!hasExportedBackupFirst) {
      setErrorMessage('يجب تصدير نسخة احتياطية JSON أولاً قبل تنفيذ الحذف النهائي.');
      return;
    }

    if (confirmationInput.trim() !== REQUIRED_PURGE_CONFIRMATION_PHRASE) {
      setErrorMessage(`يرجى كتابة عبارة التأكيد بدقة: "${REQUIRED_PURGE_CONFIRMATION_PHRASE}"`);
      return;
    }

    setIsPurging(true);
    try {
      const res = await executeOldDataPurge(
        getCutoffIso(),
        selectedScopes,
        confirmationInput.trim()
      );
      setExecutionResult(res);
      setConfirmationInput('');
      if (onPurgeCompleted) {
        onPurgeCompleted();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'فشلت عملية حذف البيانات القديمة.');
    } finally {
      setIsPurging(false);
    }
  };

  const manualAuditSql = getManualAuditCleanupSql(clinicId);

  const handleCopyAuditSql = async () => {
    try {
      await navigator.clipboard.writeText(manualAuditSql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {}
  };

  const isBusy = isPreviewing || isPurging || isExportingBackup;

  return (
    <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">auto_delete</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
              <span>10. حذف وأرشفة البيانات القديمة (Purge Old Data)</span>
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                data.purge
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
              تنظيف الزيارات والمواعيد والطلبات المنتهية الأقدم من تاريخ محدد مع حماية ملفات المرضى والإعدادات والفواتير الحديثة
            </p>
          </div>
        </div>
        <span
          className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="p-5 pt-4 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs" dir="rtl">
          {/* Permanent Deletion & Protection Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
              <span className="material-symbols-outlined text-lg">warning</span>
              <span>تحذير: الحذف نهائي ولا يمكن التراجع عنه إلا باستعادة نسخة احتياطية</span>
            </div>
            <p className="text-[11px]">
              <strong>بيانات محمية لا تُحذف أبداً عبر هذه الأداة:</strong> ملفات المرضى (`patients`)، الإعدادات (`settings`)، المستخدمون والصلاحيات (`clinic_members`)، الأدلة الطبية، الروشتات، والفواتير والمدفوعات الأحدث من 5 سنوات. لا يُسمح باختيار تاريخ قطع أحدث من 90 يوماً.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Cutoff Date Selection & Shortcuts */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-bold text-slate-800 dark:text-slate-200">
                1. تحديد تاريخ القطع (حذف السجلات الأقدم من هذا التاريخ — بحد أدنى أقدم من 90 يوماً):
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => applyShortcutYears(1)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 font-bold hover:border-[#00c2cb] cursor-pointer disabled:opacity-50"
                >
                  أقدم من سنة
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => applyShortcutYears(2)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 font-bold hover:border-[#00c2cb] cursor-pointer disabled:opacity-50"
                >
                  أقدم من سنتين
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => applyShortcutYears(5)}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 font-bold hover:border-[#00c2cb] cursor-pointer disabled:opacity-50"
                >
                  أقدم من 5 سنوات
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="date"
                value={cutoffDate}
                disabled={isBusy}
                onChange={(e) => {
                  setCutoffDate(e.target.value);
                  setPreviewResult(null);
                  setExecutionResult(null);
                  setErrorMessage(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#18233C] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-mono tabular-nums font-bold focus:outline-none focus:border-[#00c2cb]"
              />
              <span className="text-[11px] text-slate-500 dark:text-[#859394]">
                سيتم فحص السجلات المنتهية قبل تاريخ <strong className="font-mono">{cutoffDate}</strong>
              </span>
            </div>
          </div>

          {/* Step 2: Allowed Scopes Selection */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
            <div className="font-bold text-slate-800 dark:text-slate-200">
              2. اختيار النطاقات المسموح بتنظيفها:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ALLOWED_PURGE_SCOPE_OPTIONS.map((opt) => {
                const checked = selectedScopes.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                      checked
                        ? 'border-[#00c2cb]/50 bg-[#00c2cb]/10 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isBusy}
                      onChange={() => toggleScope(opt.id)}
                      className="mt-1 rounded accent-[#00c2cb]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs flex items-center justify-between gap-2">
                        <span>{opt.label}</span>
                        {opt.requiresFiveYears && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                            شرط ≥ 5 سنوات
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Manual SQL Command Button for audit_events > 365 days */}
            <div className="pt-2 border-t border-slate-200/70 dark:border-white/10 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600 dark:text-[#859394]">
                  سجلات المراجعة (`audit_events`) الأقدم من 365 يوماً محمية بـ Trigger ضد الحذف التلقائي وتُنظَّف يدوياً بواسطة المالك فقط.
                </span>
                <button
                  type="button"
                  onClick={() => setShowManualAuditSql((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                >
                  {showManualAuditSql ? 'إخفاء أمر SQL اليدوي' : 'عرض أمر SQL لتنظيف audit_events (> 365 يوماً)'}
                </button>
              </div>

              {showManualAuditSql && (
                <div className="p-3 rounded-xl bg-slate-950 text-slate-100 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      شغّل هذا الأمر يدوياً في Supabase SQL Editor (لمالك القاعدة فقط):
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyAuditSql()}
                      className="px-2.5 py-1 rounded-lg bg-[#00c2cb] text-slate-950 font-bold text-[11px] cursor-pointer"
                    >
                      {copiedSql ? 'تم النسخ ✓' : 'نسخ أمر SQL'}
                    </button>
                  </div>
                  <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre" dir="ltr">
                    {manualAuditSql}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Preview Button & Results */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  3. معاينة السجلات المتوقع حذفها (دون حذف أي سجل):
                </span>
                <span className="text-[11px] text-slate-500 dark:text-[#859394]">
                  تحقق من الأعداد المتوقعة في كل جدول قبل اتخاذ قرار الحذف.
                </span>
              </div>
              <button
                type="button"
                disabled={isBusy || selectedScopes.length === 0}
                onClick={() => void handlePreview()}
                className="px-4 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">
                  {isPreviewing ? 'sync' : 'preview'}
                </span>
                <span>{isPreviewing ? 'جاري حساب المعاينة...' : 'معاينة الأعداد المتوقع حذفها'}</span>
              </button>
            </div>

            {previewResult && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span>نتيجة المعاينة (سجلات أقدم من {cutoffDate}):</span>
                  <strong className="font-mono tabular-nums text-amber-600 dark:text-amber-400">
                    إجمالي {previewResult.total_count} سجل
                  </strong>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(previewResult.counts).map(([tbl, cnt]) => (
                    <div
                      key={tbl}
                      className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/5 flex items-center justify-between"
                    >
                      <span className="truncate">{TABLE_ARABIC_LABELS[tbl] || tbl}</span>
                      <strong className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
                        {cnt}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 4: Mandatory Backup Export + Confirmation Phrase + Execute Button */}
          <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  4. الخطوة الإلزامية قبل الحذف: تصدير نسخة احتياطية كاملة (JSON)
                </span>
                <span className="text-[11px] text-slate-500 dark:text-[#859394]">
                  لتفعيل زر الحذف النهائي، يجب تنزيل نسخة احتياطية أولاً خلال هذه الجلسة.
                </span>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleMandatoryBackupExport()}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50 ${
                  hasExportedBackupFirst
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:opacity-90'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {hasExportedBackupFirst ? 'check_circle' : 'download'}
                </span>
                <span>
                  {isExportingBackup
                    ? 'جاري تصدير النسخة الاحتياطية...'
                    : hasExportedBackupFirst
                    ? 'تم تصدير النسخة الاحتياطية بنجاح ✓'
                    : 'تصدير نسخة احتياطية JSON الآن (إلزامي)'}
                </span>
              </button>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-rose-500/20">
              <label className="font-bold text-slate-800 dark:text-slate-200 block">
                5. لتأكيد الحذف النهائي، اكتب عبارة التأكيد التالية بدقة:{' '}
                <code className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold">
                  {REQUIRED_PURGE_CONFIRMATION_PHRASE}
                </code>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={confirmationInput}
                  disabled={isBusy || !hasExportedBackupFirst}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder={REQUIRED_PURGE_CONFIRMATION_PHRASE}
                  className="flex-1 min-w-60 px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18233C] border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white font-bold focus:outline-none focus:border-rose-500 disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={
                    isBusy ||
                    !hasExportedBackupFirst ||
                    selectedScopes.length === 0 ||
                    confirmationInput.trim() !== REQUIRED_PURGE_CONFIRMATION_PHRASE
                  }
                  onClick={() => void handleExecutePurge()}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-base">
                    {isPurging ? 'hourglass_top' : 'delete_forever'}
                  </span>
                  <span>
                    {isPurging ? 'جاري حذف البيانات القديمة...' : 'تنفيذ حذف البيانات القديمة الآن'}
                  </span>
                </button>
              </div>
            </div>

            {executionResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 space-y-2">
                <div className="font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>
                    تم حذف البيانات القديمة بنجاح وتوثيق العملية في سجل المراجعة (`data.purge`) — إجمالي السجلات المحذوفة:{' '}
                    <strong className="font-mono tabular-nums">{executionResult.total_deleted}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(executionResult.deleted_counts).map(([tbl, cnt]) => (
                    <div
                      key={tbl}
                      className="px-2.5 py-1.5 rounded bg-white/80 dark:bg-[#111A2E] border border-emerald-500/20 flex items-center justify-between"
                    >
                      <span className="truncate">{TABLE_ARABIC_LABELS[tbl] || tbl}</span>
                      <strong className="font-mono tabular-nums">{cnt}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
