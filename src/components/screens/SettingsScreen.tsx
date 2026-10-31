import React, { useState, useEffect, useRef } from 'react';
import {
  RadiologyCatalogItem,
  LabCatalogItem,
  DrugCatalogItem,
  DiagnosisCatalogItem,
  SymptomCatalogItem,
} from '../../types';
import { MedicalCatalogsManager } from '../settings/MedicalCatalogsManager';
import { UserManagementPanel } from '../settings/UserManagementPanel';
import { RecurringTemplatesManager } from '../settings/RecurringTemplatesManager';
import { ChangePasswordCard } from '../settings/ChangePasswordCard';
import { ClinicBranchesPanel } from '../settings/ClinicBranchesPanel';
import { MaintenanceCard } from '../settings/MaintenanceCard';
import { ReadOptCard } from '../settings/ReadOptCard';
import { APP_VERSION } from '../../constants/version';
import { usePermissions } from '../../context/AuthContext';
import { PermissionGate } from '../auth/PermissionGate';
import { loadAlertSettings, saveAlertSettings, playSingleAlertSound, AlertSettings } from '../../utils/alertManager';
import {
  loadExamDisplaySettings,
  saveExamDisplaySettings,
  ExamDisplaySettings,
} from '../../utils/examDisplaySettings';
import { loadRecurringTemplates } from '../../utils/recurringTemplatesManager';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  loadMedicalServices,
  saveMedicalServices,
  addMedicalService,
  removeMedicalService,
  updateMedicalService,
  loadExpenseCategories,
  saveExpenseCategories,
  addExpenseCategory,
  removeExpenseCategory,
  MedicalServiceItem,
  ExpenseCategoryItem,
} from '../../utils/financeManager';
import { db } from '../../services/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { safeStorage, StorageKeys } from '../../services/storage';
import { subscribeToServices, subscribeToExpenseCategories } from '../../services/repositories';

interface ChronicItem {
  id: string;
  name: string;
  category: string;
  color: string;
}

interface VisitTypeItem {
  id: string;
  name: string;
  fee: number;
}

interface SettingsScreenProps {
  presetChronicConditions?: ChronicItem[];
  onAddChronicCondition?: (item: ChronicItem) => void;
  onRemoveChronicCondition?: (id: string) => void;

  radiologyCatalog?: RadiologyCatalogItem[];
  onAddRadiology?: (item: RadiologyCatalogItem) => void;
  onRemoveRadiology?: (id: string) => void;
  onToggleRadiologyFavorite?: (id: string) => void;

  labCatalog?: LabCatalogItem[];
  onAddLab?: (item: LabCatalogItem) => void;
  onRemoveLab?: (id: string) => void;
  onToggleLabFavorite?: (id: string) => void;

  drugCatalog?: DrugCatalogItem[];
  onAddDrug?: (item: DrugCatalogItem) => void;
  onRemoveDrug?: (id: string) => void;
  onToggleDrugFavorite?: (id: string) => void;

  diagnosesCatalog?: DiagnosisCatalogItem[];
  onAddDiagnosis?: (item: DiagnosisCatalogItem) => void;
  onRemoveDiagnosis?: (id: string) => void;
  onToggleDiagnosisFavorite?: (id: string) => void;

  symptomsCatalog?: SymptomCatalogItem[];
  onAddSymptom?: (item: SymptomCatalogItem) => void;
  onRemoveSymptom?: (id: string) => void;

  visitTypesList?: VisitTypeItem[];
  onAddVisitType?: (item: VisitTypeItem) => void;
  onRemoveVisitType?: (id: string) => void;
  onUpdateVisitTypeFee?: (id: string, fee: number) => void;

  onGenerateYearlyDemoData?: () => void;
  onClearAllData?: () => void;
  onClearBrowserVisitsOnly?: () => void;
  onClearAllBrowserAndCloud?: () => Promise<void>;

  patients?: any[];
  appointments?: any[];
  visits?: any[];
  invoices?: any[];
  payments?: any[];
  prescriptions?: any[];
  labOrders?: any[];
  radiologyOrders?: any[];
  followUps?: any[];
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  presetChronicConditions = [],
  onAddChronicCondition = (_item: ChronicItem) => {},
  onRemoveChronicCondition = (_id: string) => {},
  radiologyCatalog = [],
  onAddRadiology = (_item: RadiologyCatalogItem) => {},
  onRemoveRadiology = (_id: string) => {},
  onToggleRadiologyFavorite = (_id: string) => {},
  labCatalog = [],
  onAddLab = (_item: LabCatalogItem) => {},
  onRemoveLab = (_id: string) => {},
  onToggleLabFavorite = (_id: string) => {},
  drugCatalog = [],
  onAddDrug = (_item: DrugCatalogItem) => {},
  onRemoveDrug = (_id: string) => {},
  onToggleDrugFavorite = (_id: string) => {},
  diagnosesCatalog = [],
  onAddDiagnosis = (_item: DiagnosisCatalogItem) => {},
  onRemoveDiagnosis = (_id: string) => {},
  onToggleDiagnosisFavorite = (_id: string) => {},
  symptomsCatalog = [],
  onAddSymptom = (_item: SymptomCatalogItem) => {},
  onRemoveSymptom = (_id: string) => {},
  visitTypesList = [
    { id: 'vt-1', name: 'كشف جديد', fee: 300 },
    { id: 'vt-2', name: 'استشارة / متابعة', fee: 150 },
    { id: 'vt-3', name: 'كشف طوارئ', fee: 400 },
  ],
  onAddVisitType = (_item: VisitTypeItem) => {},
  onRemoveVisitType = (_id: string) => {},
  onUpdateVisitTypeFee = (_id: string, _fee: number) => {},
  onGenerateYearlyDemoData = () => {},
  onClearAllData = () => {},
  onClearBrowserVisitsOnly = () => {},
  onClearAllBrowserAndCloud = async () => {},

  patients = [],
  appointments = [],
  visits = [],
  invoices = [],
  payments = [],
  prescriptions = [],
  labOrders = [],
  radiologyOrders = [],
  followUps = [],
}) => {
  const { hasPermission, assertPermission, role, canDelete, canPerform } = usePermissions();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const isAdmin = role === 'admin';
  const canDeleteSettings = isAdmin || canDelete('system-settings') || canPerform('system-settings', 'delete');
  const canRunMaintenance = isAdmin || role === 'doctor' || canDeleteSettings;
  const [activeSettingsSection, setActiveSettingsSection] = useState<
    'general' | 'catalogs' | 'users'
  >('general');

  // Accordion Collapsible Open States (All folded/collapsed by default)
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({
    language: false,
    branches: false,
    pricing: false,
    password: false,
    services: false,
    expenses: false,
    alerts: false,
    display: false,
    templates: false,
    demoData: false,
    backup: false,
  });

  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isClearingBrowserOnly, setIsClearingBrowserOnly] = useState(false);
  const [isClearingBrowserCloud, setIsClearingBrowserCloud] = useState(false);

  const toggleCard = (key: string) => {
    setOpenCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [deleteConfirmVisitId, setDeleteConfirmVisitId] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<any[]>(loadRecurringTemplates);

  // Dynamic Medical Services & Expense Categories states
  const [medicalServicesList, setMedicalServicesList] = useState<MedicalServiceItem[]>(loadMedicalServices);
  const [expenseCategoriesList, setExpenseCategoriesList] = useState<ExpenseCategoryItem[]>(loadExpenseCategories);

  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState<number>(200);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [deleteConfirmServiceId, setDeleteConfirmServiceId] = useState<string | null>(null);

  const [newExpenseCategoryInput, setNewExpenseCategoryInput] = useState('');
  const [deleteConfirmExpenseCatId, setDeleteConfirmExpenseCatId] = useState<string | null>(null);

  useEffect(() => {
    const handleServicesUpdate = () => setMedicalServicesList(loadMedicalServices());
    const handleExpCatsUpdate = () => setExpenseCategoriesList(loadExpenseCategories());

    window.addEventListener('soli_services_updated', handleServicesUpdate);
    window.addEventListener('soli_expense_categories_updated', handleExpCatsUpdate);

    let unsubServices = () => {};
    let unsubExpCats = () => {};

    if (db) {
      unsubServices = subscribeToServices(
        db,
        (srvs) => {
          if (Array.isArray(srvs) && srvs.length > 0) {
            setMedicalServicesList(srvs as MedicalServiceItem[]);
          }
        },
        (err) => console.warn('Services sync in SettingsScreen:', err)
      );

      unsubExpCats = subscribeToExpenseCategories(
        db,
        (cats) => {
          if (Array.isArray(cats) && cats.length > 0) {
            setExpenseCategoriesList(cats as ExpenseCategoryItem[]);
          }
        },
        (err) => console.warn('Exp cats sync in SettingsScreen:', err)
      );
    }

    return () => {
      window.removeEventListener('soli_services_updated', handleServicesUpdate);
      window.removeEventListener('soli_expense_categories_updated', handleExpCatsUpdate);
      unsubServices();
      unsubExpCats();
    };
  }, []);

  useEffect(() => {
    const loadTemplates = () => {
      setSavedTemplates(loadRecurringTemplates());
    };
    loadTemplates();
    window.addEventListener('soli_templates_updated', loadTemplates);
    return () => {
      window.removeEventListener('soli_templates_updated', loadTemplates);
    };
  }, []);

  // If user cannot view users or is not admin, fallback to general
  useEffect(() => {
    if (activeSettingsSection === 'users' && (!isAdmin || !hasPermission('users.view'))) {
      setActiveSettingsSection('general');
    }
  }, [activeSettingsSection, isAdmin, hasPermission]);

  const [freeFollowupDays, setFreeFollowupDays] = useState<number>(() => {
    const saved = safeStorage.getItem(StorageKeys.FREE_FOLLOWUP_DAYS);
    return saved ? Number(saved) : 14;
  });
  const [alertConfig, setAlertConfig] = useState<AlertSettings>(loadAlertSettings);
  const [examDisplayConfig, setExamDisplayConfig] = useState<ExamDisplaySettings>(loadExamDisplaySettings);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Add Visit Type Modal/Input state
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [newVisitName, setNewVisitName] = useState('');
  const [newVisitFee, setNewVisitFee] = useState<number>(250);

  const handleAddNewVisitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisitName.trim()) return;
    onAddVisitType({
      id: `vt-${Date.now()}`,
      name: newVisitName.trim(),
      fee: Number(newVisitFee) || 0,
    });
    setSavedToast(`تم حفظ وإضافة نوع الزيارة: "${newVisitName.trim()}" تلقائياً ✓`);
    setNewVisitName('');
    setNewVisitFee(250);
    setShowAddVisitModal(false);
    setTimeout(() => setSavedToast(null), 3000);
  };

  const updateExamDisplayConfig = (key: keyof ExamDisplaySettings, value: boolean) => {
    const updated = { ...examDisplayConfig, [key]: value };
    setExamDisplayConfig(updated);
    saveExamDisplaySettings(updated);
    const names: Record<keyof ExamDisplaySettings, string> = {
      showVitals: 'العلامات الحيوية',
      showLabs: 'التحاليل الطبية',
      showRadiology: 'الأشعة والتصوير',
    };
    setSavedToast(
      `تم الحفظ التلقائي: ${value ? 'إظهار' : 'إخفاء'} قسم ${names[key]} ✓`
    );
    setTimeout(() => setSavedToast(null), 2500);
  };

  const updateAlertConfig = (key: keyof AlertSettings, value: boolean) => {
    const updated = { ...alertConfig, [key]: value };
    setAlertConfig(updated);
    saveAlertSettings(updated);
    setSavedToast('تم حفظ وتطبيق إعدادات التنبيهات والأصوات تلقائياً ✓');
    setTimeout(() => setSavedToast(null), 2500);
  };

  const handleUpdateFollowupDays = (days: number) => {
    setFreeFollowupDays(days);
    safeStorage.setItem(StorageKeys.FREE_FOLLOWUP_DAYS, String(days));
    setSavedToast(`تم حفظ مدة الاستشارة (${days} يوم) تلقائياً ✓`);
    setTimeout(() => setSavedToast(null), 2500);
  };

  const handleExportBackup = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        appName: 'Soli Medical Clinic System',
        version: APP_VERSION || 'v2.6.0',
        summary: {
          patientsCount: (patients || []).length,
          appointmentsCount: (appointments || []).length,
          visitsCount: (visits || []).length,
          invoicesCount: (invoices || []).length,
          paymentsCount: (payments || []).length,
          prescriptionsCount: (prescriptions || []).length,
          catalogsCount: (drugCatalog || []).length + (radiologyCatalog || []).length + (labCatalog || []).length,
        },
        patients: patients || [],
        appointments: appointments || [],
        visits: visits || [],
        invoices: invoices || [],
        payments: payments || [],
        prescriptions: prescriptions || [],
        labOrders: labOrders || [],
        radiologyOrders: radiologyOrders || [],
        followUps: followUps || [],
        visitTypes: visitTypesList,
        freeFollowupDays,
        medicalServices: medicalServicesList,
        expenseCategories: expenseCategoriesList,
        alertConfig,
        examDisplayConfig,
        recurringTemplates: savedTemplates,
        radiologyCatalog,
        labCatalog,
        drugCatalog,
        diagnosesCatalog,
        symptomsCatalog,
        chronicConditions: presetChronicConditions,
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `soli_clinic_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      setSavedToast('تم تحميل وتصدير ملف النسخة الاحتياطية JSON بنجاح ✓');
      setTimeout(() => setSavedToast(null), 3000);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تصدير ملف النسخة الاحتياطية.');
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (!data || typeof data !== 'object') {
          throw new Error('ملف JSON غير صالح.');
        }

        if (Array.isArray(data.visitTypes) && data.visitTypes.length > 0) {
          data.visitTypes.forEach((vt: VisitTypeItem) => {
            if (vt.name) onAddVisitType(vt);
          });
        }

        if (typeof data.freeFollowupDays === 'number') {
          setFreeFollowupDays(data.freeFollowupDays);
          safeStorage.setItem(StorageKeys.FREE_FOLLOWUP_DAYS, String(data.freeFollowupDays));
        }

        if (Array.isArray(data.medicalServices) && data.medicalServices.length > 0) {
          saveMedicalServices(data.medicalServices);
          setMedicalServicesList(data.medicalServices);
        }

        if (Array.isArray(data.expenseCategories) && data.expenseCategories.length > 0) {
          saveExpenseCategories(data.expenseCategories);
          setExpenseCategoriesList(data.expenseCategories);
        }

        if (data.alertConfig && typeof data.alertConfig === 'object') {
          setAlertConfig(data.alertConfig);
          saveAlertSettings(data.alertConfig);
        }

        if (data.examDisplayConfig && typeof data.examDisplayConfig === 'object') {
          setExamDisplayConfig(data.examDisplayConfig);
          saveExamDisplaySettings(data.examDisplayConfig);
        }

        if (Array.isArray(data.recurringTemplates) && data.recurringTemplates.length > 0) {
          safeStorage.setJSON(StorageKeys.RECURRING_TEMPLATES, data.recurringTemplates);
          setSavedTemplates(data.recurringTemplates);
          window.dispatchEvent(new Event('soli_templates_updated'));
        }

        if (Array.isArray(data.radiologyCatalog) && data.radiologyCatalog.length > 0) {
          data.radiologyCatalog.forEach((item: RadiologyCatalogItem) => onAddRadiology(item));
        }

        if (Array.isArray(data.labCatalog) && data.labCatalog.length > 0) {
          data.labCatalog.forEach((item: LabCatalogItem) => onAddLab(item));
        }

        if (Array.isArray(data.drugCatalog) && data.drugCatalog.length > 0) {
          data.drugCatalog.forEach((item: DrugCatalogItem) => onAddDrug(item));
        }

        if (Array.isArray(data.diagnosesCatalog) && data.diagnosesCatalog.length > 0) {
          data.diagnosesCatalog.forEach((item: DiagnosisCatalogItem) => onAddDiagnosis(item));
        }

        if (Array.isArray(data.symptomsCatalog) && data.symptomsCatalog.length > 0) {
          data.symptomsCatalog.forEach((item: SymptomCatalogItem) => onAddSymptom(item));
        }

        let restoredRecordsCount = 0;
        if (db && (Array.isArray(data.patients) || Array.isArray(data.visits) || Array.isArray(data.appointments))) {
          const batch = writeBatch(db);
          if (Array.isArray(data.patients)) {
            data.patients.forEach((p: any) => {
              if (p.patientId) {
                batch.set(doc(db, 'patients', p.patientId), p, { merge: true });
                restoredRecordsCount++;
              }
            });
          }
          if (Array.isArray(data.appointments)) {
            data.appointments.forEach((a: any) => {
              if (a.appointmentId) {
                batch.set(doc(db, 'appointments', a.appointmentId), a, { merge: true });
                restoredRecordsCount++;
              }
            });
          }
          if (Array.isArray(data.visits)) {
            data.visits.forEach((v: any) => {
              if (v.visitId) {
                batch.set(doc(db, 'visits', v.visitId), v, { merge: true });
                restoredRecordsCount++;
              }
            });
          }
          if (Array.isArray(data.invoices)) {
            data.invoices.forEach((inv: any) => {
              if (inv.invoiceId) {
                batch.set(doc(db, 'invoices', inv.invoiceId), inv, { merge: true });
                restoredRecordsCount++;
              }
            });
          }
          if (Array.isArray(data.payments)) {
            data.payments.forEach((pay: any) => {
              if (pay.paymentId) {
                batch.set(doc(db, 'payments', pay.paymentId), pay, { merge: true });
                restoredRecordsCount++;
              }
            });
          }
          if (Array.isArray(data.prescriptions)) {
            data.prescriptions.forEach((rx: any) => {
              if (rx.prescriptionId) {
                batch.set(doc(db, 'prescriptions', rx.prescriptionId), rx, { merge: true });
                restoredRecordsCount++;
              }
            });
          }
          await batch.commit();
        }

        const successMsg = restoredRecordsCount > 0
          ? `تم استيراد واستعادة بيانات العيادة (${file.name}) مع ${restoredRecordsCount} سجل بنجاح ✓`
          : `تم استيراد واستعادة إعدادات وأدلة العيادة من (${file.name}) بنجاح ✓`;

        setSavedToast(successMsg);
        setTimeout(() => setSavedToast(null), 3500);
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء استيراد الملف. يرجى التأكد من اختيار ملف JSON صحيح مسبق تصديره.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleTestAlertSound = (type: 'new_visit' | 'call' | 'finish' = 'new_visit') => {
    if (alertConfig.audioEnabled) {
      playSingleAlertSound(type);
    }
    setSavedToast('🔔 تم إطلاق نغمة التنبيه لمرة واحدة للتجربة');
    setTimeout(() => setSavedToast(null), 3000);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      assertPermission('settings.edit', 'حفظ إعدادات العيادة العامة والأسعار');
      saveAlertSettings(alertConfig);
      setSavedToast('تم حفظ كافة إعدادات النظام وتحديث الأسعار والتنبيهات بنجاح ✓');
      setTimeout(() => setSavedToast(null), 3500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ليس لديك صلاحية لتعديل الإعدادات العامة.');
    }
  };

  return (
    <div className="flex flex-col w-full min-w-0 max-w-full overflow-x-hidden pb-16 space-y-5 text-slate-800 dark:text-[#dde2f5]">
      {savedToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-[#18233C] border border-[#10B981] text-emerald-600 dark:text-[#10B981] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in">
          <span className="material-symbols-outlined text-2xl">check_circle</span>
          <span className="text-sm font-bold">{savedToast}</span>
        </div>
      )}

      {/* Top Header & Navigation Tabs */}
      <div className="min-w-0 max-w-full">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#859394] mb-1">
          <span>{language === 'en' ? 'Home' : 'الرئيسية'}</span>
          <span>&gt;</span>
          <span className="text-[#008f97] dark:text-[#00c2cb]">{language === 'en' ? 'System Settings' : 'إعدادات النظام'}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2 shrink-0">
            <span>{language === 'en' ? 'System Settings & Controls' : 'إعدادات النظام والأدلة'}</span>
            <span className="text-xs px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-[#45dee7] border border-teal-500/30 font-mono font-bold">
              {APP_VERSION}
            </span>
          </h1>

          {/* 3 Main Navigation Tabs: System Settings, Catalogs, Users placed directly next to the title */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#111A2E] p-1 rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xs max-w-full overflow-x-auto min-w-0">
            <button
              type="button"
              onClick={() => setActiveSettingsSection('general')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSettingsSection === 'general'
                  ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>{language === 'en' ? 'General Settings & Language' : 'إعدادات النظام واللغة'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSettingsSection('catalogs')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSettingsSection === 'catalogs'
                  ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-base">menu_book</span>
              <span>{language === 'en' ? 'Medical Catalogs' : 'الأدلة والكتالوجات الطبية'}</span>
            </button>

            {isAdmin && (
              <PermissionGate permission="users.view">
                <button
                  type="button"
                  onClick={() => setActiveSettingsSection('users')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSettingsSection === 'users'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">manage_accounts</span>
                  <span>{language === 'en' ? 'Users & Permissions' : 'المستخدمون والصلاحيات'}</span>
                </button>
              </PermissionGate>
            )}
          </div>

          {/* Quick One-Click JSON Backup Button */}
          <button
            type="button"
            onClick={handleExportBackup}
            className="ms-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#00c2cb]/15 hover:bg-[#00c2cb] text-[#008f97] dark:text-[#00c2cb] hover:text-slate-950 border border-[#00c2cb]/30 transition-all cursor-pointer shadow-2xs active:scale-95"
            title="تنزيل نسخة احتياطية كاملة من بيانات وإعدادات العيادة بصيغة JSON بضغطة زر واحدة"
          >
            <span className="material-symbols-outlined text-base">cloud_download</span>
            <span>{language === 'en' ? 'Quick Backup (JSON)' : 'تنزيل نسخة احتياطية (JSON)'}</span>
          </button>
        </div>
      </div>

      {/* USER MANAGEMENT TAB (ADMIN ONLY) */}
      {isAdmin && activeSettingsSection === 'users' && <UserManagementPanel />}

      {/* MEDICAL CATALOGS TAB */}
      {activeSettingsSection === 'catalogs' && (
        <MedicalCatalogsManager
          radiologyCatalog={radiologyCatalog}
          onAddRadiology={onAddRadiology}
          onRemoveRadiology={onRemoveRadiology}
          onToggleRadiologyFavorite={onToggleRadiologyFavorite}
          labCatalog={labCatalog}
          onAddLab={onAddLab}
          onRemoveLab={onRemoveLab}
          onToggleLabFavorite={onToggleLabFavorite}
          drugCatalog={drugCatalog}
          onAddDrug={onAddDrug}
          onRemoveDrug={onRemoveDrug}
          onToggleDrugFavorite={onToggleDrugFavorite}
          diagnosesCatalog={diagnosesCatalog}
          onAddDiagnosis={onAddDiagnosis}
          onRemoveDiagnosis={onRemoveDiagnosis}
          onToggleDiagnosisFavorite={onToggleDiagnosisFavorite}
          symptomsCatalog={symptomsCatalog}
          onAddSymptom={onAddSymptom}
          onRemoveSymptom={onRemoveSymptom}
          presetChronicConditions={presetChronicConditions}
          onAddChronicCondition={onAddChronicCondition}
          onRemoveChronicCondition={onRemoveChronicCondition}
        />
      )}

      {/* SYSTEM SETTINGS TAB (SINGLE COLUMN LAYOUT WITH AUTO-SAVE) */}
      {activeSettingsSection === 'general' && (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-4">
            
            {/* ACCORDION CARD 0: System Language & Translation (لغة النظام والواجهة) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('language')}
                className={`w-full p-5 flex items-center justify-between ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">translate</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>{language === 'en' ? '1. System Language & Localization' : '1. لغة النظام والواجهة (Language)'}</span>
                      <span className="text-[10px] bg-teal-500/10 text-[#008f97] dark:text-[#00c2cb] px-2 py-0.5 rounded-full border border-teal-500/20 font-bold">
                        {language === 'en' ? 'English' : 'العربية'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      {language === 'en'
                        ? 'Switch interface language between Arabic and English with instant RTL/LTR support'
                        : 'التبديل الفوري بين واجهة اللغة العربية والإنجليزية مع دعم كامل للاتجاه والمصطلحات الطبية'}
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.language ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.language && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs">
                  <div className="pt-3">
                    <p className="font-bold text-slate-800 dark:text-[#dde2f5] mb-3">
                      {language === 'en' ? 'Select Active System Language:' : 'اختر لغة واجهة النظام الحالية:'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Arabic Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('ar');
                          setSavedToast('تم تحويل لغة النظام إلى العربية بنجاح ✓');
                          setTimeout(() => setSavedToast(null), 3000);
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex items-start gap-3 cursor-pointer text-right ${
                          language === 'ar'
                            ? 'border-[#00c2cb] bg-[#00c2cb]/10 dark:bg-[#00c2cb]/15 shadow-sm'
                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-[#18233C]/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          language === 'ar' ? 'border-[#00c2cb] bg-[#00c2cb]' : 'border-slate-400'
                        }`}>
                          {language === 'ar' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-[#dde2f5]">العربية (Arabic)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-700 dark:text-[#45dee7] font-bold">الافتراضية RTL</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            واجهة النظام باللغة العربية مع دعم كامل للاتجاه من اليمين لليسار.
                          </p>
                        </div>
                      </button>

                      {/* English Option */}
                      <button
                        type="button"
                        onClick={() => {
                          setLanguage('en');
                          setSavedToast('System language switched to English successfully ✓');
                          setTimeout(() => setSavedToast(null), 3000);
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex items-start gap-3 cursor-pointer text-left ${
                          language === 'en'
                            ? 'border-[#00c2cb] bg-[#00c2cb]/10 dark:bg-[#00c2cb]/15 shadow-sm'
                            : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50/50 dark:bg-[#18233C]/50'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          language === 'en' ? 'border-[#00c2cb] bg-[#00c2cb]' : 'border-slate-400'
                        }`}>
                          {language === 'en' && <span className="w-2 h-2 rounded-full bg-white"></span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-[#dde2f5]">English (الإنجليزية)</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold">LTR Layout</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            Professional English interface with standardized clinical terminology and LTR layout.
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#00c2cb] text-base shrink-0">info</span>
                      <span>
                        {language === 'en'
                          ? 'Note: Switching languages updates navigation, buttons, titles, and system screens immediately. Patient data and clinical notes remain in their original recorded text.'
                          : 'ملاحظة: تغيير لغة النظام يغير فوراً كافة القوائم والأزرار والعناوين في النظام مع الحفاظ التام على بيانات المرضى والملاحظات الطبية المدخلة كما هي.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION CARD: Clinic Branches & Contact Details (فروع العيادة والعناوين وأرقام التواصل) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('branches')}
                className={`w-full p-5 flex items-center justify-between ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">apartment</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>{language === 'en' ? '2. Clinic Branches & Official Contacts' : '2. فروع العيادة والعناوين وأرقام التواصل'}</span>
                      <span className="text-[10px] bg-teal-500/10 text-[#008f97] dark:text-[#00c2cb] px-2 py-0.5 rounded-full border border-teal-500/20 font-bold">
                        {language === 'en' ? 'Branches & WhatsApp' : 'الفروع والواتساب'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      {language === 'en'
                        ? 'Manage clinic branches, addresses, reservation phone numbers, and working hours used in reminders & Rx'
                        : 'إدارة وتعديل فروع العيادة، العناوين الحقيقية، أرقام هواتف تأكيد الحجز ومواعيد العمل المستخدمة في رسائل الواتساب والروشتة'}
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.branches ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.branches && (
                <div className="p-5 pt-2 border-t border-slate-100 dark:border-white/5">
                  <ClinicBranchesPanel />
                </div>
              )}
            </div>

            {/* ACCORDION CARD 2: Visit Pricing & Types (تسعير الكشوفات وأنواع الزيارات) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('pricing')}
                className={`w-full p-5 flex items-center justify-between ${isRTL ? 'text-right' : 'text-left'} cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">price_change</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>{language === 'en' ? '2. Visit Pricing & Types' : '2. تسعير الكشوفات وأنواع الزيارات'}</span>
                      <span className="text-[10px] bg-teal-500/10 text-[#008f97] dark:text-[#00c2cb] px-2 py-0.5 rounded-full border border-teal-500/20 font-bold">
                        {visitTypesList.length} {language === 'en' ? 'types' : 'أنواع زيارات'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      {language === 'en'
                        ? 'Add, remove and edit visit fees (auto-saved and reflected in Reception)'
                        : 'إضافة وحذف وتعديل أسعار الزيارات (يحفظ تلقائياً وينعكس فوراً بصفحة الاستقبال)'}
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.pricing ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.pricing && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs">
                  <div className="flex items-center justify-between pt-3">
                    <span className="font-bold text-slate-800 dark:text-[#dde2f5]">
                      أنواع الزيارات والتذاكر المتاحة بالنظام:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddVisitModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">add_circle</span>
                      <span>إضافة نوع زيارة جديد</span>
                    </button>
                  </div>

                  {/* Visit Types Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {visitTypesList.map((vt, index) => (
                      <div
                        key={`${vt.id}-${index}`}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <span className="font-bold text-slate-900 dark:text-white block truncate text-xs">
                            {vt.name}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-[#859394]">
                            <span>السعر:</span>
                            <input
                              type="number"
                              value={vt.fee}
                              onChange={(e) => {
                                const fee = Number(e.target.value);
                                onUpdateVisitTypeFee(vt.id, fee);
                                setSavedToast(`تم حفظ سعر ${vt.name} (${fee} ج.م) تلقائياً ✓`);
                                setTimeout(() => setSavedToast(null), 2500);
                              }}
                              className="w-20 bg-white dark:bg-[#18233C] px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-xs text-center"
                            />
                            <span>ج.م</span>
                          </div>
                        </div>

                        {canDeleteSettings && visitTypesList.length > 1 && (
                          deleteConfirmVisitId === vt.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 p-1 rounded-lg border border-rose-200 dark:border-rose-900 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onRemoveVisitType(vt.id);
                                  setDeleteConfirmVisitId(null);
                                  setSavedToast(`تم حذف نوع الزيارة "${vt.name}" وحفظ التغيير تلقائياً ✓`);
                                  setTimeout(() => setSavedToast(null), 3000);
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded cursor-pointer transition-all"
                              >
                                تأكيد
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmVisitId(null)}
                                className="px-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-[10px] cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmVisitId(vt.id)}
                              title="حذف نوع الزيارة"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Follow-up Days Rule */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-slate-800 dark:text-white block">
                        مدة المتابعة المسموحة (بالأيام):
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5">
                        أي زيارة مريض خلال هذه الفترة المحددة تعتبر متابعة (تحفظ تلقائياً).
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        value={freeFollowupDays}
                        onChange={(e) => handleUpdateFollowupDays(Number(e.target.value))}
                        className="w-20 bg-white dark:bg-[#18233C] p-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-xs text-center"
                      />
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">يوماً</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION CARD 3: Change Password Card */}
            <ChangePasswordCard
              cardNumber={3}
              isOpen={!!openCards.password}
              onToggle={() => toggleCard('password')}
            />

            {/* ACCORDION CARD 4: Medical Services & Pricing */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('services')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-[#10B981] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">medical_services</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>4. خدمات وبنود الوارد (الخدمات الطبية والتسعير)</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                        {medicalServicesList.length} خدمة طبية
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      تظهر هذه الخدمات في قائمة الفواتير عند تسجيل كشف أو إجراء طبي للمريض (تحفظ تلقائياً)
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.services ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.services && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs">
                  <div className="flex items-center justify-between pt-3">
                    <span className="font-bold text-slate-800 dark:text-[#dde2f5]">
                      الخدمات الطبية المعرفة بنظام الفواتير والتحصيل:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddServiceModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <span className="material-symbols-outlined text-base">add_circle</span>
                      <span>إضافة خدمة طبية جديدة</span>
                    </button>
                  </div>

                  {/* Add Medical Service Modal / Form */}
                  {showAddServiceModal && (
                    <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-[#00c2cb]/10 border border-[#00c2cb]/30 space-y-3 animate-in fade-in">
                      <span className="font-bold text-slate-900 dark:text-[#dde2f5] block">
                        إضافة خدمة طبية جديدة لقائمة الوارد:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <input
                          type="text"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          placeholder="اسم الخدمة (مثال: عمل رسم قلب / خياطة جرح)..."
                          className="sm:col-span-8 bg-white dark:bg-[#18233C] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs focus:outline-none"
                        />
                        <div className="sm:col-span-4 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={newServicePrice}
                            onChange={(e) => setNewServicePrice(Number(e.target.value))}
                            placeholder="السعر (ج.م)"
                            className="w-full bg-white dark:bg-[#18233C] px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-xs text-center focus:outline-none"
                          />
                          <span className="text-xs font-bold text-slate-500 shrink-0">ج.م</span>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddServiceModal(false)}
                          className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newServiceName.trim()) return;
                            const newSrv: MedicalServiceItem = {
                              id: `srv-${Date.now()}`,
                              name: newServiceName.trim(),
                              price: Number(newServicePrice) || 0,
                            };
                            const updated = addMedicalService(newSrv);
                            setMedicalServicesList(updated);
                            setNewServiceName('');
                            setNewServicePrice(200);
                            setShowAddServiceModal(false);
                            setSavedToast(`تمت إضافة الخدمة الطبية "${newSrv.name}" بنجاح ✓`);
                            setTimeout(() => setSavedToast(null), 3000);
                          }}
                          className="px-4 py-1.5 rounded-lg bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs cursor-pointer shadow-xs"
                        >
                          حفظ الخدمة
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Medical Services Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {medicalServicesList.map((srv) => (
                      <div
                        key={srv.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <span className="font-bold text-slate-900 dark:text-white block truncate text-xs">
                            {srv.name}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-[#859394]">
                            <span>السعر:</span>
                            <input
                              type="number"
                              value={srv.price}
                              onChange={(e) => {
                                const newPrice = Number(e.target.value);
                                const updated = updateMedicalService(srv.id, { price: newPrice });
                                setMedicalServicesList(updated);
                              }}
                              className="w-20 bg-white dark:bg-[#18233C] px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold text-xs text-center"
                            />
                            <span>ج.م</span>
                          </div>
                        </div>

                        {canDeleteSettings && (
                          deleteConfirmServiceId === srv.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 p-1 rounded-lg border border-rose-200 dark:border-rose-900 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = removeMedicalService(srv.id);
                                  setMedicalServicesList(updated);
                                  setDeleteConfirmServiceId(null);
                                  setSavedToast(`تم حذف الخدمة الطبية "${srv.name}" بنجاح ✓`);
                                  setTimeout(() => setSavedToast(null), 3000);
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded cursor-pointer transition-all"
                              >
                                تأكيد
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmServiceId(null)}
                                className="px-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-[10px] cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmServiceId(srv.id)}
                              title="حذف الخدمة الطبية"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION CARD 4: Expense Categories (بنود المنصرف - مصروفات العيادة) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('expenses')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-[#ef4444] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">shopping_cart_checkout</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>5. بنود المنصرف (مصروفات العيادة)</span>
                      <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-500/20 font-bold">
                        {expenseCategoriesList.length} بنود مصروفات
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      هذه البنود تظهر في القائمة المنسدلة عند تسجيل مصروف جديد بقسم 'الفواتير والمالية' (تحفظ تلقائياً).
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.expenses ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.expenses && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs">
                  {/* Quick Add Expense Category Row */}
                  <div className="pt-3">
                    <span className="font-bold text-slate-800 dark:text-[#dde2f5] block mb-2">
                      إضافة بند منصرف جديد:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newExpenseCategoryInput}
                        onChange={(e) => setNewExpenseCategoryInput(e.target.value)}
                        placeholder="إضافة بند مصروف جديد (مثال: صيانة أجهزة)..."
                        className="flex-1 bg-white dark:bg-[#18233C] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!newExpenseCategoryInput.trim()) return;
                          const updated = addExpenseCategory(newExpenseCategoryInput.trim());
                          setExpenseCategoriesList(updated);
                          setSavedToast(`تمت إضافة بند المصروف "${newExpenseCategoryInput.trim()}" بنجاح ✓`);
                          setNewExpenseCategoryInput('');
                          setTimeout(() => setSavedToast(null), 3000);
                        }}
                        className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        <span>إضافة</span>
                      </button>
                    </div>
                  </div>

                  {/* List of Defined Expense Categories */}
                  <div className="space-y-2 pt-2">
                    <span className="font-bold text-slate-700 dark:text-[#bbc9ca] block">
                      بنود المصروفات المعتمدة الحالية:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {expenseCategoriesList.map((cat) => (
                        <div
                          key={cat.id || cat.name}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="material-symbols-outlined text-base text-rose-500 shrink-0">
                              receipt_long
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                              {cat.name}
                            </span>
                          </div>

                          {canDeleteSettings && (
                            deleteConfirmExpenseCatId === cat.id ? (
                              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/80 p-1 rounded-lg border border-rose-200 dark:border-rose-900 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = removeExpenseCategory(cat.id);
                                    setExpenseCategoriesList(updated);
                                    setDeleteConfirmExpenseCatId(null);
                                    setSavedToast(`تم حذف بند المصروف "${cat.name}" بنجاح ✓`);
                                    setTimeout(() => setSavedToast(null), 3000);
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded cursor-pointer transition-all"
                                >
                                  تأكيد
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmExpenseCatId(null)}
                                  className="px-1 text-slate-500 hover:text-slate-700 dark:text-slate-400 text-[10px] cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmExpenseCatId(cat.id)}
                                title="حذف بند المصروف"
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                <span className="material-symbols-outlined text-base">delete</span>
                              </button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION CARD 5: Notifications & Sounds (نظام التنبيهات والأصوات المتقدم) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('alerts')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">notifications_active</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>6. نظام التنبيهات والأصوات المتقدم</span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">
                        {alertConfig.audioEnabled ? 'الصوت يعمل ✓' : 'الصوت صامت'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      تخصيص التنبيهات المرئية والصوتية للسكرتارية وغرفة الكشف فور تسجيل المريض (تحفظ تلقائياً)
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.alerts ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.alerts && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs">
                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => handleTestAlertSound('new_visit')}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-amber-500/30 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-base">volume_up</span>
                      <span>تجربة التنبيه والصوت الآن</span>
                    </button>
                  </div>

                  {/* Master Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Audio Master */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-[#008f97] dark:text-[#00c2cb]">volume_up</span>
                            التنبيه الصوتي العام
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              alertConfig.audioEnabled
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {alertConfig.audioEnabled ? 'الصوت يعمل ✓' : 'الصوت متوقف ✕'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                          إصدار صافرة طبية هادئة لمرة واحدة فقط عند كل حدث.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateAlertConfig('audioEnabled', !alertConfig.audioEnabled)}
                        className={`w-full py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          alertConfig.audioEnabled
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
                            : 'bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 shadow-xs'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {alertConfig.audioEnabled ? 'volume_off' : 'volume_up'}
                        </span>
                        <span>{alertConfig.audioEnabled ? 'إيقاف الصوت' : 'تشغيل الصوت'}</span>
                      </button>
                    </div>

                    {/* Visual Master */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-[#008f97] dark:text-[#00c2cb]">visibility</span>
                            التنبيه المرئي المنبثق
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              alertConfig.visualEnabled
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {alertConfig.visualEnabled ? 'المرئي يعمل ✓' : 'المرئي متوقف ✕'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                          إظهار لافتة ملونة أعلى الشاشة فور حدوث أي إجراء.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateAlertConfig('visualEnabled', !alertConfig.visualEnabled)}
                        className={`w-full py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          alertConfig.visualEnabled
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30'
                            : 'bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 shadow-xs'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {alertConfig.visualEnabled ? 'visibility_off' : 'visibility'}
                        </span>
                        <span>{alertConfig.visualEnabled ? 'إيقاف التنبيه المرئي' : 'تشغيل التنبيه المرئي'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Granular event checkboxes */}
                  <div className="space-y-2 pt-2">
                    <h4 className="font-bold text-slate-700 dark:text-[#bbc9ca]">
                      التحكم التفصيلي في الأحداث:
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Event 1 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-teal-500/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold text-xs">
                            1
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">إضافة زيارة جديدة</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={alertConfig.newVisitAudio}
                              onChange={(e) => updateAlertConfig('newVisitAudio', e.target.checked)}
                              className="rounded text-[#00c2cb] accent-[#00c2cb]"
                            />
                            <span>صوت 🔔</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={alertConfig.newVisitVisual}
                              onChange={(e) => updateAlertConfig('newVisitVisual', e.target.checked)}
                              className="rounded text-[#00c2cb] accent-[#00c2cb]"
                            />
                            <span>مرئي 👁️</span>
                          </label>
                        </div>
                      </div>

                      {/* Event 2 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-xs">
                            2
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">دخول مريض للكشف</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={alertConfig.callPatientAudio}
                              onChange={(e) => updateAlertConfig('callPatientAudio', e.target.checked)}
                              className="rounded text-[#00c2cb] accent-[#00c2cb]"
                            />
                            <span>صوت 🔔</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={alertConfig.callPatientVisual}
                              onChange={(e) => updateAlertConfig('callPatientVisual', e.target.checked)}
                              className="rounded text-[#00c2cb] accent-[#00c2cb]"
                            />
                            <span>مرئي 👁️</span>
                          </label>
                        </div>
                      </div>

                      {/* Event 3 */}
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xs">
                            3
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">انتهاء الكشف الطبي</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-white/5">
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={alertConfig.finishExamAudio}
                              onChange={(e) => updateAlertConfig('finishExamAudio', e.target.checked)}
                              className="rounded text-[#00c2cb] accent-[#00c2cb]"
                            />
                            <span>صوت 🔔</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                            <input
                              type="checkbox"
                              checked={alertConfig.finishExamVisual}
                              onChange={(e) => updateAlertConfig('finishExamVisual', e.target.checked)}
                              className="rounded text-[#00c2cb] accent-[#00c2cb]"
                            />
                            <span>مرئي 👁️</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION CARD 6: Examination Display Customization (تخصيص أقسام شاشة الكشف الطبي) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('display')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">view_carousel</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">
                      7. تخصيص أقسام شاشة الكشف الطبي (عرض وإخفاء)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      إظهار أو إخفاء أقسام العلامات الحيوية والتحاليل والأشعة بغرفة الكشف (تحفظ تلقائياً)
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.display ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.display && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 text-xs pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* Toggle 1: Vitals */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-teal-600">vital_signs</span>
                            العلامات الحيوية
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              examDisplayConfig.showVitals
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                            }`}
                          >
                            {examDisplayConfig.showVitals ? 'معروض ✓' : 'مخفي ✕'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                          بطاقة الضغط والنبض والحرارة والوزن
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateExamDisplayConfig('showVitals', !examDisplayConfig.showVitals)}
                        className={`w-full py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          examDisplayConfig.showVitals
                            ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {examDisplayConfig.showVitals ? 'visibility' : 'visibility_off'}
                        </span>
                        <span>{examDisplayConfig.showVitals ? 'إخفاء' : 'إظهار'}</span>
                      </button>
                    </div>

                    {/* Toggle 2: Labs */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-emerald-600">biotechnology</span>
                            التحاليل الطبية
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              examDisplayConfig.showLabs
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                            }`}
                          >
                            {examDisplayConfig.showLabs ? 'معروض ✓' : 'مخفي ✕'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                          بطاقة طلب التحاليل وتسجيل النتائج
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateExamDisplayConfig('showLabs', !examDisplayConfig.showLabs)}
                        className={`w-full py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          examDisplayConfig.showLabs
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {examDisplayConfig.showLabs ? 'visibility' : 'visibility_off'}
                        </span>
                        <span>{examDisplayConfig.showLabs ? 'إخفاء' : 'إظهار'}</span>
                      </button>
                    </div>

                    {/* Toggle 3: Radiology */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-base text-sky-600">radiology</span>
                            الأشعة والتصوير
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              examDisplayConfig.showRadiology
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                            }`}
                          >
                            {examDisplayConfig.showRadiology ? 'معروض ✓' : 'مخفي ✕'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                          بطاقة طلب الأشعة والسونار
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateExamDisplayConfig('showRadiology', !examDisplayConfig.showRadiology)}
                        className={`w-full py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          examDisplayConfig.showRadiology
                            ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                            : 'bg-slate-200 dark:bg-[#18233C] text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {examDisplayConfig.showRadiology ? 'visibility' : 'visibility_off'}
                        </span>
                        <span>{examDisplayConfig.showRadiology ? 'إخفاء' : 'إظهار'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION CARD 7: Recurring Prescription Templates & Clinical Guides (القوائم المتكررة وبروتوكولات الروشتة) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('templates')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-[#d0bcff] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">clinical_notes</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>8. القوائم المتكررة وبروتوكولات الروشتة</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                        {savedTemplates.length} قائمة وبروتوكول
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      إدارة القوائم المتكررة وتعديلها وإضافة قوائم مخصصة أو استدعاؤها من الأدلة والبروتوكولات الطبية
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.templates ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.templates && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 text-xs pt-4 space-y-4">
                  <RecurringTemplatesManager
                    diagnosesCatalog={diagnosesCatalog}
                    drugCatalog={drugCatalog}
                    onNotify={(msg) => {
                      setSavedToast(msg);
                      setTimeout(() => setSavedToast(null), 3500);
                    }}
                  />
                </div>
              )}
            </div>

            {/* ACCORDION CARD 8: Demo Data & Database Management (إدارة البيانات والبيانات التجريبية للتوضيح) */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('demoData')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-[#F59E0B] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">database</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>9. إدارة البيانات والبيانات التجريبية</span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-[#F59E0B] px-2 py-0.5 rounded-full border border-amber-500/20 font-bold">
                        أدوات المطورين والتهيئة
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      توليد بيانات تجريبية للتوضيح، أو تصفير وتهيئة قاعدة بيانات العيادة للاستخدام الفعلي
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.demoData ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.demoData && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-5 text-xs pt-4">
                  
                  {/* Notice Banner */}
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex gap-3">
                    <span className="material-symbols-outlined text-amber-600 dark:text-[#F59E0B] shrink-0 text-xl">info</span>
                    <div className="space-y-1">
                      <span className="font-bold text-slate-800 dark:text-amber-200 block text-xs">بيانات تجريبية للتوضيح:</span>
                      <p className="text-[11px] text-slate-600 dark:text-[#bbc9ca] leading-relaxed">
                        الزيارات والوارد والمنصرف المعروضة الآن أمثلة توضيحية — احذفها قبل الاستخدام الفعلي. يمكنك توليد بيانات لسنة كاملة لتجربة الرسوم البيانية أو مسحها نهائياً.
                      </p>
                    </div>
                  </div>

                  {/* Block 1: Generate & Reset Demo Data */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-800 dark:text-[#dde2f5] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00c2cb]"></span>
                      <span>توليد ومسح البيانات التوضيحية:</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={isGeneratingDemo}
                        onClick={async () => {
                          setIsGeneratingDemo(true);
                          try {
                            await onGenerateYearlyDemoData();
                          } catch (e) {
                            console.error(e);
                          } finally {
                            setIsGeneratingDemo(false);
                          }
                        }}
                        className="p-3.5 rounded-xl border border-[#00c2cb]/30 bg-[#00c2cb]/10 hover:bg-[#00c2cb]/20 text-[#00c2cb] hover:text-[#45dee7] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">auto_awesome</span>
                        <span>{isGeneratingDemo ? 'جاري التوليد...' : 'توليد بيانات تجريبيه سنه كاملة'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isClearingAll}
                        onClick={async () => {
                          if (window.confirm('هل أنت متأكد من رغبتك في مسح كافة البيانات التجريبية والبدء من جديد بالكامل؟')) {
                            setIsClearingAll(true);
                            try {
                              await onClearAllData();
                            } catch (e) {
                              console.error(e);
                            } finally {
                              setIsClearingAll(false);
                            }
                          }
                        }}
                        className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">restart_alt</span>
                        <span>{isClearingAll ? 'جاري المسح...' : 'مسح كل البيانات والبدء من جديد'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Reset & Wipe Data Blocks (Admin or Delete Permission Only) */}
                  {canDeleteSettings && (
                    <>
                      {/* Block 2: Clear Browser Patients, Visits and Invoices */}
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 dark:text-white text-xs flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-blue-500 text-lg">phonelink_erase</span>
                            <span>حذف بيانات المتصفح من ملفات المرضى والزيارات والفواتير</span>
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-[#859394] leading-relaxed">
                            تقوم هذه الميزة بحذف ملفات المرضى، كشف الزيارات، الحجوزات، الفواتير والمدفوعات من ذاكرة المتصفح الحالي فقط، مع بقاء الأدلة الطبية الثابتة وإعدادات وتنسيقات صفحة الروشتة وصفحة الإعدادات كاملة كما هي، ويتم استدعاء وجلب البيانات الرسمية المسجلة على السحابة (Firestore) تلقائياً لتحديث العرض.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isClearingBrowserOnly}
                          onClick={async () => {
                            if (window.confirm('هل تريد حذف ملفات المرضى وكشف الزيارات والفواتير محلياً وإعادة استيراد وجلب البيانات المسجلة على السحابة؟')) {
                              setIsClearingBrowserOnly(true);
                              try {
                                await onClearBrowserVisitsOnly();
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setIsClearingBrowserOnly(false);
                              }
                            }
                          }}
                          className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#18233C] dark:hover:bg-[#242a38] text-slate-700 dark:text-[#dde2f5] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-base">delete_sweep</span>
                          <span>{isClearingBrowserOnly ? 'جاري المسح والاستدعاء...' : 'حذف بيانات المتصفح من المرضى والزيارات والفواتير'}</span>
                        </button>
                      </div>

                      {/* Block 3: Complete Wipe with Heavy Warning */}
                      <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3">
                        <div className="space-y-1">
                          <h4 className="font-bold text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-lg">warning</span>
                            <span>حذف بيانات المرضى والزيارات من السحابة نهائياً</span>
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-[#bbc9ca] leading-relaxed">
                            تحذير هام: سيؤدي هذا الإجراء إلى مسح كافة ملفات وسجلات المرضى، الزيارات، الحجوزات، الفواتير، والمدفوعات بشكل نهائي من المتصفح ومن قاعدة البيانات السحابية (Firestore). سيتم الإبقاء على البيانات الثابتة من الأدلة الطبية (الأدوية، التشخيصات، الفحوصات) وتنسيقات وإعدادات صفحة الروشتة وصفحة الإعدادات لتجنب إعادة ضبط البنية التحتية للعيادة.
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isClearingBrowserCloud}
                          onClick={async () => {
                            const code = 'حذف المرضى والزيارات';
                            const confirmCode = window.prompt(`تحذير أمني هام! هذا الإجراء سيمسح سجلات المرضى والزيارات والفواتير من السحابة والمحلي بالكامل ولن تتمكن من استعادتها.\nلتأكيد الحذف النهائي، اكتب العبارة التالية بدقة في المربع: (${code})`);
                            if (confirmCode === code) {
                              setIsClearingBrowserCloud(true);
                              try {
                                await onClearAllBrowserAndCloud();
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setIsClearingBrowserCloud(false);
                              }
                            } else if (confirmCode !== null) {
                              alert('العبارة التي أدخلتها غير صحيحة. تم إلغاء العملية.');
                            }
                          }}
                          className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-base">delete_forever</span>
                          <span>{isClearingBrowserCloud ? 'جاري مسح المرضى والزيارات من السحابة...' : 'حذف بيانات المرضى والزيارات من السحابة نهائياً'}</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Block 4: Maintenance & Backfill Tools (ترحيل المفاتيح الزمنية dayKey ومؤشرات المرضى ووضع توفير القراءات) */}
                  {canRunMaintenance && (
                    <div className="pt-2 space-y-4">
                      <ReadOptCard />
                      <MaintenanceCard />
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* ACCORDION CARD 10: Cloud Backup & Data Export */}
            <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => toggleCard('backup')}
                className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">cloud_sync</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                      <span>10. النسخ الاحتياطي السحابي وتصدير واستيراد البيانات</span>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/20 font-bold">
                        Firestore Cloud Sync
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
                      تصدير وحفظ أو استيراد واستعادة نسخة احتياطية كاملة من قاعدة بيانات العيادة والإعدادات بصيغة JSON
                    </p>
                  </div>
                </div>
                <span
                  className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
                  style={{ transform: openCards.backup ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  expand_more
                </span>
              </button>

              {openCards.backup && (
                <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 space-y-4 text-xs pt-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-500 text-xl">verified</span>
                      <span className="font-bold text-slate-800 dark:text-[#dde2f5]">
                        المزامنة السحابية الحية (Firestore Cloud Sync) نشطة
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#859394] leading-relaxed">
                      يتم حفظ وتحديث كافة بيانات العيادة والمرضى والزيارات والأدلة الطبية لحظياً بالسحابة المشفرة، مع إمكانية تصدير أو استيراد نسخة احتياطية محلية بصيغة JSON في أي وقت.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="px-4 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">download</span>
                        <span>تصدير وتحميل نسخة احتياطية JSON</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">upload_file</span>
                        <span>استيراد واستعادة ملف نسخة احتياطية JSON</span>
                      </button>

                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        onChange={handleImportBackupFile}
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Interactive Standalone HTML Architecture Map (Archify Standard) */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#00c2cb] text-xl">account_tree</span>
                      <span className="font-bold text-slate-800 dark:text-[#dde2f5]">
                        الخريطة المعمارية والتشغيلية التفاعلية للنظام (Archify Interactive HTML)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#859394] leading-relaxed">
                      صفحة HTML تفاعلية مستقلة بالكامل تعمل بدون إنترنت؛ تشرح دورة المريض، البنية المعمارية والأمان، مخطط علاقات قاعدة البيانات (16 مجموعة)، والدليل التشغيلي للأدوار مع إمكانية تتبع المسارات ومشاركتها.
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <a
                        href={`${import.meta.env.BASE_URL}soli-medical-architecture.html`}
                        download="soli-medical-architecture.html"
                        className="px-4 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <span className="material-symbols-outlined text-base">download</span>
                        <span>تحميل الخريطة التفاعلية المستقلة (HTML)</span>
                      </a>
                      <a
                        href={`${import.meta.env.BASE_URL}soli-medical-architecture.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-[#18233C] dark:hover:bg-[#242a38] text-slate-800 dark:text-[#dde2f5] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                        <span>معاينة الخريطة التفاعلية في المتصفح</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      {/* MODAL: Add New Visit Type */}
      {showAddVisitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00c2cb] text-xl">add_circle</span>
                <span>إضافة نوع زيارة / كشف جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddVisitModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewVisitSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-[#dde2f5]">اسم نوع الزيارة (مثال: كشف استشاري، كشف منزلي)</label>
                <input
                  type="text"
                  required
                  value={newVisitName}
                  onChange={(e) => setNewVisitName(e.target.value)}
                  placeholder="أدخل مسمى الزيارة..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-[#dde2f5]">سعر الزيارة (بالجنية المصري)</label>
                <input
                  type="number"
                  required
                  value={newVisitFee}
                  onChange={(e) => setNewVisitFee(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono font-bold focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddVisitModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold shadow-md cursor-pointer"
                >
                  إضافة وإدراج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
