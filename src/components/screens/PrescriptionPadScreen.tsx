import React, { useState, useEffect } from 'react';
import { formatBranchTime, generateAllDayTimeOptions } from '../../utils/clinicBranches';
import { QrCodeImage } from '../QrCodeImage';
import { doc, setDoc } from 'firebase/firestore';
import { exportPrescriptionToPdf } from '../../utils/exportPrescriptionPdf';
import { printPrescriptionDocument } from '../../utils/printPrescription';
import { CLINIC_INFO } from '../../data/previewClinicData';
import { db } from '../../services/firebase';
import { saveSettingsDocument, subscribeToPrescriptionSettings } from '../../services/repositories';
import { safeStorage, StorageKeys } from '../../services/storage';
import { usePermissions } from '../../context/AuthContext';
import { PermissionGate } from '../auth/PermissionGate';
import { PatientListItem, PrescriptionItem } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatAppDate, formatAppTime } from '../../utils/numberUtils';

interface PrescriptionPadScreenProps {
  patient?: PatientListItem | null;
  items?: PrescriptionItem[];
  onChangeItems?: (items: PrescriptionItem[]) => void;
  onUpdatePatient?: (updated: { patientId: string; fullName: string; dateOfBirth?: string; age?: number }) => void;
}

export interface PrescriptionLayoutSettings {
  doctorName: string;
  doctorNameEn: string;
  specialtyAr: string;
  specialtyEn: string;
  degreesAr: string;
  degreesEn: string;
  phone: string;
  logoUrl: string | null;
  showLogo: boolean;
  showHeader: boolean;
  showFooter: boolean;
  preprintedPaperMode: boolean;
  showQr: boolean;
  qrType: 'whatsapp' | 'booking' | 'custom';
  qrWhatsappPhone: string;
  qrCustomUrl: string;
  qrSize: 'small' | 'medium' | 'large'; // 14mm | 19mm | 25mm
  footerFontSize: 'small' | 'regular' | 'large'; // 8px | 10px | 12px
  outerMargin: 'very_tight' | 'tight' | 'normal' | 'wide' | 'very_wide'; // 2mm | 4mm | 7mm | 10mm | 14mm
  headerMarginTop: 'very_tight' | 'tight' | 'balanced' | 'wide' | 'very_wide'; // 2mm | 4mm | 7mm | 10mm | 14mm
  footerMarginBottom: 'very_tight' | 'tight' | 'balanced' | 'wide' | 'very_wide'; // 2mm | 4mm | 7mm | 10mm | 14mm
  sectionSpacing: 'compact' | 'balanced' | 'comfortable';
  contentScale: 'scale_70' | 'scale_100' | 'auto_shrink';
  branches: Array<{
    id: string;
    name: string;
    address?: string;
    phone: string;
    workingHours?: string;
    startTime?: string;
    endTime?: string;
  }>;
}

const DEFAULT_LAYOUT: PrescriptionLayoutSettings = {
  doctorName: CLINIC_INFO.doctorName,
  doctorNameEn: 'Dr. Hazem El-Kady',
  specialtyAr: CLINIC_INFO.doctorTitle,
  specialtyEn: 'Consultant of Internal Medicine & Cardiology',
  degreesAr: CLINIC_INFO.doctorCredentials,
  degreesEn: 'M.D., MRCP (London) • Cairo University',
  phone: CLINIC_INFO.branches[0]?.mobile || '01092847162',
  logoUrl: CLINIC_INFO.logoUrl || null,
  showLogo: true,
  showHeader: true,
  showFooter: true,
  preprintedPaperMode: false,
  showQr: true,
  qrType: 'whatsapp',
  qrWhatsappPhone: '01092847162',
  qrCustomUrl: 'https://solimedical.com',
  qrSize: 'medium',
  footerFontSize: 'regular',
  outerMargin: 'normal',
  headerMarginTop: 'balanced',
  footerMarginBottom: 'balanced',
  sectionSpacing: 'balanced',
  contentScale: 'auto_shrink',
  branches: [
    {
      id: 'b-1',
      name: 'الفرع الرئيسي - المهندسين',
      address: '24 شارع سوريا - تقاطع جزيرة العرب',
      phone: '02-37618920 / 01092847162',
      workingHours: 'السبت، الإثنين، الأربعاء 04:00 م - 10:00 م',
    },
    {
      id: 'b-2',
      name: 'فرع الدقي - مركز التحرير',
      address: '98 شارع التحرير - برج الأطباء',
      phone: '02-33385210 / 01124890014',
      workingHours: 'الأحد، الثلاثاء، الخميس 06:00 م - 11:30 م',
    },
  ],
};

const MARGIN_VALUES: Record<string, string> = {
  very_tight: '2mm',
  tight: '4mm',
  normal: '7mm',
  wide: '10mm',
  very_wide: '14mm',
  balanced: '7mm',
};

const QR_SIZE_PX: Record<string, number> = {
  small: 52, // ~14mm
  medium: 72, // ~19mm
  large: 95, // ~25mm
};

export const PrescriptionPadScreen: React.FC<PrescriptionPadScreenProps> = ({
  patient,
  items = [],
  onChangeItems,
  onUpdatePatient,
}) => {
  const { language, isRTL, t } = useLanguage();
  const { assertPermission } = usePermissions();

  // Editing patient state from Prescription Pad
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editName, setEditName] = useState(patient?.name || '');
  const [editAge, setEditAge] = useState<number | string>(patient?.age || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isSavingPatient, setIsSavingPatient] = useState(false);

  useEffect(() => {
    if (patient) {
      setEditName(patient.name);
      setEditAge(patient.age);
    }
  }, [patient]);

  const handleSavePatientName = async () => {
    if (!patient || !editName.trim()) return;
    setIsSavingPatient(true);
    try {
      const trimmedName = editName.trim();
      const numAge = Number(editAge) || patient.age;
      const birthYear = editAge ? new Date().getFullYear() - Number(editAge) : 1988;
      const calculatedDOB = `${birthYear}-01-01`;

      if (db) {
        await setDoc(
          doc(db, 'patients', patient.id),
          {
            fullName: trimmedName,
            dateOfBirth: calculatedDOB,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      onUpdatePatient?.({
        patientId: patient.id,
        fullName: trimmedName,
        dateOfBirth: calculatedDOB,
        age: numAge,
      });

      setIsEditingPatient(false);
      setSaveSuccessMsg('تم حفظ وتحديث بيانات المريض بنجاح ونشرها لجميع المستخدمين');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Failed to update patient from prescription screen:', err);
      alert('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSavingPatient(false);
    }
  };

  const [config, setConfig] = useState<PrescriptionLayoutSettings>(() => {
    const cached = safeStorage.getJSON<PrescriptionLayoutSettings | null>(StorageKeys.PRESCRIPTION_SETTINGS, null);
    if (cached) {
      return { ...DEFAULT_LAYOUT, ...cached };
    }
    return DEFAULT_LAYOUT;
  });

  // Real-time synchronization across accounts from Firestore
  useEffect(() => {
    if (!db) return;
    const unsubscribe = subscribeToPrescriptionSettings<PrescriptionLayoutSettings>(
      db,
      (remoteConfig) => {
        if (remoteConfig && Object.keys(remoteConfig).length > 0) {
          setConfig((prev) => ({
            ...prev,
            ...remoteConfig,
          }));
          safeStorage.setJSON(StorageKeys.PRESCRIPTION_SETTINGS, remoteConfig);
          window.dispatchEvent(new Event('soli_prescription_updated'));
        }
      },
      (err) => {
        console.warn('Prescription settings subscription error:', err);
      }
    );
    return () => unsubscribe();
  }, []);

  // Instantly reflect prescription configuration changes (including doctor name) across all screens and auto-sync
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving'>('saved');

  useEffect(() => {
    safeStorage.setJSON(StorageKeys.PRESCRIPTION_SETTINGS, config);
    window.dispatchEvent(new Event('soli_prescription_updated'));
    window.dispatchEvent(new Event('storage'));

    setAutoSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        if (db) {
          await saveSettingsDocument(db, 'prescriptionSettings', config as unknown as Record<string, unknown>);
          await saveSettingsDocument(db, 'doctorProfile', {
            doctorNameAr: config.doctorName,
            doctorNameEn: config.doctorNameEn,
            specialtyAr: config.specialtyAr,
            specialtyEn: config.specialtyEn,
            credentialsAr: [config.degreesAr],
            credentialsEn: [config.degreesEn],
            phone: config.phone,
            logoUrl: config.logoUrl,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Auto-save prescription settings background sync error:', err);
      } finally {
        setAutoSaveStatus('saved');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [config]);

  const [activeTab, setActiveTab] = useState<'layout' | 'header' | 'qr' | 'branches' | 'printers'>('layout');
  const [printerPaper, setPrinterPaper] = useState<string>(() => safeStorage.getItem(StorageKeys.PRINTER_PAPER, '80mm') || '80mm');
  const [autoPrintReceipt, setAutoPrintReceipt] = useState<boolean>(() => safeStorage.getItem(StorageKeys.AUTO_PRINT) !== 'false');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Branch form state (Add & Edit)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchPhone, setNewBranchPhone] = useState('');
  const [newBranchDays, setNewBranchDays] = useState('الأحد، الثلاثاء، الخميس');
  const [newCustomBranchDays, setNewCustomBranchDays] = useState('');
  const [newBranchStartTime, setNewBranchStartTime] = useState('16:00');
  const [newBranchEndTime, setNewBranchEndTime] = useState('22:00');
  const [newBranchHours, setNewBranchHours] = useState('');
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);

  const DAY_PRESETS = [
    'الأحد، الثلاثاء، الخميس',
    'السبت، الإثنين، الأربعاء',
    'يومياً ما عدا الجمعة',
    'من السبت إلى الخميس',
    'طوال أيام الأسبوع (يومياً)',
    'أيام مخصصة',
  ];

  const START_TIME_OPTIONS = generateAllDayTimeOptions();
  const END_TIME_OPTIONS = generateAllDayTimeOptions();

  const computeFinalWorkingHours = (days: string, customDays: string, start: string, end: string) => {
    const daysLabel = days === 'أيام مخصصة' ? customDays.trim() : days;
    const startTimeFormatted = formatBranchTime(start);
    const endTimeFormatted = formatBranchTime(end);
    if (!daysLabel) return `${startTimeFormatted} - ${endTimeFormatted}`;
    return `${daysLabel} ${startTimeFormatted} - ${endTimeFormatted}`;
  };

  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getEffectiveQrLink = () => {
    if (config.qrType === 'whatsapp') {
      const clean = config.qrWhatsappPhone.replace(/\D/g, '');
      const formatted = clean.startsWith('0') ? `2${clean}` : clean;
      return `https://wa.me/${formatted}`;
    }
    if (config.qrType === 'booking') {
      return typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}#booking` : 'https://solimedical.com/booking';
    }
    return config.qrCustomUrl || 'https://solimedical.com';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
      alert('يرجى اختيار صورة بتنسيق PNG أو JPG فقط');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setConfig((prev) => ({ ...prev, logoUrl: result, showLogo: true }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    try {
      assertPermission('settings.edit', 'حفظ إعدادات الروشتة والطباعة');
      setIsSaving(true);
      if (db) {
        await saveSettingsDocument(db, 'prescriptionSettings', config as unknown as Record<string, unknown>);
        await saveSettingsDocument(db, 'doctorProfile', {
          doctorNameAr: config.doctorName,
          doctorNameEn: config.doctorNameEn,
          specialtyAr: config.specialtyAr,
          specialtyEn: config.specialtyEn,
          credentialsAr: [config.degreesAr],
          credentialsEn: [config.degreesEn],
          phone: config.phone,
          logoUrl: config.logoUrl,
          updatedAt: new Date().toISOString(),
        });
      }
      safeStorage.setJSON(StorageKeys.PRESCRIPTION_SETTINGS, config);
      setToastMessage('تم حفظ وتزامن إعدادات الروشتة وبيانات الطبيب بنجاح عبر جميع الحسابات!');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAddBranch = () => {
    setEditingBranchId(null);
    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone(config.phone || '01092847162');
    setNewBranchDays('الأحد، الثلاثاء، الخميس');
    setNewCustomBranchDays('');
    setNewBranchStartTime('16:00');
    setNewBranchEndTime('22:00');
    setNewBranchHours('الأحد، الثلاثاء، الخميس 04:00 م - 10:00 م');
    setShowAddBranchModal(true);
  };

  const handleOpenEditBranch = (branch: PrescriptionLayoutSettings['branches'][0]) => {
    setEditingBranchId(branch.id);
    setNewBranchName(branch.name);
    setNewBranchAddress(branch.address || '');
    setNewBranchPhone(branch.phone || config.phone || '');
    
    // Determine preset vs custom days
    const hoursText = branch.workingHours || '';
    const matchingPreset = DAY_PRESETS.find((p) => p !== 'أيام مخصصة' && hoursText.includes(p));
    if (matchingPreset) {
      setNewBranchDays(matchingPreset);
      setNewCustomBranchDays('');
    } else if (hoursText) {
      setNewBranchDays('أيام مخصصة');
      setNewCustomBranchDays(hoursText);
    } else {
      setNewBranchDays('الأحد، الثلاثاء، الخميس');
      setNewCustomBranchDays('');
    }

    setNewBranchStartTime(branch.startTime || '16:00');
    setNewBranchEndTime(branch.endTime || '22:00');
    setNewBranchHours(branch.workingHours || '');
    setShowAddBranchModal(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    const finalHours = computeFinalWorkingHours(newBranchDays, newCustomBranchDays, newBranchStartTime, newBranchEndTime);

    if (editingBranchId) {
      setConfig((prev) => ({
        ...prev,
        branches: prev.branches.map((b) =>
          b.id === editingBranchId
            ? {
                ...b,
                name: newBranchName.trim(),
                address: newBranchAddress.trim() || undefined,
                phone: newBranchPhone.trim() || config.phone,
                workingHours: finalHours,
                startTime: newBranchStartTime,
                endTime: newBranchEndTime,
              }
            : b
        ),
      }));
    } else {
      const newBranch = {
        id: `branch-${Date.now()}`,
        name: newBranchName.trim(),
        address: newBranchAddress.trim() || undefined,
        phone: newBranchPhone.trim() || config.phone,
        workingHours: finalHours,
        startTime: newBranchStartTime,
        endTime: newBranchEndTime,
      };

      setConfig((prev) => ({
        ...prev,
        branches: [...prev.branches, newBranch],
      }));
    }

    setNewBranchName('');
    setNewBranchAddress('');
    setNewBranchPhone('');
    setNewBranchHours('');
    setEditingBranchId(null);
    setShowAddBranchModal(false);
  };

  const handleRemoveBranch = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      branches: prev.branches.filter((b) => b.id !== id),
    }));
  };

  const handlePrintTest = () => {
    printPrescriptionDocument({
      config,
      patient,
      items,
      diagnoses: [{ id: 'd1', code: 'I10', nameAr: 'ارتفاع ضغط الدم الأولي', nameEn: 'Essential Hypertension', isPrimary: true }],
      lifestyleAdvice: 'تقليل الملح في الطعام، ممارسة المشي 30 دقيقة يومياً وشرب الماء بانتظام.',
      followupDate: '2026-09-24',
    });
  };

  const handleExportPDF = () => {
    exportPrescriptionToPdf({
      config,
      patient,
      items,
      diagnoses: [{ id: 'd1', code: 'I10', nameAr: 'ارتفاع ضغط الدم الأولي', nameEn: 'Essential Hypertension', isPrimary: true }],
      lifestyleAdvice: 'تقليل الملح في الطعام، ممارسة المشي 30 دقيقة يومياً وشرب الماء بانتظام.',
      followupDate: '2026-09-24',
    }, patient ? patient.name : 'مريض');
  };

  const isCustomUrlValid = config.qrType === 'custom' ? isValidUrl(config.qrCustomUrl) : true;

  return (
    <div className="flex flex-col w-full pb-20 space-y-6 text-slate-800 dark:text-[#dde2f5]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#18233C] border border-[#10B981] text-emerald-600 dark:text-[#10B981] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-2xl">check_circle</span>
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Main Actions */}
      <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">print</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span>{t('prescriptionSettings.title')}</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                {t('prescriptionSettings.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center flex-wrap">
            {/* Auto-save status indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${autoSaveStatus === 'saving' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
              <span>{autoSaveStatus === 'saving' ? t('prescriptionSettings.autoSaving') : t('prescriptionSettings.autoSaved')}</span>
            </div>

            <button
              type="button"
              onClick={handlePrintTest}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] hover:bg-slate-200 dark:hover:bg-white/10 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-white/5"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>{t('prescriptionSettings.testPrint')}</span>
            </button>

            <PermissionGate permission="settings.edit">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-[#08101C] text-xs font-bold shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>{isSaving ? t('action.saving') : t('action.save')}</span>
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-white/5 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'layout'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">dashboard_customize</span>
            <span>{t('prescriptionSettings.margins')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('header')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'header'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">badge</span>
            <span>{t('prescriptionSettings.doctorProfile')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">qr_code_2</span>
            <span>{t('prescriptionSettings.qrCode')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('branches')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'branches'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">apartment</span>
            <span>{t('prescriptionSettings.branches')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('printers')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'printers'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>{t('prescriptionSettings.printers')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Settings Controls (Left 5 Cols) + Live Interactive A5 Canvas (Right 7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Settings Controls Panel */}
        <div className="lg:col-span-5 space-y-5">
          {/* TAB 1: Layout & Margins */}
          {activeTab === 'layout' && (
            <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
                <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-lg">aspect_ratio</span>
                <span>تنسيق الصفحة والهوامش</span>
              </h3>

              {/* Pre-printed Paper Mode Toggle */}
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer font-bold text-amber-900 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={config.preprintedPaperMode}
                    onChange={(e) => setConfig({ ...config, preprintedPaperMode: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 accent-amber-600 focus:ring-0"
                  />
                  <span>وضع الورق المطبوع مسبقاً (المحتوى الطبي فقط)</span>
                </label>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed pr-6">
                  عند تفعيل هذا الخيار، يتم إخفاء الرأس والتذييل تلقائياً لطباعة المحتوى الطبي فقط على الورق المطبوع مسبقاً للعيادة.
                </p>
              </div>

              {/* Header & Footer Toggles */}
              {!config.preprintedPaperMode && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showHeader}
                      onChange={(e) => setConfig({ ...config, showHeader: e.target.checked })}
                      className="w-4 h-4 rounded text-[#00c2cb] accent-[#00c2cb]"
                    />
                    <span className="font-bold">إظهار رأس الروشتة</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showFooter}
                      onChange={(e) => setConfig({ ...config, showFooter: e.target.checked })}
                      className="w-4 h-4 rounded text-[#00c2cb] accent-[#00c2cb]"
                    />
                    <span className="font-bold">إظهار تذييل الروشتة</span>
                  </label>
                </div>
              )}

              {/* Outer Margins */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                  الهوامش الخارجية للصفحة (Outer Margins)
                </label>
                <select
                  value={config.outerMargin}
                  onChange={(e) => setConfig({ ...config, outerMargin: e.target.value as unknown as PrescriptionLayoutSettings['outerMargin'] })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium"
                >
                  <option value="very_tight">شديدة الضيق (2 مم)</option>
                  <option value="tight">ضيقة (4 مم)</option>
                  <option value="normal">عادية قياسية (7 مم)</option>
                  <option value="wide">واسعة (10 مم)</option>
                  <option value="very_wide">شديدة الاتساع (14 مم)</option>
                </select>
              </div>

              {/* Header Top Margin */}
              {!config.preprintedPaperMode && config.showHeader && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                    الهامش العلوي للرأس (Header Top Clearance)
                  </label>
                  <select
                    value={config.headerMarginTop}
                    onChange={(e) => setConfig({ ...config, headerMarginTop: e.target.value as unknown as PrescriptionLayoutSettings['headerMarginTop'] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium"
                  >
                    <option value="very_tight">شديد الضيق (2 مم)</option>
                    <option value="tight">ضيق (4 مم)</option>
                    <option value="balanced">متوازن (7 مم)</option>
                    <option value="wide">واسع (10 مم)</option>
                    <option value="very_wide">شديد الاتساع (14 مم)</option>
                  </select>
                </div>
              )}

              {/* Footer Bottom Margin */}
              {!config.preprintedPaperMode && config.showFooter && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                    الهامش السفلي للتذييل (Footer Bottom Clearance)
                  </label>
                  <select
                    value={config.footerMarginBottom}
                    onChange={(e) => setConfig({ ...config, footerMarginBottom: e.target.value as unknown as PrescriptionLayoutSettings['footerMarginBottom'] })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium"
                  >
                    <option value="very_tight">شديد الضيق (2 مم)</option>
                    <option value="tight">ضيق (4 مم)</option>
                    <option value="balanced">متوازن (7 مم)</option>
                    <option value="wide">واسع (10 مم)</option>
                    <option value="very_wide">شديد الاتساع (14 مم)</option>
                  </select>
                </div>
              )}

              {/* Section Spacing */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                  التباعد بين الأقسام (Section Spacing)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['compact', 'balanced', 'comfortable'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setConfig({ ...config, sectionSpacing: mode })}
                      className={`py-2 rounded-xl border text-center font-bold transition-all ${
                        config.sectionSpacing === mode
                          ? 'bg-teal-50 dark:bg-[#00c2cb]/20 border-teal-500 text-teal-800 dark:text-[#45dee7]'
                          : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {mode === 'compact' ? 'مضغوط' : mode === 'balanced' ? 'متوازن' : 'مريح'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer Font Size */}
              {!config.preprintedPaperMode && config.showFooter && (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                    حجم خط تذييل الروشتة (Footer Font Size)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'regular', 'large'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setConfig({ ...config, footerFontSize: sz })}
                        className={`py-2 rounded-xl border text-center font-bold transition-all ${
                          config.footerFontSize === sz
                            ? 'bg-teal-50 dark:bg-[#00c2cb]/20 border-teal-500 text-teal-800 dark:text-[#45dee7]'
                            : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {sz === 'small' ? 'صغير (8px)' : sz === 'regular' ? 'عادي (10px)' : 'كبير (12px)'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Content Scaling */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                  حجم المحتوى والتصغير التلقائي (Auto Shrink)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['scale_70', 'scale_100', 'auto_shrink'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setConfig({ ...config, contentScale: sc })}
                      className={`py-2 rounded-xl border text-center font-bold transition-all ${
                        config.contentScale === sc
                          ? 'bg-teal-50 dark:bg-[#00c2cb]/20 border-teal-500 text-teal-800 dark:text-[#45dee7]'
                          : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {sc === 'scale_70' ? '70% مكثف' : sc === 'scale_100' ? '100% قياسي' : 'تصغير تلقائي'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Doctor Info & Logo */}
          {activeTab === 'header' && (
            <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
                <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-lg">person_pin</span>
                <span>بيانات الطبيب وشعار العيادة</span>
              </h3>

              {/* Doctor Name AR */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">اسم الطبيب (عربي)</label>
                <input
                  type="text"
                  value={config.doctorName}
                  onChange={(e) => setConfig({ ...config, doctorName: e.target.value })}
                  placeholder="مثال: د. أحمد سليمان"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium"
                />
              </div>

              {/* Doctor Name EN */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">اسم الطبيب (إنجليزية - English Name)</label>
                <input
                  type="text"
                  value={config.doctorNameEn}
                  onChange={(e) => setConfig({ ...config, doctorNameEn: e.target.value })}
                  placeholder="Dr. Hazem El-Kady"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium text-left"
                  dir="ltr"
                />
              </div>

              {/* Specialty Top (AR) */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">التخصص المكتوب أعلى الروشتة (عربي)</label>
                <input
                  type="text"
                  value={config.specialtyAr}
                  onChange={(e) => setConfig({ ...config, specialtyAr: e.target.value })}
                  placeholder="استشاري الباطنة والقلب والسكر"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium"
                />
              </div>

              {/* Specialty Top (EN) */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">التخصص بالإنجليزية (English Title)</label>
                <input
                  type="text"
                  value={config.specialtyEn}
                  onChange={(e) => setConfig({ ...config, specialtyEn: e.target.value })}
                  placeholder="Consultant of Internal Medicine & Cardiology"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium text-left"
                  dir="ltr"
                />
              </div>

              {/* Degrees (AR) */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">المؤهلات والدرجات العلمية (عربي)</label>
                <input
                  type="text"
                  value={config.degreesAr}
                  onChange={(e) => setConfig({ ...config, degreesAr: e.target.value })}
                  placeholder="دكتوراه الباطنة العامة - جامعة القاهرة • زميل الكلية الملكية للأطباء"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium"
                />
              </div>

              {/* Degrees (EN) */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">المؤهلات والدرجات العلمية بالإنجليزية (English Degrees)</label>
                <input
                  type="text"
                  value={config.degreesEn}
                  onChange={(e) => setConfig({ ...config, degreesEn: e.target.value })}
                  placeholder="M.D., MRCP (London) • Cairo University"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium text-left"
                  dir="ltr"
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">رقم التواصل المكتوب بالروشتة</label>
                <input
                  type="text"
                  value={config.phone}
                  onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                  placeholder="01092847162"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono"
                />
              </div>

              {/* Clinic Logo */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">شعار العيادة (Clinic Logo)</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold">
                    <input
                      type="checkbox"
                      checked={config.showLogo}
                      onChange={(e) => setConfig({ ...config, showLogo: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-[#00c2cb] accent-[#00c2cb]"
                    />
                    <span>إظهار الشعار بالروشتة</span>
                  </label>
                </div>

                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5">
                  {config.logoUrl ? (
                    <div className="relative group shrink-0">
                      <img
                        src={config.logoUrl}
                        alt="شعار العيادة"
                        className="w-14 h-14 object-contain rounded-xl bg-white p-1 border border-slate-200 shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, logoUrl: null })}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs shadow-md"
                        title="حذف الشعار"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-400 flex flex-col items-center justify-center text-[10px] text-center p-1 font-medium">
                      <span>لا يوجد شعار</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-1.5">
                    <label className="inline-block px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-[#00c2cb]/20 text-teal-800 dark:text-[#45dee7] font-bold text-xs cursor-pointer hover:bg-teal-100 dark:hover:bg-[#00c2cb]/30 transition-all">
                      <span>رفع شعار جديد (PNG / JPG)</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      يفضل استخدام شعار بخلفية شفافة PNG وأبعاد مربعة 512×512
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QR Code */}
          {activeTab === 'qr' && (
            <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
                <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-lg">qr_code_scanner</span>
                <span>إعدادات رمز الاستجابة السريعة (QR Code)</span>
              </h3>

              {/* Show QR Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/10 border border-teal-200 dark:border-[#00c2cb]/20 cursor-pointer font-bold text-teal-900 dark:text-[#45dee7]">
                <input
                  type="checkbox"
                  checked={config.showQr}
                  onChange={(e) => setConfig({ ...config, showQr: e.target.checked })}
                  className="w-4 h-4 rounded text-[#00c2cb] accent-[#00c2cb]"
                />
                <span>☑ إظهار QR Code في الروشتة المطبوعة</span>
              </label>

              {config.showQr && (
                <div className="space-y-4 pt-1">
                  {/* QR Link Type */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">نوع الرابط الموجه إليه الـ QR</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, qrType: 'whatsapp' })}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                          config.qrType === 'whatsapp'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">chat</span>
                        <span>محادثة الواتساب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, qrType: 'booking' })}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                          config.qrType === 'booking'
                            ? 'bg-teal-50 dark:bg-[#00c2cb]/20 border-teal-500 text-teal-800 dark:text-[#45dee7]'
                            : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">calendar_month</span>
                        <span>صفحة هبوط الحجز</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, qrType: 'custom' })}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                          config.qrType === 'custom'
                            ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-500 text-purple-800 dark:text-purple-300'
                            : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">link</span>
                        <span>رابط مخصص</span>
                      </button>
                    </div>
                  </div>

                  {/* Input based on type */}
                  {config.qrType === 'whatsapp' ? (
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                        رقم WhatsApp للعيادة أو الاستقبال
                      </label>
                      <input
                        type="text"
                        value={config.qrWhatsappPhone}
                        onChange={(e) => setConfig({ ...config, qrWhatsappPhone: e.target.value })}
                        placeholder="01092847162"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        الرابط المتولد: <span className="font-mono text-teal-600 dark:text-[#45dee7]">{getEffectiveQrLink()}</span>
                      </p>
                    </div>
                  ) : config.qrType === 'booking' ? (
                    <div className="space-y-1 p-3 rounded-xl bg-teal-50/50 dark:bg-[#00c2cb]/10 border border-teal-200 dark:border-[#00c2cb]/20">
                      <label className="font-bold text-slate-800 dark:text-slate-200 block mb-0.5">
                        رابط صفحة هبوط الحجز المباشر
                      </label>
                      <p className="text-[11px] text-teal-700 dark:text-[#45dee7] font-mono font-bold break-all" dir="ltr">
                        {getEffectiveQrLink()}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        يمكن للمريض مسح هذا الكود مباشرة بالهاتف لفتح صفحة الحجز وحجز الموعد بالفرع والساعة المناسبة.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">الرابط الخارجي (URL)</label>
                        {!isCustomUrlValid && (
                          <span className="text-[10px] font-bold text-rose-500">رابط غير صالح (يجب أن يبدأ بـ http:// أو https://)</span>
                        )}
                      </div>
                      <input
                        type="url"
                        value={config.qrCustomUrl}
                        onChange={(e) => setConfig({ ...config, qrCustomUrl: e.target.value })}
                        placeholder="https://solimedical.com"
                        className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border text-slate-800 dark:text-white font-mono text-left ${
                          isCustomUrlValid ? 'border-slate-200 dark:border-white/10' : 'border-rose-500 focus:border-rose-500'
                        }`}
                        dir="ltr"
                      />
                    </div>
                  )}

                  {/* QR Size */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-[#bbc9ca]">حجم الـ QR المطبوع</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setConfig({ ...config, qrSize: sz })}
                          className={`py-2 rounded-xl border text-center font-bold transition-all ${
                            config.qrSize === sz
                              ? 'bg-teal-50 dark:bg-[#00c2cb]/20 border-teal-500 text-teal-800 dark:text-[#45dee7]'
                              : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {sz === 'small' ? 'صغير (14 مم)' : sz === 'medium' ? 'متوسط (19 مم)' : 'كبير (25 مم)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Branches */}
          {activeTab === 'branches' && (
            <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-lg">apartment</span>
                  <span>فروع العيادة في التذييل</span>
                </h3>

                <button
                  type="button"
                  onClick={handleOpenAddBranch}
                  className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-[#00c2cb]/20 dark:hover:bg-[#00c2cb]/30 text-teal-800 dark:text-[#45dee7] font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  <span>إضافة فرع جديد</span>
                </button>
              </div>

              <div className="space-y-3">
                {config.branches.map((branch, idx) => (
                  <div
                    key={branch.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{branch.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-teal-50 dark:bg-[#00c2cb]/10 text-teal-800 dark:text-[#45dee7]">
                          فرع #{idx + 1}
                        </span>
                      </div>
                      {branch.address && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-slate-400">location_on</span>
                          <span>{branch.address}</span>
                        </div>
                      )}
                      <div className="text-[11px] text-teal-700 dark:text-[#45dee7] font-mono flex items-center gap-1" dir="ltr">
                        <span className="material-symbols-outlined text-[13px] text-teal-600">call</span>
                        <span>{branch.phone}</span>
                      </div>
                      {branch.workingHours ? (
                        <div className="text-[11px] text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-900/30 flex items-center gap-1 font-medium">
                          <span className="material-symbols-outlined text-[13px] text-amber-600 dark:text-amber-400">schedule</span>
                          <span>مواعيد العمل: {branch.workingHours}</span>
                        </div>
                      ) : (
                        <div className="text-[10.5px] text-slate-400 italic">
                          لم يتم إدخال مواعيد العمل (انقر على تعديل لإضافتها)
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditBranch(branch)}
                        className="px-2.5 py-1.5 rounded-lg text-teal-700 dark:text-[#45dee7] bg-teal-50 hover:bg-teal-100 dark:bg-[#00c2cb]/15 dark:hover:bg-[#00c2cb]/25 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="تعديل بيانات ومواعيد عمل الفرع"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveBranch(branch.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                        title="حذف الفرع"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Printers */}
          {activeTab === 'printers' && (
            <div className="bg-white dark:bg-[#111A2E] p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm space-y-4 text-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2.5">
                <span className="material-symbols-outlined text-teal-600 dark:text-[#00c2cb] text-lg">print</span>
                <span>إعدادات طابعات الإيصالات والروشتات</span>
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="font-bold text-slate-700 dark:text-[#bbc9ca] block mb-1">
                    مقاس ورق إيصالات الاستقبال الخزينة:
                  </label>
                  <select
                    value={printerPaper}
                    onChange={(e) => {
                      setPrinterPaper(e.target.value);
                      safeStorage.setItem(StorageKeys.PRINTER_PAPER, e.target.value);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="80mm">طابعة حرارية 80mm (Thermal POS)</option>
                    <option value="58mm">طابعة حرارية 58mm (Mini POS)</option>
                    <option value="a4">طابعة عادية A4</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="autoPrintRx"
                    checked={autoPrintReceipt}
                    onChange={(e) => {
                      setAutoPrintReceipt(e.target.checked);
                      safeStorage.setItem(StorageKeys.AUTO_PRINT, String(e.target.checked));
                    }}
                    className="w-4 h-4 rounded text-[#00c2cb] accent-[#00c2cb] cursor-pointer"
                  />
                  <label htmlFor="autoPrintRx" className="font-bold text-slate-800 dark:text-[#dde2f5] cursor-pointer">
                    طباعة إيصال السداد تلقائياً عند تأكيد حضور المريض بالاستقبال
                  </label>
                </div>

                <div className="p-3.5 rounded-xl bg-teal-50/50 dark:bg-[#00c2cb]/10 border border-teal-200/50 dark:border-[#00c2cb]/20 text-xs leading-relaxed text-teal-900 dark:text-teal-200">
                  <span className="font-bold block mb-1">💡 ملحوظة طباعة الروشتة:</span>
                  يتم طباعة الروشتة الطبية بقياس A5 (أو A4) تلقائياً مع مراعاة كافة الهوامش والشعار وإعدادات رأس وتذييل الصفحة المحددة في مصمم الروشتة.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live A5 Canvas Preview Panel (Right 7 Cols) */}
        <div className="lg:col-span-7 flex flex-col items-center w-full">
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 px-1 bg-slate-50 dark:bg-[#111A2E] p-3 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00c2cb] text-base">visibility</span>
              <span className="text-xs font-bold text-slate-700 dark:text-[#dde2f5]">معاينة حية لشكل الروشتة (A5)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                148mm × 210mm
              </span>
            </div>

            {/* Quick Action Toolbar for A5 Sheet */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {/* Direct Print Button */}
              <button
                type="button"
                onClick={handlePrintTest}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                title="إرسال أمر الطباعة مباشرة إلى الطابعة المتصلة"
              >
                <span className="material-symbols-outlined text-sm font-bold">print</span>
                <span>طباعة مباشرة</span>
              </button>

              {/* Export PDF Button */}
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 dark:bg-slate-700 dark:hover:bg-slate-600"
                title="تصدير كملف PDF بقياس A5 وأبعاد دقيقة"
              >
                <span className="material-symbols-outlined text-sm text-red-400">picture_as_pdf</span>
                <span>تصدير PDF</span>
              </button>
            </div>
          </div>

          {/* A5 Simulated Sheet */}
          <div
            id="printable-prescription-pad"
            dir="rtl"
            style={{
              padding: MARGIN_VALUES[config.outerMargin] || '7mm',
              paddingTop: config.preprintedPaperMode ? '25mm' : MARGIN_VALUES[config.headerMarginTop] || '7mm',
              paddingBottom: config.preprintedPaperMode ? '20mm' : MARGIN_VALUES[config.footerMarginBottom] || '7mm',
            }}
            className="w-full max-w-[560px] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 min-h-[680px] flex flex-col justify-between transition-all print:m-0 print:border-none print:shadow-none print:w-full print:max-w-none text-right"
          >
            {/* Header Area */}
            {!config.preprintedPaperMode && config.showHeader ? (
              <div className="border-b-2 border-[#00c2cb] pb-3">
                <div className="flex items-start justify-between gap-3">
                  {/* Arabic Doctor Info */}
                  <div className="text-right flex-1">
                    <h2 className="text-base font-bold text-slate-950 leading-tight">
                      {config.doctorName || CLINIC_INFO.doctorName}
                    </h2>
                    <div className="text-xs font-bold text-[#008f97] mt-0.5">
                      {config.specialtyAr || CLINIC_INFO.doctorTitle}
                    </div>
                    <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
                      {config.degreesAr || CLINIC_INFO.doctorCredentials}
                    </div>
                  </div>

                  {/* Logo Center */}
                  {config.showLogo && (
                    <div className="flex flex-col items-center shrink-0">
                      {config.logoUrl ? (
                        <img
                          src={config.logoUrl}
                          alt="Clinic Logo"
                          className="w-11 h-11 object-contain"
                          style={{ width: '44px', height: '44px', maxWidth: '44px', maxHeight: '44px', objectFit: 'contain' }}
                          width={44}
                          height={44}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-950 text-[#00c2cb] flex items-center justify-center font-bold">
                          <span className="material-symbols-outlined text-xl">medical_services</span>
                        </div>
                      )}
                      <span className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                        SOLI CLINIC
                      </span>
                    </div>
                  )}

                  {/* English Info */}
                  <div className="text-left flex-1 hidden sm:block" dir="ltr">
                    <h2 className="text-sm font-bold text-slate-950 leading-tight">
                      {config.doctorNameEn || 'Dr. Hazem El-Kady'}
                    </h2>
                    <div className="text-[11px] font-bold text-[#008f97] mt-0.5">
                      {config.specialtyEn}
                    </div>
                    <div className="text-[10px] text-slate-600 leading-snug mt-0.5">
                      {config.degreesEn}
                    </div>
                  </div>
                </div>
              </div>
            ) : config.preprintedPaperMode ? (
              <div className="text-center text-[10px] text-amber-700 bg-amber-50/60 rounded-md py-1 border border-dashed border-amber-300 print:hidden mb-2">
                وضع الورق المطبوع مسبقاً: مساحة فارغة في الأعلى للرأس
              </div>
            ) : null}

            {/* Patient Meta Strip */}
            {saveSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-2 text-xs font-bold text-center mb-1.5 print:hidden">
                {saveSuccessMsg}
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 my-2.5 text-[11px]">
              {isEditingPatient ? (
                <div className="space-y-2 print:hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم المريض:</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#008f97]"
                        placeholder="اسم المريض بالكامل"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">السن (بالسنوات):</label>
                      <input
                        type="number"
                        value={editAge}
                        onChange={(e) => setEditAge(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-none focus:border-[#008f97]"
                        placeholder="السن"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingPatient(false)}
                      disabled={isSavingPatient}
                      className="px-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePatientName}
                      disabled={isSavingPatient || !editName.trim()}
                      className="px-3 py-1 text-xs rounded bg-[#008f97] hover:bg-[#007b82] text-white font-bold cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      {isSavingPatient ? 'جاري الحفظ...' : 'حفظ ونشر التعديل ✓'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">اسم المريض:</span>
                    <span className="font-bold text-slate-900">{patient ? patient.name : '—'}</span>
                    {patient && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditName(patient.name);
                          setEditAge(patient.age);
                          setIsEditingPatient(true);
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-[#008f97] transition-colors print:hidden cursor-pointer"
                        title="تعديل اسم المريض وبياناته"
                      >
                        <span className="material-symbols-outlined text-[13px]">edit</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">{language === 'en' ? 'Age:' : 'السن:'}</span>
                    <span className="font-bold text-slate-900">{patient ? `${patient.age} ${language === 'en' ? 'yrs' : 'سنة'}` : '—'}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-0.5 font-mono text-slate-900">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-600">{language === 'en' ? 'Date:' : 'التاريخ:'}</span>
                      <span>{formatAppDate(new Date(), undefined, language)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#008f97] font-bold">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      <span>{language === 'en' ? 'Time:' : 'الساعة:'} {formatAppTime(new Date(), language)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Prescription Body */}
            {(() => {
              const previewItemsCount = items && items.length > 0 ? items.length : 2;
              
              let itemPaddingClass = 'p-2';
              let itemGapClass = 'space-y-2';
              let drugTextClass = 'text-xs';
              let instructionTextClass = 'text-[11px]';
              let noteTextClass = 'text-[10px]';
              let diagPaddingClass = 'p-2';
              let diagTextClass = 'text-[11px]';
              let advicePaddingClass = 'p-2';
              let adviceTextClass = 'text-[10px]';

              if (previewItemsCount >= 6) {
                itemPaddingClass = 'p-1 px-1.5';
                itemGapClass = 'space-y-1';
                drugTextClass = 'text-[10.5px] leading-tight';
                instructionTextClass = 'text-[9.5px] leading-tight';
                noteTextClass = 'text-[8.5px] leading-tight';
                diagPaddingClass = 'p-1 px-1.5';
                diagTextClass = 'text-[10px]';
                advicePaddingClass = 'p-1 px-1.5';
                adviceTextClass = 'text-[9.5px]';
              } else if (previewItemsCount >= 4) {
                itemPaddingClass = 'p-1.5 px-2';
                itemGapClass = 'space-y-1.5';
                drugTextClass = 'text-[11px] leading-tight';
                instructionTextClass = 'text-[10px] leading-tight';
                noteTextClass = 'text-[9px] leading-tight';
                diagPaddingClass = 'p-1.5 px-2';
                diagTextClass = 'text-[10.5px]';
                advicePaddingClass = 'p-1.5 px-2';
                adviceTextClass = 'text-[10px]';
              }

              return (
                <div
                  className={`flex-1 space-y-2.5 py-1 ${
                    config.sectionSpacing === 'compact'
                      ? 'space-y-1.5'
                      : config.sectionSpacing === 'comfortable'
                      ? 'space-y-4'
                      : 'space-y-2.5'
                  }`}
                >
                  {/* Diagnosis Banner - now strictly placed ON TOP of treatments, strictly LTR and in English as requested */}
                  <div dir="ltr" className={`${diagPaddingClass} rounded-lg bg-slate-50/90 border border-slate-200 text-slate-800 text-left font-medium ${diagTextClass}`}>
                    <span className="font-bold text-[#008f97]">Diagnosis: </span>
                    <span>{patient?.chronicConditions && patient.chronicConditions.length > 0 ? patient.chronicConditions.join(', ') : 'Essential Hypertension (I10)'}</span>
                  </div>

                  {/* Treatment section with Rx symbol positioned NEXT to the medication list */}
                  <div className="flex items-start gap-3" dir="ltr">
                    {/* Rx Icon Column */}
                    <div className="flex flex-col items-center select-none pt-0.5 shrink-0">
                      <span className="text-3xl font-serif font-black text-[#008f97] italic leading-none">℞</span>
                    </div>

                    {/* Medications List Column */}
                    <div className={`flex-1 ${itemGapClass} text-left`} dir="ltr">
                      {items && items.length > 0 ? (
                        items.map((item, idx) => (
                          <div key={item.id || idx} className={`${itemPaddingClass} rounded-lg bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-2`}>
                            <div className={drugTextClass}>
                              <div className="font-bold text-slate-900">
                                {idx + 1}. {item.drugName} {item.strength || ''} {item.dosageForm || ''} {item.scientificName ? `(${item.scientificName})` : ''}
                              </div>
                              <div className={`text-teal-700 font-medium ${instructionTextClass}`}>
                                {item.dosageInstructions || item.dosage || ''} {item.timing ? `• ${item.timing}` : ''} {item.duration ? `• لمدة ${item.duration}` : ''}
                              </div>
                              {item.notes && (
                                <div className={`text-slate-500 italic mt-0.5 ${noteTextClass}`}>توجيهات إضافية: {item.notes}</div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className={`${itemPaddingClass} rounded-lg bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-2`}>
                            <div className={drugTextClass}>
                              <div className="font-bold text-slate-900">1. Nexium 40 mg Tab. (Esomeprazole)</div>
                              <div className={`text-teal-700 font-medium ${instructionTextClass}`}>قرص واحد قبل الإفطار بنصف ساعة • لمدة 30 يوماً</div>
                            </div>
                          </div>

                          <div className={`${itemPaddingClass} rounded-lg bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-2`}>
                            <div className={drugTextClass}>
                              <div className="font-bold text-slate-900">2. Concor 5 Plus Tab. (Bisoprolol / HCTZ)</div>
                              <div className={`text-teal-700 font-medium ${instructionTextClass}`}>قرص واحد صباحاً بعد الإفطار • مستمر</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sample Advice */}
                  <div className={`${advicePaddingClass} rounded-lg bg-teal-50/40 border border-teal-100 leading-relaxed ${adviceTextClass}`}>
                    <span className="font-bold">تعليمات طبية:</span> تجنب الأطعمة الدسمة والمقليات، وممارسة رياضة المشي 30 دقيقة يومياً، والمتابعة الدورية.
                  </div>
                </div>
              );
            })()}

            {/* Footer Area */}
            {!config.preprintedPaperMode && config.showFooter ? (
              <div className="border-t-2 border-[#00c2cb] pt-2.5 mt-2">
                <div className="flex items-end justify-between gap-3">
                  {/* Branches & Info */}
                  <div
                    className={`flex-1 space-y-1.5 ${
                      config.footerFontSize === 'small'
                        ? 'text-[8px]'
                        : config.footerFontSize === 'large'
                        ? 'text-[11px]'
                        : 'text-[9.5px]'
                    } text-slate-600`}
                  >
                    {config.branches.map((b, i) => (
                      <div key={b.id || i} className="border-b border-slate-100 last:border-b-0 pb-1 last:pb-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 shrink-0">{b.name}:</span>
                          {b.address && <span className="text-slate-700">{b.address}</span>}
                          {b.phone && <span className="font-mono text-teal-700 font-bold shrink-0" dir="ltr">{b.phone}</span>}
                          {b.workingHours && (
                            <span className="text-slate-600 font-medium inline-flex items-center gap-1">
                              <span className="text-slate-400">•</span>
                              <span className="text-teal-700 font-bold">مواعيد العمل:</span>
                              <span>{b.workingHours}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="text-slate-500 pt-0.5 border-t border-slate-100 mt-1 flex items-center gap-1">
                      <span>رقم الحجز والاستعلام:</span>
                      <span className="font-mono font-bold text-slate-800" dir="ltr">{config.phone}</span>
                    </div>
                  </div>

                  {/* QR Code Render in Footer */}
                  {config.showQr && (
                    <div className="flex flex-col items-center shrink-0">
                      <div
                        style={{
                          width: `${QR_SIZE_PX[config.qrSize] || 72}px`,
                          height: `${QR_SIZE_PX[config.qrSize] || 72}px`,
                        }}
                        className="bg-white p-1 rounded-lg border border-slate-300 shadow-xs flex items-center justify-center"
                      >
                        <QrCodeImage
                          qrType={config.qrType}
                          qrWhatsappPhone={config.qrWhatsappPhone}
                          qrCustomUrl={config.qrCustomUrl}
                          className="w-full h-full text-slate-900"
                        />
                      </div>
                      <span className="text-[7.5px] font-bold text-slate-500 mt-0.5">
                        {config.qrType === 'whatsapp' ? 'واتساب العيادة' : config.qrType === 'booking' ? 'صفحة حجز المواعيد' : 'موقع العيادة'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : config.preprintedPaperMode ? (
              <div className="text-center text-[10px] text-amber-700 bg-amber-50/60 rounded-md py-1 border border-dashed border-amber-300 print:hidden mt-2">
                وضع الورق المطبوع مسبقاً: مساحة فارغة في الأسفل للتذييل
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Add / Edit Branch Modal */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-600">apartment</span>
              <span>{editingBranchId ? 'تعديل بيانات فرع العيادة' : 'إضافة فرع عيادة جديد'}</span>
            </h3>

            <form onSubmit={handleSaveBranch} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">اسم الفرع *</label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="مثال: الفرع الرئيسي - المهندسين"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">العنوان بالتفصيل</label>
                <input
                  type="text"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  placeholder="مثال: 24 شارع سوريا - تقاطع جزيرة العرب"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">رقم الهاتف للتواصل والحجز (اختياري)</label>
                <input
                  type="text"
                  value={newBranchPhone}
                  onChange={(e) => setNewBranchPhone(e.target.value)}
                  placeholder="02-37618920 / 01092847162"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono"
                  dir="ltr"
                />
              </div>

              {/* Days Selection */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">أيام العمل بالفرع *</label>
                <select
                  value={newBranchDays}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewBranchDays(val);
                    const finalHours = computeFinalWorkingHours(val, newCustomBranchDays, newBranchStartTime, newBranchEndTime);
                    setNewBranchHours(finalHours);
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                >
                  {DAY_PRESETS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>

                {newBranchDays === 'أيام مخصصة' && (
                  <input
                    type="text"
                    value={newCustomBranchDays}
                    onChange={(e) => {
                      setNewCustomBranchDays(e.target.value);
                      const finalHours = computeFinalWorkingHours('أيام مخصصة', e.target.value, newBranchStartTime, newBranchEndTime);
                      setNewBranchHours(finalHours);
                    }}
                    placeholder="اكتب أيام العمل بالتفصيل (مثال: السبت والأحد فقط)"
                    className="w-full mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                  />
                )}
              </div>

              {/* Time Slots (Start Time & End Time Dropdowns) */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-teal-50/50 dark:bg-[#00c2cb]/5 border border-teal-200/60 dark:border-[#00c2cb]/20">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    من الساعة (بداية العمل) *
                  </label>
                  <select
                    value={newBranchStartTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewBranchStartTime(val);
                      const finalHours = computeFinalWorkingHours(newBranchDays, newCustomBranchDays, val, newBranchEndTime);
                      setNewBranchHours(finalHours);
                    }}
                    className="w-full px-2 py-2 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                  >
                    {START_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    إلى الساعة (انتهاء العمل) *
                  </label>
                  <select
                    value={newBranchEndTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewBranchEndTime(val);
                      const finalHours = computeFinalWorkingHours(newBranchDays, newCustomBranchDays, newBranchStartTime, val);
                      setNewBranchHours(finalHours);
                    }}
                    className="w-full px-2 py-2 rounded-xl bg-white dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
                  >
                    {END_TIME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Preview of Working Hours Label */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#00c2cb]">info</span>
                <span className="text-[11px] text-slate-700 dark:text-slate-300">
                  مواعيد العمل الناتجة:{' '}
                  <strong className="text-teal-700 dark:text-[#45dee7]">
                    {computeFinalWorkingHours(newBranchDays, newCustomBranchDays, newBranchStartTime, newBranchEndTime)}
                  </strong>
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranchId(null);
                    setShowAddBranchModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer"
                >
                  {editingBranchId ? 'تحديث وحفظ التعديلات' : 'إضافة الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
