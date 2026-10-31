import React, { useState, useEffect, useCallback } from 'react';
import type { Patient } from '../../types/database';
import type { TransactionRecord } from '../../types';
import {
  currentPeriod,
  periodToRange,
  fetchTotal,
  fetchPaymentsPage,
  fetchUnpaidInvoices,
  type PeriodSel,
} from '../../services/financePaged';
import { buildTransactions } from '../../utils/buildTransactions';
import { usePagedList } from './usePagedList';
import { PeriodPicker, periodLabel } from './PeriodPicker';
import { Pager } from './Pager';
import { toEnglishDigits } from '../../utils/numberUtils';
import type { DocumentSnapshot } from 'firebase/firestore';

interface InflowPageProps {
  patientsCanonical: Patient[];
  refreshKey: number;
  onPrint: (tx: TransactionRecord) => void;
  onDelete?: (tx: TransactionRecord) => void;
  onCreateInvoice: () => void;
}

export const InflowPage: React.FC<InflowPageProps> = ({
  patientsCanonical,
  refreshKey,
  onPrint,
  onDelete,
  onCreateInvoice,
}) => {
  const [period, setPeriod] = useState<PeriodSel>(currentPeriod);
  const [view, setView] = useState<'received' | 'unpaid'>('received');
  const [totalData, setTotalData] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [totalLoading, setTotalLoading] = useState(false);
  const [totalError, setTotalError] = useState<string | null>(null);

  // Unpaid invoices state (loaded only when unpaid tab is active)
  const [unpaidRecords, setUnpaidRecords] = useState<TransactionRecord[]>([]);
  const [unpaidLoading, setUnpaidLoading] = useState(false);
  const [unpaidError, setUnpaidError] = useState<string | null>(null);

  // Load Aggregated Total
  useEffect(() => {
    let cancelled = false;
    setTotalLoading(true);
    setTotalError(null);
    fetchTotal('payments', periodToRange(period))
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

  // Load Unpaid Invoices
  useEffect(() => {
    if (view !== 'unpaid') return;
    let cancelled = false;
    setUnpaidLoading(true);
    setUnpaidError(null);
    fetchUnpaidInvoices()
      .then((invs) => {
        if (cancelled) return;
        const txs = buildTransactions({
          payments: [],
          invoices: invs,
          patients: patientsCanonical,
        });
        setUnpaidRecords(txs);
      })
      .catch((err) => {
        if (!cancelled) setUnpaidError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setUnpaidLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [view, refreshKey, patientsCanonical]);

  // Paginated Received Payments
  const fetchPage = useCallback(
    async (after: DocumentSnapshot | null) => {
      const res = await fetchPaymentsPage(periodToRange(period), after);
      const items = buildTransactions({
        payments: res.items,
        invoices: res.invoices,
        patients: patientsCanonical,
      });
      return {
        items,
        cursor: res.cursor,
        hasNext: res.hasNext,
      };
    },
    [period, patientsCanonical]
  );

  const {
    items: receivedItems,
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
              يتطلب هذا الاستعلام فهرساً مركباً في Firestore (يتم إنشاؤه عبر نشر firestore.indexes.json أو عبر الرابط الموضح في سجلات Console).
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

      {/* Top Aggregated Card: Inflow Total & Period Selection */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-white to-white dark:from-emerald-500/10 dark:via-[#111A2E] dark:to-[#111A2E] p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">arrow_downward</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                إجمالي الوارد (المتحصلات المالية)
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono">
                {periodLabel(period)}
              </span>
            </div>

            <div className="text-3xl font-black text-emerald-600 dark:text-[#10B981] font-mono pt-1">
              {totalLoading ? '…' : formatCurrency(totalData.total)}
            </div>

            <div className="text-xs text-slate-500 dark:text-[#859394] font-medium flex items-center gap-2">
              <span>عدد سجلات التحصيل للفترة:</span>
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

      {/* Sub-Tabs: Received vs Unpaid + Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#111A2E] p-1 rounded-xl border border-slate-200 dark:border-white/5">
          <button
            type="button"
            onClick={() => setView('received')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              view === 'received'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-[#bbc9ca] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>المتحصلات المسددة</span>
          </button>

          <button
            type="button"
            onClick={() => setView('unpaid')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              view === 'unpaid'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-[#bbc9ca] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-sm">pending_actions</span>
            <span>فواتير غير مسددة</span>
            {unpaidRecords.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-mono">
                {unpaidRecords.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onCreateInvoice}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span>إنشاء فاتورة كشف</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#00c2cb]">receipt_long</span>
            <span>
              {view === 'received'
                ? `سجل المتحصلات والمدفوعات (${periodLabel(period)})`
                : 'فواتير الكشوفات والخدمات غير المسددة'}
            </span>
          </h4>
          <span className="text-[11px] text-slate-400 dark:text-[#859394]">
            {view === 'received' ? '25 سجل لكل صفحة من الخادم' : 'عرض مباشر للفواتير المعلقة'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#bbc9ca] border-b border-slate-200 dark:border-white/5 font-bold">
                <th className="p-3">المريض</th>
                <th className="p-3">الخدمة الطبية</th>
                <th className="p-3 text-center">المبلغ الإجمالي</th>
                <th className="p-3 text-center">التاريخ والوقت</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {view === 'received' ? (
                pageLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-400 dark:text-[#859394]">
                      <span className="inline-flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                        <span>جارٍ تحميل سجلات الوارد من الخادم…</span>
                      </span>
                    </td>
                  </tr>
                ) : pageError ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-rose-500">
                      <div>خطأ أثناء جلب البيانات: {pageError}</div>
                      <button
                        type="button"
                        onClick={reload}
                        className="mt-2 px-3 py-1 rounded-lg bg-rose-500/10 text-rose-600 font-bold"
                      >
                        إعادة المحاولة
                      </button>
                    </td>
                  </tr>
                ) : receivedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-slate-400 dark:text-[#859394]">
                      لا توجد فواتير أو متحصلات مسجلة لهذه الفترة
                    </td>
                  </tr>
                ) : (
                  receivedItems.map((tx) => renderRow(tx, onPrint, onDelete))
                )
              ) : unpaidLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-slate-400 dark:text-[#859394]">
                    <span className="inline-flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                      <span>جارٍ فحص الفواتير غير المسددة…</span>
                    </span>
                  </td>
                </tr>
              ) : unpaidError ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-rose-500">
                    خطأ: {unpaidError}
                  </td>
                </tr>
              ) : unpaidRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-slate-400 dark:text-[#859394]">
                    لا توجد فواتير غير مسددة حالياً
                  </td>
                </tr>
              ) : (
                unpaidRecords.map((tx) => renderRow(tx, onPrint, onDelete))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pager (Active on received view) */}
        {view === 'received' && (
          <div className="p-4 border-t border-slate-100 dark:border-white/5">
            <Pager
              pageIndex={pageIndex}
              hasNext={hasNext}
              loading={pageLoading}
              onPrev={prev}
              onNext={next}
            />
          </div>
        )}
      </div>
    </div>
  );
};

function renderRow(
  tx: TransactionRecord,
  onPrint: (tx: TransactionRecord) => void,
  onDelete?: (tx: TransactionRecord) => void
) {
  const amountDisplay = tx.amount || tx.paidAmount || tx.totalAmount || 0;
  const isPaid = tx.status !== 'غير مدفوعة';

  return (
    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#18233C]/60 transition-colors">
      <td className="p-3 font-bold text-slate-900 dark:text-[#dde2f5]">
        <div>{tx.patientName}</div>
      </td>
      <td className="p-3 text-slate-700 dark:text-[#bbc9ca]">
        {tx.serviceName || tx.description || 'كشف واستشارة طبية'}
      </td>
      <td className="p-3 text-center font-mono font-bold text-sm text-emerald-600 dark:text-[#10B981]">
        {toEnglishDigits(amountDisplay.toLocaleString('en-US'))} ج.م
      </td>
      <td className="p-3 text-center font-mono text-[11px] whitespace-nowrap">
        <div className="text-slate-800 dark:text-slate-200 font-bold">{toEnglishDigits(tx.date || '—')}</div>
        <div className="text-[10px] text-[#008f97] dark:text-[#00c2cb] font-bold flex items-center justify-center gap-1 mt-0.5">
          <span className="material-symbols-outlined text-[12px]">schedule</span>
          <span>{tx.time ? `الساعة ${toEnglishDigits(tx.time)}` : '—'}</span>
        </div>
      </td>
      <td className="p-3 text-center">
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            isPaid
              ? 'bg-emerald-100 dark:bg-[#10B981]/20 text-emerald-700 dark:text-[#10B981] border border-emerald-200 dark:border-[#10B981]/30'
              : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
          }`}
        >
          {tx.status || 'مدفوعة'}
        </span>
      </td>
      <td className="p-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onPrint(tx)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#080e1b] hover:bg-[#00c2cb]/20 text-slate-600 dark:text-[#bbc9ca] hover:text-[#008f97] dark:hover:text-[#00c2cb] transition-colors cursor-pointer"
            title="عرض وطباعة إيصال السداد"
          >
            <span className="material-symbols-outlined text-base">print</span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(tx)}
              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
              title="حذف الفاتورة"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
