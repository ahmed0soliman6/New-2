import React, { useState, useMemo } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { CLINIC_INFO } from '../../data/previewClinicData';
import { AppointmentListItem, ScreenType, PatientListItem } from '../../types';
import { usePermissions } from '../../context/AuthContext';
import { toEnglishDigits, formatAppDate } from '../../utils/numberUtils';
import { useLanguage } from '../../i18n/LanguageContext';
import { getClinicBranches, findBranch } from '../../utils/clinicBranches';
import { WhatsappReminderModal } from '../modals/WhatsappReminderModal';

export interface FollowUpItem {
  id: string;
  patientName: string;
  phone: string;
  fileNumber?: number;
  medicalCode?: string;
  lastVisitDate: string;
  dueDate: string;
  daysRemaining: number;
  isFreeEligible: boolean;
  diagnosis: string;
  notes?: string;
}

interface AppointmentsScreenProps {
  appointments: AppointmentListItem[];
  followUps?: FollowUpItem[];
  onCheckInPatient: (appointment: AppointmentListItem) => void;
  onOpenNewAppointment?: () => void;
  onAddAppointment?: (appointment: AppointmentListItem) => void;
  onNavigate: (screen: ScreenType) => void;
  onStartIntakeFromAppointment?: (appointment: AppointmentListItem) => void;
  patients?: PatientListItem[];
  visitTypesList?: { id: string; name: string; fee: number }[];
}

// Only 3 statuses requested by the user:
// 1) مجدول (الافتراضي)
// 2) فى الانتظار حضر المريض
// 3) ملغى
export type AppointmentStatusType = 'مجدول' | 'فى الانتظار حضر المريض' | 'ملغى';

const ALL_STATUSES: AppointmentStatusType[] = [
  'مجدول',
  'فى الانتظار حضر المريض',
  'ملغى',
];

// Helper to format HH:mm 24-hour time to Arabic AM/PM display
const formatTimeDisplay = (timeStr: string) => {
  if (!timeStr) return '09:00 ص';
  if (timeStr.includes('ص') || timeStr.includes('م')) return timeStr;
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hour)) return timeStr;
  const period = hour >= 12 ? 'م' : 'ص';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, '0')}:${minutes} ${period}`;
};

export const AppointmentsScreen: React.FC<AppointmentsScreenProps> = ({
  appointments,
  followUps = [],
  onCheckInPatient,
  onAddAppointment,
  onNavigate,
  onStartIntakeFromAppointment,
  patients = [],
  visitTypesList = [],
}) => {
  const { canAccess } = usePermissions();
  const { language, isRTL, t } = useLanguage();

  // Dynamic visit types configured in Settings
  const activeVisitTypes = useMemo(() => {
    const raw = (visitTypesList && visitTypesList.length > 0)
      ? visitTypesList
      : [
          { id: 'vt-1', name: 'كشف جديد', fee: 300 },
          { id: 'vt-2', name: 'استشارة / متابعة', fee: 150 },
          { id: 'vt-3', name: 'كشف طوارئ', fee: 400 },
        ];
    const uniqueMap = new Map<string, { id: string; name: string; fee: number }>();
    raw.forEach((item, index) => {
      const key = item.id || `vt-${index}-${item.name}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });
    return Array.from(uniqueMap.values());
  }, [visitTypesList]);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Archive toggle & status filter state
  const [showArchive, setShowArchive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [appointmentSearch, setAppointmentSearch] = useState('');

  // WhatsApp helper modal
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappRawText, setWhatsappRawText] = useState('');

  // Clinic Branches from system settings / configuration
  const clinicBranches = useMemo(() => getClinicBranches(), []);
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    return clinicBranches[0]?.name || 'الفرع الرئيسي - المهندسين';
  });

  // Dedicated WhatsApp Reminder Modal state
  const [reminderModalData, setReminderModalData] = useState<{
    isOpen: boolean;
    type: 'appointment' | 'followup';
    patientName: string;
    phone: string;
    timeSlot?: string;
    visitType?: string;
    date?: string;
    dueDate?: string;
    diagnosis?: string;
    initialBranch?: string;
  }>({
    isOpen: false,
    type: 'appointment',
    patientName: '',
    phone: '',
  });

  // Form state for "إضافة موعد" (Top Card 1)
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [visitType, setVisitType] = useState(() => activeVisitTypes[0]?.name || 'كشف جديد');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Sync visitType if list updates in settings
  React.useEffect(() => {
    if (activeVisitTypes.length > 0 && !activeVisitTypes.some((vt) => vt.name === visitType)) {
      setVisitType(activeVisitTypes[0].name);
    }
  }, [activeVisitTypes, visitType]);

  // Follow-ups search state
  const [followupSearch, setFollowupSearch] = useState('');

  // All appointments derived directly from canonical Firestore appointments prop
  const allAppointments = useMemo(() => {
    const list = [...appointments];

    // Sort newest first by scheduled date & time descending
    return list.sort((a, b) => {
      const timeA = new Date(`${a.date || '2026-01-01'} ${a.time || '00:00'}`).getTime();
      const timeB = new Date(`${b.date || '2026-01-01'} ${b.time || '00:00'}`).getTime();
      if (!isNaN(timeB) && !isNaN(timeA) && timeB !== timeA) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [appointments]);

  // Count of archived appointments (فى الانتظار حضر المريض / ملغى)
  const archivedCount = useMemo(() => {
    return allAppointments.filter(
      (app) =>
        app.status === 'فى الانتظار حضر المريض' ||
        app.status === 'حضر وسدد' ||
        app.status === 'فى الانتظار' ||
        app.status === 'في الانتظار' ||
        app.status === 'ARRIVED' ||
        app.status === 'ملغى' ||
        app.status === 'ملغي' ||
        app.status === 'CANCELLED' ||
        app.status === 'اكتمل  الكشف' ||
        app.status === 'مكتمل'
    ).length;
  }, [allAppointments]);

  // Filter appointments according to status & archive toggle:
  // When an appointment changes to "حضر المريض" / "فى الانتظار حضر المريض", it MUST DISAPPEAR from scheduled appointments
  const displayedAppointments = useMemo(() => {
    return allAppointments.filter((app) => {
      const isArchived =
        app.status === 'فى الانتظار حضر المريض' ||
        app.status === 'حضر وسدد' ||
        app.status === 'فى الانتظار' ||
        app.status === 'في الانتظار' ||
        app.status === 'ARRIVED' ||
        app.status === 'ملغى' ||
        app.status === 'ملغي' ||
        app.status === 'CANCELLED' ||
        app.status === 'اكتمل  الكشف' ||
        app.status === 'مكتمل';

      // If archive mode is OFF, strictly show ONLY active scheduled appointments ("مجدول")
      // Once attended or arrived, it disappears completely from this view!
      if (!showArchive && isArchived && statusFilter === 'all') {
        return false;
      }
      // If archive mode is ON, show attended/cancelled appointments
      if (showArchive && !isArchived && statusFilter === 'all') {
        return false;
      }

      // Filter by status dropdown
      if (statusFilter !== 'all') {
        if (statusFilter === 'مجدول') {
          if (isArchived) return false;
          if (app.status !== 'مجدول' && app.status !== 'بانتظار التأكيد') return false;
        } else if (statusFilter === 'فى الانتظار حضر المريض') {
          if (
            app.status !== 'فى الانتظار حضر المريض' &&
            app.status !== 'حضر وسدد' &&
            app.status !== 'فى الانتظار' &&
            app.status !== 'في الانتظار' &&
            app.status !== 'ARRIVED'
          )
            return false;
        } else if (statusFilter === 'ملغى') {
          if (app.status !== 'ملغى' && app.status !== 'ملغي' && app.status !== 'CANCELLED') return false;
        } else if (app.status !== statusFilter) {
          return false;
        }
      }

      // Search query
      if (appointmentSearch.trim()) {
        const q = appointmentSearch.toLowerCase();
        const pName = (app.patientName || '').toLowerCase();
        const pPhone = app.phone || '';
        if (!pName.includes(q) && !pPhone.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [allAppointments, showArchive, statusFilter, appointmentSearch]);

  // Follow-ups from prop
  const activeFollowUps = useMemo(() => {
    return followUps || [];
  }, [followUps]);

  // Filtered follow-ups sorted by urgency / nearest due date
  const displayedFollowUps = useMemo(() => {
    const list = activeFollowUps.filter((f) => {
      if (!followupSearch.trim()) return true;
      const q = followupSearch.toLowerCase();
      return (
        f.patientName.toLowerCase().includes(q) ||
        f.phone.includes(q) ||
        String(f.fileNumber || '').includes(q) ||
        (f.medicalCode && f.medicalCode.toLowerCase().includes(q))
      );
    });
    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [activeFollowUps, followupSearch]);

  // Update Status handler:
  // 1) "مجدول" (Default)
  // 2) "فى الانتظار حضر المريض" -> launches visit intake and moves patient to archive
  // 3) "ملغى" -> moves patient to archive under cancelled
  const handleUpdateStatus = (app: AppointmentListItem, newStatus: AppointmentStatusType) => {
    if (newStatus === 'فى الانتظار حضر المريض') {
      setToastMessage(`تم تسجيل حضور المريض "${app.patientName}" وجارٍ فتح صفحة تسجيل الزيارة`);
      setTimeout(() => setToastMessage(null), 3500);

      // Persist to Firestore immediately
      if (db && app.id) {
        setDoc(
          doc(db, 'appointments', app.id),
          { status: 'ARRIVED', updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch((err) => console.warn('Failed to update appointment status in Firestore:', err));
      }

      // Automatically launch intake screen
      if (onStartIntakeFromAppointment) {
        onStartIntakeFromAppointment({ ...app, status: 'فى الانتظار حضر المريض' });
      } else {
        onCheckInPatient({ ...app, status: 'فى الانتظار حضر المريض' });
        onNavigate('new-visit');
      }
      return;
    }

    if (newStatus === 'ملغى') {
      setToastMessage(`تم إلغاء موعد "${app.patientName}" ونقله تلقائياً إلى الأرشيف`);
      setTimeout(() => setToastMessage(null), 3500);

      if (db && app.id) {
        setDoc(
          doc(db, 'appointments', app.id),
          { status: 'CANCELLED', updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch((err) => console.warn('Failed to cancel appointment in Firestore:', err));
      }
      return;
    }

    // Default: "مجدول"
    setToastMessage(`تم تحديث حالة موعد "${app.patientName}" إلى: مجدول`);
    setTimeout(() => setToastMessage(null), 3500);

    if (db && app.id) {
      setDoc(
        doc(db, 'appointments', app.id),
        { status: 'SCHEDULED', updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch((err) => console.warn('Failed to reschedule appointment in Firestore:', err));
    }
  };

  // Check-in / «حضر المريض» Flow:
  // Converts appointment to Waiting Queue via PatientIntakeScreen:
  // Pre-fills existing patient data automatically, lets secretary pick visit type & intake info, then registers to queue & financials!
  const handlePatientArrived = (app: AppointmentListItem) => {
    // Persist to Firestore immediately
    if (db && app.id) {
      setDoc(
        doc(db, 'appointments', app.id),
        { status: 'ARRIVED', updatedAt: new Date().toISOString() },
        { merge: true }
      ).catch((err) => console.warn('Failed to update appointment status in Firestore:', err));
    }

    setToastMessage(`تم تسجيل حضور المريض "${app.patientName}" وجارٍ فتح صفحة تسجيل الزيارة`);
    setTimeout(() => setToastMessage(null), 3500);

    // 2. Redirect to Patient Intake Screen with initial appointment info
    if (onStartIntakeFromAppointment) {
      onStartIntakeFromAppointment({ ...app, status: 'فى الانتظار حضر المريض' });
    } else {
      onCheckInPatient({ ...app, status: 'فى الانتظار حضر المريض' });
      onNavigate('new-visit');
    }
  };

  // WhatsApp reminder for Appointment (Opens dedicated modal with accurate branch & phone)
  const handleSendWhatsappAppointmentReminder = (app: AppointmentListItem) => {
    setReminderModalData({
      isOpen: true,
      type: 'appointment',
      patientName: app.patientName,
      phone: app.phone,
      timeSlot: app.timeSlot || app.time,
      visitType: app.visitType,
      date: app.date,
      initialBranch: app.branch,
    });
  };

  // WhatsApp reminder for Follow-up (Opens dedicated modal with accurate branch & phone)
  const handleSendWhatsappFollowupReminder = (fu: FollowUpItem) => {
    setReminderModalData({
      isOpen: true,
      type: 'followup',
      patientName: fu.patientName,
      phone: fu.phone,
      dueDate: fu.dueDate,
      diagnosis: fu.diagnosis,
      initialBranch: undefined,
    });
  };

  // Save new appointment handler
  const handleSaveNewAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setFormFeedback('يرجى كتابة اسم المريض');
      return;
    }

    const formattedTime = formatTimeDisplay(scheduledTime);
    const matchingVt = activeVisitTypes.find((vt) => vt.name === visitType);
    const expectedFee = matchingVt
      ? matchingVt.fee
      : visitType.includes('متابعة') || visitType.includes('استشارة')
      ? 150
      : 300;

    const newApp: AppointmentListItem = {
      id: `app-${Date.now()}`,
      patientName: patientName.trim(),
      phone: phone.trim() || 'بدون هاتف',
      medicalCode: `EG-${Math.floor(100 + Math.random() * 900)}`,
      timeSlot: formattedTime,
      time: formattedTime,
      date: scheduledDate,
      branch: selectedBranch || clinicBranches[0]?.name || 'الفرع الرئيسي - المهندسين',
      visitType: visitType || activeVisitTypes[0]?.name || 'كشف جديد',
      expectedFee,
      status: 'مجدول' as any,
      notes: appointmentNotes.trim() || undefined,
    };

    if (onAddAppointment) {
      onAddAppointment(newApp);
    }

    // Reset Form
    setPatientName('');
    setPhone('');
    setAppointmentNotes('');
    setFormFeedback('تم حفظ الموعد بنجاح ✓');
    setToastMessage(`تم حفظ موعد المريض (${newApp.patientName}) بنجاح`);
    setTimeout(() => {
      setFormFeedback(null);
      setToastMessage(null);
    }, 3500);
  };

  // Parse text from WhatsApp request
  const handleParseWhatsappText = () => {
    if (!whatsappRawText.trim()) return;

    let parsedName = '';
    let parsedPhone = '';
    let parsedVisitType = activeVisitTypes[0]?.name || 'كشف جديد';
    let parsedDate = '';
    let parsedTime = '';
    let parsedBranch = '';
    let parsedNotes = '';

    const lines = whatsappRawText.split('\n').map((l) => l.trim()).filter(Boolean);

    // 1. Structured Field Extraction
    for (const line of lines) {
      if (line.includes('الاسم:') || line.includes('اسم المريض:')) {
        parsedName = line.split(':')[1]?.trim() || '';
      } else if (line.includes('رقم الهاتف:') || line.includes('الهاتف:')) {
        parsedPhone = line.split(':')[1]?.trim() || '';
      } else if (line.includes('التاريخ:')) {
        parsedDate = line.split(':')[1]?.trim() || '';
      } else if (line.includes('الوقت:') || line.includes('الساعة:')) {
        parsedTime = line.split(':')[1]?.trim() || '';
      } else if (line.includes('فرع العيادة:') || line.includes('الفرع:') || line.includes('مكان الكشف:')) {
        parsedBranch = line.split(':')[1]?.trim() || '';
      } else if (line.includes('نوع الموعد:')) {
        parsedVisitType = line.split(':')[1]?.trim() || parsedVisitType;
      } else if (line.includes('ملاحظات الموعد:') || line.includes('ملاحظات:')) {
        const val = line.split(':')[1]?.trim() || '';
        if (val && !val.includes('لا توجد')) {
          parsedNotes = val;
        }
      }
    }

    // 2. Extract phone fallback via regex
    if (!parsedPhone) {
      const phoneMatch = whatsappRawText.match(/(?:01[0125]\d{8}|\+?201[0125]\d{8})/);
      if (phoneMatch) {
        parsedPhone = phoneMatch[0];
      }
    }

    // 3. Extract name fallback
    if (!parsedName) {
      const nameKeywords = ['اسمي', 'اسم', 'الاسم:', 'أنا', 'المريض:', 'المريض'];
      for (const kw of nameKeywords) {
        const idx = whatsappRawText.indexOf(kw);
        if (idx !== -1) {
          const after = whatsappRawText.slice(idx + kw.length).replace(/[:]/g, '').trim();
          const words = after.split(/[\n,.-]/)[0].trim().split(/\s+/).slice(0, 3).join(' ');
          if (words.length > 2) {
            parsedName = words;
            break;
          }
        }
      }
    }

    if (!parsedName) {
      const firstLine = whatsappRawText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 2 && !l.startsWith('طلب حجز') && !l.startsWith('---'))[0];
      if (firstLine && !firstLine.includes('01')) {
        parsedName = firstLine.slice(0, 30);
      } else {
        parsedName = 'مريض واتساب';
      }
    }

    // 4. Match visit type
    const foundVt = activeVisitTypes.find((vt) =>
      whatsappRawText.includes(vt.name) ||
      (vt.name.includes('متابعة') && (whatsappRawText.includes('متابعة') || whatsappRawText.includes('استشارة'))) ||
      (vt.name.includes('كشف') && whatsappRawText.includes('كشف')) ||
      (vt.name.includes('طوارئ') && whatsappRawText.includes('طوارئ'))
    );
    if (foundVt) {
      parsedVisitType = foundVt.name;
    }

    // 5. Match branch
    if (parsedBranch) {
      const matchedBranch = clinicBranches.find((b) => b.name.includes(parsedBranch) || parsedBranch.includes(b.name));
      if (matchedBranch) {
        setSelectedBranch(matchedBranch.name);
      }
    }

    // Populate form
    setPatientName(parsedName);
    if (parsedPhone) setPhone(parsedPhone);
    if (parsedDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
      setScheduledDate(parsedDate);
    }
    if (parsedTime) {
      setScheduledTime(parsedTime);
    }
    setVisitType(parsedVisitType);
    if (parsedNotes) {
      setAppointmentNotes(parsedNotes);
    } else {
      setAppointmentNotes(
        language === 'en'
          ? `WhatsApp booking request (${formatAppDate(new Date(), undefined, language)})`
          : `طلب حجز عبر واتساب (${formatAppDate(new Date(), undefined, language)})`
      );
    }

    setIsWhatsappModalOpen(false);
    setWhatsappRawText('');
    setToastMessage('تم استخراج جميع بيانات الموعد تلقائياً وتعبئة النموذج بسرعة! ✓');
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden pb-24 space-y-8 text-slate-800 dark:text-[#dde2f5]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-[#18233C] text-white border border-[#00c2cb] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[#00c2cb] text-xl">check_circle</span>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* البطاقة الأولى (في أعلى الصفحة): إضافة موعد جديد */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#111A2E] p-5 sm:p-7 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-5">
        {/* Card 1 Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] border border-[#00c2cb]/30 flex items-center justify-center font-bold text-xl shadow-xs">
              <span className="material-symbols-outlined text-2xl">calendar_add_on</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span>إضافة موعد</span>
                <span className="text-xs font-normal text-[#008f97] dark:text-[#00c2cb] bg-[#00c2cb]/10 px-2.5 py-0.5 rounded-full border border-[#00c2cb]/20">
                  حجز عيادة
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                سجّل موعداً جديداً بالعيادة مع إمكانية اختيار التاريخ بالتقويم والوقت بالساعة بنقرة واحدة
              </p>
            </div>
          </div>

          {/* WhatsApp Import Button */}
          <button
            type="button"
            onClick={() => setIsWhatsappModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-[#25D366]/15 hover:bg-[#25D366] text-emerald-800 dark:text-[#25D366] hover:text-white border border-emerald-200 dark:border-[#25D366]/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
          >
            <span className="material-symbols-outlined text-base">chat</span>
            <span>إضافة من طلب واتساب</span>
          </button>
        </div>

        {/* Feedback alert */}
        {formFeedback && (
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 border border-[#00c2cb]/30 text-xs font-bold text-[#008f97] dark:text-[#45dee7] flex items-center gap-2 animate-in fade-in">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{formFeedback}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSaveNewAppointment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Patient Name */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">person</span>
                  <span>اسم المريض</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">ثلاثي أو رباعي</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="مثال: جمال على محمد"
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">call</span>
                  <span>رقم الهاتف</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">لإرسال تذكير واتساب</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 01012345678"
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-mono focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                />
              </div>
            </div>

            {/* Date Input with Native Interactive Calendar Picker and prominent badge button */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">calendar_month</span>
                  <span>التاريخ</span>
                </span>
                <span className="text-[10px] text-teal-600 dark:text-[#00c2cb] font-bold">فتح التقويم</span>
              </label>
              <div className="relative group flex items-center">
                <input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {}
                  }}
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 pl-11 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb] cursor-pointer font-mono shadow-2xs font-bold"
                  title="انقر لاختيار التاريخ بسهولة من التقويم"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input[type="date"]') as any;
                    try {
                      input?.showPicker?.();
                    } catch {
                      input?.focus();
                    }
                  }}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#00c2cb]/15 hover:bg-[#00c2cb] text-[#008f97] dark:text-[#00c2cb] hover:text-slate-950 flex items-center justify-center transition-all cursor-pointer border border-[#00c2cb]/30 shadow-xs"
                  title="فتح التقويم"
                >
                  <span className="material-symbols-outlined text-lg">calendar_month</span>
                </button>
              </div>
            </div>

            {/* Time Input with Native Interactive Clock Picker and prominent badge button */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">schedule</span>
                  <span>الوقت</span>
                </span>
                <span className="text-[10px] text-teal-600 dark:text-[#00c2cb] font-bold">اختيار الساعة</span>
              </label>
              <div className="relative group flex items-center">
                <input
                  type="time"
                  required
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as any).showPicker?.();
                    } catch {}
                  }}
                  className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 pl-11 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb] cursor-pointer font-mono shadow-2xs font-bold"
                  title="انقر لاختيار الوقت بسهولة من الساعة"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget.parentElement?.querySelector('input[type="time"]') as any;
                    try {
                      input?.showPicker?.();
                    } catch {
                      input?.focus();
                    }
                  }}
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#00c2cb]/15 hover:bg-[#00c2cb] text-[#008f97] dark:text-[#00c2cb] hover:text-slate-950 flex items-center justify-center transition-all cursor-pointer border border-[#00c2cb]/30 shadow-xs"
                  title="فتح الساعة"
                >
                  <span className="material-symbols-outlined text-lg">schedule</span>
                </button>
              </div>
            </div>

            {/* Branch Selector - Loaded dynamically from clinic settings */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">domain</span>
                  <span>فرع العيادة</span>
                </span>
                <span className="text-[10px] text-teal-600 dark:text-[#00c2cb] font-bold">مكان الكشف</span>
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb] cursor-pointer font-bold shadow-2xs"
              >
                {clinicBranches.map((b) => (
                  <option key={b.id || b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Visit Type - Dynamically synced with Settings types */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">medical_services</span>
                  <span>نوع الموعد</span>
                </span>
                <span className="text-[10px] text-teal-600 dark:text-[#00c2cb] font-bold">من بطاقة الإعدادات</span>
              </label>
              <select
                value={visitType}
                onChange={(e) => setVisitType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb] cursor-pointer font-bold shadow-2xs"
              >
                {activeVisitTypes.map((vt, index) => (
                  <option key={`${vt.id}-${index}`} value={vt.name}>
                    {vt.name} ({vt.fee} ج.م)
                  </option>
                ))}
              </select>
            </div>

            {/* Appointment Notes */}
            <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#008f97] dark:text-[#00c2cb]">edit_note</span>
                <span>ملاحظات الموعد</span>
              </label>
              <input
                type="text"
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="مثال: متابعة قرحة المعدة، كشف مستعجل..."
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
              />
            </div>
          </div>

          {/* Form Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-black text-xs shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">event_available</span>
              <span>حفظ الموعد</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* البطاقة الثانية (تحت إضافة الموعد): إدارة المواعيد والتقويم (أسماء المواعيد) */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#111A2E] p-5 sm:p-7 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
        {/* Card 2 Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xl shadow-xs">
              <span className="material-symbols-outlined text-2xl">event_upcoming</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span>إدارة المواعيد والتقويم</span>
                <span className="text-xs font-normal text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40">
                  {displayedAppointments.length} موعد
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                نظّم المواعيد وحوّل الموعد إلى قائمة الانتظار عند حضور المريض
              </p>
            </div>
          </div>

          {/* Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Archive Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setShowArchive(!showArchive);
                setStatusFilter('all');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                showArchive
                  ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">inventory_2</span>
              <span>عرض الأرشيف ({archivedCount})</span>
            </button>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setShowArchive(false);
              }}
              className="bg-slate-50 dark:bg-[#18233C] text-slate-900 dark:text-[#dde2f5] text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer font-bold"
            >
              <option value="all">كل المواعيد (مجدول)</option>
              <option value="مجدول">1. مجدول</option>
              <option value="فى الانتظار حضر المريض">2. فى الانتظار حضر المريض</option>
              <option value="ملغى">3. ملغى</option>
            </select>
          </div>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={appointmentSearch}
            onChange={(e) => setAppointmentSearch(e.target.value)}
            placeholder="بحث باسم المريض أو رقم الهاتف في المواعيد..."
            className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
          />
        </div>

        {/* Appointments List */}
        <div className="space-y-3">
          {displayedAppointments.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-dashed border-slate-200 dark:border-white/10 text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-400">event_busy</span>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                لا توجد مواعيد تطابق الفلتر المحدد حالياً
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('all');
                  setShowArchive(false);
                  setAppointmentSearch('');
                }}
                className="text-xs text-[#008f97] dark:text-[#00c2cb] font-bold hover:underline cursor-pointer"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : (
            displayedAppointments.map((app) => {
              const isScheduled = app.status === 'مجدول' || app.status === 'بانتظار التأكيد';
              const isWaiting =
                app.status === 'فى الانتظار حضر المريض' ||
                app.status === 'فى الانتظار' ||
                app.status === 'في الانتظار';
              const isCancelled = app.status === 'ملغى' || app.status === 'ملغي';

              return (
                <div
                  key={app.id}
                  className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 group shadow-2xs"
                >
                  {/* Right Details: Time + Name + Status Badge + Meta */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Date & Time Box */}
                    <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/5 text-center shrink-0 min-w-[85px] shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        {app.date || 'اليوم'}
                      </div>
                      <div className="font-mono font-black text-xs text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        <span>{app.timeSlot || app.time || '09:00 ص'}</span>
                      </div>
                    </div>

                    {/* Patient Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {app.patientName}
                        </h3>

                        {/* Status Badge: strictly 3 states */}
                        {isScheduled && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>مجدول</span>
                          </span>
                        )}

                        {isWaiting && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/40 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>فى الانتظار حضر المريض</span>
                          </span>
                        )}

                        {isCancelled && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 flex items-center gap-1.5 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>ملغى</span>
                          </span>
                        )}
                      </div>

                      {/* Meta information: Type • Branch • Phone • Notes */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-[#859394] mt-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {app.visitType || 'كشف'}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 dark:bg-[#00c2cb]/10 text-teal-700 dark:text-[#00c2cb] font-bold text-[11px] border border-teal-200/60 dark:border-[#00c2cb]/20">
                          <span className="material-symbols-outlined text-[13px]">location_on</span>
                          <span>{app.branch || 'الفرع الرئيسي'}</span>
                        </span>
                        <span>•</span>
                        <span className="font-mono" dir="ltr">
                          {app.phone || 'بدون هاتف'}
                        </span>
                        {app.notes && (
                          <>
                            <span>•</span>
                            <span className="line-clamp-1 italic text-[11px] text-slate-600 dark:text-slate-400">
                              {app.notes}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left Actions: «حضر المريض» Quick Action + Status Dropdown + WhatsApp Reminder */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-white/5">
                    {/* «حضر المريض» Quick Action Button (prominent for scheduled patients) */}
                    {isScheduled && (
                      <button
                        type="button"
                        onClick={() => handlePatientArrived(app)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                        title="حضر المريض: الانتقال لصفحة تسجيل الزيارة وتوريد المبلغ ودخول صالة الانتظار"
                      >
                        <span className="material-symbols-outlined text-base">how_to_reg</span>
                        <span>حضر المريض</span>
                      </button>
                    )}

                    {/* View in Queue Button (when patient is already checked in / فى الانتظار حضر المريض) */}
                    {isWaiting && (
                      <button
                        type="button"
                        onClick={() => onNavigate('waiting-queue')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 transition-all cursor-pointer flex items-center gap-1"
                        title="عرض المريض وتذكرته في صالة الانتظار"
                      >
                        <span className="material-symbols-outlined text-base">hourglass_top</span>
                        <span>عرض في صالة الانتظار</span>
                      </button>
                    )}

                    {/* Status Changer Select: strictly 3 options */}
                    <select
                      value={
                        app.status === 'فى الانتظار' || app.status === 'في الانتظار'
                          ? 'فى الانتظار حضر المريض'
                          : app.status === 'بانتظار التأكيد'
                          ? 'مجدول'
                          : app.status
                      }
                      onChange={(e) => handleUpdateStatus(app, e.target.value as AppointmentStatusType)}
                      className="bg-white dark:bg-[#111A2E] text-slate-800 dark:text-[#dde2f5] text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer font-bold shadow-2xs"
                      title="تغيير حالة الموعد"
                    >
                      {ALL_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>

                    {/* WhatsApp Reminder Button */}
                    <button
                      type="button"
                      onClick={() => handleSendWhatsappAppointmentReminder(app)}
                      className="p-2 rounded-xl bg-emerald-50 dark:bg-[#25D366]/15 hover:bg-[#25D366] text-emerald-700 dark:text-[#25D366] hover:text-white transition-all cursor-pointer border border-emerald-200 dark:border-[#25D366]/30 shadow-2xs"
                      title="إرسال تذكير واتساب بالموعد"
                    >
                      <span className="material-symbols-outlined text-base">chat</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* البطاقة الثالثة: المتابعات القادمة مع تذكير واتساب */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#111A2E] p-5 sm:p-7 rounded-3xl border border-slate-200 dark:border-white/5 shadow-sm space-y-6">
        {/* Card 3 Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 text-[#008f97] dark:text-[#00c2cb] border border-[#00c2cb]/30 flex items-center justify-center font-bold text-xl shadow-xs">
              <span className="material-symbols-outlined text-2xl">clinical_notes</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span>المتابعات القادمة</span>
                <span className="text-xs font-normal text-[#008f97] dark:text-[#00c2cb] bg-[#00c2cb]/10 px-2.5 py-0.5 rounded-full border border-[#00c2cb]/20">
                  {displayedFollowUps.length} مريض
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                تتبع مواعيد استشارات ومتابعات المرضى بعد الكشف وإرسال تذكيرات الواتساب التلقائية
              </p>
            </div>
          </div>

          {/* Search bar for Follow-ups */}
          <div className="w-full sm:w-64">
            <div className="relative">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                search
              </span>
              <input
                type="text"
                value={followupSearch}
                onChange={(e) => setFollowupSearch(e.target.value)}
                placeholder="بحث في المتابعات..."
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs pr-9 pl-3 py-2 rounded-xl border border-slate-200 dark:border-white/5 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
              />
            </div>
          </div>
        </div>

        {/* Follow-ups Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedFollowUps.length === 0 ? (
            <div className="col-span-2 p-8 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-dashed border-slate-200 dark:border-white/10 text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-slate-400">check_circle</span>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                لا توجد مواعيد متابعات معلقة حالياً
              </p>
            </div>
          ) : (
            displayedFollowUps.map((fu) => (
              <div
                key={fu.id}
                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/15 transition-all flex flex-col justify-between gap-3 group shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {fu.patientName}
                    </h4>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        fu.isFreeEligible
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'
                      }`}
                    >
                      متابعة استشارية
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#859394] mt-1.5">
                    <span className="font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                      {toEnglishDigits(fu.phone)}
                    </span>
                    <span>•</span>
                    <span>ملف #{toEnglishDigits(fu.fileNumber || 1)}</span>
                  </div>

                  <div className="mt-2.5 p-2.5 rounded-xl bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-[#859394]">تاريخ آخر كشف:</span>
                      <span className="font-mono font-medium">{toEnglishDigits(fu.lastVisitDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-[#859394]">موعد المتابعة المستحق:</span>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="font-mono font-bold text-[#008f97] dark:text-[#00c2cb]">
                          {toEnglishDigits(fu.dueDate)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            fu.daysRemaining < 0
                              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
                              : fu.daysRemaining === 0
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30'
                              : fu.daysRemaining === 1
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30'
                              : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-900/30'
                          }`}
                        >
                          {fu.daysRemaining < 0
                            ? `(متأخر ${toEnglishDigits(Math.abs(fu.daysRemaining))} يوم)`
                            : fu.daysRemaining === 0
                            ? `(اليوم - ${toEnglishDigits(0)} يوم متبقي)`
                            : fu.daysRemaining === 1
                            ? `(غداً - متبقي ${toEnglishDigits(1)} يوم)`
                            : `(متبقي ${toEnglishDigits(fu.daysRemaining)} يوم)`}
                        </span>
                      </div>
                    </div>
                    {fu.diagnosis && (
                      <div className="text-xs pt-1 border-t border-slate-100 dark:border-white/5 text-slate-700 dark:text-slate-300">
                        <span className="text-slate-400">التشخيص: </span>
                        {fu.diagnosis}
                      </div>
                    )}
                  </div>
                </div>

                {/* Follow-up Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsappFollowupReminder(fu)}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    <span>تذكير واتساب بالمتابعة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPatientName(fu.patientName);
                      setPhone(fu.phone);
                      setVisitType('متابعة');
                      setAppointmentNotes(`متابعة دورية: ${fu.diagnosis}`);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      setToastMessage(`تم نسخ بيانات المريض (${fu.patientName}) في نموذج إضافة موعد بالأعلى`);
                      setTimeout(() => setToastMessage(null), 3500);
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-[#dde2f5] font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
                    title="جدولة موعد في نموذج الحجز بالأعلى"
                  >
                    <span className="material-symbols-outlined text-base">event</span>
                    <span>جدولة موعد</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Modal: إضافة من طلب واتساب (Smart WhatsApp parser modal) */}
      {/* ========================================================================= */}
      {isWhatsappModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-white/10 max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-[#25D366]/20 text-emerald-700 dark:text-[#25D366] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-lg">chat</span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  إضافة موعد من رسالة واتساب
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWhatsappModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[#859394] leading-relaxed">
              انسخ نص رسالة الحجز المرسلة من المريض على واتساب، وسيقوم النظام الذكي تلقائياً باستخراج الاسم ورقم الهاتف ونوع الكشف وتعبئة نموذج الموعد.
            </p>

            <textarea
              rows={4}
              value={whatsappRawText}
              onChange={(e) => setWhatsappRawText(e.target.value)}
              placeholder="الصق رسالة الواتساب هنا... مثال: 
مرحباً دكتور العيادة، عايز أحجز كشف باطنة باسم جمال على محمد ورقمي 01021434947 يوم الاثنين 9 صباحاً"
              className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs p-3.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] resize-none"
            />

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400 font-bold">رسائل سريعة تجريبية:</span>
              <button
                type="button"
                onClick={() =>
                  setWhatsappRawText(
                    'مساء الخير العيادة الطبية، حجز كشف مستعجل، الاسم: جمال على محمد، هاتف: 01021434947'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                نموذج 1: جمال علي محمد
              </button>
              <button
                type="button"
                onClick={() =>
                  setWhatsappRawText(
                    'السلام عليكم، متابعة واستشارة بعد كورس العلاج، اسم المريضة: سارة إبراهيم محمود - 01145829103'
                  )
                }
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                نموذج 2: سارة إبراهيم
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setIsWhatsappModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={!whatsappRawText.trim()}
                onClick={handleParseWhatsappText}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">auto_fix_high</span>
                <span>استخراج وتعبئة النموذج</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* Modal: تذكير واتساب بالموعد أو المتابعة مع اختيار الفرع ومعاينة الرسالة */}
      {/* ========================================================================= */}
      <WhatsappReminderModal
        isOpen={reminderModalData.isOpen}
        onClose={() => setReminderModalData((prev) => ({ ...prev, isOpen: false }))}
        type={reminderModalData.type}
        patientName={reminderModalData.patientName}
        phone={reminderModalData.phone}
        timeSlot={reminderModalData.timeSlot}
        visitType={reminderModalData.visitType}
        date={reminderModalData.date}
        dueDate={reminderModalData.dueDate}
        diagnosis={reminderModalData.diagnosis}
        initialBranch={reminderModalData.initialBranch}
      />
    </div>
  );
};
