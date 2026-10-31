import { doc, setDoc, deleteDoc, collection, getDocs, writeBatch, type Firestore } from 'firebase/firestore';
import { saveClinicExpenses, DEFAULT_CLINIC_EXPENSES, loadClinicExpenses } from './financeManager';
import { toDayKey } from './dayKey';
import type {
  Patient,
  Appointment,
  Visit,
  Invoice,
  Payment,
  FollowUp,
  Prescription,
  Medication,
  LabOrder,
  RadiologyOrder,
} from '../types/database';

const PATIENTS_POOL = [
  { id: 'pat-demo-1', name: 'أحمد محمد الجمال', phone: '01012345678', gender: 'male', dob: '1985-05-12', doc: 'EG-2311' },
  { id: 'pat-demo-2', name: 'منى عبد الرحمن الشافعي', phone: '01123456789', gender: 'female', dob: '1990-09-22', doc: 'EG-9214' },
  { id: 'pat-demo-3', name: 'كريم محمود حسن', phone: '01234567890', gender: 'male', dob: '1978-01-15', doc: 'EG-4451' },
  { id: 'pat-demo-4', name: 'سارة يوسف خليل', phone: '01545678901', gender: 'female', dob: '1995-11-30', doc: 'EG-1299' },
  { id: 'pat-demo-5', name: 'فاطمة عمر السعدني', phone: '01067890123', gender: 'female', dob: '1965-04-05', doc: 'EG-8832' },
  { id: 'pat-demo-6', name: 'ياسين هشام بدوي', phone: '01178901234', gender: 'male', dob: '2012-08-18', doc: 'EG-7641' },
  { id: 'pat-demo-7', name: 'علي خالد زهران', phone: '01289012345', gender: 'male', dob: '1992-03-25', doc: 'EG-3351' },
  { id: 'pat-demo-8', name: 'نور الدين مصطفى', phone: '01590123456', gender: 'male', dob: '2000-07-07', doc: 'EG-1144' }
];

const DIAGNOSES_POOL = [
  'نزلات برد حادة والتهاب الجيوب الأنفية',
  'متابعة ضغط الدم المرتفع والسكري',
  'التهاب المفاصل والفقرات القطنية',
  'التهاب الشعب الهوائية الحاد',
  'اضطرابات القولون العصبي وعسر الهضم',
  'صداع نصفي وإجهاد مزمن',
  'حساسية صدرية وربو شعبي',
  'متابعة دورية وفحص عام'
];

const COMPLAINTS_POOL = [
  'صداع مستمر وارتفاع طفيف في درجة الحرارة مع رشح وكحة جافة',
  'ألم أسفل الظهر يمتد للرجل اليمنى وصعوبة في الحركة المستمرة',
  'ألم وتقلصات شديدة بالبطن مع غازات وانتفاخ بعد تناول الوجبات الدسمة',
  'نهجان شديد وضيق في الصدر مع كحة مستمرة خاصة أثناء النوم',
  'متابعة مستوى السكر التراكمي وقياسات ضغط الدم على مدار الأسبوعين الماضيين',
  'دوخة مستمرة مع زغللة في العين وكسل وخمول عام بالجسم',
  'ألم حاد في الأذن والبلعوم وصعوبة في بلع الأطعمة الجافة',
  'رغبة في إجراء فحص كامل ومراجعة الفحوصات والتحاليل الدورية السنوية'
];

// Helper to generate dynamic dates spread across the last 12 months
function generateDateInMonth(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  const day = Math.floor(Math.random() * 26) + 1; // 1 to 26
  d.setDate(day);
  d.setHours(Math.floor(Math.random() * 7) + 13); // 1 PM to 8 PM
  d.setMinutes(Math.floor(Math.random() * 4) * 15); // 0, 15, 30, 45
  d.setSeconds(0);
  return d.toISOString();
}

/**
 * Generates 1 year of realistic clinic data (Visits, Invoices, Payments, Expenses, Patients, Appointments)
 */
export async function generateOneYearDemoData(db: Firestore | null): Promise<void> {
  const generatedPatients: Patient[] = [];
  const generatedAppointments: Appointment[] = [];
  const generatedVisits: Visit[] = [];
  const generatedInvoices: Invoice[] = [];
  const generatedPayments: Payment[] = [];
  const generatedExpenses: any[] = [];

  const timestamp = new Date().toISOString();

  // 1. Generate Patients
  PATIENTS_POOL.forEach((p, index) => {
    generatedPatients.push({
      patientId: p.id,
      fullName: p.name,
      phone: p.phone,
      gender: p.gender as 'male' | 'female',
      dateOfBirth: p.dob,
      nationalId: `2${index}0101012345${index}`,
      governorate: 'القاهرة',
      address: 'مصر الجديدة، القاهرة',
      fileNumber: index + 101,
      medicalCode: p.doc,
      bloodType: ['O+', 'A+', 'B+', 'AB+'][index % 4],
      allergies: index % 3 === 0 ? ['البنسلين'] : [],
      chronicDiseases: index % 2 === 0 ? ['السكري', 'ارتفاع ضغط الدم'] : [],
      emergencyContact: { name: 'قريب للمريض', relation: 'ابن / ابنة', phone: '01099999999' },
      createdAt: generateDateInMonth(11),
      updatedAt: timestamp,
      createdBy: 'admin',
    });
  });

  // 2. Generate 12 Months of Transactions (Visits, Appointments, Invoices, Payments, Expenses)
  for (let m = 0; m < 12; m++) {
    // Generate 4-8 visits per month
    const visitsCount = Math.floor(Math.random() * 5) + 5; // 5 to 9 visits
    for (let v = 0; v < visitsCount; v++) {
      const patient = generatedPatients[Math.floor(Math.random() * generatedPatients.length)];
      const dateStr = generateDateInMonth(m);
      const visitId = `vis-demo-${m}-${v}-${Math.random().toString(36).substr(2, 5)}`;
      const apptId = `appt-demo-${m}-${v}-${Math.random().toString(36).substr(2, 5)}`;
      const invoiceId = `inv-demo-${m}-${v}-${Math.random().toString(36).substr(2, 5)}`;
      const paymentId = `pay-demo-${m}-${v}-${Math.random().toString(36).substr(2, 5)}`;
      const queueNum = v + 1;

      const visitPrice = m % 3 === 0 ? 150 : 300; // 150 is follow-up fee, 300 is regular exam fee
      const visitTypeName = visitPrice === 150 ? 'متابعة واستشارة' : 'كشف جديد';

      // Appointment
      generatedAppointments.push({
        appointmentId: apptId,
        patientId: patient.patientId,
        clinicLocationId: 'loc-mohandessin',
        scheduledDate: dateStr.split('T')[0],
        scheduledTime: '06:00 م',
        visitType: visitTypeName,
        status: 'ARRIVED',
        notes: 'حجز تلقائي مولد للعرض والتجربة',
        createdAt: dateStr,
        updatedAt: dateStr,
        createdBy: 'secretary',
      });

      // Visit
      generatedVisits.push({
        visitId,
        patientId: patient.patientId,
        appointmentId: apptId,
        clinicLocationId: 'loc-mohandessin',
        visitType: visitPrice === 150 ? 'FOLLOW_UP' : 'NEW',
        source: 'APPOINTMENT',
        status: 'COMPLETED',
        queueNumber: queueNum,
        receptionistData: {
          symptoms: 'كشف دوري ومتابعة الحالة الصحية',
          chronicDiseases: [],
          notes: `مسدد كاش بقيمة ${visitPrice} ج.م`,
        },
        clinicalData: {
          chiefComplaint: COMPLAINTS_POOL[Math.floor(Math.random() * COMPLAINTS_POOL.length)],
          history: 'مستقرة ولا توجد مضاعفات حادة بالوقت الراهن',
          examination: 'العلامات الحيوية مستقرة. فحص الصدر والقلب طبيعي.',
          diagnosis: [DIAGNOSES_POOL[Math.floor(Math.random() * DIAGNOSES_POOL.length)]],
          treatment: 'الراحة التامة، تناول سوائل دافئة، والالتزام بجرعات العلاج الموصوفة مع المتابعة الأسبوعية.',
        },
        vitalSigns: {
          bloodPressure: `${110 + Math.floor(Math.random() * 25)}/${70 + Math.floor(Math.random() * 15)}`,
          pulse: 70 + Math.floor(Math.random() * 20),
          temperature: 36.5 + (Math.random() * 1.2),
          weight: 60 + Math.floor(Math.random() * 30),
          height: 160 + Math.floor(Math.random() * 20),
          oxygenSaturation: 97 + Math.floor(Math.random() * 3),
          randomBloodSugar: 90 + Math.floor(Math.random() * 60),
        },
        startedAt: dateStr,
        completedAt: dateStr,
        createdAt: dateStr,
        updatedAt: dateStr,
        createdBy: 'secretary',
        doctorId: 'admin',
        dayKey: toDayKey(dateStr),
      });

      // Invoice
      generatedInvoices.push({
        invoiceId,
        patientId: patient.patientId,
        visitId,
        clinicLocationId: 'loc-mohandessin',
        items: [{
          serviceId: visitPrice === 150 ? 'srv-follow-up' : 'srv-new-exam',
          nameAr: visitTypeName,
          quantity: 1,
          unitPrice: visitPrice,
          total: visitPrice,
        }],
        subtotal: visitPrice,
        discount: 0,
        total: visitPrice,
        paidAmount: visitPrice,
        remainingAmount: 0,
        status: 'PAID',
        createdAt: dateStr,
        updatedAt: dateStr,
        dayKey: toDayKey(dateStr),
      });

      // Payment
      generatedPayments.push({
        paymentId,
        patientId: patient.patientId,
        visitId,
        invoiceId,
        clinicLocationId: 'loc-mohandessin',
        amount: visitPrice,
        method: 'CASH',
        status: 'PAID',
        receiptNumber: `REC-${m}-${v}-${1000 + v}`,
        paidAt: dateStr,
        receivedBy: 'secretary',
        dayKey: toDayKey(dateStr),
      });
    }

    // 3. Generate Monthly Fixed Expenses (Rent, Salary, internet, electric, supplies)
    const expenseDate = generateDateInMonth(m).split('T')[0];
    generatedExpenses.push(
      {
        id: `exp-demo-${m}-rent`,
        category: 'إيجار العيادة',
        amount: 3000,
        date: expenseDate,
        time: '12:00 م',
        notes: `إيجار مقر العيادة الشهري - شهر ${12 - m} الماضي`,
        createdAt: new Date().toISOString(),
      },
      {
        id: `exp-demo-${m}-salary`,
        category: 'رواتب الموظفين',
        amount: 4000,
        date: expenseDate,
        time: '01:00 م',
        notes: `رواتب السكرتارية والتمريض والموظفين`,
        createdAt: new Date().toISOString(),
      },
      {
        id: `exp-demo-${m}-internet`,
        category: 'فاتورة إنترنت',
        amount: 300,
        date: expenseDate,
        time: '02:00 م',
        notes: `اشتراك الإنترنت السريع وتطبيقات الويب للعيادة`,
        createdAt: new Date().toISOString(),
      },
      {
        id: `exp-demo-${m}-electric`,
        category: 'فاتورة كهرباء',
        amount: 350 + Math.floor(Math.random() * 250),
        date: expenseDate,
        time: '03:00 م',
        notes: `فاتورة استهلاك الكهرباء لشهر ${12 - m}`,
        createdAt: new Date().toISOString(),
      },
      {
        id: `exp-demo-${m}-supplies`,
        category: 'صيانة ومستلزمات',
        amount: 200 + Math.floor(Math.random() * 800),
        date: expenseDate,
        time: '04:00 م',
        notes: `شراء مستلزمات طبية، شاش ومطهرات طبية للتعقيم وعيادات الكشف`,
        createdAt: new Date().toISOString(),
      }
    );
  }

  // 4. Save to Firestore (in batch groups of 50 elements) or locally
  if (db) {
    const allDataToSet = [
      ...generatedPatients.map(p => ({ col: 'patients', id: p.patientId, data: p })),
      ...generatedAppointments.map(a => ({ col: 'appointments', id: a.appointmentId, data: a })),
      ...generatedVisits.map(v => ({ col: 'visits', id: v.visitId, data: v })),
      ...generatedInvoices.map(i => ({ col: 'invoices', id: i.invoiceId, data: i })),
      ...generatedPayments.map(pay => ({ col: 'payments', id: pay.paymentId, data: pay })),
    ];

    // Chunk into sets of 500 (max Firestore batch size is 500)
    for (let i = 0; i < allDataToSet.length; i += 450) {
      const chunk = allDataToSet.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        batch.set(doc(db, item.col, item.id), item.data);
      });
      await batch.commit();
    }
  }

  // Save expenses to local storage
  saveClinicExpenses(generatedExpenses);
}

/**
 * Clears patients, dynamic visits, and transactional/financial elements from the database (Patients, Visits, Invoices, Payments, Appointments, follow-ups, etc.)
 * This leaves settings, configuration, and medical catalogs/guides completely untouched.
 */
export async function clearAllDatabaseCollections(db: Firestore | null): Promise<void> {
  // Clear local storage expenses
  saveClinicExpenses([]);
  try {
    localStorage.setItem('soli_clinic_db_initialized', 'true');
  } catch {
    // Ignore storage issues in private modes
  }

  if (!db) return;

  const collectionsToClear = [
    'patients',
    'appointments',
    'visits',
    'invoices',
    'payments',
    'followUps',
    'prescriptions',
    'labOrders',
    'radiologyOrders',
    'expenses',
    'transactions'
  ];

  for (const colName of collectionsToClear) {
    try {
      const querySnapshot = await getDocs(collection(db, colName));
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        querySnapshot.docs.forEach((d) => {
          batch.delete(doc(db, colName, d.id));
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn(`Error clearing collection ${colName}:`, e);
    }
  }
}
