import React, { useState, useTransition, useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { RadiologyCatalogItem, RadiologyOrderItem, RadiologyStatus } from '../../types';

interface RadiologyCardProps {
  radiologyOrders: RadiologyOrderItem[];
  onChangeOrders: (orders: RadiologyOrderItem[]) => void;
  radiologyCatalog: RadiologyCatalogItem[];
  onAddRadiologyToCatalog: (item: RadiologyCatalogItem) => void;
  frequentSuggestions?: Array<{ type: string; count?: number }>;
}

// Preset Medical Radiology Scans with abbreviations, English names & category
const RADIOLOGY_PRESETS: (RadiologyCatalogItem & { abbreviations?: string[]; englishName?: string })[] = [
  { id: 'rad-p1', name: 'أشعة سينية على الصدر (CXR)', englishName: 'Chest X-Ray PA View (CXR)', category: 'أشعة عادية (X-Ray)', isFavorite: true, abbreviations: ['CXR', 'Chest Xray', 'Xray', 'صدر', 'أشعة صدر'] },
  { id: 'rad-p2', name: 'موجات صوتية وسونار على البطن والحوض (Abdominal US)', englishName: 'Ultrasound Abdomen & Pelvis', category: 'موجات صوتية (Ultrasound)', isFavorite: true, abbreviations: ['US', 'Sonar', 'Pelvis', 'Abdomen', 'سونار', 'موجات صوتية'] },
  { id: 'rad-p3', name: 'أشعة مقطعية على المخ (Brain CT)', englishName: 'Computed Tomography Brain (CT Brain)', category: 'أشعة مقطعية (CT)', isFavorite: true, abbreviations: ['CT', 'Brain CT', 'Head CT', 'مقطعية', 'مخ'] },
  { id: 'rad-p4', name: 'رنين مغناطيسي على الفقرات القطنية (Lumbar MRI)', englishName: 'MRI Lumbar Spine', category: 'رنين مغناطيسي (MRI)', isFavorite: true, abbreviations: ['MRI', 'Lumbar MRI', 'Spine MRI', 'رنين', 'ظهر', 'فقرات'] },
  { id: 'rad-p5', name: 'موجات صوتية على القلب - إيكو (Echocardiogram)', englishName: 'Echocardiography (Echo)', category: 'موجات صوتية (Ultrasound)', isFavorite: true, abbreviations: ['Echo', 'Echocardiogram', 'إيكو', 'قلب'] },
  { id: 'rad-p6', name: 'موجات صوتية على الكليتين والمسالك (KUB US)', englishName: 'Ultrasound Kidneys, Ureters & Bladder (KUB)', category: 'موجات صوتية (Ultrasound)', isFavorite: false, abbreviations: ['KUB', 'KUB US', 'Renal US', 'كلى', 'مسالك'] },
  { id: 'rad-p7', name: 'ماموجرام وأشعة الثدي (Breast Mammography)', englishName: 'Mammography Breast PA & MLO', category: 'أشعة عادية (X-Ray)', isFavorite: false, abbreviations: ['Mammogram', 'Mammography', 'Breast', 'ماموجرام', 'ثدي'] },
  { id: 'rad-p8', name: 'قياس كثافة العظام - دكسا (DEXA Scan)', englishName: 'Dual-Energy X-Ray Absorptiometry (DEXA)', category: 'أشعة عادية (X-Ray)', isFavorite: false, abbreviations: ['DEXA', 'Bone Density', 'دكسا', 'هشاشة'] },
  { id: 'rad-p9', name: 'دوبلر ملون على أوعية الطرفين (Duplex Ultrasound)', englishName: 'Color Doppler Arterial & Venous', category: 'موجات صوتية وسونار', isFavorite: false, abbreviations: ['Doppler', 'Duplex', 'دوبلر', 'أوردة', 'شرايين'] },
  { id: 'rad-p10', name: 'أشعة مقطعية بالصبغة على البطن والحوض (CT Abdomen with Contrast)', englishName: 'CT Abdomen & Pelvis with IV Contrast', category: 'أشعة مقطعية (CT)', isFavorite: false, abbreviations: ['CT Contrast', 'Contrast', 'صبغة'] },
  { id: 'rad-p11', name: 'موجات صوتية على الغدة الدرقية والرقبة (Thyroid US)', englishName: 'Ultrasound Thyroid & Neck', category: 'موجات صوتية (Ultrasound)', isFavorite: false, abbreviations: ['Thyroid US', 'Neck US', 'درقية'] },
  { id: 'rad-p12', name: 'أشعة سينية على المفصل والفقرات (Bone X-Ray)', englishName: 'X-Ray Knee / Spine / Joint', category: 'أشعة عادية (X-Ray)', isFavorite: false, abbreviations: ['Bone Xray', 'Knee Xray', 'عظام'] },
];

export const RadiologyCard: React.FC<RadiologyCardProps> = ({
  radiologyOrders,
  onChangeOrders,
  radiologyCatalog,
  onAddRadiologyToCatalog,
  frequentSuggestions = [],
}) => {
  const { language } = useLanguage();
  const [showPicker, setShowPicker] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [newScanName, setNewScanName] = useState('');
  const [newScanCategory, setNewScanCategory] = useState('موجات صوتية (Ultrasound)');
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<RadiologyCatalogItem[]>([]);
  const [, startTransition] = useTransition();

  // Combine radiology catalog with presets
  const combinedCatalog = useMemo(() => {
    const map = new Map<string, RadiologyCatalogItem>();
    (radiologyCatalog || []).forEach((c) => map.set(c.name.trim().toLowerCase(), c));
    RADIOLOGY_PRESETS.forEach((p) => {
      const k = p.name.trim().toLowerCase();
      if (!map.has(k)) map.set(k, p);
    });
    return Array.from(map.values());
  }, [radiologyCatalog]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const q = query.trim().toLowerCase();

    if (!q) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);

    startTransition(() => {
      const qClean = q.replace(/[\u064B-\u0652]/g, '');

      const matches = combinedCatalog.filter((item) => {
        const n = (item.name || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const en = ((item as any).englishName || '').toLowerCase();
        const abbrevs = (item as any).abbreviations || [];

        const hasAbbrevMatch = abbrevs.some((ab: string) => ab.toLowerCase().includes(qClean));

        return n.includes(qClean) || cat.includes(qClean) || en.includes(qClean) || hasAbbrevMatch;
      });

      let onlineDynamic: RadiologyCatalogItem[] = [];
      if (matches.length < 2 && qClean.length >= 2) {
        const caps = query.trim().toUpperCase();
        onlineDynamic = [
          {
            id: `rad-online-${Date.now()}`,
            name: `فحص أشعة: ${query.trim()} (مستدعى من دليل التصوير الطبي)`,
            category: 'فحوصات أشعة وتصوير مخصصة',
            isFavorite: false,
          },
        ];
      }

      setOnlineResults([...matches, ...onlineDynamic]);
      setIsSearchingOnline(false);
    });
  };

  // Add existing item from catalog to active patient orders
  const handleAddFromCatalog = (item: RadiologyCatalogItem, directStatus: RadiologyStatus = 'REQUEST') => {
    if (!item || !item.name) return;
    if (radiologyOrders.some((o) => o.name === item.name)) return;

    const newOrder: RadiologyOrderItem = {
      id: `rad-ord-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      radiologyId: item.id,
      name: item.name,
      category: item.category,
      status: directStatus,
      orderedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      resultAt: directStatus !== 'REQUEST' ? new Date().toLocaleDateString('ar-EG') : undefined,
      notes: '',
    };
    onChangeOrders([...radiologyOrders, newOrder]);
    setSearchQuery('');
    setOnlineResults([]);
  };

  // Add completely new custom radiology scan during exam
  const handleAddNewCustomScan = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newScanName.trim();
    if (!trimmed) return;

    // 1. If saveToCatalog checked, add to general catalog
    if (saveToCatalog) {
      onAddRadiologyToCatalog({
        id: `rad-cat-${Date.now()}`,
        name: trimmed,
        category: newScanCategory,
        isFavorite: true,
      });
    }

    // 2. Add directly to patient's active orders with status 'REQUEST'
    const newOrder: RadiologyOrderItem = {
      id: `rad-ord-${Date.now()}`,
      name: trimmed,
      category: newScanCategory,
      status: 'REQUEST',
      orderedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      notes: '',
    };
    onChangeOrders([...radiologyOrders, newOrder]);

    setNewScanName('');
    setShowAddModal(false);
  };

  const handleUpdateOrderStatus = (id: string, newStatus: RadiologyStatus) => {
    onChangeOrders(
      radiologyOrders.map((ord) => {
        if (ord.id === id) {
          return {
            ...ord,
            status: newStatus,
            resultAt: newStatus !== 'REQUEST' && !ord.resultAt ? new Date().toLocaleDateString('ar-EG') : ord.resultAt,
          };
        }
        return ord;
      })
    );
  };

  const handleUpdateOrderField = (id: string, field: 'resultSummary' | 'reportDetails' | 'notes', val: string) => {
    onChangeOrders(
      radiologyOrders.map((ord) => {
        if (ord.id === id) {
          const updated = { ...ord, [field]: val };
          // If typing report or summary while in REQUEST status, auto-promote so it is saved and shown properly
          if (field === 'reportDetails' && val.trim().length > 0) {
            if (ord.status === 'REQUEST') updated.status = 'REPORT';
            if (!updated.resultAt) updated.resultAt = new Date().toLocaleDateString('ar-EG');
          } else if (field === 'resultSummary' && val.trim().length > 0) {
            if (ord.status === 'REQUEST') updated.status = 'RESULT';
            if (!updated.resultAt) updated.resultAt = new Date().toLocaleDateString('ar-EG');
          }
          return updated;
        }
        return ord;
      })
    );
  };

  const handleRemoveOrder = (id: string) => {
    onChangeOrders(radiologyOrders.filter((ord) => ord.id !== id));
  };

  const filteredCatalog = combinedCatalog.filter((item) => {
    if (!item) return false;
    const q = (searchFilter || '').toLowerCase();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  });

  const handleQuickAdd = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const matched = combinedCatalog.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      handleAddFromCatalog(matched, 'REQUEST');
    } else {
      const newOrder: RadiologyOrderItem = {
        id: `rad-ord-${Date.now()}`,
        name: trimmed,
        category: 'أشعة وفحوصات عامة',
        status: 'REQUEST',
        orderedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        notes: '',
      };
      onChangeOrders([...radiologyOrders, newOrder]);
      setSearchQuery('');
      setOnlineResults([]);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-[#38BDF8] flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">radiology</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                {language === 'en' ? 'Radiology & Medical Imaging' : 'الأشعة والتصوير الطبي'}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-[#38BDF8]">
                {radiologyOrders.length} {language === 'en' ? (radiologyOrders.length === 1 ? 'scan' : 'scans') : 'فحص'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-[#859394]">
              {language === 'en'
                ? 'Manage radiology scan orders, record impressions, and clinical findings'
                : 'إدارة طلبات الأشعة، تسجيل النتائج، وكتابة التقارير الطبية'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!showPicker ? (
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-900/30 hover:bg-sky-100 text-sky-700 dark:text-[#38BDF8] text-xs font-bold transition-all cursor-pointer border border-sky-200 dark:border-sky-800/40 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">lists</span>
              <span>{language === 'en' ? '+ Pick from Catalog' : '+ اختيار من دليلي'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 animate-in fade-in">
              <select
                autoFocus
                value=""
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const selected = combinedCatalog.find((c) => c.id === val);
                  if (selected) {
                    handleAddFromCatalog(selected, 'REQUEST');
                  }
                  e.target.value = "";
                }}
                className="bg-white dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs font-bold py-1.5 px-3 rounded-xl border-2 border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer min-w-[210px] max-w-[320px] shadow-sm"
              >
                <option value="">{language === 'en' ? '-- Select scan from catalog --' : '-- اضغط لاختيار فحص من دليلي --'}</option>
                {combinedCatalog.map((item) => {
                  const isAdded = radiologyOrders.some((o) => o.name === item.name);
                  return (
                    <option key={item.id} value={item.id} disabled={isAdded}>
                      {isAdded ? '✓ [مطلوب] ' : '+ '} {item.name} {item.category ? `(${item.category})` : ''}
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

      {/* TOP SEARCH BAR (أعلى بطاقة الأشعة والتصوير الطبي) */}
      <div className="p-3 bg-sky-50/40 dark:bg-[#080e1b]/80 rounded-2xl border border-sky-500/30 space-y-3 shadow-xs">
        <div className="relative">
          <input
            type="text"
            placeholder={
              language === 'en'
                ? 'Search by scan name, abbreviation (CXR, US, CT, MRI, Echo) or type scan and click Add...'
                : 'ابحث بالاسم أو الاختصار (CXR, US, CT, MRI, KUB, Echo) أو اكتب اسم الفحص واضغط إضافة...'
            }
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-sm p-3.5 pr-11 pl-28 rounded-xl border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-bold transition-all"
          />
          <span className="material-symbols-outlined absolute right-3.5 top-3.5 text-sky-600 dark:text-sky-400 text-xl">
            radiology
          </span>

          <div className="absolute left-2 top-2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOnlineResults([]);
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-[#18233C] text-slate-500 dark:text-[#859394] hover:text-rose-500 text-xs font-bold cursor-pointer"
              >
                مسح ✕
              </button>
            )}
            <button
              type="button"
              onClick={handleQuickAdd}
              className="px-2.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>{language === 'en' ? 'Add' : 'إضافة'}</span>
            </button>
          </div>
        </div>

        {/* Live Search Results */}
        {searchQuery.trim() && (
          <div className="p-3 bg-white dark:bg-[#111A2E] rounded-xl border border-sky-500/30 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#859394] border-b border-slate-100 dark:border-white/5 pb-1.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-sky-600 dark:text-sky-400">saved_search</span>
                <span>نتائج البحث لفحوصات الأشعة لـ "{searchQuery}":</span>
              </span>
              <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">
                {isSearchingOnline ? 'جاري الاستعلام...' : `${onlineResults.length} فحص مطايق`}
              </span>
            </div>

            {isSearchingOnline ? (
              <div className="py-4 text-center text-xs text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></span>
                <span>جاري البحث في الفهرس الطبي للأشعة...</span>
              </div>
            ) : onlineResults.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 space-y-2">
                <p>لم يتم العثور على فحص مباشر يطابق "{searchQuery}".</p>
                <button
                  type="button"
                  onClick={() => {
                    setNewScanName(searchQuery);
                    setShowAddModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer shadow-xs hover:bg-sky-400"
                >
                  + إضافته كفحص أشعة جديد وتوثيقه
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                {onlineResults.map((item) => {
                  const isAdded = radiologyOrders.some((o) => o.name === item.name);
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl text-right text-xs transition-all flex flex-col justify-between gap-2 border ${
                        isAdded
                          ? 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-400'
                          : 'bg-slate-50 dark:bg-[#080e1b] border-slate-200 dark:border-white/5 text-slate-800 dark:text-[#dde2f5]'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="font-bold flex items-center justify-between text-slate-900 dark:text-[#dde2f5]">
                          <span>{item.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-mono">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      {isAdded ? (
                        <div className="text-[11px] text-emerald-600 font-bold self-end pt-1">
                          مطلوب بالروشتة ✓
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => handleAddFromCatalog(item, 'REQUEST')}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">add</span>
                            <span>طلب الفحص</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddFromCatalog(item, 'REPORT')}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">description</span>
                            <span>كتابة التقرير</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>


      {/* Active Radiology Orders List */}
      {radiologyOrders.length === 0 ? (
        <div className="py-8 text-center bg-slate-50/50 dark:bg-[#080e1b]/40 rounded-xl border border-dashed border-slate-200 dark:border-white/5">
          <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-3xl mb-1">
            radiology
          </span>
          <p className="text-xs text-slate-500 dark:text-[#859394]">
            {language === 'en'
              ? 'No radiology scans ordered yet for this examination.'
              : 'لم يتم طلب أي فحوصات أشعة حتى الآن في هذا الكشف.'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {language === 'en'
              ? 'Click "+ Pick from Catalog" or "+ Add New Scan" to order imaging or log reports.'
              : 'انقر "+ اختيار من دليلي" أو "+ إضافة نوع جديد" لطلب أشعة أو تسجيل تقريرها فوراً.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-no-translate="true">
          {radiologyOrders.map((ord) => (
            <div
              key={ord.id}
              className="bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-200 dark:border-white/5 p-3.5 space-y-3"
            >
              {/* Top Row: Name + Category + Status Select + Remove */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                  <div className="clinical-data" data-no-translate="true">
                    <span
                      data-no-translate="true"
                      className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] no-translate clinical-data"
                    >
                      {ord.name}
                    </span>
                    <span
                      data-no-translate="true"
                      className="text-[10px] text-slate-500 dark:text-[#859394] mr-2 px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-white/5 no-translate clinical-data"
                    >
                      {ord.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 dark:text-[#859394]">
                      {language === 'en' ? 'Status:' : 'الحالة:'}
                    </span>
                    <select
                      value={ord.status}
                      onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value as RadiologyStatus)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer focus:outline-none transition-all ${
                        ord.status === 'REQUEST'
                          ? 'bg-sky-50 dark:bg-cyan-950/50 text-sky-800 dark:text-cyan-300 border-sky-300 dark:border-cyan-700/60'
                          : ord.status === 'RESULT'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-[#10B981] border-emerald-300 dark:border-emerald-700/50'
                          : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700/50'
                      }`}
                    >
                      <option value="REQUEST" className="bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5]">
                        {language === 'en' ? 'Order (REQUEST)' : 'طلب (REQUEST)'}
                      </option>
                      <option value="RESULT" className="bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5]">
                        {language === 'en' ? 'Result (RESULT)' : 'نتيجة (RESULT)'}
                      </option>
                      <option value="REPORT" className="bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5]">
                        {language === 'en' ? 'Report (REPORT)' : 'تقرير (REPORT)'}
                      </option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveOrder(ord.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    title={language === 'en' ? 'Remove scan' : 'حذف من الكشف'}
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>

              {/* Dynamic State Details: If RESULT */}
              {ord.status === 'RESULT' && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/5 flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <span className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] whitespace-nowrap">
                    {language === 'en' ? 'Clinical Result Summary:' : 'ملخص النتيجة السريرية:'}
                  </span>
                  <input
                    type="text"
                    data-no-translate="true"
                    value={ord.resultSummary || ''}
                    onChange={(e) => handleUpdateOrderField(ord.id, 'resultSummary', e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'e.g. Normal scan, no DVT or aneurysms observed...'
                        : 'مثال: فحص سليم طبيعي، لا توجد جلطات DVT أو توسعات شريانية...'
                    }
                    className="flex-1 w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-xs p-2 rounded-lg border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-emerald-500 no-translate clinical-data"
                  />
                </div>
              )}

              {/* Dynamic State Details: If REPORT */}
              {ord.status === 'REPORT' && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-[#dde2f5]">
                    <span>
                      {language === 'en'
                        ? 'Detailed Radiology Report (Findings & Impression):'
                        : 'نص التقرير الإشعاعي المفصل (Radiological Findings & Impression):'}
                    </span>
                    <span className="text-[10px] text-sky-600 font-mono">
                      {language === 'en' ? 'Imaging Record' : 'سجل الأشعة الطبي'}
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    data-no-translate="true"
                    value={ord.reportDetails || ''}
                    onChange={(e) => handleUpdateOrderField(ord.id, 'reportDetails', e.target.value)}
                    placeholder="Findings: Normal cardiac silhouette, clear lung fields, no pleural effusion. Impression: Clear chest."
                    className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-lg border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-sky-500 leading-relaxed resize-none no-translate clinical-data"
                  />
                </div>
              )}

              {/* Clinical note for 'REQUEST' status */}
              {ord.status === 'REQUEST' && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-[#859394]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-xs text-amber-500">schedule</span>
                      <span>
                        {language === 'en' ? `Order logged (${ord.orderedAt})` : `طلب فحص جديد (${ord.orderedAt})`}
                      </span>
                    </div>
                    <span className="text-xs text-sky-600 dark:text-[#38BDF8] font-semibold">
                      {language === 'en' ? 'Or write report/result now:' : 'أو اكتب التقرير/النتيجة الآن:'}
                    </span>
                  </div>
                  <input
                    type="text"
                    data-no-translate="true"
                    value={ord.reportDetails || ord.resultSummary || ''}
                    onChange={(e) => handleUpdateOrderField(ord.id, 'reportDetails', e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'e.g. Chest X-Ray: Normal cardiothoracic ratio, clear costophrenic angles...'
                        : 'مثال: تقرير أشعة الصدر: الصدر سليم ولا توجد ارتشاحات رئوية...'
                    }
                    className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-lg border border-amber-300 dark:border-amber-700/50 focus:outline-none focus:ring-1 focus:ring-sky-500 no-translate clinical-data"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add New Radiology Scan */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddNewCustomScan}
            className="bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-600">radiology</span>
                <span>إضافة نوع فحص أشعة جديد أثناء الكشف</span>
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
              <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">اسم فحص الأشعة:</label>
              <input
                type="text"
                required
                value={newScanName}
                onChange={(e) => setNewScanName(e.target.value)}
                placeholder="مثال: دوبلر شرايين الطرف السفلي، إيكو بالمجهود الدوائي..."
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-[#859394] block mb-1">تصنيف الأشعة والتصوير:</label>
              <select
                value={newScanCategory}
                onChange={(e) => setNewScanCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none cursor-pointer"
              >
                <option value="دوبلر ملون (Doppler)">دوبلر ملون (Doppler)</option>
                <option value="موجات صوتية (Ultrasound)">موجات صوتية (Ultrasound)</option>
                <option value="أشعة سينية (X-Ray)">أشعة سينية (X-Ray)</option>
                <option value="أشعة مقطعية (CT)">أشعة مقطعية (CT)</option>
                <option value="رنين مغناطيسي (MRI)">رنين مغناطيسي (MRI)</option>
                <option value="فسيولوجيا القلب">فسيولوجيا القلب ورسم قلب</option>
              </select>
            </div>

            <div className="flex items-center gap-2 p-3 bg-sky-50/60 dark:bg-sky-950/20 rounded-xl border border-sky-200 dark:border-sky-800/30">
              <input
                type="checkbox"
                id="saveRadToCatalog"
                checked={saveToCatalog}
                onChange={(e) => setSaveToCatalog(e.target.checked)}
                className="w-4 h-4 rounded text-[#00c2cb] accent-[#00c2cb]"
              />
              <label htmlFor="saveRadToCatalog" className="text-xs text-slate-700 dark:text-[#dde2f5] cursor-pointer">
                ☑ إضافة إلى قائمتي المفضلة (يُحفظ في دليل الأشعة ليظهر في كل الكشوفات القادمة)
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
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-all cursor-pointer"
              >
                إضافة وطلب الفحص
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
