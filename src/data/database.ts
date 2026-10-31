import {
  User,
  DoctorProfile,
  ClinicLocation,
  Patient,
  Appointment,
  Visit,
  Invoice,
  Payment,
  ServiceItem,
  FollowUp,
  Prescription,
  Medication,
  LabTest,
  LabOrder,
  RadiologyType,
  RadiologyOrder,
  Diagnosis,
  Symptom,
  ChronicDisease,
  DoctorSettings,
  SystemSettings,
  PrescriptionItemSnapshot,
} from '../types/database';

// 1. Users
export const INITIAL_USERS: User[] = [
  {
    userId: 'user-doc-1',
    name: 'طبيب العيادة',
    email: 'doctor@solimedical.com',
    role: 'DOCTOR',
    active: true,
    preferredLanguage: 'ar',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    userId: 'user-rec-1',
    name: 'سارة عبد المنعم (الاستقبال)',
    email: 'reception@solimedical.com',
    role: 'SECRETARY',
    active: true,
    preferredLanguage: 'ar',
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    userId: 'user-adm-1',
    name: 'مدير النظام التنفيذي',
    email: 'admin@solimedical.com',
    role: 'ADMIN',
    active: true,
    preferredLanguage: 'ar',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
];

// 2. Doctor Profile (doctorProfile/main)
export const INITIAL_DOCTOR_PROFILE: DoctorProfile = {
  nameAr: 'طبيب العيادة',
  nameEn: 'Clinic Doctor',
  specialtyAr: 'التخصص الطبي العام للعيادة',
  specialtyEn: 'Clinic Medical Specialty',
  degreesAr: 'الدرجات العلمية والشهادات المهنية والزمالات المسجلة للعيادة',
  degreesEn: 'Registered Medical Degrees & Professional Credentials',
  phone: '01092847162',
  email: 'doctor@solimedical.com',
  licenseNumber: 'EG-DOC-48291-GZ',
  logoUrl:
    'https://lh3.googleusercontent.com/aida/AEtjO1Vrz2i_HQu2ilGlpVeZEGuk5DJ-Hht9rT6kliDB3hw3PS9-J_HHQDvOL2_3KTsKZltGHed8eeV6j-T92TfU71y81R42_shFQGUbl8PoChY9f9-JS7WVLRy1Rm_MIs9jdOIENTv9rc4cn1CZ2mYRpZ99A_xBMuvFOOecFL44A0vQxciThRZCgZkB1qBCOh6IxAZL5w9rIeWEToXoP_cI9IlvDyLX0g8MJLfxYOFzk31i-sXkrAu1lN-FsiaoTggRuYle0SUD-iLa',
  prescriptionSettings: {
    paperSize: 'A5',
    headerHeight: 120,
    footerHeight: 80,
    showWatermark: true,
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-10-15T00:00:00Z',
};

// 3. Clinic Locations (clinicLocations/{locationId})
export const INITIAL_CLINIC_LOCATIONS: ClinicLocation[] = [
  {
    locationId: 'loc-mohandessin',
    nameAr: 'العيادة الرئيسية - المهندسين',
    nameEn: 'Main Clinic - Mohandessin',
    addressAr: '24 شارع سوريا - تقاطع جزيرة العرب، الدور الثالث، شقة 7',
    addressEn: '24 Souria St., Mohandessin, 3rd Floor, Giza',
    phone: '02-37618920',
    active: true,
    workingHours: [
      { day: 6, enabled: true, from: '16:00', to: '22:00' }, // Saturday
      { day: 1, enabled: true, from: '16:00', to: '22:00' }, // Monday
      { day: 3, enabled: true, from: '16:00', to: '22:00' }, // Wednesday
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    locationId: 'loc-dokki',
    nameAr: 'فرع الدقي - مركز التحرير التخصصي',
    nameEn: 'Dokki Branch - Tahrir Center',
    addressAr: '98 شارع التحرير، ميدان الدقي - برج الأطباء، الدور السادس',
    addressEn: '98 Tahrir St., Dokki Sq., Medical Tower 6th Floor, Giza',
    phone: '02-33385210',
    active: true,
    workingHours: [
      { day: 0, enabled: true, from: '18:00', to: '23:30' }, // Sunday
      { day: 2, enabled: true, from: '18:00', to: '23:30' }, // Tuesday
      { day: 4, enabled: true, from: '18:00', to: '23:30' }, // Thursday
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// 4. Services (services/{serviceId})
export const INITIAL_SERVICES: ServiceItem[] = [
  {
    serviceId: 'srv-consultation-new',
    nameAr: 'كشف عيادة أول مرة (فحص شامل)',
    nameEn: 'New Internal Consultation',
    price: 300,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    serviceId: 'srv-followup-free',
    nameAr: 'متابعة علاج (خلال 7 إلى 14 يوماً)',
    nameEn: 'Follow-Up Consultation (7 to 14 Days)',
    price: 0,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    serviceId: 'srv-followup-paid',
    nameAr: 'إعادة كشف (بعد انقضاء مهلة الاستشارة)',
    nameEn: 'Extended Follow-Up Consultation',
    price: 180,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    serviceId: 'srv-ecg',
    nameAr: 'رسم قلب كهربائي 12 قناة (ECG)',
    nameEn: '12-Lead Electrocardiogram',
    price: 100,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    serviceId: 'srv-ultrasound-abdo',
    nameAr: 'سونار وموجات صوتية للبطن والحوض',
    nameEn: 'Abdominal & Pelvic Ultrasound',
    price: 250,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    serviceId: 'srv-glucose-rapid',
    nameAr: 'قياس فوري لسكر الدم العشوائي (RBS)',
    nameEn: 'Random Blood Sugar Rapid Test',
    price: 30,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// 5. Patients (patients/{patientId})
// Rule: fullName is REQUIRED, all other fields are OPTIONAL
export const INITIAL_PATIENTS: Patient[] = [];

// 6. Appointments (appointments/{appointmentId})
// Crucial rule: Does NOT contain paymentId, invoiceId, or visitId at creation!
export const INITIAL_APPOINTMENTS: Appointment[] = [];

// 7. Visits (visits/{visitId})
// Crucial rule: Single source of truth for current status and waiting queue!
// Waiting queue is a VIEW derived from visits where status == "WAITING".
export const INITIAL_VISITS: Visit[] = [];

// 8. Invoices (invoices/{invoiceId})
export const INITIAL_INVOICES: Invoice[] = [];

// 9. Payments (payments/{paymentId})
// Treasury and cash records are calculated directly from actual payments
export const INITIAL_PAYMENTS: Payment[] = [];

// 10. Follow-ups (followUps/{followUpId})
// Snapshot rule: fee and isFree are preserved at creation time
export const INITIAL_FOLLOWUPS: FollowUp[] = [];

// 11. Prescriptions (prescriptions/{prescriptionId})
// Snapshot rule: Stores medication names and strengths as snapshots
export const INITIAL_PRESCRIPTIONS: Prescription[] = [];

// 12. Master Medications Catalog (medications/{medicationId})
// Supports LOCAL, EGYPTIAN_ARCHIVE, and CUSTOM sources. Soft-delete: active = false
export const INITIAL_MEDICATIONS: Medication[] = [
  {
    medicationId: 'med-1',
    nameAr: 'كونكور 5 بلس (Concor 5 Plus)',
    nameEn: 'Concor 5 Plus',
    genericName: 'Bisoprolol Fumarate + Hydrochlorothiazide',
    strength: '5mg / 12.5mg',
    form: 'أقراص',
    manufacturer: 'Merck Serono',
    source: 'EGYPTIAN_ARCHIVE',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    medicationId: 'med-2',
    nameAr: 'جلوكوفاج إكس آر 1000 (Glucophage XR)',
    nameEn: 'Glucophage XR 1000 mg',
    genericName: 'Metformin Hydrochloride (Extended Release)',
    strength: '1000 mg',
    form: 'أقراص ممتدة المفعول',
    manufacturer: 'Merck',
    source: 'EGYPTIAN_ARCHIVE',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    medicationId: 'med-3',
    nameAr: 'ليبيتور 20 مجم (Lipitor 20 mg)',
    nameEn: 'Lipitor 20 mg',
    genericName: 'Atorvastatin Calcium',
    strength: '20 mg',
    form: 'أقراص',
    manufacturer: 'Pfizer',
    source: 'EGYPTIAN_ARCHIVE',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    medicationId: 'med-4',
    nameAr: 'نيكسيوم 40 مجم (Nexium 40 mg)',
    nameEn: 'Nexium 40 mg',
    genericName: 'Esomeprazole Magnesium',
    strength: '40 mg',
    form: 'أقراص معوية التغليف',
    manufacturer: 'AstraZeneca',
    source: 'EGYPTIAN_ARCHIVE',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    medicationId: 'med-5',
    nameAr: 'جاست ريج 200 مجم (Gastreg 200 mg)',
    nameEn: 'Gastreg 200 mg',
    genericName: 'Trimebutine maleate',
    strength: '200 mg',
    form: 'أقراص',
    manufacturer: 'Amoun Pharmaceuticals',
    source: 'LOCAL',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    medicationId: 'med-6',
    nameAr: 'إلتيروكسين 100 ميكروجرام (Eltroxin 100 mcg)',
    nameEn: 'Eltroxin 100 mcg',
    genericName: 'Levothyroxine Sodium',
    strength: '100 mcg',
    form: 'أقراص',
    manufacturer: 'GSK',
    source: 'EGYPTIAN_ARCHIVE',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// 13. Master Lab Tests Catalog (labTests/{labTestId})
export const INITIAL_LAB_TESTS: LabTest[] = [
  {
    labTestId: 'lab-1',
    nameAr: 'صورة دم كاملة (Complete Blood Count - CBC)',
    nameEn: 'CBC with Differential',
    category: 'أمراض الدم (Hematology)',
    sampleType: 'عينة دم وريدي EDTA',
    referenceRange: 'الهيموجلوبين: 13.5 - 17.5 g/dL (ذكور)',
    fastingRequired: false,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    labTestId: 'lab-2',
    nameAr: 'السكر التراكمي (HbA1c - Glycated Hemoglobin)',
    nameEn: 'HbA1c Glycated Hemoglobin',
    category: 'كيمياء حيوية وسكري',
    sampleType: 'عينة دم وريدي',
    referenceRange: '< 5.7% طبيعي / 5.7 - 6.4% مرحلة ما قبل السكري / >= 6.5% سكري',
    fastingRequired: false,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    labTestId: 'lab-3',
    nameAr: 'وظائف كلى (Creatinine, Urea & eGFR)',
    nameEn: 'Kidney Function Tests (KFT)',
    category: 'كيمياء حيوية',
    sampleType: 'عينة دم مصل',
    referenceRange: 'الكرياتينين: 0.7 - 1.3 mg/dL',
    fastingRequired: false,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    labTestId: 'lab-4',
    nameAr: 'دهون الدم الكاملة (Lipid Profile: Chol, TG, HDL, LDL)',
    nameEn: 'Complete Lipid Profile',
    category: 'كيمياء حيوية وقلب',
    sampleType: 'عينة دم مصل',
    referenceRange: 'الكوليسترول الكلي < 200 mg/dL / LDL < 100 mg/dL',
    fastingRequired: true,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    labTestId: 'lab-5',
    nameAr: 'جرثومة المعدة في البراز (H. Pylori Stool Antigen)',
    nameEn: 'H. Pylori Antigen in Stool',
    category: 'جهاز هضمي ومناعة',
    sampleType: 'عينة براز طازجة',
    referenceRange: 'Negative (سلبي)',
    fastingRequired: false,
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// 14. Lab Orders (labOrders/{labOrderId})
// Applied status: ORDERED [طلب] | RESULT [نتيجة] | REPORT [تقرير]
export const INITIAL_LAB_ORDERS: LabOrder[] = [
  {
    labOrderId: 'lo-prev-101',
    patientId: 'pat-1',
    visitId: 'vis-prev-101',
    testId: 'lab-1',
    testName: 'صوره الدم',
    status: 'RESULT',
    result: '12',
    notes: 'تحليل دم كامل',
    orderedAt: '2026-08-28T19:49:00Z',
    updatedAt: '2026-08-28T20:10:00Z',
  },
  {
    labOrderId: 'lo-1',
    patientId: 'pat-1',
    visitId: 'vis-101',
    testId: 'lab-2',
    testName: 'السكر التراكمي (HbA1c)',
    status: 'ORDERED',
    result: '',
    notes: 'مطلوب إجراؤه قبل موعد الاستشارة القادم',
    orderedAt: '2026-09-05T17:00:00Z',
    updatedAt: '2026-09-05T17:00:00Z',
  },
  {
    labOrderId: 'lo-2',
    patientId: 'pat-1',
    visitId: 'vis-101',
    testId: 'lab-3',
    testName: 'وظائف كلى (Creatinine & eGFR)',
    status: 'ORDERED',
    result: '',
    notes: 'للاطمئنان على كفاءة الكليتين مع أدوية الضغط',
    orderedAt: '2026-09-05T17:00:00Z',
    updatedAt: '2026-09-05T17:00:00Z',
  },
  {
    labOrderId: 'lo-3',
    patientId: 'pat-2',
    visitId: 'vis-102',
    testId: 'lab-5',
    testName: 'جرثومة المعدة في البراز (H. Pylori Stool Ag)',
    status: 'RESULT',
    result: 'Negative (سلبي) - تم القضاء على الجرثومة بنجاح',
    notes: 'تحليل المتابعة بعد انتهاء العلاج الثلاثي',
    orderedAt: '2026-08-25T14:00:00Z',
    updatedAt: '2026-09-05T17:15:00Z',
  },
];

// 15. Master Radiology Types Catalog (radiologyTypes/{radiologyId})
export const INITIAL_RADIOLOGY_TYPES: RadiologyType[] = [
  {
    radiologyId: 'rad-1',
    nameAr: 'أشعة الصدر العادية (Chest X-Ray PA/Lat)',
    nameEn: 'Chest X-Ray PA/Lateral',
    category: 'أشعة سينية (X-Ray)',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    radiologyId: 'rad-2',
    nameAr: 'موجات صوتية على البطن والحوض (Abdominal & Pelvic US)',
    nameEn: 'Abdominal & Pelvic Ultrasound',
    category: 'موجات صوتية (Ultrasound)',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    radiologyId: 'rad-3',
    nameAr: 'موجات صوتية إيكو على القلب (Echocardiography & Doppler)',
    nameEn: 'Echocardiography & Color Doppler',
    category: 'موجات صوتية (Ultrasound)',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    radiologyId: 'rad-4',
    nameAr: 'دوبلر ملون على أوردة الطرفين السفليين (Venous Doppler)',
    nameEn: 'Venous Doppler Lower Limbs',
    category: 'دوبلر ملون (Doppler)',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    radiologyId: 'rad-5',
    nameAr: 'دوبلر على شرايين الرقبة السباتية (Carotid Doppler)',
    nameEn: 'Carotid Arteries Doppler',
    category: 'دوبلر ملون (Doppler)',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

// 16. Radiology Orders (radiologyOrders/{radiologyOrderId})
// Applied status: ORDERED [طلب] | RESULT [نتيجة] | REPORT [تقرير]
export const INITIAL_RADIOLOGY_ORDERS: RadiologyOrder[] = [
  {
    radiologyOrderId: 'ro-prev-101',
    patientId: 'pat-1',
    visitId: 'vis-prev-101',
    radiologyTypeId: 'rad-3',
    radiologyName: 'اشعه ايكو',
    status: 'ORDERED',
    result: '',
    report: '',
    notes: 'مطلوب إيكو على القلب',
    orderedAt: '2026-08-28T19:49:00Z',
    updatedAt: '2026-08-28T19:49:00Z',
  },
  {
    radiologyOrderId: 'ro-1',
    patientId: 'pat-1',
    visitId: 'vis-101',
    radiologyTypeId: 'rad-2',
    radiologyName: 'موجات صوتية على البطن والحوض (Abdominal US)',
    status: 'ORDERED',
    result: '',
    report: 'مطلوب صيام 6 ساعات قبل موعد الفحص التلفزيوني',
    notes: 'فحص الكبد والمرارة والمسالك البولية',
    orderedAt: '2026-09-05T17:00:00Z',
    updatedAt: '2026-09-05T17:00:00Z',
  },
  {
    radiologyOrderId: 'ro-2',
    patientId: 'pat-3',
    visitId: 'vis-prev-09',
    radiologyTypeId: 'rad-3',
    radiologyName: 'إيكو على القلب (Echocardiography)',
    status: 'REPORT',
    result: 'EF 56% - تضخم طفيف بجدار البطين الأيسر LVH',
    report:
      'تقرير الإيكو: الصمام الأورطي والميترالي بحالة جيدة، لا يوجد ارتجاع مؤثر، كفاءة انقباضية مقبولة مع ارتخاء بطيني مبكر من الدرجة الأولى',
    notes: 'فحص دوري لتقييم كفاءة القلب بعد القسطرة',
    orderedAt: '2026-08-28T19:00:00Z',
    updatedAt: '2026-09-01T11:00:00Z',
  },
];

// 17. Diagnoses Catalog (diagnoses/{diagnosisId})
export const INITIAL_DIAGNOSES: Diagnosis[] = [
  {
    diagnosisId: 'diag-1',
    nameAr: 'داء السكري من النوع الثاني غير المعتمد على الأنسولين',
    nameEn: 'Type 2 Diabetes Mellitus without complications',
    code: 'E11.9',
    codeSystem: 'ICD10',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    diagnosisId: 'diag-2',
    nameAr: 'ارتفاع ضغط الدم الأساسي (الأولي)',
    nameEn: 'Essential (primary) Hypertension',
    code: 'I10',
    codeSystem: 'ICD10',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    diagnosisId: 'diag-3',
    nameAr: 'مرض الارتجاع المعدي المريئي (GERD)',
    nameEn: 'Gastro-esophageal Reflux Disease without esophagitis',
    code: 'K21.9',
    codeSystem: 'ICD10',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    diagnosisId: 'diag-4',
    nameAr: 'متلازمة القولون العصبي التشنجي',
    nameEn: 'Irritable Bowel Syndrome without diarrhea',
    code: 'K58.9',
    codeSystem: 'ICD10',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    diagnosisId: 'diag-5',
    nameAr: 'قصور الشرايين التاجية المزمن المستقر',
    nameEn: 'Atherosclerotic Heart Disease of native coronary artery',
    code: 'I25.1',
    codeSystem: 'ICD10',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    diagnosisId: 'diag-6',
    nameAr: 'فرط دهون الدم المختلط',
    nameEn: 'Mixed Hyperlipidemia',
    code: 'E78.2',
    codeSystem: 'ICD10',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
];

// 18. Symptoms Catalog (symptoms/{symptomId})
export const INITIAL_SYMPTOMS: Symptom[] = [
  { symptomId: 'sym-1', nameAr: 'صداع نابض مستمر بالجبهة أو مؤخرة الرأس', nameEn: 'Throbbing Headache', category: 'أعصاب ورأس', active: true },
  { symptomId: 'sym-2', nameAr: 'دوخة أو هبوط مفاجئ وزغللة بالعينين', nameEn: 'Dizziness & Lightheadedness', category: 'عام ودورة دموية', active: true },
  { symptomId: 'sym-3', nameAr: 'خفقان وتسارع بضربات القلب Palpitations', nameEn: 'Palpitations', category: 'القلب والأوعية', active: true },
  { symptomId: 'sym-4', nameAr: 'حموضة وحرقة شديدة بأسفل الصدر والمريء', nameEn: 'Heartburn / Acid Reflux', category: 'الجهاز الهضمي', active: true },
  { symptomId: 'sym-5', nameAr: 'مغص بطني متقطع وانتفاخ وغازات', nameEn: 'Abdominal Cramping & Bloating', category: 'الجهاز الهضمي', active: true },
  { symptomId: 'sym-6', nameAr: 'عطش شديد وتبول متكرر ليلاً', nameEn: 'Polydipsia & Nocturia', category: 'الغدد والسكري', active: true },
  { symptomId: 'sym-7', nameAr: 'إجهاد وخمول مستمر بدون مجهود شاق', nameEn: 'Chronic Fatigue & Lethargy', category: 'عام', active: true },
  { symptomId: 'sym-8', nameAr: 'ألم ضاغط أو ثقل بمنتصف الصدر مع المجهود', nameEn: 'Exertional Chest Tightness', category: 'القلب والأوعية', active: true },
];

// 19. Chronic Diseases Catalog (chronicDiseases/{diseaseId})
export const INITIAL_CHRONIC_DISEASES: ChronicDisease[] = [
  { diseaseId: 'cd-1', nameAr: 'داء السكري (Type 2 DM)', nameEn: 'Type 2 Diabetes', category: 'غدد وسكري', active: true, color: 'blue' },
  { diseaseId: 'cd-2', nameAr: 'ارتفاع ضغط الدم (Hypertension)', nameEn: 'Hypertension', category: 'قلب وأوعية', active: true, color: 'red' },
  { diseaseId: 'cd-3', nameAr: 'قصور الشرايين التاجية (CAD)', nameEn: 'Coronary Artery Disease', category: 'قلب', active: true, color: 'amber' },
  { diseaseId: 'cd-4', nameAr: 'ارتفاع دهون الدم والكوليسترول', nameEn: 'Hyperlipidemia', category: 'كيمياء حيوية', active: true, color: 'orange' },
  { diseaseId: 'cd-5', nameAr: 'قصور وظائف الكلى المزمن (CKD)', nameEn: 'Chronic Kidney Disease', category: 'كلى ومسالك', active: true, color: 'purple' },
  { diseaseId: 'cd-6', nameAr: 'خمول الغدة الدرقية (Hypothyroidism)', nameEn: 'Hypothyroidism', category: 'غدد صماء', active: true, color: 'cyan' },
  { diseaseId: 'cd-7', nameAr: 'متلازمة القولون العصبي (IBS)', nameEn: 'Irritable Bowel Syndrome', category: 'جهاز هضمي', active: true, color: 'emerald' },
];

// 20. Doctor Settings (doctorSettings/main)
// Doctor favorite IDs are stored here, referencing the main catalogs
export const INITIAL_DOCTOR_SETTINGS: DoctorSettings = {
  favoriteMedicationIds: ['med-1', 'med-2', 'med-3', 'med-4', 'med-5'],
  favoriteLabTestIds: ['lab-1', 'lab-2', 'lab-3', 'lab-4', 'lab-5'],
  favoriteRadiologyIds: ['rad-1', 'rad-2', 'rad-3', 'rad-4'],
  favoriteDiagnosisIds: ['diag-1', 'diag-2', 'diag-3', 'diag-4', 'diag-5'],
  favoriteSymptomIds: ['sym-1', 'sym-2', 'sym-3', 'sym-4', 'sym-5'],
  favoriteChronicDiseaseIds: ['cd-1', 'cd-2', 'cd-3', 'cd-4'],
};

// 21. System Settings (systemSettings/...)
export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  general: {
    defaultLanguage: 'ar',
    supportedLanguages: ['ar', 'en'],
  },
  clinic: {
    nameAr: 'سولي ميديكال كلينيك',
    nameEn: 'Soli Medical Clinic',
    phone: '01092847162',
    currency: 'ج.م',
    taxNumber: 'EG-TAX-39182',
  },
  financial: {
    consultationFee: 300,
    followupFee: 180,
    consultationDurationDays: 14, // 14 days free followup
  },
  followUp: {
    enabled: true,
    defaultFree: true,
    defaultDurationDays: 14,
    defaultFee: 0,
  },
  prescription: {
    paperSize: 'A5',
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    showDoctorName: true,
    showSpecialty: true,
    showPhone: true,
    showLogo: true,
    footerAr: 'مع أطيب تمنياتنا بدوام الصحة والعافية — المتابعة خلال 7 إلى 14 يوماً من تاريخ الكشف',
    footerEn: 'Wishing you good health — Follow-up consultation valid within 7 to 14 days',
    showQr: true,
  },
  appearance: {
    theme: 'light',
    primaryColor: '#0d9488', // Emerald/Teal medical theme
  },
  queue: {
    autoCallNext: false,
    showEstimatedWaitTime: true,
  },
};

/**
 * =========================================================================
 * ATOMIC WORKFLOWS & ARCHITECTURAL LOGIC ()
 * =========================================================================
 */

/**
 * Atomic Arrival Workflow:
 * When receptionist clicks "حضر المريض":
 * 1. Appointment: SCHEDULED -> ARRIVED
 * 2. Create Invoice
 * 3. Create Payment
 * 4. Create Visit with status 'WAITING' and sequential queueNumber
 */
export function executeAtomicArrival(params: {
  appointment: Appointment;
  patient: Patient;
  service: ServiceItem;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  receivedBy: string;
  nextQueueNumber: number;
  paymentSucceeded?: boolean;
  receptionistData?: { symptoms: string; chronicDiseases: string[]; notes: string };
  vitalSigns?: {
    bloodPressure: string;
    pulse: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    oxygenSaturation: number | null;
    randomBloodSugar: number | null;
  };
}): {
  updatedAppointment: Appointment;
  newInvoice: Invoice;
  newPayment: Payment;
  newVisit: Visit;
} {
  if (params.paymentSucceeded === false) throw new Error('Payment failed; no visit was created');

  const now = new Date().toISOString();
  const visitId = `vis-${Date.now()}`;
  const invoiceId = `inv-${Date.now()}`;
  const paymentId = `pay-${Date.now()}`;
  const receiptNumber = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Updated Appointment
  const updatedAppointment: Appointment = {
    ...params.appointment,
    status: 'ARRIVED',
    updatedAt: now,
  };

  // 2. Created Invoice
  const newInvoice: Invoice = {
    invoiceId,
    patientId: params.patient.patientId,
    visitId,
    clinicLocationId: params.appointment.clinicLocationId,
    items: [
      {
        serviceId: params.service.serviceId,
        nameAr: params.service.nameAr,
        nameEn: params.service.nameEn,
        quantity: 1,
        unitPrice: params.service.price,
        total: params.service.price,
      },
    ],
    subtotal: params.service.price,
    discount: 0,
    total: params.service.price,
    paidAmount: params.service.price,
    remainingAmount: 0,
    status: 'PAID',
    createdAt: now,
    updatedAt: now,
  };

  // 3. Created Payment
  const newPayment: Payment = {
    paymentId,
    patientId: params.patient.patientId,
    visitId,
    invoiceId,
    clinicLocationId: params.appointment.clinicLocationId,
    amount: params.service.price,
    method: params.paymentMethod,
    status: 'PAID',
    receiptNumber,
    paidAt: now,
    receivedBy: params.receivedBy,
  };

  // 4. Created Visit in WAITING state
  const newVisit: Visit = {
    visitId,
    patientId: params.patient.patientId,
    appointmentId: params.appointment.appointmentId,
    clinicLocationId: params.appointment.clinicLocationId,
    visitType: params.service.price === 0 ? 'FOLLOW_UP' : 'NEW',
    source: 'APPOINTMENT',
    status: 'WAITING',
    queueNumber: params.nextQueueNumber,
    receptionistData: params.receptionistData || {
      symptoms: params.appointment.notes || 'حضور بميعاد مسبق',
      chronicDiseases: params.patient.chronicDiseases || [],
      notes: '',
    },
    clinicalData: {
      chiefComplaint: '',
      history: '',
      examination: '',
      diagnosis: [],
      treatment: '',
    },
    vitalSigns: params.vitalSigns || {
      bloodPressure: null,
      pulse: null,
      temperature: null,
      weight: null,
      height: null,
      oxygenSaturation: null,
      randomBloodSugar: null,
    },
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: params.receivedBy,
    doctorId: 'user-doc-1',
  };

  return { updatedAppointment, newInvoice, newPayment, newVisit };
}

/**
 * Atomic Walk-in Workflow:
 * Patient arrives directly without appointment:
 * 1. Create or reference Patient
 * 2. Create Invoice
 * 3. Create Payment
 * 4. Create Visit with source = 'WALK_IN', appointmentId = null, status = 'WAITING'
 */
export function executeAtomicWalkIn(params: {
  patient: Patient;
  service: ServiceItem;
  clinicLocationId: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  receivedBy: string;
  nextQueueNumber: number;
  paymentSucceeded?: boolean;
  receptionistData: { symptoms: string; chronicDiseases: string[]; notes: string };
  vitalSigns?: {
    bloodPressure: string;
    pulse: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    oxygenSaturation: number | null;
    randomBloodSugar: number | null;
  };
}): {
  newInvoice: Invoice;
  newPayment: Payment;
  newVisit: Visit;
} {
  if (params.paymentSucceeded === false) throw new Error('Payment failed; no visit was created');

  const now = new Date().toISOString();
  const visitId = `vis-${Date.now()}`;
  const invoiceId = `inv-${Date.now()}`;
  const paymentId = `pay-${Date.now()}`;
  const receiptNumber = `REC-${Math.floor(1000 + Math.random() * 9000)}`;

  const newInvoice: Invoice = {
    invoiceId,
    patientId: params.patient.patientId,
    visitId,
    clinicLocationId: params.clinicLocationId,
    items: [
      {
        serviceId: params.service.serviceId,
        nameAr: params.service.nameAr,
        nameEn: params.service.nameEn,
        quantity: 1,
        unitPrice: params.service.price,
        total: params.service.price,
      },
    ],
    subtotal: params.service.price,
    discount: 0,
    total: params.service.price,
    paidAmount: params.service.price,
    remainingAmount: 0,
    status: 'PAID',
    createdAt: now,
    updatedAt: now,
  };

  const newPayment: Payment = {
    paymentId,
    patientId: params.patient.patientId,
    visitId,
    invoiceId,
    clinicLocationId: params.clinicLocationId,
    amount: params.service.price,
    method: params.paymentMethod,
    status: 'PAID',
    receiptNumber,
    paidAt: now,
    receivedBy: params.receivedBy,
  };

  const newVisit: Visit = {
    visitId,
    patientId: params.patient.patientId,
    appointmentId: null, // Walk-in has null appointmentId
    clinicLocationId: params.clinicLocationId,
    visitType: params.service.price === 0 ? 'FOLLOW_UP' : 'NEW',
    source: 'WALK_IN',
    status: 'WAITING',
    queueNumber: params.nextQueueNumber,
    receptionistData: params.receptionistData,
    clinicalData: {
      chiefComplaint: params.receptionistData.symptoms,
      history: '',
      examination: '',
      diagnosis: [],
      treatment: '',
    },
    vitalSigns: params.vitalSigns || {
      bloodPressure: null,
      pulse: null,
      temperature: null,
      weight: null,
      height: null,
      oxygenSaturation: null,
      randomBloodSugar: null,
    },
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: params.receivedBy,
    doctorId: 'user-doc-1',
  };

  return { newInvoice, newPayment, newVisit };
}

/**
 * Complete Visit & Consultation Workflow:
 * Visit: IN_PROGRESS -> COMPLETED
 * - Updates Visit with clinical examination & vitals
 * - Generates Prescription record with item snapshots
 * - Generates Lab Orders
 * - Generates Radiology Orders
 * - Generates FollowUp with policy snapshot
 */
export function executeCompleteVisit(params: {
  visit: Visit;
  clinicalData: {
    chiefComplaint: string;
    history: string;
    examination: string;
    diagnosis: string[];
    treatment: string;
  };
  vitalSigns: {
    bloodPressure: string;
    pulse: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    oxygenSaturation: number | null;
    randomBloodSugar: number | null;
  };
  prescriptionItems: PrescriptionItemSnapshot[];
  prescriptionNotes?: string;
  labOrders: Array<{ testId: string | null; testName: string; status: 'ORDERED' | 'RESULT' | 'REPORT'; notes?: string }>;
  radiologyOrders: Array<{ radiologyTypeId: string | null; radiologyName: string; status: 'ORDERED' | 'RESULT' | 'REPORT'; report?: string; notes?: string }>;
  followUp?: {
    scheduledDate: string;
    scheduledTime?: string | null;
    fee: number;
    isFree: boolean;
    notes?: string;
  };
}): {
  completedVisit: Visit;
  newPrescription: Prescription;
  createdLabOrders: LabOrder[];
  createdRadiologyOrders: RadiologyOrder[];
  createdFollowUp?: FollowUp;
} {
  const now = new Date().toISOString();

  // 1. Completed Visit
  const completedVisit: Visit = {
    ...params.visit,
    status: 'COMPLETED',
    clinicalData: params.clinicalData,
    vitalSigns: params.vitalSigns,
    completedAt: now,
    updatedAt: now,
  };

  // 2. Prescription Snapshot
  const newPrescription: Prescription = {
    prescriptionId: `rx-${Date.now()}`,
    patientId: params.visit.patientId,
    visitId: params.visit.visitId,
    doctorId: params.visit.doctorId || 'user-doc-1',
    clinicLocationId: params.visit.clinicLocationId,
    items: params.prescriptionItems,
    notes: params.prescriptionNotes || '',
    createdAt: now,
    updatedAt: now,
  };

  // 3. Lab Orders
  const createdLabOrders: LabOrder[] = params.labOrders.map((lo, idx) => ({
    labOrderId: `lo-${Date.now()}-${idx}`,
    patientId: params.visit.patientId,
    visitId: params.visit.visitId,
    testId: lo.testId,
    testName: lo.testName,
    status: lo.status,
    result: '',
    notes: lo.notes || '',
    orderedAt: now,
    updatedAt: now,
  }));

  // 4. Radiology Orders
  const createdRadiologyOrders: RadiologyOrder[] = params.radiologyOrders.map((ro, idx) => ({
    radiologyOrderId: `ro-${Date.now()}-${idx}`,
    patientId: params.visit.patientId,
    visitId: params.visit.visitId,
    radiologyTypeId: ro.radiologyTypeId,
    radiologyName: ro.radiologyName,
    status: ro.status,
    result: '',
    report: ro.report || '',
    notes: ro.notes || '',
    orderedAt: now,
    updatedAt: now,
  }));

  // 5. Follow-Up with Policy Snapshot
  let createdFollowUp: FollowUp | undefined;
  if (params.followUp && params.followUp.scheduledDate) {
    createdFollowUp = {
      followUpId: `fol-${Date.now()}`,
      patientId: params.visit.patientId,
      sourceVisitId: params.visit.visitId,
      clinicLocationId: params.visit.clinicLocationId,
      scheduledDate: params.followUp.scheduledDate,
      scheduledTime: params.followUp.scheduledTime || null,
      status: 'UPCOMING',
      fee: params.followUp.fee,
      isFree: params.followUp.isFree,
      notes: params.followUp.notes || '',
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    completedVisit,
    newPrescription,
    createdLabOrders,
    createdRadiologyOrders,
    createdFollowUp,
  };
}
