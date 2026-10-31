import React, { useState, useEffect, useCallback } from 'react';
import type { ClinicExpenseRecord } from '../../utils/financeManager';
import {
  currentPeriod,
  periodToRange,
  fetchTotal,
  fetchExpensesPage,
  type PeriodSel,
} from '../../services/financePaged';
import { usePagedList } from './usePagedList';
import { PeriodPicker, periodLabel } from './PeriodPicker';
import { Pager } from './Pager';
import { toEnglishDigits, formatAppDate } from '../../utils/numberUtils';
import type { DocumentSnapshot } from 'firebase/firestore';

interface ExpensesPageProps {
  refreshKey: number;
  onDelete: (exp: ClinicExpenseRecord) => void;
}

export const ExpensesPage: React.FC<ExpensesPageProps> = ({ refreshKey, onDelete }) => {
  const [period, setPeriod] = useState<PeriodSel>(currentPeriod);
  const [totalData, setTotalData] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [totalLoading, setTotalLoading] = useState(false);
  const [totalError, setTotalError] = useState<string | null>(null);

  // Load Aggregated Total
  useEffect(() => {
    let cancelled = false;
    setTotalLoading(true);
    setTotalError(null);
    fetchTotal('expenses', periodToRange(period))
      .then((res) => {
        if (!cancelled) setTotalData(res);
      })
      .catch((err) => {
        if (!cancelled) setTotalError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setTotalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, refreshKey]);

  // Paginated Expenses
  const fetchPage = useCallback(
    async (after: DocumentSnapshot | null) => {
      return fetchExpensesPage<ClinicExpenseRecord>(periodToRange(period), after);
    },
    [period]
  );

  const {
    items: expenses,
    loading: pageLoading,
    error: pageError,
    hasNext,
    pageIndex,
    next,
    prev,
    reload,
  } = usePagedList(fetchPage, refreshKey);

  const formatCurrency = (val: number) => {
    return `${toEnglishDigits(
      val.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )} ج.م`;
  };

  const formatArabicDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return toEnglishDigits(dateStr);
      return formatAppDate(d, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return toEnglishDigits(dateStr);
    }
  };

  const isIndexError =
    (pageError && pageError.includes('failed-precondition')) ||
    (totalError && totalError.includes('failed-precondition'));

  return (
    <div className="space-y-6">
      {/* Index Build Notice if compound index is pending */}
      {isIndexError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-amber-500">warning</span>
            <span>
              يتطلب استعلام المصروفات فهرساً مركباً في Firestore (يتم إنشاؤه عبر نشر firestore.indexes.json أو عبر الرابط الموضح في Console).
            </span>
          </div>
          <button
            type="button"
            onClick={reload}
            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold transition-colors cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Top Aggregated Card: Outflow Total & Period Selection */}
      <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-white to-white dark:from-rose-500/10 dark:via-[#111A2E] dark:to-[#111A2E] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">arrow_upward</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                إجمالي المنصرف (المصروفات)
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono">
                {periodLabel(period)}
              </span>
            </div>

            <div className="text-3xl font-black text-rose-600 dark:text-[#ef4444] font-mono pt-1">
              {totalLoading ? '…' : formatCurrency(totalData.total)}
            </div>

            <div className="text-xs text-slate-500 dark:text-[#859394] font-medium flex items-center gap-2">
              <span>عدد بنود المصروفات للفترة:</span>
              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                {totalLoading ? '…' : toEnglishDigits(totalData.count)}
              </strong>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              تحديد الفترة الزمنية:
            </div>
            <PeriodPicker value={period} onChange={setPeriod} />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-rose-500">trending_down</span>
            <span>سجل مصروفات العيادة ({periodLabel(period)})</span>
          </h4>
          <span className="text-[11px] text-slate-400 dark:text-[#859394]">
            25 سجل لكل صفحة من الخادم
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#bbc9ca] border-b border-slate-200 dark:border-white/5 font-bold">
                <th className="p-3">البند</th>
                <th className="p-3 text-center">المبلغ</th>
                <th className="p-3 text-center">التاريخ</th>
                <th className="p-3 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pageLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-slate-400 dark:text-[#859394]">
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>جارٍ تحميل سجلات المصروفات…</span>
                    </span>
                  </td>
                </tr>
              ) : pageError ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-rose-500">
                    <div>خطأ أثناء جلب المصروفات: {pageError}</div>
                    <button
                      type="button"
                      onClick={reload}
                      className="mt-2 px-3 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-bold"
                    >
                      إعادة المحاولة
                    </button>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-xs text-slate-400 dark:text-[#859394]">
                    لا توجد مصروفات مسجلة لهذه الفترة
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-[#18233C]/60 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-[#dde2f5]">
                      <div>{exp.category}</div>
                      {exp.notes && (
                        <span className="text-[10px] text-slate-500 dark:text-[#859394] block font-normal">
                          {exp.notes}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-sm text-rose-600 dark:text-[#ef4444]">
                      {toEnglishDigits((exp.amount || 0).toLocaleString())} ج.م
                    </td>
                    <td className="p-3 text-center font-mono text-slate-500 dark:text-[#859394] text-[11px] whitespace-nowrap">
                      {formatArabicDate(exp.date)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => onDelete(exp)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        title="حذف المصروف"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pager */}
        <div className="p-4 border-t border-slate-100 dark:border-white/5">
          <Pager
            pageIndex={pageIndex}
            hasNext={hasNext}
            loading={pageLoading}
            onPrev={prev}
            onNext={next}
          />
        </div>
      </div>
    </div>
  );
};
