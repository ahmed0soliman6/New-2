import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  loadLifestylePresets,
  subscribeToLifestylePresets,
  addLifestylePreset,
} from '../../utils/lifestyleManager';

interface FollowupCardProps {
  followupDate: string;
  onChangeFollowupDate: (date: string) => void;
  lifestyleAdvice: string;
  onChangeLifestyleAdvice: (advice: string) => void;
  frequentSuggestions?: Array<{ text: string; count?: number }>;
}

export const FollowupCard: React.FC<FollowupCardProps> = ({
  followupDate,
  onChangeFollowupDate,
  lifestyleAdvice,
  onChangeLifestyleAdvice,
}) => {
  const { language } = useLanguage();
  const [advicePresets, setAdvicePresets] = useState<string[]>(loadLifestylePresets);
  const [customAdviceInput, setCustomAdviceInput] = useState('');
  // Open catalog by default for quick selection as requested
  const [showPicker, setShowPicker] = useState(true);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Keep in sync with lifestyleManager across Settings, Storage & Firestore
  useEffect(() => {
    const unsubscribe = subscribeToLifestylePresets((presets) => {
      setAdvicePresets(presets);
    });
    return () => unsubscribe();
  }, []);

  // Helper to format date string YYYY-MM-DD for N days from today
  const getDateForDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const date7 = getDateForDays(7);
  const date14 = getDateForDays(14);
  const date30 = getDateForDays(30);

  const isSelected7 = followupDate === date7;
  const isSelected14 = followupDate === date14;
  const isSelected30 = followupDate === date30;
  const isCustomDate = !!followupDate && !isSelected7 && !isSelected14 && !isSelected30;

  const setPresetDate = (days: number) => {
    onChangeFollowupDate(getDateForDays(days));
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleSelectFromDropdown = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    // Check if the advice already contains this item
    const lines = lifestyleAdvice ? lifestyleAdvice.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const itemWithBullet = `• ${val}`;
    const exists = lines.some((l) => l === itemWithBullet || l === val || l.includes(val));

    if (exists) {
      // Remove it
      const updatedLines = lines.filter((l) => l !== itemWithBullet && l !== val && !l.includes(val));
      onChangeLifestyleAdvice(updatedLines.join('\n'));
    } else {
      // Add it
      const updatedLines = [...lines, itemWithBullet];
      onChangeLifestyleAdvice(updatedLines.join('\n'));
    }
  };

  const handleAddCustomAdvice = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customAdviceInput.trim();
    if (!trimmed) return;

    // Save to global presets so it's remembered in Settings and subsequent examinations
    addLifestylePreset(trimmed);

    // Add to current visit's lifestyle advice
    const lines = lifestyleAdvice ? lifestyleAdvice.split('\n').map((l) => l.trim()).filter(Boolean) : [];
    const itemWithBullet = `• ${trimmed}`;
    if (!lines.some((l) => l === itemWithBullet || l === trimmed)) {
      const updatedLines = [...lines, itemWithBullet];
      onChangeLifestyleAdvice(updatedLines.join('\n'));
    }
    setCustomAdviceInput('');
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-5">
      {/* Header with "+ اختيار من دليلي" like the cards above */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-[#00c2cb] flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">fact_check</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                {language === 'en'
                  ? 'Lifestyle Advice & Follow-up Consultation'
                  : 'الإرشادات ونمط الحياة وموعد الاستشارة القادمة'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-[#00c2cb]">
                {advicePresets.length} {language === 'en' ? 'presets' : 'إرشاد'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#859394]">
              {language === 'en'
                ? 'Select lifestyle rules, then specify the next consultation date if needed'
                : 'اختيار الإرشادات الطبية والغذائية أولاً، ثم تحديد موعد الاستشارة القادمة بحسب قرار الطبيب'}
            </p>
          </div>
        </div>

        {/* Dropdown / Picker from catalog in header */}
        <div className="flex items-center gap-2 flex-wrap">
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 text-teal-700 dark:text-[#00c2cb] text-xs font-bold transition-all cursor-pointer border border-teal-200 dark:border-teal-800/40 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">lists</span>
              <span>{language === 'en' ? '+ Pick from Catalog' : '+ اختيار من دليلي'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <select
                value=""
                onChange={handleSelectFromDropdown}
                className="bg-white dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs font-bold py-1.5 px-3 rounded-xl border-2 border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer min-w-[210px] max-w-[320px] shadow-sm"
              >
                <option value="">
                  {language === 'en' ? '-- Select from Lifestyle Catalog --' : '-- اضغط لاختيار إرشاد من دليلي --'}
                </option>
                {advicePresets.map((preset, idx) => {
                  const isSelected = lifestyleAdvice.includes(preset);
                  return (
                    <option key={idx} value={preset}>
                      {isSelected ? '✓ ' : '+ '} {preset}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="w-7 h-7 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-white/10 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                title={language === 'en' ? 'Close' : 'إغلاق'}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. Dietary and lifestyle advice presets (TOP SECTION) */}
      <div className="space-y-3">
        {/* Lifestyle Advice Multiline Text Area */}
        <div className="space-y-1.5" data-no-translate="true">
          <label className="text-[11px] font-bold text-slate-600 dark:text-[#859394] block">
            {language === 'en'
              ? 'Patient Instructions & Diet Advice (printed on prescription):'
              : 'نص الإرشادات والتعليمات الطبية للمريض (تطبع في الروشتة):'}
          </label>
          <textarea
            rows={3}
            data-no-translate="true"
            value={lifestyleAdvice}
            onChange={(e) => onChangeLifestyleAdvice(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Enter medical advice or choose from catalog above (e.g. • Avoid greasy foods...)'
                : 'اكتب التعليمات الطبية أو اختر من دليلي أعلاه (مثال: • الامتناع عن الأطعمة الدسمة...)'
            }
            className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-3 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-teal-500 leading-relaxed font-sans no-translate clinical-data"
          />
        </div>

        {/* Form to add custom lifestyle advice & save it */}
        <form onSubmit={handleAddCustomAdvice} className="flex items-center gap-1.5">
          <input
            type="text"
            value={customAdviceInput}
            onChange={(e) => setCustomAdviceInput(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Add new advice & save to catalog...'
                : 'إضافة إرشاد جديد وحفظه في دليلي...'
            }
            className="flex-1 bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer transition-all shrink-0 shadow-xs flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>{language === 'en' ? 'Add & Save' : 'إضافة وحفظ'}</span>
          </button>
        </form>
      </div>

      {/* 2. NEXT CONSULTATION DATE (BOTTOM SECTION - strictly manual per doctor's choice) */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-3">
        <div className="p-3.5 rounded-2xl bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-base">event_upcoming</span>
              <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">
                {language === 'en' ? 'Next Consultation Date (Doctor-Determined):' : 'موعد الاستشارة القادمة (يحدده الطبيب):'}
              </label>
            </div>
            {followupDate && (
              <button
                type="button"
                onClick={() => onChangeFollowupDate('')}
                className="text-[11px] text-rose-500 hover:text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 cursor-pointer bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/40 transition-colors"
              >
                <span className="material-symbols-outlined text-xs">close</span>
                <span>{language === 'en' ? 'No follow-up (clear)' : 'بدون استشارة / إلغاء الموعد'}</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-[#859394]">
            {language === 'en'
              ? 'No automatic follow-up is forced. The doctor specifies the date manually or picks from the row below.'
              : 'لا يتم تحديد موعد تلقائي؛ الطبيب يحدد الموعد بنفسه عند الحاجة من الخيارات في الصف أدناه.'}
          </p>

          {/* Unified single row for Date Picker and Quick Days */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center">
            {/* 1. Date Picker (اختيار التاريخ) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  try {
                    dateInputRef.current?.showPicker?.();
                  } catch {
                    dateInputRef.current?.focus();
                  }
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border truncate ${
                  followupDate && isCustomDate
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-400/40'
                    : followupDate
                    ? 'bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700'
                    : 'bg-white dark:bg-[#080e1b] hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#dde2f5]'
                }`}
              >
                <span className="material-symbols-outlined text-base text-indigo-500 dark:text-indigo-400 shrink-0">calendar_month</span>
                <span className="truncate">
                  {followupDate
                    ? formatDisplayDate(followupDate)
                    : (language === 'en' ? 'Select Date' : 'اختيار التاريخ')}
                </span>
              </button>
              <input
                ref={dateInputRef}
                type="date"
                value={followupDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => onChangeFollowupDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.currentTarget as any).showPicker?.();
                  } catch {}
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                title={language === 'en' ? 'Click to choose follow-up date from calendar' : 'انقر لاختيار موعد الاستشارة من التقويم'}
              />
            </div>

            {/* 2. In 1 week (7 days) */}
            <button
              type="button"
              onClick={() => setPresetDate(7)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border truncate ${
                isSelected7
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/50'
                  : 'bg-white dark:bg-[#080e1b] hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#dde2f5]'
              }`}
            >
              {isSelected7 && <span className="material-symbols-outlined text-xs">check</span>}
              <span className="truncate">{language === 'en' ? 'In 1 Week (7d)' : 'بعد أسبوع (7 أيام)'}</span>
            </button>

            {/* 3. In 2 weeks (14 days) */}
            <button
              type="button"
              onClick={() => setPresetDate(14)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border truncate ${
                isSelected14
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/50'
                  : 'bg-white dark:bg-[#080e1b] hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#dde2f5]'
              }`}
            >
              {isSelected14 && <span className="material-symbols-outlined text-xs">check</span>}
              <span className="truncate">{language === 'en' ? 'In 2 Weeks (14d)' : 'بعد أسبوعين (14 يوماً)'}</span>
            </button>

            {/* 4. In 1 month (30 days) */}
            <button
              type="button"
              onClick={() => setPresetDate(30)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border truncate ${
                isSelected30
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400/50'
                  : 'bg-white dark:bg-[#080e1b] hover:bg-slate-50 dark:hover:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-[#dde2f5]'
              }`}
            >
              {isSelected30 && <span className="material-symbols-outlined text-xs">check</span>}
              <span className="truncate">{language === 'en' ? 'In 1 Month (30d)' : 'بعد شهر (30 يوماً)'}</span>
            </button>
          </div>

          {/* Status summary */}
          {followupDate ? (
            <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 text-xs font-bold bg-indigo-100/50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40">
              <span className="material-symbols-outlined text-sm text-indigo-600 dark:text-indigo-400">event_available</span>
              <span>
                {language === 'en' ? 'Scheduled consultation date: ' : 'الموعد المحدد للاستشارة: '}
                {formatDisplayDate(followupDate)}
              </span>
            </div>
          ) : (
            <p className="text-slate-400 dark:text-[#859394] text-[11px]">
              {language === 'en'
                ? 'No follow-up consultation scheduled yet (optional per doctor decision).'
                : 'لم يتم تحديد موعد استشارة بعد (متروك لاختيار الطبيب بالضغط على أحد الخيارات أعلاه).'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
