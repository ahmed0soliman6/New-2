import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DrugCatalogItem, PrescriptionItem } from '../../types';
import {
  EGYPTIAN_DRUG_ARCHIVE,
  searchDrugsInCatalogAndArchive,
  fetchOnlineDrugArchiveMatches,
  normalizeDrugText,
} from '../../data/egyptianDrugArchive';

interface MedicationsCardProps {
  prescriptionItems: PrescriptionItem[];
  onChangePrescription: (items: PrescriptionItem[]) => void;
  drugCatalog: DrugCatalogItem[];
  onAddDrugToCatalog: (item: DrugCatalogItem) => void;
  onOpenPrescriptionPad?: () => void;
  onPrintPrescription?: () => void;
  frequentSuggestions?: Array<{
    drugName: string;
    strength?: string;
    dosageForm?: string;
    scientificName?: string;
    instructions?: string;
    count?: number;
  }>;
}

export const MedicationsCard: React.FC<MedicationsCardProps> = ({
  prescriptionItems,
  onChangePrescription,
  drugCatalog,
  onAddDrugToCatalog,
  onOpenPrescriptionPad,
  onPrintPrescription,
  frequentSuggestions = [],
}) => {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPicker, setShowPicker] = useState(true);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<DrugCatalogItem[]>([]);
  const [savedToCatalogIds, setSavedToCatalogIds] = useState<Record<string, boolean>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Form for custom unlisted drug
  const [newBrandName, setNewBrandName] = useState('');
  const [newGenericName, setNewGenericName] = useState('');
  const [newStrength, setNewStrength] = useState('');
  const [newForm, setNewForm] = useState('أقراص (Tablets)');
  const [newDosage, setNewDosage] = useState('');
  const [newTiming, setNewTiming] = useState('بعد الأكل');
  const [newDuration, setNewDuration] = useState('لمدة 30 يوماً');
  const [newNotes, setNewNotes] = useState('');
  const [saveToFavorites, setSaveToFavorites] = useState(true);

  // Combine local clinic catalog + Egyptian Drug Archive dataset
  const combinedDatabase = React.useMemo(() => {
    const map = new Map<string, DrugCatalogItem>();
    drugCatalog.forEach((d) => {
      const key = normalizeDrugText(d.brandName);
      const edaMatch = EGYPTIAN_DRUG_ARCHIVE.find(
        (a) => normalizeDrugText(a.brandName) === key
      );
      map.set(key, {
        ...d,
        arabicBrand: d.arabicBrand || edaMatch?.arabicBrand,
        arabicGeneric: d.arabicGeneric || edaMatch?.arabicGeneric,
        source: 'catalog',
      });
    });
    EGYPTIAN_DRUG_ARCHIVE.forEach((d) => {
      const key = normalizeDrugText(d.brandName);
      if (!map.has(key)) {
        map.set(key, { ...d, source: 'eda-archive' });
      }
    });
    return Array.from(map.values());
  }, [drugCatalog]);

  // Re-run local + archive search whenever drugCatalog updates while a query is active
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const matches = searchDrugsInCatalogAndArchive(searchQuery, drugCatalog);
    setOnlineResults(matches);
  }, [drugCatalog]);

  // Unified Bilingual Drug Search Handler:
  // 1. Searches Doctor's Clinic Catalog (الأدلة) first
  // 2. Automatically searches the Egyptian Drug Archive (أرشيف الدواء المصري) in Arabic & English by Trade Name & Scientific Name
  // 3. Queries live online pharmaceutical index if local + archive matches are few
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const trimmed = query.trim();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!trimmed) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    // Step 1 & 2: Instant bilingual search across Clinic Catalog + Egyptian Drug Archive
    const localAndArchiveMatches = searchDrugsInCatalogAndArchive(trimmed, drugCatalog);
    setOnlineResults(localAndArchiveMatches);

    // Step 3: If fewer than 5 matches found locally, also query live online drug index
    if (localAndArchiveMatches.length < 5 && trimmed.length >= 2) {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsSearchingOnline(true);

      fetchOnlineDrugArchiveMatches(trimmed, controller.signal)
        .then((liveItems) => {
          if (controller.signal.aborted) return;
          if (liveItems.length > 0) {
            setOnlineResults((prev) => {
              const existingKeys = new Set(prev.map((p) => normalizeDrugText(p.brandName)));
              const uniqueLive = liveItems.filter(
                (item) => !existingKeys.has(normalizeDrugText(item.brandName))
              );
              return [...prev, ...uniqueLive];
            });
          }
        })
        .catch(() => {
          // Ignore abort/network errors gracefully
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearchingOnline(false);
          }
        });
    } else {
      setIsSearchingOnline(false);
    }
  };

  // Add drug from catalog or Egyptian Archive creating a decoupled SNAPSHOT into PrescriptionItem
  const handleAddFromCatalog = (drug: DrugCatalogItem) => {
    const snapshotItem: PrescriptionItem = {
      id: `rx-snap-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      drugName: `${drug.brandName}`,
      scientificName: drug.genericName,
      strength: drug.strength,
      dosageForm: drug.form,
      dosage: drug.defaultDosage,
      timing: drug.defaultTiming,
      duration: drug.defaultDuration,
      notes: drug.notes || '',
    };

    onChangePrescription([...prescriptionItems, snapshotItem]);
    setSearchQuery('');
    setOnlineResults([]);
  };

  // Save an Egyptian Archive drug into the clinic's permanent catalog (دليلي)
  const handleSaveArchiveDrugToCatalog = (e: React.MouseEvent, drug: DrugCatalogItem) => {
    e.stopPropagation();
    onAddDrugToCatalog({
      ...drug,
      id: `med-eda-${Date.now()}`,
      isFavorite: true,
      active: true,
      source: 'catalog',
    });
    setSavedToCatalogIds((prev) => ({ ...prev, [drug.id]: true }));
  };

  // Add custom unlisted drug
  const handleAddCustomDrug = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBrand = newBrandName.trim();
    if (!trimmedBrand) return;

    if (saveToFavorites) {
      onAddDrugToCatalog({
        id: `med-cat-${Date.now()}`,
        brandName: `${trimmedBrand} ${newStrength}`.trim(),
        genericName: newGenericName.trim(),
        strength: newStrength.trim(),
        form: newForm,
        category: 'أدوية مخصصة',
        defaultDosage: newDosage.trim() || 'قرص واحد يومياً',
        defaultDuration: newDuration.trim() || 'لمدة شهر',
        defaultTiming: newTiming.trim() || 'بعد الأكل',
        isFavorite: true,
        notes: newNotes.trim() || undefined,
      });
    }

    const snapshotItem: PrescriptionItem = {
      id: `rx-snap-${Date.now()}`,
      drugName: `${trimmedBrand} ${newStrength}`.trim(),
      scientificName: newGenericName.trim() || undefined,
      strength: newStrength.trim() || undefined,
      dosageForm: newForm,
      dosage: newDosage.trim() || 'قرص واحد يومياً',
      timing: newTiming.trim() || 'بعد الأكل',
      duration: newDuration.trim() || 'لمدة 30 يوماً',
      notes: newNotes.trim() || undefined,
    };

    onChangePrescription([...prescriptionItems, snapshotItem]);

    setNewBrandName('');
    setNewGenericName('');
    setNewStrength('');
    setNewDosage('');
    setNewNotes('');
    setShowAddCustomModal(false);
    setSearchQuery('');
    setOnlineResults([]);
  };

  const handleUpdateSnapshotField = (
    id: string,
    field: keyof PrescriptionItem,
    value: string
  ) => {
    onChangePrescription(
      prescriptionItems.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const handleRemove = (id: string) => {
    onChangePrescription(prescriptionItems.filter((it) => it.id !== id));
  };

  const handleQuickAdd = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (onlineResults.length > 0) {
      handleAddFromCatalog(onlineResults[0]);
      return;
    }
    const matched = combinedDatabase.find(
      (d) =>
        normalizeDrugText(d.brandName) === normalizeDrugText(trimmed) ||
        normalizeDrugText(d.arabicBrand || '') === normalizeDrugText(trimmed) ||
        normalizeDrugText(d.genericName) === normalizeDrugText(trimmed) ||
        normalizeDrugText(d.arabicGeneric || '') === normalizeDrugText(trimmed)
    );
    if (matched) {
      handleAddFromCatalog(matched);
    } else {
      const snapshotItem: PrescriptionItem = {
        id: `rx-snap-${Date.now()}`,
        drugName: trimmed,
        dosage: 'قرص واحد يومياً أو حسب الإرشاد الطبي',
        timing: 'بعد الأكل',
        duration: 'لمدة أسبوعين',
        notes: '',
      };
      onChangePrescription([...prescriptionItems, snapshotItem]);
      setSearchQuery('');
      setOnlineResults([]);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">medication</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-[#dde2f5]">
                {language === 'en' ? 'Electronic Prescription (Rx)' : 'الروشتة الإلكترونية (Rx)'}
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7]">
                {prescriptionItems.length} {language === 'en' ? (prescriptionItems.length === 1 ? 'medication' : 'medications') : 'أدوية بالروشتة'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#859394]">
              {language === 'en'
                ? 'Search clinic catalog & Egyptian Drug Archive by trade or scientific name (Arabic / English)'
                : 'بحث شامل في دليل العيادة وأرشيف الدواء المصري بالاسم التجاري أو العلمي (عربي / إنجليزي)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onPrintPrescription && (
            <button
              type="button"
              onClick={onPrintPrescription}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
              title={language === 'en' ? 'Print prescription directly' : 'طباعة الروشتة مباشرة'}
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>{language === 'en' ? 'Print Prescription' : 'طباعة الروشتة'}</span>
            </button>
          )}

          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-700 dark:text-[#00c2cb] text-xs font-bold transition-all cursor-pointer border border-teal-200 dark:border-teal-800/40 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">lists</span>
              <span>{language === 'en' ? '+ Pick from Catalog' : '+ اختيار من دليلي'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const selected = combinedDatabase.find((d) => d.id === val);
                  if (selected) {
                    handleAddFromCatalog(selected);
                  }
                  e.target.value = "";
                }}
                className="bg-white dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs font-bold py-1.5 px-3 rounded-xl border-2 border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer min-w-[210px] max-w-[320px] shadow-sm"
              >
                <option value="">{language === 'en' ? '-- Select medication from catalog --' : '-- اضغط لاختيار دواء من دليلي --'}</option>
                <optgroup label={language === 'en' ? 'Clinic Drug Catalog (دليلي)' : 'أدوية دليل العيادة (دليلي)'}>
                  {combinedDatabase
                    .filter((d) => d.source === 'catalog')
                    .map((drug) => {
                      const isAdded = prescriptionItems.some((p) => p.drugName.includes(drug.brandName));
                      return (
                        <option key={drug.id} value={drug.id} disabled={isAdded}>
                          {isAdded ? '✓ [مضاف] ' : '+ '} {drug.brandName} {drug.arabicBrand ? `(${drug.arabicBrand})` : ''}
                        </option>
                      );
                    })}
                </optgroup>
                <optgroup label={language === 'en' ? 'Egyptian Drug Archive (أرشيف الدواء المصري)' : 'أرشيف الدواء المصري (EDA)'}>
                  {combinedDatabase
                    .filter((d) => d.source !== 'catalog')
                    .map((drug) => {
                      const isAdded = prescriptionItems.some((p) => p.drugName.includes(drug.brandName));
                      return (
                        <option key={drug.id} value={drug.id} disabled={isAdded}>
                          {isAdded ? '✓ [مضاف] ' : '+ '} {drug.brandName} {drug.arabicBrand ? `— ${drug.arabicBrand}` : ''}
                        </option>
                      );
                    })}
                </optgroup>
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

      {/* TOP SEARCH BAR (أعلى بطاقة العلاج) */}
      <div className="p-3 bg-teal-50/40 dark:bg-[#080e1b]/80 rounded-2xl border border-[#00c2cb]/30 space-y-3 shadow-xs">
        <div className="relative">
          <input
            type="text"
            placeholder={
              language === 'en'
                ? 'Search Clinic Catalog & Egyptian Drug Archive by Trade or Scientific Name (Arabic / English)...'
                : 'ابحث في دليلك أو أرشيف الدواء المصري بالاسم التجاري أو العلمي (بالعربية أو الإنجليزية مثل: بيتاكور، سوتالول، Betacor)...'
            }
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-sm p-3.5 ltr:pl-11 ltr:pr-32 rtl:pr-11 rtl:pl-32 rounded-xl border border-slate-200 dark:border-white/10 focus:border-[#00c2cb] focus:outline-none focus:ring-2 focus:ring-[#00c2cb]/20 font-bold transition-all text-start"
          />
          <span className="material-symbols-outlined absolute ltr:left-3.5 rtl:right-3.5 top-3.5 text-teal-600 dark:text-[#00c2cb] text-xl pointer-events-none">
            medication
          </span>

          <div className="absolute ltr:right-2 rtl:left-2 top-2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOnlineResults([]);
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#18233C] text-slate-500 dark:text-[#859394] hover:text-rose-500 text-xs font-bold cursor-pointer"
              >
                {language === 'en' ? 'Clear ✕' : 'مسح ✕'}
              </button>
            )}
            <button
              type="button"
              onClick={handleQuickAdd}
              className="px-2.5 py-1.5 rounded-lg bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>{language === 'en' ? 'Add' : 'إضافة'}</span>
            </button>
          </div>
        </div>

        {/* Live Search Results Container */}
        {searchQuery.trim() && (
          <div className="p-3 bg-white dark:bg-[#111A2E] rounded-xl border border-[#00c2cb]/30 space-y-2.5 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#859394] border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#00c2cb]">manage_search</span>
                <span>
                  {language === 'en'
                    ? `Results in Clinic Catalog & Egyptian Drug Archive for "${searchQuery}":`
                    : `نتائج البحث في دليل العيادة وأرشيف الدواء المصري (تجاري / علمي • عربي / EN) لـ "${searchQuery}":`}
                </span>
              </span>
              <div className="flex items-center gap-2">
                {isSearchingOnline && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#00c2cb] font-bold">
                    <span className="w-3 h-3 border-2 border-[#00c2cb] border-t-transparent rounded-full animate-spin"></span>
                    <span>{language === 'en' ? 'Searching online index...' : 'فحص الفهرس الإضافي...'}</span>
                  </span>
                )}
                <span className="font-mono text-teal-600 dark:text-[#00c2cb] font-bold">
                  {language === 'en'
                    ? `${onlineResults.length} matching drugs`
                    : `${onlineResults.length} دواء مطابق`}
                </span>
              </div>
            </div>

            {onlineResults.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 space-y-2.5">
                <p>
                  {language === 'en'
                    ? `No direct drug found in catalog or Egyptian Archive matching "${searchQuery}".`
                    : `لا يوجد دواء مسجل بهذا الاسم في الدليل أو الأرشيف المحلي يطابق "${searchQuery}".`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                  >
                    {language === 'en'
                      ? `+ Quick Add "${searchQuery.trim()}" to Rx`
                      : `+ إضافة "${searchQuery.trim()}" مباشرة للروشتة`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewBrandName(searchQuery.trim());
                      setShowAddCustomModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                  >
                    {language === 'en'
                      ? '+ Add with Full Details to Catalog & Rx'
                      : '+ توصيف وإضافة للدليل والروشتة'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {onlineResults.map((item) => {
                    const isFromClinicCatalog = item.source === 'catalog' || savedToCatalogIds[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleAddFromCatalog(item)}
                        className="p-3 rounded-xl text-start text-xs bg-slate-50 dark:bg-[#080e1b] hover:border-[#00c2cb] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-[#dde2f5] flex flex-col justify-between gap-2 cursor-pointer group transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="font-bold text-slate-900 dark:text-[#dde2f5] group-hover:text-[#008f97] dark:group-hover:text-[#00c2cb] leading-snug">
                              {item.isFavorite && <span className="text-amber-500 text-[10px] ml-1">⭐</span>}
                              <span dir="ltr" className="inline-block">{item.brandName}</span>
                              {item.arabicBrand && (
                                <span className="block text-[11px] text-teal-700 dark:text-[#45dee7] font-bold mt-0.5">
                                  {item.arabicBrand}
                                </span>
                              )}
                            </div>
                            <span className="material-symbols-outlined text-[#00c2cb] text-lg shrink-0 group-hover:scale-110 transition-transform">
                              add_circle
                            </span>
                          </div>

                          {/* Scientific Name (English & Arabic) */}
                          <div className="pt-0.5 space-y-0.5">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block" dir="ltr">
                              {item.genericName}
                            </span>
                            {item.arabicGeneric && (
                              <span className="text-[10px] text-slate-500 dark:text-[#859394] block">
                                {language === 'en' ? 'Active Ingredient: ' : 'المادة الفعالة: '}{item.arabicGeneric}
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-teal-600 dark:text-[#45dee7] block font-bold pt-0.5">
                            {item.defaultDosage}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/60 dark:border-white/5">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                              isFromClinicCatalog
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                : item.source === 'online-archive'
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                                : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                            }`}
                          >
                            {isFromClinicCatalog
                              ? (language === 'en' ? 'My Catalog ✓' : 'من دليلي ✓')
                              : item.source === 'online-archive'
                              ? (language === 'en' ? 'Global Drug Index 🌐' : 'الفهرس الدوائي العالمي 🌐')
                              : (language === 'en' ? 'Egyptian Drug Archive 🇪🇬' : 'أرشيف الدواء المصري 🇪🇬')}
                          </span>

                          {!isFromClinicCatalog && (
                            <button
                              type="button"
                              onClick={(e) => handleSaveArchiveDrugToCatalog(e, item)}
                              className="text-[10px] font-bold text-[#008f97] dark:text-[#00c2cb] hover:underline px-1.5 py-0.5 rounded bg-teal-500/10 hover:bg-teal-500/20 cursor-pointer"
                              title={language === 'en' ? 'Save this drug to permanent clinic catalog' : 'إضافة هذا الدواء من أرشيف الدواء المصري إلى دليل العيادة الدائم'}
                            >
                              {language === 'en' ? '+ Save to My Catalog' : '+ حفظ بدليلي'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom helper bar to add custom medication if desired */}
                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400 dark:text-[#859394]">
                    {language === 'en'
                      ? "Didn't find required concentration? You can add it directly:"
                      : 'لم تجد التركيز المطلوب؟ يمكنك إضافته مباشرة:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewBrandName(searchQuery.trim());
                      setShowAddCustomModal(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#18233C] hover:bg-[#00c2cb] hover:text-slate-950 text-slate-700 dark:text-[#dde2f5] font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    {language === 'en'
                      ? `+ Describe & Add "${searchQuery.trim()}" as Custom Drug`
                      : `+ توصيف وإضافة "${searchQuery.trim()}" كدواء مخصص`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>


      {/* Active Prescription Table (Snapshots) */}
      {prescriptionItems.length === 0 ? (
        <div className="py-8 text-center bg-slate-50/50 dark:bg-[#080e1b]/40 rounded-2xl border border-dashed border-slate-200 dark:border-white/5">
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl mb-1">
            prescriptions
          </span>
          <p className="text-xs font-bold text-slate-600 dark:text-[#859394]">
            {language === 'en'
              ? 'No medications added to the prescription yet.'
              : 'لم يتم إضافة أدوية إلى قائمة الروشتة بعد.'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {language === 'en'
              ? 'Use the comprehensive search box above to search clinic drugs and the Egyptian Drug Index.'
              : 'استخدم صندوق البحث الشامل بأعلى البطاقة للبحث في أدوية العيادة وأرشيف الدواء المصري.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-no-translate="true">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-[#859394] px-1">
            <span>
              {language === 'en' ? 'Approved Prescription Medications:' : 'قائمة الأدوية المعتمدة بالروشتة:'}
            </span>
            <span className="text-teal-600 font-mono">Prescription Snapshot</span>
          </div>

          {prescriptionItems.map((item, idx) => (
            <div
              key={item.id}
              className="bg-slate-50 dark:bg-[#080e1b] rounded-2xl border border-slate-200 dark:border-white/5 p-3.5 space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#00c2cb] font-mono text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="clinical-data" data-no-translate="true">
                    <span
                      data-no-translate="true"
                      className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] no-translate clinical-data"
                    >
                      {item.drugName}
                    </span>
                    {item.scientificName && (
                      <span
                        data-no-translate="true"
                        className="text-[10px] text-slate-400 mr-2 font-mono no-translate clinical-data"
                        dir="ltr"
                      >
                        ({item.scientificName})
                      </span>
                    )}
                    {item.dosageForm && (
                      <span
                        data-no-translate="true"
                        className="text-[10px] text-teal-700 dark:text-[#45dee7] mr-1 px-1.5 py-0.5 rounded bg-teal-50 dark:bg-[#00c2cb]/10 no-translate clinical-data"
                      >
                        {item.dosageForm}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer self-end sm:self-center"
                  title={language === 'en' ? 'Remove from prescription' : 'حذف من الروشتة'}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>

              {/* Editable Dosage & Duration Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1 border-t border-slate-200 dark:border-white/5">
                <div className="sm:col-span-7 flex flex-col sm:flex-row items-start sm:items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-[#859394] whitespace-nowrap">
                    {language === 'en' ? 'Dosage:' : 'الجرعة:'}
                  </span>
                  <div className="flex-1 flex items-center gap-1 w-full">
                    <input
                      type="text"
                      value={item.dosage || ''}
                      onChange={(e) => handleUpdateSnapshotField(item.id, 'dosage', e.target.value)}
                      placeholder={
                        language === 'en'
                          ? 'Directions and timing...'
                          : 'طريقة الاستخدام وتوقيت الجرعة...'
                      }
                      className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-xs p-1.5 rounded-lg border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleUpdateSnapshotField(item.id, 'dosage', e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] text-[11px] p-1.5 rounded-lg border border-slate-200 dark:border-white/10 focus:outline-none cursor-pointer max-w-[130px]"
                    >
                      <option value="" disabled>
                        {language === 'en' ? 'Quick timing...' : 'اختر التوقيت...'}
                      </option>
                      <option value={language === 'en' ? 'Every 6 hours (4 times daily)' : 'كل 6 ساعات (4 مرات يومياً)'}>
                        {language === 'en' ? 'Every 6 hrs' : 'كل 6 ساعات'}
                      </option>
                      <option value={language === 'en' ? 'Every 8 hours (3 times daily)' : 'كل 8 ساعات (3 مرات يومياً)'}>
                        {language === 'en' ? 'Every 8 hrs' : 'كل 8 ساعات'}
                      </option>
                      <option value={language === 'en' ? 'Every 12 hours (twice daily)' : 'كل 12 ساعة (مرتين يومياً)'}>
                        {language === 'en' ? 'Every 12 hrs' : 'كل 12 ساعة'}
                      </option>
                      <option value={language === 'en' ? 'Every 24 hours (once daily)' : 'كل 24 ساعة (مرة يومياً)'}>
                        {language === 'en' ? 'Once daily' : 'كل 24 ساعة'}
                      </option>
                      <option value={language === 'en' ? 'Before meals' : 'قبل الأكل'}>
                        {language === 'en' ? 'Before meals' : 'قبل الأكل'}
                      </option>
                      <option value={language === 'en' ? 'After meals' : 'بعد الأكل'}>
                        {language === 'en' ? 'After meals' : 'بعد الأكل'}
                      </option>
                      <option value={language === 'en' ? 'Morning & evening' : 'صباحاً ومساءً'}>
                        {language === 'en' ? 'Morning & evening' : 'صباحاً ومساءً'}
                      </option>
                      <option value={language === 'en' ? 'As needed (PRN)' : 'عند اللزوم'}>
                        {language === 'en' ? 'As needed' : 'عند اللزوم'}
                      </option>
                      <option value={language === 'en' ? 'At bedtime' : 'عند النوم'}>
                        {language === 'en' ? 'At bedtime' : 'عند النوم'}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-5 flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 dark:text-[#859394] whitespace-nowrap">
                    {language === 'en' ? 'Duration:' : 'المدة:'}
                  </span>
                  <input
                    type="text"
                    value={item.duration || ''}
                    onChange={(e) => handleUpdateSnapshotField(item.id, 'duration', e.target.value)}
                    placeholder={language === 'en' ? 'e.g. 1 month, 2 weeks...' : 'مثال: لمدة شهر، أسبوعين...'}
                    className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-xs p-1.5 rounded-lg border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LEVEL 3: Modal: Add Unlisted Drug */}
      {showAddCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCustomDrug}
            className="bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb]">add_circle</span>
                <span>إضافة دواء غير مدرج في الدليل</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">
                  اسم الدواء التجاري (Brand Name):
                </label>
                <input
                  type="text"
                  required
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="مثال: Telfast, Cipralex, Daflon..."
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">التركيز (Strength):</label>
                <input
                  type="text"
                  value={newStrength}
                  onChange={(e) => setNewStrength(e.target.value)}
                  placeholder="مثال: 500 mg, 10 mg, 20 ml..."
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">
                  المادة الفعالة / الاسم العلمي:
                </label>
                <input
                  type="text"
                  value={newGenericName}
                  onChange={(e) => setNewGenericName(e.target.value)}
                  placeholder="e.g. Fexofenadine, Escitalopram..."
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">الشكل الدوائي:</label>
                <select
                  value={newForm}
                  onChange={(e) => setNewForm(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none"
                >
                  <option value="أقراص (Tablets)">أقراص (Tablets)</option>
                  <option value="كبسولات (Capsules)">كبسولات (Capsules)</option>
                  <option value="شراب معلق (Suspension)">شراب معلق (Suspension)</option>
                  <option value="أمبولات حقن عضل/وريد (Ampoules)">أمبولات حقن عضل/وريد</option>
                  <option value="فوار (Effervescent)">فوار (Effervescent)</option>
                  <option value="نقط بالفم أو العين (Drops)">نقط بالفم أو العين</option>
                  <option value="مرهم / كريم موضعي (Ointment)">مرهم / كريم موضعي</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">الجرعة وطريقة الاستخدام:</label>
                <input
                  type="text"
                  value={newDosage}
                  onChange={(e) => setNewDosage(e.target.value)}
                  placeholder="مثال: قرص واحد قبل الأكل بنصف ساعة مرتين يومياً..."
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">المدة:</label>
                <input
                  type="text"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="مثال: لمدة شهر، لمدة أسبوع..."
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-teal-50/60 dark:bg-[#00c2cb]/10 rounded-xl border border-teal-200 dark:border-[#00c2cb]/20">
              <input
                type="checkbox"
                id="saveToFavoritesCheck"
                checked={saveToFavorites}
                onChange={(e) => setSaveToFavorites(e.target.checked)}
                className="w-4 h-4 rounded text-[#00c2cb] accent-[#00c2cb]"
              />
              <label htmlFor="saveToFavoritesCheck" className="text-xs text-slate-700 dark:text-[#dde2f5] cursor-pointer">
                ☑ إضافة إلى قائمة أدوية الطبيب المفضلة (ليظهر في شريط الأدوية المفضلة مستقبلاً)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCustomModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#111A2E] text-xs text-slate-600 dark:text-[#bbc9ca] hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                إضافة إلى العلاج الموصوف
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

