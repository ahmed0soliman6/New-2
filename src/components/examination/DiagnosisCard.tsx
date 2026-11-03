import React, { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DiagnosisCatalogItem } from '../../types';
import {
  MEDICAL_DIAGNOSES_ARCHIVE,
  searchDiagnosesInCatalogAndArchive,
  fetchOnlineDiagnosesMatches,
} from '../../data/medicalClinicalArchive';
import { normalizeDrugText } from '../../data/egyptianDrugArchive';

export interface PatientDiagnosis {
  id: string;
  catalogId?: string;
  code?: string;
  nameAr: string;
  nameEn?: string;
  isPrimary: boolean;
  notes?: string;
}

interface DiagnosisCardProps {
  diagnoses: PatientDiagnosis[];
  onChangeDiagnoses: (diagnoses: PatientDiagnosis[]) => void;
  diagnosesCatalog: DiagnosisCatalogItem[];
  onAddDiagnosisToCatalog: (item: DiagnosisCatalogItem) => void;
  frequentSuggestions?: Array<{ name: string; count?: number }>;
}

export const DiagnosisCard: React.FC<DiagnosisCardProps> = ({
  diagnoses,
  onChangeDiagnoses,
  diagnosesCatalog,
  onAddDiagnosisToCatalog,
  frequentSuggestions = [],
}) => {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [showPicker, setShowPicker] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<DiagnosisCatalogItem[]>([]);
  const [, startTransition] = useTransition();
  const abortControllerRef = useRef<AbortController | null>(null);

  // New diagnosis form
  const [newCode, setNewCode] = useState('');
  const [newNameAr, setNewNameAr] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newCategory, setNewCategory] = useState('الجهاز الهضمي');
  const [saveToCatalog, setSaveToCatalog] = useState(true);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Merge clinic catalog & comprehensive ICD-10 Medical Archive
  const combinedCatalog = useMemo(() => {
    const map = new Map<string, DiagnosisCatalogItem>();
    (diagnosesCatalog || []).forEach((d) =>
      map.set(normalizeDrugText(`${d.code}-${d.nameAr}`), { ...d, source: 'catalog' })
    );
    MEDICAL_DIAGNOSES_ARCHIVE.forEach((p) => {
      const key = normalizeDrugText(`${p.code}-${p.nameAr}`);
      if (!map.has(key)) map.set(key, { ...p, source: 'medical-archive' });
    });
    return Array.from(map.values());
  }, [diagnosesCatalog]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const q = query.trim();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!q) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    const localMatches = searchDiagnosesInCatalogAndArchive(q, diagnosesCatalog);
    startTransition(() => {
      setOnlineResults(localMatches);
    });

    if (localMatches.length < 3 && q.length >= 2) {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsSearchingOnline(true);

      fetchOnlineDiagnosesMatches(q, controller.signal)
        .then((remoteMatches) => {
          if (controller.signal.aborted) return;
          const seen = new Set(localMatches.map((m) => normalizeDrugText(m.code || m.nameAr)));
          const uniqueRemote = remoteMatches.filter(
            (r) => !seen.has(normalizeDrugText(r.code || r.nameAr))
          );
          setOnlineResults([...localMatches, ...uniqueRemote]);
          setIsSearchingOnline(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setIsSearchingOnline(false);
          }
        });
    } else {
      setIsSearchingOnline(false);
    }
  };

  const handleAddFromCatalog = (item: DiagnosisCatalogItem) => {
    if (diagnoses.some((d) => d.nameAr === item.nameAr)) return;

    const isFirst = diagnoses.length === 0;
    const newDiag: PatientDiagnosis = {
      id: `diag-sel-${Date.now()}`,
      catalogId: item.id,
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      isPrimary: isFirst,
    };
    onChangeDiagnoses([...diagnoses, newDiag]);
    setSearchQuery('');
    setOnlineResults([]);
  };

  const handleSaveArchiveDiagToCatalog = (e: React.MouseEvent, item: DiagnosisCatalogItem) => {
    e.stopPropagation();
    const alreadyInCatalog = (diagnosesCatalog || []).some(
      (c) => normalizeDrugText(c.nameAr) === normalizeDrugText(item.nameAr)
    );
    if (!alreadyInCatalog) {
      onAddDiagnosisToCatalog({
        ...item,
        id: `diag-cat-${Date.now()}`,
        isFavorite: true,
        active: true,
        source: 'catalog',
      });
    }
  };

  const handleAddNewCustomDiagnosis = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAr = newNameAr.trim();
    if (!trimmedAr) return;

    if (saveToCatalog) {
      onAddDiagnosisToCatalog({
        id: `diag-cat-${Date.now()}`,
        code: newCode.trim() || 'ICD-CUSTOM',
        nameAr: trimmedAr,
        nameEn: newNameEn.trim(),
        category: newCategory,
        isFavorite: true,
      });
    }

    const isFirst = diagnoses.length === 0;
    const newDiag: PatientDiagnosis = {
      id: `diag-sel-${Date.now()}`,
      code: newCode.trim() || undefined,
      nameAr: trimmedAr,
      nameEn: newNameEn.trim() || undefined,
      isPrimary: isFirst,
    };
    onChangeDiagnoses([...diagnoses, newDiag]);

    setNewCode('');
    setNewNameAr('');
    setNewNameEn('');
    setShowAddModal(false);
  };

  const handleSetPrimary = (id: string) => {
    onChangeDiagnoses(
      diagnoses.map((d) => ({
        ...d,
        isPrimary: d.id === id,
      }))
    );
  };

  const handleRemove = (id: string) => {
    const remaining = diagnoses.filter((d) => d.id !== id);
    if (remaining.length > 0 && !remaining.some((d) => d.isPrimary)) {
      remaining[0].isPrimary = true;
    }
    onChangeDiagnoses(remaining);
  };

  const favoriteDiagnoses = diagnosesCatalog.filter((d) => d.isFavorite);

  const filteredCatalog = searchFilter.trim()
    ? searchDiagnosesInCatalogAndArchive(searchFilter, diagnosesCatalog)
    : combinedCatalog;

  const handleQuickAdd = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const matched =
      onlineResults[0] ||
      searchDiagnosesInCatalogAndArchive(trimmed, diagnosesCatalog)[0];
    if (matched) {
      handleAddFromCatalog(matched);
    } else {
      const isFirst = diagnoses.length === 0;
      const newDiag: PatientDiagnosis = {
        id: `diag-sel-${Date.now()}`,
        nameAr: trimmed,
        isPrimary: isFirst,
      };
      onChangeDiagnoses([...diagnoses, newDiag]);
      setSearchQuery('');
      setOnlineResults([]);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">diagnosis</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                {language === 'en' ? 'Clinical Diagnosis (ICD-10)' : 'التشخيص الطبي السريري (ICD-10)'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                {diagnoses.length} {language === 'en' ? (diagnoses.length === 1 ? 'diagnosis' : 'diagnoses') : 'تشخيص'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#859394]">
              {language === 'en'
                ? 'Search by Arabic/English name, ICD-10 code, or medical abbreviation (HTN, DM, GERD, IBS, IHD, UTI...)'
                : 'بحث بالاسم العربي/الإنجليزي أو كود ICD-10 أو الاختصار الطبي (HTN, DM, GERD, IBS, IHD, UTI, COPD...)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 text-amber-700 dark:text-amber-400 text-xs font-bold transition-all cursor-pointer border border-amber-200 dark:border-amber-800/40 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">lists</span>
              <span>{language === 'en' ? '+ Diagnosis Catalog' : '+ اختيار من دليلي'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const selected = combinedCatalog.find((c) => c.id === val);
                  if (selected) {
                    handleAddFromCatalog(selected);
                  }
                  e.target.value = "";
                }}
                className="bg-white dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs font-bold py-1.5 px-3 rounded-xl border-2 border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer min-w-[210px] max-w-[320px] shadow-sm"
              >
                <option value="">{language === 'en' ? '-- Select diagnosis from catalog --' : '-- اضغط لاختيار تشخيص من دليلي --'}</option>
                {diagnosesCatalog.length > 0 && (
                  <optgroup label={language === 'en' ? '★ My Clinic Diagnoses Catalog' : '★ دليل تشخيصات عيادتي (دليلي)'}>
                    {diagnosesCatalog.map((item) => {
                      const isAdded = diagnoses.some((d) => d.nameAr === item.nameAr);
                      return (
                        <option key={item.id} value={item.id} disabled={isAdded}>
                          {isAdded ? '✓ [مضاف] ' : '+ '} {item.nameAr} {item.code ? `[${item.code}]` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                )}
                <optgroup label={language === 'en' ? '🇪🇬 Clinical ICD-10 Archive (Abbreviations)' : '🇪🇬 أرشيف التشخيصات القياسي ICD-10 (بالاختصارات)'}>
                  {combinedCatalog
                    .filter((item) => item.source !== 'catalog')
                    .map((item) => {
                      const isAdded = diagnoses.some((d) => d.nameAr === item.nameAr);
                      const abbrLabel = item.abbreviations?.[0] ? ` (${item.abbreviations[0]})` : '';
                      return (
                        <option key={item.id} value={item.id} disabled={isAdded}>
                          {isAdded ? '✓ [مضاف] ' : '+ '} [{item.code}]{abbrLabel} {item.nameAr}
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

      {/* TOP SEARCH BAR (أعلى بطاقة التشخيص الطبي) */}
      <div className="p-3 bg-amber-50/40 dark:bg-[#080e1b]/80 rounded-2xl border border-amber-500/30 space-y-3 shadow-xs">
        <div className="relative">
          <input
            type="text"
            placeholder={
              language === 'en'
                ? 'Search in My Catalog & ICD-10 Archive by abbreviation (HTN, DM, GERD, IBS, IHD, UTI, COPD, IDA) or Arabic/English...'
                : 'ابحث في دليلي وأرشيف ICD-10 بالاختصار الطبي (HTN, DM, GERD, IBS, IHD, UTI, COPD, IDA, ضغط, سكر, ارتجاع...) أو الاسم...'
            }
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-sm p-3.5 ltr:pl-11 ltr:pr-32 rtl:pr-11 rtl:pl-32 rounded-xl border border-slate-200 dark:border-white/10 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-bold transition-all text-start"
          />
          <span className="material-symbols-outlined absolute ltr:left-3.5 rtl:right-3.5 top-3.5 text-amber-500 text-xl pointer-events-none">
            clinical_notes
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
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>{language === 'en' ? 'Add' : 'إضافة'}</span>
            </button>
          </div>
        </div>

        {/* Live Search Results */}
        {searchQuery.trim() && (
          <div className="p-3 bg-white dark:bg-[#111A2E] rounded-xl border border-amber-500/30 space-y-2.5 animate-in fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#859394] border-b border-slate-100 dark:border-white/5 pb-1.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-amber-500">saved_search</span>
                <span>
                  {language === 'en'
                    ? `Search results in My Catalog & ICD-10 Archive for "${searchQuery}":`
                    : `نتائج البحث في دليلي وأرشيف التشخيصات ICD-10 لـ "${searchQuery}":`}
                </span>
              </span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                {isSearchingOnline
                  ? (language === 'en' ? 'Searching ICD-10...' : 'جاري البحث في أرشيف ICD-10...')
                  : (language === 'en' ? `${onlineResults.length} matching diagnoses` : `${onlineResults.length} تشخيص مطابق`)}
              </span>
            </div>

            {onlineResults.length === 0 && !isSearchingOnline ? (
              <div className="py-4 text-center text-xs text-slate-500 space-y-2">
                <p>
                  {language === 'en'
                    ? `No direct diagnosis found matching "${searchQuery}".`
                    : `لم يتم العثور على تشخيص مطابق لـ "${searchQuery}" في دليلك أو أرشيف ICD-10.`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer shadow-xs hover:bg-amber-400"
                  >
                    + إضافة "{searchQuery.trim()}" كتشخيص مباشر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNameAr(searchQuery.trim());
                      setShowAddModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer hover:bg-slate-200"
                  >
                    + تخصيص وحفظ في دليلي
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                  {onlineResults.map((item) => {
                    const isAdded = diagnoses.some((d) => d.nameAr === item.nameAr);
                    const isFromClinicCatalog =
                      item.source === 'catalog' ||
                      (diagnosesCatalog || []).some(
                        (c) => normalizeDrugText(c.nameAr) === normalizeDrugText(item.nameAr)
                      );

                    return (
                      <div
                        key={item.id}
                        onClick={() => !isAdded && handleAddFromCatalog(item)}
                        className={`p-3 rounded-xl text-start text-xs transition-all flex flex-col justify-between gap-2 border ${
                          isAdded
                            ? 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-400 cursor-not-allowed'
                            : 'bg-slate-50 dark:bg-[#080e1b] hover:border-amber-400 border-slate-200 dark:border-white/5 text-slate-800 dark:text-[#dde2f5] cursor-pointer'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">
                              {item.code}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                                isFromClinicCatalog
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                              }`}
                            >
                              {isFromClinicCatalog
                                ? (language === 'en' ? 'In My Catalog ✓' : 'من دليلي ✓')
                                : (language === 'en' ? 'ICD-10 Archive 🇪🇬' : 'أرشيف ICD-10 🇪🇬')}
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 dark:text-[#dde2f5] leading-snug">
                            {item.nameAr}
                          </div>

                          {item.nameEn && (
                            <span className="text-[10px] text-slate-400 font-mono block truncate" dir="ltr">
                              {item.nameEn}
                            </span>
                          )}

                          {item.abbreviations && item.abbreviations.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              {item.abbreviations.slice(0, 4).map((abbr) => (
                                <span
                                  key={abbr}
                                  className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                                >
                                  {abbr}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200/50 dark:border-white/5">
                          {isAdded ? (
                            <span className="text-[10px] text-emerald-600 font-bold">
                              {language === 'en' ? 'Added to Exam ✓' : 'مضاف بالكشف ✓'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <span className="material-symbols-outlined text-sm">add_circle</span>
                              <span>{language === 'en' ? 'Add to Diagnoses' : 'إضافة التشخيص'}</span>
                            </span>
                          )}

                          {!isFromClinicCatalog && (
                            <button
                              type="button"
                              onClick={(e) => handleSaveArchiveDiagToCatalog(e, item)}
                              className="px-2 py-0.5 rounded-md bg-slate-200/80 hover:bg-amber-500 hover:text-slate-950 dark:bg-white/10 dark:hover:bg-amber-400 dark:hover:text-slate-950 text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              {language === 'en' ? '+ Save to My Catalog' : '+ حفظ بدليلي'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">
                    {language === 'en'
                      ? 'Looking for another clinical diagnosis not listed?'
                      : 'هل تبحث عن تشخيص سريري آخر غير ظاهر؟'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNameAr(searchQuery.trim());
                      setShowAddModal(true);
                    }}
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    {language === 'en'
                      ? `+ Add "${searchQuery.trim()}" as New Diagnosis in My Catalog`
                      : `+ إضافة "${searchQuery.trim()}" كتشخيص جديد في دليلي`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>


      {/* Selected Diagnoses List */}
      {diagnoses.length === 0 ? (
        <div className="py-6 text-center bg-slate-50/50 dark:bg-[#080e1b]/40 rounded-xl border border-dashed border-slate-200 dark:border-white/5">
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl mb-1">
            diagnosis
          </span>
          <p className="text-xs text-slate-500 dark:text-[#859394]">
            {language === 'en'
              ? 'No clinical diagnosis selected yet.'
              : 'لم يتم تحديد أي تشخيص طبي حتى الآن.'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {language === 'en'
              ? 'Select from frequent presets above or click "+ Add Unlisted Diagnosis".'
              : 'اختر من التشخيصات المفضلة أعلاه أو اضغط "+ إضافة تشخيص غير مدرج".'}
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-no-translate="true">
          {diagnoses.map((diag) => (
            <div
              key={diag.id}
              className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                diag.isPrimary
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/50 shadow-xs'
                  : 'bg-slate-50 dark:bg-[#080e1b] border-slate-200 dark:border-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSetPrimary(diag.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    diag.isPrimary
                      ? 'bg-amber-500 text-slate-900 font-bold shadow-xs'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-[#859394] hover:bg-amber-100'
                  }`}
                  title={language === 'en' ? 'Click to set as primary diagnosis' : 'انقر لتعيين كتشخيص رئيسي'}
                >
                  {diag.isPrimary
                    ? (language === 'en' ? 'Primary ★' : 'تشخيص رئيسي ★')
                    : (language === 'en' ? 'Secondary' : 'فرعي')}
                </button>

                <div className="clinical-data" data-no-translate="true">
                  <div className="flex items-center gap-2">
                    {diag.code && (
                      <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                        {diag.code}
                      </span>
                    )}
                    <span
                      data-no-translate="true"
                      className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] no-translate clinical-data"
                    >
                      {language === 'en' && diag.nameEn ? diag.nameEn : diag.nameAr}
                    </span>
                  </div>
                  {(language === 'en' ? (diag.nameEn ? diag.nameAr : undefined) : diag.nameEn) && (
                    <span
                      data-no-translate="true"
                      className="text-[10px] text-slate-400 block font-mono mt-0.5 no-translate clinical-data"
                      dir={language === 'en' ? 'rtl' : 'ltr'}
                    >
                      {language === 'en' ? diag.nameAr : diag.nameEn}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleRemove(diag.id)}
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title={language === 'en' ? 'Delete diagnosis' : 'حذف التشخيص'}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add New Custom Diagnosis */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddNewCustomDiagnosis}
            className="bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">add_circle</span>
                <span>إضافة تشخيص طبي جديد أثناء الكشف</span>
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
              <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">اسم التشخيص (عربي):</label>
              <input
                type="text"
                required
                value={newNameAr}
                onChange={(e) => setNewNameAr(e.target.value)}
                placeholder="مثال: التهاب الأمعاء الدقيقة، قصور كلوي حاد..."
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">كود ICD-10 (إن وجد):</label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="e.g. K52.9"
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">التصنيف:</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none"
                >
                  <option value="الجهاز الهضمي">الجهاز الهضمي</option>
                  <option value="القلب والأوعية">القلب والأوعية</option>
                  <option value="الغدد والسكري">الغدد والسكري</option>
                  <option value="الجهاز التنفسي">الجهاز التنفسي</option>
                  <option value="الكلى والمسالك">الكلى والمسالك</option>
                  <option value="الأعصاب">الأعصاب</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">الاسم الإنجليزي / اللاتيني:</label>
              <input
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="e.g. Non-infective gastroenteritis"
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none font-mono"
                dir="ltr"
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/30">
              <input
                type="checkbox"
                id="saveDiagToCatalog"
                checked={saveToCatalog}
                onChange={(e) => setSaveToCatalog(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 accent-amber-500"
              />
              <label htmlFor="saveDiagToCatalog" className="text-xs text-slate-700 dark:text-[#dde2f5] cursor-pointer">
                ☑ إضافة إلى قائمتي المفضلة (يُحفظ في دليل التشخيصات ليظهر دائماً)
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
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-900 transition-all cursor-pointer"
              >
                إضافة واعتماد التشخيص
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
