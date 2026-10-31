import React, { useState, useEffect } from 'react';
import { READ_OPT } from '../../config/readOpt';
import {
  getTodayStats,
  resetTodayStats,
  type MeterSource,
} from '../../services/readMeter';

interface SourceMeta {
  key: MeterSource;
  label: string;
  desc: string;
  icon: string;
}

const SOURCES: SourceMeta[] = [
  { key: 'تحميل أول', label: 'تحميل أول', desc: 'أول لقطة لكل مستمع عند فتح النظام', icon: 'download' },
  { key: 'تحديثات حية', label: 'تحديثات حية (تسجيل ومزامنة)', desc: 'المستندات التي تغيّرت بعد التحميل الأول', icon: 'sync' },
  { key: 'ملف مريض', label: 'ملف مريض', desc: 'القراءات عند فتح ملف مريض أو الفحص', icon: 'badge' },
  { key: 'مالية', label: 'مالية', desc: 'صفحات الوارد والمنصرف وتبديل الفترة', icon: 'payments' },
  { key: 'لوحة التحكم', label: 'لوحة التحكم', desc: 'إحصائيات فترة الأسبوع أو الشهر', icon: 'dashboard' },
  { key: 'حجوزات', label: 'حجوزات', desc: 'القراءات في شاشة الحجز الإلكتروني', icon: 'calendar_clock' },
  { key: 'إعدادات', label: 'إعدادات', desc: 'خيارات النظام والخدمات وقوائم العيادة', icon: 'settings' },
  { key: 'أخرى', label: 'أخرى', desc: 'استعلامات إضافية ومصادر عامة', icon: 'dns' },
];

export function ReadOptCard() {
  const [stats, setStats] = useState(() => getTodayStats());

  useEffect(() => {
    const handleUpdate = () => {
      setStats(getTodayStats());
    };

    window.addEventListener('soli_read_stats_updated', handleUpdate);
    return () => {
      window.removeEventListener('soli_read_stats_updated', handleUpdate);
    };
  }, []);

  const totalReads = SOURCES.reduce(
    (acc, s) => acc + (stats.reads[s.key] ?? 0),
    0
  );

  const handleToggleReadOpt = () => {
    try {
      localStorage.setItem('soli_read_opt', READ_OPT ? '0' : '1');
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    window.location.reload();
  };

  const handleReset = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تصفير عداد قراءات وكتابات اليوم لهذا الجهاز؟')) {
      resetTodayStats();
      setStats(getTodayStats());
    }
  };

  return (
    <div
      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-5 space-y-5 shadow-sm"
      dir="rtl"
    >
      {/* Top Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-[#00c2cb] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">analytics</span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span>وضع توفير القراءات وعداد الاستهلاك الموزّع</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
              عند التفعيل يحمّل النظام بيانات اليوم والأمس فقط ويجلب التاريخ القديم عند الطلب
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="self-start sm:self-auto flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              READ_OPT
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                READ_OPT ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span>وضع توفير القراءات: {READ_OPT ? 'مفعّل' : 'مطفأ'}</span>
          </span>
        </div>
      </div>

      {/* Reads by Source Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-slate-400">table_chart</span>
            <span className="text-xs font-bold text-slate-700 dark:text-[#dde2f5]">
              قراءات هذا الجهاز اليوم مقسّمة حسب المصدر ({stats.date})
            </span>
          </div>
          <span className="text-[11px] text-teal-600 dark:text-[#00c2cb] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
            مزامنة حية
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-[#080E1B]/60">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-white/5 text-slate-600 dark:text-[#859394] font-bold border-b border-slate-200/70 dark:border-white/5">
                <th className="py-2.5 px-3 text-right">المصدر</th>
                <th className="py-2.5 px-3 text-right hidden sm:table-cell">الوصف</th>
                <th className="py-2.5 px-3 text-left">عدد القراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {SOURCES.map((s) => {
                const count = stats.reads[s.key] ?? 0;
                return (
                  <tr
                    key={s.key}
                    className="hover:bg-white dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                        <span className="material-symbols-outlined text-sm text-slate-400 dark:text-slate-500">
                          {s.icon}
                        </span>
                        <span>{s.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 dark:text-[#859394] hidden sm:table-cell">
                      {s.desc}
                    </td>
                    <td className="py-2.5 px-3 text-left">
                      <span
                        className={`inline-block font-mono text-xs font-bold px-2.5 py-0.5 rounded-md min-w-[36px] text-center ${
                          count > 0
                            ? 'bg-teal-500/15 text-teal-700 dark:text-[#45dee7]'
                            : 'bg-slate-200/60 dark:bg-white/5 text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {count.toLocaleString('en-US')}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Total Reads Row */}
              <tr className="bg-teal-500/5 dark:bg-[#00c2cb]/10 font-bold border-t-2 border-slate-200 dark:border-white/10">
                <td className="py-3 px-3 text-slate-900 dark:text-white">
                  <div className="flex items-center gap-2 font-black">
                    <span className="material-symbols-outlined text-base text-teal-600 dark:text-[#00c2cb]">
                      functions
                    </span>
                    <span>إجمالي القراءات اليوم</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-[11px] text-slate-500 dark:text-[#859394] hidden sm:table-cell">
                  مجموع استهلاك كافة مصادر النظام لهذا الجهاز اليوم
                </td>
                <td className="py-3 px-3 text-left">
                  <span className="inline-block font-mono text-sm font-black text-teal-700 dark:text-[#00c2cb] bg-teal-500/20 dark:bg-[#00c2cb]/20 px-3 py-1 rounded-lg">
                    {totalReads.toLocaleString('en-US')}
                  </span>
                </td>
              </tr>

              {/* Writes Row (Separated) */}
              <tr className="bg-purple-500/5 dark:bg-purple-500/10 font-medium">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2 font-bold text-purple-800 dark:text-purple-300">
                    <span className="material-symbols-outlined text-base text-purple-500">
                      edit_note
                    </span>
                    <span>الكتابات (Writes)</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-[11px] text-purple-600 dark:text-purple-400 hidden sm:table-cell">
                  الكتابات ليست قراءات وتُحسب منفصلة في حصة Firebase
                </td>
                <td className="py-2.5 px-3 text-left">
                  <span className="inline-block font-mono text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-md min-w-[36px] text-center">
                    {stats.writes.toLocaleString('en-US')}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Advisory Note */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
        <span className="material-symbols-outlined text-base shrink-0 mt-0.5 text-amber-600 dark:text-amber-400">
          info
        </span>
        <span>
          هذه أرقام تقديرية لهذا الجهاز اليوم، وأرقام Firebase Usage هي المرجع الرسمي. الحد المجاني 50,000 قراءة يوميًا.
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
        <button
          type="button"
          onClick={handleToggleReadOpt}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs ${
            READ_OPT
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {READ_OPT ? 'power_settings_new' : 'bolt'}
          </span>
          <span>{READ_OPT ? 'إيقاف وضع التوفير' : 'تفعيل وضع التوفير'}</span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 text-slate-700 dark:text-[#dde2f5] font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 border border-slate-200 dark:border-white/10"
        >
          <span className="material-symbols-outlined text-base">restart_alt</span>
          <span>تصفير العداد</span>
        </button>
      </div>
    </div>
  );
}
