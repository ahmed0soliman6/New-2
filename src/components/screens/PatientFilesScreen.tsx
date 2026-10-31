import React, { useState, useMemo } from 'react';
import { PatientListItem, ScreenType } from '../../types';
import { usePermissions } from '../../context/AuthContext';
import { PatientDetailFullScreen } from './PatientDetailFullScreen';
import { toEnglishDigits, formatAppDate } from '../../utils/numberUtils';
import { useLanguage } from '../../i18n/LanguageContext';
import { READ_OPT } from '../../config/readOpt';
import type {
  FollowUp,
  Invoice,
  LabOrder,
  Patient,
  Prescription,
  RadiologyOrder,
  Visit,
} from '../../types/database';

export interface PatientListItemsScreenProps {
  patients: PatientListItem[];
  patientsCanonical?: Patient[];
  onNavigate: (screen: ScreenType) => void;
  onSelectPatientForExam: (patient: PatientListItem) => void;
  onDeletePatient?: (patientId: string) => void;
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
  visits?: Visit[];
  invoices?: Invoice[];
  prescriptions?: Prescription[];
  labOrders?: LabOrder[];
  radiologyOrders?: RadiologyOrder[];
  followUps?: FollowUp[];
  selectedPatientId?: string;
}

export const PatientListItemsScreen: React.FC<PatientListItemsScreenProps> = ({
  patients,
  patientsCanonical,
  onNavigate,
  onSelectPatientForExam,
  onDeletePatient,
  onUpdatePatient,
  selectedPatientId,
  visits = [],
  invoices = [],
  prescriptions = [],
  labOrders = [],
  radiologyOrders = [],
  followUps = [],
}) => {
  const { canAccess } = usePermissions();
  const { language, isRTL, t } = useLanguage();
  const [viewingPatientId, setViewingPatientId] = useState<string | null>(selectedPatientId || null);
  const [search, setSearch] = useState('');
  const [patientToDelete, setPatientToDelete] = useState<PatientListItem | null>(null);

  // If a patient is selected for viewing, render the full-page dossier
  const activePatient = viewingPatientId
    ? patients.find((p) => p.id === viewingPatientId) || null
    : null;

  const activePatientCanonical = viewingPatientId
    ? patientsCanonical?.find((p) => p.patientId === viewingPatientId)
    : undefined;

  const filteredPatients = useMemo(() => {
    return patients
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          (p.name || '').toLowerCase().includes(q) ||
          (p.phone || '').includes(q) ||
          String(p.fileNumber || '').includes(q) ||
          (p.medicalCode || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Newest registered or highest file number at the top
        const numB = Number(b.fileNumber) || 0;
        const numA = Number(a.fileNumber) || 0;
        if (numB !== numA) return numB - numA;
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [patients, search]);

  if (activePatient) {
    return (
      <PatientDetailFullScreen
        patient={activePatient}
        patientCanonical={activePatientCanonical}
        onBack={() => setViewingPatientId(null)}
        onUpdatePatient={onUpdatePatient}
        onSelectPatientForExam={onSelectPatientForExam}
        onNavigate={onNavigate}
        onDeletePatient={(id) => {
          if (onDeletePatient) onDeletePatient(id);
          setViewingPatientId(null);
        }}
        visits={visits}
        invoices={invoices}
        prescriptions={prescriptions}
        labOrders={labOrders}
        radiologyOrders={radiologyOrders}
        followUps={followUps}
      />
    );
  }

  return (
    <div className="flex flex-col w-full pb-16 space-y-6 text-slate-800 dark:text-[#dde2f5]" id="patient-files-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-[#859394] mb-1">
            <span>الرئيسية</span>
            <span>&gt;</span>
            <span className="text-[#008f97] dark:text-[#00c2cb]">السجلات والملفات الطبية الإلكترونية (EMR)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-3">
            <span>ملفات المرضى والأرشيف الطبي</span>
            <span className="bg-teal-50 dark:bg-[#18233C] text-[#008f97] dark:text-[#00c2cb] px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border border-teal-200 dark:border-transparent">
              {patients.length} ملف نشط
            </span>
          </h1>
        </div>

        <button
          onClick={() => onNavigate('new-visit')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] text-xs font-bold shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer self-start sm:self-auto"
          id="btn-add-new-patient"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          <span>+ فتح ملف مريض جديد</span>
        </button>
      </div>

      {/* Search Input & Helper Instructions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#859394] text-base">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم الهاتف، أو رقم الملف..."
            className="w-full bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] pr-10 pl-4 py-3 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb] border border-slate-200 dark:border-white/5 shadow-xs transition-all"
            id="patient-search-input"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-[#859394] px-1 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">touch_app</span>
          <span>اضغط على بطاقة أي مريض لفتح الملف الطبي الشامل وتعديل البيانات</span>
        </div>
      </div>

      {/* Main Patients List */}
      <div className="space-y-3.5">
        {filteredPatients.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 text-xs text-slate-400">
            لا يوجد مرضى مطابقين لنتائج البحث
          </div>
        ) : (
          filteredPatients.map((p) => {
            const completedVisits = READ_OPT ? [] : visits.filter((v) => v.patientId === p.id && v.status === 'COMPLETED');
            const pVisitsCount = READ_OPT ? (p.visitsCount || 1) : (completedVisits.length > 0 ? completedVisits.length : p.visitsCount || 1);
            const pPrescriptionsCount = prescriptions.filter((pr) => pr.patientId === p.id).length;

            return (
              <div
                key={p.id}
                className="rounded-2xl border transition-all overflow-hidden bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/5 hover:border-[#00c2cb]/50 dark:hover:border-[#00c2cb]/50 shadow-xs hover:shadow-md cursor-pointer group"
                id={`patient-card-${p.id}`}
                onClick={() => setViewingPatientId(p.id)}
              >
                {/* Clickable Header for Patient Card */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
                  {/* Basic Patient Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 transition-all ${
                        p.gender === 'male'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30'
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl">
                        {p.gender === 'male' ? 'male' : 'female'}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-900 dark:text-[#dde2f5] group-hover:text-[#008f97] dark:group-hover:text-[#00c2cb] transition-colors">
                          {p.name}
                        </span>
                        <span className="bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-teal-200/50 dark:border-transparent">
                          ملف #{toEnglishDigits(p.fileNumber || 1)}
                        </span>
                        {p.bloodType && p.bloodType !== 'غير محدد' && (
                          <span className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border border-red-100 dark:border-transparent">
                            {p.bloodType}
                          </span>
                        )}
                        {p.allergies && p.allergies.length > 0 && (
                          <span className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/30 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">warning</span>
                            <span>حساسية دوائية</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-[#859394] flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono">{toEnglishDigits(p.phone || (language === 'en' ? 'No phone' : 'بدون هاتف'))}</span>
                        <span>•</span>
                        <span>{toEnglishDigits(p.age)} {language === 'en' ? 'yrs' : 'سنة'}</span>
                        {p.address && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{p.address}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-[#008f97] dark:text-[#00c2cb] font-semibold">
                          {toEnglishDigits(pVisitsCount)} {language === 'en' ? 'Visits' : 'كشوفات'}
                        </span>
                        <span>•</span>
                        <span className="text-purple-600 dark:text-[#d0bcff]">
                          {toEnglishDigits(pPrescriptionsCount)} {language === 'en' ? 'Prescriptions' : 'روشتات'}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-[#10B981] font-semibold">
                          {READ_OPT ? '—' : `${toEnglishDigits(p.totalPaid || 0)} ج.م`}
                        </span>
                      </div>

                      {/* Registration and Last Visit Date & Time */}
                      <div className="text-[11px] text-slate-500 dark:text-[#859394] flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 font-mono">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <span className="material-symbols-outlined text-[13px] text-[#008f97] dark:text-[#00c2cb]">calendar_today</span>
                          <span>{language === 'en' ? 'Registered:' : 'تاريخ التسجيل:'} {toEnglishDigits(p.registrationDate || '—')}</span>
                          {p.registrationTime && (
                            <span className="text-[#008f97] dark:text-[#00c2cb] font-bold">
                              {language === 'en' ? 'at ' : 'الساعة '}{toEnglishDigits(p.registrationTime)}
                            </span>
                          )}
                        </div>
                        {p.lastVisitDate && (
                          <div className="flex items-center gap-1 text-teal-700 dark:text-teal-400">
                            <span className="material-symbols-outlined text-[13px]">history</span>
                            <span>{language === 'en' ? 'Last Visit:' : 'آخر زيارة:'} {toEnglishDigits(p.lastVisitDate)}</span>
                            {p.lastVisitTime && (
                              <span className="font-bold">{language === 'en' ? 'at ' : 'الساعة '}{toEnglishDigits(p.lastVisitTime)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Button To Open Full Page */}
                  <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 dark:border-white/5">
                    {/* Primary Button to Open Full Dedicated Page */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingPatientId(p.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 hover:bg-[#00c2cb] text-[#008f97] dark:text-[#45dee7] hover:text-[#08101C] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-teal-200/70 dark:border-[#00c2cb]/30 shadow-2xs group-hover:bg-[#00c2cb] group-hover:text-[#08101C]"
                    >
                      <span className="material-symbols-outlined text-base">folder_open</span>
                      <span>عرض وتعديل الملف الكامل</span>
                      <span className="material-symbols-outlined text-sm">arrow_back</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {canAccess('clinical-exam') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPatientForExam(p);
                            onNavigate('clinical-exam');
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#18233C] hover:bg-[#00c2cb] hover:text-[#08101C] text-slate-700 dark:text-[#dde2f5] text-xs font-bold transition-all cursor-pointer whitespace-nowrap hidden sm:flex items-center gap-1 border border-slate-200 dark:border-white/5"
                          title="بدء كشف إكلينيكي للمريض"
                        >
                          <span className="material-symbols-outlined text-sm">stethoscope</span>
                          <span>كشف</span>
                        </button>
                      )}

                      {onDeletePatient && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPatientToDelete(p);
                          }}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition-all cursor-pointer border border-rose-200 dark:border-rose-900/30 flex items-center justify-center shrink-0"
                          title="حذف ملف المريض"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal for Deleting Patient File */}
      {patientToDelete && (
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
                هل أنت متأكد من رغبتك في حذف ملف المريض <strong className="text-slate-800 dark:text-white">({patientToDelete.name})</strong> رقم الملف <strong className="text-[#008f97] dark:text-[#00c2cb] font-mono">#{toEnglishDigits(patientToDelete.fileNumber || 1)}</strong>؟
              </p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-1">
                ⚠️ تحذير: سيتم حذف كافة البيانات الطبية والزيارات المرتبطة بهذا الملف ولا يمكن التراجع بعد الحذف.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-3">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] text-xs font-bold transition-all cursor-pointer hover:bg-slate-200 dark:hover:bg-[#242a38]"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeletePatient && patientToDelete) {
                    onDeletePatient(patientToDelete.id);
                    setPatientToDelete(null);
                  }
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
