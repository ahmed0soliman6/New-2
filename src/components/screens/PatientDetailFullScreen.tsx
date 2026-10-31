import React, { useState, useEffect, useMemo } from 'react';
import { CLINIC_INFO } from '../../data/previewClinicData';
import { PatientListItem, ScreenType } from '../../types';
import { usePermissions } from '../../context/AuthContext';
import { exportPatientMedicalDossierPdf } from '../../utils/exportPatientDossierPdf';
import { toEnglishDigits, formatAppDate, formatAppTime } from '../../utils/numberUtils';
import { useLanguage } from '../../i18n/LanguageContext';
import { printPrescriptionDocument, printVisitReportDocument } from '../../utils/printPrescription';
import { findBranch } from '../../utils/clinicBranches';
import { READ_OPT } from '../../config/readOpt';
import { usePatientHistory, invalidatePatientHistory } from '../../services/history';
import { getPrescriptionDoctorInfo } from '../../utils/prescriptionDoctor';
import type {
  FollowUp,
  Invoice,
  LabOrder,
  Patient,
  Prescription,
  RadiologyOrder,
  Visit,
} from '../../types/database';

interface PatientDetailFullScreenProps {
  patient: PatientListItem;
  patientCanonical?: Patient;
  onBack: () => void;
  onUpdatePatient?: (updated: {
    patientId: string;
    fullName: string;
    phone?: string;
    gender?: 'male' | 'female';
    dateOfBirth?: string | null;
    bloodType?: string;
    allergies?: string[];
    chronicDiseases?: string[];
    notes?: string;
    address?: string;
    governorate?: string;
    emergencyContact?: {
      name: string;
      phone: string;
      relation: string;
    };
  }) => Promise<void> | void;
  onSelectPatientForExam: (patient: PatientListItem) => void;
  onNavigate: (screen: ScreenType) => void;
  onDeletePatient?: (patientId: string) => void;
  visits?: Visit[];
  invoices?: Invoice[];
  prescriptions?: Prescription[];
  labOrders?: LabOrder[];
  radiologyOrders?: RadiologyOrder[];
  followUps?: FollowUp[];
}

const COMMON_CHRONIC_CONDITIONS = [
  'ارتفاع ضغط الدم',
  'سكري من النوع الثاني',
  'سكري من النوع الأول',
  'حساسية الصدر والربو الشعبي',
  'أمراض القلب والشرايين التاجية',
  'قصور وظائف الكلى',
  'اضطرابات الغدة الدرقية',
  'ارتفاع كوليسترول ودهون الدم',
  'التهاب المفاصل الروماتويدي',
  'قرحة وارتجاع المريء',
];

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'غير محدد'];

export const PatientDetailFullScreen: React.FC<PatientDetailFullScreenProps> = ({
  patient,
  patientCanonical,
  onBack,
  onUpdatePatient,
  onSelectPatientForExam,
  onNavigate,
  onDeletePatient,
  visits = [],
  invoices = [],
  prescriptions = [],
  labOrders = [],
  radiologyOrders = [],
  followUps = [],
}) => {
  const { canAccess } = usePermissions();
  const { language, isRTL, t } = useLanguage();

  // On-demand clinical history for this patient when READ_OPT is true
  const hist = usePatientHistory(patient.id, READ_OPT);
  const effVisits = READ_OPT ? hist.visits : visits;
  const effInvoices = READ_OPT ? hist.invoices : invoices;
  const effPrescriptions = READ_OPT ? hist.prescriptions : prescriptions;
  const effLabOrders = READ_OPT ? hist.labOrders : labOrders;
  const effRadOrders = READ_OPT ? hist.radiologyOrders : radiologyOrders;
  const effFollowUps = READ_OPT ? hist.followUps : followUps;
  const effPayments = READ_OPT ? hist.payments : [];

  const calculatedTotalPaid = useMemo(() => {
    if (READ_OPT) {
      return effPayments
        .filter((pm) => pm.status === 'PAID' || pm.amount > 0)
        .reduce((sum, pm) => sum + (pm.amount || 0), 0);
    }
    return patient.totalPaid || 0;
  }, [effPayments, patient.totalPaid]);

  // Tab state
  const [activeTab, setActiveTab] = useState<
    'all' | 'basic' | 'visits' | 'prescriptions' | 'labs' | 'radiology' | 'billing'
  >('all');

  // PDF Exporting state
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Edit Mode state for Basic Info
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState(patientCanonical?.fullName || patient.name || '');
  const [phone, setPhone] = useState(patientCanonical?.phone || patient.phone || '');
  const [gender, setGender] = useState<'male' | 'female'>(patient.gender || 'male');
  const [dateOfBirth, setDateOfBirth] = useState(patientCanonical?.dateOfBirth || '');
  const [age, setAge] = useState<number>(patient.age || 0);
  const [bloodType, setBloodType] = useState(patientCanonical?.bloodType || patient.bloodType || 'غير محدد');
  const [governorate, setGovernorate] = useState(patientCanonical?.governorate || patient.governorate || '');
  const [address, setAddress] = useState(patientCanonical?.address || patient.address || '');
  const [emergencyName, setEmergencyName] = useState(
    patientCanonical?.emergencyContact?.name || patient.emergencyContact?.name || ''
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    patientCanonical?.emergencyContact?.phone || patient.emergencyContact?.phone || ''
  );
  const [emergencyRelation, setEmergencyRelation] = useState(
    patientCanonical?.emergencyContact?.relation || patient.emergencyContact?.relation || 'قريب'
  );

  const [allergies, setAllergies] = useState<string[]>(
    patientCanonical?.allergies || patient.allergies || []
  );
  const [newAllergyInput, setNewAllergyInput] = useState('');

  const [chronicConditions, setChronicConditions] = useState<string[]>(
    patientCanonical?.chronicDiseases || patient.chronicConditions || []
  );
  const [customChronicInput, setCustomChronicInput] = useState('');

  const [notes, setNotes] = useState(patientCanonical?.notes || '');

  // Keep state in sync when patient changes
  useEffect(() => {
    setFullName(patientCanonical?.fullName || patient.name || '');
    setPhone(patientCanonical?.phone || patient.phone || '');
    setGender(patient.gender || 'male');
    setDateOfBirth(patientCanonical?.dateOfBirth || '');
    setAge(patient.age || 0);
    setBloodType(patientCanonical?.bloodType || patient.bloodType || 'غير محدد');
    setGovernorate(patientCanonical?.governorate || patient.governorate || '');
    setAddress(patientCanonical?.address || patient.address || '');
    setEmergencyName(patientCanonical?.emergencyContact?.name || patient.emergencyContact?.name || '');
    setEmergencyPhone(patientCanonical?.emergencyContact?.phone || patient.emergencyContact?.phone || '');
    setEmergencyRelation(patientCanonical?.emergencyContact?.relation || patient.emergencyContact?.relation || 'قريب');
    setAllergies(patientCanonical?.allergies || patient.allergies || []);
    setChronicConditions(patientCanonical?.chronicDiseases || patient.chronicConditions || []);
    setNotes(patientCanonical?.notes || '');
  }, [patient, patientCanonical]);

  // Handle Save
  const handleSaveBasicInfo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fullName.trim()) return;

    setIsSaving(true);
    try {
      if (onUpdatePatient) {
        await onUpdatePatient({
          patientId: patient.id,
          fullName: fullName.trim(),
          phone: phone.trim(),
          gender,
          dateOfBirth: dateOfBirth || null,
          bloodType,
          governorate: governorate.trim(),
          address: address.trim(),
          allergies,
          chronicDiseases: chronicConditions,
          notes: notes.trim(),
          emergencyContact: {
            name: emergencyName.trim(),
            phone: emergencyPhone.trim(),
            relation: emergencyRelation.trim(),
          },
        });
      }

      if (READ_OPT) {
        invalidatePatientHistory(patient.id);
        void hist.reload();
      }

      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to update patient:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Add Allergy Tag
  const handleAddAllergy = () => {
    if (!newAllergyInput.trim()) return;
    if (!allergies.includes(newAllergyInput.trim())) {
      setAllergies([...allergies, newAllergyInput.trim()]);
    }
    setNewAllergyInput('');
  };

  const handleRemoveAllergy = (tag: string) => {
    setAllergies(allergies.filter((a) => a !== tag));
  };

  // Toggle Chronic Condition
  const handleToggleChronic = (cond: string) => {
    if (chronicConditions.includes(cond)) {
      setChronicConditions(chronicConditions.filter((c) => c !== cond));
    } else {
      setChronicConditions([...chronicConditions, cond]);
    }
  };

  const handleAddCustomChronic = () => {
    if (!customChronicInput.trim()) return;
    if (!chronicConditions.includes(customChronicInput.trim())) {
      setChronicConditions([...chronicConditions, customChronicInput.trim()]);
    }
    setCustomChronicInput('');
  };

  // Filter patient data (Using on-demand eff* arrays)
  const pVisits = effVisits
    .filter((v) => v.patientId === patient.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pInvoices = effInvoices
    .filter((i) => i.patientId === patient.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pPrescriptions = effPrescriptions
    .filter((pr) => pr.patientId === patient.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const pLabOrders = effLabOrders
    .filter((l) => l.patientId === patient.id)
    .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());

  const pRadiologyOrders = effRadOrders
    .filter((r) => r.patientId === patient.id)
    .sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime());

  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone || '201092847162';

  // WhatsApp general card sender
  const handleSendPatientSummaryWhatsapp = () => {
    const branch = findBranch();
    const branchPhone = branch.phone || branch.mobile || '01092847162';
    const message = `مرحباً بك أستاذ/ة *${fullName || patient.name}* 🌸
ملفكم الطبي مسجل لدى *عيادة ${CLINIC_INFO.doctorName}* 🩺
رقم الملف: *#${toEnglishDigits(patient.fileNumber || 1)}*
تاريخ فتح الملف: *${toEnglishDigits(patient.registrationDate || '2024-02-10')}*
📍 ${branch.name}${branch.address ? `: ${branch.address}` : ''}
📞 للتواصل والاستفسار: ${branchPhone}

مع تمنياتنا لكم بتمام الصحة والعافية ✨`;
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Handle PDF Dossier Export
  const handleDownloadDossierPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportPatientMedicalDossierPdf({
        patient,
        patientCanonical,
        visits: pVisits,
        prescriptions: pPrescriptions,
        labOrders: pLabOrders,
        radiologyOrders: pRadiologyOrders,
        invoices: pInvoices,
      });
    } catch (err) {
      console.error('Error generating patient dossier PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-20 space-y-6 text-slate-800 dark:text-[#dde2f5]" id="patient-detail-screen">
      {/* ========================================================================= */}
      {/* TOP HEADER: BACK BUTTON & BREADCRUMBS & TOP SHORTCUTS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs">
        <div className="flex items-center gap-3">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] hover:bg-teal-50 dark:hover:bg-[#00c2cb]/15 text-slate-700 dark:text-[#dde2f5] hover:text-[#008f97] dark:hover:text-[#00c2cb] font-bold text-xs transition-all cursor-pointer border border-slate-200/80 dark:border-white/5 active:scale-95 shadow-2xs"
            id="btn-back-to-patient-files"
            title="الرجوع إلى قائمة ملفات المرضى"
          >
            <span className="material-symbols-outlined text-base">arrow_forward</span>
            <span>الرجوع لملفات المرضى</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

          {/* Breadcrumb Info */}
          <div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-[#859394]">
              <span>السجلات الطبية (EMR)</span>
              <span>&gt;</span>
              <span className="text-[#008f97] dark:text-[#00c2cb] font-bold">الملف الطبي الشامل</span>
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{fullName || patient.name}</span>
              <span className="bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] font-mono text-xs px-2 py-0.5 rounded-md border border-[#00c2cb]/20">
                ملف #{toEnglishDigits(patient.fileNumber || 1)}
              </span>
              {READ_OPT && hist.loading && (
                <span className="inline-flex items-center gap-1 text-[11px] text-teal-600 dark:text-[#00c2cb] font-normal animate-pulse">
                  <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                  <span>جاري جلب السجل بالطلب...</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top Fast Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download Medical File PDF Button */}
          <button
            type="button"
            onClick={handleDownloadDossierPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="تحميل وطباعة الملف الطبي الشامل للمريض بصيغة PDF منسقة"
          >
            <span className="material-symbols-outlined text-base">
              {isExportingPdf ? 'hourglass_top' : 'picture_as_pdf'}
            </span>
            <span>{isExportingPdf ? 'جارِ تجهيز PDF...' : 'تحميل الملف الطبي (PDF)'}</span>
          </button>

          {canAccess('clinical-exam') && (
            <button
              type="button"
              onClick={() => {
                onSelectPatientForExam(patient);
                onNavigate('clinical-exam');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">stethoscope</span>
              <span>بدء كشف إكلينيكي</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSendPatientSummaryWhatsapp}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800/40"
            title="إرسال بيانات وكود الملف للمريض عبر واتساب"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            <span className="hidden md:inline">واتساب</span>
          </button>

          {onDeletePatient && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-all cursor-pointer border border-rose-200 dark:border-rose-900/30 flex items-center justify-center"
              title="حذف ملف المريض"
            >
              <span className="material-symbols-outlined text-base">delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Banner when Saved */}
      {saveSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-[#10B981] p-3.5 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs animate-in fade-in duration-300">
          <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
          <span>تم حفظ وتحديث بيانات ملف المريض في النظام وقاعدة البيانات بنجاح ✓</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PATIENT HERO SUMMARY CARD */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-white/5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Side: Name, Badges & Basic Indicators */}
          <div className="flex items-start sm:items-center gap-4.5">
            {/* Gender / Medical Icon */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center font-extrabold text-base shrink-0 shadow-xs border ${
                gender === 'male'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40'
              }`}
            >
              <span className="material-symbols-outlined text-3xl">
                {gender === 'male' ? 'male' : 'female'}
              </span>
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {fullName || patient.name}
                </h2>
                <span className="bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border border-[#00c2cb]/30">
                  ملف #{toEnglishDigits(patient.fileNumber || 1)}
                </span>
                {bloodType && bloodType !== 'غير محدد' && (
                  <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border border-rose-200/80 dark:border-rose-900/40 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-rose-500">bloodtype</span>
                    <span>{bloodType}</span>
                  </span>
                )}
                <span className="bg-slate-100 dark:bg-[#18233C] text-slate-600 dark:text-[#bbc9ca] text-xs font-bold px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-white/10">
                  {gender === 'male' ? 'ذكر' : 'أنثى'} • {toEnglishDigits(age)} سنة
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-[#859394]">
                <span className="flex items-center gap-1 font-mono">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">call</span>
                  <span>{toEnglishDigits(phone || 'لا يوجد هاتف مسجل')}</span>
                </span>
                {address && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                    <span>{address}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                  <span>تاريخ التسجيل: {patient.registrationDate || '2024-02-10'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Side: Key Numerical Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 lg:border-r lg:border-slate-200 lg:dark:border-white/5 lg:pr-6">
            <div className="bg-slate-50 dark:bg-[#080e1b] p-3 rounded-2xl border border-slate-200/70 dark:border-white/5 text-center">
              <span className="text-[10px] text-slate-400 dark:text-[#859394] block font-bold mb-0.5">عدد الكشوفات</span>
              <strong className="text-base font-black text-[#008f97] dark:text-[#45dee7] font-mono">{pVisits.length}</strong>
              <span className="text-[9px] text-slate-400 block">زيارة مسجلة</span>
            </div>

            <div className="bg-slate-50 dark:bg-[#080e1b] p-3 rounded-2xl border border-slate-200/70 dark:border-white/5 text-center">
              <span className="text-[10px] text-slate-400 dark:text-[#859394] block font-bold mb-0.5">الروشتات الطبية</span>
              <strong className="text-base font-black text-purple-600 dark:text-[#d0bcff] font-mono">{pPrescriptions.length}</strong>
              <span className="text-[9px] text-slate-400 block">روشتة معتمدة</span>
            </div>

            <div className="bg-slate-50 dark:bg-[#080e1b] p-3 rounded-2xl border border-slate-200/70 dark:border-white/5 text-center">
              <span className="text-[10px] text-slate-400 dark:text-[#859394] block font-bold mb-0.5">تحاليل وأشعة</span>
              <strong className="text-base font-black text-amber-600 dark:text-[#FBBF24] font-mono">
                {pLabOrders.length + pRadiologyOrders.length}
              </strong>
              <span className="text-[9px] text-slate-400 block">فحص طبي</span>
            </div>

            <div className="bg-slate-50 dark:bg-[#080e1b] p-3 rounded-2xl border border-slate-200/70 dark:border-white/5 text-center">
              <span className="text-[10px] text-slate-400 dark:text-[#859394] block font-bold mb-0.5">إجمالي المدفوع</span>
              <strong className="text-base font-black text-emerald-600 dark:text-[#10B981] font-mono">
                {calculatedTotalPaid}
              </strong>
              <span className="text-[9px] text-slate-400 block">ج.م بالعيادة</span>
            </div>
          </div>
        </div>

        {/* Allergy Warning Alert Box if exists */}
        {allergies && allergies.length > 0 && (
          <div className="mt-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 flex items-center justify-between gap-3 flex-wrap text-xs font-bold">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-base">warning</span>
              </div>
              <div>
                <span className="text-rose-900 dark:text-rose-200 block text-xs font-extrabold">
                  تنبيه حساسية دوائية وسريرية هامة للمريض:
                </span>
                <span className="text-rose-700 dark:text-rose-300 font-medium">
                  {allergies.join(' • ')}
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-rose-200/60 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 px-2 py-0.5 rounded-md font-mono">
              ممنوع صرف هذه الأدوية
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ORGANIZED TABS NAVIGATION BAR */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-2 overflow-x-auto">
        {[
          { id: 'all', label: 'الكل (عرض جميع البطاقات)', icon: 'view_agenda', badge: null },
          { id: 'basic', label: 'البيانات الأساسية وتعديل الملف', icon: 'person', badge: null },
          { id: 'visits', label: 'سجل الزيارات والكشوفات', icon: 'history', badge: pVisits.length },
          { id: 'prescriptions', label: 'الروشتات والوصفات الطبية', icon: 'description', badge: pPrescriptions.length },
          { id: 'labs', label: 'التحاليل والفحوصات المعملية', icon: 'biotech', badge: pLabOrders.length },
          { id: 'radiology', label: 'الأشعة والتصوير الطبي', icon: 'radiology', badge: pRadiologyOrders.length },
          { id: 'billing', label: 'المعاملات المالية والفواتير', icon: 'receipt_long', badge: pInvoices.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
              activeTab === tab.id
                ? 'bg-[#00c2cb] text-[#08101C] border-[#00c2cb] shadow-sm'
                : 'bg-white dark:bg-[#111A2E] text-slate-600 dark:text-[#bbc9ca] hover:bg-slate-50 dark:hover:bg-[#18233C] border-slate-200 dark:border-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.badge !== null && tab.badge > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-extrabold ${
                  activeTab === tab.id
                    ? 'bg-[#08101C] text-[#00c2cb]'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BASIC INFORMATION & EDITING SECTION */}
      {/* ========================================================================= */}
      {(activeTab === 'basic' || activeTab === 'all') && (
        <div className="space-y-6">
          {/* Header of Section with Edit Toggle Button & All Toggle Button */}
          <div className="flex items-center justify-between gap-4 bg-white dark:bg-[#111A2E] p-4 rounded-2xl border border-slate-200 dark:border-white/5 flex-wrap">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb]">manage_accounts</span>
                <span>البيانات الأساسية وتعديل معلومات المريض</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                يمكنك مراجعة وتعديل بيانات المريض والاتصال والتاريخ الصحي وحفظ التغييرات مباشرة
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Button 'الكل' next to basic info */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'all' ? 'basic' : 'all')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#00c2cb] text-[#08101C] border-[#00c2cb]'
                    : 'bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] hover:bg-slate-200 dark:hover:bg-[#202c4b] border-slate-200 dark:border-white/10'
                }`}
                title="عرض جميع البطاقات والملفات الطبية أسفل بعضها"
              >
                <span className="material-symbols-outlined text-sm">view_agenda</span>
                <span>{activeTab === 'all' ? 'عرض الأساسية فقط' : 'الكل (عرض جميع البطاقات)'}</span>
              </button>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#18233C] hover:bg-teal-50 dark:hover:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#00c2cb] text-xs font-bold transition-all border border-slate-200 dark:border-white/10 shadow-xs cursor-pointer"
                  id="btn-edit-patient-basic"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  <span>تعديل البيانات الأساسية</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-600 dark:text-[#bbc9ca] text-xs font-bold hover:bg-slate-200 dark:hover:bg-[#202c4b] cursor-pointer"
                  >
                    إلغاء التعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveBasicInfo()}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                    id="btn-save-patient-basic"
                  >
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>{isSaving ? 'جارِ الحفظ...' : 'حفظ التعديلات'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VIEW MODE: ORGANIZED CATEGORIZED CARDS */}
          {!isEditing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: البيانات الشخصية والتعريفية */}
              <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">badge</span>
                    <span>البيانات الشخصية والتعريفية</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">ملف #{toEnglishDigits(patient.fileNumber || 1)}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">الاسم الرباعي:</span>
                    <strong className="text-slate-900 dark:text-white">{fullName || patient.name}</strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">رقم الهاتف:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">{phone || 'غير مسجل'}</strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">النوع / الجنس:</span>
                    <strong className="text-slate-900 dark:text-white">{gender === 'male' ? 'ذكر' : 'أنثى'}</strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">العمر وتاريخ الميلاد:</span>
                    <strong className="text-slate-900 dark:text-white font-mono">
                      {age} سنة {dateOfBirth ? `(${dateOfBirth})` : ''}
                    </strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-0.5">فصيلة الدم:</span>
                    <strong className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                      {bloodType || 'غير محدد'}
                    </strong>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5 col-span-2">
                    <span className="text-[10px] text-slate-400 block mb-0.5">العنوان بالتفصيل:</span>
                    <strong className="text-slate-900 dark:text-white">
                      {address || 'غير مسجل'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Card 2: جهة الطوارئ والتواصل الإضافي */}
              <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-base">emergency</span>
                    <span>بيانات الطوارئ والتواصل</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Emergency Contact</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">اسم جهة الاتصال:</span>
                      <strong className="text-slate-900 dark:text-white">{emergencyName || 'غير مسجل'}</strong>
                    </div>
                    <span className="text-xs bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded font-bold">
                      {emergencyRelation || 'قريب'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">رقم هاتف الطوارئ:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">{emergencyPhone || 'غير مسجل'}</strong>
                    </div>
                    {emergencyPhone && (
                      <a
                        href={`tel:${emergencyPhone}`}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">call</span>
                        <span>اتصال</span>
                      </a>
                    )}
                  </div>

                  {/* Notes Card */}
                  <div className="p-3 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 block mb-1">ملاحظات الطبيب والعيادة العامة:</span>
                    <p className="text-slate-700 dark:text-[#bbc9ca] text-xs leading-relaxed">
                      {notes || 'لا توجد ملاحظات إضافية مسجلة في هذا الملف.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: الحساسية الدوائية والتاريخ الصحي */}
              <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-rose-500 text-base">warning</span>
                    <span>سجل الحساسية الدوائية والغذائية ({allergies.length})</span>
                  </span>
                  <span className="text-[11px] text-rose-500 font-bold">Allergies</span>
                </div>

                {allergies.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    لا توجد حساسية دوائية مسجلة في هذا الملف (سليم)
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allergies.map((alg) => (
                      <span
                        key={alg}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-xs font-bold flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm text-rose-500">cancel</span>
                        <span>{alg}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 4: الأمراض المزمنة المثبتة */}
              <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">vital_signs</span>
                    <span>الأمراض المزمنة المثبتة ({chronicConditions.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-400">Chronic Diseases</span>
                </div>

                {chronicConditions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5">
                    لا توجد أمراض مزمنة مسجلة في هذا الملف
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {chronicConditions.map((cond) => (
                      <div
                        key={cond}
                        className="p-2.5 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-100 dark:border-white/5 flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-[#dde2f5]"
                      >
                        <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">check_circle</span>
                        <span>{cond}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* EDIT MODE: INTERACTIVE FULL FORM TO UPDATE PATIENT DATA */
            /* ========================================================================= */
            <form onSubmit={handleSaveBasicInfo} className="space-y-6">
              <div className="bg-white dark:bg-[#111A2E] p-6 rounded-3xl border border-teal-500/40 dark:border-[#00c2cb]/40 space-y-6 shadow-md">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      نموذج تعديل بيانات المريض
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-[#859394]">
                      عدل الحقول المطلوبة ثم اضغط حفظ التعديلات
                    </span>
                  </div>
                  <span className="text-xs bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] px-2.5 py-1 rounded-md font-mono font-bold">
                    ملف #{toEnglishDigits(patient.fileNumber || 1)}
                  </span>
                </div>

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      الاسم بالكامل <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="أدخل الاسم الرباعي"
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      رقم الهاتف المحمول
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010xxxxxxxx"
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                  </div>

                  {/* Gender */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      النوع / الجنس
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'male' | 'female')}
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    >
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>

                  {/* Age */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      العمر (سنوات)
                    </label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      min={1}
                      max={120}
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      تاريخ الميلاد (اختياري)
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                  </div>

                  {/* Blood Type */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      فصيلة الدم
                    </label>
                    <select
                      value={bloodType}
                      onChange={(e) => setBloodType(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    >
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Address */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                      العنوان بالتفصيل
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الشارع، المنطقة، المدينة، رقم العمارة..."
                      className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                  </div>
                </div>

                {/* Emergency Contact Sub-section */}
                <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-sm">emergency</span>
                    <span>جهة اتصال الطوارئ:</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="اسم جهة الطوارئ"
                      className="bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="رقم هاتف الطوارئ"
                      className="bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                    <input
                      type="text"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      placeholder="صلة القرابة (أب، أم، زوج/ة...)"
                      className="bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                  </div>
                </div>

                {/* Allergies Tag Manager */}
                <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
                  <h5 className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-rose-500 text-sm">warning</span>
                    <span>الحساسية الدوائية والغذائية:</span>
                  </h5>

                  <div className="flex flex-wrap gap-2">
                    {allergies.map((alg) => (
                      <span
                        key={alg}
                        className="px-3 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-xs font-bold flex items-center gap-1.5"
                      >
                        <span>{alg}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAllergy(alg)}
                          className="text-rose-400 hover:text-rose-700 cursor-pointer"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="text"
                      value={newAllergyInput}
                      onChange={(e) => setNewAllergyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAllergy();
                        }
                      }}
                      placeholder="أضف نوع حساسية (مثال: بنسلين، سلفا، أسبرين)..."
                      className="flex-1 bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddAllergy}
                      className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer transition-all"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>

                {/* Chronic Diseases Chips */}
                <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-sm">
                      medical_information
                    </span>
                    <span>الأمراض المزمنة المثبتة (انقر للتحديد أو الإلغاء):</span>
                  </h5>

                  <div className="flex flex-wrap gap-2">
                    {COMMON_CHRONIC_CONDITIONS.map((cond) => {
                      const isSelected = chronicConditions.includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => handleToggleChronic(cond)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#00c2cb] text-[#08101C] border-[#00c2cb] shadow-xs'
                              : 'bg-slate-50 dark:bg-[#080e1b] text-slate-700 dark:text-[#bbc9ca] border-slate-200 dark:border-white/5 hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '} {cond}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 max-w-md pt-1">
                    <input
                      type="text"
                      value={customChronicInput}
                      onChange={(e) => setCustomChronicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomChronic();
                        }
                      }}
                      placeholder="إضافة مرض مزمن آخر غير مدرج أعلاه..."
                      className="flex-1 bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomChronic}
                      className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-[#18233C] hover:bg-slate-300 dark:hover:bg-[#202c4b] text-slate-800 dark:text-white text-xs font-bold cursor-pointer transition-all"
                    >
                      + إضافة
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-[#bbc9ca]">
                    ملاحظات الطبيب وتنبيهات العيادة
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="أي ملاحظات سريرية، أو توصيات طويلة الأمد للمريض..."
                    className="w-full bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                  />
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] text-xs font-bold hover:bg-slate-200 dark:hover:bg-[#202c4b] cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">save</span>
                    <span>{isSaving ? 'جارِ الحفظ...' : 'حفظ التعديلات في الملف'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VISITS & CLINICAL CONSULTATIONS TIMELINE */}
      {/* ========================================================================= */}
      {(activeTab === 'visits' || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">history</span>
              <span>سجل الكشوفات والزيارات الطبية ({pVisits.length})</span>
            </h3>

            {canAccess('clinical-exam') && (
              <button
                type="button"
                onClick={() => {
                  onSelectPatientForExam(patient);
                  onNavigate('clinical-exam');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>تسجيل كشف جديد</span>
              </button>
            )}
          </div>

          {pVisits.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block">
                event_busy
              </span>
              <span>لا توجد كشوفات أو زيارات سابقة مسجلة لهذا المريض حتى الآن</span>
            </div>
          ) : (
            <div className="border-r-2 border-teal-300 dark:border-[#00c2cb]/40 pr-4 sm:pr-6 space-y-6">
              {pVisits.map((v) => {
                const vPrescriptions = pPrescriptions.filter(
                  (pr) => pr.visitId === v.visitId || pr.createdAt?.startsWith(v.createdAt?.split('T')[0])
                );
                const vLabs = pLabOrders.filter(
                  (l) => l.visitId === v.visitId || l.orderedAt?.startsWith(v.createdAt?.split('T')[0])
                );
                const vRads = pRadiologyOrders.filter(
                  (r) => r.visitId === v.visitId || r.orderedAt?.startsWith(v.createdAt?.split('T')[0])
                );
                const vFollowUp = effFollowUps.find(
                  (fu) => (fu.sourceVisitId === v.visitId || fu.patientId === patient.id) && fu.status !== 'CANCELLED'
                );

                const allMeds = vPrescriptions.flatMap((pr) => pr.items || []);

                const handleSendVisitWhatsapp = () => {
                  const visitDateStr = new Date(v.createdAt).toLocaleDateString(language === 'en' ? 'en-US' : 'ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });

                  const diagnosisStr =
                    v.clinicalData?.diagnosis && v.clinicalData.diagnosis.length > 0
                      ? v.clinicalData.diagnosis.join('، ')
                      : 'فحص واستشارة باطنة';

                  let medsSection = '';
                  if (allMeds.length > 0) {
                    const medsList = allMeds
                      .map(
                        (it, idx) =>
                          `  ${idx + 1}. *${it.name}* ${it.strength ? `(${it.strength})` : ''}\n     • الجرعة: ${it.dose || 'قرص'} — ${it.duration || ''}`
                      )
                      .join('\n');
                    medsSection = `\n\n💊 *الأدوية الموصوفة:*\n${medsList}`;
                  } else if (v.clinicalData?.treatment) {
                    medsSection = `\n\n💊 *العلاج والخطّة:* ${v.clinicalData.treatment}`;
                  }

                  let labsSection = '';
                  if (vLabs.length > 0) {
                    labsSection = `\n\n🧪 *التحاليل المطلوبة:* ${vLabs.map((l) => l.testName).join('، ')}`;
                  }

                  let radsSection = '';
                  if (vRads.length > 0) {
                    radsSection = `\n\n🩻 *الأشعة المطلوبة:* ${vRads.map((r) => r.radiologyName).join('، ')}`;
                  }

                  let followUpSection = '';
                  if (vFollowUp?.scheduledDate) {
                    followUpSection = `\n\n🗓 *موعد الاستشارة القادمة:* ${vFollowUp.scheduledDate}`;
                  }

                  const branch = findBranch();
                  const branchPhone = branch.phone || branch.mobile || '01092847162';
                  const message = `مرحباً بك أستاذ/ة *${fullName || patient.name}* 🌸
تفاصيل زيارتكم الطبية لدى *عيادة ${CLINIC_INFO.doctorName}* 🩺

🗓 *تاريخ الزيارة:* ${visitDateStr}
📋 *التشخيص الإكلينيكي:* ${diagnosisStr}${medsSection}${labsSection}${radsSection}${followUpSection}

📍 ${branch.name}${branch.address ? `: ${branch.address}` : ''}
📞 للتواصل والاستفسار: ${branchPhone}
مع تمنياتنا لكم بتمام الشفاء والعافية ✨`;

                  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
                };

                return (
                  <div
                    key={v.visitId}
                    className="relative bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-3.5 shadow-xs"
                  >
                    {/* Timeline Node Dot */}
                    <span
                      className={`w-3.5 h-3.5 rounded-full absolute -right-[23px] sm:-right-[31px] top-5 border-2 border-white dark:border-[#080e1b] ${
                        v.status === 'COMPLETED' ? 'bg-[#00c2cb]' : 'bg-amber-400'
                      }`}
                    />

                    {/* Visit Header */}
                    <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-slate-100 dark:border-white/5">
                      <div>
                        <div className="text-xs font-mono text-[#008f97] dark:text-[#00c2cb] font-bold flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                            {formatAppDate(v.createdAt, undefined, language)}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <span className="material-symbols-outlined text-[13px]">schedule</span>
                            {language === 'en' ? 'Time:' : 'الساعة:'} {formatAppTime(v.createdAt, language)}
                          </span>
                        </div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                          {v.visitType === 'NEW' ? 'كشف أول مرة (جديد)' : 'استشارة / متابعة'} —{' '}
                          {v.clinicalData?.chiefComplaint || v.receptionistData?.symptoms || 'كشف عيادة باطنة'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const doctorInfo = getPrescriptionDoctorInfo();
                            printVisitReportDocument({
                              config: {
                                doctorName: doctorInfo.doctorName,
                                doctorNameEn: doctorInfo.doctorNameEn,
                                specialtyAr: doctorInfo.specialtyAr,
                                specialtyEn: doctorInfo.specialtyEn,
                                degreesAr: doctorInfo.degreesAr,
                                degreesEn: doctorInfo.degreesEn,
                                phone: doctorInfo.phone,
                                logoUrl: doctorInfo.logoUrl,
                              },
                              patient: {
                                fullName: fullName || patient.name,
                                fileNumber: patient.fileNumber || patientCanonical?.patientId || 1,
                                age: age || patient.age,
                                gender: gender === 'male' ? 'ذكر' : gender === 'female' ? 'أنثى' : undefined,
                                phone: phone || patient.phone,
                              },
                              visit: {
                                visitId: v.visitId,
                                visitType: v.visitType,
                                createdAt: v.createdAt,
                                vitalSigns: v.vitalSigns,
                                clinicalData: v.clinicalData,
                                receptionistData: v.receptionistData,
                              },
                              medications: allMeds.map((m) => ({
                                name: m.name,
                                strength: m.strength,
                                dose: m.dose,
                                duration: m.duration,
                                instructions: m.instructions,
                              })),
                              labOrders: vLabs,
                              radiologyOrders: vRads,
                              followUp: vFollowUp
                                ? { scheduledDate: vFollowUp.scheduledDate, notes: vFollowUp.notes }
                                : undefined,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#18233C] dark:hover:bg-white/10 text-slate-800 dark:text-[#dde2f5] border border-slate-300 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          title="طباعة تقرير الكشف والزيارة الطبية"
                        >
                          <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">
                            print
                          </span>
                          <span>طباعة تقرير الزيارة</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendVisitWhatsapp}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          title="إرسال تقرير الكشف الكامل إلى المريض عبر واتساب"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                          <span>إرسال تقرير الزيارة (واتساب)</span>
                        </button>
                      </div>
                    </div>

                    {/* Vital Signs Grid - Always render vitals card */}
                    {(() => {
                      const vs = v.vitalSigns || {};
                      const bp = (vs.bloodPressure || vs.bp || '').toString().trim();
                      const pulse = (vs.pulse || '').toString().trim();
                      const temp = (vs.temperature || vs.temp || '').toString().trim();
                      const rbs = (vs.randomBloodSugar || vs.rbs || '').toString().trim();
                      const spo2 = (vs.oxygenSaturation || vs.spo2 || '').toString().trim();
                      const weight = (vs.weight || '').toString().trim();
                      const height = (vs.height || '').toString().trim();

                      return (
                        <div className="p-3 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/5 space-y-2">
                          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                            <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">monitoring</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white">العلامات الحيوية والقياسات البدنية</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">ضغط الدم</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{bp || '--'}</strong>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">النبض</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{pulse ? `${pulse} bpm` : '--'}</strong>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">الحرارة</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{temp ? `${temp} °C` : '--'}</strong>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">سكر عشوائي</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{rbs ? `${rbs} mg/dL` : '--'}</strong>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">نسبة الأكسجين</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{spo2 ? `${spo2}%` : '--'}</strong>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">الوزن</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{weight ? `${weight} كجم` : '--'}</strong>
                            </div>
                            <div className="p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl text-center border border-slate-100 dark:border-white/5">
                              <span className="text-[10px] text-slate-400 block font-bold">الطول</span>
                              <strong className="text-slate-900 dark:text-white font-mono">{height ? `${height} سم` : '--'}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Diagnosis & Findings */}
                    {v.clinicalData?.diagnosis && v.clinicalData.diagnosis.length > 0 && (
                      <div className="text-xs text-slate-800 dark:text-[#dde2f5] p-2.5 rounded-xl bg-teal-50/60 dark:bg-[#00c2cb]/10 border border-teal-200/60 dark:border-[#00c2cb]/20">
                        <strong className="text-[#008f97] dark:text-[#45dee7]">📋 التشخيص الإكلينيكي: </strong>
                        <span>{v.clinicalData.diagnosis.join('، ')}</span>
                      </div>
                    )}

                    {v.clinicalData?.treatment && (
                      <div className="text-xs text-slate-700 dark:text-[#bbc9ca] p-2.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-100 dark:border-white/5">
                        <strong className="text-slate-900 dark:text-white">💊 العلاج والتعليمات: </strong>
                        <span>{v.clinicalData.treatment}</span>
                      </div>
                    )}

                    {/* Labs & Rads & Followup */}
                    <div className="flex flex-wrap gap-2 pt-1 text-xs">
                      {vLabs.length > 0 && (
                        <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 px-2.5 py-1 rounded-lg">
                          🧪 تحاليل مطلوبة: {vLabs.map((l) => l.testName).join('، ')}
                        </span>
                      )}
                      {vRads.length > 0 && (
                        <span className="bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-[#d0bcff] border border-purple-200 dark:border-purple-900/40 px-2.5 py-1 rounded-lg">
                          🩻 أشعة مطلوبة: {vRads.map((r) => r.radiologyName).join('، ')}
                        </span>
                      )}
                      {vFollowUp?.scheduledDate && (
                        <span className="bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-[#45dee7] border border-teal-200 dark:border-teal-900/40 px-2.5 py-1 rounded-lg font-bold">
                          🗓 موعد المتابعة: {vFollowUp.scheduledDate}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRESCRIPTIONS & MEDICATIONS */}
      {/* ========================================================================= */}
      {(activeTab === 'prescriptions' || activeTab === 'all') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-600 dark:text-[#d0bcff] text-base">description</span>
              <span>الروشتات والوصفات الطبية المعتمدة للمريض ({pPrescriptions.length})</span>
            </h3>
          </div>

          {pPrescriptions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block">
                medication
              </span>
              <span>لا توجد روشتات مسجلة لهذا المريض حتى الآن</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pPrescriptions.map((pr) => {
                const handleSendRxWhatsapp = () => {
                  const medsList = pr.items
                    .map(
                      (it, idx) =>
                        `${idx + 1}. *${it.name}* ${it.strength ? `(${it.strength})` : ''}\n   - الجرعة: ${it.dose || 'قرص'}\n   - المدة: ${it.duration || ''}`
                    )
                    .join('\n');
                  const message = `مرحباً بك أستاذ/ة *${fullName || patient.name}* 🌸
إليك الروشتة الطبية الخاصة بزيارتكم لدى *عيادة ${CLINIC_INFO.doctorName}* 🩺
🗓 تاريخ الروشتة: *${formatAppDate(pr.createdAt, undefined, language)}*

💊 *الأدوية والجرعات:*
${medsList}

${pr.notes ? `📝 *إرشادات الطبيب:* ${pr.notes}\n\n` : ''}مع تمنياتنا لكم بالشفاء العاجل ✨`;

                  window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
                };

                return (
                  <div
                    key={pr.prescriptionId}
                    className="p-5 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/5 space-y-3.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5 flex-wrap gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-[#d0bcff] flex items-center justify-center">
                          <span className="material-symbols-outlined text-base">prescriptions</span>
                        </div>
                        <div>
                          <strong className="text-slate-900 dark:text-white block">
                            {language === 'en' ? 'Prescription dated' : 'روشتة بتاريخ'} {formatAppDate(pr.createdAt, undefined, language)}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {pr.items.length} {language === 'en' ? 'prescribed items' : 'أصناف دوائية مسجلة'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            const doctorInfo = getPrescriptionDoctorInfo();
                            let prescriptionConfig: any = {
                              doctorName: doctorInfo.doctorName,
                              doctorNameEn: doctorInfo.doctorNameEn,
                              specialtyAr: doctorInfo.specialtyAr,
                              specialtyEn: doctorInfo.specialtyEn,
                              degreesAr: doctorInfo.degreesAr,
                              degreesEn: doctorInfo.degreesEn,
                              phone: doctorInfo.phone,
                              logoUrl: doctorInfo.logoUrl,
                              showLogo: true,
                              showHeader: true,
                              showFooter: true,
                              preprintedPaperMode: false,
                              showQr: true,
                              qrType: 'clinic',
                              footerFontSize: 'medium',
                              outerMargin: 'normal',
                              headerMarginTop: 'balanced',
                              footerMarginBottom: 'balanced',
                              sectionSpacing: 'comfortable',
                              branches: CLINIC_INFO.branches || [],
                            };

                            try {
                              const cached = localStorage.getItem('soli_prescription_settings');
                              if (cached) {
                                const parsed = JSON.parse(cached);
                                prescriptionConfig = { ...prescriptionConfig, ...parsed };
                              }
                            } catch {
                              // fallback
                            }

                            const matchedVisit = (visits || []).find((vItem) => vItem.visitId === pr.visitId);
                            const diagnosesList =
                              matchedVisit?.clinicalData?.diagnosis?.map((d, i) => ({
                                id: `d-${i}`,
                                nameAr: d,
                                isPrimary: i === 0,
                              })) || [];

                            printPrescriptionDocument({
                              config: prescriptionConfig,
                              patient: {
                                name: fullName || patient.name,
                                age: age || patient.age,
                                phone: phone || patient.phone,
                                fileNumber: patient.fileNumber || patientCanonical?.patientId || 1,
                                date: pr.createdAt,
                              },
                              items: pr.items.map((it, idx) => ({
                                id: `it-${idx}`,
                                drugName: it.name,
                                strength: it.strength,
                                dosage: it.dose,
                                dosageInstructions: it.instructions,
                                duration: it.duration,
                                notes: pr.notes,
                              })),
                              diagnoses: diagnosesList,
                              lifestyleAdvice: pr.notes,
                              followupDate: effFollowUps.find((f) => f.patientId === (patient.id || patient.patientId))
                                ?.scheduledDate,
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#18233C] dark:hover:bg-white/10 text-slate-800 dark:text-[#dde2f5] border border-slate-300 dark:border-white/10 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                          title="طباعة الروشتة الطبية A5"
                        >
                          <span className="material-symbols-outlined text-sm text-purple-600 dark:text-[#d0bcff]">
                            print
                          </span>
                          <span>طباعة الروشتة</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendRxWhatsapp}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                          title="إرسال الروشتة عبر واتساب"
                        >
                          <span className="material-symbols-outlined text-sm">chat</span>
                          <span>إرسال الروشتة عبر واتساب</span>
                        </button>
                      </div>
                    </div>

                    {/* Drugs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {pr.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white block">
                              {it.name} {it.strength}
                            </span>
                            <span className="text-[10px] text-slate-400">{it.instructions || 'وفق إرشادات الطبيب'}</span>
                          </div>
                          <div className="text-left font-mono">
                            <span className="font-bold text-[#008f97] dark:text-[#00c2cb] block">{it.dose}</span>
                            <span className="text-[10px] text-slate-400">{it.duration}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {pr.notes && (
                      <div className="text-xs text-slate-600 dark:text-[#859394] italic bg-slate-50/80 dark:bg-[#080e1b]/60 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                        <strong>إرشادات الطبيب: </strong> {pr.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LAB ORDERS & MEASURED RESULTS */}
      {/* ========================================================================= */}
      {(activeTab === 'labs' || activeTab === 'all') && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-base">biotech</span>
            <span>الفحوصات والتحاليل المعملية ({pLabOrders.length})</span>
          </h3>

          {pLabOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block">science</span>
              <span>لا توجد تحاليل معملية مسجلة لهذا المريض</span>
            </div>
          ) : (
            <div className="space-y-3">
              {pLabOrders.map((l) => {
                const hasResult = !!(l.result && l.result.trim());
                const isResult = l.status === 'RESULT' || hasResult;
                const isReport = l.status === 'REPORT';

                return (
                  <div
                    key={l.labOrderId}
                    className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/5 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-[#00c2cb] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-lg">science</span>
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">{l.testName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {language === 'en' ? 'Order Date:' : 'تاريخ الطلب:'} {formatAppDate(l.orderedAt, undefined, language)}{' '}
                            {l.notes ? `• ${l.notes}` : ''}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isResult ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-[#10B981] border border-emerald-300 dark:border-emerald-700/50">
                            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                            <span>النتيجة مسجلة ومعتمدة ✓</span>
                          </span>
                        ) : isReport ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700/50">
                            <span className="material-symbols-outlined text-sm">clinical_notes</span>
                            <span>تقرير معملي</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-[#FBBF24] border border-amber-300 dark:border-amber-700/50">
                            <span className="material-symbols-outlined text-sm">hourglass_top</span>
                            <span>مطلوب وبانتظار النتيجة</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isResult && hasResult && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-emerald-200/60 dark:border-emerald-900/30 text-xs flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">النتيجة المقاسة بالتحليل:</span>
                          <span className="font-mono font-black text-emerald-700 dark:text-[#10B981] text-sm bg-emerald-50 dark:bg-emerald-950/40 px-3 py-0.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                            {l.result}
                          </span>
                        </div>
                        {l.notes && <span className="text-[11px] text-slate-400">{l.notes}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: RADIOLOGY & IMAGING REPORTS */}
      {/* ========================================================================= */}
      {(activeTab === 'radiology' || activeTab === 'all') && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600 dark:text-[#d0bcff] text-base">radiology</span>
            <span>تقارير الأشعة والتصوير الطبي ({pRadiologyOrders.length})</span>
          </h3>

          {pRadiologyOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block">
                radiology
              </span>
              <span>لا توجد فحوصات أشعة مسجلة لهذا المريض</span>
            </div>
          ) : (
            <div className="space-y-3">
              {pRadiologyOrders.map((r) => {
                const hasReport = !!(r.report && r.report.trim());
                const hasResult = !!(r.result && r.result.trim());
                const isRecorded = r.status === 'REPORT' || r.status === 'RESULT' || hasReport || hasResult;
                const reportText = r.report || r.result || '';

                return (
                  <div
                    key={r.radiologyOrderId}
                    className="p-4 rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/5 space-y-3 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-[#d0bcff] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-lg">radiology</span>
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-slate-900 dark:text-white">{r.radiologyName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {language === 'en' ? 'Exam Date:' : 'تاريخ الفحص:'} {formatAppDate(r.orderedAt, undefined, language)}{' '}
                            {r.notes ? `• ${r.notes}` : ''}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isRecorded ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-[#d0bcff] border border-purple-300 dark:border-purple-700/50">
                            <span className="material-symbols-outlined text-sm text-purple-600">check_circle</span>
                            <span>تم تسجيل التقرير الإشعاعي ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-[#FBBF24] border border-amber-300 dark:border-amber-700/50">
                            <span className="material-symbols-outlined text-sm">hourglass_top</span>
                            <span>مطلوب وبانتظار التقرير</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isRecorded && reportText && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-purple-200/60 dark:border-purple-900/30 text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 text-purple-700 dark:text-[#d0bcff] font-bold text-xs">
                          <span className="material-symbols-outlined text-sm">description</span>
                          <span>التقرير السريري للأشعة والتصوير:</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-[#dde2f5]">
                          {reportText}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: INVOICES & BILLING TRANSACTIONS */}
      {/* ========================================================================= */}
      {(activeTab === 'billing' || activeTab === 'all') && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-base">receipt_long</span>
            <span>سجل المعاملات والمدفوعات المالية ({pInvoices.length})</span>
          </h3>

          {pInvoices.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 block">
                payments
              </span>
              <span>لا توجد فواتير أو معاملات مالية مسجلة لهذا المريض</span>
            </div>
          ) : (
            <div className="space-y-3">
              {pInvoices.map((inv) => (
                <div
                  key={inv.invoiceId}
                  className="p-4 bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 flex items-center justify-between text-xs shadow-xs"
                >
                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white block">
                      فاتورة كشف وزيارة بالعيادة
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{formatAppDate(inv.createdAt, undefined, language)}</span>
                      <span>•</span>
                      <span className="text-[#008f97] dark:text-[#00c2cb] font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        <span>{language === 'en' ? 'Time:' : 'الساعة:'} {formatAppTime(inv.createdAt, language)}</span>
                      </span>
                      <span>•</span>
                      <span>#{inv.invoiceId.slice(0, 8)}</span>
                    </span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="font-black text-base text-[#008f97] dark:text-[#45dee7] block">
                      {inv.total} ج.م
                    </span>
                    <span
                      className={`text-[10px] font-bold block mt-0.5 ${
                        inv.status === 'PAID' ? 'text-emerald-600 dark:text-[#10B981]' : 'text-amber-500'
                      }`}
                    >
                      {inv.status === 'PAID' ? 'مسدد بالكامل ✓' : 'غير مسدد'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-rose-500/30 rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">delete_forever</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تأكيد حذف ملف المريض نهائياً
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#859394] leading-relaxed">
                هل أنت متأكد من رغبتك في حذف ملف المريض <strong className="text-slate-800 dark:text-white">({fullName || patient.name})</strong> رقم الملف <strong className="text-[#008f97] dark:text-[#00c2cb] font-mono">#{toEnglishDigits(patient.fileNumber || 1)}</strong>؟
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-1">
                ⚠️ تحذير: سيتم حذف كافة البيانات الطبية والزيارات المرتبطة بهذا الملف ولا يمكن التراجع بعد الحذف.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] text-xs font-bold transition-all cursor-pointer hover:bg-slate-200 dark:hover:bg-[#242a38]"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeletePatient) {
                    onDeletePatient(patient.id);
                  }
                  setShowDeleteConfirm(false);
                  onBack();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
              >
                تأكيد الحذف النهائي
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
