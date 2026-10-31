import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { SymptomCatalogItem } from '../../types';

interface SymptomsAndExamCardProps {
  symptomsCatalog: SymptomCatalogItem[];
  onAddSymptomToCatalog: (item: SymptomCatalogItem) => void;
  complaint: string;
  onChangeComplaint: (val: string) => void;
  physicalExam: string;
  onChangePhysicalExam: (val: string) => void;
  initialSelectedSymptoms?: string[];
}

export const SymptomsAndExamCard: React.FC<SymptomsAndExamCardProps> = ({
  symptomsCatalog,
  onAddSymptomToCatalog,
  complaint,
  onChangeComplaint,
  physicalExam,
  onChangePhysicalExam,
  initialSelectedSymptoms = [],
}) => {
  const { language } = useLanguage();
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(initialSelectedSymptoms);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSymptomName, setNewSymptomName] = useState('');
  const [newSymptomCat, setNewSymptomCat] = useState('الجهاز الهضمي');
  const [saveToCatalog, setSaveToCatalog] = useState(true);

  useEffect(() => {
    setSelectedSymptoms(initialSelectedSymptoms);
  }, [initialSelectedSymptoms]);

  const toggleSymptom = (name: string) => {
    if (selectedSymptoms.includes(name)) {
      setSelectedSymptoms((prev) => prev.filter((s) => s !== name));
    } else {
      setSelectedSymptoms((prev) => [...prev, name]);
      // Append to complaint if not already present
      if (!complaint.includes(name)) {
        onChangeComplaint(complaint ? `${complaint} - يشكو من ${name}.` : `يشكو المريض من ${name}.`);
      }
    }
  };

  const handleAddNewSymptom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSymptomName.trim();
    if (!trimmed) return;

    if (!selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms((prev) => [...prev, trimmed]);
    }

    if (saveToCatalog) {
      onAddSymptomToCatalog({
        id: `sym-${Date.now()}`,
        name: trimmed,
        category: newSymptomCat,
        isFavorite: true,
      });
    }

    onChangeComplaint(complaint ? `${complaint} - ${trimmed}` : trimmed);
    setNewSymptomName('');
    setShowAddModal(false);
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4 min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-[#d0bcff] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-lg">clinical_notes</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#dde2f5] truncate">
              {language === 'en'
                ? 'Symptoms, Complaints & Physical Examination'
                : 'الأعراض والشكوى السريرية والفحص البدني'}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-[#859394]">
              {language === 'en'
                ? 'Clinical symptoms quick list & direct physical examination notes'
                : 'أدلة الأعراض السريرية السريعة وملاحظات الفحص البدني المباشر'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-[#d0bcff] hover:bg-purple-100 text-xs font-bold transition-all cursor-pointer shrink-0 self-start sm:self-center"
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span>{language === 'en' ? '+ Add New Symptom' : '+ إضافة عرض جديد'}</span>
        </button>
      </div>

      {/* Quick Symptoms selection chips */}
      <div className="space-y-1.5 min-w-0">
        <span className="text-[11px] font-bold text-slate-500 dark:text-[#859394] block">
          {language === 'en'
            ? 'Common symptoms (click to quickly add or remove):'
            : 'الأعراض الشائعة (انقر للإضافة أو الإزالة السريعة):'}
        </span>
        <div className="flex flex-wrap gap-2 min-w-0" data-no-translate="true">
          {(symptomsCatalog || []).filter((s) => Boolean(s && s.name)).map((sym) => {
            const symName = sym.name;
            const isSelected = selectedSymptoms.includes(symName);
            return (
              <button
                key={sym.id || symName}
                type="button"
                onClick={() => toggleSymptom(symName)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border text-right break-words max-w-full ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-[#080e1b] text-slate-700 dark:text-[#bbc9ca] hover:bg-slate-100 dark:hover:bg-[#18233C] border-slate-200 dark:border-white/5'
                }`}
              >
                {isSelected && <span className="material-symbols-outlined text-sm shrink-0">check</span>}
                <span className="break-words no-translate clinical-data" data-no-translate="true">
                  {symName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Chief complaint */}
        <div className="space-y-1.5" data-no-translate="true">
          <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5] flex items-center justify-between">
            <span>{language === 'en' ? 'Chief Complaint & HPI:' : 'الشكوى وتاريخ المرض الحالي (Chief Complaint & HPI):'}</span>
            <span className="text-[10px] text-slate-400">
              {language === 'en' ? 'Detailed text' : 'نص تفصيلي'}
            </span>
          </label>
          <textarea
            rows={4}
            value={complaint}
            data-no-translate="true"
            onChange={(e) => onChangeComplaint(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Enter patient complaint details and symptom timeline...'
                : 'اكتب شكوى المريض بالتفصيل وتطور الأعراض...'
            }
            className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-3 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] leading-relaxed resize-none no-translate clinical-data"
          />
        </div>

        {/* Physical examination */}
        <div className="space-y-1.5" data-no-translate="true">
          <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5] flex items-center justify-between">
            <span>{language === 'en' ? 'Physical Examination:' : 'الفحص الإكلينيكي البدني (Physical Examination):'}</span>
            <span className="text-[10px] text-[#008f97] dark:text-[#00c2cb]">
              {language === 'en' ? 'Room Exam' : 'فحص الغرفة'}
            </span>
          </label>
          <textarea
            rows={4}
            value={physicalExam}
            data-no-translate="true"
            onChange={(e) => onChangePhysicalExam(e.target.value)}
            placeholder={
              language === 'en'
                ? 'Chest, abdomen, cardiovascular, limbs, local signs...'
                : 'فحص البطن، القلب، الرئتين، الأطراف السفلية، العلامات الموضعية...'
            }
            className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-3 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] leading-relaxed resize-none no-translate clinical-data"
          />
        </div>
      </div>

      {/* Modal: Add New Symptom */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddNewSymptom}
            className="bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-600">add_circle</span>
                <span>إضافة عرض جديد إلى الكشف والدليل</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">اسم العرض السريري:</label>
              <input
                type="text"
                required
                value={newSymptomName}
                onChange={(e) => setNewSymptomName(e.target.value)}
                placeholder="مثال: وخز بالصدر، قيء دموي، صعوبة بلع..."
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">التصنيف الطبي:</label>
              <select
                value={newSymptomCat}
                onChange={(e) => setNewSymptomCat(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none"
              >
                <option value="الجهاز الهضمي">الجهاز الهضمي</option>
                <option value="القلب والأوعية">القلب والأوعية</option>
                <option value="الجهاز التنفسي">الجهاز التنفسي</option>
                <option value="الأعصاب">الأعصاب</option>
                <option value="الكلى والمسالك">الكلى والمسالك</option>
                <option value="عام">عام</option>
              </select>
            </div>

            <div className="flex items-center gap-2 p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/30">
              <input
                type="checkbox"
                id="saveSymCatalog"
                checked={saveToCatalog}
                onChange={(e) => setSaveToCatalog(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 accent-purple-600"
              />
              <label htmlFor="saveSymCatalog" className="text-xs text-slate-700 dark:text-[#dde2f5] cursor-pointer">
                ☑ إضافة إلى قائمتي المفضلة (ليظهر تلقائياً في الكشوفات القادمة)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#111A2E] text-xs text-slate-600 dark:text-[#bbc9ca] hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 text-xs font-bold text-white hover:bg-purple-700 transition-all cursor-pointer"
              >
                إضافة للكشف
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
