import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PatientListItem,
  AppointmentListItem,
  QueueItem,
  TransactionRecord,
  ScreenType,
} from '../types';
import { INITIAL_SERVICES } from '../data/database';
import { toEnglishDigits } from '../utils/numberUtils';
import { useLanguage } from '../i18n/LanguageContext';
import { READ_OPT } from '../config/readOpt';

export interface GlobalSearchBarProps {
  patients: PatientListItem[];
  appointments?: AppointmentListItem[];
  queue?: QueueItem[];
  transactions?: TransactionRecord[];
  syncStatus?: 'connected' | 'offline' | 'syncing' | 'error';
  onNavigate: (screen: ScreenType) => void;
  onSelectPatient?: (patient: PatientListItem) => void;
  onStartIntakeFromAppointment?: (appointment: AppointmentListItem) => void;
  onCallPatient?: (ticket: string, name: string) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  patients = [],
  appointments = [],
  queue = [],
  transactions = [],
  syncStatus = 'connected',
  onNavigate,
  onSelectPatient,
  onStartIntakeFromAppointment,
  onCallPatient,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'patients' | 'appointments' | 'queue' | 'services' | 'billing'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Pre-load default medical services for search
  const medicalServices = useMemo(
    () =>
      INITIAL_SERVICES.map((s) => ({
        id: s.serviceId,
        name: s.nameAr,
        category: 'خدمات العيادة',
        price: s.price,
        description: s.nameEn,
        durationMinutes: 20,
      })),
    []
  );

  // Keyboard shortcut Ctrl+K or Cmd+K or /
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Normalize Arabic text for smart matching
  const normalize = (str: string = '') => {
    return str
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  };

  const cleanQuery = normalize(searchTerm);

  // Real-time Search Engine
  const searchResults = useMemo(() => {
    if (!cleanQuery) return { patients: [], appointments: [], queue: [], services: [], billing: [], total: 0 };

    // 1. Search Patients (Name, Phone, Medical Code, File Number, Symptoms, Chronic Conditions, Governorate)
    const matchedPatients = patients.filter((p) => {
      const nameMatch = normalize(p.name).includes(cleanQuery);
      const phoneMatch = (p.phone || '').replace(/[^0-9]/g, '').includes(cleanQuery);
      const codeMatch = normalize(p.medicalCode || '').includes(cleanQuery);
      const fileMatch = p.fileNumber ? String(p.fileNumber).includes(cleanQuery) : false;
      const govMatch = normalize(p.governorate || '').includes(cleanQuery);
      const addressMatch = normalize(p.address || '').includes(cleanQuery);
      const allergyMatch = (p.allergies || []).some((a) => normalize(a).includes(cleanQuery));
      const chronicMatch = (p.chronicConditions || []).some((c) => normalize(c).includes(cleanQuery));
      return nameMatch || phoneMatch || codeMatch || fileMatch || govMatch || addressMatch || allergyMatch || chronicMatch;
    });

    // 2. Search Appointments (Patient Name, Phone, Medical Code, Visit/Service Type, Branch, Date, Status)
    const matchedAppointments = appointments.filter((a) => {
      const nameMatch = normalize(a.patientName).includes(cleanQuery);
      const phoneMatch = (a.phone || '').replace(/[^0-9]/g, '').includes(cleanQuery);
      const codeMatch = normalize(a.medicalCode || '').includes(cleanQuery);
      const fileMatch = a.fileNumber ? String(a.fileNumber).includes(cleanQuery) : false;
      const serviceMatch = normalize(a.visitType || '').includes(cleanQuery);
      const dateMatch = normalize(a.date || '').includes(cleanQuery);
      const statusMatch = normalize(a.status || '').includes(cleanQuery);
      return nameMatch || phoneMatch || codeMatch || fileMatch || serviceMatch || dateMatch || statusMatch;
    });

    // 3. Search Queue (Waiting Room: Patient Name, Ticket, Phone, Service Type, Complaint)
    const matchedQueue = queue.filter((q) => {
      const nameMatch = normalize(q.patientName).includes(cleanQuery);
      const ticketMatch = normalize(q.ticketNumber || '').includes(cleanQuery);
      const phoneMatch = (q.phone || '').replace(/[^0-9]/g, '').includes(cleanQuery);
      const serviceMatch = normalize(q.visitType || '').includes(cleanQuery);
      const complaintMatch = normalize(q.complaint || '').includes(cleanQuery);
      return nameMatch || ticketMatch || phoneMatch || serviceMatch || complaintMatch;
    });

    // 4. Search Medical Services (Service Name, Category, Description)
    const matchedServices = medicalServices.filter((s) => {
      const nameMatch = normalize(s.name).includes(cleanQuery);
      const catMatch = normalize(s.category).includes(cleanQuery);
      const descMatch = s.description ? normalize(s.description).includes(cleanQuery) : false;
      return nameMatch || catMatch || descMatch;
    });

    // 5. Search Billing & Invoices (Receipt No, Patient Name, Service Name, Payment Method)
    const matchedBilling = transactions.filter((t) => {
      const nameMatch = normalize(t.patientName || '').includes(cleanQuery);
      const receiptMatch = normalize(t.receiptNumber || t.receiptNo || '').includes(cleanQuery);
      const serviceMatch = normalize(t.serviceName || t.description || '').includes(cleanQuery);
      const methodMatch = normalize(t.paymentMethod || t.paymentMethodLabel || t.method || '').includes(cleanQuery);
      return nameMatch || receiptMatch || serviceMatch || methodMatch;
    });

    const total =
      matchedPatients.length +
      matchedAppointments.length +
      matchedQueue.length +
      matchedServices.length +
      matchedBilling.length;

    return {
      patients: matchedPatients,
      appointments: matchedAppointments,
      queue: matchedQueue,
      services: matchedServices,
      billing: matchedBilling,
      total,
    };
  }, [cleanQuery, patients, appointments, queue, medicalServices, transactions]);

  // Handle actions
  const handleSelectPatient = (patient: PatientListItem) => {
    if (onSelectPatient) {
      onSelectPatient(patient);
    }
    onNavigate('patient-records');
    setIsOpen(false);
  };

  const handleStartExam = (patient: PatientListItem) => {
    if (onSelectPatient) {
      onSelectPatient(patient);
    }
    onNavigate('clinical-exam');
    setIsOpen(false);
  };

  const handleStartNewVisit = (patient?: PatientListItem) => {
    if (patient && onSelectPatient) {
      onSelectPatient(patient);
    }
    onNavigate('new-visit');
    setIsOpen(false);
  };

  const handleOpenAppointment = (appointment: AppointmentListItem) => {
    if (onStartIntakeFromAppointment) {
      onStartIntakeFromAppointment(appointment);
    }
    onNavigate('appointments');
    setIsOpen(false);
  };

  return (
    <>
      {/* =========================================================================
          1. HEADER COMPACT SEARCH TRIGGER BUTTON / BAR
         ========================================================================= */}
      <div className="relative flex-1 min-w-0 max-w-[130px] min-[380px]:max-w-[180px] sm:max-w-md mx-1 sm:mx-4">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full h-9 sm:h-10 px-2 sm:px-3.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-[#111A2E] dark:hover:bg-[#18233C] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-between gap-1.5 sm:gap-2 text-xs transition-all cursor-pointer group shadow-2xs"
          title={language === 'en' ? 'Universal System Search (Ctrl + K)' : 'بحث شامل في النظام (Ctrl + K)'}
        >
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#00c2cb] transition-colors text-base sm:text-lg shrink-0">
              search
            </span>
            <span className="truncate font-medium text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs">
              <span className="hidden sm:inline">
                {language === 'en' ? 'Universal search (Patient, phone, file #, service...)' : 'بحث شامل (اسم، هاتف، ملف، خدمة...)'}
              </span>
              <span className="sm:hidden font-bold">
                {language === 'en' ? 'Search...' : 'بحث...'}
              </span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <span className="px-1.5 py-0.5 rounded-md bg-white dark:bg-black/50 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
              Ctrl+K
            </span>
          </div>
        </button>
      </div>

      {/* =========================================================================
          2. EXPANDED UNIVERSAL SYSTEM SEARCH MODAL OVERLAY
         ========================================================================= */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 sm:pt-16 animate-in fade-in duration-150">
          <div
            ref={modalRef}
            className="w-full max-w-3xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Header & Main Search Input */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-[#111A2E]/80 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#00c2cb]/15 text-[#00c2cb] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-lg">manage_search</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {language === 'en' ? 'Universal Clinic Search' : 'البحث الشامل في النظام'}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {language === 'en' ? 'Live synchronized search across cloud and local storage' : 'بحث حي ومتزامن عبر السحابة والتخزين المحلي'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{language === 'en' ? 'Live Cloud Sync' : 'السحابة والمتصفح متصلان'}</span>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              </div>

              {/* Live Input Field */}
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={language === 'en' ? 'Type patient name, phone, file number (e.g. P-001), or service...' : 'اكتب اسم المريض، رقم الهاتف، كود الملف (P-001)، أو نوع الخدمة المطلوبة...'}
                  className={`w-full bg-white dark:bg-[#070d18] text-slate-900 dark:text-white text-sm sm:text-base ${isRTL ? 'pr-11 pl-10' : 'pl-11 pr-10'} py-3.5 rounded-2xl border-2 border-[#00c2cb] focus:outline-none focus:ring-4 focus:ring-[#00c2cb]/20 placeholder:text-slate-400 font-medium shadow-inner`}
                />
                <span className={`material-symbols-outlined absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-[#00c2cb] text-2xl pointer-events-none`}>
                  search
                </span>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className={`absolute ${isRTL ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer`}
                  >
                    <span className="material-symbols-outlined text-lg">cancel</span>
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: language === 'en' ? 'All' : 'الكل', count: searchResults.total },
                  { id: 'patients', label: language === 'en' ? 'Patients' : 'سجلات المرضى', count: searchResults.patients.length },
                  { id: 'appointments', label: language === 'en' ? 'Appointments' : 'المواعيد', count: searchResults.appointments.length },
                  { id: 'queue', label: language === 'en' ? 'Queue' : 'طابور الانتظار', count: searchResults.queue.length },
                  { id: 'services', label: language === 'en' ? 'Services' : 'الخدمات الطبية', count: searchResults.services.length },
                  { id: 'billing', label: language === 'en' ? 'Billing' : 'الفواتير والماليات', count: searchResults.billing.length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategoryFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      activeCategoryFilter === tab.id
                        ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-[#070d18] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/5'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {searchTerm && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
              {!searchTerm ? (
                /* Empty Prompt State with Quick Helpful Shortcuts */
                <div className="py-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-3xl bg-[#00c2cb]/10 text-[#00c2cb] mx-auto flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">saved_search</span>
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      ابدأ الكتابة للبحث الفوري في كافة قواعد البيانات
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      يمكنك البحث السريع باستخدام الاسم، رقم التليفون، كود المريض، أو اسم أي إجراء طبي (كشف، استشارة، سونار...).
                    </p>
                  </div>

                  {/* Quick Access Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-xl mx-auto pt-3 text-xs">
                    <button
                      onClick={() => handleStartNewVisit()}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] hover:border-[#00c2cb]/40 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-1.5 transition-all text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[#00c2cb] text-xl">person_add</span>
                      <span>تسجيل مريض جديد</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('clinical-exam'); setIsOpen(false); }}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] hover:border-[#00c2cb]/40 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-1.5 transition-all text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-purple-500 text-xl">stethoscope</span>
                      <span>غرفة الكشف الطبي</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('appointments'); setIsOpen(false); }}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] hover:border-[#00c2cb]/40 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-1.5 transition-all text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-teal-500 text-xl">calendar_month</span>
                      <span>جدول الحجوزات</span>
                    </button>
                    <button
                      onClick={() => { onNavigate('patient-records'); setIsOpen(false); }}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] hover:border-[#00c2cb]/40 border border-slate-200 dark:border-white/5 flex flex-col items-center gap-1.5 transition-all text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-amber-500 text-xl">folder_shared</span>
                      <span>الأرشيف وسجلات المرضى</span>
                    </button>
                  </div>
                </div>
              ) : searchResults.total === 0 ? (
                /* No Results Found State */
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 rounded-3xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">search_off</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    لم يتم العثور على أي نتائج مطابقة لـ "{searchTerm}"
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    تأكد من كتابة الاسم أو رقم الهاتف أو نوع الخدمة بشكل صحيح، أو أضف المريض كملف جديد.
                  </p>
                  <button
                    onClick={() => handleStartNewVisit()}
                    className="px-4 py-2 rounded-xl bg-[#00c2cb] text-slate-950 font-bold text-xs hover:bg-[#45dee7] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    <span>تسجيل هذا المريض الآن بالاستقبال</span>
                  </button>
                </div>
              ) : (
                /* Match Results List */
                <div className="space-y-6">
                  {/* SECTION 1: PATIENTS MATCHES */}
                  {(activeCategoryFilter === 'all' || activeCategoryFilter === 'patients') &&
                    searchResults.patients.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#00c2cb] text-lg">folder_shared</span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              سجلات المرضى المطابقة ({searchResults.patients.length})
                            </h4>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                            السحابة ☁️ + التخزين المحلي 💾
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {searchResults.patients.slice(0, 8).map((p) => (
                            <div
                              key={p.id}
                              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 hover:border-[#00c2cb]/50 transition-all flex flex-col justify-between space-y-2.5 shadow-2xs group"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#00c2cb] transition-colors truncate">
                                      {p.name}
                                    </h5>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] font-bold">
                                      ملف #{toEnglishDigits(p.fileNumber || 1)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1 flex-wrap">
                                    <span dir="ltr" className="font-mono">
                                      {toEnglishDigits(p.phone)}
                                    </span>
                                    <span>•</span>
                                    <span>{p.age ? `${toEnglishDigits(p.age)} سنة` : 'العمر غير مسجل'}</span>
                                    {p.governorate && (
                                      <>
                                        <span>•</span>
                                        <span>{p.governorate}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {p.bloodGroup && (
                                  <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                                    {p.bloodGroup}
                                  </span>
                                )}
                              </div>

                              {/* Patient details line */}
                              {(p.chronicConditions?.length || p.allergies?.length) ? (
                                <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-black/30 p-2 rounded-xl border border-slate-200/60 dark:border-white/5 space-y-0.5">
                                  {p.chronicConditions && p.chronicConditions.length > 0 && (
                                    <div className="truncate">
                                      <span className="text-amber-600 dark:text-amber-400 font-bold">أمراض مزمنة: </span>
                                      <span>{p.chronicConditions.join('، ')}</span>
                                    </div>
                                  )}
                                  {p.allergies && p.allergies.length > 0 && (
                                    <div className="truncate">
                                      <span className="text-rose-600 dark:text-rose-400 font-bold">حساسية: </span>
                                      <span>{p.allergies.join('، ')}</span>
                                    </div>
                                  )}
                                </div>
                              ) : null}

                              {/* Quick Actions for Patient */}
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <button
                                  onClick={() => handleSelectPatient(p)}
                                  className="py-1.5 px-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                                  title="عرض الملف الطبي وتاريخ الزيارات"
                                >
                                  <span className="material-symbols-outlined text-sm">folder</span>
                                  <span>الملف الطبي</span>
                                </button>
                                <button
                                  onClick={() => handleStartExam(p)}
                                  className="py-1.5 px-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                                  title="فتح الكشف والروشتة في غرفة الطبيب"
                                >
                                  <span className="material-symbols-outlined text-sm">stethoscope</span>
                                  <span>دخول الكشف</span>
                                </button>
                                <button
                                  onClick={() => handleStartNewVisit(p)}
                                  className="py-1.5 px-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-black flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                                  title="تسجيل زيارة أو حجز جديد"
                                >
                                  <span className="material-symbols-outlined text-sm">how_to_reg</span>
                                  <span>تسجيل زيارة</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* SECTION 2: WAITING QUEUE MATCHES */}
                  {(activeCategoryFilter === 'all' || activeCategoryFilter === 'queue') &&
                    searchResults.queue.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-lg">chair</span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              المرضى في طابور الانتظار الآن ({searchResults.queue.length})
                            </h4>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {searchResults.queue.map((q, idx) => (
                            <div
                              key={q.id || idx}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#00c2cb] text-slate-950 flex flex-col items-center justify-center font-bold shrink-0">
                                  <span className="text-[9px] font-black leading-none">دور</span>
                                  <span className="text-xs font-black">{q.ticketNumber || '#01'}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                      {q.patientName}
                                    </h5>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-[#45dee7] font-bold">
                                      {q.visitType || 'كشف'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    <span>هاتف: <span dir="ltr" className="font-mono">{q.phone}</span></span>
                                    <span> • مسدد {q.paidAmount || 0} ج.م</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {onCallPatient && (
                                  <button
                                    onClick={() => onCallPatient(q.ticketNumber || '#01', q.patientName)}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-800 dark:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-sm">campaign</span>
                                    <span>نداء</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    const pat = patients.find((p) => p.name === q.patientName);
                                    if (pat && onSelectPatient) onSelectPatient(pat);
                                    if (onCallPatient) onCallPatient(q.ticketNumber || '#01', q.patientName);
                                    onNavigate('clinical-exam');
                                    setIsOpen(false);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-black flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                                >
                                  <span className="material-symbols-outlined text-sm">stethoscope</span>
                                  <span>دخول الكشف</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* SECTION 3: APPOINTMENTS MATCHES */}
                  {(activeCategoryFilter === 'all' || activeCategoryFilter === 'appointments') &&
                    searchResults.appointments.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-500 text-lg">calendar_month</span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              المواعيد والحجوزات المطابقة ({searchResults.appointments.length})
                            </h4>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {searchResults.appointments.map((a) => (
                            <div
                              key={a.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 flex flex-col items-center justify-center font-mono font-bold text-xs shrink-0">
                                  <span>{a.timeSlot || a.time || '10:00'}</span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                      {a.patientName}
                                    </h5>
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold">
                                      {a.visitType}
                                    </span>
                                    <span
                                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                        a.status === 'حضر وسدد'
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                      }`}
                                    >
                                      {a.status}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    <span>هاتف: <span dir="ltr" className="font-mono">{a.phone}</span></span>
                                    <span> • تاريخ: {a.date || 'اليوم'}</span>
                                    <span> • الرسوم: {a.expectedFee || 0} ج.م</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleOpenAppointment(a)}
                                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs shrink-0"
                              >
                                <span className="material-symbols-outlined text-sm">how_to_reg</span>
                                <span>تسجيل / فتح الموعد</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* SECTION 4: MEDICAL SERVICES MATCHES */}
                  {(activeCategoryFilter === 'all' || activeCategoryFilter === 'services') &&
                    searchResults.services.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500 text-lg">medical_services</span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              الخدمات والإجراءات الطبية ({searchResults.services.length})
                            </h4>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResults.services.map((s) => (
                            <div
                              key={s.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="min-w-0">
                                <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                  {s.name}
                                </h5>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                  <span>{s.category}</span>
                                  {s.durationMinutes && <span> • {s.durationMinutes} دقيقة</span>}
                                </div>
                              </div>

                              <div className="text-left shrink-0">
                                <span className="text-xs font-black font-mono text-[#00c2cb]">
                                  {s.price} ج.م
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* SECTION 5: BILLING & TRANSACTIONS MATCHES */}
                  {(activeCategoryFilter === 'all' || activeCategoryFilter === 'billing') &&
                    searchResults.billing.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-500 text-lg">payments</span>
                            <h4 className="text-xs font-black text-slate-900 dark:text-white">
                              الفواتير وسجلات الدفع المطابقة ({searchResults.billing.length})
                            </h4>
                            {READ_OPT && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                                (معاملات اليوم والأمس — الفترات السابقة بشاشة المالية)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {searchResults.billing.slice(0, 6).map((t) => (
                            <div
                              key={t.id}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shadow-2xs"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {t.patientName}
                                  </h5>
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                                    فاتورة سداد
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                  <span>{t.serviceName || t.description || 'خدمة طبية'}</span>
                                  <span> • طريقة الدفع: {t.paymentMethod || t.paymentMethodLabel || 'نقدي'}</span>
                                </div>
                              </div>

                              <div className="text-left shrink-0">
                                <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                                  +{toEnglishDigits(t.paidAmount || t.amount || t.totalAmount || 0)} ج.م
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Footer with keyboard navigation info */}
            <div className="p-3 sm:px-5 bg-slate-100 dark:bg-[#070d18] border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-white/10 font-mono text-[10px]">
                    ESC
                  </kbd>
                  <span>للإغلاق</span>
                </span>
                <span className="hidden sm:flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-slate-300 dark:border-white/10 font-mono text-[10px]">
                    Ctrl+K
                  </kbd>
                  <span>لفتح البحث بأي وقت</span>
                </span>
              </div>

              <div className="flex items-center gap-1 font-bold text-[#008f97] dark:text-[#45dee7]">
                <span className="material-symbols-outlined text-sm">cloud_sync</span>
                <span>تحديث فوري من السحابة والمتصفح</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
