import React, { useState, useMemo } from 'react';
import { CLINIC_INFO } from '../../data/previewClinicData';
import { useDoctorName } from '../../hooks/useDoctorName';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatAppDate } from '../../utils/numberUtils';
import { toDayKey, todayKey, addDaysToKey } from '../../utils/dayKey';
import type { Visit, Invoice, Payment, Prescription, FollowUp, Patient } from '../../types/database';

interface ClinicalReportsScreenProps {
  visits?: Visit[];
  invoices?: Invoice[];
  payments?: Payment[];
  prescriptions?: Prescription[];
  followUps?: FollowUp[];
  patients?: Patient[];
  onExportReport?: (type: 'pdf' | 'excel') => void;
}

const BAR_COLORS = [
  'bg-[#00c2cb]',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-rose-500',
];

export const ClinicalReportsScreen: React.FC<ClinicalReportsScreenProps> = ({
  visits = [],
  invoices = [],
  payments = [],
  prescriptions = [],
  followUps = [],
  patients = [],
}) => {
  const { language, isRTL, t } = useLanguage();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'quarter'>('month');
  const [toast, setToast] = useState<string | null>(null);

  const activeDoctorName = useDoctorName();
  const currentTodayKey = useMemo(() => todayKey(), []);

  // Compute date range boundary keys (YYYY-MM-DD)
  const { startDate, endDate, rangeLabel } = useMemo(() => {
    switch (timeRange) {
      case 'today':
        return {
          startDate: currentTodayKey,
          endDate: currentTodayKey,
          rangeLabel: 'اليوم',
        };
      case 'week':
        return {
          startDate: addDaysToKey(currentTodayKey, -6),
          endDate: currentTodayKey,
          rangeLabel: 'آخر 7 أيام',
        };
      case 'quarter':
        return {
          startDate: addDaysToKey(currentTodayKey, -89),
          endDate: currentTodayKey,
          rangeLabel: 'الربع الحالي (آخر 90 يوماً)',
        };
      case 'month':
      default:
        return {
          startDate: addDaysToKey(currentTodayKey, -29),
          endDate: currentTodayKey,
          rangeLabel: 'هذا الشهر (آخر 30 يوماً)',
        };
    }
  }, [timeRange, currentTodayKey]);

  // Dynamic calculation from canonical Firestore collections
  const analytics = useMemo(() => {
    // 1. Filter items by date range
    const rangeVisits = visits.filter((v) => {
      const k = v.dayKey || toDayKey(v.createdAt);
      return k >= startDate && k <= endDate;
    });

    const rangeInvoices = invoices.filter((inv) => {
      const k = inv.dayKey || toDayKey(inv.createdAt);
      return k >= startDate && k <= endDate;
    });

    const rangePayments = payments.filter((pm) => {
      const k = pm.dayKey || toDayKey(pm.paidAt || (pm as any).createdAt);
      return k >= startDate && k <= endDate;
    });

    const rangePrescriptions = prescriptions.filter((pr) => {
      const k = pr.dayKey || toDayKey(pr.createdAt);
      return k >= startDate && k <= endDate;
    });

    const rangeFollowUps = followUps.filter((fu) => {
      const k = fu.dayKey || toDayKey(fu.createdAt);
      return k >= startDate && k <= endDate;
    });

    // 2. Metrics calculation
    const totalVisits = rangeVisits.length;
    const newVisits = rangeVisits.filter((v) => v.visitType === 'NEW').length;
    const followupVisits = totalVisits - newVisits;

    const visitsBreakdown =
      totalVisits > 0
        ? `منها ${newVisits} كشف جديد و ${followupVisits} استشارة ومتابعة`
        : 'لا توجد كشوفات مسجلة خلال هذه الفترة';

    // Revenue sum: payments first, fallback to invoice paid amounts
    const revenueVal =
      rangePayments.length > 0
        ? rangePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
        : rangeInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);

    const revenueStr = revenueVal.toLocaleString('en-US');

    // Exam duration average
    let totalExamMins = 0;
    let completedCount = 0;
    rangeVisits.forEach((v) => {
      if (v.startedAt && v.completedAt) {
        const start = new Date(v.startedAt).getTime();
        const end = new Date(v.completedAt).getTime();
        if (end > start) {
          totalExamMins += (end - start) / 60000;
          completedCount++;
        }
      }
    });
    const avgExamDuration =
      completedCount > 0 ? (totalExamMins / completedCount).toFixed(1) : '0.0';

    // Wait time average
    let totalWaitMins = 0;
    let waitCount = 0;
    rangeVisits.forEach((v) => {
      if (v.createdAt && v.startedAt) {
        const created = new Date(v.createdAt).getTime();
        const started = new Date(v.startedAt).getTime();
        if (started > created) {
          totalWaitMins += (started - created) / 60000;
          waitCount++;
        }
      }
    });
    const avgWaitTime =
      waitCount > 0 ? (totalWaitMins / waitCount).toFixed(1) : '0.0';

    // 3. Diagnosis distribution
    const diagMap = new Map<string, number>();
    rangeVisits.forEach((v) => {
      const diagList = v.clinicalData?.diagnosis;
      if (Array.isArray(diagList)) {
        diagList.forEach((d) => {
          if (d && d.trim()) {
            const name = d.trim();
            diagMap.set(name, (diagMap.get(name) || 0) + 1);
          }
        });
      } else if (typeof diagList === 'string' && (diagList as string).trim()) {
        const name = (diagList as string).trim();
        diagMap.set(name, (diagMap.get(name) || 0) + 1);
      }
    });

    const totalDiagnosesCount = Array.from(diagMap.values()).reduce((a, b) => a + b, 0);
    const sortedDiagnoses = Array.from(diagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], index) => {
        const percent = totalDiagnosesCount > 0 ? Math.round((count / totalDiagnosesCount) * 100) : 0;
        return {
          name,
          count,
          percent,
          color: BAR_COLORS[index % BAR_COLORS.length],
        };
      });

    // 4. Top Prescribed Medications
    const medMap = new Map<string, number>();
    rangePrescriptions.forEach((pr) => {
      if (Array.isArray(pr.items)) {
        pr.items.forEach((item) => {
          if (item && item.name && item.name.trim()) {
            const name = item.name.trim();
            medMap.set(name, (medMap.get(name) || 0) + 1);
          }
        });
      }
    });

    const totalMedsCount = Array.from(medMap.values()).reduce((a, b) => a + b, 0);
    const sortedMedications = Array.from(medMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], index) => {
        const percent = totalMedsCount > 0 ? Math.round((count / totalMedsCount) * 100) : 0;
        return {
          name,
          count,
          percent,
          color: BAR_COLORS[(index + 2) % BAR_COLORS.length],
        };
      });

    // 5. Followup analytics
    const totalFollowups = rangeFollowUps.length;
    const overdueFollowups = rangeFollowUps.filter((f) => f.status === 'OVERDUE').length;
    const completedFollowups = rangeFollowUps.filter((f) => f.status === 'COMPLETED').length;
    const retentionRate =
      totalFollowups > 0 ? `${Math.round((completedFollowups / totalFollowups) * 100)}%` : '100%';

    return {
      label: rangeLabel,
      totalVisits,
      newVisits,
      followupVisits,
      visitsBreakdown,
      revenue: revenueStr,
      avgExamDuration,
      avgWaitTime,
      diagnoses: sortedDiagnoses,
      medications: sortedMedications,
      followupStats: {
        retention: retentionRate,
        count: `${totalFollowups} متابعة`,
        overdue: `${overdueFollowups} حالة`,
      },
    };
  }, [visits, invoices, payments, prescriptions, followUps, startDate, endDate, rangeLabel, language]);

  // Export handlers
  const handleExport = (format: 'PDF' | 'Excel') => {
    if (format === 'PDF') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setToast('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير PDF');
        return;
      }
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8" />
          <title>تقرير العيادة الإكلينيكي - ${analytics.label}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #00c2cb; padding-bottom: 12px; margin-bottom: 20px; }
            .header h1 { margin: 0; color: #08101C; font-size: 22px; }
            .header h2 { margin: 4px 0 0 0; color: #008f97; font-size: 16px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .kpi-card { border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; text-align: center; background: #f8fafc; }
            .kpi-title { font-size: 11px; color: #64748b; font-weight: bold; }
            .kpi-value { font-size: 20px; font-weight: bold; margin: 6px 0; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: right; font-size: 12px; }
            th { background: #f1f5f9; color: #334155; }
            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>سولي ميديكال كلينيك - ${CLINIC_INFO.name}</h1>
            <h2>${activeDoctorName} - التقرير الطبي الشامل (${analytics.label})</h2>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">تاريخ الاستخراج: ${formatAppDate(new Date(), undefined, language)}</p>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-title">إجمالي الكشوفات والزيارات</div>
              <div class="kpi-value">${analytics.totalVisits}</div>
              <div style="font-size: 10px; color: #008f97;">${analytics.visitsBreakdown}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">الإيرادات المحصلة</div>
              <div class="kpi-value">${analytics.revenue} ج.م</div>
              <div style="font-size: 10px; color: #64748b;">مقبوضات الفترة</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">متوسط مدة الكشف</div>
              <div class="kpi-value">${analytics.avgExamDuration} دقيقة</div>
              <div style="font-size: 10px; color: #10b981;">فحص وتوجيه علاجي</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-title">متوسط زمن الانتظار</div>
              <div class="kpi-value">${analytics.avgWaitTime} دقيقة</div>
              <div style="font-size: 10px; color: #f59e0b;">تدفق صالة الانتظار</div>
            </div>
          </div>

          <h3>توزيع أكثر التشخيصات والحالات تردداً</h3>
          ${
            analytics.diagnoses.length === 0
              ? '<p style="font-size: 12px; color: #64748b; text-align: center;">لا توجد تشخيصات مسجلة في هذه الفترة بعد.</p>'
              : `
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>التشخيص الطبي الإكلينيكي</th>
                  <th>عدد الحالات</th>
                  <th>النسبة المئوية</th>
                </tr>
              </thead>
              <tbody>
                ${analytics.diagnoses
                  .map(
                    (d, i) => `
                  <tr>
                    <td>${i + 1}</td>
                    <td>${d.name}</td>
                    <td>${d.count} حالة</td>
                    <td>${d.percent}%</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
            `
          }

          <div class="footer">
            تم توليد هذا التقرير آلياً من نظام إدارة عيادة سولي - ${activeDoctorName}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setToast('تم فتح نافذة المعاينة وتصدير PDF بنجاح.');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (format === 'Excel') {
      const csvRows = [
        ['\uFEFFتاريخ التقرير', formatAppDate(new Date(), undefined, language)],
        ['الطبيب المعالج', activeDoctorName],
        ['الفترة المحددة', analytics.label],
        [''],
        ['المؤشر الإكلينيكي / المالي', 'القيمة'],
        ['إجمالي الكشوفات والزيارات', analytics.totalVisits],
        ['إجمالي الإيرادات المحصلة (ج.م)', analytics.revenue],
        ['متوسط مدة الكشف (دقيقة)', analytics.avgExamDuration],
        ['متوسط زمن الانتظار (دقيقة)', analytics.avgWaitTime],
        [''],
        ['التشخيص الطبي', 'عدد الحالات', 'النسبة المئوية'],
        ...analytics.diagnoses.map((d) => [d.name, d.count, `${d.percent}%`]),
        [''],
        ['الأدوية الأكثر وصفاً', 'التكرار', 'النسبة المئوية'],
        ...analytics.medications.map((m) => [m.name, m.count, `${m.percent}%`]),
      ];

      const csvContent = csvRows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Soli_Clinic_Report_${analytics.label}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToast('تم إنشاء وتنزيل ملف Excel / CSV بنجاح.');
      setTimeout(() => setToast(null), 3500);
    }
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-6 text-slate-800 dark:text-[#dde2f5]">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#18233C] border border-[#00c2cb] text-slate-900 dark:text-[#45dee7] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-2xl text-[#00c2cb]">download_done</span>
          <span className="text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#859394] mb-1">
            <span>الرئيسية</span>
            <span>&gt;</span>
            <span className="text-[#008f97] dark:text-[#00c2cb]">التقارير والإحصائيات الإكلينيكية</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-3">
            <span>لوحة المؤشرات والذكاء الإكلينيكي</span>
            <span className="bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] px-3 py-0.5 rounded-full text-xs font-bold border border-[#00c2cb]/20">
              محدثة لحظياً
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range pills */}
          <div className="flex items-center bg-slate-100 dark:bg-[#111A2E] p-1 rounded-xl border border-slate-200 dark:border-white/5">
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'آخر 7 أيام' },
              { id: 'month', label: 'هذا الشهر' },
              { id: 'quarter', label: 'آخر 90 يوماً' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timeRange === tab.id
                    ? 'bg-[#00c2cb] text-[#08101C] shadow-sm'
                    : 'text-slate-600 dark:text-[#bbc9ca] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <button
            onClick={() => handleExport('PDF')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#18233C] hover:bg-slate-50 dark:hover:bg-[#242a38] text-slate-700 dark:text-[#dde2f5] text-xs font-bold border border-slate-200 dark:border-white/10 shadow-xs cursor-pointer transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base text-rose-500">picture_as_pdf</span>
            <span>تصدير PDF</span>
          </button>
          <button
            onClick={() => handleExport('Excel')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] text-xs font-bold shadow-md shadow-[#00c2cb]/20 cursor-pointer transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-base">table_view</span>
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Guidance banner when no visits in current timeframe */}
      {analytics.totalVisits === 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-start sm:items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0 mt-0.5 sm:mt-0">
            info
          </span>
          <div className="text-xs leading-relaxed">
            <strong className="font-bold block mb-0.5">جاهزية العيادة لجمع الإحصائيات ({analytics.label}):</strong>
            <span>
              لا توجد زيارات أو تقارير إكلينيكية مسجلة في هذه الفترة الزمنية حتى الآن. تظهر المؤشرات والرسوم البيانية التفاعلية والتشخيصات الأهم آلياً فور تسجيل كشوفات أو روشتات جديدة.
            </span>
          </div>
        </div>
      )}

      {/* 4 Essential Clinical & Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">إجمالي الكشوفات والزيارات</span>
            <span className="w-8 h-8 rounded-lg bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center">
              <span className="material-symbols-outlined text-base">groups</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-[#dde2f5] font-mono">
              {analytics.totalVisits}
            </span>
            <span className="text-xs text-slate-500 dark:text-[#859394]">زيارة</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-[#bbc9ca]">
            {analytics.visitsBreakdown}
          </span>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">إجمالي الإيرادات المحصلة</span>
            <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-[#d0bcff] flex items-center justify-center">
              <span className="material-symbols-outlined text-base">monetization_on</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-700 dark:text-[#d0bcff] font-mono">
              {analytics.revenue}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">ج.م</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-[#bbc9ca]">
            مقبوضات الكشوفات الفعلية للفترة ({analytics.label})
          </span>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">متوسط مدة الكشف الطبي</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">timer</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-[#10B981] font-mono">
              {analytics.avgExamDuration}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">دقيقة / مريض</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-[#bbc9ca]">
            متوسط زمن الفحص المكتمل بالفترة
          </span>
        </div>

        <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">متوسط انتظار صالة الانتظار</span>
            <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-base">hourglass_top</span>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {analytics.avgWaitTime}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-[#859394]">دقيقة</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-[#bbc9ca]">
            زمن الانتظار الفعلي قبل الدخول
          </span>
        </div>
      </div>

      {/* Main Analytical Grid: Most Frequent Diagnoses & Top Prescribed Medications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Most Frequent Diagnoses - 7 Cols */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111A2E] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">bar_chart</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                أكثر التشخيصات والأمراض تردداً على العيادة
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#859394]">
              {analytics.diagnoses.length} تشخيصات
            </span>
          </div>

          {analytics.diagnoses.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-dashed border-slate-200 dark:border-white/10 text-center space-y-2 my-auto">
              <span className="material-symbols-outlined text-3xl text-slate-400">medical_services</span>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                لا توجد تشخيصات مسجلة في هذه الفترة بعد
              </p>
              <p className="text-[11px] text-slate-400">
                يتم تصنيف التشخيصات وتكرارها آلياً عند تسجيل الكشف الطبي بالحالة.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.diagnoses.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 dark:text-[#dde2f5]">{item.name}</span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 dark:text-[#859394]">{item.count} حالة</span>
                      <span className="text-[#008f97] dark:text-[#00c2cb] font-bold">{item.percent}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-[#080e1b] rounded-full overflow-hidden border border-slate-200 dark:border-white/5">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${item.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Prescribed Medications - 5 Cols */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111A2E] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600 dark:text-[#d0bcff] text-xl">medication</span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                الأدوية والروشتات الأكثر استخداماً
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-[#859394]">
              {analytics.medications.length} أدوية
            </span>
          </div>

          {analytics.medications.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-dashed border-slate-200 dark:border-white/10 text-center space-y-2 my-auto">
              <span className="material-symbols-outlined text-3xl text-slate-400">pill</span>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                لا توجد أدوية أو روشتات موصوفة في هذه الفترة بعد
              </p>
              <p className="text-[11px] text-slate-400">
                تظهر الأدوية الأكثر تكراراً تلقائياً بمجرد طباعة وحفظ الروشتات الطبية.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {analytics.medications.map((med, i) => (
                <div
                  key={i}
                  className="p-3 bg-slate-50 dark:bg-[#080e1b] rounded-xl flex items-center justify-between border border-slate-200 dark:border-white/5"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">{med.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#859394]">
                      تم وصفه {med.count} مرة
                    </span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-[#d0bcff] border border-purple-200 dark:border-purple-800/30">
                    {med.percent}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto p-3.5 rounded-xl bg-purple-50 dark:bg-[#18233C] border border-purple-200 dark:border-purple-800/30 flex items-center gap-3">
            <span className="material-symbols-outlined text-purple-600 dark:text-[#d0bcff] text-xl">lightbulb</span>
            <p className="text-xs text-purple-900 dark:text-[#d0bcff] leading-relaxed">
              <strong>توصية ذكية:</strong> يمكنك متابعة الأدوية الأكثر تكراراً لضبط مفضلة الروشتة السريعة في الإعدادات.
            </p>
          </div>
        </div>
      </div>

      {/* Followup & Patient Loyalty Analytics */}
      <div className="bg-white dark:bg-[#111A2E] p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-xl">health_and_safety</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
              حوكمة المتابعات والتزام المرضى ({analytics.label})
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-[#859394]">
            نظام متابعات {activeDoctorName}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-200 dark:border-white/5 flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-[#859394]">معدل اكتمال المتابعات:</span>
            <span className="text-xl font-bold text-slate-900 dark:text-[#dde2f5] font-mono">
              {analytics.followupStats.retention}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
              مؤشر متابعة وشفاء تراكمي
            </span>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-200 dark:border-white/5 flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-[#859394]">إجمالي المتابعات بالفترة:</span>
            <span className="text-xl font-bold text-slate-900 dark:text-[#dde2f5] font-mono">
              {analytics.followupStats.count}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-[#bbc9ca]">
              متابعات مسجلة ومجدولة
            </span>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-200 dark:border-white/5 flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-[#859394]">حالات تجاوزت فترة المتابعة:</span>
            <span className="text-xl font-bold text-purple-600 dark:text-[#d0bcff] font-mono">
              {analytics.followupStats.overdue}
            </span>
            <span className="text-[11px] text-purple-700 dark:text-[#d0bcff]">
              متابعات متأخرة تنتظر التواصل
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
