import React, { useState } from 'react';
import { QueueItem, PatientListItem, ScreenType } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatAppTime } from '../../utils/numberUtils';

interface PatientIntakeScreenProps {
  onAddPatientToQueue: (item: QueueItem) => void;
  patients: PatientListItem[];
  presetChronicConditions: { id: string; name: string; category: string; color: string }[];
  onAddChronicCondition: (condition: { id: string; name: string; category: string; color: string }) => void;
  onNavigate?: (screen: ScreenType) => void;
  nextFileNumber?: number;
  symptomsCatalog?: { id: string; name: string; category: string }[];
  visitTypesList?: { id: string; name: string; fee: number }[];
  initialData?: {
    patientId?: string;
    patientName?: string;
    phone?: string;
    visitType?: string;
    notes?: string;
    appointmentId?: string;
    fee?: number;
  } | null;
  onClearInitialData?: () => void;
}

export const PatientIntakeScreen: React.FC<PatientIntakeScreenProps> = ({
  onAddPatientToQueue,
  patients = [],
  presetChronicConditions = [],
  onAddChronicCondition,
  onNavigate,
  nextFileNumber = 1,
  symptomsCatalog = [
    { id: '1', name: 'ألم حاد بمنتصف الصدر أو الشرسوف', category: 'باطنة وجهاز هضمي' },
    { id: '2', name: 'انتفاخ وغازات وتقلصات بالبطن', category: 'باطنة وجهاز هضمي' },
    { id: '3', name: 'ارتجاع وحرقة شديدة في المريء', category: 'باطنة وجهاز هضمي' },
    { id: '4', name: 'صداع ضاغط خلفي أو نبضي', category: 'مخ وأعصاب' },
    { id: '5', name: 'حرقة أو صعوبة أثناء التبول', category: 'مسالك بولية' },
    { id: '6', name: 'غثيان مستمر وفقدان للشهية', category: 'باطنة وجهاز هضمي' },
    { id: '7', name: 'ارتفاع في درجة الحرارة وقشعريرة', category: 'عام' },
    { id: '8', name: 'سعال جاف ممتد مع ضيق تنفس', category: 'صدرية' },
  ],
  visitTypesList = [
    { id: '1', name: 'كشف جديد', fee: 300 },
    { id: '2', name: 'استشارة / متابعة', fee: 150 },
    { id: '3', name: 'كشف طوارئ', fee: 400 },
  ],
  initialData = null,
  onClearInitialData,
}) => {
  const { language, isRTL, t } = useLanguage();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  // Form fields start CLEAN for new patients
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | string>(''); // Requirement 4: empty by default
  const [gender, setGender] = useState<'male' | 'female' | ''>(''); // Requirement 5: unselected by default
  const [address, setAddress] = useState('');
  const [bloodType, setBloodType] = useState<string>('غير محدد');

  // Requirement 6: Sequential auto-calculated file number
  const autoFileNumber = React.useMemo(() => {
    if (patients && patients.length > 0) {
      const maxNum = Math.max(...patients.map((p) => Number(p.fileNumber) || 0));
      return maxNum > 0 ? maxNum + 1 : nextFileNumber;
    }
    return nextFileNumber || 1;
  }, [patients, nextFileNumber]);

  const [selectedVisitType, setSelectedVisitType] = useState<{ id: string; name: string; fee: number } | null>(null);
  
  // Requirement 7: Separate badge pills for symptoms & complaint
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptomInput, setCustomSymptomInput] = useState('');
  const [complaintText, setComplaintText] = useState('');

  // Chronic conditions
  const [chronicSelected, setChronicSelected] = useState<string[]>([]);
  const [newChronicInput, setNewChronicInput] = useState('');

  const [payMethod, setPayMethod] = useState<'نقدي' | 'فيزا / كارت' | 'إنستاباي'>('نقدي');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [autoFilledPatientId, setAutoFilledPatientId] = useState<string | null>(null);

  // Field-level validation error state for required fields
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    gender?: string;
    visitType?: string;
  }>({});

  // Requirement 3: Auto-suggest registered patient when typing name or phone
  const matchingPatients = React.useMemo(() => {
    const trimmedName = name.trim().toLowerCase();
    const trimmedPhone = phone.trim();
    if (!trimmedName && !trimmedPhone) return [];

    return patients.filter((p) => {
      const matchName = trimmedName.length >= 2 && p.name?.toLowerCase().includes(trimmedName);
      const matchPhone = trimmedPhone.length >= 3 && p.phone?.includes(trimmedPhone);
      return matchName || matchPhone;
    });
  }, [name, phone, patients]);

  // Effect to automatically pre-populate from initialData (e.g. from Appointment Check-in)
  React.useEffect(() => {
    if (!initialData) return;
    const initialName = (initialData.patientName || '').trim();
    const initialPhone = (initialData.phone || '').trim();
    if (!initialName && !initialPhone) return;

    // Search if patient already exists in clinic database (strictly by priority)
    const cleanDigits = (s: string) => s.replace(/[^0-9]/g, '');
    const foundPatient = patients.find((p) => {
      if (initialData.patientId) {
        return p.id === initialData.patientId;
      }
      const pPhoneClean = cleanDigits(p.phone || '');
      const initPhoneClean = cleanDigits(initialPhone);
      const phoneMatch = initPhoneClean.length >= 7 && pPhoneClean.includes(initPhoneClean);
      if (phoneMatch) return true;
      
      const nameMatch = Boolean(
        initialName && p.name && p.name.trim().toLowerCase() === initialName.toLowerCase()
      );
      return nameMatch;
    });

    if (foundPatient) {
      setName(foundPatient.name || initialName);
      setPhone(foundPatient.phone || initialPhone);
      setAge(foundPatient.age ? String(foundPatient.age) : '');
      setGender(foundPatient.gender || '');
      setAddress(foundPatient.address || foundPatient.governorate || '');
      setBloodType(foundPatient.bloodType || foundPatient.bloodGroup || 'غير محدد');
      if (foundPatient.chronicConditions && Array.isArray(foundPatient.chronicConditions)) {
        setChronicSelected(foundPatient.chronicConditions);
      }
      setAutoFilledPatientId(foundPatient.id);
      setToastMessage(`تم العثور على ملف المريض المسجل مسبقاً (${foundPatient.name}) واسترجاع كافة بياناته تلقائياً`);
    } else {
      setName(initialName);
      setPhone(initialPhone);
      if (initialData.age) setAge(String(initialData.age));
      if (initialData.gender) setGender(initialData.gender);
      if (initialData.address) setAddress(initialData.address);
      if (initialData.bloodType) setBloodType(initialData.bloodType);
      if (initialData.chronicConditions && Array.isArray(initialData.chronicConditions)) {
        setChronicSelected(initialData.chronicConditions);
      }
      setAutoFilledPatientId(initialData.patientId || null);
      setToastMessage(`تم تحويل الموعد (${initialName}). يرجى استكمال باقي بيانات المريض مثل السن والعنوان والأمراض`);
    }

    // Set visit type if matches
    if (initialData.visitType) {
      const matchedVisit = visitTypesList.find(
        (v) => v.name.includes(initialData.visitType!) || initialData.visitType!.includes(v.name)
      );
      if (matchedVisit) {
        setSelectedVisitType(matchedVisit);
      }
    }

    if (initialData.notes) {
      setComplaintText(initialData.notes);
    }
  }, [initialData, patients, visitTypesList]);

  const handleSelectExisting = (p: PatientListItem) => {
    if (!p) return;
    setName(p.name || '');
    setPhone(p.phone || '');
    setAge(p.age || '');
    setGender(p.gender || '');
    setAddress(p.address || p.governorate || '');
    setBloodType(p.bloodType || p.bloodGroup || 'غير محدد');
    setChronicSelected(p.chronicConditions || []);
    setAutoFilledPatientId(p.id);
    setToastMessage(`تم استرجاع وتعبئة ملف المريض تلقائياً: ${p.name || ''} (ملف #${p.fileNumber || 1})`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleChronic = (tag: string) => {
    if (chronicSelected.includes(tag)) {
      setChronicSelected(chronicSelected.filter((t) => t !== tag));
    } else {
      setChronicSelected([...chronicSelected, tag]);
    }
  };

  const handleAddNewChronic = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChronicInput.trim();
    if (!trimmed) return;
    if (!chronicSelected.includes(trimmed)) {
      setChronicSelected([...chronicSelected, trimmed]);
    }
    const alreadyPreset = presetChronicConditions.some((c) => (c?.name || '').toLowerCase() === trimmed.toLowerCase());
    if (!alreadyPreset && onAddChronicCondition) {
      onAddChronicCondition({
        id: `cc-${Date.now()}`,
        name: trimmed,
        category: 'أمراض شائعة',
        color: 'bg-[#00c2cb]',
      });
    }
    setNewChronicInput('');
    setToastMessage(`تمت إضافة "${trimmed}" إلى الأمراض المزمنة للمريض`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddSymptomTag = (symptomName: string) => {
    if (!symptomName) return;
    if (!selectedSymptoms.includes(symptomName)) {
      setSelectedSymptoms([...selectedSymptoms, symptomName]);
    }
  };

  const handleAddCustomSymptom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customSymptomInput.trim();
    if (!trimmed) return;
    if (!selectedSymptoms.includes(trimmed)) {
      setSelectedSymptoms([...selectedSymptoms, trimmed]);
    }
    setCustomSymptomInput('');
  };

  const removeSymptomTag = (tag: string) => {
    setSelectedSymptoms(selectedSymptoms.filter((s) => s !== tag));
  };

  const resetFormFields = () => {
    setName('');
    setPhone('');
    setAge('');
    setGender('');
    setAddress('');
    setBloodType('غير محدد');
    setSelectedSymptoms([]);
    setComplaintText('');
    setChronicSelected([]);
    setAutoFilledPatientId(null);
    setSelectedVisitType(null);
    setFormErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; gender?: string; visitType?: string } = {};

    if (!name.trim()) {
      errors.name = 'يرجى إدخال اسم المريض (ثلاثياً أو رباعياً)';
    }

    if (!gender || (gender !== 'male' && gender !== 'female')) {
      errors.gender = 'يرجى تحديد جنس المريض (ذكر / أنثى)';
    }

    if (!selectedVisitType || !selectedVisitType.name) {
      errors.visitType = 'يرجى تحديد نوع الكشف أو الزيارة المتاحة';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstErrKey = Object.keys(errors)[0];
      const targetEl =
        document.getElementById(`field-${firstErrKey}`) ||
        document.getElementById('intake-errors-banner');
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setFormErrors({});

    const compiledComplaint = [
      ...selectedSymptoms,
      complaintText.trim() ? `تفاصيل: ${complaintText.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    const ticketNumber = `#${Math.floor(Math.random() * 20) + 20}`;
    const newQueueItem: QueueItem = {
      id: `q-${Date.now()}`,
      patientId: autoFilledPatientId || initialData?.patientId || undefined,
      appointmentId: initialData?.appointmentId || undefined,
      ticketNumber,
      fileNumber: autoFileNumber,
      patientName: name.trim(),
      medicalCode: `EG-${Math.floor(Math.random() * 90000) + 10000}`,
      phone: phone.trim(),
      age: Number(age) || 0,
      gender: gender || '',
      visitType: selectedVisitType?.name || 'كشف جديد',
      arrivalTime: formatAppTime(new Date(), language),
      elapsedMinutes: 1,
      paidAmount: selectedVisitType?.fee || 0,
      paymentMethod: payMethod,
      complaint: compiledComplaint || 'كشف روتيني بالعيادة',
      chronicConditions: chronicSelected,
      status: 'waiting',
      address: address.trim(),
      bloodType: bloodType,
    };

    onAddPatientToQueue(newQueueItem);
    setToastMessage(`تم تسجيل الزيارة بنجاح ودخول صالة الانتظار! تذكرة (${ticketNumber}) - ملف رقم (${autoFileNumber})`);
    if (onClearInitialData) onClearInitialData();
    resetFormFields();

    // Smoothly redirect to waiting queue screen so secretary immediately sees the patient in "مرضى فى الانتظار"
    setTimeout(() => {
      if (onNavigate) {
        onNavigate('waiting-queue');
      }
    }, 900);
  };

  return (
    <div className="flex flex-col w-full pb-16 space-y-6 text-slate-800 dark:text-[#dde2f5] min-w-0 max-w-full overflow-x-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#18233C] border border-[#00c2cb] text-slate-900 dark:text-[#45dee7] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-2xl text-[#00c2cb]">check_circle</span>
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Required Fields Error Summary Banner */}
      {Object.keys(formErrors).length > 0 && (
        <div
          id="intake-errors-banner"
          className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-800 dark:text-rose-200 flex items-start sm:items-center gap-3 animate-in fade-in shadow-sm"
        >
          <span className="material-symbols-outlined text-2xl text-rose-500 shrink-0 mt-0.5 sm:mt-0">
            error
          </span>
          <div className="text-xs font-bold leading-relaxed">
            <strong className="block text-sm mb-0.5 text-rose-600 dark:text-rose-400">
              توجد حقول إجبارية لم يتم استكمالها بعد!
            </strong>
            <span>
              يرجى إدخال الحقول المحددة بحدود ورسائل حمراء أدناه (اسم المريض، الجنس/النوع، أو نوع الزيارة) لتمكن من تسجيل الزيارة وطباعة التذكرة.
            </span>
          </div>
        </div>
      )}

      {/* Appointment Check-in Transfer Banner */}
      {initialData && (
        <div className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent dark:from-emerald-950/50 dark:via-teal-950/30 border border-emerald-400/40 dark:border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-xl">how_to_reg</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                  تحويل من جدول المواعيد: {initialData.patientName}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                  {initialData.visitType || 'كشف'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {autoFilledPatientId
                  ? 'تم العثور على المريض في السجلات واسترجاع بياناته تلقائياً. تأكدي من نوع الزيارة وسجلي التذكرة.'
                  : 'مريض غير مسجل مسبقاً: يرجى استكمال باقي البيانات (السن، العنوان، والأمراض المزمنة) ثم تسجيل الزيارة.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onClearInitialData) onClearInitialData();
              resetFormFields();
            }}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#111A2E] text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer self-end sm:self-auto shrink-0"
          >
            إلغاء التحويل
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] border border-[#00c2cb]/30 flex items-center justify-center font-bold text-xl shadow-xs">
              <span className="material-symbols-outlined text-2xl">person_add</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-[#dde2f5]">
                تسجيل زيارة وتذكرة حضور جديدة
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#859394]">
                إنشاء تذكرة انتظار وحجز للعيادات الخارجية مع توليد رقم الملف الطبي والحسابات المالية
              </p>
            </div>
          </div>

          {onNavigate && (
            <button
              onClick={() => onNavigate('waiting-queue')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] hover:bg-slate-200 dark:hover:bg-[#242a38] text-slate-700 dark:text-[#dde2f5] font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-white/5"
            >
              <span className="material-symbols-outlined text-base text-[#008f97] dark:text-[#00c2cb]">format_list_bulleted</span>
              <span>عرض مرضى الانتظار</span>
            </button>
          )}
        </div>

        {/* Mode Selector Tabs (New vs Existing Patient) */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#111A2E] p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 w-fit shadow-2xs">
          <button
            type="button"
            onClick={() => {
              setMode('new');
              resetFormFields();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'new'
                ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">person_add_alt_1</span>
            <span>مريض جديد (تسجيل لاول مرة)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'existing'
                ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">person_search</span>
            <span>مريض مسجل سابقاً (استرجاع ملف)</span>
          </button>
        </div>
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Main Column: Patient Data (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Section 1: Patient Selection / Search (If Existing Mode) */}
          {mode === 'existing' && (
            <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 space-y-3">
              <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-lg">search</span>
                <span>اختر المريض المسجل من السجلات السابقة:</span>
              </label>
              <select
                onChange={(e) => {
                  const found = patients.find((p) => p.id === e.target.value);
                  if (found) handleSelectExisting(found);
                }}
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
              >
                <option value="">-- اضغط لاختيار مريض مسجل من قاعدة البيانات --</option>
                {patients.filter((p) => Boolean(p && p.id)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || 'مريض'} - {p.phone || ''} - (ملف #{p.fileNumber || 1})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section 2: Demographic Information Card */}
          <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">badge</span>
                <span className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">1. البيانات الشخصية والتعريفية</span>
              </div>
              <span className="text-xs bg-teal-50 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] font-bold px-3 py-1 rounded-full border border-[#00c2cb]/30">
                رقم الملف الطبي التلقائي: #{autoFileNumber}
              </span>
            </div>

            {/* Requirement 3: Auto-suggest matching registered patient */}
            {matchingPatients.length > 0 && !autoFilledPatientId && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 p-3.5 rounded-2xl space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <span className="material-symbols-outlined text-base">person_search</span>
                  <span>وجدنا مريض مسجل سابقاً يطابق الاسم أو رقم الهاتف المدخل:</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {matchingPatients.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between bg-white dark:bg-[#080e1b] p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50"
                    >
                      <div className="text-xs font-medium text-slate-800 dark:text-[#dde2f5]">
                        <span className="font-bold text-slate-900 dark:text-white">{p.name}</span>
                        <span className="text-slate-500 mx-2">•</span>
                        <span>هاتف: {p.phone || 'غير مدخل'}</span>
                        <span className="text-slate-500 mx-2">•</span>
                        <span>ملف #{p.fileNumber || 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectExisting(p)}
                        className="px-3 py-1.5 rounded-lg bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-xs"
                      >
                        تعبئة بيانات الملف تلقائياً ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div id="field-name" className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">
                  اسم المريض <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="أدخل اسم المريض..."
                  className={`bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] text-xs px-3.5 py-2.5 rounded-xl border transition-all focus:outline-none focus:ring-1 ${
                    formErrors.name
                      ? 'border-rose-500 ring-1 ring-rose-500 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-white/10 focus:ring-[#00c2cb]'
                  }`}
                />
                {formErrors.name && (
                  <span className="text-xs font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{formErrors.name}</span>
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">رقم الهاتف / الواتساب</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                />
              </div>

              {/* Age - Requirement 4: Empty by default */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">السن (بالسنوات)</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="أدخل السن..."
                  className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                />
              </div>

              {/* Gender - Requirement 5: Unselected by default */}
              <div id="field-gender" className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">
                  النوع / الجنس <span className="text-red-500">*</span>
                </label>
                <div
                  className={`grid grid-cols-2 gap-2 p-1 rounded-2xl transition-all ${
                    formErrors.gender ? 'border-2 border-rose-500 bg-rose-500/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setGender('male');
                      if (formErrors.gender) setFormErrors((prev) => ({ ...prev, gender: undefined }));
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === 'male'
                        ? 'bg-teal-50 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] border-[#00c2cb] ring-1 ring-[#00c2cb]'
                        : 'bg-slate-50 dark:bg-[#080e1b] text-slate-600 dark:text-[#859394] border-slate-200 dark:border-white/5'
                    }`}
                  >
                    ذكر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGender('female');
                      if (formErrors.gender) setFormErrors((prev) => ({ ...prev, gender: undefined }));
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      gender === 'female'
                        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-[#d0bcff] border-purple-500 ring-1 ring-purple-500'
                        : 'bg-slate-50 dark:bg-[#080e1b] text-slate-600 dark:text-[#859394] border-slate-200 dark:border-white/5'
                    }`}
                  >
                    أنثى
                  </button>
                </div>
                {formErrors.gender && (
                  <span className="text-xs font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-sm">error</span>
                    <span>{formErrors.gender}</span>
                  </span>
                )}
              </div>

              {/* Address Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">العنوان / محل الإقامة</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="أدخل العنوان بالتفصيل..."
                  className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                />
              </div>

              {/* Blood Type Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">فصيلة الدم</label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
                >
                  <option value="غير محدد">غير محدد</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Preliminary Symptoms & Chief Complaint Card - Requirement 7 */}
          <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 gap-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">pulse_alert</span>
                <span className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">2. الأعراض والشكوى الرئيسية للمريض</span>
              </div>
              <span className="text-xs text-slate-500 dark:text-[#859394]">تظهر شارات منفصلة للطبيب</span>
            </div>

            {/* Dropdown for Preconfigured Symptoms */}
            <div className="flex flex-col gap-1.5 bg-teal-50/60 dark:bg-[#18233C]/60 p-3 rounded-xl border border-[#00c2cb]/20">
              <label className="text-xs font-bold text-[#008f97] dark:text-[#45dee7]">
                اختر عرضاً من قائمة الشكاوى المعدة مسبقاً لإضافته كشارة منفصلة:
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  handleAddSymptomTag(val);
                  e.target.value = '';
                }}
                className="w-full bg-white dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
              >
                <option value="">-- اضغط لاختيار عرض/شكوى من القائمة --</option>
                {(symptomsCatalog || []).filter((s) => Boolean(s && s.name)).map((s) => (
                  <option key={s.id || s.name} value={s.name}>
                    {s.name} ({s.category || 'عرض'})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Symptoms Pills - Requirement 7 */}
            {selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-200 dark:border-white/5">
                {selectedSymptoms.map((sym) => (
                  <span
                    key={sym}
                    className="px-3 py-1.5 rounded-xl bg-teal-100 dark:bg-[#00c2cb]/20 border border-[#00c2cb]/30 text-[#008f97] dark:text-[#45dee7] text-xs font-bold flex items-center gap-2 shadow-2xs"
                  >
                    <span>{sym}</span>
                    <button
                      type="button"
                      onClick={() => removeSymptomTag(sym)}
                      className="hover:text-red-600 dark:hover:text-rose-400 font-extrabold cursor-pointer text-xs"
                      title="إزالة هذا العرض"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Custom Symptom or Detailed Text */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customSymptomInput}
                onChange={(e) => setCustomSymptomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomSymptom(e);
                  }
                }}
                placeholder="أدخل عرض آخر غير موجود بالقائمة..."
                className="flex-1 bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none"
              />
              <button
                type="button"
                onClick={(e) => handleAddCustomSymptom(e)}
                className="px-3.5 py-2 rounded-xl bg-[#00c2cb] text-slate-950 font-bold text-xs hover:bg-[#45dee7] transition-all cursor-pointer shrink-0"
              >
                + إضافة عرض
              </button>
            </div>

            {/* Optional Chief Complaint Note */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">
                ملاحظة تفصيلية إضافية (اختياري)
              </label>
              <textarea
                rows={2}
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                placeholder="اكتب أي معلومات إضافية يذكرها المريض..."
                className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs p-3 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
              />
            </div>
          </div>

          {/* Section 4: Chronic Diseases Card - Requirement 8 */}
          <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500 text-xl">medical_services</span>
                <span className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">3. الأمراض المزمنة للمريض</span>
              </div>
            </div>

            {/* Dropdown Selector for Chronic Diseases */}
            <div className="flex flex-col gap-1.5 bg-rose-50/60 dark:bg-[#18233C]/60 p-3 rounded-xl border border-rose-500/20">
              <label className="text-xs font-bold text-rose-700 dark:text-rose-300">
                اختر مرضاً مزمن من القائمة المنسدلة:
              </label>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (!chronicSelected.includes(val)) {
                    setChronicSelected([...chronicSelected, val]);
                  }
                  e.target.value = '';
                }}
                className="w-full bg-white dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
              >
                <option value="">-- اضغط لاختيار مرض مزمن من قائمة الإعدادات --</option>
                {(presetChronicConditions || []).filter((c) => Boolean(c && c.name)).map((c) => (
                  <option key={c.id || c.name} value={c.name}>
                    {c.name} ({c.category || 'مرض'})
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Chronic Chips */}
            {chronicSelected.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {chronicSelected.map((item) => (
                  <span
                    key={item}
                    className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 shadow-2xs"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => toggleChronic(item)}
                      className="hover:text-red-900 dark:hover:text-white cursor-pointer font-bold text-xs"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Box for Adding Custom Chronic Condition - Requirement 8 */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newChronicInput}
                onChange={(e) => setNewChronicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewChronic(e);
                  }
                }}
                placeholder="إضافة مرض مزمن جديد غير موجود بالقائمة..."
                className="flex-1 bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none"
              />
              <button
                type="button"
                onClick={(e) => handleAddNewChronic(e)}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
              >
                + إضافة مرض مزمن
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Billing & Actions (4 Cols) - Requirement 9 */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">payments</span>
                <span className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">تفاصيل الحجز والسداد</span>
              </div>
            </div>

            {/* Dynamic Visit Types List - Requirement 9 */}
            <div id="field-visitType" className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">
                نوع الزيارة / الكشف المتاح <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex flex-col gap-2 p-1 rounded-2xl transition-all ${
                  formErrors.visitType ? 'border-2 border-rose-500 bg-rose-500/10' : ''
                }`}
              >
                {visitTypesList.map((vt, index) => (
                  <button
                    key={`${vt.id}-${index}`}
                    type="button"
                    onClick={() => {
                      setSelectedVisitType(vt);
                      if (formErrors.visitType) setFormErrors((prev) => ({ ...prev, visitType: undefined }));
                    }}
                    className={`py-2.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-between ${
                      selectedVisitType?.name === vt.name
                        ? 'bg-[#00c2cb] text-slate-950 border-[#00c2cb] shadow-xs'
                        : 'bg-slate-50 dark:bg-[#080e1b] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{vt.name}</span>
                    <span className="font-mono bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-md text-[11px]">
                      {vt.fee} ج.م
                    </span>
                  </button>
                ))}
              </div>
              {formErrors.visitType && (
                <span className="text-xs font-bold text-rose-500 flex items-center gap-1 mt-0.5">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{formErrors.visitType}</span>
                </span>
              )}
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">طريقة الدفع</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
              >
                <option value="نقدي">نقدي (كاش بالدرج)</option>
                <option value="فيزا / كارت">فيزا / كارت POS</option>
                <option value="إنستاباي">إنستاباي InstaPay</option>
              </select>
            </div>

            {/* Total Price Display */}
            <div className="bg-teal-50 dark:bg-[#18233C] p-4 rounded-xl border border-[#00c2cb]/30 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-[#dde2f5]">إجمالي المبلغ المستحق:</span>
              <span className="text-2xl font-black text-[#008f97] dark:text-[#45dee7] font-mono">
                {selectedVisitType ? `${selectedVisitType.fee} ج.م` : 'غير محدد'}
              </span>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-extrabold text-sm shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2 mt-2"
            >
              <span className="material-symbols-outlined text-xl">confirmation_number</span>
              <span>تسجيل الزيارة وطباعة التذكرة</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
