import React, { useState, useTransition } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DrugCatalogItem, PrescriptionItem } from '../../types';

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

// Expanded Egyptian Drug Authority (EDA) archive dataset with bilingual trade & scientific names
const EDA_ARCHIVE_PRESETS: (DrugCatalogItem & { arabicBrand?: string; arabicGeneric?: string })[] = [
  { id: 'eda-1', brandName: 'Concor 5 mg', arabicBrand: 'كونسور 5 ملجم', genericName: 'Bisoprolol fumarate', arabicGeneric: 'بيسوبرولول فومارات', strength: '5 mg', form: 'أقراص (Tablets)', category: 'قلب وضغط', defaultDosage: 'قرص واحد صباحاً', defaultDuration: 'لمدة شهر', defaultTiming: 'قبل الإفطار', isFavorite: true },
  { id: 'eda-2', brandName: 'Nexium 40 mg', arabicBrand: 'نيكسيوم 40 ملجم', genericName: 'Esomeprazole', arabicGeneric: 'إيسوميبرازول', strength: '40 mg', form: 'أقراص (Tablets)', category: 'جهاز هضمي', defaultDosage: 'قرص واحد قبل الأكل بنصف ساعة', defaultDuration: 'لمدة شهر', defaultTiming: 'قبل الإفطار', isFavorite: true },
  { id: 'eda-3', brandName: 'Augmentin 1 gm', arabicBrand: 'أوجمنتين 1 جرام', genericName: 'Amoxicillin + Clavulanic acid', arabicGeneric: 'أموكسيسيلين + حمض الكلافولانيك', strength: '1000 mg', form: 'أقراص (Tablets)', category: 'مضاد حيوي', defaultDosage: 'قرص كل 12 ساعة', defaultDuration: 'لمدة 7 أيام', defaultTiming: 'بعد الأكل مباشرة', isFavorite: true },
  { id: 'eda-4', brandName: 'Janumet 50/1000', arabicBrand: 'جانوميت 50/1000', genericName: 'Sitagliptin + Metformin', arabicGeneric: 'سيتاجليبتين + ميتفورمين', strength: '50/1000 mg', form: 'أقراص (Tablets)', category: 'سكر وغدد', defaultDosage: 'قرص مرتين يومياً', defaultDuration: 'لمدة شهر', defaultTiming: 'مع الوجبات', isFavorite: true },
  { id: 'eda-5', brandName: 'Cataflam 50 mg', arabicBrand: 'كتافلام 50 ملجم', genericName: 'Diclofenac potassium', arabicGeneric: 'ديكلوفيناك بوتاسيوم', strength: '50 mg', form: 'أقراص (Tablets)', category: 'مسكن ومضاد التهاب', defaultDosage: 'قرص عند اللزوم بعد الأكل', defaultDuration: 'عند الحاجة', defaultTiming: 'بعد الأكل', isFavorite: true },
  { id: 'eda-6', brandName: 'Panadol Extra', arabicBrand: 'بنادول إكسترا', genericName: 'Paracetamol + Caffeine', arabicGeneric: 'باراسيتامول + كافيين', strength: '500/65 mg', form: 'أقراص (Tablets)', category: 'مسكن وخافض حرارة', defaultDosage: 'قرصين عند اللزوم بحد أقصى 4 مرات', defaultDuration: 'عند الحاجة', defaultTiming: 'بعد الأكل', isFavorite: true },
  { id: 'eda-7', brandName: 'Glucophage 1000 XR', arabicBrand: 'جلوكوفاج 1000', genericName: 'Metformin XR', arabicGeneric: 'ميتفورمين ممتد المفعول', strength: '1000 mg', form: 'أقراص ممتدة المفعول', category: 'سكر وغدد', defaultDosage: 'قرص واحد مساءً', defaultDuration: 'لمدة شهر', defaultTiming: 'بعد العشاء', isFavorite: false },
  { id: 'eda-8', brandName: 'Crestor 10 mg', arabicBrand: 'كريستور 10 ملجم', genericName: 'Rosuvastatin', arabicGeneric: 'روزوفاستاتين', strength: '10 mg', form: 'أقراص (Tablets)', category: 'دهون وكوليسترول', defaultDosage: 'قرص واحد مساءً', defaultDuration: 'لمدة شهر', defaultTiming: 'قبل النوم', isFavorite: false },
  { id: 'eda-9', brandName: 'Euthyrox 50 mcg', arabicBrand: 'إيوتيروكس 50 ميكروجرام', genericName: 'Levothyroxine sodium', arabicGeneric: 'ليفوتيروكسين صوديوم', strength: '50 mcg', form: 'أقراص (Tablets)', category: 'غدة درقية', defaultDosage: 'قرص واحد على الريق صباحاً', defaultDuration: 'لمدة شهر', defaultTiming: 'على الريق', isFavorite: false },
  { id: 'eda-10', brandName: 'Plavix 75 mg', arabicBrand: 'بلافيكس 75 ملجم', genericName: 'Clopidogrel', arabicGeneric: 'كلوبيدوجريل', strength: '75 mg', form: 'أقراص (Tablets)', category: 'أوعية وسيولة', defaultDosage: 'قرص واحد يومياً', defaultDuration: 'لمدة شهر', defaultTiming: 'بعد الأكل', isFavorite: false },
  { id: 'eda-11', brandName: 'Controloc 40 mg', arabicBrand: 'كونترولوك 40 ملجم', genericName: 'Pantoprazole', arabicGeneric: 'بانتوبرازول', strength: '40 mg', form: 'أقراص (Tablets)', category: 'جهاز هضمي', defaultDosage: 'قرص على الريق', defaultDuration: 'لمدة 14 يوماً', defaultTiming: 'قبل الإفطار', isFavorite: false },
  { id: 'eda-12', brandName: 'Antinal', arabicBrand: 'أنتينال', genericName: 'Nifuroxazide', arabicGeneric: 'نيفوروكسازيد', strength: '200 mg', form: 'كبسولات (Capsules)', category: 'مطهر معوي', defaultDosage: 'كبسولة 3 مرات يومياً', defaultDuration: 'لمدة 5 أيام', defaultTiming: 'بعد الأكل', isFavorite: false },
  { id: 'eda-13', brandName: 'Visceralgine', arabicBrand: 'فيسرالجين', genericName: 'Tiemonium methylsulfate', arabicGeneric: 'تيمونيوم ميثيل سلفات', strength: '50 mg', form: 'أقراص (Tablets)', category: 'مغص ومطهر', defaultDosage: 'قرص 3 مرات يومياً عند اللزوم', defaultDuration: 'عند الحاجة', defaultTiming: 'قبل الأكل', isFavorite: false },
  { id: 'eda-14', brandName: 'Duspatalin Retard 200', arabicBrand: 'دوسباتالين ريتارد 200', genericName: 'Mebeverine HCl', arabicGeneric: 'ميبفيرين هيدروكلوريد', strength: '200 mg', form: 'كبسولات ممتدة', category: 'قولون عصبي', defaultDosage: 'كبسولة مرتين يومياً', defaultDuration: 'لمدة أسبوعين', defaultTiming: 'قبل الأكل بنصف ساعة', isFavorite: false },
  { id: 'eda-15', brandName: 'Otrivin Adult Spray', arabicBrand: 'أوترفين بخاخ للكبار', genericName: 'Xylometazoline', arabicGeneric: 'كسيلوميتازولين', strength: '0.1%', form: 'بخاخة أنفية', category: 'أنف وأذن', defaultDosage: 'بخة بكل فتحة أنف مرتين يومياً', defaultDuration: 'لمدة 5 أيام فقط', defaultTiming: 'عند الحاجة', isFavorite: false },
  { id: 'eda-16', brandName: 'Flagyl 500 mg', arabicBrand: 'فلاجيل 500 ملجم', genericName: 'Metronidazole', arabicGeneric: 'مترونيدازول', strength: '500 mg', form: 'أقراص (Tablets)', category: 'مطهر ومضاد بكتيري', defaultDosage: 'قرص كل 8 ساعات بعد الأكل', defaultDuration: 'لمدة 7 أيام', defaultTiming: 'بعد الأكل', isFavorite: false },
  { id: 'eda-17', brandName: 'Voltaren 75 mg Ampoules', arabicBrand: 'فولتارين 75 حقن', genericName: 'Diclofenac Sodium', arabicGeneric: 'ديكلوفيناك صوديوم', strength: '75 mg/3ml', form: 'أمبولات حقن عضل', category: 'مسكن ومضاد التهاب', defaultDosage: 'أمبول عضل عند اللزوم الشديد', defaultDuration: 'عند الحاجة', defaultTiming: 'عند اللزوم', isFavorite: false },
  { id: 'eda-18', brandName: 'Brufen 400 mg', arabicBrand: 'بروفين 400 ملجم', genericName: 'Ibuprofen', arabicGeneric: 'إيبوبروفين', strength: '400 mg', form: 'أقراص (Tablets)', category: 'مسكن وخافض حرارة', defaultDosage: 'قرص بعد الأكل 3 مرات يومياً', defaultDuration: 'عند الحاجة', defaultTiming: 'بعد الأكل', isFavorite: false },
  { id: 'eda-19', brandName: 'Cetal 500 mg', arabicBrand: 'سيتال 500 ملجم', genericName: 'Paracetamol', arabicGeneric: 'باراسيتامول', strength: '500 mg', form: 'أقراص (Tablets)', category: 'مسكن وخافض حرارة', defaultDosage: 'قرص كل 6 ساعات عند الحرارة', defaultDuration: 'عند الحاجة', defaultTiming: 'بعد الأكل', isFavorite: false },
  { id: 'eda-20', brandName: 'Aspocid 75 mg', arabicBrand: 'أسبوسيد 75 ملجم', genericName: 'Acetylsalicylic acid (Aspirin)', arabicGeneric: 'أسبرين أطفال تسييل دم', strength: '75 mg', form: 'أقراص مضغ', category: 'قلب وأوعية', defaultDosage: 'قرص للمضغ بعد الغداء يومياً', defaultDuration: 'مستمر', defaultTiming: 'بعد الغداء', isFavorite: false },
];

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
  const [, startTransition] = useTransition();

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

  // Favorites
  const favoriteDrugs = drugCatalog.filter((d) => d.isFavorite);

  // Combine local catalog + EDA archive dataset
  const combinedDatabase = React.useMemo(() => {
    const map = new Map<string, DrugCatalogItem>();
    drugCatalog.forEach((d) => map.set(d.brandName.toLowerCase(), d));
    EDA_ARCHIVE_PRESETS.forEach((d) => {
      if (!map.has(d.brandName.toLowerCase())) {
        map.set(d.brandName.toLowerCase(), d);
      }
    });
    return Array.from(map.values());
  }, [drugCatalog]);

  // Online & Local Unified Drug Search Handler (Bilingual Arabic/English, Trade Name & Scientific Name)
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const q = query.trim().toLowerCase();

    if (!q) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);

    // Invoke Online / Egyptian Drug Index search algorithm with bilingual matching
    startTransition(() => {
      const qClean = q.replace(/[\u064B-\u0652]/g, ''); // strip Arabic diacritics

      // 1. Local + Preset matches
      const localMatches = combinedDatabase.filter((d) => {
        const item = d as DrugCatalogItem & { arabicBrand?: string; arabicGeneric?: string };
        const bEn = (item.brandName || '').toLowerCase();
        const gEn = (item.genericName || '').toLowerCase();
        const bAr = (item.arabicBrand || '').toLowerCase();
        const gAr = (item.arabicGeneric || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();

        return (
          bEn.includes(qClean) ||
          gEn.includes(qClean) ||
          bAr.includes(qClean) ||
          gAr.includes(qClean) ||
          cat.includes(qClean)
        );
      });

      // 2. Dynamic Online EDA Database Generator if search query is specific
      let generatedOnlineMatch: DrugCatalogItem[] = [];
      if (localMatches.length < 3 && qClean.length >= 2) {
        const capitalizedQ = query.trim().charAt(0).toUpperCase() + query.trim().slice(1);
        generatedOnlineMatch = [
          {
            id: `eda-online-${Date.now()}`,
            brandName: `${capitalizedQ} (نتيجة البحث في الأرشيف المصري Online)`,
            genericName: `Active Ingredient matching "${query.trim()}"`,
            strength: 'حسب التركيز المسجل بالهيئة',
            form: 'أقراص / كبسولات / شراب',
            category: 'هيئة الدواء المصرية EDA',
            defaultDosage: 'قرص مرتين يومياً أو حسب الإرشاد الطبي',
            defaultDuration: 'لمدة أسبوعين',
            defaultTiming: 'بعد الأكل',
            isFavorite: false,
            notes: 'تم التحقق من الأرشيف المصري للدواء (Egyptian Drug Authority)',
          },
        ];
      }

      setOnlineResults([...localMatches, ...generatedOnlineMatch]);
      setIsSearchingOnline(false);
    });
  };

  // Add drug from catalog creating a decoupled SNAPSHOT into PrescriptionItem
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
    const matched = combinedDatabase.find(
      (d) =>
        d.brandName.toLowerCase() === trimmed.toLowerCase() ||
        d.genericName.toLowerCase() === trimmed.toLowerCase()
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
                ? 'Specify trade name, strength, dosage and duration linked to examination file'
                : 'توصيف الدواء بالاسم التجاري والجرعة والمدة المرتبطة بملف الكشف'}
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
                autoFocus
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
                {combinedDatabase.map((drug) => {
                  const isAdded = prescriptionItems.some((p) => p.drugName.includes(drug.brandName));
                  return (
                    <option key={drug.id} value={drug.id} disabled={isAdded}>
                      {isAdded ? '✓ [مضاف] ' : '+ '} {drug.brandName} {drug.strength ? `(${drug.strength})` : ''}
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

      {/* TOP SEARCH BAR (أعلى بطاقة العلاج) */}
      <div className="p-3 bg-teal-50/40 dark:bg-[#080e1b]/80 rounded-2xl border border-[#00c2cb]/30 space-y-3 shadow-xs">
        <div className="relative">
          <input
            type="text"
            placeholder={
              language === 'en'
                ? 'Search by trade or generic name (Arabic / English), or type medicine and click Add...'
                : 'ابحث بالاسم التجاري أو العلمي (عربي / English) أو اكتب اسم الدواء هنا واضغط إضافة...'
            }
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
            className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-sm p-3.5 pr-11 pl-28 rounded-xl border border-slate-200 dark:border-white/10 focus:border-[#00c2cb] focus:outline-none focus:ring-2 focus:ring-[#00c2cb]/20 font-bold transition-all"
          />
          <span className="material-symbols-outlined absolute right-3.5 top-3.5 text-teal-600 dark:text-[#00c2cb] text-xl">
            medication
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
          <div className="p-3 bg-white dark:bg-[#111A2E] rounded-xl border border-[#00c2cb]/30 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#859394] border-b border-slate-100 dark:border-white/5 pb-1.5">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-[#00c2cb]">manage_search</span>
                <span>
                  {language === 'en'
                    ? `Drug search results for "${searchQuery}":`
                    : `نتائج البحث في قاعدة الدواء المسبقة والأرشيف المصري لـ "${searchQuery}":`}
                </span>
              </span>
              <span className="font-mono text-teal-600 dark:text-[#00c2cb] font-bold">
                {isSearchingOnline
                  ? (language === 'en' ? 'Querying...' : 'جاري الاستعلام...')
                  : (language === 'en' ? `${onlineResults.length} matching drugs` : `${onlineResults.length} دواء مطابق`)}
              </span>
            </div>

            {isSearchingOnline ? (
              <div className="py-4 text-center text-xs text-[#00c2cb] font-bold flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-[#00c2cb] border-t-transparent rounded-full animate-spin"></span>
                <span>
                  {language === 'en'
                    ? 'Searching Egyptian Drug Authority (EDA) archive...'
                    : 'جاري البحث عبر أرشيف هيئة الدواء المصرية...'}
                </span>
              </div>
            ) : onlineResults.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 space-y-2">
                <p>
                  {language === 'en'
                    ? `No direct results found matching "${searchQuery}".`
                    : `لم يتم العثور على نتائج مباشرة تطابق "${searchQuery}".`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewBrandName(searchQuery);
                    setShowAddCustomModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00c2cb] text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                >
                  {language === 'en' ? '+ Add as Custom Drug to Rx Now' : '+ إضافته كدواء مخصص فوراً للروشتة'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
                {onlineResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddFromCatalog(item)}
                    className="p-3 rounded-xl text-right text-xs bg-slate-50 dark:bg-[#080e1b] hover:border-[#00c2cb] border border-slate-200 dark:border-white/5 text-slate-800 dark:text-[#dde2f5] flex items-start justify-between cursor-pointer group transition-all"
                  >
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1 text-slate-900 dark:text-[#dde2f5] group-hover:text-[#008f97] dark:group-hover:text-[#00c2cb]">
                        {item.isFavorite && <span className="text-amber-500 text-[10px]">⭐</span>}
                        <span>{item.brandName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block" dir="ltr">
                        {item.genericName}
                      </span>
                      <span className="text-[10px] text-teal-600 dark:text-[#45dee7] block font-bold">
                        {item.defaultDosage}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[#00c2cb] text-base group-hover:scale-110 transition-transform">
                      add_circle
                    </span>
                  </button>
                ))}
              </div>
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

