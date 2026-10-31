import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CLINIC_INFO } from '../data/previewClinicData';
import { useDoctorName } from '../hooks/useDoctorName';
import { QueueItem, AppointmentListItem, PatientListItem, TransactionRecord, ScreenType } from '../types';
import { ClinicAlertPayload } from '../utils/alertManager';
import { GlobalSearchBar } from './GlobalSearchBar';
import { toEnglishDigits } from '../utils/numberUtils';
import { useLanguage } from '../i18n/LanguageContext';
import { findBranch } from '../utils/clinicBranches';

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
  diagnosis?: string;
  notes?: string;
}

export interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onNavigate?: (screen: ScreenType) => void;
  // Live Data & Sync Status
  syncStatus: 'connected' | 'offline' | 'syncing' | 'error';
  syncErrorDetails?: string | null;
  onRetrySync?: () => void;
  // Queue & Alerts Integration
  waitingQueue: QueueItem[];
  recentAlerts: ClinicAlertPayload[];
  onDismissAlert?: (alertId: string) => void;
  onClearAllAlerts?: () => void;
  activeExamPatientName?: string | null;
  onCallPatient?: (ticket: string, name: string) => void;
  // Followups Data & Action
  followUpsList?: FollowUpItem[];
  // Global Search Data
  patients?: PatientListItem[];
  appointments?: AppointmentListItem[];
  transactions?: TransactionRecord[];
  onSelectPatient?: (patient: PatientListItem) => void;
  onStartIntakeFromAppointment?: (appointment: AppointmentListItem) => void;
  onOpenDatabaseInspector?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onNavigate,
  syncStatus,
  syncErrorDetails,
  onRetrySync,
  waitingQueue = [],
  recentAlerts = [],
  onDismissAlert,
  onClearAllAlerts,
  activeExamPatientName,
  onCallPatient,
  followUpsList = [],
  patients = [],
  appointments = [],
  transactions = [],
  onSelectPatient,
  onStartIntakeFromAppointment,
  isDark,
  onToggleTheme,
}) => {
  const { language, toggleLanguage, isRTL, t } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSyncDetailsModal, setShowSyncDetailsModal] = useState(false);
  const [activeNotifyTab, setActiveNotifyTab] = useState<'queue' | 'alerts' | 'followups'>('queue');
  const activeDoctorName = useDoctorName();
  const [whatsappToast, setWhatsappToast] = useState<string | null>(null);

  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Filter urgent upcoming follow-ups: Only patients with 0 to 2 days remaining (0 <= days <= 2)
  const urgentFollowUps = useMemo(() => {
    return followUpsList.filter((f) => f.daysRemaining >= 0 && f.daysRemaining <= 2);
  }, [followUpsList]);

  // Send stylized WhatsApp message for doctor-scheduled follow-up
  const handleSendWhatsapp = (phone: string, patientName: string, dueDate?: string) => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;
    const dateText = dueDate || (language === 'en' ? 'upcoming days' : 'الأيام القادمة');
    const branch = findBranch();
    const branchAddress = branch.address || (language === 'en' ? 'Clinic Main Address' : 'العنوان الرئيسي للعيادة');
    const branchPhone = branch.phone || branch.mobile || '01092847162';

    const message = language === 'en'
      ? `Hello *${patientName}* 🌸
This is a reminder for your follow-up medical consultation at *Dr. ${activeDoctorName}'s Clinic* 🩺
🗓 Follow-up date: *${dateText}*
📍 Branch: *${branch.name}*
Address: ${branchAddress}
📞 Confirmation Phone: ${branchPhone}
Wishing you great health and wellness ✨`
      : `مرحباً بحضرتك أستاذ/ة *${patientName}* 🌸
نود تذكيركم بموعد المتابعة والاستشارة الطبية المحدد لكم في *عيادة ${activeDoctorName}* 🩺
🗓 موعد المتابعة: *${dateText}*
📍 فرع العيادة: *${branch.name}*
العنوان: ${branchAddress}
📞 للتأكيد أو الاستفسار: ${branchPhone}
مع تمنياتنا لكم بدوام الصحة والعافية ✨`;

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    // Open in new tab or trigger toast
    try {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Fallback
    }

    setWhatsappToast(
      language === 'en'
        ? `WhatsApp chat opened with follow-up reminder for (${patientName})`
        : `تم فتح محادثة واتساب وتجهيز رسالة تذكير المتابعة لـ (${patientName})`
    );
    setTimeout(() => setWhatsappToast(null), 4000);
  };

  // Total unread/pending count for notification badge: queue items + active alerts + urgent followups (< 2 days)
  const totalActionCount = waitingQueue.length + recentAlerts.length + urgentFollowUps.length;

  return (
    <>
      <header className={`fixed top-0 ${isRTL ? 'right-0 lg:right-72 left-0' : 'left-0 lg:left-72 right-0'} h-16 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 z-40 flex items-center justify-between px-2 sm:px-6 transition-colors gap-1 sm:gap-3`}>
        {/* Right Side / Start Side: Mobile Hamburger & Live Sync Status Badge */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#161b29] dark:hover:bg-[#242a38] text-slate-700 dark:text-[#bbc9ca] flex items-center justify-center border border-slate-200 dark:border-white/5 cursor-pointer shrink-0"
            aria-label={language === 'en' ? 'Open sidebar menu' : 'فتح القائمة الجانبية'}
          >
            <span className="material-symbols-outlined text-lg sm:text-xl">menu</span>
          </button>

          {/* Sync Status Badge (متصل / غير متصل / جاري الاتصال) */}
          {syncStatus === 'connected' && (
            <div
              className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-950/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-emerald-500/20 dark:border-emerald-500/30 transition-all cursor-default select-none shrink-0"
              title={language === 'en' ? 'System is online' : 'النظام متصل بالسحابة'}
            >
              <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                {t('header.connected')}
              </span>
            </div>
          )}

          {syncStatus === 'syncing' && (
            <div
              className="flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-950/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-amber-500/30 dark:border-amber-400/30 transition-all cursor-default select-none shrink-0"
              title={language === 'en' ? 'Connecting and syncing...' : 'جاري الاتصال والمزامنة مع السحابة'}
            >
              <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-amber-500 animate-spin"></span>
              <span className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400 font-bold">
                {t('header.syncing')}
              </span>
            </div>
          )}

          {(syncStatus === 'offline' || syncStatus === 'error') && (
            <div
              className="flex items-center gap-1.5 bg-rose-500/10 dark:bg-rose-950/30 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-rose-500/30 dark:border-rose-500/40 transition-all cursor-default select-none shrink-0"
              title={language === 'en' ? 'Disconnected' : 'غير متصل بالشبكة أو حدث خطأ في الاتصال'}
            >
              <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-rose-500 dark:bg-rose-400"></span>
              <span className="text-[11px] sm:text-xs text-rose-700 dark:text-rose-400 font-bold">
                {t('header.offline')}
              </span>
            </div>
          )}

          <div className="hidden xl:flex items-center gap-1.5 text-slate-400 dark:text-[#bbc9ca] text-xs font-medium mx-1">
            <span className="material-symbols-outlined text-base">calendar_today</span>
            <span>
              {language === 'en' ? 'Today, ' : 'اليوم، '}
              {new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Middle: Universal Global Search Bar (Patients, Phone, File #, Services, Appointments) */}
        <GlobalSearchBar
          patients={patients}
          appointments={appointments}
          queue={waitingQueue}
          transactions={transactions}
          syncStatus={syncStatus}
          onNavigate={onNavigate || (() => {})}
          onSelectPatient={onSelectPatient}
          onStartIntakeFromAppointment={onStartIntakeFromAppointment}
          onCallPatient={onCallPatient}
        />

        {/* Left Side / End Side: Notifications Hub */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Notifications Dropdown Button */}
          <div ref={notificationRef} className="relative shrink-0">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
                showNotifications
                  ? 'bg-[#00c2cb] text-[#08101C]'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#161b29] dark:hover:bg-[#242a38] text-slate-700 hover:text-slate-900 dark:text-[#bbc9ca] dark:hover:text-[#dde2f5] border border-slate-200 dark:border-white/5'
              }`}
              aria-label={t('header.notifications')}
              title={language === 'en' ? 'Clinical Notification & Queue Center' : 'مركز الإشعارات والتنبيهات السريرية'}
            >
              <span className="material-symbols-outlined text-lg sm:text-xl">notifications</span>
              {totalActionCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center animate-pulse shadow-sm">
                  {totalActionCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-80 sm:w-96 bg-white dark:bg-[#18233C] border border-slate-200 dark:border-[#00c2cb]/30 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in ${isRTL ? 'text-right' : 'text-left'}`}>
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#00c2cb] text-lg">campaign</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5]">
                      {language === 'en' ? 'Clinical Notifications Center' : 'مركز التنبيهات الإكلينيكي'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>

                {/* Tabs inside Notifications */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-[#111A2E] p-1 rounded-xl my-2 text-[11px] font-bold">
                  <button
                    onClick={() => setActiveNotifyTab('queue')}
                    className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      activeNotifyTab === 'queue'
                        ? 'bg-white dark:bg-[#18233C] text-[#008f97] dark:text-[#00c2cb] shadow-xs'
                        : 'text-slate-500 dark:text-[#bbc9ca]'
                    }`}
                  >
                    <span>{t('nav.queue')}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#00c2cb]/20 text-[10px] font-mono">
                      {waitingQueue.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveNotifyTab('alerts')}
                    className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      activeNotifyTab === 'alerts'
                        ? 'bg-white dark:bg-[#18233C] text-[#008f97] dark:text-[#00c2cb] shadow-xs'
                        : 'text-slate-500 dark:text-[#bbc9ca]'
                    }`}
                  >
                    <span>{t('header.alerts')}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-[10px] font-mono">
                      {recentAlerts.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveNotifyTab('followups')}
                    className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                      activeNotifyTab === 'followups'
                        ? 'bg-white dark:bg-[#18233C] text-[#008f97] dark:text-[#00c2cb] shadow-xs'
                        : 'text-slate-500 dark:text-[#bbc9ca]'
                    }`}
                  >
                    <span>{t('header.followUps')}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      urgentFollowUps.length > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold' : 'bg-slate-100 dark:bg-white/5 text-slate-400'
                    }`}>
                      {urgentFollowUps.length}
                    </span>
                  </button>
                </div>

                {/* Active Exam Alert status */}
                {activeExamPatientName && (
                  <div className="mb-2 p-2 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/10 border border-teal-200 dark:border-[#00c2cb]/20 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      <span className="text-slate-700 dark:text-[#dde2f5] font-semibold">
                        داخل الغرفة حالياً: <strong className="text-[#008f97] dark:text-[#45dee7]">{activeExamPatientName}</strong>
                      </span>
                    </div>
                    {onNavigate && (
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          onNavigate('clinical-exam');
                        }}
                        className="text-[10px] font-bold text-[#008f97] dark:text-[#00c2cb] underline cursor-pointer"
                      >
                        فتح الغرفة
                      </button>
                    )}
                  </div>
                )}

                {/* Tab 1: Waiting Queue List */}
                {activeNotifyTab === 'queue' && (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 space-y-1">
                    {waitingQueue.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 dark:text-[#859394]">
                        <span className="material-symbols-outlined text-2xl mb-1 text-slate-300 dark:text-slate-600 block">
                          check_circle
                        </span>
                        لا يوجد مرضى في صالة الانتظار حالياً
                      </div>
                    ) : (
                      waitingQueue.map((item) => (
                        <div key={item.id} className="py-2 px-1 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-[#111A2E] rounded-lg transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#00c2cb] font-bold text-xs flex items-center justify-center shrink-0">
                              {item.ticketNumber}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 dark:text-[#dde2f5] truncate">
                                {item.patientName}
                              </p>
                              <p className="text-[10px] text-slate-400 dark:text-[#859394]">
                                {item.visitType} • ينتظر منذ {item.elapsedMinutes} دقيقة
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onCallPatient && (
                              <button
                                onClick={() => {
                                  onCallPatient(item.ticketNumber, item.patientName);
                                }}
                                className="px-2 py-1 bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] rounded-lg text-[10px] font-bold flex items-center gap-0.5 cursor-pointer active:scale-95"
                                title="استدعاء المريض للدخول"
                              >
                                <span className="material-symbols-outlined text-xs">campaign</span>
                                <span>نداء</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 2: Recent Alerts History */}
                {activeNotifyTab === 'alerts' && (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {recentAlerts.length > 0 && onClearAllAlerts && (
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-white/5 text-[10px]">
                        <span className="text-slate-400 dark:text-[#859394]">تنبيهات العيادة الحالية</span>
                        <button
                          type="button"
                          onClick={onClearAllAlerts}
                          className="text-rose-500 hover:text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          مسح الكل
                        </button>
                      </div>
                    )}
                    {recentAlerts.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 dark:text-[#859394]">
                        <span className="material-symbols-outlined text-2xl mb-1 text-slate-300 dark:text-slate-600 block">
                          notifications_paused
                        </span>
                        سجل التنبيهات الإكلينيكية هادئ
                      </div>
                    ) : (
                      recentAlerts.map((alert) => (
                        <div key={alert.id} className="py-2 px-1 flex items-start gap-2 hover:bg-slate-50 dark:hover:bg-[#111A2E] rounded-lg transition-colors group">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            alert.type === 'finish'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : alert.type === 'call'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-[#00c2cb]/20 text-[#008f97] dark:text-[#00c2cb]'
                          }`}>
                            <span className="material-symbols-outlined text-base">
                              {alert.type === 'finish' ? 'task_alt' : alert.type === 'call' ? 'campaign' : 'person_add'}
                            </span>
                          </div>
                          <div className="text-xs min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="font-semibold text-slate-900 dark:text-[#dde2f5] truncate">{alert.title}</p>
                              {onDismissAlert && (
                                <button
                                  type="button"
                                  onClick={() => onDismissAlert(alert.id)}
                                  className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer transition-colors"
                                  title="إخفاء التنبيه"
                                >
                                  <span className="material-symbols-outlined text-xs">close</span>
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-[#bbc9ca] mt-0.5 leading-snug">
                              {alert.message}
                            </p>
                            <span className="text-[10px] text-slate-400 dark:text-[#859394] font-mono mt-1 block">
                              {alert.timestamp}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Tab 3: Upcoming Follow-ups (< 2 days only) & WhatsApp Reminders */}
                {activeNotifyTab === 'followups' && (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5 space-y-1">
                    {urgentFollowUps.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 dark:text-[#859394]">
                        <span className="material-symbols-outlined text-2xl mb-1 text-emerald-500 block">
                          task_alt
                        </span>
                        لا توجد متابعات مستحقة خلال أقل من يومين
                      </div>
                    ) : (
                      urgentFollowUps.map((f) => {
                        return (
                          <div
                            key={f.id}
                            className="py-2 px-2 flex items-center justify-between gap-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-slate-900 dark:text-[#dde2f5] truncate">
                                  {f.patientName}
                                </span>
                                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-transparent">
                                  أقل من يومين ⚠️
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 dark:text-[#859394] mt-0.5">
                                موعد المتابعة: <strong className="font-mono text-slate-700 dark:text-slate-300">{toEnglishDigits(f.dueDate)}</strong>
                                <span className="text-amber-700 dark:text-amber-400 font-bold mr-1">
                                  {f.daysRemaining < 0
                                    ? `(متأخر منذ ${toEnglishDigits(Math.abs(f.daysRemaining))} يوم)`
                                    : f.daysRemaining === 0
                                    ? ` (الموعد اليوم - ${toEnglishDigits(0)} يوم)`
                                    : ` (غداً - متبقي ${toEnglishDigits(1)} يوم)`}
                                </span>
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSendWhatsapp(f.phone, f.patientName, f.dueDate)}
                              className="p-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-all shrink-0 shadow-xs"
                              title="إرسال رسالة تذكير بالموعد عبر واتساب"
                            >
                              <span className="material-symbols-outlined text-sm">chat</span>
                              <span>تذكير</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Panel Footer */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-xs">
                  {onNavigate && (
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        onNavigate('upcoming-followups');
                      }}
                      className="text-[11px] font-bold text-[#008f97] dark:text-[#00c2cb] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>الانتقال لصفحة المتابعات القادمة</span>
                      <span className="material-symbols-outlined text-sm">arrow_left</span>
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 font-mono">تنبيهات فورية</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sync Status Details Modal */}
      {showSyncDetailsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  syncStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : syncStatus === 'offline'
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                }`}>
                  <span className="material-symbols-outlined text-xl">
                    {syncStatus === 'connected' ? 'cloud_done' : syncStatus === 'syncing' ? 'sync' : syncStatus === 'offline' ? 'cloud_off' : 'cloud_sync'}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                    حالة الاتصال ومزامنة قاعدة البيانات
                  </h3>
                  <p className="text-[11px] text-slate-400">Firebase Firestore Cloud Database</p>
                </div>
              </div>
              <button
                onClick={() => setShowSyncDetailsModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#111A2E] text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-[#111A2E] p-3.5 rounded-2xl border border-slate-200 dark:border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-[#bbc9ca]">الحالة الراهنة:</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                    syncStatus === 'connected'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      : syncStatus === 'offline'
                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                  }`}>
                    {syncStatus === 'connected'
                      ? 'متصل بالسحابة وتعمل المزامنة الفورية'
                      : syncStatus === 'syncing'
                      ? 'جار المزامنة ونقل التغييرات'
                      : syncStatus === 'offline'
                      ? 'غير متصل (البيانات محفوظة محلياً)'
                      : 'مشكلة في المزامنة أو إعدادات الاتصال'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 dark:border-white/5">
                  <span className="text-slate-400">الذاكرة المؤقتة (Offline Persistence):</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">مفعلة (Multi-tab IndexedDB)</span>
                </div>
              </div>

              {/* Error Details Breakdown if error */}
              {syncErrorDetails && (
                <div className="bg-rose-50 dark:bg-rose-950/40 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold">
                    <span className="material-symbols-outlined text-base">error</span>
                    <span>تفاصيل المشكلة المرصودة:</span>
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-300 font-mono break-words leading-relaxed">
                    {syncErrorDetails}
                  </p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 dark:text-[#bbc9ca] leading-relaxed">
                يضمن نظام المزامنة الفوري حفظ كافة الكشوفات والفواتير والروشتات في قاعدة بيانات Firebase Firestore السحابية فور إدخالها، مع إمكانية استمرار العمل أوفلاين والمزامنة التلقائية عند عودة الشبكة.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              {onRetrySync && syncStatus !== 'connected' && (
                <button
                  onClick={() => {
                    onRetrySync();
                    setShowSyncDetailsModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">refresh</span>
                  <span>إعادة محاولة المزامنة</span>
                </button>
              )}
              <button
                onClick={() => setShowSyncDetailsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#111A2E] text-slate-700 dark:text-[#dde2f5] font-semibold text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-[#1e283d]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating WhatsApp Toast Confirmation */}
      {whatsappToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#18233C] border-2 border-emerald-500 text-emerald-700 dark:text-[#10B981] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 max-w-md">
          <span className="material-symbols-outlined text-2xl text-emerald-500">chat</span>
          <span className="text-xs font-bold leading-snug">{whatsappToast}</span>
        </div>
      )}
    </>
  );
};
