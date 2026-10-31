import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export interface VitalsData {
  bp: string;
  pulse: string;
  temp: string;
  rbs: string;
  weight: string;
  height: string;
  spo2: string;
}

interface VitalsCardProps {
  initialVitals?: Partial<VitalsData>;
  onSave?: (vitals: VitalsData) => void;
  onChange?: (vitals: VitalsData) => void;
}

export const VitalsCard: React.FC<VitalsCardProps> = ({ initialVitals, onSave, onChange }) => {
  const { language, isRTL } = useLanguage();

  // Parse blood pressure string into systolic & diastolic
  const parseBp = (rawBp?: string) => {
    if (!rawBp) return { sys: '', dia: '' };
    const parts = rawBp.split('/');
    return {
      sys: (parts[0] || '').trim(),
      dia: (parts[1] || '').trim(),
    };
  };

  const initialParsedBp = parseBp(initialVitals?.bp);
  const [systolic, setSystolic] = useState<string>(initialParsedBp.sys);
  const [diastolic, setDiastolic] = useState<string>(initialParsedBp.dia);
  const [isBpFocused, setIsBpFocused] = useState<boolean>(false);

  const systolicInputRef = useRef<HTMLInputElement>(null);
  const diastolicInputRef = useRef<HTMLInputElement>(null);

  const [vitals, setVitals] = useState<VitalsData>({
    bp: initialVitals?.bp || '',
    pulse: initialVitals?.pulse || '',
    temp: initialVitals?.temp || '',
    rbs: initialVitals?.rbs || '',
    weight: initialVitals?.weight || '',
    height: initialVitals?.height || '',
    spo2: initialVitals?.spo2 || '',
  });

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return; // لا ترسل شيئًا عند التحميل الأول
    }
    onChangeRef.current?.(vitals);
  }, [vitals]);

  const [savedFeedback, setSavedFeedback] = useState(false);

  // Sync blood pressure to vitals whenever systolic or diastolic changes
  useEffect(() => {
    let combined = '';
    if (systolic && diastolic) {
      combined = `${systolic}/${diastolic}`;
    } else if (systolic) {
      combined = systolic;
    } else if (diastolic) {
      combined = `/${diastolic}`;
    }
    setVitals((prev) => ({ ...prev, bp: combined }));
  }, [systolic, diastolic]);

  // Sync when initialVitals prop changes
  useEffect(() => {
    if (initialVitals) {
      const parsed = parseBp(initialVitals.bp);
      if (initialVitals.bp !== undefined) {
        setSystolic(parsed.sys);
        setDiastolic(parsed.dia);
      }
      setVitals((prev) => ({
        ...prev,
        bp: initialVitals.bp ?? prev.bp,
        pulse: initialVitals.pulse ?? prev.pulse,
        temp: initialVitals.temp ?? prev.temp,
        rbs: initialVitals.rbs ?? prev.rbs,
        weight: initialVitals.weight ?? prev.weight,
        height: initialVitals.height ?? prev.height,
        spo2: initialVitals.spo2 ?? prev.spo2,
      }));
    }
  }, [initialVitals]);

  // Real-time BMI calculation (formula: weight / (height/100)^2)
  const weightNum = parseFloat(vitals.weight) || 0;
  const heightM = (parseFloat(vitals.height) || 0) / 100;
  const bmi = heightM > 0 && weightNum > 0 ? (weightNum / (heightM * heightM)).toFixed(1) : null;

  const handleUpdate = (field: keyof VitalsData, val: string) => {
    setVitals((prev) => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    if (onSave) onSave(vitals);
    try {
      localStorage.setItem('soli_last_recorded_vitals', JSON.stringify(vitals));
    } catch (e) {
      // ignore
    }
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleApplyDefaults = () => {
    setSystolic('120');
    setDiastolic('80');
    setVitals({
      bp: '120/80',
      pulse: '76',
      temp: '37.0',
      rbs: '105',
      spo2: '98',
      weight: vitals.weight || '72',
      height: vitals.height || '172',
    });
  };

  const handleClearAll = () => {
    setSystolic('');
    setDiastolic('');
    setVitals({
      bp: '',
      pulse: '',
      temp: '',
      rbs: '',
      weight: '',
      height: '',
      spo2: '',
    });
  };

  // Systolic input change handler with auto-advance and slash parsing
  const handleSystolicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes('/')) {
      const [s, d] = val.split('/');
      const cleanSys = s.replace(/\D/g, '').slice(0, 3);
      const cleanDia = (d || '').replace(/\D/g, '').slice(0, 3);
      setSystolic(cleanSys);
      if (cleanDia) setDiastolic(cleanDia);
      diastolicInputRef.current?.focus();
      return;
    }
    const clean = val.replace(/\D/g, '').slice(0, 3);
    setSystolic(clean);
    if (clean.length === 3) {
      diastolicInputRef.current?.focus();
      diastolicInputRef.current?.select();
    }
  };

  const handleSystolicKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '/' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      diastolicInputRef.current?.focus();
    }
  };

  const handleDiastolicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 3);
    setDiastolic(clean);
  };

  const handleDiastolicKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !diastolic) {
      systolicInputRef.current?.focus();
    }
  };

  const handleBpBlur = () => {
    setTimeout(() => {
      if (document.activeElement !== systolicInputRef.current && document.activeElement !== diastolicInputRef.current) {
        setIsBpFocused(false);
      }
    }, 60);
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2.5 transition-all">
      {/* Sleek Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-base">monitoring</span>
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
              {language === 'en' ? 'Vital Signs & Measurements' : 'العلامات الحيوية والقياسات البدنية'}
            </h3>
            <span className="hidden sm:inline-block text-[10px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
              8 Parameters
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleApplyDefaults}
            title={language === 'en' ? 'Insert default vitals' : 'تعبئة قيم افتراضية'}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-xs text-teal-500">flash_on</span>
            <span>{language === 'en' ? 'Defaults' : 'قيم افتراضية'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            title={language === 'en' ? 'Clear measurements' : 'مسح القياسات'}
            className="p-1 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-600 transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>

          {savedFeedback && (
            <span className="text-[10px] font-bold text-emerald-600 dark:text-[#10B981] flex items-center gap-0.5 animate-pulse px-1">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>{language === 'en' ? 'Saved' : 'تم الحفظ'}</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-xs">save</span>
            <span>{language === 'en' ? 'Save' : 'حفظ'}</span>
          </button>
        </div>
      </div>

      {/* ALL 8 BOXES IN ONE SINGLE ROW WITH ENGLISH ABBREVIATIONS AT THE TOP - NO UNWANTED EVALUATIONS */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="grid grid-cols-8 gap-2 min-w-[760px] md:min-w-0">
          
          {/* 1. BP (Blood Pressure - ضغط الدم) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            {/* Top English Abbreviation Header */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-rose-600 dark:text-rose-400">BP</span>
              <span className="text-[9px] text-slate-400 font-mono">mmHg</span>
            </div>

            {/* Blood Pressure Input */}
            <div
              onClick={() => {
                if (!systolic) systolicInputRef.current?.focus();
                else diastolicInputRef.current?.focus();
              }}
              className={`relative w-full h-8 bg-white dark:bg-[#0f172a] border rounded-lg px-1 flex items-center justify-center transition-all cursor-text ${
                isBpFocused
                  ? 'border-teal-500 dark:border-[#00c2cb] ring-1 ring-teal-500/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              <input
                ref={systolicInputRef}
                type="text"
                inputMode="numeric"
                placeholder={isBpFocused || systolic || diastolic ? "120" : ""}
                value={systolic}
                onFocus={() => setIsBpFocused(true)}
                onBlur={handleBpBlur}
                onChange={handleSystolicChange}
                onKeyDown={handleSystolicKeyDown}
                className="w-7 sm:w-8 text-center bg-transparent text-slate-900 dark:text-[#45dee7] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
              <span className="text-teal-600 dark:text-[#00c2cb] font-bold text-xs select-none px-0.5">/</span>
              <input
                ref={diastolicInputRef}
                type="text"
                inputMode="numeric"
                placeholder={isBpFocused || systolic || diastolic ? "80" : ""}
                value={diastolic}
                onFocus={() => setIsBpFocused(true)}
                onBlur={handleBpBlur}
                onChange={handleDiastolicChange}
                onKeyDown={handleDiastolicKeyDown}
                className="w-7 sm:w-8 text-center bg-transparent text-slate-900 dark:text-[#45dee7] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />

              {/* mmHg appears inside when empty and unfocused */}
              {!systolic && !diastolic && !isBpFocused && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 dark:text-slate-500 text-[10px] font-mono font-semibold">
                  <span>mmHg</span>
                </div>
              )}
            </div>

            {/* Bottom Subtitle: Clean label only, no automatic evaluations */}
            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'ضغط الدم' : 'Blood Press'}
            </div>
          </div>

          {/* 2. HR (Heart Rate / Pulse - النبض) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-rose-500 dark:text-rose-400">HR</span>
              <span className="text-[9px] text-slate-400 font-mono">bpm</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 focus-within:border-teal-500 dark:focus-within:border-[#00c2cb] focus-within:ring-1 focus-within:ring-teal-500/30 rounded-lg px-1 flex items-center transition-all">
              <input
                type="text"
                inputMode="numeric"
                placeholder="75"
                value={vitals.pulse}
                onChange={(e) => handleUpdate('pulse', e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full text-center bg-transparent text-slate-900 dark:text-[#45dee7] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'النبض' : 'Pulse'}
            </div>
          </div>

          {/* 3. Temp (Temperature - الحرارة) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-amber-500 dark:text-amber-400">Temp</span>
              <span className="text-[9px] text-slate-400 font-mono">°C</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 focus-within:border-teal-500 dark:focus-within:border-[#00c2cb] focus-within:ring-1 focus-within:ring-teal-500/30 rounded-lg px-1 flex items-center transition-all">
              <input
                type="text"
                inputMode="decimal"
                placeholder="37.0"
                value={vitals.temp}
                onChange={(e) => handleUpdate('temp', e.target.value)}
                className="w-full text-center bg-transparent text-slate-900 dark:text-[#45dee7] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'الحرارة' : 'Temp'}
            </div>
          </div>

          {/* 4. RBS (Random Blood Sugar - سكر الدم) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-purple-600 dark:text-purple-400">RBS</span>
              <span className="text-[9px] text-slate-400 font-mono">mg/dL</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 focus-within:border-teal-500 dark:focus-within:border-[#00c2cb] focus-within:ring-1 focus-within:ring-teal-500/30 rounded-lg px-1 flex items-center transition-all">
              <input
                type="text"
                inputMode="numeric"
                placeholder="110"
                value={vitals.rbs}
                onChange={(e) => handleUpdate('rbs', e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full text-center bg-transparent text-purple-700 dark:text-[#d0bcff] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'سكر الدم' : 'Sugar'}
            </div>
          </div>

          {/* 5. SpO2 (Oxygen Saturation - نسبة الأكسجين) - EDITABLE */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-cyan-600 dark:text-cyan-400">SpO2</span>
              <span className="text-[9px] text-slate-400 font-mono">%</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 focus-within:border-teal-500 dark:focus-within:border-[#00c2cb] focus-within:ring-1 focus-within:ring-teal-500/30 rounded-lg px-1 flex items-center transition-all">
              <input
                type="text"
                inputMode="numeric"
                placeholder="98"
                value={vitals.spo2}
                onChange={(e) => handleUpdate('spo2', e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full text-center bg-transparent text-emerald-600 dark:text-[#10B981] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'الأكسجين' : 'O2 Sat'}
            </div>
          </div>

          {/* 6. Wt (Weight - الوزن) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-blue-600 dark:text-blue-400">Wt</span>
              <span className="text-[9px] text-slate-400 font-mono">kg</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 focus-within:border-teal-500 dark:focus-within:border-[#00c2cb] focus-within:ring-1 focus-within:ring-teal-500/30 rounded-lg px-1 flex items-center transition-all">
              <input
                type="text"
                inputMode="decimal"
                placeholder="75"
                value={vitals.weight}
                onChange={(e) => handleUpdate('weight', e.target.value)}
                className="w-full text-center bg-transparent text-blue-600 dark:text-[#38BDF8] font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'الوزن' : 'Weight'}
            </div>
          </div>

          {/* 7. Ht (Height - الطول) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-indigo-600 dark:text-indigo-400">Ht</span>
              <span className="text-[9px] text-slate-400 font-mono">cm</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 focus-within:border-teal-500 dark:focus-within:border-[#00c2cb] focus-within:ring-1 focus-within:ring-teal-500/30 rounded-lg px-1 flex items-center transition-all">
              <input
                type="text"
                inputMode="numeric"
                placeholder="175"
                value={vitals.height}
                onChange={(e) => handleUpdate('height', e.target.value.replace(/\D/g, '').slice(0, 3))}
                className="w-full text-center bg-transparent text-indigo-600 dark:text-indigo-400 font-mono font-bold text-xs focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'الطول' : 'Height'}
            </div>
          </div>

          {/* 8. BMI (Body Mass Index - كتلة الجسم - محسوب تلقائياً دون تقييم إلزامي) */}
          <div className="bg-slate-50/70 dark:bg-[#0a1122] p-2 rounded-xl border border-slate-200/90 dark:border-slate-800 hover:border-teal-400/50 dark:hover:border-teal-500/40 transition-all flex flex-col justify-between gap-1 shadow-xs">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-black font-mono tracking-wider text-emerald-600 dark:text-emerald-400">BMI</span>
              <span className="text-[9px] text-slate-400 font-mono">kg/m²</span>
            </div>

            <div className="w-full h-8 bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 rounded-lg px-1 flex items-center justify-center">
              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                {bmi || '--'}
              </span>
            </div>

            <div className="text-center text-[10px] text-slate-500 dark:text-slate-400 font-medium px-0.5 truncate">
              {isRTL ? 'كتلة الجسم' : 'BMI'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
