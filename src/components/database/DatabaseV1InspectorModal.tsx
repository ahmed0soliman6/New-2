import React, { useState } from 'react';
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
} from '../../types/database';
import { READ_OPT } from '../../config/readOpt';

interface DatabaseInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Database Collections
  users: User[];
  doctorProfile: DoctorProfile;
  clinicLocations: ClinicLocation[];
  patients: Patient[];
  appointments: Appointment[];
  visits: Visit[];
  invoices: Invoice[];
  payments: Payment[];
  services: ServiceItem[];
  followUps: FollowUp[];
  prescriptions: Prescription[];
  medications: Medication[];
  labTests: LabTest[];
  labOrders: LabOrder[];
  radiologyTypes: RadiologyType[];
  radiologyOrders: RadiologyOrder[];
  diagnoses: Diagnosis[];
  symptoms: Symptom[];
  chronicDiseases: ChronicDisease[];
  doctorSettings: DoctorSettings;
  systemSettings: SystemSettings;
}

export const DatabaseInspectorModal: React.FC<DatabaseInspectorModalProps> = ({
  isOpen,
  onClose,
  users,
  doctorProfile,
  clinicLocations,
  patients,
  appointments,
  visits,
  invoices,
  payments,
  services,
  followUps,
  prescriptions,
  medications,
  labTests,
  labOrders,
  radiologyTypes,
  radiologyOrders,
  diagnoses,
  symptoms,
  chronicDiseases,
  doctorSettings,
  systemSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'collections' | 'workflow'>('architecture');
  const [selectedCollection, setSelectedCollection] = useState<string>('visits');
  const [searchDocQuery, setSearchDocQuery] = useState('');

  if (!isOpen) return null;

  // Single Source of Truth: Waiting visits count
  const waitingVisitsCount = visits.filter((v) => v.status === 'WAITING').length;
  const inProgressVisitsCount = visits.filter((v) => v.status === 'IN_PROGRESS').length;
  const completedVisitsCount = visits.filter((v) => v.status === 'COMPLETED').length;

  // Total collected treasury
  const totalTreasuryCollected = payments
    .filter((p) => p.status === 'PAID')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const collectionsList = [
    { id: 'visits', name: 'visits (الزيارات وطابور الانتظار)', count: visits.length, icon: 'hourglass_top', color: 'text-amber-400' },
    { id: 'patients', name: 'patients (ملفات المرضى الأساسية)', count: patients.length, icon: 'person', color: 'text-cyan-400' },
    { id: 'appointments', name: 'appointments (الحجوزات المسبقة)', count: appointments.length, icon: 'calendar_today', color: 'text-blue-400' },
    { id: 'invoices', name: 'invoices (فواتير الكشوفات)', count: invoices.length, icon: 'receipt', color: 'text-emerald-400' },
    { id: 'payments', name: 'payments (سجل المقبوضات النقدية)', count: payments.length, icon: 'payments', color: 'text-green-400' },
    { id: 'prescriptions', name: 'prescriptions (الروشتات واللقطات)', count: prescriptions.length, icon: 'prescriptions', color: 'text-purple-400' },
    { id: 'followUps', name: 'followUps (سجل المتابعات والاستشارات)', count: followUps.length, icon: 'event_repeat', color: 'text-rose-400' },
    { id: 'labOrders', name: 'labOrders (طلبات التحاليل)', count: labOrders.length, icon: 'biotech', color: 'text-indigo-400' },
    { id: 'radiologyOrders', name: 'radiologyOrders (طلبات الأشعة)', count: radiologyOrders.length, icon: 'radiology', color: 'text-sky-400' },
    { id: 'medications', name: 'medications (دليل الأدوية الشامل)', count: medications.length, icon: 'medication', color: 'text-teal-400' },
    { id: 'labTests', name: 'labTests (دليل التحاليل المعملية)', count: labTests.length, icon: 'science', color: 'text-lime-400' },
    { id: 'radiologyTypes', name: 'radiologyTypes (دليل أنواع الأشعة)', count: radiologyTypes.length, icon: 'view_in_ar', color: 'text-yellow-400' },
    { id: 'diagnoses', name: 'diagnoses (دليل تشخيصات ICD-10)', count: diagnoses.length, icon: 'stethoscope', color: 'text-red-400' },
    { id: 'symptoms', name: 'symptoms (دليل الأعراض)', count: symptoms.length, icon: 'vital_signs', color: 'text-orange-400' },
    { id: 'chronicDiseases', name: 'chronicDiseases (الأمراض المزمنة)', count: chronicDiseases.length, icon: 'coronavirus', color: 'text-pink-400' },
    { id: 'services', name: 'services (قائمة أسعار الخدمات)', count: services.length, icon: 'price_check', color: 'text-emerald-300' },
    { id: 'clinicLocations', name: 'clinicLocations (الفروع والمواعيد)', count: clinicLocations.length, icon: 'location_city', color: 'text-blue-300' },
    { id: 'users', name: 'users (المستخدمين والأدوار)', count: users.length, icon: 'group', color: 'text-slate-300' },
    { id: 'doctorProfile', name: 'doctorProfile/main (ملف الطبيب)', count: 1, icon: 'badge', color: 'text-teal-300' },
    { id: 'doctorSettings', name: 'doctorSettings/main (المفضلات)', count: 1, icon: 'star', color: 'text-amber-300' },
    { id: 'systemSettings', name: 'systemSettings (إعدادات النظام)', count: 1, icon: 'tune', color: 'text-cyan-300' },
  ];

  const getActiveCollectionData = () => {
    switch (selectedCollection) {
      case 'visits': return visits;
      case 'patients': return patients;
      case 'appointments': return appointments;
      case 'invoices': return invoices;
      case 'payments': return payments;
      case 'prescriptions': return prescriptions;
      case 'followUps': return followUps;
      case 'labOrders': return labOrders;
      case 'radiologyOrders': return radiologyOrders;
      case 'medications': return medications;
      case 'labTests': return labTests;
      case 'radiologyTypes': return radiologyTypes;
      case 'diagnoses': return diagnoses;
      case 'symptoms': return symptoms;
      case 'chronicDiseases': return chronicDiseases;
      case 'services': return services;
      case 'clinicLocations': return clinicLocations;
      case 'users': return users;
      case 'doctorProfile': return [doctorProfile];
      case 'doctorSettings': return [doctorSettings];
      case 'systemSettings': return [systemSettings];
      default: return [];
    }
  };

  const rawData = getActiveCollectionData();
  const filteredData = Array.isArray(rawData)
    ? rawData.filter((item) => {
        if (!searchDocQuery.trim()) return true;
        const str = JSON.stringify(item).toLowerCase();
        return str.includes(searchDocQuery.toLowerCase());
      })
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b1220] border border-white/10 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl text-[#dde2f5] overflow-hidden animate-in zoom-in-95">
        {/* Modal Top Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#111a2e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00c2cb]/15 border border-[#00c2cb]/30 flex items-center justify-center text-[#00c2cb] shadow-lg">
              <span className="material-symbols-outlined text-2xl">database</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  SOLI MEDICAL — DATABASE ARCHITECTURE 
                </h3>
                <span className="bg-[#00c2cb]/20 text-[#45dee7] text-[11px] px-2.5 py-0.5 rounded-full font-bold border border-[#00c2cb]/30">
                  Firestore Compliant
                </span>
              </div>
              <p className="text-xs text-[#859394] mt-0.5">
                مخطط قاعدة البيانات الفعلي • الفصل الصارم • الحركات الذرية (Atomic) • لقطات الروشتة والمتابعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Nav Tabs */}
            <div className="flex items-center bg-[#080e1b] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveTab('architecture')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'architecture'
                    ? 'bg-[#00c2cb] text-[#08101c] shadow'
                    : 'text-[#859394] hover:text-white'
                }`}
              >
                المخطط الهيكلي
              </button>
              <button
                onClick={() => setActiveTab('collections')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'collections'
                    ? 'bg-[#00c2cb] text-[#08101c] shadow'
                    : 'text-[#859394] hover:text-white'
                }`}
              >
                مستكشف المجموعات (21 Collection)
              </button>
              <button
                onClick={() => setActiveTab('workflow')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'workflow'
                    ? 'bg-[#00c2cb] text-[#08101c] shadow'
                    : 'text-[#859394] hover:text-white'
                }`}
              >
                دورة العمل الذرية (Workflow)
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#859394] hover:text-white transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: ARCHITECTURE OVERVIEW */}
          {activeTab === 'architecture' && (
            <div className="space-y-6">
              {/* Architecture Core Summary Box */}
              <div className="bg-[#111a2e] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute -left-12 -top-12 w-48 h-48 bg-[#00c2cb]/5 rounded-full blur-3xl pointer-events-none" />
                <h4 className="text-sm font-bold text-[#45dee7] mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">account_tree</span>
                  العلاقة البنائية الأساسية للنظام (Entity-Relationship Graph)
                </h4>

                <div className="bg-[#080e1b] border border-white/5 rounded-xl p-5 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto" dir="ltr">
                  <pre className="text-[#45dee7] font-semibold">
{`PATIENT
   │
   ├──────────────► APPOINTMENT (scheduledDate, scheduledTime, status: SCHEDULED)
   │                    [لا يحتوي paymentId أو invoiceId أو visitId عند الإنشاء]
   │
   ├──────────────► VISIT (source: APPOINTMENT | WALK_IN, status: WAITING)
   │                    │  [المصدر الوحيد للانتظار - لا توجد Collection منفصلة]
   │                    │
   │                    ├──► INVOICE (items, subtotal, discount, total, paidAmount)
   │                    │       │
   │                    │       └──► PAYMENT (amount, method: CASH|CARD, receiptNumber)
   │                    │
   │                    ├──► LAB ORDERS (testId, testName, status: ORDERED|RESULT|REPORT)
   │                    │
   │                    ├──► RADIOLOGY ORDERS (radiologyTypeId, status: ORDERED|RESULT|REPORT)
   │                    │
   │                    ├──► PRESCRIPTION (items snapshot: name, dose, frequency, duration)
   │                    │
   │                    └──► FOLLOW-UP (snapshot: isFree, fee, scheduledDate)
   │
   └──────────────► PATIENT FILE (تجميع ديناميكي للمريض والزيارات المرتبطة)`}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="bg-[#080e1b] border border-white/5 rounded-xl p-4">
                    <span className="text-xs text-amber-400 font-bold block mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">hourglass_top</span>
                      طابور الانتظار (Waiting Queue)
                    </span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      ليس Collection منفصلة؛ هو View ديناميكي مبني مباشرة من:
                      <code className="text-white block mt-1 bg-black/40 px-2 py-0.5 rounded font-mono">
                        visits where status == "WAITING"
                      </code>
                    </p>
                  </div>

                  <div className="bg-[#080e1b] border border-white/5 rounded-xl p-4">
                    <span className="text-xs text-purple-400 font-bold block mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">camera</span>
                      مبدأ اللقطة (Snapshotting)
                    </span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      الروشتة والمتابعة تحفظ بياناتها كنُسخة ثابتة وقت الإنشاء؛ تعديل الأدلة أو الأسعار لاحقاً لا يؤثر أبداً على سجلات الماضي.
                    </p>
                  </div>

                  <div className="bg-[#080e1b] border border-white/5 rounded-xl p-4">
                    <span className="text-xs text-emerald-400 font-bold block mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">delete_sweep</span>
                      الحذف الناعم (Soft Delete)
                    </span>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      الأدلة والأدوية والخدمات تستخدم <code className="text-white bg-black/40 px-1 py-0.5 rounded font-mono">active: false</code> بدلاً من الحذف الفعلي لمنع كسر أي زيارة سابقة.
                    </p>
                  </div>
                </div>
              </div>

              {/* Core System Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[#111a2e] border border-white/10 rounded-xl p-4 flex flex-col">
                  <span className="text-xs text-[#859394]">حالات الانتظار الحالية</span>
                  <span className="text-2xl font-black text-amber-400 mt-1">{waitingVisitsCount}</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">زيارة بانتظار استدعاء الطبيب</span>
                </div>
                <div className="bg-[#111a2e] border border-white/10 rounded-xl p-4 flex flex-col">
                  <span className="text-xs text-[#859394]">حالات داخل الكشف</span>
                  <span className="text-2xl font-black text-cyan-400 mt-1">{inProgressVisitsCount}</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">زيارة قيد الفحص الإكلينيكي</span>
                </div>
                <div className="bg-[#111a2e] border border-white/10 rounded-xl p-4 flex flex-col">
                  <span className="text-xs text-[#859394]">زيارات مكتملة</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1">{completedVisitsCount}</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">كشوفات منتهية ومؤرشفة</span>
                </div>
                <div className="bg-[#111a2e] border border-white/10 rounded-xl p-4 flex flex-col">
                  <span className="text-xs text-[#859394]">إجمالي المقبوضات (الدرج)</span>
                  <span className="text-2xl font-black text-white mt-1">{totalTreasuryCollected} ج.م</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">متحصلات فعلية عبر Payments</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COLLECTIONS EXPLORER */}
          {activeTab === 'collections' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Left Column: List of Collections */}
              <div className="md:col-span-1 bg-[#111a2e] border border-white/10 rounded-2xl p-3 space-y-1 max-h-[600px] overflow-y-auto">
                <div className="px-2 py-1">
                  <span className="text-xs font-bold text-[#859394] block">
                    مجموعات Firestore ({collectionsList.length})
                  </span>
                  {READ_OPT && (
                    <span className="text-[10px] text-teal-400 block mt-0.5 font-sans leading-tight">
                      العدد = نطاق التشغيل الحالي لا كل التاريخ
                    </span>
                  )}
                </div>
                {collectionsList.map((col) => {
                  const isSelected = selectedCollection === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={() => {
                        setSelectedCollection(col.id);
                        setSearchDocQuery('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#00c2cb] text-[#08101c] font-bold shadow-md'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`material-symbols-outlined text-base ${isSelected ? 'text-[#08101c]' : col.color}`}>
                          {col.icon}
                        </span>
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isSelected ? 'bg-black/20 text-[#08101c]' : 'bg-white/5 text-[#859394]'
                      }`}>
                        {col.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Collection Documents Viewer */}
              <div className="md:col-span-3 bg-[#111a2e] border border-white/10 rounded-2xl p-5 flex flex-col space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#00c2cb] text-base">folder_open</span>
                      مسار المجموعة: <code className="text-[#45dee7] font-mono">/{selectedCollection}</code>
                    </h4>
                    <span className="text-xs text-[#859394]">
                      إجمالي المستندات: {filteredData.length} من أصل {rawData.length}
                    </span>
                  </div>

                  <div className="relative w-64">
                    <input
                      type="text"
                      placeholder="بحث داخل المستندات..."
                      value={searchDocQuery}
                      onChange={(e) => setSearchDocQuery(e.target.value)}
                      className="w-full bg-[#080e1b] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#859394] focus:outline-none focus:border-[#00c2cb]"
                    />
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-sm text-[#859394]">
                      search
                    </span>
                  </div>
                </div>

                <div className="flex-1 bg-[#080e1b] border border-white/5 rounded-xl p-4 overflow-y-auto max-h-[500px]">
                  {filteredData.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      لا توجد مستندات مطابقة للبحث داخل هذه المجموعة.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredData.map((doc: any, index: number) => {
                        const docId =
                          doc.visitId ||
                          doc.patientId ||
                          doc.appointmentId ||
                          doc.invoiceId ||
                          doc.paymentId ||
                          doc.prescriptionId ||
                          doc.followUpId ||
                          doc.medicationId ||
                          doc.labTestId ||
                          doc.labOrderId ||
                          doc.radiologyId ||
                          doc.radiologyOrderId ||
                          doc.diagnosisId ||
                          doc.symptomId ||
                          doc.diseaseId ||
                          doc.serviceId ||
                          doc.locationId ||
                          doc.userId ||
                          `doc-${index + 1}`;

                        return (
                          <div
                            key={docId}
                            className="bg-[#111a2e]/60 border border-white/5 rounded-xl p-3.5 space-y-2 hover:border-[#00c2cb]/30 transition"
                          >
                            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                              <span className="text-xs font-mono font-bold text-[#45dee7]">
                                ID: {docId}
                              </span>
                              {doc.status && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-amber-300 border border-white/10">
                                  STATUS: {doc.status}
                                </span>
                              )}
                            </div>
                            <pre
                              className="font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto bg-black/40 p-3 rounded-lg"
                              dir="ltr"
                            >
                              {JSON.stringify(doc, null, 2)}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WORKFLOW DEMONSTRATOR */}
          {activeTab === 'workflow' && (
            <div className="space-y-6">
              <div className="bg-[#111a2e] border border-white/10 rounded-2xl p-6 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#00c2cb] text-base">sync_alt</span>
                  الدورة الذرية لتسجيل الحضور والكشف (Atomic Clinical Workflow)
                </h4>
                <p className="text-xs text-slate-400">
                  تضمن المعمارية عدم وجود أي حالات غير متسقة (Inconsistent States) عبر عمليات ذرية متزامنة:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
                  {/* Step 1 */}
                  <div className="bg-[#080e1b] border border-white/10 rounded-xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        1
                      </span>
                      <span className="text-[11px] font-mono text-blue-400">ARRIVED ATOMIC</span>
                    </div>
                    <h5 className="text-xs font-bold text-white">حضور المريض بميعاد حجز</h5>
                    <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside">
                      <li>تحديث <code className="text-blue-300">Appointment.status = "ARRIVED"</code></li>
                      <li>إنشاء <code className="text-emerald-300">Invoice</code> برسم الكشف</li>
                      <li>إنشاء <code className="text-green-300">Payment</code> فوري للدرج</li>
                      <li>إنشاء <code className="text-amber-300">Visit (status: WAITING)</code></li>
                      <li>توليد رقم انتظار متسلسل يومياً</li>
                    </ul>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-[#080e1b] border border-white/10 rounded-xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                        2
                      </span>
                      <span className="text-[11px] font-mono text-amber-400">IN PROGRESS</span>
                    </div>
                    <h5 className="text-xs font-bold text-white">دخول المريض لغرفة الكشف</h5>
                    <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside">
                      <li>تحديث <code className="text-amber-300">Visit.status = "IN_PROGRESS"</code></li>
                      <li>تسجيل وقت البدء <code className="text-slate-300">startedAt</code></li>
                      <li>استعراض العلامات الحيوية والشعر بالشكوى</li>
                      <li>الفحص السريري وتدوين الأعراض</li>
                    </ul>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-[#080e1b] border border-white/10 rounded-xl p-4 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                        3
                      </span>
                      <span className="text-[11px] font-mono text-emerald-400">COMPLETION ATOMIC</span>
                    </div>
                    <h5 className="text-xs font-bold text-white">إنهاء الكشف وحفظ الروشتة</h5>
                    <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside">
                      <li>تحديث <code className="text-emerald-300">Visit.status = "COMPLETED"</code></li>
                      <li>حفظ لقطة <code className="text-purple-300">Prescription</code> بالأدوية</li>
                      <li>توليد طلبات <code className="text-indigo-300">LabOrders</code> المطلوبة</li>
                      <li>توليد طلبات <code className="text-sky-300">RadiologyOrders</code></li>
                      <li>تسجيل لقطة <code className="text-rose-300">FollowUp</code> برسم ومواعيد المتابعة</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#111a2e] flex items-center justify-between text-xs text-[#859394]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-white font-semibold">قاعدة البيانات مفعلة ومتوافقة بالكامل مع مواصفات سولي ميديكال</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101c] font-bold transition cursor-pointer"
          >
            إغلاق المفتش
          </button>
        </div>
      </div>
    </div>
  );
};
