import { PrescriptionItem } from '../types';

export interface RecurringRxTemplate {
  id: string;
  title: string;
  category?: string;
  diagnoses: Array<{
    id?: string;
    catalogId?: string;
    code?: string;
    nameAr: string;
    nameEn?: string;
    isPrimary?: boolean;
    notes?: string;
  }>;
  prescription: Array<PrescriptionItem>;
  lifestyleAdvice?: string;
  notes?: string;
  isFavorite?: boolean;
}

export const INITIAL_CLINICAL_GUIDES_TEMPLATES: RecurringRxTemplate[] = [
  // 1. الجهاز الهضمي والكبد
  {
    id: 'tmpl-guide-1',
    title: 'بروتوكول جرثومة المعدة H. Pylori (العلاج الرباعي)',
    category: 'الجهاز الهضمي والكبد',
    diagnoses: [
      {
        id: 'diag-hp-1',
        nameAr: 'قرحة والتهاب المعدة بجرثومة الملوية البوابية (H. Pylori Gastritis)',
        nameEn: 'Helicobacter Pylori Gastritis & Peptic Ulcer',
        code: 'K29.7',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-hp-1',
        drugName: 'Nexium 40 mg',
        scientificName: 'Esomeprazole 40mg',
        strength: '40 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد قبل الإفطار والعشاء بنصف ساعة',
        timing: 'قبل الإفطار والعشاء',
        duration: 'لمدة 14 يوماً',
        notes: 'مثبط مضخة البروتون لحماية الغشاء المخاطي للمعدة',
      },
      {
        id: 'rx-hp-2',
        drugName: 'Klacid 500 mg',
        scientificName: 'Clarithromycin 500mg',
        strength: '500 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص كل 12 ساعة بعد الأكل مباشرة',
        timing: 'بعد الأكل',
        duration: 'لمدة 14 يوماً',
        notes: 'مضاد حيوي رئيسي لجرثومة المعدة',
      },
      {
        id: 'rx-hp-3',
        drugName: 'Flagyl 500 mg',
        scientificName: 'Metronidazole 500mg',
        strength: '500 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص كل 8 ساعات بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 14 يوماً',
        notes: 'مضاد بكتيري ولا هوائي',
      },
      {
        id: 'rx-hp-4',
        drugName: 'Augmentin 1 gm',
        scientificName: 'Amoxicillin + Clavulanic acid',
        strength: '1000 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص كل 12 ساعة بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 14 يوماً',
        notes: 'في حال عدم وجود حساسية بنسلين',
      },
    ],
    lifestyleAdvice:
      'الامتناع التام عن الأطعمة الحارة والمقليات والمخللات والمياه الغازية والتدخين والقهوة. تقسيم الوجبات إلى 5 وجبات خفيفة يومياً. عدم الاستلقاء مباشرة بعد الأكل. إعادة فحص مستضد الجرثومة في البراز بعد شهر من انتهاء العلاج.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-2',
    title: 'بروتوكول القولون العصبي وعسر الهضم (IBS Protocol)',
    category: 'الجهاز الهضمي والكبد',
    diagnoses: [
      {
        id: 'diag-ibs-1',
        nameAr: 'متلازمة القولون العصبي واضطراب حركة الأمعاء (IBS)',
        nameEn: 'Irritable Bowel Syndrome',
        code: 'K58.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-ibs-1',
        drugName: 'Duspatalin Retard 200 mg',
        scientificName: 'Mebeverine Hydrochloride',
        strength: '200 mg',
        dosageForm: 'كبسولات ممتدة المفعول',
        dosage: 'كبسولة واحدة مرتين يومياً',
        timing: 'قبل الأكل بنصف ساعة',
        duration: 'لمدة شهر',
        notes: 'مضاد لتقلصات عضلات القولون الملساء',
      },
      {
        id: 'rx-ibs-2',
        drugName: 'Controloc 40 mg',
        scientificName: 'Pantoprazole 40mg',
        strength: '40 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد صباحاً على الريق',
        timing: 'قبل الإفطار',
        duration: 'لمدة 21 يوماً',
        notes: 'لتقليل حموضة المعدة والشعور بالحرقان',
      },
      {
        id: 'rx-ibs-3',
        drugName: 'Visceralgine 50 mg',
        scientificName: 'Tiemonium methylsulfate',
        strength: '50 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص عند اللزوم عند اشتداد المغص',
        timing: 'عند اللزوم',
        duration: 'عند الحاجة',
        notes: 'مسكن للمغص والتقلصات المعوية',
      },
    ],
    lifestyleAdvice:
      'تجنب التوتر والقلق العصبي، شرب الينسون والنعناع والبابونج الدافئ، الابتعاد عن البقوليات والكرنب والأطعمة المسبكة، شرب كميات وفيرة من الماء وممارسة رياضة المشي بانتظام.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-gerd',
    title: 'بروتوكول ارتجاع المريء والتهاب المعدة (GERD Protocol)',
    category: 'الجهاز الهضمي والكبد',
    diagnoses: [
      {
        id: 'diag-gerd-1',
        nameAr: 'ارتجاع المريء والتهاب أسفل المريء الحادي (Gastroesophageal Reflux)',
        nameEn: 'GERD with Esophagitis',
        code: 'K21.0',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-gerd-1',
        drugName: 'Dexilant 60 mg',
        scientificName: 'Dexlansoprazole 60mg',
        strength: '60 mg',
        dosageForm: 'كبسولات',
        dosage: 'كبسولة واحدة صباحاً قبل الإفطار',
        timing: 'قبل الإفطار',
        duration: 'لمدة 30 يوماً',
        notes: 'مضاد حموضة مزدوج التحرر عالية الفعالية',
      },
      {
        id: 'rx-gerd-2',
        drugName: 'Gaviscon Advance Liquid',
        scientificName: 'Sodium alginate + Potassium bicarbonate',
        strength: '10 ml',
        dosageForm: 'شراب معلق',
        dosage: '10 مل بعد الوجبات الرئيسية وعند النوم',
        timing: 'بعد الأكل وعند النوم',
        duration: 'لمدة 14 يوماً',
        notes: 'حاجز رغوي يمنع ارتجاع الحمض إلى المريء',
      },
      {
        id: 'rx-gerd-3',
        drugName: 'Ganaton 50 mg',
        scientificName: 'Itopride Hydrochloride',
        strength: '50 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص 3 مرات يومياً قبل الأكل بنصف ساعة',
        timing: 'قبل الأكل',
        duration: 'لمدة 21 يوماً',
        notes: 'منظم ومسرع لإفراغ المعدة',
      },
    ],
    lifestyleAdvice:
      'رفع رأس السرير 15 سم. تناول العشاء قبل النوم بـ 3 ساعات على الأقل. الامتناع عن الشوكولاتة والنعناع والأطعمة الدهنية والتدخين. خفض الوزن الزائد.',
    isFavorite: false,
  },

  // 2. القلب والأوعية الدموية
  {
    id: 'tmpl-guide-3',
    title: 'بروتوكول ارتفاع ضغط الدم والوقاية القلبية (HTN Protocol)',
    category: 'القلب والأوعية الدموية',
    diagnoses: [
      {
        id: 'diag-htn-1',
        nameAr: 'ارتفاع ضغط الدم الشرياني الأولي (Essential Hypertension)',
        nameEn: 'Essential (Primary) Hypertension',
        code: 'I10',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-htn-1',
        drugName: 'Concor 5 mg',
        scientificName: 'Bisoprolol fumarate',
        strength: '5 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد صباحاً بعد الإفطار',
        timing: 'بعد الإفطار',
        duration: 'علاج مستمر شهرياً',
        notes: 'منظم لضربات القلب وخافض للضغط',
      },
      {
        id: 'rx-htn-2',
        drugName: 'Plavix 75 mg',
        scientificName: 'Clopidogrel 75mg',
        strength: '75 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد يومياً بعد الغداء',
        timing: 'بعد الأكل',
        duration: 'علاج مستمر شهرياً',
        notes: 'مانع للتجلط وتحسين السيولة الدموية',
      },
      {
        id: 'rx-htn-3',
        drugName: 'Crestor 10 mg',
        scientificName: 'Rosuvastatin calcium',
        strength: '10 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد مساءً قبل النوم',
        timing: 'قبل النوم',
        duration: 'علاج مستمر شهرياً',
        notes: 'لخفض الكوليسترول وحماية الشرايين',
      },
    ],
    lifestyleAdvice:
      'تقليل ملح الطعام إلى أقل من 2 جرام يومياً، الامتناع عن المخللات والوجبات السريعة، قياس الضغط وتسجيله صباحاً ومساءً في جدول المتابعة، المشي اليومي 30 دقيقة.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-ihd',
    title: 'بروتوكول قصور الشرايين التاجية والذبحة المستقرة (IHD Protocol)',
    category: 'القلب والأوعية الدموية',
    diagnoses: [
      {
        id: 'diag-ihd-1',
        nameAr: 'قصور الشرايين التاجية والذبحة الصدرية المستقرة (Stable Angina)',
        nameEn: 'Atherosclerotic Heart Disease',
        code: 'I25.10',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-ihd-1',
        drugName: 'Ezallor 20 mg',
        scientificName: 'Rosuvastatin 20mg',
        strength: '20 mg',
        dosageForm: 'كبسولات',
        dosage: 'كبسولة واحدة مساءً قبل النوم',
        timing: 'قبل النوم',
        duration: 'علاج مستمر شهرياً',
        notes: 'خفض دهون الدم وحماية جدار الشرايين',
      },
      {
        id: 'rx-ihd-2',
        drugName: 'Aspocid 75 mg',
        scientificName: 'Acetylsalicylic acid 75mg',
        strength: '75 mg',
        dosageForm: 'أقراص مضغ',
        dosage: 'قرص واحد يومياً بعد الغداء',
        timing: 'بعد الغداء',
        duration: 'علاج مستمر شهرياً',
        notes: 'حماية وتسييل الدم من التجلط',
      },
      {
        id: 'rx-ihd-3',
        drugName: 'Nitromak Retard 2.5 mg',
        scientificName: 'Nitroglycerin 2.5mg',
        strength: '2.5 mg',
        dosageForm: 'كبسولات',
        dosage: 'كبسولة كل 12 ساعة',
        timing: 'بعد الأكل',
        duration: 'علاج مستمر شهرياً',
        notes: 'موسع لشرايين القلب التاجية',
      },
    ],
    lifestyleAdvice:
      'تجنب المجهود البدني الشديد المفاجئ، التوقف الفوري عن التدخين بجميع أنواعه، متابعة تخطيط القلب ورسم القلب بالمجهود بانتظام.',
    isFavorite: false,
  },

  // 3. الغدد الصماء والسكر
  {
    id: 'tmpl-guide-4',
    title: 'بروتوكول داء السكري النوع الثاني والدهون (Type 2 DM)',
    category: 'الغدد الصماء والسكر',
    diagnoses: [
      {
        id: 'diag-dm-1',
        nameAr: 'داء السكري من النوع الثاني بدون مضاعفات (Type 2 Diabetes)',
        nameEn: 'Type 2 Diabetes Mellitus',
        code: 'E11.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-dm-1',
        drugName: 'Janumet 50/1000',
        scientificName: 'Sitagliptin + Metformin HCl',
        strength: '50/1000 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص مرتين يومياً مع الوجبات الرئيسية',
        timing: 'مع الوجبات',
        duration: 'علاج مستمر شهرياً',
        notes: 'مضبوط السكر المزدوج المتطور',
      },
      {
        id: 'rx-dm-2',
        drugName: 'Glucophage 1000 XR',
        scientificName: 'Metformin Hydrochloride XR',
        strength: '1000 mg',
        dosageForm: 'أقراص ممتدة المفعول',
        dosage: 'قرص واحد مساءً بعد العشاء',
        timing: 'بعد العشاء',
        duration: 'علاج مستمر شهرياً',
        notes: 'لتقليل مقاومة الإنسولين الكبدية',
      },
    ],
    lifestyleAdvice:
      'حمية غذائية متوازنة منخفضة الكربوهيدرات والنشويات المكررة، منع السكريات والمشروبات الغازية والعصائر المحلاة، فحص السكر التراكمي HbA1c كل 3 أشهر، فحص القدمين يومياً.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-thyroid',
    title: 'بروتوكول خمول الغدة الدرقية (Hypothyroidism)',
    category: 'الغدد الصماء والسكر',
    diagnoses: [
      {
        id: 'diag-thyroid-1',
        nameAr: 'قصور وخمول الغدة الدرقية الأولي (Primary Hypothyroidism)',
        nameEn: 'Hypothyroidism, Unspecified',
        code: 'E03.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-thyroid-1',
        drugName: 'Euthyrox 50 mcg',
        scientificName: 'Levothyroxine Sodium 50mcg',
        strength: '50 mcg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد صباحاً فور الاستيقاظ مع كوب ماء كبير',
        timing: 'على الريق قبل الإفطار بـ 45 دقيقة',
        duration: 'علاج مستمر شهرياً',
        notes: 'تعويض هرمون الغدة الدرقية - عدم تناول المأكولات أو القهوة فور أخذ القرص',
      },
    ],
    lifestyleAdvice:
      'تناول الجرعة يومياً على الريق والانتظار 45-60 دقيقة قبل تناول الطعام أو القهوة. إجراء فحص هرمون TSH بعد 6 أسابيع لتعديل الجرعة إن لزم.',
    isFavorite: false,
  },

  // 4. الأطفال وحديثي الولادة
  {
    id: 'tmpl-guide-peds-ge',
    title: 'بروتوكول النزلات المعوية للأطفال والجفاف (Pediatric Gastroenteritis)',
    category: 'الأطفال وحديثي الولادة',
    diagnoses: [
      {
        id: 'diag-peds-ge-1',
        nameAr: 'النزلة المعوية الحادة والإسهال لدى الأطفال (Pediatric Gastroenteritis)',
        nameEn: 'Acute Pediatric Gastroenteritis',
        code: 'A09',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-peds-ge-1',
        drugName: 'Rehydran Oral Hydration Salts',
        scientificName: 'Oral Rehydration Salts (ORS)',
        strength: 'كيس محلول',
        dosageForm: 'أكياس جافة تذاب في الماء',
        dosage: 'إذابة كيس في 200 مل ماء معقم وإعطاؤه بالملعقة بعد كل مرة إسهال/قيء',
        timing: 'بعد كل إسهال أو قيء',
        duration: 'لمدة 3-5 أيام',
        notes: 'تعويض الأملاح الحيوية والوقاية من الجفاف',
      },
      {
        id: 'rx-peds-ge-2',
        drugName: 'Cetal Drops / Syrup',
        scientificName: 'Paracetamol 120mg/5ml',
        strength: '120 mg/5ml',
        dosageForm: 'شراب نُقط للأطفال',
        dosage: 'حسب الوزن (10-15 ملغم/كجم) عند اللزوم كل 6 ساعات',
        timing: 'عند الحرارة أو المغص',
        duration: 'عند الحاجة',
        notes: 'خافض حرارة آمن للأطفال',
      },
      {
        id: 'rx-peds-ge-3',
        drugName: 'Smecta Powder',
        scientificName: 'Dioctahedral smectite',
        strength: '3 g',
        dosageForm: 'أكياس بودرة',
        dosage: 'كيس واحد مرتين يومياً يذاب في الماء أو العصير',
        timing: 'بين الوجبات',
        duration: 'لمدة 3 أيام',
        notes: 'مبطن جدار الأمعاء وموقف للإسهال',
      },
    ],
    lifestyleAdvice:
      'استمرار الرضاعة الطبيعية دون توقف. الإكثار من السوائل الدافئة وشوربة الخضار والبطاطس المسلوقة. التوجه الفوري للمستشفى في حال غوار العينين أو جفاف اللسان أو الخمول الشديد.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-peds-otitis',
    title: 'بروتوكول التهاب الأذن الوسطى الحاد للأطفال (Pediatric Otitis Media)',
    category: 'الأطفال وحديثي الولادة',
    diagnoses: [
      {
        id: 'diag-peds-om-1',
        nameAr: 'التهاب الأذن الوسطى الحاد لدى الأطفال (Acute Otitis Media)',
        nameEn: 'Acute Suppurative Otitis Media',
        code: 'H66.0',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-peds-om-1',
        drugName: 'Curam Syrup 457 mg/5ml',
        scientificName: 'Amoxicillin/Clavulanate 400/57',
        strength: '457 mg/5ml',
        dosageForm: 'شراب معلق للأطفال',
        dosage: 'جرعة محسوبة حسب الوزن كل 12 ساعة بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 7 - 10 أيام',
        notes: 'مضاد حيوي واسع المدى لالتهابات الأذن الوسطى',
      },
      {
        id: 'rx-peds-om-2',
        drugName: 'Dolphin Suppositories 12.5 mg',
        scientificName: 'Diclofenac Sodium 12.5mg',
        strength: '12.5 mg',
        dosageForm: 'لبوس شرجي للأطفال',
        dosage: 'لبوسة واحدة عند اللزوم للحرارة الشديدة أو الألم',
        timing: 'عند اللزوم',
        duration: '3 أيام كحد أقصى',
        notes: 'مسكن آلام الأذن الشديدة وخافض حرارة',
      },
    ],
    lifestyleAdvice:
      'تجنب دخول الماء داخل أذن الطفل أثناء الاستحمام. تجنب الرضاعة والطفل مستلقٍ تماماً على ظهره لمنع صعود اللبن لقناة استاكيوس.',
    isFavorite: false,
  },

  // 5. الأنف والأذن والحنجرة
  {
    id: 'tmpl-guide-sinus',
    title: 'بروتوكول التهاب الجيوب الأنفية الحاد (Acute Sinusitis Protocol)',
    category: 'الأنف والأذن والحنجرة',
    diagnoses: [
      {
        id: 'diag-sinus-1',
        nameAr: 'التهاب الجيوب الأنفية الحاد البكتيري (Acute Bacterial Sinusitis)',
        nameEn: 'Acute Maxillary Sinusitis',
        code: 'J01.00',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-sinus-1',
        drugName: 'Hibiotic 1 gm',
        scientificName: 'Amoxicillin + Clavulanic Acid 1g',
        strength: '1000 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص كل 12 ساعة بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 10 أيام',
        notes: 'مضاد حيوي قوي للجيوب الأنفية',
      },
      {
        id: 'rx-sinus-2',
        drugName: 'Nasonex Nasal Spray',
        scientificName: 'Mometasone Furoate 50mcg',
        strength: '50 mcg',
        dosageForm: 'بخاخة أنفية كورتيزونية موضعية',
        dosage: 'بختين بكل فتحة أنف مرة واحدة صباحاً',
        timing: 'صباحاً',
        duration: 'لمدة شهر',
        notes: 'بخاخة مضادة لالتهاب وتورم غشاء الجيوب الأنفية',
      },
      {
        id: 'rx-sinus-3',
        drugName: 'Clarinase Tablets',
        scientificName: 'Loratadine + Pseudoephedrine',
        strength: '5/120 mg',
        dosageForm: 'أقراص ممتدة المفعول',
        dosage: 'قرص كل 12 ساعة بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 7 أيام',
        notes: 'مضاد حساسيات ومزيل لاحتقان الأنف انسداد انسداد',
      },
    ],
    lifestyleAdvice:
      'عمل استنشاق لبخار الماء الدافئ 3 مرات يومياً. غسيل الأنف بـ محلول الملح الفيزيولوجي أو بخاخ مياه البحر (Physiomer). شرب كميات وفيرة من المياه.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-5',
    title: 'بروتوكول نزلات البرد والتهاب الحلق الحاد (Acute URI)',
    category: 'الأنف والأذن والحنجرة',
    diagnoses: [
      {
        id: 'diag-uri-1',
        nameAr: 'التهاب الجهاز التنفسي العلوي والحلق الحاد (Acute Pharyngitis & URI)',
        nameEn: 'Acute Upper Respiratory Infection',
        code: 'J06.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-uri-1',
        drugName: 'Augmentin 1 gm',
        scientificName: 'Amoxicillin + Clavulanic acid',
        strength: '1000 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص كل 12 ساعة بعد الأكل مباشرة',
        timing: 'بعد الأكل',
        duration: 'لمدة 7 أيام',
        notes: 'مضاد حيوي واسع المجال - إكمال الجرعة كاملاً',
      },
      {
        id: 'rx-uri-2',
        drugName: 'Panadol Extra',
        scientificName: 'Paracetamol + Caffeine',
        strength: '500/65 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرصين عند اللزوم بحد أقصى 4 مرات يومياً',
        timing: 'بعد الأكل',
        duration: 'لمدة 5 أيام',
        notes: 'مسكن وخافض للحرارة وآلام الجسم',
      },
      {
        id: 'rx-uri-3',
        drugName: 'Otrivin Adult Spray',
        scientificName: 'Xylometazoline 0.1%',
        strength: '0.1%',
        dosageForm: 'بخاخة أنفية',
        dosage: 'بخة بكل فتحة أنف مرتين يومياً',
        timing: 'عند اللزوم',
        duration: 'لمدة 5 أيام فقط',
        notes: 'مزيل لاحتقان وانسداد الأنف - لا تتجاوز 5 أيام',
      },
    ],
    lifestyleAdvice:
      'الراحة التامة في الفراش، شرب سوائل دافئة بكثرة (ليمون بالعسل، زنجبيل)، الغرغرة بماء دافئ وملح 3 مرات يومياً، الابتعاد عن التيارات الهوائية الباردة.',
    isFavorite: false,
  },

  // 6. الأمراض الجلدية
  {
    id: 'tmpl-guide-derm',
    title: 'بروتوكول الأكزيما والارتيكاريا الجلدية (Dermatitis & Allergy)',
    category: 'الأمراض الجلدية والتناسلية',
    diagnoses: [
      {
        id: 'diag-derm-1',
        nameAr: 'التهاب الجلد التأتبي والأكزيما الحكّة (Atopic Dermatitis & Eczema)',
        nameEn: 'Atopic Dermatitis & Urticaria',
        code: 'L20.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-derm-1',
        drugName: 'Telfast 180 mg',
        scientificName: 'Fexofenadine Hydrochloride 180mg',
        strength: '180 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد مساءً قبل النوم',
        timing: 'قبل النوم',
        duration: 'لمدة 14 يوماً',
        notes: 'مضاد الهستامين غير مسبب للنعاس للحكة الجلدية',
      },
      {
        id: 'rx-derm-2',
        drugName: 'Betaderm Cream',
        scientificName: 'Betamethasone valerate 0.1%',
        strength: '0.1%',
        dosageForm: 'دهان كريم موضعي',
        dosage: 'دهان طبقة رقيقة على المناطق المصابة مرتين يومياً',
        timing: 'صباحاً ومساءً',
        duration: 'لمدة 7 أيام فقط',
        notes: 'مضاد التهاب وكورتيزون موضعي خفيف',
      },
      {
        id: 'rx-derm-3',
        drugName: 'Atoderm Moisturizing Ointment',
        scientificName: 'Emollient Cream',
        strength: '200 ml',
        dosageForm: 'كريم مرطب',
        dosage: 'دهان مرطب بعد الاستحمام وعند الجفاف',
        timing: 'عند الحاجة',
        duration: 'مستمر',
        notes: 'ترطيب وتنعيم الحاجز الجلدي',
      },
    ],
    lifestyleAdvice:
      'تجنب الاستحمام بماء شديد السخونة. استخدام صابون طبي مرطب خالي من العطور (كصابون الجلسرين أو الدوف). ارتداء ملابس قطنية فضفاضة وتجنب الألياف الصناعية والصوف المباشر.',
    isFavorite: false,
  },

  // 7. العظام والمفاصل
  {
    id: 'tmpl-guide-ortho-oa',
    title: 'بروتوكول خشونة وتأكل مفاصل الركبة (Knee Osteoarthritis)',
    category: 'العظام والمفاصل',
    diagnoses: [
      {
        id: 'diag-ortho-1',
        nameAr: 'خشونة وتأكل غضاريف مفصل الركبة (Osteoarthritis of Knee)',
        nameEn: 'Osteoarthritis of Knee',
        code: 'M17.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-ortho-1',
        drugName: 'Arcoxia 90 mg',
        scientificName: 'Etoricoxib 90mg',
        strength: '90 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد يومياً بعد الغداء',
        timing: 'بعد الغداء',
        duration: 'لمدة 14 يوماً',
        notes: 'مضاد التهاب ومسكن مفاصل انتقائي آمن على المعدة',
      },
      {
        id: 'rx-ortho-2',
        drugName: 'Dorfine Capsules',
        scientificName: 'Glucosamine + Chondroitin',
        strength: '500 mg',
        dosageForm: 'كبسولات',
        dosage: 'كبسولة 3 مرات يومياً بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 3 أشهر',
        notes: 'مكمل لبناء وترميم غضاريف المفصل',
      },
      {
        id: 'rx-ortho-3',
        drugName: 'Catafast 50 mg Sachets',
        scientificName: 'Diclofenac Potassium 50mg',
        strength: '50 mg',
        dosageForm: 'أكياس فوارة',
        dosage: 'كيس فوار عند اللزوم الشديد في نصف كوب ماء',
        timing: 'عند اللزوم',
        duration: 'عند الحاجة',
        notes: 'فوار سريع لتسكن الآلام المباشرة',
      },
    ],
    lifestyleAdvice:
      'تجنب ثني الركبة الشديد أو الجلوس على الأرض (التربيع). تخفيف الوزن الزائد لتقليل الحمل على الركبتين. تقوية عضلات الفخذ الأمامية بتمارين التأهيل الرياضي.',
    isFavorite: true,
  },
  {
    id: 'tmpl-guide-ortho-back',
    title: 'بروتوكول آلام أسفل الظهر والتقلص العضلي (Acute Lumbar Pain)',
    category: 'العظام والمفاصل',
    diagnoses: [
      {
        id: 'diag-back-1',
        nameAr: 'آلام أسفل الظهر والتقلص العضلي الفقري (Low Back Pain & Muscle Spasm)',
        nameEn: 'Low Back Pain & Lumbar Strain',
        code: 'M54.5',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-back-1',
        drugName: 'Dimra Tablets',
        scientificName: 'Methocarbamol + Diclofenac Potassium',
        strength: '500/50 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص مرتين يومياً بعد الأكل',
        timing: 'بعد الأكل',
        duration: 'لمدة 10 أيام',
        notes: 'بسيط للضلوع ومسكن قوي للتقلص العضلي',
      },
      {
        id: 'rx-back-2',
        drugName: 'Milga Advance Tablets',
        scientificName: 'Benfotiamine + B6 + B12',
        strength: 'مركب فئة ب',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد يومياً بعد الإفطار',
        timing: 'بعد الإفطار',
        duration: 'لمدة شهر',
        notes: 'مقوي ومغذي للأعصاب الحركية والجذور العصبية',
      },
      {
        id: 'rx-back-3',
        drugName: 'Algason Massage Cream',
        scientificName: 'Diethylamine salicylate + Menthol',
        strength: '40 g',
        dosageForm: 'دهان مساج',
        dosage: 'دهان دافئ للظهر مرتين يومياً',
        timing: 'صباحاً ومساءً',
        duration: 'لمدة 10 أيام',
        notes: 'دهان موضعي للحرارة والراحة العضلية',
      },
    ],
    lifestyleAdvice:
      'تجنب حمل الأشياء الثقيلة نهائياً. النوم على مرتبة طبية متوسطة الصلابة. عند التقاط أي شيء من الأرض يتم ثني الركبتين وليس الظهر.',
    isFavorite: false,
  },

  // 8. المسالك البولية
  {
    id: 'tmpl-guide-uti',
    title: 'بروتوكول التهاب مجاري البول وحصوات الكلى (UTI Protocol)',
    category: 'المسالك البولية والذكورة',
    diagnoses: [
      {
        id: 'diag-uti-1',
        nameAr: 'التهاب المثانة والمجاري البولية الحاد (Acute Cystitis & UTI)',
        nameEn: 'Acute Cystitis',
        code: 'N30.0',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-uti-1',
        drugName: 'Ciprobay 500 mg',
        scientificName: 'Ciprofloxacin 500mg',
        strength: '500 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص كل 12 ساعة بعد الأكل مع شرب كوب ماء كبير',
        timing: 'بعد الأكل',
        duration: 'لمدة 7 أيام',
        notes: 'مضاد بكتيري متفوق لالتهابات مجاري البول',
      },
      {
        id: 'rx-uti-2',
        drugName: 'Urivin Effervescent Granules',
        scientificName: 'Piperazine + Colchicine + Atropine',
        strength: 'أكياس فوار',
        dosageForm: 'أكياس فوارة',
        dosage: 'كيس فوار على نصف كوب ماء 3 مرات يومياً',
        timing: 'قبل الوجبات',
        duration: 'لمدة 7 أيام',
        notes: 'مطهر ومطرد لأملاح اليورات ومخفف لحرقان البول',
      },
      {
        id: 'rx-uti-3',
        drugName: 'Rowatinex Capsules',
        scientificName: 'Essential Oils for Urinary Tract',
        strength: 'كبسولات',
        dosageForm: 'كبسولات',
        dosage: 'كبسولة واحدة 3 مرات يومياً قبل الأكل',
        timing: 'قبل الأكل',
        duration: 'لمدة 14 يوماً',
        notes: 'موسع للمجاري البولية وتفتيت الرواسب',
      },
    ],
    lifestyleAdvice:
      'شرب ما لا يقل عن 3 ليتر ماء نقي يومياً. تجنب احتباس البول لفترات طويلة. تقليل الفلفل الأسمر والبهارات والمخللات والمانجو والفراولة.',
    isFavorite: true,
  },

  // 9. النساء والتوليد
  {
    id: 'tmpl-guide-obgyn',
    title: 'بروتوكول متابعة الحمل ونقص الحديد (Antenatal Care & Anemia)',
    category: 'النساء والتوليد',
    diagnoses: [
      {
        id: 'diag-obgyn-1',
        nameAr: 'متابعة الحمل الروتيني وأنيميا نقص الحديد (Antenatal Care & Anemia)',
        nameEn: 'Normal Pregnancy & Iron Deficiency',
        code: 'Z34.9',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-obgyn-1',
        drugName: 'Fertron / Ferroglobe Capsules',
        scientificName: 'Iron + Folic Acid + Vitamin C',
        strength: 'كبسولات',
        dosageForm: 'كبسولات',
        dosage: 'كبسولة واحدة يومياً بعد الغداء',
        timing: 'بعد الغداء',
        duration: 'طوال فترة الحمل',
        notes: 'حديد مقوي مع حمض الفوليك لمنع الأنيميا',
      },
      {
        id: 'rx-obgyn-2',
        drugName: 'Calcimate / Osteocare Tablets',
        scientificName: 'Calcium + Vitamin D3 + Magnesium',
        strength: '500 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد يومياً بعد الإفطار',
        timing: 'بعد الإفطار',
        duration: 'طوال فترة الحمل (بداية من الشهر الرابع)',
        notes: 'كالسيوم وفيتامين د لحماية العظام وصحة الجنين',
      },
    ],
    lifestyleAdvice:
      'التغذية المتوازنة الغنية بالبروتينات والخضروات الورقية الخضراء. تجنب تناول الشاي أو القهوة فور أخذ كبسولة الحديد. إجراء الفحص بالسونار بشكل دوري.',
    isFavorite: false,
  },

  // 10. المخ والأعصاب
  {
    id: 'tmpl-guide-neuro',
    title: 'بروتوكول الصداع النصفي والوعائي (Migraine Protocol)',
    category: 'المخ والأعصاب',
    diagnoses: [
      {
        id: 'diag-neuro-1',
        nameAr: 'نوبات الصداع النصفي والوعائي الشديد (Migraine without aura)',
        nameEn: 'Migraine, Unspecified',
        code: 'G43.909',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-neuro-1',
        drugName: 'Imigran 50 mg',
        scientificName: 'Sumatriptan 50mg',
        strength: '50 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد عند بداية شعور النوبة النصفي (يمكن تكراره بعد ساعتين)',
        timing: 'عند بداية النوبة',
        duration: 'عند اللزوم',
        notes: 'مضاد نوبات الصداع النصفي النوعي',
      },
      {
        id: 'rx-neuro-2',
        drugName: 'Cataflam 50 mg',
        scientificName: 'Diclofenac Potassium 50mg',
        strength: '50 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص عند اللزوم بعد الطعام',
        timing: 'بعد الأكل',
        duration: 'عند الحاجة',
        notes: 'مسكن آلام سريع المفعول',
      },
      {
        id: 'rx-neuro-3',
        drugName: 'Stugeron 25 mg',
        scientificName: 'Cinnarizine 25mg',
        strength: '25 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص مساءً قبل النوم',
        timing: 'قبل النوم',
        duration: 'لمدة شهر',
        notes: 'محسن للدورة الدموية المخية ومانع للدوار',
      },
    ],
    lifestyleAdvice:
      'الاسترخاء في غرفة مظلمة وهادئة عند بدء النوبة. تجنب المحفزات كـ الشوكولاتة، الأجبان المعتقة، السهر، الضوضاء والإضاءة الساطعة جداً.',
    isFavorite: true,
  },

  // 11. الأمراض الصدرية
  {
    id: 'tmpl-guide-chest',
    title: 'بروتوكول نوبات الربو الشعبي والحساسية (Bronchial Asthma)',
    category: 'الأمراض الصدرية والتنفسية',
    diagnoses: [
      {
        id: 'diag-chest-1',
        nameAr: 'أزمة وتهيج الربو الشعبي الحاد (Bronchial Asthma Exacerbation)',
        nameEn: 'Unspecified Asthma with Exacerbation',
        code: 'J45.901',
        isPrimary: true,
      },
    ],
    prescription: [
      {
        id: 'rx-chest-1',
        drugName: 'Ventolin Inhaler 100 mcg',
        scientificName: 'Salbutamol Inhaler',
        strength: '100 mcg',
        dosageForm: 'بخاخة صدرية شفاطة',
        dosage: 'بختين عند ضيق التنفس أو الشخير الصدري',
        timing: 'عند اللزوم',
        duration: 'عند الحاجة',
        notes: 'موسع شعبي سريع للإغاثة الفورية',
      },
      {
        id: 'rx-chest-2',
        drugName: 'Symbicort Turbuhaler 160/4.5',
        scientificName: 'Budesonide + Formoterol',
        strength: '160/4.5 mcg',
        dosageForm: 'بودرة بخاخة استنشاق',
        dosage: 'شفطة واحدة مرتين يومياً صباحاً ومساءً (مضمضة الفم بالماء بعدها)',
        timing: 'صباحاً ومساءً',
        duration: 'مستمر شهرياً',
        notes: 'بخاخة وقائية مضادة لالتهاب وتورم الشعب الهوائية',
      },
      {
        id: 'rx-chest-3',
        drugName: 'Singulair 10 mg',
        scientificName: 'Montelukast Sodium 10mg',
        strength: '10 mg',
        dosageForm: 'أقراص (Tablets)',
        dosage: 'قرص واحد مساءً قبل النوم',
        timing: 'قبل النوم',
        duration: 'لمدة شهر',
        notes: 'مغلق مستقبلات الليوكوترين للحد من أزمات الربو الليلية',
      },
    ],
    lifestyleAdvice:
      'تجنب الأتربة والدخان والبخور والعطور النفاذة. تجنب التعرض المفاجئ للتكييف البارد. المضمضة الجيدة بالماء والغسيل بعد استخدام بخاخات الكورتيزون.',
    isFavorite: true,
  },
];

import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'soli_recurring_rx_templates';

let cachedTemplates: RecurringRxTemplate[] = INITIAL_CLINICAL_GUIDES_TEMPLATES;

export function loadRecurringTemplates(): RecurringRxTemplate[] {
  return cachedTemplates;
}

export function setCachedRecurringTemplates(templates: RecurringRxTemplate[]): void {
  if (Array.isArray(templates) && templates.length > 0) {
    cachedTemplates = templates;
  }
}

export function saveRecurringTemplates(templates: RecurringRxTemplate[]): void {
  cachedTemplates = templates;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('soli_templates_updated'));

  if (db) {
    setDoc(doc(db, 'settings', 'recurringTemplates'), { items: templates }, { merge: true }).catch((err) => {
      console.warn('Failed to sync recurring templates to Firestore:', err);
    });
  }
}

export function addOrUpdateRecurringTemplate(template: RecurringRxTemplate): RecurringRxTemplate[] {
  const current = loadRecurringTemplates();
  const existingIdx = current.findIndex((t) => t.id === template.id);
  let updated: RecurringRxTemplate[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = template;
  } else {
    updated = [template, ...current];
  }
  saveRecurringTemplates(updated);
  return updated;
}

export function deleteRecurringTemplate(templateId: string): RecurringRxTemplate[] {
  const current = loadRecurringTemplates();
  const updated = current.filter((t) => t.id !== templateId);
  saveRecurringTemplates(updated);
  return updated;
}
