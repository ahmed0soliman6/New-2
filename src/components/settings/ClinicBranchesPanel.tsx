import React, { useState, useEffect } from 'react';
import {
  ClinicBranchItem,
  getClinicBranches,
  saveClinicBranches,
  buildAppointmentReminderMessage,
  generateAllDayTimeOptions,
} from '../../utils/clinicBranches';
import { db } from '../../services/firebase';
import { saveSettingsDocument } from '../../services/repositories';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatAppDate } from '../../utils/numberUtils';

export function formatBranchTime(timeStr?: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('ص') || timeStr.includes('م')) return timeStr;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] !== undefined ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  const minFormatted = !isNaN(m) && m > 0 ? `:${m < 10 ? '0' + m : m}` : ':00';
  return `${hour12 < 10 ? '0' + hour12 : hour12}${minFormatted} ${period}`;
}

export const ClinicBranchesPanel: React.FC = () => {
  const { language, isRTL, t } = useLanguage();
  const [branches, setBranches] = useState<ClinicBranchItem[]>(() => getClinicBranches());
  const [editingBranch, setEditingBranch] = useState<ClinicBranchItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchDays, setBranchDays] = useState('الأحد، الثلاثاء، الخميس');
  const [customBranchDays, setCustomBranchDays] = useState('');
  const [branchWorkingHours, setBranchWorkingHours] = useState('');
  const [branchStartTime, setBranchStartTime] = useState('16:00');
  const [branchEndTime, setBranchEndTime] = useState('22:00');

  // Selected branch for preview
  const [previewBranchId, setPreviewBranchId] = useState<string>(() => branches[0]?.id || '');

  const DAY_PRESETS = [
    'الأحد، الثلاثاء، الخميس',
    'السبت، الإثنين، الأربعاء',
    'يومياً ما عدا الجمعة',
    'من السبت إلى الخميس',
    'طوال أيام الأسبوع (يومياً)',
    'أيام مخصصة',
  ];

  const START_TIME_OPTIONS = generateAllDayTimeOptions();
  const END_TIME_OPTIONS = generateAllDayTimeOptions();

  // Keep state updated if storage or other screens update branches
  useEffect(() => {
    const handleUpdate = () => {
      const updated = getClinicBranches();
      setBranches(updated);
      if (!updated.some((b) => b.id === previewBranchId)) {
        setPreviewBranchId(updated[0]?.id || '');
      }
    };
    window.addEventListener('soli_branches_updated', handleUpdate);
    window.addEventListener('soli_prescription_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('soli_branches_updated', handleUpdate);
      window.removeEventListener('soli_prescription_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [previewBranchId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAddModal = () => {
    setEditingBranch(null);
    setBranchName('');
    setBranchAddress('');
    setBranchPhone('');
    setBranchDays('الأحد، الثلاثاء، الخميس');
    setCustomBranchDays('');
    setBranchStartTime('16:00');
    setBranchEndTime('22:00');
    setBranchWorkingHours('الأحد، الثلاثاء، الخميس 04:00 م - 10:00 م');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (branch: ClinicBranchItem) => {
    setEditingBranch(branch);
    setBranchName(branch.name);
    setBranchAddress(branch.address);
    setBranchPhone(branch.phone || branch.mobile || '');
    
    // Determine preset vs custom days
    const hoursText = branch.workingHours || '';
    const matchingPreset = DAY_PRESETS.find((p) => p !== 'أيام مخصصة' && hoursText.includes(p));
    if (matchingPreset) {
      setBranchDays(matchingPreset);
      setCustomBranchDays('');
    } else if (hoursText) {
      setBranchDays('أيام مخصصة');
      setCustomBranchDays(hoursText);
    } else {
      setBranchDays('الأحد، الثلاثاء، الخميس');
      setCustomBranchDays('');
    }

    setBranchStartTime(branch.startTime || '16:00');
    setBranchEndTime(branch.endTime || '22:00');
    setBranchWorkingHours(branch.workingHours || '');
    setIsModalOpen(true);
  };

  const computeFinalWorkingHours = (days: string, customDays: string, start: string, end: string) => {
    const daysLabel = days === 'أيام مخصصة' ? customDays.trim() : days;
    const startTimeFormatted = formatBranchTime(start);
    const endTimeFormatted = formatBranchTime(end);
    if (!daysLabel) return `${startTimeFormatted} - ${endTimeFormatted}`;
    return `${daysLabel} ${startTimeFormatted} - ${endTimeFormatted}`;
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      alert('يرجى إدخال اسم الفرع');
      return;
    }

    let updatedList: ClinicBranchItem[];
    if (editingBranch) {
      updatedList = branches.map((b) =>
        b.id === editingBranch.id
          ? {
              ...b,
              name: branchName.trim(),
              address: branchAddress.trim(),
              phone: branchPhone.trim(),
              mobile: branchPhone.trim(),
              workingHours: branchWorkingHours.trim(),
              startTime: branchStartTime.trim() || '16:00',
              endTime: branchEndTime.trim() || '22:00',
            }
          : b
      );
      showToast(`تم تحديث بيانات "${branchName.trim()}" بنجاح ✓`);
    } else {
      const newBranch: ClinicBranchItem = {
        id: `branch-${Date.now()}`,
        name: branchName.trim(),
        address: branchAddress.trim(),
        phone: branchPhone.trim(),
        mobile: branchPhone.trim(),
        workingHours: branchWorkingHours.trim(),
        startTime: branchStartTime.trim() || '16:00',
        endTime: branchEndTime.trim() || '22:00',
      };
      updatedList = [...branches, newBranch];
      showToast(`تمت إضافة فرع "${branchName.trim()}" بنجاح ✓`);
    }

    setBranches(updatedList);
    saveClinicBranches(updatedList);
    if (db) {
      saveSettingsDocument(db, 'clinicBranches', {
        branches: updatedList,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.warn('Firestore branch sync error:', err));
    }

    setIsModalOpen(false);
  };

  const handleDeleteBranch = (id: string, name: string) => {
    if (branches.length <= 1) {
      alert('يجب الإبقاء على فرع عيادة واحد على الأقل بالنظام.');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف فرع "${name}"؟`)) {
      return;
    }

    const updated = branches.filter((b) => b.id !== id);
    setBranches(updated);
    saveClinicBranches(updated);
    if (db) {
      saveSettingsDocument(db, 'clinicBranches', {
        branches: updated,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.warn('Firestore branch sync error:', err));
    }
    showToast(`تم حذف فرع "${name}" بنجاح.`);
  };

  const handleSetPrimaryBranch = (index: number) => {
    if (index === 0) return;
    const item = branches[index];
    const updated = [item, ...branches.filter((_, i) => i !== index)];
    setBranches(updated);
    saveClinicBranches(updated);
    if (db) {
      saveSettingsDocument(db, 'clinicBranches', {
        branches: updated,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.warn('Firestore branch sync error:', err));
    }
    showToast(`تم تعيين فرع "${item.name}" كفرع رئيسي وافتراضي للعيادة ✓`);
  };

  const activePreviewBranch = branches.find((b) => b.id === previewBranchId) || branches[0];
  const sampleMessage = activePreviewBranch
    ? buildAppointmentReminderMessage({
        patientName: 'دينا رمضان السيد',
        timeSlot: '11:45 ص',
        visitType: 'كشف عيادة',
        branch: activePreviewBranch,
        date: formatAppDate(new Date(), undefined, language),
      })
    : '';

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb]">apartment</span>
            <span>فروع العيادة والعناوين وأرقام التواصل المعتمدة</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
            تحكّم في فروع العيادة، العناوين الحقيقية، أرقام هواتف الحجز والاستفسار التي تظهر في الروشتات ورسائل تذكير واتساب
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#00aab2] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-base">add_business</span>
          <span>إضافة فرع جديد</span>
        </button>
      </div>

      {/* Branches Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((b, idx) => {
          const isPrimary = idx === 0;
          return (
            <div
              key={b.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 relative ${
                isPrimary
                  ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-300 dark:border-teal-700/60 shadow-xs'
                  : 'bg-slate-50/70 dark:bg-[#0c1427] border-slate-200 dark:border-white/10 hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-teal-500/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{b.name}</span>
                        {isPrimary && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00c2cb] text-slate-950">
                            الفرع الرئيسي الافتراضي
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(b)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-colors"
                      title="تعديل بيانات الفرع"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBranch(b.id, b.name)}
                        className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors"
                        title="حذف هذا الفرع"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-[#859394] pt-1">
                  <div className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400 shrink-0 mt-0.5">location_on</span>
                    <span className="text-slate-800 dark:text-slate-200">{b.address || 'لم يتم تحديد العنوان بعد'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">call</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-bold" dir="ltr">
                      {b.phone || b.mobile || 'بدون رقم هاتف'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb] shrink-0">schedule</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      ساعات المواعيد: <span className="font-bold text-teal-700 dark:text-[#45dee7]">من {formatBranchTime(b.startTime || '16:00')} حتى {formatBranchTime(b.endTime || '22:00')}</span>
                    </span>
                  </div>
                  {b.workingHours && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-[#859394]">
                      <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">calendar_today</span>
                      <span>أيام العمل: {b.workingHours}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
                {!isPrimary ? (
                  <button
                    type="button"
                    onClick={() => handleSetPrimaryBranch(idx)}
                    className="text-[11px] font-bold text-teal-700 dark:text-[#45dee7] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">star</span>
                    <span>تعيين كفرع رئيسي افتراضي</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">يستخدم تلقائياً عند عدم اختيار فرع</span>
                )}

                <button
                  type="button"
                  onClick={() => setPreviewBranchId(b.id)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                    previewBranchId === b.id
                      ? 'bg-[#00c2cb] text-slate-950'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                  }`}
                >
                  معاينة رسالة الواتساب
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Box of WhatsApp Reminder with the Selected Branch */}
      {sampleMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-[#071d18] border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-[#25D366]">chat</span>
              <span>معاينة حقيقية لرسالة تذكير الواتساب باستخدام فرع: ({activePreviewBranch.name})</span>
            </h4>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
              رقم التواصل: {activePreviewBranch.phone || activePreviewBranch.mobile}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-[#080e1b] border border-emerald-100 dark:border-white/5 text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line font-sans leading-relaxed shadow-2xs">
            {sampleMessage}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            تأكيد: هذه الرسالة تستخدم البيانات الحقيقية لفرع العيادة ورقم الهاتف المحدد أعلاه دون أي بيانات وهمية.
          </p>
        </div>
      )}

      {/* Modal Add / Edit Branch */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb]">apartment</span>
                <span>{editingBranch ? 'تعديل بيانات فرع العيادة' : 'إضافة فرع عيادة جديد'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  اسم الفرع *
                </label>
                <input
                  type="text"
                  required
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="مثال: فرع المهندسين الرئيسي أو فرع الدقي"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  العنوان بالتفصيل *
                </label>
                <input
                  type="text"
                  required
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="مثال: 24 شارع سوريا، الدور الثالث، شقة 7"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  رقم الهاتف للتأكيد والواتساب (اختياري)
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="مثال: 01092847162 أو 02-37618920"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                />
              </div>

              {/* Days Selection */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  أيام العمل بالفرع *
                </label>
                <select
                  value={branchDays}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBranchDays(val);
                    const finalHours = computeFinalWorkingHours(val, customBranchDays, branchStartTime, branchEndTime);
                    setBranchWorkingHours(finalHours);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                >
                  {DAY_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {branchDays === 'أيام مخصصة' && (
                  <input
                    type="text"
                    value={customBranchDays}
                    onChange={(e) => {
                      setCustomBranchDays(e.target.value);
                      const finalHours = computeFinalWorkingHours('أيام مخصصة', e.target.value, branchStartTime, branchEndTime);
                      setBranchWorkingHours(finalHours);
                    }}
                    placeholder="اكتب أيام العمل بالتفصيل (مثال: السبت والأحد فقط)"
                    className="w-full mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                  />
                )}
              </div>

              {/* Time Slots (Start Time & End Time Dropdowns) */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-teal-50/50 dark:bg-[#00c2cb]/5 border border-teal-200/60 dark:border-[#00c2cb]/20">
                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1 text-[11px]">
                    من الساعة (بداية العمل) *
                  </label>
                  <select
                    value={branchStartTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBranchStartTime(val);
                      const finalHours = computeFinalWorkingHours(branchDays, customBranchDays, val, branchEndTime);
                      setBranchWorkingHours(finalHours);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                  >
                    {START_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 dark:text-slate-200 block mb-1 text-[11px]">
                    إلى الساعة (انتهاء العمل) *
                  </label>
                  <select
                    value={branchEndTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBranchEndTime(val);
                      const finalHours = computeFinalWorkingHours(branchDays, customBranchDays, branchStartTime, val);
                      setBranchWorkingHours(finalHours);
                    }}
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                  >
                    {END_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Preview of Working Hours Label */}
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#00c2cb]">info</span>
                <span className="text-[11px] text-slate-700 dark:text-slate-300">
                  النص المعروض في الحجز والرسائل:{' '}
                  <strong className="text-teal-700 dark:text-[#45dee7]">
                    {computeFinalWorkingHours(branchDays, customBranchDays, branchStartTime, branchEndTime)}
                  </strong>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#00aab2] text-slate-950 font-bold shadow-xs cursor-pointer"
                >
                  {editingBranch ? 'حفظ التعديلات' : 'إضافة الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
