import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Visit, Prescription, LabOrder, RadiologyOrder } from '../../types/database';
import { PatientDiagnosis } from './DiagnosisCard';
import { getSmartClinicalSuggestions } from '../../utils/clinicalRecommender';

interface SmartClinicalPanelProps {
  visits?: Visit[];
  prescriptions?: Prescription[];
  allLabOrders?: LabOrder[];
  allRadiologyOrders?: RadiologyOrder[];
  currentDiagnoses?: PatientDiagnosis[];
  onAddDrug?: (drug: {
    drugName: string;
    strength?: string;
    dosageForm?: string;
    scientificName?: string;
    instructions?: string;
  }) => void;
  onAddDiagnosis?: (diagName: string) => void;
  onAddLab?: (labName: string) => void;
  onAddRadiology?: (radType: string) => void;
  onAddInstruction?: (text: string) => void;
}

export const SmartClinicalPanel: React.FC<SmartClinicalPanelProps> = ({
  visits = [],
  prescriptions = [],
  allLabOrders = [],
  allRadiologyOrders = [],
  currentDiagnoses = [],
  onAddDrug,
  onAddDiagnosis,
  onAddLab,
  onAddRadiology,
  onAddInstruction,
}) => {
  const { language } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<'drugs' | 'diagnoses' | 'labs' | 'radiology' | 'instructions'>('drugs');
  const [addedItemNotice, setAddedItemNotice] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    return getSmartClinicalSuggestions(
      visits,
      prescriptions,
      allLabOrders,
      allRadiologyOrders,
      currentDiagnoses
    );
  }, [visits, prescriptions, allLabOrders, allRadiologyOrders, currentDiagnoses]);

  const notifyAdded = (msg: string) => {
    setAddedItemNotice(msg);
    setTimeout(() => setAddedItemNotice(null), 2500);
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900/10 via-slate-900/5 to-teal-900/10 dark:from-indigo-950/40 dark:to-teal-950/20 border border-indigo-200 dark:border-indigo-800/40 p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-xl">psychology</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#dde2f5]">
                {language === 'en'
                  ? 'Clinical Memory & Smart Suggestions'
                  : 'حافظة الذاكرة والاقتراحات التلقائية (Clinical Memory & Suggestions)'}
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {language === 'en' ? 'Learns from your history' : 'تتذكر كشوفاتك وتكراراتك'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#859394]">
              {language === 'en'
                ? 'Suggests most frequently prescribed medications, tests, radiology, diagnoses, and advice based on your clinical history for faster entry.'
                : 'يقترح النظام الأدوية، التحاليل، الأشعة، التشخيصات والإرشادات الأكثر استخداماً بناءً على تاريخ كشوفاتك لسرعة التعبئة.'}
            </p>
          </div>
        </div>

        {addedItemNotice && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
            ✓ {addedItemNotice}
          </span>
        )}
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveCategory('drugs')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
            activeCategory === 'drugs'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-[#080e1b] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/10 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">medication</span>
          <span>
            {language === 'en' ? 'Medications' : 'الأدوية والعلاجات'} ({suggestions.frequentDrugs.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('diagnoses')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
            activeCategory === 'diagnoses'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-[#080e1b] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/10 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">stethoscope</span>
          <span>
            {language === 'en' ? 'Diagnoses' : 'التشخيصات'} ({suggestions.frequentDiagnoses.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('labs')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
            activeCategory === 'labs'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-[#080e1b] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/10 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">science</span>
          <span>
            {language === 'en' ? 'Lab Tests' : 'التحاليل'} ({suggestions.frequentLabs.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('radiology')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
            activeCategory === 'radiology'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-[#080e1b] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/10 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">radiology</span>
          <span>
            {language === 'en' ? 'Radiology' : 'الأشعة والفحوصات'} ({suggestions.frequentRadiology.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('instructions')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border ${
            activeCategory === 'instructions'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-[#080e1b] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/10 hover:bg-slate-50'
          }`}
        >
          <span className="material-symbols-outlined text-sm">description</span>
          <span>
            {language === 'en' ? 'Advice & Instructions' : 'النصائح والإرشادات'} ({suggestions.frequentInstructions.length})
          </span>
        </button>
      </div>

      {/* Panel Body Content */}
      <div className="pt-1">
        {activeCategory === 'drugs' && (
          <div>
            {suggestions.frequentDrugs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#859394] italic py-2">
                {language === 'en'
                  ? 'The system will automatically remember prescribed medications and group them here for quick 1-click selection.'
                  : 'سيقوم النظام تلقائياً بتذكر الأدوية والعلاجات المكتوبة في الكشوفات وتجميعها هنا لسهولة اختيارها بنقرة واحدة.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-no-translate="true">
                {suggestions.frequentDrugs.map((d, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-no-translate="true"
                    onClick={() => {
                      if (onAddDrug) {
                        onAddDrug({
                          drugName: d.drugName,
                          strength: d.strength,
                          dosageForm: d.dosageForm,
                          scientificName: d.scientificName,
                          instructions: d.instructions || (language === 'en' ? 'As directed by physician' : 'جرعة حسـب إرشادات الطبيب'),
                        });
                        notifyAdded(
                          language === 'en'
                            ? `Added drug "${d.drugName}" to prescription`
                            : `تم إضافة الدواء "${d.drugName}" إلى الروشتة`
                        );
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#080e1b] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-white/10 text-right rtl:text-right ltr:text-left transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs group no-translate clinical-data"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        + {d.drugName} {d.strength || ''}
                      </div>
                      {d.scientificName && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          ({d.scientificName})
                        </div>
                      )}
                    </div>
                    {d.count > 1 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {d.count}×
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'diagnoses' && (
          <div>
            {suggestions.frequentDiagnoses.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#859394] italic py-2">
                {language === 'en' ? 'No diagnoses recorded in memory yet.' : 'لا توجد تشخيصات مسجلة في الذاكرة بعد.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-no-translate="true">
                {suggestions.frequentDiagnoses.map((diag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-no-translate="true"
                    onClick={() => {
                      if (onAddDiagnosis) {
                        onAddDiagnosis(diag.name);
                        notifyAdded(
                          language === 'en'
                            ? `Added diagnosis "${diag.name}"`
                            : `تم إضافة التشخيص "${diag.name}"`
                        );
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#080e1b] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-white/10 text-right rtl:text-right ltr:text-left transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs group no-translate clinical-data"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      + {diag.name}
                    </span>
                    {diag.count > 1 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {diag.count}×
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'labs' && (
          <div>
            {suggestions.frequentLabs.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#859394] italic py-2">
                {language === 'en' ? 'No lab tests recorded in memory yet.' : 'لا توجد تحاليل مسجلة في الذاكرة بعد.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-no-translate="true">
                {suggestions.frequentLabs.map((lab, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-no-translate="true"
                    onClick={() => {
                      if (onAddLab) {
                        onAddLab(lab.testName);
                        notifyAdded(
                          language === 'en'
                            ? `Added test "${lab.testName}"`
                            : `تم إضافة التحليل "${lab.testName}"`
                        );
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#080e1b] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-white/10 text-right rtl:text-right ltr:text-left transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs group no-translate clinical-data"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      + {lab.testName}
                    </span>
                    {lab.count > 1 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {lab.count}×
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'radiology' && (
          <div>
            {suggestions.frequentRadiology.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#859394] italic py-2">
                {language === 'en' ? 'No radiology scans recorded in memory yet.' : 'لا توجد أشعة مسجلة في الذاكرة بعد.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" data-no-translate="true">
                {suggestions.frequentRadiology.map((rad, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-no-translate="true"
                    onClick={() => {
                      if (onAddRadiology) {
                        onAddRadiology(rad.type);
                        notifyAdded(
                          language === 'en'
                            ? `Added scan "${rad.type}"`
                            : `تم إضافة الفحص/الأشعة "${rad.type}"`
                        );
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-[#080e1b] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-white/10 text-right rtl:text-right ltr:text-left transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs group no-translate clinical-data"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      + {rad.type}
                    </span>
                    {rad.count > 1 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {rad.count}×
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeCategory === 'instructions' && (
          <div>
            {suggestions.frequentInstructions.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-[#859394] italic py-2">
                {language === 'en'
                  ? 'No instructions recorded in memory yet. You can write instructions and they will be recalled in future examinations.'
                  : 'لا توجد إرشادات مسجلة في الذاكرة بعد. يمكنك كتابة إرشادات وتذكرها فوراً في الكشوفات القادمة.'}
              </p>
            ) : (
              <div className="space-y-1.5" data-no-translate="true">
                {suggestions.frequentInstructions.map((ins, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-no-translate="true"
                    onClick={() => {
                      if (onAddInstruction) {
                        onAddInstruction(ins.text);
                        notifyAdded(
                          language === 'en'
                            ? 'Added medical advice to instructions'
                            : 'تم إضافة الإرشاد الطبي إلى خانة التعليمات'
                        );
                      }
                    }}
                    className="w-full text-right rtl:text-right ltr:text-left p-2.5 rounded-xl bg-white dark:bg-[#080e1b] hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-white/10 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-xs group no-translate clinical-data"
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-[#dde2f5] group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      + {ins.text}
                    </span>
                    {ins.count > 1 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                        {ins.count}×
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
