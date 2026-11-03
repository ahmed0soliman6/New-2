import {
  LabCatalogItem,
  RadiologyCatalogItem,
  DiagnosisCatalogItem,
} from '../types';
import {
  normalizeDrugText,
  toPhoneticSkeleton,
  toConsonantSkeleton,
} from './egyptianDrugArchive';

// ============================================================================
// 1. COMPREHENSIVE LABORATORY ARCHIVE (الأرشيف المعملي المصري والعالمي)
//    Includes Arabic & English names, standard medical abbreviations, and
//    Arabic phonetic abbreviations (مثال: CBC / سي بي سي, HbA1c / تراكمي, CRP / سي ار بي)
// ============================================================================
export const MEDICAL_LAB_ARCHIVE: LabCatalogItem[] = [
  // --- أمراض الدم (Hematology) ---
  {
    id: 'arch-lab-1',
    name: 'صورة دم كاملة بالتفصيل (CBC with Differential)',
    englishName: 'Complete Blood Count with Differential',
    code: 'CBC',
    abbreviations: ['CBC', 'FBC', 'HB', 'HGB', 'WBC', 'PLT', 'سي بي سي', 'صورة دم', 'هيموجلوبين', 'انيميا'],
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي EDTA',
    fastingRequired: false,
    referenceRange: 'Hb: 13-17 g/dL (M), 12-15 g/dL (F) | WBC: 4-11 ×10³/µL | PLT: 150-450 ×10³/µL',
    unit: 'g/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-2',
    name: 'سرعة الترسيب في الدم (ESR - Erythrocyte Sedimentation Rate)',
    englishName: 'Erythrocyte Sedimentation Rate (ESR)',
    code: 'ESR',
    abbreviations: ['ESR', 'SED RATE', 'اي اس ار', 'سرعة ترسيب', 'ترسيب'],
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي Citrate/EDTA',
    fastingRequired: false,
    referenceRange: 'Men < 15 mm/hr, Women < 20 mm/hr',
    unit: 'mm/hr',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-3',
    name: 'عدد الخلايا الشبكية (Reticulocyte Count)',
    englishName: 'Reticulocyte Count (Retics)',
    code: 'RETIC',
    abbreviations: ['RETIC', 'RETICS', 'خلايا شبكية', 'ريتيك'],
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي EDTA',
    fastingRequired: false,
    referenceRange: '0.5 - 2.5 %',
    unit: '%',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-4',
    name: 'فصيلة الدم وعامل ريسس (ABO & Rh Blood Grouping)',
    englishName: 'ABO Blood Group & Rh Typing',
    code: 'ABO-RH',
    abbreviations: ['ABO', 'RH', 'BLOOD GROUP', 'فصيلة الدم', 'ار اتش'],
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي EDTA',
    fastingRequired: false,
    referenceRange: 'A / B / AB / O (± Rh)',
    unit: '',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-5',
    name: 'فصل كهربائي للهيموجلوبين (Hb Electrophoresis)',
    englishName: 'Hemoglobin Electrophoresis',
    code: 'HB-EP',
    abbreviations: ['HBEP', 'HB ELECTROPHORESIS', 'THALASSEMIA', 'انيميا البحر المتوسط', 'تلاسيميا', 'فصل الهيموجلوبين'],
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي EDTA',
    fastingRequired: false,
    referenceRange: 'HbA1: 95-98%, HbA2: 1.5-3.5%, HbF < 2%',
    unit: '%',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-6',
    name: 'إنزيم أنيميا الفول (G6PD Quantitative Assay)',
    englishName: 'Glucose-6-Phosphate Dehydrogenase (G6PD)',
    code: 'G6PD',
    abbreviations: ['G6PD', 'FAVISM', 'انيميا الفول', 'جي 6 بي دي'],
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي EDTA',
    fastingRequired: false,
    referenceRange: '7.0 - 20.5 U/g Hb',
    unit: 'U/g Hb',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- السيولة والتجلط (Coagulation) ---
  {
    id: 'arch-lab-7',
    name: 'زمن وسرعة النزف والتجلط (PT, PC & INR)',
    englishName: 'Prothrombin Time & International Normalized Ratio',
    code: 'PT-INR',
    abbreviations: ['PT', 'INR', 'PC', 'PROTHROMBIN', 'سيولة الدم', 'بي تي', 'اي ان ار', 'ماريفان'],
    category: 'السيولة والتجلط (Coagulation)',
    sampleType: 'دم وريدي Sodium Citrate',
    fastingRequired: false,
    referenceRange: 'INR: 0.8 - 1.2 (Therapeutic: 2.0 - 3.0)',
    unit: 'Ratio',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-8',
    name: 'زمن الثرومبوبلاستين الجزئي المنشط (aPTT / PTT)',
    englishName: 'Activated Partial Thromboplastin Time (aPTT)',
    code: 'APTT',
    abbreviations: ['APTT', 'PTT', 'بي تي تي', 'هيبارين', 'تجلط'],
    category: 'السيولة والتجلط (Coagulation)',
    sampleType: 'دم وريدي Sodium Citrate',
    fastingRequired: false,
    referenceRange: '25 - 35 seconds',
    unit: 'sec',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-9',
    name: 'تحليل دي دايمر للجلطات (D-Dimer Quantitative)',
    englishName: 'D-Dimer Quantitative Assay',
    code: 'D-DIMER',
    abbreviations: ['DDIMER', 'D-DIMER', 'FDPS', 'دي دايمر', 'جلطات'],
    category: 'السيولة والتجلط (Coagulation)',
    sampleType: 'دم وريدي Sodium Citrate',
    fastingRequired: false,
    referenceRange: '< 0.50 µg/mL FEU (< 500 ng/mL)',
    unit: 'ng/mL',
    isFavorite: true,
    source: 'medical-archive',
  },

  // --- السكري والأيض (Diabetes & Glucose) ---
  {
    id: 'arch-lab-10',
    name: 'السكر التراكمي بالدم (HbA1c - Glycated Hemoglobin)',
    englishName: 'Glycated Hemoglobin (HbA1c)',
    code: 'HBA1C',
    abbreviations: ['HBA1C', 'A1C', 'HA1C', 'تراكمي', 'سكر تراكمي', 'اتش بي ايه ون سي', 'هيموجلوبين سكري'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة دم وريدي EDTA',
    fastingRequired: false,
    referenceRange: 'Normal < 5.7% | Pre-DM: 5.7-6.4% | DM >= 6.5%',
    unit: '%',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-11',
    name: 'سكر صائم في الدم (FBS - Fasting Blood Sugar)',
    englishName: 'Fasting Blood Glucose (FBS / FPG)',
    code: 'FBS',
    abbreviations: ['FBS', 'FPG', 'FBG', 'سكر صائم', 'اف بي اس', 'جلوكوز صائم'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'دم وريدي Fluoride/Serum (صيام 8 ساعات)',
    fastingRequired: true,
    referenceRange: '70 - 99 mg/dL (Pre-DM: 100-125, DM >= 126)',
    unit: 'mg/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-12',
    name: 'سكر فاطر بعد الأكل بساعتين (2hr PPBS)',
    englishName: '2-Hour Postprandial Blood Glucose (2h PPBS)',
    code: 'PPBS',
    abbreviations: ['PPBS', '2HPP', 'PPG', 'سكر فاطر', 'بعد الاكل بساعتين', 'بي بي بي اس'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'دم وريدي بعد الأكل بساعتين',
    fastingRequired: false,
    referenceRange: '< 140 mg/dL (Pre-DM: 140-199, DM >= 200)',
    unit: 'mg/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-13',
    name: 'سكر عشوائي بالدم (RBS - Random Blood Sugar)',
    englishName: 'Random Blood Glucose (RBS / RBG)',
    code: 'RBS',
    abbreviations: ['RBS', 'RBG', 'سكر عشوائي', 'ار بي اس'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'دم وريدي أو شعيري',
    fastingRequired: false,
    referenceRange: '80 - 140 mg/dL (DM >= 200 with symptoms)',
    unit: 'mg/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-14',
    name: 'مقاومة الإنسولين والإنسولين الصائم (HOMA-IR & Fasting Insulin)',
    englishName: 'HOMA-IR & Fasting Serum Insulin',
    code: 'HOMA-IR',
    abbreviations: ['HOMAIR', 'HOMA-IR', 'INSULIN', 'مقاومة الانسولين', 'انسولين صائم', 'هوما'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'مصل دم (صيام 8-10 ساعات)',
    fastingRequired: true,
    referenceRange: 'HOMA-IR < 2.0 | Fasting Insulin: 2.6 - 24.9 µIU/mL',
    unit: 'Index',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- وظائف الكلى والأملاح (Renal Function & Electrolytes) ---
  {
    id: 'arch-lab-15',
    name: 'وظائف الكلى كاملة (KFT: Creatinine, Urea, BUN & eGFR)',
    englishName: 'Kidney Function Tests (Serum Creatinine, Urea & eGFR)',
    code: 'KFT',
    abbreviations: ['KFT', 'RFT', 'CR', 'CREAT', 'UREA', 'BUN', 'EGFR', 'وظائف كلى', 'كرياتينين', 'بولينا', 'يوريا', 'كي اف تي'],
    category: 'كيمياء حيوية (Biochemistry)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Creatinine: 0.6-1.2 mg/dL | Urea: 15-45 mg/dL | eGFR > 90',
    unit: 'mg/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-16',
    name: 'حمض اليوريك بالدم - النقرس (Serum Uric Acid)',
    englishName: 'Serum Uric Acid (SUA)',
    code: 'UA',
    abbreviations: ['UA', 'SUA', 'URIC ACID', 'GOUT', 'يوريك اسيد', 'حمض البوليك', 'نقرس', 'املاح النقرس'],
    category: 'كيمياء حيوية (Biochemistry)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Men: 3.4 - 7.0 mg/dL | Women: 2.4 - 6.0 mg/dL',
    unit: 'mg/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-17',
    name: 'نسبة الزلال للكرياتينين بالبول (Urine Albumin/Creatinine Ratio - ACR)',
    englishName: 'Urine Albumin-to-Creatinine Ratio (uACR / Microalbuminuria)',
    code: 'UACR',
    abbreviations: ['ACR', 'UACR', 'MICROALBUMIN', 'زلال البول', 'ميكروالبومين', 'نسبة الزلال للكرياتينين'],
    category: 'الكلى والبول (Urinalysis)',
    sampleType: 'عينة بول صباحية (Spot Urine)',
    fastingRequired: false,
    referenceRange: '< 30 mg/g (Microalbuminuria: 30-300 mg/g)',
    unit: 'mg/g',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-18',
    name: 'أيونات وأملاح الدم (Electrolytes: Na, K, Cl, Ca, Mg, Phos)',
    englishName: 'Serum Electrolytes Panel (Na+, K+, Cl-, Ca2+, Mg2+)',
    code: 'ELEC',
    abbreviations: ['NA', 'K', 'CL', 'CA', 'MG', 'ELECTROLYTES', 'صوديوم', 'بوتاسيوم', 'كالسيوم', 'ماغنسيوم', 'املاح الدم'],
    category: 'كيمياء حيوية (Biochemistry)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Na: 135-145 | K: 3.5-5.1 mEq/L | Ca: 8.5-10.2 mg/dL',
    unit: 'mEq/L',
    isFavorite: true,
    source: 'medical-archive',
  },

  // --- وظائف الكبد والجهاز الهضمي (Liver & GI) ---
  {
    id: 'arch-lab-19',
    name: 'وظائف الكبد كاملة (LFT: ALT, AST, Bilirubin, Albumin, ALP, GGT)',
    englishName: 'Liver Function Tests Panel (LFT)',
    code: 'LFT',
    abbreviations: ['LFT', 'LFTS', 'ALT', 'AST', 'SGPT', 'SGOT', 'BILIRUBIN', 'ALBUMIN', 'ALP', 'GGT', 'وظائف كبد', 'انزيمات كبد', 'صفراء', 'البومين', 'ال اف تي'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'ALT: 7-56 U/L | AST: 10-40 U/L | Total Bilirubin: 0.2-1.2 mg/dL | Albumin: 3.5-5.2 g/dL',
    unit: 'U/L',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-20',
    name: 'إنزيمات الكبد (ALT / SGPT & AST / SGOT)',
    englishName: 'Alanine & Aspartate Aminotransferases (ALT & AST)',
    code: 'ALT-AST',
    abbreviations: ['ALT', 'AST', 'SGPT', 'SGOT', 'TRANSAMINASES', 'اس جي بي تي', 'اس جي او تي', 'انزيمات الكبد'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'ALT < 45 U/L | AST < 40 U/L',
    unit: 'U/L',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-21',
    name: 'الصفراء الكلية والمباشرة (Total & Direct Bilirubin)',
    englishName: 'Total and Direct Serum Bilirubin',
    code: 'BILI',
    abbreviations: ['TBIL', 'DBIL', 'BILIRUBIN', 'JAUNDICE', 'صفراء', 'بيليروبين'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Total: 0.2 - 1.2 mg/dL | Direct: 0.0 - 0.3 mg/dL',
    unit: 'mg/dL',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-22',
    name: 'إنزيمات البنكرياس (Serum Amylase & Lipase)',
    englishName: 'Serum Amylase and Lipase',
    code: 'AMY-LIP',
    abbreviations: ['AMYLASE', 'LIPASE', 'PANCREATITIS', 'اميلاز', 'ليباز', 'انزيمات البنكرياس'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Amylase: 28 - 100 U/L | Lipase: 13 - 60 U/L',
    unit: 'U/L',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-23',
    name: 'مستضد جرثومة المعدة في البراز (H. Pylori Stool Antigen)',
    englishName: 'Helicobacter Pylori Stool Antigen Test (HpSA)',
    code: 'HPSA',
    abbreviations: ['H.PYLORI', 'HPYLORI', 'HPSA', 'جرثومة المعدة', 'حلزونية', 'اتش بيلوري'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة براز حديثة (Fresh Stool)',
    fastingRequired: false,
    referenceRange: 'Negative (سلبي)',
    unit: 'Qualitative',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-24',
    name: 'كالبروتكتين البراز للقولون التقرحي (Fecal Calprotectin)',
    englishName: 'Fecal Calprotectin Quantitative',
    code: 'CALPRO',
    abbreviations: ['CALPROTECTIN', 'IBD', 'كالبروتكتين', 'التهاب القولون'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة براز (Stool)',
    fastingRequired: false,
    referenceRange: '< 50 µg/g (Normal)',
    unit: 'µg/g',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الدهون والقلب والأوعية (Lipids & Cardiac Markers) ---
  {
    id: 'arch-lab-25',
    name: 'صورة دهون الدم الكاملة (Lipid Profile: Cholesterol, TG, HDL, LDL)',
    englishName: 'Complete Lipid Profile (TC, TG, HDL-C, LDL-C, VLDL)',
    code: 'LIPID',
    abbreviations: ['LIPID', 'CHOL', 'TG', 'LDL', 'HDL', 'VLDL', 'دهون الدم', 'كوليسترول', 'دهون ثلاثية', 'ال دي ال', 'اتش دي ال'],
    category: 'القلب والأوعية',
    sampleType: 'مصل دم (صيام 10-12 ساعة)',
    fastingRequired: true,
    referenceRange: 'Total Chol < 200 | LDL < 100 | HDL > 40 | TG < 150 mg/dL',
    unit: 'mg/dL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-26',
    name: 'إنزيم القلب عالي الحساسية (High-Sensitivity Troponin I / T)',
    englishName: 'High-Sensitivity Cardiac Troponin (hs-cTnI / hs-cTnT)',
    code: 'TROP',
    abbreviations: ['TROP', 'TROPONIN', 'HSTNT', 'HSTNI', 'CTNI', 'تروبونين', 'انزيمات القلب', 'جلطة القلب'],
    category: 'القلب والأوعية',
    sampleType: 'عينة مصل دم أو بلازما',
    fastingRequired: false,
    referenceRange: '< 14 ng/L (Negative for acute myocardial injury)',
    unit: 'ng/L',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-27',
    name: 'إنزيم عضلة القلب (CK-MB & Total CPK)',
    englishName: 'Creatine Kinase-MB & Total CPK',
    code: 'CK-MB',
    abbreviations: ['CKMB', 'CK-MB', 'CPK', 'CK', 'سي كي ام بي', 'سي بي كي'],
    category: 'القلب والأوعية',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'CK-MB < 25 U/L (or < 5 ng/mL)',
    unit: 'U/L',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-28',
    name: 'هرمون ضعف عضلة القلب (NT-proBNP / BNP)',
    englishName: 'N-Terminal Pro-B-Type Natriuretic Peptide (NT-proBNP)',
    code: 'BNP',
    abbreviations: ['BNP', 'NT-PROBNP', 'PROBNP', 'بي ان بي', 'فشل القلب', 'ضعف عضلة القلب'],
    category: 'القلب والأوعية',
    sampleType: 'عينة مصل أو بلازما EDTA',
    fastingRequired: false,
    referenceRange: 'NT-proBNP < 125 pg/mL (< 75 yrs)',
    unit: 'pg/mL',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الغدة الدرقية والهرمونات (Thyroid & Hormones) ---
  {
    id: 'arch-lab-29',
    name: 'هرمون الغدة الدرقية المحفز (TSH Ultrasensitive)',
    englishName: 'Thyroid Stimulating Hormone (TSH)',
    code: 'TSH',
    abbreviations: ['TSH', 'THYROID', 'تي اس اتش', 'غدة درقية', 'هرمون الغدة'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: '0.40 - 4.50 mIU/L',
    unit: 'mIU/L',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-30',
    name: 'وظائف الغدة الدرقية الكاملة (TSH, Free T3 & Free T4)',
    englishName: 'Full Thyroid Profile (TSH, FT3, FT4)',
    code: 'TFT',
    abbreviations: ['TFT', 'FT3', 'FT4', 'T3', 'T4', 'تي اف تي', 'فري تي 3', 'فري تي 4', 'تحاليل الغدة الدرقية'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'TSH: 0.4-4.5 mIU/L | FT4: 0.8-1.8 ng/dL | FT3: 2.3-4.2 pg/mL',
    unit: 'mIU/L',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-31',
    name: 'أجسام مضادة للغدة الدرقية (Anti-TPO & Anti-TG)',
    englishName: 'Thyroid Peroxidase & Thyroglobulin Antibodies',
    code: 'ANTI-TPO',
    abbreviations: ['ANTITPO', 'ANTI-TPO', 'ANTITG', 'HASHIMOTO', 'هاشيموتو', 'اجسام مضادة للغدة'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Anti-TPO < 34 IU/mL | Anti-TG < 115 IU/mL',
    unit: 'IU/mL',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-32',
    name: 'هرمون الغدة الجار درقية (PTH Intact)',
    englishName: 'Intact Parathyroid Hormone (iPTH)',
    code: 'PTH',
    abbreviations: ['PTH', 'IPTH', 'PARATHYROID', 'بي تي اتش', 'غدة جار درقية'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة مصل دم مبردة',
    fastingRequired: false,
    referenceRange: '15 - 65 pg/mL',
    unit: 'pg/mL',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-33',
    name: 'هرمون الكورتيزول صباحاً ومساءً (Serum Cortisol AM/PM)',
    englishName: 'Serum Cortisol (Morning 8 AM / Evening 4 PM)',
    code: 'CORTISOL',
    abbreviations: ['CORTISOL', 'ACTH', 'كورتيزول'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة مصل دم (8 صباحاً)',
    fastingRequired: false,
    referenceRange: 'AM: 5 - 25 µg/dL | PM: 3 - 12 µg/dL',
    unit: 'µg/dL',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-34',
    name: 'هرمون الحليب (Prolactin) والخصوبة (FSH, LH, Testosterone)',
    englishName: 'Prolactin, FSH, LH & Total Testosterone',
    code: 'PRL-FSH-LH',
    abbreviations: ['PRL', 'PROLACTIN', 'FSH', 'LH', 'TESTOSTERONE', 'برولاكتين', 'هرمون الحليب', 'تستوستيرون', 'اف اس اتش'],
    category: 'الغدد الصماء والسكر',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Prolactin: 4-15 ng/mL (M), 4-23 ng/mL (F)',
    unit: 'ng/mL',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الفيتامينات والحديد والمعادن (Vitamins & Iron Studies) ---
  {
    id: 'arch-lab-35',
    name: 'مخزون الحديد ودراسة الحديد بالدم (Serum Ferritin, Iron & TIBC)',
    englishName: 'Serum Ferritin, Serum Iron & TIBC',
    code: 'FERRITIN',
    abbreviations: ['FERRITIN', 'IRON', 'TIBC', 'TSAT', 'فيريتين', 'مخزون الحديد', 'حديد بالدم', 'تي اي بي سي'],
    category: 'كيمياء حيوية (Biochemistry)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Ferritin: 30-400 ng/mL (M), 15-150 ng/mL (F) | Iron: 60-170 µg/dL',
    unit: 'ng/mL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-36',
    name: 'فيتامين د الكلي بالدم (25-OH Vitamin D Total)',
    englishName: '25-Hydroxy Vitamin D Total',
    code: 'VIT-D',
    abbreviations: ['VITD', 'VIT-D', '25OHD', 'VITAMIN D', 'فيتامين د', 'فيتامين دال'],
    category: 'كيمياء حيوية (Biochemistry)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Sufficient: 30 - 100 ng/mL (Deficient < 20 ng/mL)',
    unit: 'ng/mL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-37',
    name: 'فيتامين ب12 وحمض الفوليك (Vitamin B12 & Folate)',
    englishName: 'Serum Vitamin B12 (Cobalamin) & Folic Acid',
    code: 'VIT-B12',
    abbreviations: ['B12', 'VITB12', 'FOLATE', 'FOLIC', 'فيتامين ب12', 'فيتامين ب 12', 'فوليك اسيد'],
    category: 'كيمياء حيوية (Biochemistry)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Vit B12: 200 - 900 pg/mL',
    unit: 'pg/mL',
    isFavorite: true,
    source: 'medical-archive',
  },

  // --- المناعة والالتهابات والروماتيزم والفيروسات (Immunology, Rheumatology & Virology) ---
  {
    id: 'arch-lab-38',
    name: 'بروتين سي التفاعلي للالتهابات (CRP Quantitative / hs-CRP)',
    englishName: 'C-Reactive Protein Quantitative (CRP)',
    code: 'CRP',
    abbreviations: ['CRP', 'HSCRP', 'HS-CRP', 'سي ار بي', 'بروتين سي التفاعلي', 'معامل الالتهاب'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: '< 5.0 mg/L (or < 0.5 mg/dL)',
    unit: 'mg/L',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-39',
    name: 'ميكروب سبحي وعامل الروماتويد (ASO Titer & Rheumatoid Factor RF)',
    englishName: 'Anti-Streptolysin O Titer (ASOT) & Rheumatoid Factor (RF)',
    code: 'ASO-RF',
    abbreviations: ['ASO', 'ASOT', 'RF', 'ANTI-CCP', 'ANTICCP', 'ميكروب سبحي', 'روماتويد', 'ايه اس او', 'ار اف'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'ASO < 200 IU/mL | RF < 14 IU/mL | Anti-CCP < 20 U/mL',
    unit: 'IU/mL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-40',
    name: 'أجسام مضادة للنواة والذئبة الحمراء (ANA & Anti-dsDNA)',
    englishName: 'Antinuclear Antibodies (ANA) & Anti-dsDNA',
    code: 'ANA',
    abbreviations: ['ANA', 'ANTIDSDNA', 'SLE', 'LUPUS', 'ذئبة حمراء', 'ايه ان ايه', 'مناعة ذاتية'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'ANA: Negative (< 1:80)',
    unit: 'Titer',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-41',
    name: 'مسح الفيروسات الكبدية والمناعية (HCV Ab, HBsAg & HIV)',
    englishName: 'Viral Hepatitis & HIV Screening (HCV Ab, HBsAg, HAV IgM, HIV)',
    code: 'VIRAL',
    abbreviations: ['HCV', 'HBV', 'HBSAG', 'HAV', 'HIV', 'PCR', 'فيروس سي', 'فيروس بي', 'فيروس ايه', 'مسح فيروسات'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Non-Reactive / Negative (سلبي)',
    unit: 'Index',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-42',
    name: 'تفاعل فيدال وبروسيلا للحمى المعوية (Widal & Brucella Agglutination)',
    englishName: 'Widal & Brucella Serology Test',
    code: 'WIDAL',
    abbreviations: ['WIDAL', 'TYPHOID', 'BRUCELLA', 'تيفود', 'فيدال', 'بروسيلا', 'حمى التيفود'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Negative (< 1:80)',
    unit: 'Titer',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-43',
    name: 'بروكالسيتونين للعدوى البكتيرية الشديدة (Procalcitonin - PCT)',
    englishName: 'Serum Procalcitonin (PCT)',
    code: 'PCT',
    abbreviations: ['PCT', 'PROCALCITONIN', 'SEPSIS', 'بروكالسيتونين', 'تسمم الدم'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: '< 0.05 ng/mL (Low risk of sepsis < 0.5)',
    unit: 'ng/mL',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- دلالات الأورام (Tumor Markers) ---
  {
    id: 'arch-lab-44',
    name: 'دلالة أورام البروستاتا الكلي والحر (Total & Free PSA)',
    englishName: 'Prostate Specific Antigen (Total & Free PSA)',
    code: 'PSA',
    abbreviations: ['PSA', 'FPSA', 'TPSA', 'PROSTATE', 'بي اس ايه', 'دلالات البروستاتا', 'بروستاتا'],
    category: 'دلالات الأورام (Tumor Markers)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'Total PSA < 4.0 ng/mL | Free/Total Ratio > 25%',
    unit: 'ng/mL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-45',
    name: 'دلالات أورام الجهاز الهضمي والكبد والثدي (AFP, CEA, CA 19-9, CA 15-3, CA 125)',
    englishName: 'Tumor Markers Panel (AFP, CEA, CA 19-9, CA 15-3, CA 125)',
    code: 'TUMOR-M',
    abbreviations: ['AFP', 'CEA', 'CA19-9', 'CA125', 'CA15-3', 'الفا فيتو بروتين', 'دلالات اورام', 'سي اي ايه'],
    category: 'دلالات الأورام (Tumor Markers)',
    sampleType: 'عينة مصل دم (Serum)',
    fastingRequired: false,
    referenceRange: 'AFP < 10 ng/mL | CEA < 5 ng/mL | CA19-9 < 37 U/mL',
    unit: 'U/mL',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- البول والبراز والمزارع وغازات الدم (Urinalysis, Stool, Cultures & ABG) ---
  {
    id: 'arch-lab-46',
    name: 'تحليل بول كامل (Complete Urine Analysis - CUA)',
    englishName: 'Complete Urinalysis (Routine & Microscopic)',
    code: 'URINE',
    abbreviations: ['URINE', 'UA', 'CUA', 'URINALYSIS', 'تحليل بول', 'بول كامل', 'صديد البول'],
    category: 'الكلى والبول (Urinalysis)',
    sampleType: 'عينة بول وسط الصباح (Midstream Urine)',
    fastingRequired: false,
    referenceRange: 'Pus cells: 0-5/HPF | RBCs: 0-2/HPF | Albumin/Glucose: Nil',
    unit: '/HPF',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-47',
    name: 'مزرعة بول وحساسية المضادات الحيوية (Urine Culture & Sensitivity)',
    englishName: 'Urine Culture and Antibiotic Sensitivity (C&S)',
    code: 'URINE-CS',
    abbreviations: ['C&S', 'UCS', 'URINE CULTURE', 'مزرعة بول', 'مزرعة وحساسية'],
    category: 'الكلى والبول (Urinalysis)',
    sampleType: 'عينة بول معقمة (Sterile Cup)',
    fastingRequired: false,
    referenceRange: 'No bacterial growth (< 10³ CFU/mL)',
    unit: 'CFU/mL',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-48',
    name: 'تحليل براز كامل والدم الخفي (Stool Analysis & Occult Blood - FOBT)',
    englishName: 'Complete Stool Analysis & Fecal Occult Blood Test (FOBT)',
    code: 'STOOL',
    abbreviations: ['STOOL', 'FOBT', 'OCCULT BLOOD', 'تحليل براز', 'دم خفي بالبراز'],
    category: 'الكبد والجهاز الهضمي',
    sampleType: 'عينة براز طازجة',
    fastingRequired: false,
    referenceRange: 'No ova, cysts, parasites or occult blood',
    unit: '',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-49',
    name: 'غازات الدم الشرياني (ABG - Arterial Blood Gases)',
    englishName: 'Arterial Blood Gases (ABG: pH, PaCO2, PaO2, HCO3, Lactate)',
    code: 'ABG',
    abbreviations: ['ABG', 'VBG', 'PH', 'HCO3', 'LACTATE', 'ايه بي جي', 'غازات الدم', 'حموضة الدم'],
    category: 'أمراض الصدر والطوارئ',
    sampleType: 'دم شرياني بالهيبارين (Heparinized Syringe)',
    fastingRequired: false,
    referenceRange: 'pH: 7.35-7.45 | PaCO2: 35-45 mmHg | HCO3: 22-26 mEq/L',
    unit: 'pH',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-lab-50',
    name: 'مزرعة دم أو بصاق وحساسية (Blood / Sputum Culture & Sensitivity)',
    englishName: 'Blood or Sputum Culture & Sensitivity (AFB / Ziehl-Neelsen)',
    code: 'CULTURE',
    abbreviations: ['BLOOD CULTURE', 'SPUTUM CS', 'AFB', 'ZN STAIN', 'مزرعة دم', 'مزرعة بصاق', 'درن'],
    category: 'مناعة وفيروسات (Serology)',
    sampleType: 'عينة دم معقمة / بصاق صباحي',
    fastingRequired: false,
    referenceRange: 'No pathogenic growth',
    unit: '',
    isFavorite: false,
    source: 'medical-archive',
  },
];

// ============================================================================
// 2. COMPREHENSIVE RADIOLOGY & IMAGING ARCHIVE (أرشيف الأشعة والتصوير الطبي)
//    Includes X-Ray, Ultrasound, Doppler, Echo, CT, MRI, Endoscopy, ECG, DEXA
// ============================================================================
export const MEDICAL_RADIOLOGY_ARCHIVE: RadiologyCatalogItem[] = [
  // --- أشعة سينية عادية (X-Ray) ---
  {
    id: 'arch-rad-1',
    name: 'أشعة عادية على الصدر والقلب (Chest X-Ray PA & Lateral)',
    englishName: 'Chest X-Ray PA & Lateral View (CXR)',
    code: 'CXR',
    abbreviations: ['CXR', 'CHEST XRAY', 'X-RAY CHEST', 'اشعة صدر', 'سي اكس ار', 'اشعة عادية على الصدر'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: true,
    notes: 'تقييم الرئتين والبلورا وحجم القلب والضلوع',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-2',
    name: 'أشعة عادية على المسالك البولية (KUB X-Ray)',
    englishName: 'Kidneys, Ureters, and Bladder X-Ray (KUB)',
    code: 'KUB',
    abbreviations: ['KUB', 'PLAIN KUB', 'كي يو بي', 'اشعة مسالك', 'حصوات الكلى'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: true,
    notes: 'الكشف عن الحصوات الظليلة في الكليتين والحالبين والمثانة',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-3',
    name: 'أشعة عادية على البطن واقفاً ونائماً (Plain Abdomen Erect & Supine)',
    englishName: 'Plain Abdominal X-Ray Erect & Supine',
    code: 'AXR',
    abbreviations: ['AXR', 'PFA', 'ABDOMEN XRAY', 'اشعة بطن واقف ونائم', 'انسداد معوي'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: false,
    notes: 'تقييم مستويات السوائل والغازات والانسداد المعوي أو ثقب الأمعاء',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-4',
    name: 'أشعة عادية على الفقرات العنقية أو القطنية (Cervical / Lumbosacral Spine X-Ray)',
    englishName: 'Cervical or Lumbosacral Spine X-Ray (AP & Lateral)',
    code: 'LSS-XR',
    abbreviations: ['LSS', 'C-SPINE', 'L-SPINE', 'SPINE XRAY', 'اشعة فقرات قطنية', 'اشعة فقرات عنقية', 'عمود فقري'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: true,
    notes: 'تقييم خشونة الفقرات والمسافات البينية والتزحزح الفقاري',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-5',
    name: 'أشعة عادية على الركبتين أو المفاصل (Knee / Joint X-Ray Standing AP & Lat)',
    englishName: 'Bilateral Knee Joint X-Ray Standing AP & Lateral',
    code: 'KNEE-XR',
    abbreviations: ['KNEE XRAY', 'SHOULDER XRAY', 'ANKLE XRAY', 'اشعة ركبة', 'خشونة الركبة', 'اشعة مفصل'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: true,
    notes: 'تقييم درجة خشونة المفاصل والكسور والنتوءات العظمية',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-6',
    name: 'أشعة عادية على الجيوب الأنفية (Paranasal Sinuses X-Ray - PNS)',
    englishName: 'Paranasal Sinuses X-Ray (Waters View - PNS)',
    code: 'PNS-XR',
    abbreviations: ['PNS', 'SINUS XRAY', 'بي ان اس', 'اشعة جيوب انفية'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: false,
    notes: 'تقييم التهاب الجيوب الأنفية وانحراف الحاجز الأنفي',
    source: 'medical-archive',
  },

  // --- موجات فوق صوتية / سونار (Ultrasound / Sonar) ---
  {
    id: 'arch-rad-7',
    name: 'موجات صوتية (سونار) على البطن والحوض (Abdominal & Pelvic Ultrasound)',
    englishName: 'Abdominopelvic Ultrasound (Abd & Pelvis US)',
    code: 'ABD-US',
    abbreviations: ['US', 'USS', 'SONAR', 'ABD US', 'PELVIC US', 'سونار بطن وحوض', 'موجات صوتية على البطن', 'اشعة تلفزيونية'],
    category: 'موجات صوتية (Ultrasound)',
    isFavorite: true,
    notes: 'فحص الكبد والمرارة والقنوات المرارية والبنكرياس والطحال والكليتين والمثانة والبروستاتا/الرحم',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-8',
    name: 'موجات صوتية على الكليتين والمسالك البولية والبروستاتا (KUB & Prostate US)',
    englishName: 'Renal, Bladder & Prostate Ultrasound (with Post-Void Residual PVR)',
    code: 'RENAL-US',
    abbreviations: ['KUB US', 'RENAL US', 'PVR', 'PROSTATE US', 'سونار مسالك', 'سونار كلى ومثانة', 'سونار بروستاتا'],
    category: 'موجات صوتية (Ultrasound)',
    isFavorite: true,
    notes: 'قياس حجم الكليتين والارتجاع والحصوات وحجم البروستاتا والمتبقي بعد التبول',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-9',
    name: 'موجات صوتية عالية الدقة على الغدة الدرقية والرقبة (Thyroid & Neck Ultrasound)',
    englishName: 'High-Resolution Thyroid & Neck Ultrasound (TIRADS)',
    code: 'THY-US',
    abbreviations: ['THYROID US', 'NECK US', 'TIRADS', 'سونار غدة درقية', 'موجات صوتية على الرقبة'],
    category: 'موجات صوتية (Ultrasound)',
    isFavorite: true,
    notes: 'تقييم حجم وعقد الغدة الدرقية والغدد الليمفاوية العنقية',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-10',
    name: 'موجات صوتية وماموجرام على الثديين (Bilateral Breast Ultrasound & Mammography)',
    englishName: 'Bilateral Sono-Mammography (BIRADS)',
    code: 'MAMMO',
    abbreviations: ['MAMMO', 'MAMMOGRAM', 'BREAST US', 'BIRADS', 'ماموجرام', 'سونار ثدي', 'اشعة ثدي'],
    category: 'موجات صوتية (Ultrasound)',
    isFavorite: false,
    notes: 'الكشف المبكر وتصنيف كتل وتكلسات الثدي والغدد الإبطية (BIRADS)',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-11',
    name: 'قياس ألياف ودهون الكبد بالفيبروسكان (Liver FibroScan / Elastography)',
    englishName: 'Transient Elastography (FibroScan with CAP & kPa)',
    code: 'FIBROSCAN',
    abbreviations: ['FIBROSCAN', 'ELASTOGRAPHY', 'CAP', 'فيبروسكان', 'قياس تليف الكبد', 'دهون الكبد'],
    category: 'موجات صوتية (Ultrasound)',
    isFavorite: true,
    notes: 'قياس درجة التشحم الكبدي (Steatosis) ودرجة التليف (Fibrosis F0-F4)',
    source: 'medical-archive',
  },

  // --- فحوصات القلب والإيكو والدوبلر (Cardiology, Echo & Doppler) ---
  {
    id: 'arch-rad-12',
    name: 'موجات صوتية على القلب بالدوبلر الملون (Transthoracic Echocardiography - Echo)',
    englishName: 'Transthoracic Echocardiogram with Color Doppler (TTE / Echo)',
    code: 'ECHO',
    abbreviations: ['ECHO', 'TTE', 'ECHOCARDIOGRAPHY', 'EF', 'ايكو', 'ايكو على القلب', 'موجات صوتية على القلب'],
    category: 'إيكو قلب (Echocardiography)',
    isFavorite: true,
    notes: 'قياس كفاءة عضلة القلب (EF%) وحركة الجدران والصمامات وضغط الشريان الرئوي',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-13',
    name: 'رسم قلب عادي 12 اتجاه (12-Lead Resting ECG / EKG)',
    englishName: '12-Lead Resting Electrocardiogram (ECG / EKG)',
    code: 'ECG',
    abbreviations: ['ECG', 'EKG', 'رسم قلب', 'اي سي جي', 'تخطيط القلب'],
    category: 'فسيولوجيا القلب',
    isFavorite: true,
    notes: 'تقييم انتظام ضربات القلب وقصور الشرايين التاجية والضفائر الكهربائية',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-14',
    name: 'رسم قلب بالمجهود (Exercise Stress ECG / Treadmill Test)',
    englishName: 'Exercise Stress Electrocardiogram (TMT / Stress ECG)',
    code: 'TMT',
    abbreviations: ['TMT', 'STRESS ECG', 'EXERCISE ECG', 'رسم قلب بالمجهود', 'اختبار مجهود'],
    category: 'فسيولوجيا القلب',
    isFavorite: false,
    notes: 'تشخيص قصور الشرايين التاجية مع المجهود البدني',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-15',
    name: 'هولتر رسم قلب مستمر 24 / 48 ساعة (24/48-Hour Ambulatory Holter ECG)',
    englishName: 'Ambulatory Holter ECG Monitoring (24h / 48h)',
    code: 'HOLTER',
    abbreviations: ['HOLTER', 'AMBULATORY ECG', 'هولتر', 'هولتر نبض القلب', 'رسم قلب 24 ساعة'],
    category: 'فسيولوجيا القلب',
    isFavorite: true,
    notes: 'رصد الخفقان والذبذبة الأذينية واضطرابات النبض المتقطعة',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-16',
    name: 'جهاز قياس ضغط الدم المتنقل 24 ساعة (24-Hour Ambulatory BP Monitoring - ABPM)',
    englishName: '24-Hour Ambulatory Blood Pressure Monitoring (ABPM)',
    code: 'ABPM',
    abbreviations: ['ABPM', 'HOLTER BP', 'هولتر ضغط', 'قياس ضغط 24 ساعة'],
    category: 'فسيولوجيا القلب',
    isFavorite: false,
    notes: 'تشخيص ضغط الدم الخفي أو ارتفاع الضغط أثناء النوم ومعايرة العلاج',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-17',
    name: 'دوبلر ملون على أوردة الطرفين السفليين (Venous Duplex / Doppler Lower Limbs)',
    englishName: 'Bilateral Lower Limb Venous Color Doppler / Duplex',
    code: 'VEN-DOP',
    abbreviations: ['DVT DOPPLER', 'VENOUS DUPLEX', 'VENOUS DOPPLER', 'دوبلر اوردة', 'جلطة الساق', 'دوبلر على الساقين'],
    category: 'دوبلر أوعية دموية (Doppler)',
    isFavorite: true,
    notes: 'استبعاد جلطات الأوردة العميقة (DVT) وتقييم ارتجاع الصمامات والدوالي',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-18',
    name: 'دوبلر ملون على شرايين الطرفين السفليين (Arterial Duplex Lower Limbs)',
    englishName: 'Bilateral Lower Limb Arterial Color Doppler / Duplex',
    code: 'ART-DOP',
    abbreviations: ['ARTERIAL DUPLEX', 'ARTERIAL DOPPLER', 'PAD DOPPLER', 'دوبلر شرايين', 'قصور الشرايين الطرفية', 'قدم سكري'],
    category: 'دوبلر أوعية دموية (Doppler)',
    isFavorite: true,
    notes: 'تقييم سريان الدم الشرياني وتصلب الشرايين لمرضى السكري والمدخنين',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-19',
    name: 'دوبلر ملون على شرايين الرقبة السباتية والفقرية (Carotid & Vertebral Duplex)',
    englishName: 'Carotid and Vertebral Arteries Color Duplex Scan',
    code: 'CAROTID-DOP',
    abbreviations: ['CAROTID DOPPLER', 'CAROTID DUPLEX', 'دوبلر شرايين الرقبة', 'الشريان السباتي'],
    category: 'دوبلر أوعية دموية (Doppler)',
    isFavorite: true,
    notes: 'قياس نسبة ضيق الشرايين السباتية في حالات الدوار والجلطات الدماغية العابرة',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-20',
    name: 'دوبلر ملون على الشرايين الكلوية أو الوريد البابي (Renal / Portal Doppler)',
    englishName: 'Renal Artery Doppler or Hepatic Portal Vein Duplex',
    code: 'REN-PORT-DOP',
    abbreviations: ['RENAL DOPPLER', 'PORTAL DOPPLER', 'دوبلر شرايين الكلى', 'دوبلر الوريد البابي'],
    category: 'دوبلر أوعية دموية (Doppler)',
    isFavorite: false,
    notes: 'تقييم ضيق شريان الكلى في الضغط المقاوم أو ارتفاع ضغط الوريد البابي الكبدي',
    source: 'medical-archive',
  },

  // --- أشعة مقطعية (CT Scans) ---
  {
    id: 'arch-rad-21',
    name: 'أشعة مقطعية عالية الدقة على الصدر والرئتين (HRCT Chest)',
    englishName: 'High-Resolution Computed Tomography of Chest (HRCT Chest)',
    code: 'HRCT',
    abbreviations: ['HRCT', 'CT CHEST', 'CHEST CT', 'سي تي صدر', 'مقطعية على الصدر', 'اتش ار سي تي'],
    category: 'أشعة مقطعية (CT)',
    isFavorite: true,
    notes: 'التقييم الدقيق لنسيج الرئة والتليف الرئوي والالتهاب الرئوي الفيروسي أو البكتيري',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-22',
    name: 'أشعة مقطعية على المخ بدون صبغة (Non-Contrast CT Brain)',
    englishName: 'Non-Contrast Computed Tomography of Brain (NCCT Brain)',
    code: 'CT-BRAIN',
    abbreviations: ['CT BRAIN', 'NCCT', 'HEAD CT', 'مقطعية على المخ', 'سي تي مخ', 'نزيف المخ'],
    category: 'أشعة مقطعية (CT)',
    isFavorite: true,
    notes: 'الفحص الطارئ لاستبعاد نزيف المخ الحاد أو الجلطات الدماغية وإصابات الرأس',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-23',
    name: 'أشعة مقطعية على البطن والحوض بالصبغة / ثلاثية المراحل (Triphasic CT Abdomen & Pelvis)',
    englishName: 'Contrast-Enhanced / Triphasic CT Abdomen and Pelvis',
    code: 'CT-ABD',
    abbreviations: ['CT ABDOMEN', 'TRIPHASIC CT', 'CECT ABDOMEN', 'مقطعية بطن وحوض', 'مقطعية ثلاثية المراحل على الكبد'],
    category: 'أشعة مقطعية (CT)',
    isFavorite: true,
    notes: 'تقييم بؤر الكبد والأورام والبنكرياس والجهاز الهضمي بدقة عالية',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-24',
    name: 'أشعة مقطعية حلزونية على المسالك البولية بدون صبغة (CT-KUB / Non-Contrast CT Urinary Tract)',
    englishName: 'Non-Contrast Helical CT of Urinary Tract (CT-KUB)',
    code: 'CT-KUB',
    abbreviations: ['CT KUB', 'CT-KUB', 'NCCT KUB', 'مقطعية مسالك', 'سي تي كي يو بي', 'حصوة الحالب'],
    category: 'أشعة مقطعية (CT)',
    isFavorite: true,
    notes: 'الفحص القياسي الأدق لتحديد مكان وحجم وكثافة حصوات الكلى والحالب (HU)',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-25',
    name: 'أشعة مقطعية بالصبغة على الشرايين التاجية أو الرئوية (CT Coronary / Pulmonary Angiography)',
    englishName: 'CT Coronary Angiography (CTCA) or CT Pulmonary Angiography (CTPA)',
    code: 'CTCA-CTPA',
    abbreviations: ['CTCA', 'CTPA', 'CORONARY CT', 'مقطعية شرايين القلب', 'مقطعية الشريان الرئوي', 'جلطة الرئة'],
    category: 'أشعة مقطعية (CT)',
    isFavorite: false,
    notes: 'قياس نسبة ضيق الشرايين التاجية وتكلسها (Calcium Score) أو استبعاد جلطة الشريان الرئوي',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-26',
    name: 'أشعة مقطعية على الجيوب الأنفية (CT Paranasal Sinuses Coronal & Axial)',
    englishName: 'CT Scan of Paranasal Sinuses (CT PNS)',
    code: 'CT-PNS',
    abbreviations: ['CT PNS', 'SINUS CT', 'مقطعية جيوب انفية', 'سي تي جيوب انفية'],
    category: 'أشعة مقطعية (CT)',
    isFavorite: false,
    notes: 'تقييم فتحات الجيوب الأنفية واللحميات وانحراف الحاجز الأنفي',
    source: 'medical-archive',
  },

  // --- رنين مغناطيسي (MRI / MRA / MRCP) ---
  {
    id: 'arch-rad-27',
    name: 'رنين مغناطيسي على المخ والشرايين الدماغية (MRI Brain with MRA / MRV & DWI)',
    englishName: 'MRI Brain with Diffusion (DWI) and MRA / MRV',
    code: 'MRI-BRAIN',
    abbreviations: ['MRI BRAIN', 'MRA', 'MRV', 'DWI', 'ام ار اي مخ', 'رنين على المخ', 'رنين شرايين المخ'],
    category: 'رنين مغناطيسي (MRI)',
    isFavorite: true,
    notes: 'التشخيص المبكر للجلطات الدماغية الدقيقة والتهابات الأعصاب وأورام المخ',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-28',
    name: 'رنين مغناطيسي على الفقرات القطنية والعجزية أو العنقية (MRI Lumbosacral / Cervical Spine)',
    englishName: 'MRI Lumbosacral Spine (LSS) or Cervical Spine',
    code: 'MRI-SPINE',
    abbreviations: ['MRI LSS', 'MRI SPINE', 'MRI CERVICAL', 'رنين فقرات قطنية', 'رنين فقرات عنقية', 'انزلاق غضروفي'],
    category: 'رنين مغناطيسي (MRI)',
    isFavorite: true,
    notes: 'فحص الغضاريف والحبل الشوكي وجذور الأعصاب وعرق النسا',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-29',
    name: 'رنين مغناطيسي على القنوات المرارية والبنكرياس (MRCP)',
    englishName: 'Magnetic Resonance Cholangiopancreatography (MRCP)',
    code: 'MRCP',
    abbreviations: ['MRCP', 'ام ار سي بي', 'رنين قنوات مرارية', 'حصوة القنوات المرارية'],
    category: 'رنين مغناطيسي (MRI)',
    isFavorite: true,
    notes: 'فحص غير تداخلي للقنوات المرارية والبنكرياس لاستبعاد الحصوات أو الضيق',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-30',
    name: 'رنين مغناطيسي على مفصل الركبة أو الكتف (MRI Knee / Shoulder Joint)',
    englishName: 'MRI of Knee Joint or Shoulder Joint',
    code: 'MRI-JOINT',
    abbreviations: ['MRI KNEE', 'MRI SHOULDER', 'ACL', 'MENISCUS', 'رنين ركبة', 'رنين كتف', 'غضروف الركبة', 'رباط صليبي'],
    category: 'رنين مغناطيسي (MRI)',
    isFavorite: false,
    notes: 'تقييم الغضاريف الهلالية والأربطة الصليبية وأوتار الكتف',
    source: 'medical-archive',
  },

  // --- مناظير وفحوصات تخصصية أخرى (Endoscopy, DEXA, Spirometry) ---
  {
    id: 'arch-rad-31',
    name: 'منظار معدة ومريء واثنى عشر تشخيصي (Upper GI Endoscopy / EGD)',
    englishName: 'Esophagogastroduodenoscopy (Upper GI Endoscopy / EGD)',
    code: 'EGD',
    abbreviations: ['EGD', 'OGD', 'UPPER ENDOSCOPY', 'GASTROSCOPY', 'منظار معدة', 'منظار علوي', 'قرحة المعدة'],
    category: 'مناظير جهاز هضمي (Endoscopy)',
    isFavorite: true,
    notes: 'فحص المريء والمعدة والاثنى عشر وأخذ عينة لجرثومة المعدة أو الدوالي',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-32',
    name: 'منظار قولون تشخيصي كامل (Total Colonoscopy)',
    englishName: 'Diagnostic Total Ileocolonoscopy',
    code: 'COLONOSCOPY',
    abbreviations: ['COLONOSCOPY', 'LGI ENDOSCOPY', 'منظار قولون', 'منظار سفلي'],
    category: 'مناظير جهاز هضمي (Endoscopy)',
    isFavorite: true,
    notes: 'فحص القولون والمستقيم والزوائد اللحمية والتهاب القولون التقرحي',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-33',
    name: 'قياس كثافة وهشاشة العظام (DEXA Scan - Bone Mineral Density)',
    englishName: 'Dual-Energy X-Ray Absorptiometry (DEXA / BMD Scan)',
    code: 'DEXA',
    abbreviations: ['DEXA', 'DXA', 'BMD', 'OSTEOPOROSIS', 'ديكسا', 'هشاشة العظام', 'قياس كثافة العظام'],
    category: 'أشعة سينية (X-Ray)',
    isFavorite: false,
    notes: 'قياس T-Score و Z-Score للفقرات القطنية وعنق الفخذ لتشخيص هشاشة العظام',
    source: 'medical-archive',
  },
  {
    id: 'arch-rad-34',
    name: 'وظائف التنفس وكفاءة الرئتين (Spirometry / Pulmonary Function Test - PFT)',
    englishName: 'Spirometry with Bronchodilator Reversibility (PFT)',
    code: 'PFT',
    abbreviations: ['PFT', 'SPIROMETRY', 'FEV1', 'FVC', 'وظائف تنفس', 'كفاءة الرئة', 'سبيرومتري'],
    category: 'فسيولوجيا القلب',
    isFavorite: false,
    notes: 'تشخيص ومتابعة حساسية الصدر (Asthma) والسدة الرئوية المزمنة (COPD)',
    source: 'medical-archive',
  },
];

// ============================================================================
// 3. COMPREHENSIVE CLINICAL DIAGNOSES ARCHIVE (أرشيف التشخيصات الطبية ICD-10)
//    Includes ICD-10 codes, Arabic & English terms, and clinical abbreviations
//    (HTN, DM, T2DM, GERD, IBS, IHD, CAD, HF, AF, COPD, UTI, CKD, IDA, etc.)
// ============================================================================
export const MEDICAL_DIAGNOSES_ARCHIVE: DiagnosisCatalogItem[] = [
  // --- أمراض القلب والأوعية الدموية (Cardiology & Vascular) ---
  {
    id: 'arch-diag-1',
    code: 'I10',
    nameAr: 'ارتفاع ضغط الدم الأساسي (Essential Hypertension)',
    nameEn: 'Essential (Primary) Hypertension',
    abbreviations: ['HTN', 'HBP', 'BP', 'اتش تي ان', 'ضغط الدم', 'ارتفاع الضغط'],
    category: 'القلب والأوعية الدموية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-2',
    code: 'I25.9',
    nameAr: 'قصور الشرايين التاجية المزمن (Ischemic Heart Disease)',
    nameEn: 'Chronic Ischemic Heart Disease / Coronary Artery Disease',
    abbreviations: ['IHD', 'CAD', 'CHD', 'اي اتش دي', 'سي ايه دي', 'قصور الشريان التاجي', 'شرايين القلب'],
    category: 'القلب والأوعية الدموية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-3',
    code: 'I20.9',
    nameAr: 'ذبحة صدرية غير مستقرة / مستقرة (Angina Pectoris / ACS)',
    nameEn: 'Angina Pectoris / Acute Coronary Syndrome',
    abbreviations: ['ACS', 'UA', 'NSTEMI', 'STEMI', 'MI', 'ANGINA', 'ذبحة صدرية', 'جلطة القلب', 'ام اي'],
    category: 'القلب والأوعية الدموية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-4',
    code: 'I50.9',
    nameAr: 'ضعف وقصور عضلة القلب الاحتقاني (Heart Failure / CHF)',
    nameEn: 'Congestive Heart Failure (CHF / HFrEF / HFpEF)',
    abbreviations: ['HF', 'CHF', 'HFREF', 'HFPEF', 'اتش اف', 'ضعف عضلة القلب', 'هبوط القلب'],
    category: 'القلب والأوعية الدموية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-5',
    code: 'I48.91',
    nameAr: 'الرجفان الأذيني واضطراب ضربات القلب (Atrial Fibrillation)',
    nameEn: 'Atrial Fibrillation and Cardiac Arrhythmia',
    abbreviations: ['AF', 'AFIB', 'SVT', 'PVC', 'ايه اف', 'رجفان اذيني', 'ذبذبة اذينية', 'خفقان'],
    category: 'القلب والأوعية الدموية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-6',
    code: 'E78.5',
    nameAr: 'ارتفاع الكوليسترول ودهون الدم (Dyslipidemia / Hyperlipidemia)',
    nameEn: 'Dyslipidemia and Mixed Hyperlipidemia',
    abbreviations: ['DLP', 'HLD', 'HYPERLIPIDEMIA', 'CHOLESTEROL', 'كوليسترول', 'دهون الدم'],
    category: 'القلب والأوعية الدموية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-7',
    code: 'I80.2',
    nameAr: 'جلطة الأوردة العميقة بالطرف السفلي (Deep Vein Thrombosis)',
    nameEn: 'Deep Vein Thrombosis of Lower Extremity (DVT)',
    abbreviations: ['DVT', 'VTE', 'دي في تي', 'جلطة الساق', 'جلطة الاوردة العميقة'],
    category: 'القلب والأوعية الدموية',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-8',
    code: 'I73.9',
    nameAr: 'قصور الدورة الدموية الطرفية ودوالي الساقين (PAD / Varicose Veins)',
    nameEn: 'Peripheral Arterial Disease (PAD) / Chronic Venous Insufficiency',
    abbreviations: ['PAD', 'PVD', 'CVI', 'قصور الشرايين الطرفية', 'دوالي الساقين'],
    category: 'القلب والأوعية الدموية',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الغدد الصماء والسكري والتمثيل الغذائي (Endocrinology & Diabetes) ---
  {
    id: 'arch-diag-9',
    code: 'E11.9',
    nameAr: 'داء السكري من النوع الثاني (Type 2 Diabetes Mellitus)',
    nameEn: 'Type 2 Diabetes Mellitus without Complications',
    abbreviations: ['DM', 'T2DM', 'DM2', 'NIDDM', 'دي ام', 'سكر النوع الثاني', 'مرض السكر'],
    category: 'الغدد الصماء والسكري',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-10',
    code: 'E11.65',
    nameAr: 'داء السكري غير المنضبط مع ارتفاع السكر (Uncontrolled Diabetes)',
    nameEn: 'Type 2 Diabetes Mellitus with Hyperglycemia',
    abbreviations: ['UNCONTROLLED DM', 'HYPERGLYCEMIA', 'DKA', 'سكر غير منضبط', 'ارتفاع السكر'],
    category: 'الغدد الصماء والسكري',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-11',
    code: 'E11.40',
    nameAr: 'التهاب الأعصاب الطرفية السكري (Diabetic Neuropathy)',
    nameEn: 'Type 2 Diabetes Mellitus with Diabetic Polyneuropathy',
    abbreviations: ['DPN', 'DN', 'NEUROPATHY', 'التهاب الاعصاب السكري', 'تنميل الاطراف'],
    category: 'الغدد الصماء والسكري',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-12',
    code: 'E10.9',
    nameAr: 'داء السكري من النوع الأول المعتمد على الإنسولين (Type 1 DM)',
    nameEn: 'Type 1 Diabetes Mellitus (IDDM)',
    abbreviations: ['T1DM', 'DM1', 'IDDM', 'سكر النوع الاول'],
    category: 'الغدد الصماء والسكري',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-13',
    code: 'R73.03',
    nameAr: 'ما قبل السكري ومقاومة الإنسولين (Prediabetes & Insulin Resistance)',
    nameEn: 'Prediabetes and Insulin Resistance Syndrome',
    abbreviations: ['PRE-DM', 'IGT', 'IFG', 'IR', 'مقاومة الانسولين', 'ما قبل السكري'],
    category: 'الغدد الصماء والسكري',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-14',
    code: 'E03.9',
    nameAr: 'قصور وخمول الغدة الدرقية (Hypothyroidism)',
    nameEn: 'Primary Hypothyroidism / Hashimoto Thyroiditis',
    abbreviations: ['HYPOTHYROID', 'HASHIMOTO', 'خمول الغدة الدرقية', 'كسل الغدة'],
    category: 'الغدد الصماء والسكري',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-15',
    code: 'E05.90',
    nameAr: 'فرط نشاط الغدة الدرقية والتسمم الدرقي (Hyperthyroidism)',
    nameEn: 'Thyrotoxicosis / Hyperthyroidism (Graves Disease)',
    abbreviations: ['HYPERTHYROID', 'GRAVES', 'نشاط الغدة الدرقية', 'فرط الغدة'],
    category: 'الغدد الصماء والسكري',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-16',
    code: 'E55.9',
    nameAr: 'نقص فيتامين د والكالسيوم (Vitamin D Deficiency)',
    nameEn: 'Vitamin D Deficiency and Hypocalcemia',
    abbreviations: ['VDD', 'VIT D DEFICIENCY', 'نقص فيتامين د', 'نقص كالسيوم'],
    category: 'الغدد الصماء والسكري',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-17',
    code: 'E66.9',
    nameAr: 'السمنة ومتلازمة الأيض (Obesity & Metabolic Syndrome)',
    nameEn: 'Obesity and Metabolic Syndrome',
    abbreviations: ['BMI', 'METS', 'OBESITY', 'سمنة', 'متلازمة الايض'],
    category: 'الغدد الصماء والسكري',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-18',
    code: 'E28.2',
    nameAr: 'متلازمة تكيس المبايض (Polycystic Ovary Syndrome)',
    nameEn: 'Polycystic Ovary Syndrome (PCOS)',
    abbreviations: ['PCOS', 'PCO', 'بي سي او', 'تكيس المبايض'],
    category: 'الغدد الصماء والسكري',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الجهاز الهضمي والكبد (Gastroenterology & Hepatology) ---
  {
    id: 'arch-diag-19',
    code: 'K21.9',
    nameAr: 'ارتجاع المريء المعدي المريئي (GERD)',
    nameEn: 'Gastro-Esophageal Reflux Disease (GERD)',
    abbreviations: ['GERD', 'GORD', 'REFLUX', 'جيرد', 'ارتجاع المريء', 'حموضة المعدة'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-20',
    code: 'K29.70',
    nameAr: 'التهاب المعدة والاثنى عشر وجرثومة المعدة (Gastritis & H. Pylori)',
    nameEn: 'Acute or Chronic Gastritis & Duodenitis (H. Pylori)',
    abbreviations: ['GASTRITIS', 'H.PYLORI', 'DUODENITIS', 'التهاب المعدة', 'جرثومة المعدة', 'فم المعدة'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-21',
    code: 'K27.9',
    nameAr: 'قرحة المعدة والاثنى عشر الهضمية (Peptic Ulcer Disease)',
    nameEn: 'Peptic Ulcer Disease (PUD - Gastric / Duodenal Ulcer)',
    abbreviations: ['PUD', 'GU', 'DU', 'بي يو دي', 'قرحة المعدة', 'قرحة الاثنى عشر'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-22',
    code: 'K58.9',
    nameAr: 'متلازمة القولون العصبي (Irritable Bowel Syndrome)',
    nameEn: 'Irritable Bowel Syndrome (IBS-C / IBS-D / IBS-M)',
    abbreviations: ['IBS', 'SPASTIC COLON', 'اي بي اس', 'قولون عصبي', 'انتفاخ القولون'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-23',
    code: 'A09',
    nameAr: 'نزلة معوية حادة والتهاب المعدة والأمعاء (Acute Gastroenteritis)',
    nameEn: 'Acute Infectious Gastroenteritis (AGE)',
    abbreviations: ['AGE', 'GE', 'GASTROENTERITIS', 'نزلة معوية', 'اسهال حاد', 'تسمم غذائي'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-24',
    code: 'K76.0',
    nameAr: 'التشحم الكبدي غير الكحولي - دهون الكبد (NAFLD / MASLD)',
    nameEn: 'Non-Alcoholic Fatty Liver Disease (NAFLD / Steatosis)',
    abbreviations: ['NAFLD', 'NASH', 'MASLD', 'FATTY LIVER', 'دهون على الكبد', 'تشحم الكبد'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-25',
    code: 'K74.60',
    nameAr: 'تليف الكبد المزمن وارتفاع ضغط الوريد البابي (Liver Cirrhosis)',
    nameEn: 'Hepatic Cirrhosis and Portal Hypertension',
    abbreviations: ['CLD', 'LC', 'CIRRHOSIS', 'تليف الكبد', 'استسقاء البطن'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-26',
    code: 'K80.20',
    nameAr: 'التهاب المرارة وحصوات القنوات المرارية (Cholecystitis & Cholelithiasis)',
    nameEn: 'Calculous Cholecystitis and Gallstones (Biliary Colic)',
    abbreviations: ['GB STONES', 'CHOLECYSTITIS', 'BILIARY COLIC', 'حصوات المرارة', 'التهاب المرارة', 'مغص مراري'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-27',
    code: 'K51.90',
    nameAr: 'مرض الأمعاء الالتهابي - القولون التقرحي وكرونز (IBD: UC / Crohn)',
    nameEn: 'Inflammatory Bowel Disease (Ulcerative Colitis / Crohns)',
    abbreviations: ['IBD', 'UC', 'CROHNS', 'قولون تقرحي', 'مرض كرونز'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-28',
    code: 'K59.00',
    nameAr: 'إمساك وظيفي مزمن أو بواسير شرجية (Chronic Constipation & Hemorrhoids)',
    nameEn: 'Functional Chronic Constipation & Hemorrhoids',
    abbreviations: ['CONSTIPATION', 'PILES', 'HEMORRHOIDS', 'امساك مزمن', 'بواسير', 'شرخ شرجي'],
    category: 'الجهاز الهضمي والكبد',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الجهاز التنفسي والصدر والأنف والأذن (Respiratory & ENT) ---
  {
    id: 'arch-diag-29',
    code: 'J06.9',
    nameAr: 'عدوى الجهاز التنفسي العلوي الحادة ونزلة البرد (URTI)',
    nameEn: 'Acute Upper Respiratory Tract Infection (URTI)',
    abbreviations: ['URTI', 'URI', 'COMMON COLD', 'يو ار تي اي', 'نزلة برد', 'التهاب تنفسي علوي'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-30',
    code: 'J02.9',
    nameAr: 'التهاب الحلق واللوزتين والجيوب الأنفية الحاد (Pharyngitis / Tonsillitis / Sinusitis)',
    nameEn: 'Acute Pharyngotonsillitis and Rhinosinusitis',
    abbreviations: ['TONSILLITIS', 'PHARYNGITIS', 'SINUSITIS', 'OM', 'التهاب اللوزتين', 'التهاب الحلق', 'جيوب انفية'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-31',
    code: 'J20.9',
    nameAr: 'التهاب الشعب الهوائية الحاد والنزلة الشعبية (Acute Bronchitis)',
    nameEn: 'Acute Bronchitis and Lower Respiratory Tract Infection (LRTI)',
    abbreviations: ['LRTI', 'BRONCHITIS', 'نزلة شعبية', 'التهاب شعبي حاد', 'كحة'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-32',
    code: 'J45.909',
    nameAr: 'الربو الشعبي وحساسية الصدر (Bronchial Asthma)',
    nameEn: 'Bronchial Asthma (Uncomplicated / Acute Exacerbation)',
    abbreviations: ['BA', 'ASTHMA', 'حساسية الصدر', 'ربو شعبي', 'ازمة ربوية'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-33',
    code: 'J44.9',
    nameAr: 'السدة الرئوية المزمنة (COPD)',
    nameEn: 'Chronic Obstructive Pulmonary Disease (COPD)',
    abbreviations: ['COPD', 'AECOPD', 'سي او بي دي', 'سدة رئوية', 'انسداد رئوي مزمن'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-34',
    code: 'J18.9',
    nameAr: 'الالتهاب الرئوي المكتسب من المجتمع (Community-Acquired Pneumonia)',
    nameEn: 'Community-Acquired Pneumonia (CAP)',
    abbreviations: ['CAP', 'PNEUMONIA', 'التهاب رئوي', 'سي ايه بي'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-35',
    code: 'J30.9',
    nameAr: 'حساسية الأنف الموسمية والمزمنة (Allergic Rhinitis)',
    nameEn: 'Allergic Rhinitis',
    abbreviations: ['AR', 'ALLERGIC RHINITIS', 'حساسية الانف', 'رشح تحسسي'],
    category: 'الجهاز التنفسي والصدر',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- الكلى والمسالك البولية (Nephrology & Urology) ---
  {
    id: 'arch-diag-36',
    code: 'N39.0',
    nameAr: 'عدوى والتهاب المسالك البولية والمثانة (Urinary Tract Infection - UTI)',
    nameEn: 'Urinary Tract Infection & Acute Cystitis (UTI)',
    abbreviations: ['UTI', 'CYSTITIS', 'PYELONEPHRITIS', 'يو تي اي', 'التهاب المسالك البولية', 'التهاب المثانة', 'صديد البول'],
    category: 'الكلى والمسالك البولية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-37',
    code: 'N20.0',
    nameAr: 'حصوات الكلى والحالب والمغص الكلوي الحاد (Renal Colic & Nephrolithiasis)',
    nameEn: 'Nephrolithiasis / Ureteric Stone & Acute Renal Colic',
    abbreviations: ['RENAL COLIC', 'KIDNEY STONE', 'NEPHROLITHIASIS', 'مغص كلوي', 'حصوة الكلى', 'حصوة الحالب'],
    category: 'الكلى والمسالك البولية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-38',
    code: 'N18.9',
    nameAr: 'القصور الكلوي المزمن واعتلال الكلى السكري (Chronic Kidney Disease - CKD)',
    nameEn: 'Chronic Kidney Disease (CKD Stages 1-5) & Diabetic Nephropathy',
    abbreviations: ['CKD', 'ESRD', 'CRF', 'AKI', 'سي كي دي', 'قصور كلوي مزمن', 'ضعف الكلى'],
    category: 'الكلى والمسالك البولية',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-39',
    code: 'N40.1',
    nameAr: 'تضخم البروستاتا الحميد مع أعراض بولية (Benign Prostatic Hyperplasia - BPH)',
    nameEn: 'Benign Prostatic Hyperplasia with LUTS (BPH)',
    abbreviations: ['BPH', 'LUTS', 'PROSTATITIS', 'بي بي اتش', 'تضخم البروستاتا', 'التهاب البروستاتا'],
    category: 'الكلى والمسالك البولية',
    isFavorite: true,
    source: 'medical-archive',
  },

  // --- العظام والمفاصل والروماتيزم (Orthopedics & Rheumatology) ---
  {
    id: 'arch-diag-40',
    code: 'M10.9',
    nameAr: 'النقرس الحاد والمزمن وارتفاع حمض اليوريك (Gouty Arthritis & Hyperuricemia)',
    nameEn: 'Idiopathic Gout & Hyperuricemia',
    abbreviations: ['GOUT', 'HYPERURICEMIA', 'نقرس', 'املاح اليوريك', 'التهاب مفصل النقرس'],
    category: 'العظام والروماتيزم',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-41',
    code: 'M17.9',
    nameAr: 'خشونة المفاصل والركبتين (Osteoarthritis)',
    nameEn: 'Primary Osteoarthritis of Knee / Spine (OA)',
    abbreviations: ['OA', 'OSTEOARTHRITIS', 'خشونة الركبة', 'خشونة المفاصل', 'او ايه'],
    category: 'العظام والروماتيزم',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-42',
    code: 'M54.5',
    nameAr: 'آلام أسفل الظهر والانزلاق الغضروفي وعرق النسا (Low Back Pain & Sciatica)',
    nameEn: 'Low Back Pain (LBP), Lumbar Disc Prolapse & Sciatica',
    abbreviations: ['LBP', 'SCIATICA', 'PID', 'CERVICALGIA', 'الم اسفل الظهر', 'انزلاق غضروفي', 'عرق النسا', 'تقلص عضلي'],
    category: 'العظام والروماتيزم',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-43',
    code: 'M06.9',
    nameAr: 'التهاب المفاصل الروماتويدي (Rheumatoid Arthritis)',
    nameEn: 'Rheumatoid Arthritis (RA)',
    abbreviations: ['RA', 'RHEUMATOID', 'ار ايه', 'روماتويد المفاصل'],
    category: 'العظام والروماتيزم',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-44',
    code: 'M81.0',
    nameAr: 'هشاشة العظام (Osteoporosis)',
    nameEn: 'Age-Related / Postmenopausal Osteoporosis',
    abbreviations: ['OSTEOPOROSIS', 'OSTEOPENIA', 'هشاشة العظام', 'ضعف العظام'],
    category: 'العظام والروماتيزم',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-45',
    code: 'M79.7',
    nameAr: 'متلازمة الألم العضلي الليفي (Fibromyalgia)',
    nameEn: 'Fibromyalgia and Myofascial Pain Syndrome',
    abbreviations: ['FMS', 'FIBROMYALGIA', 'فيبروميالجيا', 'الام العضلات المزمنة'],
    category: 'العظام والروماتيزم',
    isFavorite: false,
    source: 'medical-archive',
  },

  // --- أمراض الدم والأعصاب والأمراض المعدية (Hematology, Neurology & Infectious) ---
  {
    id: 'arch-diag-46',
    code: 'D50.9',
    nameAr: 'فقر الدم (الأنيميا) بنقص الحديد (Iron Deficiency Anemia - IDA)',
    nameEn: 'Iron Deficiency Anemia (IDA)',
    abbreviations: ['IDA', 'ANEMIA', 'HB LOW', 'اي دي ايه', 'انيميا نقص الحديد', 'فقر الدم'],
    category: 'أمراض الدم والمناعة',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-47',
    code: 'D51.9',
    nameAr: 'أنيميا نقص فيتامين ب12 وحمض الفوليك (Megaloblastic Anemia)',
    nameEn: 'Vitamin B12 and Folate Deficiency Anemia',
    abbreviations: ['B12 ANEMIA', 'MEGALOBLASTIC', 'انيميا نقص ب12', 'التهاب اعصاب طرفية'],
    category: 'أمراض الدم والمناعة',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-48',
    code: 'G43.909',
    nameAr: 'الصداع النصفي (الشقيقة) والصداع التوتري (Migraine & Tension Headache)',
    nameEn: 'Migraine and Tension-Type Headache',
    abbreviations: ['MIGRAINE', 'TTH', 'HEADACHE', 'صداع نصفي', 'شقيقة', 'صداع توتري'],
    category: 'المخ والأعصاب',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-49',
    code: 'H81.10',
    nameAr: 'الدوار الحركي الحميد والتهاب الأذن الداخلية (Benign Paroxysmal Positional Vertigo)',
    nameEn: 'Benign Paroxysmal Positional Vertigo (BPPV) & Labyrinthitis',
    abbreviations: ['BPPV', 'VERTIGO', 'LABYRINTHITIS', 'دوار', 'دوخة', 'التهاب الاذن الداخلية'],
    category: 'المخ والأعصاب',
    isFavorite: true,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-50',
    code: 'I63.9',
    nameAr: 'جلطة دماغية أو نوبة نقص تروية عابرة (Cerebral Infarction / Stroke / TIA)',
    nameEn: 'Cerebrovascular Accident (CVA / Stroke) & Transient Ischemic Attack (TIA)',
    abbreviations: ['CVA', 'TIA', 'STROKE', 'سي في ايه', 'تي اي ايه', 'جلطة المخ'],
    category: 'المخ والأعصاب',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-51',
    code: 'G51.0',
    nameAr: 'التهاب العصب السابع الوجهي (Bells Palsy / Facial Nerve Palsy)',
    nameEn: 'Bells Palsy (Acute Facial Nerve Paralysis)',
    abbreviations: ['BELLS PALSY', 'CN VII PALSY', 'العصب السابع'],
    category: 'المخ والأعصاب',
    isFavorite: false,
    source: 'medical-archive',
  },
  {
    id: 'arch-diag-52',
    code: 'A01.00',
    nameAr: 'الحمى التيفودية والنزلات الميكروبية (Typhoid Fever / Enteric Fever)',
    nameEn: 'Typhoid and Paratyphoid Enteric Fever',
    abbreviations: ['TYPHOID', 'ENTERIC FEVER', 'حمى التيفود', 'تيفود'],
    category: 'الأمراض المعدية',
    isFavorite: false,
    source: 'medical-archive',
  },
];

// ============================================================================
// 4. INTELLIGENT BILINGUAL & ABBREVIATION-AWARE SEARCH ENGINE
// ============================================================================

function scoreClinicalMatch(
  tokens: string[],
  fullQueryNorm: string,
  fields: {
    primaryAr: string;
    primaryEn: string;
    code: string;
    abbreviations: string[];
    category: string;
    extra: string;
  }
): number {
  const normAr = normalizeDrugText(fields.primaryAr);
  const normEn = normalizeDrugText(fields.primaryEn);
  const normCode = normalizeDrugText(fields.code);
  const normAbbrevs = fields.abbreviations.map((a) => normalizeDrugText(a)).filter(Boolean);
  const normCat = normalizeDrugText(fields.category);
  const normExtra = normalizeDrugText(fields.extra);

  // 1. Exact abbreviation or code match gets highest priority (e.g., typing "CBC", "CRP", "CXR", "HTN", "DM", "GERD", "سي بي سي")
  if (
    normCode === fullQueryNorm ||
    normAbbrevs.some((ab) => ab === fullQueryNorm)
  ) {
    return 1500;
  }

  // 2. Prefix abbreviation match (e.g., typing "HBA" -> "HBA1C", "ECHO" -> "ECHO")
  if (
    fullQueryNorm.length >= 2 &&
    (normCode.startsWith(fullQueryNorm) ||
      normAbbrevs.some((ab) => ab.startsWith(fullQueryNorm)))
  ) {
    return 1100;
  }

  const haystackWords = [
    ...normAr.split(' '),
    ...normEn.split(' '),
    normCode,
    ...normAbbrevs.flatMap((a) => a.split(' ')),
    ...normCat.split(' '),
    ...normExtra.split(' '),
  ].filter(Boolean);

  const haystackPhonetic = haystackWords.map(toPhoneticSkeleton).filter(Boolean);
  const haystackConsonants = haystackWords.map(toConsonantSkeleton).filter(Boolean);

  const allTokensMatch = tokens.every((token) => {
    // Direct abbreviation match for token
    if (normCode === token || normAbbrevs.some((ab) => ab === token || ab.includes(token))) {
      return true;
    }

    // Direct substring match in Arabic or English name/category
    if (
      normAr.includes(token) ||
      normEn.includes(token) ||
      normCat.includes(token) ||
      normExtra.includes(token)
    ) {
      return true;
    }

    // Phonetic & consonant cross-language match for tokens >= 2 chars
    if (token.length >= 2) {
      const tokenPhon = toPhoneticSkeleton(token);
      if (tokenPhon.length >= 2) {
        if (
          haystackPhonetic.some(
            (hp) =>
              hp.includes(tokenPhon) ||
              (tokenPhon.length >= 4 && hp.length >= 3 && tokenPhon.includes(hp))
          )
        ) {
          return true;
        }
      }

      const tokenCons = toConsonantSkeleton(token);
      if (tokenCons.length >= 3) {
        if (
          haystackConsonants.some(
            (hc) => hc.length >= 3 && (hc.startsWith(tokenCons) || hc.includes(tokenCons))
          )
        ) {
          return true;
        }
      }
    }

    return false;
  });

  if (!allTokensMatch) return 0;

  let score = 100;
  if (normAr.startsWith(fullQueryNorm) || normEn.startsWith(fullQueryNorm)) score += 450;
  else if (normAr.includes(fullQueryNorm) || normEn.includes(fullQueryNorm)) score += 250;
  if (normAbbrevs.some((ab) => ab.includes(fullQueryNorm))) score += 350;

  return score;
}

/**
 * Searches the clinic's Lab Catalog first, then the comprehensive Medical Lab Archive.
 */
export function searchLabsInCatalogAndArchive(
  rawQuery: string,
  clinicCatalog: LabCatalogItem[] = []
): LabCatalogItem[] {
  const fullQueryNorm = normalizeDrugText(rawQuery);
  const tokens = fullQueryNorm.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const seenKeys = new Set<string>();
  const scoredResults: { item: LabCatalogItem; score: number }[] = [];

  const combinedSource: LabCatalogItem[] = [
    ...clinicCatalog.map((item) => ({ ...item, source: 'catalog' as const })),
    ...MEDICAL_LAB_ARCHIVE.map((item) => ({ ...item, source: 'medical-archive' as const })),
  ];

  for (const item of combinedSource) {
    // Enrich clinic catalog items with archive abbreviations/englishName if they match by name
    const archiveMatch =
      item.source === 'catalog'
        ? MEDICAL_LAB_ARCHIVE.find(
            (a) =>
              normalizeDrugText(a.name) === normalizeDrugText(item.name) ||
              (a.code && normalizeDrugText(item.name).includes(normalizeDrugText(a.code)))
          )
        : undefined;

    const enrichedItem: LabCatalogItem = archiveMatch
      ? {
          ...archiveMatch,
          ...item,
          englishName: item.englishName || archiveMatch.englishName,
          code: item.code || archiveMatch.code,
          abbreviations: item.abbreviations || archiveMatch.abbreviations,
          source: item.source,
        }
      : item;

    const dedupeKey = normalizeDrugText(enrichedItem.code || enrichedItem.name);
    if (seenKeys.has(dedupeKey)) continue;

    const baseScore = scoreClinicalMatch(tokens, fullQueryNorm, {
      primaryAr: enrichedItem.name || '',
      primaryEn: enrichedItem.englishName || '',
      code: enrichedItem.code || '',
      abbreviations: enrichedItem.abbreviations || [],
      category: enrichedItem.category || '',
      extra: `${enrichedItem.sampleType || ''} ${enrichedItem.referenceRange || ''}`,
    });

    if (baseScore > 0) {
      seenKeys.add(dedupeKey);
      const finalScore = baseScore + (enrichedItem.source === 'catalog' ? 200 : 0);
      scoredResults.push({ item: enrichedItem, score: finalScore });
    }
  }

  return scoredResults
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * Searches the clinic's Radiology Catalog first, then the comprehensive Medical Radiology Archive.
 */
export function searchRadiologyInCatalogAndArchive(
  rawQuery: string,
  clinicCatalog: RadiologyCatalogItem[] = []
): RadiologyCatalogItem[] {
  const fullQueryNorm = normalizeDrugText(rawQuery);
  const tokens = fullQueryNorm.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const seenKeys = new Set<string>();
  const scoredResults: { item: RadiologyCatalogItem; score: number }[] = [];

  const combinedSource: RadiologyCatalogItem[] = [
    ...clinicCatalog.map((item) => ({ ...item, source: 'catalog' as const })),
    ...MEDICAL_RADIOLOGY_ARCHIVE.map((item) => ({ ...item, source: 'medical-archive' as const })),
  ];

  for (const item of combinedSource) {
    const archiveMatch =
      item.source === 'catalog'
        ? MEDICAL_RADIOLOGY_ARCHIVE.find(
            (a) =>
              normalizeDrugText(a.name) === normalizeDrugText(item.name) ||
              (a.code && normalizeDrugText(item.name).includes(normalizeDrugText(a.code)))
          )
        : undefined;

    const enrichedItem: RadiologyCatalogItem = archiveMatch
      ? {
          ...archiveMatch,
          ...item,
          englishName: item.englishName || archiveMatch.englishName,
          code: item.code || archiveMatch.code,
          abbreviations: item.abbreviations || archiveMatch.abbreviations,
          source: item.source,
        }
      : item;

    const dedupeKey = normalizeDrugText(enrichedItem.code || enrichedItem.name);
    if (seenKeys.has(dedupeKey)) continue;

    const baseScore = scoreClinicalMatch(tokens, fullQueryNorm, {
      primaryAr: enrichedItem.name || '',
      primaryEn: enrichedItem.englishName || '',
      code: enrichedItem.code || '',
      abbreviations: enrichedItem.abbreviations || [],
      category: enrichedItem.category || '',
      extra: enrichedItem.notes || '',
    });

    if (baseScore > 0) {
      seenKeys.add(dedupeKey);
      const finalScore = baseScore + (enrichedItem.source === 'catalog' ? 200 : 0);
      scoredResults.push({ item: enrichedItem, score: finalScore });
    }
  }

  return scoredResults
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * Searches the clinic's Diagnoses Catalog first, then the comprehensive ICD-10 Diagnoses Archive.
 */
export function searchDiagnosesInCatalogAndArchive(
  rawQuery: string,
  clinicCatalog: DiagnosisCatalogItem[] = []
): DiagnosisCatalogItem[] {
  const fullQueryNorm = normalizeDrugText(rawQuery);
  const tokens = fullQueryNorm.split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const seenKeys = new Set<string>();
  const scoredResults: { item: DiagnosisCatalogItem; score: number }[] = [];

  const combinedSource: DiagnosisCatalogItem[] = [
    ...clinicCatalog.map((item) => ({ ...item, source: 'catalog' as const })),
    ...MEDICAL_DIAGNOSES_ARCHIVE.map((item) => ({ ...item, source: 'medical-archive' as const })),
  ];

  for (const item of combinedSource) {
    const archiveMatch =
      item.source === 'catalog'
        ? MEDICAL_DIAGNOSES_ARCHIVE.find(
            (a) =>
              normalizeDrugText(a.code) === normalizeDrugText(item.code) ||
              normalizeDrugText(a.nameEn) === normalizeDrugText(item.nameEn)
          )
        : undefined;

    const enrichedItem: DiagnosisCatalogItem = archiveMatch
      ? {
          ...archiveMatch,
          ...item,
          abbreviations: item.abbreviations || archiveMatch.abbreviations,
          source: item.source,
        }
      : item;

    const dedupeKey = normalizeDrugText(`${enrichedItem.code}-${enrichedItem.nameEn || enrichedItem.nameAr}`);
    if (seenKeys.has(dedupeKey)) continue;

    const baseScore = scoreClinicalMatch(tokens, fullQueryNorm, {
      primaryAr: enrichedItem.nameAr || '',
      primaryEn: enrichedItem.nameEn || '',
      code: enrichedItem.code || '',
      abbreviations: enrichedItem.abbreviations || [],
      category: enrichedItem.category || '',
      extra: '',
    });

    if (baseScore > 0) {
      seenKeys.add(dedupeKey);
      const finalScore = baseScore + (enrichedItem.source === 'catalog' ? 200 : 0);
      scoredResults.push({ item: enrichedItem, score: finalScore });
    }
  }

  return scoredResults
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

/**
 * Live online ICD-10-CM lookup from NIH NLM ClinicalTables API for rare diagnoses
 */
export async function fetchOnlineDiagnosesMatches(
  rawQuery: string,
  signal?: AbortSignal
): Promise<DiagnosisCatalogItem[]> {
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(trimmed)}&maxList=8`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const pairs: [string, string][] = Array.isArray(data?.[3]) ? data[3] : [];
    return pairs.map(([code, nameEn], idx) => ({
      id: `online-icd10-${idx}-${code}`,
      code: code || 'ICD-10',
      nameAr: `${nameEn} (${code})`,
      nameEn: nameEn,
      abbreviations: [code],
      category: 'الأرشيف الطبي العالمي (ICD-10 Online)',
      isFavorite: false,
      active: true,
      source: 'online-archive' as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Live online LOINC Lab Test lookup from NIH NLM ClinicalTables API for rare lab tests
 */
export async function fetchOnlineLabMatches(
  rawQuery: string,
  signal?: AbortSignal
): Promise<LabCatalogItem[]> {
  const trimmed = rawQuery.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?type=question&terms=${encodeURIComponent(trimmed)}&maxList=6`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const pairs: [string, string][] = Array.isArray(data?.[3]) ? data[3] : [];
    return pairs.map(([loincCode, testName], idx) => ({
      id: `online-loinc-${idx}-${loincCode}`,
      name: testName,
      englishName: testName,
      code: loincCode,
      abbreviations: [loincCode],
      category: 'الأرشيف المعملي العالمي (LOINC Online)',
      sampleType: 'عينة معملية قياسية',
      fastingRequired: false,
      isFavorite: false,
      active: true,
      source: 'online-archive' as const,
    }));
  } catch {
    return [];
  }
}
