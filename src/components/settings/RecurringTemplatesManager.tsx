import React, { useState, useEffect } from 'react';
import {
  RecurringRxTemplate,
  loadRecurringTemplates,
  saveRecurringTemplates,
  addOrUpdateRecurringTemplate,
  deleteRecurringTemplate,
  INITIAL_CLINICAL_GUIDES_TEMPLATES,
} from '../../utils/recurringTemplatesManager';
import { DiagnosisCatalogItem, DrugCatalogItem, PrescriptionItem } from '../../types';

interface RecurringTemplatesManagerProps {
  diagnosesCatalog?: DiagnosisCatalogItem[];
  drugCatalog?: DrugCatalogItem[];
  onNotify?: (message: string) => void;
}

export const RecurringTemplatesManager: React.FC<RecurringTemplatesManagerProps> = ({
  diagnosesCatalog = [],
  drugCatalog = [],
  onNotify = (_msg: string) => {},
}) => {
  const [templates, setTemplates] = useState<RecurringRxTemplate[]>(loadRecurringTemplates);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClinicalGuidesModalOpen, setIsClinicalGuidesModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Template Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('باطنة عامة');
  const [formDiagnoses, setFormDiagnoses] = useState<
    Array<{ id?: string; nameAr: string; nameEn?: string; code?: string; isPrimary?: boolean }>
  >([]);
  const [formPrescription, setFormPrescription] = useState<PrescriptionItem[]>([]);
  const [formAdvice, setFormAdvice] = useState('');

  // Dropdown helper states for the form
  const [selectedCatalogDiagId, setSelectedCatalogDiagId] = useState('');
  const [customDiagInput, setCustomDiagInput] = useState('');

  const [selectedCatalogDrugId, setSelectedCatalogDrugId] = useState('');
  const [customDrugName, setCustomDrugName] = useState('');
  const [customDrugStrength, setCustomDrugStrength] = useState('');
  const [customDrugForm, setCustomDrugForm] = useState('أقراص (Tablets)');
  const [customDrugDosage, setCustomDrugDosage] = useState('قرص واحد يومياً');
  const [customDrugTiming, setCustomDrugTiming] = useState('بعد الأكل');
  const [customDrugDuration, setCustomDrugDuration] = useState('لمدة أسبوعين');
  const [customDrugNotes, setCustomDrugNotes] = useState('');

  // Sync with window events
  useEffect(() => {
    const handleSync = () => {
      setTemplates(loadRecurringTemplates());
    };
    window.addEventListener('soli_templates_updated', handleSync);
    return () => {
      window.removeEventListener('soli_templates_updated', handleSync);
    };
  }, []);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [templates]);

  const filteredTemplates = templates.filter((t) => {
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      t.title.toLowerCase().includes(q) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      t.diagnoses.some((d) => (d.nameAr || '').toLowerCase().includes(q) || (d.nameEn || '').toLowerCase().includes(q)) ||
      t.prescription.some((p) => (p.drugName || '').toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const handleOpenAddModal = () => {
    setEditingTemplateId(null);
    setFormTitle('');
    setFormCategory('باطنة عامة');
    setFormDiagnoses([]);
    setFormPrescription([]);
    setFormAdvice('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (tmpl: RecurringRxTemplate) => {
    setEditingTemplateId(tmpl.id);
    setFormTitle(tmpl.title);
    setFormCategory(tmpl.category || 'باطنة عامة');
    setFormDiagnoses(tmpl.diagnoses ? [...tmpl.diagnoses] : []);
    setFormPrescription(tmpl.prescription ? [...tmpl.prescription] : []);
    setFormAdvice(tmpl.lifestyleAdvice || '');
    setIsModalOpen(true);
  };

  const handleImportFromClinicalGuide = (guide: RecurringRxTemplate) => {
    const newTmpl: RecurringRxTemplate = {
      ...guide,
      id: `tmpl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: `${guide.title}`,
    };
    const updated = addOrUpdateRecurringTemplate(newTmpl);
    setTemplates(updated);
    setIsClinicalGuidesModalOpen(false);
    onNotify(`تم استدعاء "${guide.title}" بنجاح إلى القوائم المتكررة ✓`);
  };

  const handleAddDiagnosisFromCatalog = () => {
    if (!selectedCatalogDiagId) return;
    const cat = diagnosesCatalog.find((d) => d.id === selectedCatalogDiagId);
    if (!cat) return;
    if (formDiagnoses.some((d) => d.nameAr === cat.nameAr)) return;

    setFormDiagnoses([
      ...formDiagnoses,
      {
        id: `diag-${Date.now()}`,
        nameAr: cat.nameAr,
        nameEn: cat.nameEn,
        code: cat.code,
        isPrimary: formDiagnoses.length === 0,
      },
    ]);
    setSelectedCatalogDiagId('');
  };

  const handleAddCustomDiagnosis = () => {
    const trimmed = customDiagInput.trim();
    if (!trimmed) return;
    if (formDiagnoses.some((d) => d.nameAr === trimmed)) return;

    setFormDiagnoses([
      ...formDiagnoses,
      {
        id: `diag-${Date.now()}`,
        nameAr: trimmed,
        isPrimary: formDiagnoses.length === 0,
      },
    ]);
    setCustomDiagInput('');
  };

  const handleRemoveDiagnosis = (idx: number) => {
    const updated = formDiagnoses.filter((_, i) => i !== idx);
    if (updated.length > 0 && !updated.some((d) => d.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setFormDiagnoses(updated);
  };

  const handleAddDrugFromCatalog = () => {
    if (!selectedCatalogDrugId) return;
    const drug = drugCatalog.find((d) => d.id === selectedCatalogDrugId);
    if (!drug) return;

    const newItem: PrescriptionItem = {
      id: `rx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      drugName: drug.brandName,
      scientificName: drug.genericName,
      strength: drug.strength,
      dosageForm: drug.form,
      dosage: drug.defaultDosage || 'قرص واحد يومياً',
      timing: drug.defaultTiming || 'بعد الأكل',
      duration: drug.defaultDuration || 'لمدة 30 يوماً',
      notes: drug.notes || '',
    };
    setFormPrescription([...formPrescription, newItem]);
    setSelectedCatalogDrugId('');
  };

  const handleAddCustomDrug = () => {
    const trimmed = customDrugName.trim();
    if (!trimmed) return;

    const newItem: PrescriptionItem = {
      id: `rx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      drugName: `${trimmed} ${customDrugStrength}`.trim(),
      dosageForm: customDrugForm,
      dosage: customDrugDosage.trim() || 'قرص واحد يومياً',
      timing: customDrugTiming.trim() || 'بعد الأكل',
      duration: customDrugDuration.trim() || 'لمدة أسبوعين',
      notes: customDrugNotes.trim() || '',
    };
    setFormPrescription([...formPrescription, newItem]);
    setCustomDrugName('');
    setCustomDrugStrength('');
    setCustomDrugNotes('');
  };

  const handleRemoveDrug = (id: string) => {
    setFormPrescription(formPrescription.filter((p) => p.id !== id));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      alert('يرجى كتابة اسم القائمة المتكررة');
      return;
    }

    const templateData: RecurringRxTemplate = {
      id: editingTemplateId || `tmpl-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory.trim() || 'باطنة عامة',
      diagnoses: formDiagnoses,
      prescription: formPrescription,
      lifestyleAdvice: formAdvice.trim() || undefined,
      isFavorite: true,
    };

    const updated = addOrUpdateRecurringTemplate(templateData);
    setTemplates(updated);
    setIsModalOpen(false);
    onNotify(
      editingTemplateId
        ? `تم تحديث القائمة "${formTitle.trim()}" بنجاح ✓`
        : `تمت إضافة القائمة المتكررة "${formTitle.trim()}" بنجاح ✓`
    );
  };

  const handleDelete = (id: string, title: string) => {
    const updated = deleteRecurringTemplate(id);
    setTemplates(updated);
    setDeleteConfirmId(null);
    onNotify(`تم حذف القائمة "${title}" بنجاح ✓`);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#080e1b] p-3.5 rounded-2xl border border-slate-200 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>+ إضافة قائمة مخصصة جديدة</span>
          </button>

          <button
            type="button"
            onClick={() => setIsClinicalGuidesModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 border border-purple-500/30 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">menu_book</span>
            <span>استدعاء من الأدلة والبروتوكولات الطبية الجاهزة</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const current = loadRecurringTemplates();
              const existingIds = new Set(current.map((t) => t.id));
              const existingTitles = new Set(current.map((t) => t.title.trim().toLowerCase()));
              
              const newToMerge = INITIAL_CLINICAL_GUIDES_TEMPLATES.filter(
                (guide) => !existingIds.has(guide.id) && !existingTitles.has(guide.title.trim().toLowerCase())
              );

              if (newToMerge.length === 0) {
                // If all are already present, force reload/restore full set
                if (window.confirm('جميع الأدلة والبروتوكولات الطبية محملة مسبقاً. هل تريد إعادة استعادة جميع أدلة التخصصات؟')) {
                  saveRecurringTemplates(INITIAL_CLINICAL_GUIDES_TEMPLATES);
                  setTemplates(INITIAL_CLINICAL_GUIDES_TEMPLATES);
                  onNotify('تمت إعادة تحميل جميع الأدلة والبروتوكولات الطبية لكافة التخصصات بنجاح ✓');
                }
              } else {
                const merged = [...current, ...newToMerge];
                saveRecurringTemplates(merged);
                setTemplates(merged);
                onNotify(`تم دمج واستعادة أدلة التخصصات الطبية بنجاح ✓`);
              }
            }}
            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer"
            title="إعادة دمج واستعادة جميع الأدلة الطبية الجاهزة لكل التخصصات"
          >
            <span className="material-symbols-outlined text-base">auto_mode</span>
            <span>استعادة أدلة جميع التخصصات</span>
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في القوائم والأدوية..."
              className="w-full bg-white dark:bg-[#18233C] pr-8 pl-2 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium text-xs focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Category filter pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#00c2cb] text-slate-950 shadow-2xs'
                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-[#859394] hover:bg-slate-200'
            }`}
          >
            الكل ({templates.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#00c2cb] text-slate-950 shadow-2xs'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-[#859394] hover:bg-slate-200'
              }`}
            >
              {cat} ({templates.filter((t) => t.category === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Templates Cards Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-[#080e1b]/30 rounded-2xl border border-dashed border-slate-200 dark:border-white/5 space-y-3">
          <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 block">
            receipt_long
          </span>
          <p className="font-bold text-xs text-slate-700 dark:text-slate-300">
            لا توجد قوائم متكررة مطابقة لبحثك
          </p>
          <p className="text-[11px] text-slate-500 dark:text-[#859394]">
            يمكنك إنشاء قائمة مخصصة جديدة أو استدعاء البروتوكولات الإكلينيكية الجاهزة بضغطة زر واحدة.
          </p>
          <button
            type="button"
            onClick={() => {
              saveRecurringTemplates(INITIAL_CLINICAL_GUIDES_TEMPLATES);
              setTemplates(INITIAL_CLINICAL_GUIDES_TEMPLATES);
              onNotify('تمت استعادة بروتوكولات الأدلة الطبية القياسية بنجاح ✓');
            }}
            className="px-4 py-2 rounded-xl bg-[#00c2cb] text-slate-950 font-bold text-xs cursor-pointer shadow-xs inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            <span>استعادة البروتوكولات الطبية الأساسية</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-slate-50 dark:bg-[#080e1b] p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3 shadow-2xs hover:border-[#00c2cb]/40 transition-all"
            >
              <div className="space-y-2.5">
                {/* Header: Title & Category */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 dark:border-white/5 pb-2">
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">
                        clinical_notes
                      </span>
                      <span className="truncate">{tmpl.title}</span>
                    </h4>
                    {tmpl.category && (
                      <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-[#008f97] dark:text-[#00c2cb] border border-teal-500/20">
                        {tmpl.category}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(tmpl)}
                      className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 text-[#008f97] dark:text-[#45dee7] font-bold transition-colors cursor-pointer border border-teal-200/50 dark:border-teal-800/40"
                      title="تعديل القائمة"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>

                    {deleteConfirmId === tmpl.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 p-1 rounded-lg border border-rose-300 dark:border-rose-800">
                        <button
                          type="button"
                          onClick={() => handleDelete(tmpl.id, tmpl.title)}
                          className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[10px] cursor-pointer"
                        >
                          تأكيد
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-1 text-slate-500 text-[10px] cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(tmpl.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold transition-colors cursor-pointer border border-rose-200/50 dark:border-rose-900/30"
                        title="حذف القائمة"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Diagnoses */}
                {tmpl.diagnoses && tmpl.diagnoses.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-[#859394] block">
                      التشخيص المقترن:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {tmpl.diagnoses.map((d, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold text-[11px] border border-amber-500/20"
                        >
                          {d.nameAr || d.nameEn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications List */}
                {tmpl.prescription && tmpl.prescription.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-[#859394] block">
                      الأدوية الموصوفة ({tmpl.prescription.length}):
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {tmpl.prescription.map((p, idx) => (
                        <div
                          key={p.id || idx}
                          className="p-2 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white block truncate text-[11px]">
                              {p.drugName}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-[#859394] block truncate">
                              {p.dosage} • {p.timing || 'بعد الأكل'} • {p.duration || 'مستمر'}
                            </span>
                          </div>
                          {p.dosageForm && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 shrink-0">
                              {p.dosageForm}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lifestyle Advice */}
                {tmpl.lifestyleAdvice && (
                  <div className="p-2 rounded-xl bg-teal-500/5 border border-teal-500/10 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    <strong className="text-[#008f97] dark:text-[#00c2cb]">إرشادات:</strong>{' '}
                    {tmpl.lifestyleAdvice}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: Edit / Add Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00c2cb] text-xl">
                  {editingTemplateId ? 'edit_note' : 'add_circle'}
                </span>
                <span>
                  {editingTemplateId
                    ? `تعديل القائمة المتكررة: ${formTitle || 'قائمة روشتة'}`
                    : 'إنشاء قائمة متكررة وبروتوكول مخصص'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Row 1: Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 dark:text-[#dde2f5]">
                    اسم القائمة المتكررة *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثال: بروتوكول جرثومة المعدة، روشتة ضغط وسكر..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 dark:text-[#dde2f5]">
                    التصنيف الطبي / التخصص
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="باطنة عامة">باطنة عامة</option>
                    <option value="الجهاز الهضمي والكبد">الجهاز الهضمي والكبد</option>
                    <option value="القلب والأوعية الدموية">القلب والأوعية الدموية</option>
                    <option value="الغدد الصماء والسكر">الغدد الصماء والسكر</option>
                    <option value="الجهاز التنفسي">الجهاز التنفسي</option>
                    <option value="المسالك البولية">المسالك البولية</option>
                    <option value="عظام ومفاصل">عظام ومفاصل</option>
                    <option value="أمراض مزمنة">أمراض مزمنة</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Diagnoses Builder */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-base">diagnosis</span>
                    التشخيص المقترن بالقائمة ({formDiagnoses.length})
                  </span>
                </div>

                {/* Selected Diagnoses Chips */}
                {formDiagnoses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formDiagnoses.map((d, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2"
                      >
                        <span>{d.nameAr || d.nameEn}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDiagnosis(idx)}
                          className="hover:text-red-900 dark:hover:text-white font-bold"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Pick from Catalog or Custom */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                  <div className="sm:col-span-7 flex gap-1.5">
                    <select
                      value={selectedCatalogDiagId}
                      onChange={(e) => setSelectedCatalogDiagId(e.target.value)}
                      className="w-full bg-white dark:bg-[#18233C] px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="">-- اختر من دليل التشخيصات الطبية --</option>
                      {diagnosesCatalog.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr} ({d.category || 'عام'})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddDiagnosisFromCatalog}
                      disabled={!selectedCatalogDiagId}
                      className="px-3 py-2 rounded-xl bg-[#00c2cb] text-slate-950 font-bold text-xs disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      + إدراج
                    </button>
                  </div>

                  <div className="sm:col-span-5 flex gap-1.5">
                    <input
                      type="text"
                      value={customDiagInput}
                      onChange={(e) => setCustomDiagInput(e.target.value)}
                      placeholder="أو اكتب تشخيص مخصص..."
                      className="w-full bg-white dark:bg-[#18233C] px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium text-xs focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomDiagnosis}
                      disabled={!customDiagInput.trim()}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Medications Builder */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">
                      medication
                    </span>
                    العلاج والأدوية الموصوفة ({formPrescription.length})
                  </span>
                </div>

                {/* List of drugs in form */}
                {formPrescription.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {formPrescription.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                              {p.drugName}
                            </span>
                            <span className="text-[10px] bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                              {p.dosageForm || 'أقراص'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-[#859394]">
                            <span>الجرعة: {p.dosage}</span>
                            <span>• التوقيت: {p.timing || 'بعد الأكل'}</span>
                            <span>• المدة: {p.duration || 'مستمر'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDrug(p.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer shrink-0"
                          title="إزالة الدواء"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-2">
                    لم تتم إضافة أدوية بعد. اختر من الدليل الطبي أو أضف دواء مخصص.
                  </p>
                )}

                {/* Add Drug Controls */}
                <div className="border-t border-slate-200/60 dark:border-white/5 pt-2 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-[#bbc9ca] block">
                    إدراج دواء من الدليل الطبي للعيادة:
                  </span>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedCatalogDrugId}
                      onChange={(e) => setSelectedCatalogDrugId(e.target.value)}
                      className="w-full bg-white dark:bg-[#18233C] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium text-xs focus:outline-none cursor-pointer"
                    >
                      <option value="">-- اختر دواء من الدليل الطبي مع الجرعة الافتراضية --</option>
                      {drugCatalog.map((d) => (
                        <option key={d.id} value={d.id}>
                          💊 {d.brandName} - {d.genericName || ''} ({d.form || 'أقراص'})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddDrugFromCatalog}
                      disabled={!selectedCatalogDrugId}
                      className="px-4 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      + إدراج بالروشتة
                    </button>
                  </div>

                  {/* Or Custom Drug Inputs */}
                  <details className="pt-1">
                    <summary className="text-[11px] font-bold text-[#008f97] dark:text-[#00c2cb] cursor-pointer">
                      + أو إضافة دواء مخصص يدوياً غير مسجل بالدليل
                    </summary>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                      <input
                        type="text"
                        value={customDrugName}
                        onChange={(e) => setCustomDrugName(e.target.value)}
                        placeholder="اسم الدواء والتجاري..."
                        className="bg-white dark:bg-[#18233C] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
                      />
                      <input
                        type="text"
                        value={customDrugDosage}
                        onChange={(e) => setCustomDrugDosage(e.target.value)}
                        placeholder="الجرعة (مثال: قرص كل 12 ساعة)..."
                        className="bg-white dark:bg-[#18233C] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
                      />
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={customDrugTiming}
                          onChange={(e) => setCustomDrugTiming(e.target.value)}
                          placeholder="التوقيت (بعد الأكل)..."
                          className="flex-1 bg-white dark:bg-[#18233C] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomDrug}
                          disabled={!customDrugName.trim()}
                          className="px-3 py-1.5 bg-teal-600 text-white font-bold text-xs rounded-xl disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          إضافة
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* Section 4: Lifestyle Advice */}
              <div className="space-y-1">
                <label className="font-bold text-slate-800 dark:text-[#dde2f5] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-teal-600 text-base">recommend</span>
                  الإرشادات والتعليمات الطبية والنظام الغذائي المقترن
                </label>
                <textarea
                  rows={3}
                  value={formAdvice}
                  onChange={(e) => setFormAdvice(e.target.value)}
                  placeholder="أدخل نصائح النظام الغذائي، الممنوعات، مواعيد المتابعة، والتحذيرات..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                />
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveForm}
                  className="px-6 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>حفظ واعتماد القائمة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Clinical Guides Protocols Selector Modal */}
      {isClinicalGuidesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl">
                    menu_book
                  </span>
                  <span>الأدلة والبروتوكولات الإكلينيكية القياسية (Clinical Guides)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5">
                  اختر البروتوكول الطبي المطلوب لاستدعائه وإدراجه فوراً ضمن قوائمك المتكررة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClinicalGuidesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {INITIAL_CLINICAL_GUIDES_TEMPLATES.map((guide) => (
                <div
                  key={guide.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-purple-500/40 transition-all"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                        {guide.title}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300">
                        {guide.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>التشخيص:</strong>{' '}
                      {guide.diagnoses.map((d) => d.nameAr).join('، ')}
                    </p>

                    <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                      <strong>الأدوية ({guide.prescription.length}):</strong>{' '}
                      {guide.prescription.map((p) => p.drugName).join(' + ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleImportFromClinicalGuide(guide)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">download</span>
                    <span>استيراد وتضمين</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setIsClinicalGuidesModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
