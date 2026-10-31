import { PatientListItem, QueueItem, AppointmentListItem, TransactionRecord, PrescriptionItem } from '../types';
import { safeStorage, StorageKeys } from '../services/storage';

export function getDynamicDoctorName(): string {
  const cachedRx = safeStorage.getJSON<any | null>(StorageKeys.PRESCRIPTION_SETTINGS, null);
  if (cachedRx && cachedRx.doctorName && cachedRx.doctorName.trim()) {
    return cachedRx.doctorName.trim();
  }
  return 'طبيب العيادة';
}

export const CLINIC_INFO = {
  name: 'العيادة الطبية المتكاملة',
  enName: 'Soli Medical Clinic',
  get doctorName() {
    return getDynamicDoctorName();
  },
  doctorTitle: 'التخصص الطبي العام للعيادة',
  doctorCredentials: 'الدرجات العلمية والشهادات المهنية والزمالات المسجلة للعيادة',
  syndicateNumber: 'EG-DOC-48291-GZ',
  licenseYear: '48291 / 2006 جيزة',
  logoUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1Vrz2i_HQu2ilGlpVeZEGuk5DJ-Hht9rT6kliDB3hw3PS9-J_HHQDvOL2_3KTsKZltGHed8eeV6j-T92TfU71y81R42_shFQGUbl8PoChY9f9-JS7WVLRy1Rm_MIs9jdOIENTv9rc4cn1CZ2mYRpZ99A_xBMuvFOOecFL44A0vQxciThRZCgZkB1qBCOh6IxAZL5w9rIeWEToXoP_cI9IlvDyLX0g8MJLfxYOFzk31i-sXkrAu1lN-FsiaoTggRuYle0SUD-iLa',
  doctorPhotoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDxZxCeAAhRzFu4a6GNIsfVF34jHMtWs4h5gmoFinstW1y3k08MjqHk_DFNmCpN_lVzKndJJYkYweLIrg0BO4fhLiK0tufX-3z950iciAITEvjIH3nWyVxwZ8CLVyQJzVJStiDUwSynryjZWOJUEJTuuVjYY1iJtZFXBEtz9-ENn-M6xBaYhKvexyR2KXNWeOWCsaYe3IngWqtP3yxb_Lqzn2iqXAZvFaR7FbvAnEZNOeV7GDs9HHE',
  branches: [
    {
      id: 'mohandessin',
      name: 'العيادة الرئيسية - المهندسين',
      address: '24 شارع سوريا - تقاطع جزيرة العرب، الدور الثالث، شقة 7',
      days: 'السبت، الإثنين، الأربعاء',
      hours: '04:00 م - 10:00 م',
      phone: '02-37618920',
      mobile: '01092847162',
    },
    {
      id: 'dokki',
      name: 'فرع الدقي - مركز التحرير التخصصي',
      address: '98 شارع التحرير، ميدان الدقي - برج الأطباء، الدور السادس',
      days: 'الأحد، الثلاثاء، الخميس',
      hours: '06:00 م - 11:30 م',
      phone: '02-33385210',
      mobile: '01124890014',
    }
  ]
};

export const INITIAL_PATIENTS: PatientListItem[] = [];

export const INITIAL_QUEUE: QueueItem[] = [];

export const INITIAL_APPOINTMENTS: AppointmentListItem[] = [];

export const INITIAL_TRANSACTIONS: TransactionRecord[] = [];

export const INITIAL_PRESCRIPTION: PrescriptionItem[] = [];

export const INITIAL_PRESCRIPTIONS = INITIAL_PRESCRIPTION;

export const DEFAULT_CHRONIC_CONDITIONS: { id: string; name: string; category: string; color: string }[] = [
  { id: 'cc-1', name: 'ضغط دم مرتفع', category: 'القلب والأوعية', color: 'bg-rose-500' },
  { id: 'cc-2', name: 'داء السكري (النوع الثاني)', category: 'الغدد والسكر', color: 'bg-purple-500' },
  { id: 'cc-3', name: 'داء السكري (النوع الأول)', category: 'الغدد والسكر', color: 'bg-indigo-500' },
  { id: 'cc-4', name: 'أمراض وقصور الشرايين التاجية', category: 'القلب والأوعية', color: 'bg-red-600' },
  { id: 'cc-5', name: 'حساسية صدر وربو شعبي', category: 'الجهاز التنفسي', color: 'bg-sky-500' },
  { id: 'cc-6', name: 'ارتجاع المريء والتهاب المعدة', category: 'الجهاز الهضمي', color: 'bg-amber-500' },
  { id: 'cc-7', name: 'القولون العصبي (IBS)', category: 'الجهاز الهضمي', color: 'bg-teal-500' },
  { id: 'cc-8', name: 'قصور وظائف الكلى ومسالك', category: 'الكلى والمسالك', color: 'bg-slate-500' },
  { id: 'cc-9', name: 'خمول الغدة الدرقية', category: 'الغدد والسكر', color: 'bg-emerald-500' },
  { id: 'cc-10', name: 'ارتفاع دهون وكوليسترول الدم', category: 'القلب والأوعية', color: 'bg-orange-500' },
];

