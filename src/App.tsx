import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import {
  ScreenType,
  AppointmentListItem,
  QueueItem,
  TransactionRecord,
  PatientListItem,
  RadiologyCatalogItem,
  LabCatalogItem,
  DrugCatalogItem,
  DiagnosisCatalogItem,
  SymptomCatalogItem,
  PrescriptionItem,
  LabOrderItem,
  RadiologyOrderItem,
} from './types';
import {
  DEFAULT_CHRONIC_CONDITIONS,
} from './data/previewClinicData';
import {
  DEFAULT_RADIOLOGY_CATALOG,
  DEFAULT_LAB_CATALOG,
  DEFAULT_DRUG_CATALOG,
  DEFAULT_DIAGNOSES_CATALOG,
  DEFAULT_SYMPTOMS_CATALOG,
} from './data/previewMedicalCatalogs';
import {
  INITIAL_USERS,
  INITIAL_DOCTOR_PROFILE,
  INITIAL_CLINIC_LOCATIONS,
  INITIAL_SERVICES,
  INITIAL_PATIENTS,
  INITIAL_APPOINTMENTS,
  INITIAL_VISITS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_FOLLOWUPS,
  INITIAL_PRESCRIPTIONS,
  INITIAL_MEDICATIONS,
  INITIAL_LAB_TESTS,
  INITIAL_LAB_ORDERS,
  INITIAL_RADIOLOGY_TYPES,
  INITIAL_RADIOLOGY_ORDERS,
  INITIAL_DIAGNOSES,
  INITIAL_SYMPTOMS,
  INITIAL_CHRONIC_DISEASES,
  INITIAL_DOCTOR_SETTINGS as INITIAL_DOCTOR_SETTINGS_CANONICAL,
  INITIAL_SYSTEM_SETTINGS as INITIAL_SYSTEM_SETTINGS_CANONICAL,
} from './data/database';
import type {
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
  OrderStatus,
  Diagnosis,
  Symptom,
  ChronicDisease,
  DoctorSettings,
  SystemSettings,
  PrescriptionItemSnapshot,
} from './types/database';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { PatientIntakeScreen } from './components/screens/PatientIntakeScreen';
import { QueueScreen } from './components/screens/QueueScreen';
import { AppointmentsScreen } from './components/screens/AppointmentsScreen';
import { vitalsToVisit } from './utils/vitalsMapper';
import type { VitalsData } from './components/examination/VitalsCard';
import { NewAppointmentModal } from './components/modals/NewAppointmentModal';

const DatabaseInspectorModal = lazy(() =>
  import('./components/database/DatabaseV1InspectorModal').then((m) => ({ default: m.DatabaseInspectorModal }))
);
const ExaminationScreen = lazy(() =>
  import('./components/screens/ExaminationScreen').then((m) => ({ default: m.ExaminationScreen }))
);
const PrescriptionPadScreen = lazy(() =>
  import('./components/screens/PrescriptionPadScreen').then((m) => ({ default: m.PrescriptionPadScreen }))
);
const PatientListItemsScreen = lazy(() =>
  import('./components/screens/PatientFilesScreen').then((m) => ({ default: m.PatientListItemsScreen }))
);
const FinanceScreen = lazy(() =>
  import('./components/screens/FinanceScreen').then((m) => ({ default: m.FinanceScreen }))
);
const SettingsScreen = lazy(() =>
  import('./components/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen }))
);
const ClinicalReportsScreen = lazy(() =>
  import('./components/screens/ClinicalReportsScreen').then((m) => ({ default: m.ClinicalReportsScreen }))
);
const BookingLandingScreen = lazy(() =>
  import('./components/screens/BookingLandingScreen').then((m) => ({ default: m.BookingLandingScreen }))
);
import { db } from './services/firebase';
import { doc, getDoc, deleteDoc, setDoc, collection, getDocs, writeBatch, query, limit, where, type QueryConstraint } from 'firebase/firestore';
import { logoutAccount } from './services/auth';
import { AuthScreen } from './components/AuthScreen';
import { AuthProvider, useAuth, usePermissions } from './context/AuthContext';
import { useLanguage } from './i18n/LanguageContext';
import {
  createAppointmentTransaction,
  checkInAppointmentTransaction,
  registerWalkInTransaction,
  startVisitTransaction,
  completeVisitTransaction,
} from './services/firestoreWorkflows';
import {
  subscribeToPatients,
  subscribeToAppointments,
  subscribeToVisits,
  subscribeToInvoices,
  subscribeToPayments,
  subscribeToPrescriptions,
  subscribeToFollowUps,
  subscribeToLabOrders,
  subscribeToRadiologyOrders,
  subscribeToMedications,
  subscribeToLabTests,
  subscribeToRadiologyTypes,
  subscribeToDiagnoses,
  subscribeToSymptoms,
  subscribeToChronicDiseases,
  subscribeToDoctorProfile,
  subscribeToDoctorSettings,
  subscribeToPrescriptionSettings,
  subscribeToAlertSettings,
  subscribeToVisitTypes,
  subscribeToClinicStatus,
  updateClinicStatusInFirestore,
  subscribeToRecurringTemplates,
  subscribeToLatestAlert,
  publishAlert,
  saveCatalogItem,
  removeCatalogItem,
} from './services/repositories';
import {
  loadAlertSettings,
  setCachedAlertSettings,
  playSingleAlertSound,
  ClinicAlertPayload,
} from './utils/alertManager';
import { safeStorage, StorageKeys } from './services/storage';
import { setCachedRecurringTemplates } from './utils/recurringTemplatesManager';
import { toEnglishDigits, formatAppDate, formatAppTime } from './utils/numberUtils';
import { findBranch } from './utils/clinicBranches';
import { toDayKey, todayKey, addDaysToKey } from './utils/dayKey';
import { buildTransactions } from './utils/buildTransactions';
import { READ_OPT, HOT_DAYS, APPT_PAST_DAYS } from './config/readOpt';
import { subscribeMerged } from './services/repositories/windowed';
import { invalidatePatientHistory } from './services/history';

// Merged full initial reference catalogs combining database.ts and previewMedicalCatalogs.ts
const INITIAL_RADIOLOGY_FULL: RadiologyType[] = (() => {
  const map = new Map<string, RadiologyType>();
  INITIAL_RADIOLOGY_TYPES.forEach((r) => map.set(r.radiologyId, r));
  DEFAULT_RADIOLOGY_CATALOG.forEach((r) => {
    if (!map.has(r.id)) {
      map.set(r.id, {
        radiologyId: r.id,
        nameAr: r.name,
        nameEn: '',
        category: r.category,
        isFavorite: Boolean(r.isFavorite),
        active: r.active !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }
  });
  return Array.from(map.values());
})();

const INITIAL_LAB_FULL: LabTest[] = (() => {
  const map = new Map<string, LabTest>();
  INITIAL_LAB_TESTS.forEach((l) => map.set(l.labTestId, l));
  DEFAULT_LAB_CATALOG.forEach((l) => {
    if (!map.has(l.id)) {
      map.set(l.id, {
        labTestId: l.id,
        nameAr: l.name,
        nameEn: '',
        category: l.category,
        sampleType: l.sampleType || 'دم',
        referenceRange: l.referenceRange || '',
        fastingRequired: Boolean(l.fastingRequired),
        isFavorite: Boolean(l.isFavorite),
        active: l.active !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }
  });
  return Array.from(map.values());
})();

const INITIAL_MEDICATIONS_FULL: Medication[] = (() => {
  const map = new Map<string, Medication>();
  INITIAL_MEDICATIONS.forEach((m) => map.set(m.medicationId, m));
  DEFAULT_DRUG_CATALOG.forEach((d) => {
    if (!map.has(d.id)) {
      map.set(d.id, {
        medicationId: d.id,
        nameAr: d.brandName,
        nameEn: d.brandName,
        genericName: d.genericName || '',
        strength: d.strength || '',
        form: d.form || 'أقراص',
        manufacturer: '',
        source: 'LOCAL',
        category: d.category || 'أدوية العيادة',
        defaultDosage: d.defaultDosage || 'قرص واحد يومياً',
        defaultDuration: d.defaultDuration || 'لمدة 7 أيام',
        defaultTiming: d.defaultTiming || 'بعد الأكل',
        isFavorite: Boolean(d.isFavorite),
        active: d.active !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
    }
  });
  return Array.from(map.values());
})();

const INITIAL_DIAGNOSES_FULL: Diagnosis[] = (() => {
  const map = new Map<string, Diagnosis>();
  INITIAL_DIAGNOSES.forEach((d) => map.set(d.diagnosisId, d));
  DEFAULT_DIAGNOSES_CATALOG.forEach((d) => {
    if (!map.has(d.id)) {
      map.set(d.id, {
        diagnosisId: d.id,
        nameAr: d.nameAr,
        nameEn: d.nameEn || '',
        code: d.code || 'ICD-10',
        codeSystem: 'ICD10',
        category: d.category || 'باطنة عامة',
        isFavorite: Boolean(d.isFavorite),
        active: d.active !== false,
        createdAt: new Date().toISOString(),
      } as any);
    }
  });
  return Array.from(map.values());
})();

const INITIAL_SYMPTOMS_FULL: Symptom[] = (() => {
  const map = new Map<string, Symptom>();
  INITIAL_SYMPTOMS.forEach((s) => map.set(s.symptomId, s));
  DEFAULT_SYMPTOMS_CATALOG.forEach((s) => {
    if (!map.has(s.id)) {
      map.set(s.id, {
        symptomId: s.id,
        nameAr: s.name,
        nameEn: s.name,
        category: s.category || 'شكوى عامة',
        isFavorite: Boolean(s.isFavorite),
        active: s.active !== false,
      } as any);
    }
  });
  return Array.from(map.values());
})();

const INITIAL_CHRONIC_FULL: ChronicDisease[] = (() => {
  const map = new Map<string, ChronicDisease>();
  INITIAL_CHRONIC_DISEASES.forEach((c) => map.set(c.diseaseId, c));
  DEFAULT_CHRONIC_CONDITIONS.forEach((c) => {
    if (!map.has(c.id)) {
      map.set(c.id, {
        diseaseId: c.id,
        nameAr: c.name,
        nameEn: c.name,
        category: c.category || 'أمراض شائعة',
        active: true,
      } as any);
    }
  });
  return Array.from(map.values());
})();

const VALID_SCREENS: ScreenType[] = [
  'dashboard',
  'new-visit',
  'waiting-queue',
  'clinical-exam',
  'upcoming-followups',
  'appointments',
  'patient-records',
  'billing-payments',
  'finance',
  'clinical-reports',
  'prescription-pad',
  'booking-landing',
  'system-settings',
  'settings',
];

function ClinicApp() {
  const { canAccess, allowedScreens, userProfile } = usePermissions();
  const { language, dir, isRTL, t } = useLanguage();

  const [activeScreen, setActiveScreen] = useState<ScreenType>(() => {
    if (typeof window !== 'undefined' && (window.location.hash === '#booking' || window.location.search.includes('page=booking'))) {
      return 'booking-landing';
    }
    const saved = safeStorage.getItem(StorageKeys.ACTIVE_SCREEN) as ScreenType | null;
    if (saved && VALID_SCREENS.includes(saved)) {
      return saved;
    }
    if (allowedScreens && allowedScreens.length > 0 && !allowedScreens.includes('dashboard')) {
      return (allowedScreens[0] as ScreenType) || 'new-visit';
    }
    return 'dashboard';
  });

  // Hash listener for direct #booking navigation
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#booking') {
        setActiveScreen('booking-landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Save active screen to localStorage whenever it changes
  useEffect(() => {
    if (activeScreen) {
      safeStorage.setItem(StorageKeys.ACTIVE_SCREEN, activeScreen);
    }
  }, [activeScreen]);

  // Strict synchronization: if user's permissions change or active screen is unauthorized, redirect immediately
  useEffect(() => {
    if (allowedScreens && allowedScreens.length > 0) {
      if (!canAccess(activeScreen)) {
        const firstPermitted =
          (allowedScreens.find((s) => canAccess(s)) as ScreenType) ||
          (allowedScreens[0] as ScreenType) ||
          'new-visit';
        setActiveScreen(firstPermitted);
        safeStorage.setItem(StorageKeys.ACTIVE_SCREEN, firstPermitted);
      }
    }
  }, [allowedScreens, activeScreen, canAccess]);

  const handleNavigate = (rawScreen: ScreenType | string) => {
    const screen = (rawScreen === 'patients' ? 'patient-records' : rawScreen) as ScreenType;
    if (!canAccess(screen)) {
      console.warn(`[Permissions] Navigation to '${screen}' blocked by user permissions.`);
      const firstPermitted =
        (allowedScreens.find((s) => canAccess(s)) as ScreenType) ||
        (allowedScreens[0] as ScreenType) ||
        'new-visit';
      setActiveScreen(firstPermitted);
      safeStorage.setItem(StorageKeys.ACTIVE_SCREEN, firstPermitted);
      return;
    }
    setActiveScreen(screen);
    safeStorage.setItem(StorageKeys.ACTIVE_SCREEN, screen);
  };

  // Theme state persisted in localStorage and synced with document root class
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = safeStorage.getItem(StorageKeys.THEME);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return 'light';
  });

  useEffect(() => {
    safeStorage.setItem(StorageKeys.THEME, theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };
  // Dynamic Visit Types Pricing State (Persistence in localStorage)
  const [visitTypesList, setVisitTypesList] = useState<{ id: string; name: string; fee: number }[]>(() => {
    const saved = safeStorage.getJSON<{ id: string; name: string; fee: number }[] | null>(StorageKeys.VISIT_TYPES, null);
    if (Array.isArray(saved) && saved.length > 0) {
      const map = new Map<string, { id: string; name: string; fee: number }>();
      saved.forEach((item, index) => {
        if (item && item.name) {
          const nameTrimmed = item.name.trim();
          if (!map.has(nameTrimmed)) {
            const key = item.id || `vt-${index}-${nameTrimmed}`;
            map.set(nameTrimmed, { ...item, id: key, name: nameTrimmed });
          }
        }
      });
      return Array.from(map.values());
    }
    return [
      { id: 'vt-1', name: 'كشف جديد', fee: 300 },
      { id: 'vt-2', name: 'استشارة / متابعة', fee: 150 },
      { id: 'vt-3', name: 'كشف طوارئ', fee: 400 },
    ];
  });

  const handleAddVisitType = (newType: { id: string; name: string; fee: number }) => {
    setVisitTypesList((prev) => {
      const updated = [...prev, newType];
      safeStorage.setJSON(StorageKeys.VISIT_TYPES, updated);
      if (db) {
        import('firebase/firestore').then(({ doc, setDoc }) => {
          setDoc(doc(db!, 'settings', 'visitTypes'), { items: updated }, { merge: true }).catch(() => {});
        });
      }
      return updated;
    });
  };

  const handleRemoveVisitType = (id: string) => {
    setVisitTypesList((prev) => {
      const updated = prev.filter((v) => v.id !== id);
      safeStorage.setJSON(StorageKeys.VISIT_TYPES, updated);
      if (db) {
        import('firebase/firestore').then(({ doc, setDoc }) => {
          setDoc(doc(db!, 'settings', 'visitTypes'), { items: updated }, { merge: true }).catch(() => {});
        });
      }
      return updated;
    });
  };

  const handleUpdateVisitTypeFee = (id: string, fee: number) => {
    setVisitTypesList((prev) => {
      const updated = prev.map((v) => (v.id === id ? { ...v, fee } : v));
      safeStorage.setJSON(StorageKeys.VISIT_TYPES, updated);
      if (db) {
        import('firebase/firestore').then(({ doc, setDoc }) => {
          setDoc(doc(db!, 'settings', 'visitTypes'), { items: updated }, { merge: true }).catch(() => {});
        });
      }
      return updated;
    });
  };

  const handleGenerateYearlyDemoData = async () => {
    try {
      const { generateOneYearDemoData } = await import('./utils/demoDataGenerator');
      await generateOneYearDemoData(db);
      setSyncRetryCounter((c) => c + 1);
      alert('تم توليد بيانات تجريبية متكاملة لمدى سنة كاملة بنجاح! تشمل سجلات المرضى والزيارات الموزعة، الحجوزات، الفواتير، المقبوضات ومصروفات العيادة المتنوعة لتظهر في التقارير والرسوم البيانية بشكل دقيق.');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء توليد البيانات التجريبية.');
    }
  };

  const handleClearAllData = async () => {
    try {
      safeStorage.setItem(StorageKeys.CLINIC_DB_INITIALIZED, 'true');
      safeStorage.setJSON(StorageKeys.CLINIC_EXPENSES, []);
      window.dispatchEvent(new CustomEvent('soli_clinic_expenses_updated'));

      const { clearAllDatabaseCollections } = await import('./utils/demoDataGenerator');
      await clearAllDatabaseCollections(db);
      
      setPatientsCanonical([]);
      setAppointmentsCanonical([]);
      setVisitsCanonical([]);
      setInvoicesCanonical([]);
      setPaymentsCanonical([]);
      setFollowUpsCanonical([]);
      setPrescriptionsCanonical([]);
      setLabOrdersCanonical([]);
      setRadiologyOrdersCanonical([]);
      setActiveExamPatient(null);
      setActivePrescription([]);

      alert('تم مسح سجلات المرضى والزيارات وقوائم الانتظار والمواعيد والفواتير بالكامل والبدء من جديد مع بقاء الإعدادات والأدلة الطبية الثابتة ✓');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء مسح البيانات.');
    }
  };

  const handleClearBrowserVisitsOnly = async () => {
    try {
      safeStorage.setItem(StorageKeys.CLINIC_DB_INITIALIZED, 'true');
      safeStorage.setJSON(StorageKeys.CLINIC_EXPENSES, []);
      window.dispatchEvent(new CustomEvent('soli_clinic_expenses_updated'));

      setPatientsCanonical([]);
      setVisitsCanonical([]);
      setInvoicesCanonical([]);
      setPaymentsCanonical([]);
      setAppointmentsCanonical([]);
      setFollowUpsCanonical([]);
      setPrescriptionsCanonical([]);
      setLabOrdersCanonical([]);
      setRadiologyOrdersCanonical([]);
      setActiveExamPatient(null);
      setActivePrescription([]);

      // Force-reload / Re-fetch the registered database records from Firestore cloud
      setSyncRetryCounter((c) => c + 1);

      alert('تم تفريغ ذاكرة المتصفح محلياً وتحميل البيانات الفعلية الموجودة على السحابة (Firestore) فقط ✓');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء مسح المتصفح وإعادة الاستدعاء.');
    }
  };

  const handleClearAllBrowserAndCloud = async () => {
    try {
      safeStorage.setItem(StorageKeys.CLINIC_DB_INITIALIZED, 'true');
      safeStorage.setJSON(StorageKeys.CLINIC_EXPENSES, []);
      window.dispatchEvent(new CustomEvent('soli_clinic_expenses_updated'));

      const { clearAllDatabaseCollections } = await import('./utils/demoDataGenerator');
      await clearAllDatabaseCollections(db);
      
      setPatientsCanonical([]);
      setAppointmentsCanonical([]);
      setVisitsCanonical([]);
      setInvoicesCanonical([]);
      setPaymentsCanonical([]);
      setFollowUpsCanonical([]);
      setPrescriptionsCanonical([]);
      setLabOrdersCanonical([]);
      setRadiologyOrdersCanonical([]);
      setActiveExamPatient(null);
      setActivePrescription([]);

      alert('تم حذف وتدمير سجلات المرضى والزيارات والمواعيد بالكامل من المتصفح ومن قاعدة بيانات السحابة (Firestore) نهائياً ✓');
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء تدمير ومسح بيانات السحابة.');
    }
  };

  const [activeExamPatient, setActiveExamPatient] = useState<PatientListItem | null>(null);

  // Active Prescription sync state - starts clean
  const [activePrescription, setActivePrescription] = useState<PrescriptionItem[]>([]);

  // =========================================================================
  // SOLI MEDICAL CANONICAL STATE (SINGLE SOURCE OF TRUTH: FIRESTORE)
  // =========================================================================
  const [users] = useState<User[]>(INITIAL_USERS);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile>(INITIAL_DOCTOR_PROFILE);
  const [clinicLocations] = useState<ClinicLocation[]>(INITIAL_CLINIC_LOCATIONS);
  const [services] = useState<ServiceItem[]>(INITIAL_SERVICES);

  const [patientsCanonical, setPatientsCanonical] = useState<Patient[]>([]);
  const [appointmentsCanonical, setAppointmentsCanonical] = useState<Appointment[]>([]);
  const [visitsCanonical, setVisitsCanonical] = useState<Visit[]>([]);
  const [invoicesCanonical, setInvoicesCanonical] = useState<Invoice[]>([]);
  const [paymentsCanonical, setPaymentsCanonical] = useState<Payment[]>([]);
  const [followUpsCanonical, setFollowUpsCanonical] = useState<FollowUp[]>([]);
  const [prescriptionsCanonical, setPrescriptionsCanonical] = useState<Prescription[]>([]);
  const [medicationsCanonical, setMedicationsCanonical] = useState<Medication[]>(INITIAL_MEDICATIONS_FULL);
  const [labTestsCanonical, setLabTestsCanonical] = useState<LabTest[]>(INITIAL_LAB_FULL);
  const [labOrdersCanonical, setLabOrdersCanonical] = useState<LabOrder[]>([]);
  const [radiologyTypesCanonical, setRadiologyTypesCanonical] = useState<RadiologyType[]>(INITIAL_RADIOLOGY_FULL);
  const [radiologyOrdersCanonical, setRadiologyOrdersCanonical] = useState<RadiologyOrder[]>([]);
  const [diagnosesCanonical, setDiagnosesCanonical] = useState<Diagnosis[]>(INITIAL_DIAGNOSES_FULL);
  const [symptomsCanonical, setSymptomsCanonical] = useState<Symptom[]>(INITIAL_SYMPTOMS_FULL);
  const [chronicDiseasesCanonical, setChronicDiseasesCanonical] = useState<ChronicDisease[]>(INITIAL_CHRONIC_FULL);
  const [doctorSettingsCanonical, setDoctorSettingsCanonical] = useState<DoctorSettings>(INITIAL_DOCTOR_SETTINGS_CANONICAL);
  const [systemSettingsCanonical] = useState<SystemSettings>(INITIAL_SYSTEM_SETTINGS_CANONICAL);

  // Keep activeExamPatient in sync with real-time patient canonical changes
  useEffect(() => {
    if (activeExamPatient) {
      const live = patientsCanonical.find((p) => p.patientId === activeExamPatient.id);
      if (live && (live.fullName !== activeExamPatient.name || live.phone !== activeExamPatient.phone || live.address !== activeExamPatient.address)) {
        const birthYear = live.dateOfBirth ? new Date(live.dateOfBirth).getFullYear() : undefined;
        const calculatedAge = birthYear ? Math.max(1, new Date().getFullYear() - birthYear) : activeExamPatient.age;
        setActiveExamPatient((prev) => prev ? {
          ...prev,
          name: live.fullName,
          phone: live.phone || '',
          address: live.address || live.governorate || '',
          age: calculatedAge,
          bloodType: live.bloodType || 'غير محدد',
          bloodGroup: live.bloodType || 'غير محدد',
        } : null);
      }
    }
  }, [patientsCanonical, activeExamPatient]);

  // Auto-seed Firestore catalog references if empty on first-ever install (never seed mock patients/visits)
  useEffect(() => {
    if (!db) return;
    const seedTimer = setTimeout(async () => {
      try {
        const alreadyInitialized = safeStorage.getItem(StorageKeys.CLINIC_DB_INITIALIZED);
        if (alreadyInitialized) {
          return;
        }

        const querySnapshot = await getDocs(query(collection(db, 'medications'), limit(1)));
        if (querySnapshot.empty) {
          console.log('Firestore catalogs empty on first setup. Seeding reference catalogs...');
          const batch = writeBatch(db);
          INITIAL_MEDICATIONS_FULL.forEach((med) => {
            batch.set(doc(db, 'medications', med.medicationId), med);
          });
          INITIAL_LAB_FULL.forEach((lt) => {
            batch.set(doc(db, 'labTests', lt.labTestId), lt);
          });
          INITIAL_RADIOLOGY_FULL.forEach((rt) => {
            batch.set(doc(db, 'radiologyTypes', rt.radiologyId), rt);
          });
          INITIAL_DIAGNOSES_FULL.forEach((diag) => {
            batch.set(doc(db, 'diagnoses', diag.diagnosisId), diag);
          });
          INITIAL_SYMPTOMS_FULL.forEach((sym) => {
            batch.set(doc(db, 'symptoms', sym.symptomId), sym);
          });
          INITIAL_CHRONIC_FULL.forEach((cd) => {
            batch.set(doc(db, 'chronicDiseases', cd.diseaseId), cd);
          });
          await batch.commit();
          safeStorage.setItem(StorageKeys.CLINIC_DB_INITIALIZED, 'true');
          console.log('Reference catalogs successfully seeded to Firestore!');
        } else {
          safeStorage.setItem(StorageKeys.CLINIC_DB_INITIALIZED, 'true');
        }
      } catch (err) {
        console.warn('Error during Firestore catalog seeding:', err);
      }
    }, 1500);
    return () => clearTimeout(seedTimer);
  }, [db]);

  // Real-time Firestore-driven notifications refs & windowed listener readiness
  const previousVisitsMapRef = useRef<Map<string, Visit['status']>>(new Map());
  const isInitialVisitsLoadRef = useRef(true);
  const [visitsReady, setVisitsReady] = useState(false);
  const [dayStamp, setDayStamp] = useState(todayKey());

  useEffect(() => {
    if (!READ_OPT) return;
    const t = setInterval(() => {
      const k = todayKey();
      setDayStamp((prev) => (prev === k ? prev : k));
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // Firestore Realtime Subscriptions (Firestore -> onSnapshot -> Canonical State)
  const [syncRetryCounter, setSyncRetryCounter] = useState(0);

  useEffect(() => {
    if (!db) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    let hasLoadedAny = false;

    if (READ_OPT) {
      setVisitsReady(false);
      isInitialVisitsLoadRef.current = true;
      previousVisitsMapRef.current.clear();
    }

    const onDataSuccess = () => {
      hasLoadedAny = true;
      setSyncStatus('connected');
      setSyncErrorDetails(null);
    };

    const onError = (error: Error) => {
      console.warn('[Firestore realtime notice]', error.message);
      if (!hasLoadedAny) {
        setSyncStatus('error');
        setSyncErrorDetails(error.message || 'تعذر الاتصال بـ Firestore أو هناك قيود صلاحيات.');
      }
    };

    const hotStart = addDaysToKey(dayStamp, -(HOT_DAYS - 1));
    const apptStart = addDaysToKey(dayStamp, -APPT_PAST_DAYS);

    const win = <T extends Record<string, any>>(
      name: string,
      queries: QueryConstraint[][],
      apply: (items: T[]) => void
    ) => subscribeMerged<T>(db, name, queries, (items) => { onDataSuccess(); apply(items); }, onError);

    const operational = READ_OPT
      ? [
          // المرضى: كاملة عمدًا للحفاظ على تسلسل أرقام الملفات والبحث الفوري
          subscribeToPatients(db, (items) => { onDataSuccess(); setPatientsCanonical(items); }, onError),

          win<Appointment>('appointments',
            [[where('scheduledDate', '>=', apptStart)], [where('status', '==', 'SCHEDULED')]],
            setAppointmentsCanonical),

          win<Visit>('visits',
            [[where('dayKey', '>=', hotStart)], [where('status', 'in', ['WAITING', 'IN_PROGRESS'])]],
            (items) => { setVisitsCanonical(items); setVisitsReady(true); }),

          win<Invoice>('invoices',
            [[where('dayKey', '>=', hotStart)], [where('status', 'in', ['UNPAID', 'PARTIALLY_PAID'])]],
            setInvoicesCanonical),

          win<Payment>('payments', [[where('dayKey', '>=', hotStart)]], setPaymentsCanonical),
          win<Prescription>('prescriptions', [[where('dayKey', '>=', hotStart)]], setPrescriptionsCanonical),
          win<FollowUp>('followUps', [[where('status', 'in', ['UPCOMING', 'TODAY', 'OVERDUE'])]], setFollowUpsCanonical),
          win<LabOrder>('labOrders', [[where('dayKey', '>=', hotStart)]], setLabOrdersCanonical),
          win<RadiologyOrder>('radiologyOrders', [[where('dayKey', '>=', hotStart)]], setRadiologyOrdersCanonical),
        ]
      : [
          subscribeToPatients(db, (items) => { onDataSuccess(); setPatientsCanonical(items); }, onError),
          subscribeToAppointments(db, (items) => { onDataSuccess(); setAppointmentsCanonical(items); }, onError),
          subscribeToVisits(db, (items) => { onDataSuccess(); setVisitsCanonical(items); }, onError),
          subscribeToInvoices(db, (items) => { onDataSuccess(); setInvoicesCanonical(items); }, onError),
          subscribeToPayments(db, (items) => { onDataSuccess(); setPaymentsCanonical(items); }, onError),
          subscribeToPrescriptions(db, (items) => { onDataSuccess(); setPrescriptionsCanonical(items); }, onError),
          subscribeToFollowUps(db, (items) => { onDataSuccess(); setFollowUpsCanonical(items); }, onError),
          subscribeToLabOrders(db, (items) => { onDataSuccess(); setLabOrdersCanonical(items); }, onError),
          subscribeToRadiologyOrders(db, (items) => { onDataSuccess(); setRadiologyOrdersCanonical(items); }, onError),
        ];

    const unsubscribers: Array<() => void> = [
      ...operational,
      subscribeToDoctorProfile(db, (profile) => { if (profile) setDoctorProfile(profile); }, onError),
      subscribeToAlertSettings(db, (settings) => { if (settings) setCachedAlertSettings(settings); }, onError),
      subscribeToVisitTypes(db, (types) => {
        if (types && Array.isArray(types) && types.length > 0) {
          const uniqueMap = new Map<string, { id: string; name: string; fee: number }>();
          types.forEach((item, index) => {
            if (item && item.name) {
              const nameTrimmed = item.name.trim();
              if (!uniqueMap.has(nameTrimmed)) {
                uniqueMap.set(nameTrimmed, {
                  id: item.id || `vt-${index}`,
                  name: nameTrimmed,
                  fee: Number(item.fee || 300)
                });
              }
            }
          });
          const deduplicated = Array.from(uniqueMap.values());
          setVisitTypesList(deduplicated);
          localStorage.setItem('soli_visit_types', JSON.stringify(deduplicated));
        }
      }, onError),
    ];

    // Stage secondary catalog and template subscriptions slightly after initial operational render
    let isSubscriptionMounted = true;
    const catalogTimer = setTimeout(() => {
      if (!db || !isSubscriptionMounted) return;
      unsubscribers.push(
        subscribeToMedications(db, (items) => { onDataSuccess(); if (items) setMedicationsCanonical(items); }, onError),
        subscribeToLabTests(db, (items) => { onDataSuccess(); if (items) setLabTestsCanonical(items); }, onError),
        subscribeToRadiologyTypes(db, (items) => { onDataSuccess(); if (items) setRadiologyTypesCanonical(items); }, onError),
        subscribeToDiagnoses(db, (items) => { onDataSuccess(); if (items) setDiagnosesCanonical(items); }, onError),
        subscribeToSymptoms(db, (items) => { onDataSuccess(); if (items) setSymptomsCanonical(items); }, onError),
        subscribeToChronicDiseases(db, (items) => { onDataSuccess(); if (items) setChronicDiseasesCanonical(items); }, onError),
        subscribeToDoctorSettings(db, (settings) => { if (settings) setDoctorSettingsCanonical(settings); }, onError),
        subscribeToRecurringTemplates(db, (templates) => { if (templates) setCachedRecurringTemplates(templates); }, onError),
        subscribeToPrescriptionSettings(db, (settings) => {
          if (settings && Object.keys(settings).length > 0) {
            localStorage.setItem('soli_prescription_settings', JSON.stringify(settings));
            window.dispatchEvent(new Event('soli_prescription_updated'));
            window.dispatchEvent(new Event('storage'));
          }
        }, onError),
      );
    }, 250);

    return () => {
      isSubscriptionMounted = false;
      clearTimeout(catalogTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [syncRetryCounter, READ_OPT ? dayStamp : 'static']);

  // Database Architecture Inspector Modal
  const [isDatabaseInspectorOpen, setIsDatabaseInspectorOpen] = useState(false);

  // =========================================================================
  // DERIVED STATE (Canonical State -> Derived State -> UI)
  // =========================================================================
  const patients: PatientListItem[] = useMemo(() => {
    if (READ_OPT) {
      return [...patientsCanonical]
        .filter((p) => p.hasClinicalFile)
        .sort((a, b) => {
          const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (tB !== tA) return tB - tA;
          return (Number(b.fileNumber) || 0) - (Number(a.fileNumber) || 0);
        })
        .map((p) => {
          const birthYear = p.dateOfBirth ? new Date(p.dateOfBirth).getFullYear() : undefined;
          const created = p.createdAt ? new Date(p.createdAt) : new Date();
          const last = p.lastVisitAt ? new Date(p.lastVisitAt) : undefined;
          return {
            id: p.patientId,
            medicalCode: p.medicalCode || `EG-${p.fileNumber || p.patientId.slice(0, 5)}`,
            fileNumber: p.fileNumber || 1,
            name: p.fullName,
            age: birthYear ? Math.max(1, new Date().getFullYear() - birthYear) : 0,
            gender: p.gender === 'female' ? 'female' : 'male',
            phone: p.phone || '',
            governorate: p.governorate || '',
            address: p.address || p.governorate || '',
            allergies: p.allergies || [],
            chronicConditions: p.chronicDiseases || [],
            bloodType: p.bloodType || 'غير محدد',
            bloodGroup: p.bloodType || 'غير محدد',
            emergencyContact: p.emergencyContact,
            lastVisitDate: last ? formatAppDate(last) : undefined,
            lastVisitTime: last ? formatAppTime(last) : undefined,
            registrationDate: formatAppDate(created),
            registrationTime: formatAppTime(created),
            visitsCount: p.visitsCount || 1,
            totalPaid: 0, // يُحسب عند فتح تفاصيل المريض فقط
            lastDiagnosis: p.lastDiagnosis || '',
          };
        });
    }

    // Clinic Workflow Rule: A patient ONLY appears in Patient Files ("ملفات المرضى")
    // after having their clinical examination completed and their prescription saved!
    // (Prescription saved in prescriptionsCanonical OR Visit marked as COMPLETED)
    const clinicalPatients = patientsCanonical.filter((p) => {
      const hasPrescription = prescriptionsCanonical.some((pr) => pr.patientId === p.patientId);
      const hasCompletedVisit = visitsCanonical.some(
        (v) => v.patientId === p.patientId && v.status === 'COMPLETED'
      );
      return hasPrescription || hasCompletedVisit;
    });

    // Sort canonical patients newest first (by createdAt desc, then fileNumber desc)
    const sortedPatients = [...clinicalPatients].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (Number(b.fileNumber) || 0) - (Number(a.fileNumber) || 0);
    });

    return sortedPatients.map((p) => {
      const pCompletedVisits = visitsCanonical.filter(
        (v) => v.patientId === p.patientId && v.status === 'COMPLETED'
      );
      const pVisits = pCompletedVisits.length > 0 ? pCompletedVisits : visitsCanonical.filter((v) => v.patientId === p.patientId);
      const pPayments = paymentsCanonical.filter((pm) => pm.patientId === p.patientId);
      const totalPaid = pPayments.reduce((acc, pm) => acc + (pm.amount || 0), 0);
      const lastVisit = [...pVisits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const lastDiag = lastVisit?.clinicalData?.diagnosis?.[0] || p.lastDiagnosis || '';
      
      const birthYear = p.dateOfBirth ? new Date(p.dateOfBirth).getFullYear() : undefined;
      const calculatedAge = birthYear ? Math.max(1, new Date().getFullYear() - birthYear) : 0;

      const createdDateObj = p.createdAt ? new Date(p.createdAt) : new Date();
      const registrationDate = formatAppDate(createdDateObj);
      const registrationTime = formatAppTime(createdDateObj);

      return {
        id: p.patientId,
        medicalCode: p.medicalCode || `EG-${p.fileNumber || p.patientId.slice(0, 5)}`,
        fileNumber: p.fileNumber || 1,
        name: p.fullName,
        age: calculatedAge,
        gender: p.gender === 'female' ? 'female' : 'male',
        phone: p.phone || '',
        governorate: p.governorate || '',
        address: p.address || p.governorate || '',
        allergies: p.allergies || [],
        chronicConditions: p.chronicDiseases || [],
        bloodType: p.bloodType || 'غير محدد',
        bloodGroup: p.bloodType || 'غير محدد',
        emergencyContact: p.emergencyContact,
        lastVisitDate: lastVisit ? formatAppDate(lastVisit.createdAt) : undefined,
        lastVisitTime: lastVisit ? formatAppTime(lastVisit.createdAt) : undefined,
        registrationDate,
        registrationTime,
        visitsCount: pCompletedVisits.length || 1,
        totalPaid,
        lastDiagnosis: lastDiag,
      };
    });
  }, [patientsCanonical, visitsCanonical, paymentsCanonical, prescriptionsCanonical]);

  const queue: QueueItem[] = useMemo(() => {
    return visitsCanonical
      .filter((v) => v.status === 'WAITING')
      .sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0))
      .map((v) => {
        const pat = patientsCanonical.find((p) => p.patientId === v.patientId);
        const invoice = invoicesCanonical.find((i) => i.visitId === v.visitId);
        const payment = paymentsCanonical.find((p) => p.visitId === v.visitId);

        const birthYear = pat?.dateOfBirth ? new Date(pat.dateOfBirth).getFullYear() : undefined;
        const calculatedAge = birthYear ? Math.max(1, new Date().getFullYear() - birthYear) : 0;

        return {
          id: v.visitId,
          patientId: v.patientId,
          ticketNumber: `#0${v.queueNumber || 1}`,
          patientName: pat?.fullName || 'مريض غير مسجل',
          medicalCode: pat?.medicalCode || `EG-${v.patientId.replace(/\D/g, '')}`,
          fileNumber: pat?.fileNumber || v.queueNumber || 1,
          phone: pat?.phone || '',
          age: calculatedAge,
          gender: pat?.gender || '',
          address: pat?.address || pat?.governorate || '',
          bloodType: pat?.bloodType || 'غير محدد',
          chronicConditions: pat?.chronicDiseases || v.receptionistData?.chronicDiseases || [],
          visitType: v.visitType === 'NEW' ? 'كشف جديد' : 'استشارة / متابعة',
          arrivalTime: formatAppTime(v.createdAt),
          elapsedMinutes: Math.max(1, Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 60000)),
          paidAmount: payment?.amount || invoice?.paidAmount || 0,
          paymentMethod: (payment?.method === 'CARD' ? 'فيزا / كارت' : payment?.method === 'TRANSFER' ? 'إنستاباي' : 'نقدي') as any,
          complaint: v.receptionistData?.symptoms || 'كشف عيادة باطنة',
          status: 'waiting',
        };
      });
  }, [visitsCanonical, patientsCanonical, invoicesCanonical, paymentsCanonical]);

  const appointments: AppointmentListItem[] = useMemo(() => {
    // Sort canonical appointments newest first
    const sortedAppts = [...appointmentsCanonical].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return (b.scheduledDate || '').localeCompare(a.scheduledDate || '');
    });

    return sortedAppts.map((a) => {
      const pat = patientsCanonical.find((p) => p.patientId === a.patientId);
      const matchingVisitType = visitTypesList.find(
        (vt) => vt.name.trim().toLowerCase() === (a.visitType || '').trim().toLowerCase(),
      );
      const dynamicFee = matchingVisitType
        ? matchingVisitType.fee
        : a.visitType?.includes('استشارة') || a.visitType?.includes('متابعة')
        ? 150
        : 300;
      return {
        id: a.appointmentId,
        patientId: a.patientId,
        appointmentId: a.appointmentId,
        patientName: pat?.fullName || a.patientName || 'مريض محجوز مسبقاً',
        medicalCode: pat?.medicalCode || 'EG-NEW',
        fileNumber: pat?.fileNumber,
        phone: pat?.phone || a.phone || '',
        date: a.scheduledDate,
        time: a.scheduledTime,
        timeSlot: a.scheduledTime || '05:00 م',
        branch: findBranch(a.clinicLocationId || (a as any).branch)?.name || 'العيادة الرئيسية - المهندسين',
        visitType: a.visitType,
        status: a.status === 'ARRIVED' ? 'فى الانتظار حضر المريض' : a.status === 'CANCELLED' ? 'ملغي' : 'مجدول',
        expectedFee: dynamicFee,
        notes: a.notes,
      };
    });
  }, [appointmentsCanonical, patientsCanonical, visitTypesList]);

  const transactions: TransactionRecord[] = useMemo(
    () => buildTransactions({ payments: paymentsCanonical, invoices: invoicesCanonical, patients: patientsCanonical }),
    [paymentsCanonical, invoicesCanonical, patientsCanonical]
  );

  // Catalogs derived
  const presetChronicConditions = useMemo(() => {
    return chronicDiseasesCanonical.map((c) => ({
      id: c.diseaseId,
      name: c.nameAr || c.nameEn || 'مرض مزمن',
      category: c.category || 'أمراض شائعة',
      color: (c as any).color || 'bg-teal-500',
    }));
  }, [chronicDiseasesCanonical]);

  const drugCatalog: DrugCatalogItem[] = useMemo(() => {
    return medicationsCanonical.map((m) => ({
      id: m.medicationId,
      brandName: m.nameAr || m.nameEn || 'دواء',
      genericName: m.genericName || '',
      strength: m.strength || '',
      form: m.form || 'أقراص',
      category: (m as any).category || 'أدوية العيادة',
      defaultDosage: (m as any).defaultDosage || (m as any).defaultDose || 'قرص واحد يومياً',
      defaultDuration: (m as any).defaultDuration || 'لمدة 7 أيام',
      defaultTiming: (m as any).defaultTiming || 'بعد الأكل',
      isFavorite: Boolean((m as any).isFavorite),
      active: m.active !== false,
      notes: (m as any).notes || '',
    }));
  }, [medicationsCanonical]);

  const labCatalog: LabCatalogItem[] = useMemo(() => {
    return labTestsCanonical.map((l) => ({
      id: l.labTestId,
      name: l.nameAr || l.nameEn || 'تحليل',
      category: l.category || 'تحاليل عامة',
      sampleType: l.sampleType || 'دم',
      referenceRange: l.referenceRange || '',
      unit: (l as any).unit || '',
      fastingRequired: Boolean(l.fastingRequired),
      isFavorite: Boolean((l as any).isFavorite),
      active: l.active !== false,
    }));
  }, [labTestsCanonical]);

  const radiologyCatalog: RadiologyCatalogItem[] = useMemo(() => {
    return radiologyTypesCanonical.map((r) => ({
      id: r.radiologyId,
      name: r.nameAr || r.nameEn || 'أشعة',
      category: r.category || 'أشعة عامة',
      isFavorite: Boolean((r as any).isFavorite),
      active: r.active !== false,
      notes: (r as any).notes || '',
    }));
  }, [radiologyTypesCanonical]);

  const diagnosesCatalog: DiagnosisCatalogItem[] = useMemo(() => {
    return diagnosesCanonical.map((d) => ({
      id: d.diagnosisId,
      nameAr: d.nameAr || 'تشخيص',
      nameEn: d.nameEn || '',
      code: d.code || '',
      category: d.category || 'باطنة عامة',
      isFavorite: Boolean((d as any).isFavorite),
      active: d.active !== false,
    }));
  }, [diagnosesCanonical]);

  const symptomsCatalog: SymptomCatalogItem[] = useMemo(() => {
    return symptomsCanonical.map((s) => ({
      id: s.symptomId,
      name: s.nameAr || 'عرض',
      category: s.category || 'شكوى عامة',
      isFavorite: Boolean((s as any).isFavorite),
      active: s.active !== false,
    }));
  }, [symptomsCanonical]);

  // Modals
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Pre-filled intake data when transitioning from appointment «حضر المريض»
  const [intakeInitialData, setIntakeInitialData] = useState<{
    patientId?: string;
    patientName?: string;
    phone?: string;
    visitType?: string;
    notes?: string;
    appointmentId?: string;
    fee?: number;
    age?: number;
    gender?: 'male' | 'female' | '';
    address?: string;
    bloodType?: string;
    chronicConditions?: string[];
  } | null>(null);

  const handleStartIntakeFromAppointment = (app: AppointmentListItem) => {
    const cleanPhone = (app.phone || '').trim().replace(/[^0-9]/g, '');
    const cleanName = (app.patientName || '').trim().toLowerCase();

    const matchedPatient = patientsCanonical.find((p) => {
      if (app.patientId && p.patientId === app.patientId) return true;
      const pPhone = (p.phone || '').trim().replace(/[^0-9]/g, '');
      const pName = (p.fullName || '').trim().toLowerCase();
      const phoneMatch = cleanPhone.length >= 7 && pPhone.includes(cleanPhone);
      const nameMatch = pName !== '' && cleanName !== '' && pName === cleanName;
      return phoneMatch || nameMatch;
    });

    const calculatedAge = matchedPatient?.dateOfBirth
      ? Math.max(1, new Date().getFullYear() - new Date(matchedPatient.dateOfBirth).getFullYear())
      : undefined;

    setIntakeInitialData({
      patientId: matchedPatient?.patientId || app.patientId,
      patientName: matchedPatient?.fullName || app.patientName,
      phone: matchedPatient?.phone || app.phone,
      visitType: app.visitType,
      notes: app.notes,
      appointmentId: app.id,
      fee: app.expectedFee,
      age: calculatedAge,
      gender: matchedPatient?.gender === 'female' ? 'female' : matchedPatient?.gender === 'male' ? 'male' : undefined,
      address: matchedPatient?.address || matchedPatient?.governorate || undefined,
      bloodType: matchedPatient?.bloodType || undefined,
      chronicConditions: matchedPatient?.chronicDiseases || undefined,
    });
    if (db && app.id) {
      setDoc(doc(db, 'appointments', app.id), { status: 'ARRIVED' }, { merge: true }).catch((err) => {
        console.warn('Failed to update appointment status in Firestore:', err);
      });
    }
    handleNavigate('new-visit');
  };

  // Sound/Announcement banner (Controlled by Settings)
  const [callingBanner, setCallingBanner] = useState<ClinicAlertPayload | null>(null);
  const [alertHistory, setAlertHistory] = useState<ClinicAlertPayload[]>([]);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'offline' | 'syncing' | 'error'>(db ? 'connected' : 'offline');
  const [syncErrorDetails, setSyncErrorDetails] = useState<string | null>(null);
  const [doctorStatus, setDoctorStatus] = useState<'available' | 'break'>('available');
  const recentAlertIdsRef = useRef<Map<string, number>>(new Map());
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightActionsRef = useRef<Set<string>>(new Set());

  const scheduleBannerDismiss = (durationMs = 5000, expectedAlertId?: string) => {
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      setCallingBanner((prev) => {
        if (expectedAlertId && prev && prev.id !== expectedAlertId) return prev;
        return null;
      });
      bannerTimeoutRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);

  const normalizeArabicName = (name?: string | null): string => {
    if (!name) return '';
    return name
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ');
  };

  const normalizePhoneDigits = (phone?: string | null): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0020')) return digits.slice(3);
    if (digits.startsWith('20') && digits.length === 12) return `0${digits.slice(2)}`;
    return digits;
  };

  const findMatchingPatient = (criteria: { patientId?: string; phone?: string; fullName?: string }): Patient | undefined => {
    if (criteria.patientId) {
      const byId = patientsCanonical.find((p) => p.patientId === criteria.patientId);
      if (byId) return byId;
    }
    const targetPhone = normalizePhoneDigits(criteria.phone);
    if (targetPhone.length >= 8) {
      const byPhone = patientsCanonical.find((p) => normalizePhoneDigits(p.phone) === targetPhone);
      if (byPhone) return byPhone;
    }
    const targetName = normalizeArabicName(criteria.fullName);
    if (targetName) {
      const byName = patientsCanonical.find((p) => normalizeArabicName(p.fullName) === targetName);
      if (byName) return byName;
    }
    return undefined;
  };

  const registerAlert = (alertItem: ClinicAlertPayload, options?: { skipPublish?: boolean }) => {
    const now = Date.now();
    const seen = recentAlertIdsRef.current;
    for (const [k, t] of seen) if (now - t > 60_000) seen.delete(k);
    if (seen.has(alertItem.id)) return;
    seen.set(alertItem.id, now);

    setCallingBanner(alertItem);
    setAlertHistory((prev) => [alertItem, ...prev.filter((a) => a.id !== alertItem.id)].slice(0, 20));

    if (!options?.skipPublish) {
      // 1. Instant cross-tab sync via BroadcastChannel
      try {
        const alertChannel = new BroadcastChannel('soli_clinic_alerts_channel');
        alertChannel.postMessage({
          type: 'CLINIC_ALERT',
          alert: alertItem,
          senderId: userProfile?.username || 'user',
        });
        alertChannel.close();
      } catch {}

      // 2. Real-time multi-device Firestore synchronization for secretary/doctor
      if (db) {
        publishAlert(db, {
          id: alertItem.id,
          type: alertItem.type,
          title: alertItem.title,
          message: alertItem.message,
          ticket: alertItem.ticket,
          timestamp: alertItem.timestamp,
          patientId: alertItem.patientId,
          visitId: alertItem.visitId,
          senderId: userProfile?.username || 'user',
        }).catch((err) => console.warn('Alert publish notice:', err));
      }
    }
  };

  const handleDismissAlert = (alertId: string) => {
    setAlertHistory((prev) => prev.filter((a) => a.id !== alertId));
    setCallingBanner((prev) => (prev?.id === alertId ? null : prev));
  };

  const handleClearAllAlerts = () => {
    setAlertHistory([]);
    setCallingBanner(null);
  };

  // Real-time synchronization of Doctor/Clinic Break Status across all connected accounts via Firestore & BroadcastChannel
  const isInitialClinicStatusRef = useRef(true);
  const lastClinicStatusRef = useRef<'available' | 'break'>('available');

  const triggerDoctorStatusAlert = (
    newStatus: 'available' | 'break',
    updatedBy?: string,
    statusKey?: string | number,
    options?: { skipPublish?: boolean }
  ) => {
    const alertConfig = loadAlertSettings();
    const resolvedKey = statusKey != null && String(statusKey).trim() !== ''
      ? String(statusKey)
      : String(Math.floor(Date.now() / 10000));

    if (newStatus === 'break') {
      if (alertConfig.audioEnabled) {
        playSingleAlertSound('call');
      }
      if (alertConfig.visualEnabled) {
        const alertId = `break-${resolvedKey}`;
        registerAlert({
          id: alertId,
          type: 'call',
          title: 'تنبيه: الطبيب في فترة استراحة ☕',
          message: `أعلن (${updatedBy || 'الطبيب'}) بدء فترة استراحة مؤقتة. يرجى التوقف عن تحويل المرضى لغرفة الكشف.`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        }, options);
        scheduleBannerDismiss(6000, alertId);
      }
    } else {
      if (alertConfig.audioEnabled) {
        playSingleAlertSound('finish');
      }
      if (alertConfig.visualEnabled) {
        const alertId = `avail-${resolvedKey}`;
        registerAlert({
          id: alertId,
          type: 'new_visit',
          title: 'تنبيه: الطبيب متاح للكشف الآن 🟢',
          message: 'انتهت فترة الاستراحة، الطبيب جاهز ومستعد لاستقبال وفحص المريض التالي في طابور الانتظار.',
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        }, options);
        scheduleBannerDismiss(6000, alertId);
      }
    }
  };

  useEffect(() => {
    // 1. Cross-tab & Multi-window BroadcastChannel listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('soli_clinic_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'STATUS_CHANGE' && event.data.status) {
          const newStatus = event.data.status as 'available' | 'break';
          if (lastClinicStatusRef.current !== newStatus) {
            setDoctorStatus(newStatus);
            lastClinicStatusRef.current = newStatus;
            triggerDoctorStatusAlert(newStatus, event.data.updatedBy, event.data.statusKey || event.data.timestamp, { skipPublish: true });
          }
        }
      };
    } catch {
      // BroadcastChannel unsupported fallback
    }

    // 2. Storage event listener (for cross-tab storage changes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'soli_clinic_status_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.status && lastClinicStatusRef.current !== parsed.status) {
            const newStatus = parsed.status as 'available' | 'break';
            setDoctorStatus(newStatus);
            lastClinicStatusRef.current = newStatus;
            triggerDoctorStatusAlert(newStatus, parsed.updatedBy, parsed.statusKey || parsed.timestamp, { skipPublish: true });
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Firestore live subscription
    if (!db) return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorageChange);
    };

    const unsub = subscribeToClinicStatus(
      db,
      (clinicData) => {
        if (!clinicData) return;
        const newStatus = clinicData.status || 'available';
        setDoctorStatus(newStatus);

        // If status changed and it's not the initial mount, broadcast audio & visual alert to all connected users
        if (!isInitialClinicStatusRef.current && lastClinicStatusRef.current !== newStatus) {
          triggerDoctorStatusAlert(newStatus, clinicData.updatedBy, clinicData.updatedAt || newStatus, { skipPublish: true });
        }
        lastClinicStatusRef.current = newStatus;
        isInitialClinicStatusRef.current = false;
      },
      (err) => console.warn('Clinic status subscription error:', err)
    );

    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorageChange);
      unsub();
    };
  }, [db]);

  // Real-time Firestore-driven notifications based on Visit status transitions (new_visit / call / finish)
  useEffect(() => {
    const firstLoadDone = READ_OPT ? visitsReady : visitsCanonical.length > 0;

    if (isInitialVisitsLoadRef.current) {
      if (firstLoadDone) {
        visitsCanonical.forEach((v) => {
          previousVisitsMapRef.current.set(v.visitId, v.status);
        });
        isInitialVisitsLoadRef.current = false;
      }
      return;
    }

    const alertConfig = loadAlertSettings();

    visitsCanonical.forEach((v) => {
      const prevStatus = previousVisitsMapRef.current.get(v.visitId);
      const patient = patientsCanonical.find((p) => p.patientId === v.patientId);
      const patientName = patient?.fullName || 'المريض';
      const ticket = String(v.queueNumber || '');

      // 1. New visit registered in Firestore (Waiting State)
      if (!prevStatus && v.status === 'WAITING') {
        if (alertConfig.audioEnabled && alertConfig.newVisitAudio) {
          playSingleAlertSound('new_visit');
        }
        if (alertConfig.visualEnabled && alertConfig.newVisitVisual) {
          registerAlert({
            id: `new-${v.visitId}`,
            type: 'new_visit',
            title: 'تسجيل كشف وزيارة جديدة',
            message: `تم تسجيل المريض (${patientName}) في قائمة الانتظار بنجاح.`,
            ticket,
            timestamp: formatAppTime(new Date()),
            visitId: v.visitId,
            patientId: v.patientId,
          }, { skipPublish: true });
          scheduleBannerDismiss(5000, `new-${v.visitId}`);
        }
      }
      // 2. Patient called into exam room
      else if (prevStatus === 'WAITING' && v.status === 'IN_PROGRESS') {
        if (alertConfig.audioEnabled && alertConfig.callPatientAudio) {
          playSingleAlertSound('call');
        }
        if (alertConfig.visualEnabled && alertConfig.callPatientVisual) {
          registerAlert({
            id: `call-${v.visitId}`,
            type: 'call',
            title: 'نداء دخول المريض لغرفة الكشف',
            message: `تذكرة (${ticket}) — المريض (${patientName}) يتفضل لغرفة الطبيب للكشف`,
            ticket,
            timestamp: formatAppTime(new Date()),
            visitId: v.visitId,
            patientId: v.patientId,
          }, { skipPublish: true });
          scheduleBannerDismiss(5000, `call-${v.visitId}`);
        }
      }
      // 3. Examination completed: automatically removes previous waiting/call notification for this patient!
      else if (prevStatus && prevStatus !== 'COMPLETED' && v.status === 'COMPLETED') {
        // Disappear/purge waiting and calling notification for this patient on completion!
        setAlertHistory((prev) => prev.filter((a) => a.patientId !== v.patientId));

        if (alertConfig.audioEnabled && alertConfig.finishExamAudio) {
          playSingleAlertSound('finish');
        }
        if (alertConfig.visualEnabled && alertConfig.finishExamVisual) {
          registerAlert({
            id: `finish-${v.visitId}`,
            type: 'finish',
            title: 'إشعار انتهاء الكشف الطبي',
            message: `تم الانتهاء من كشف المريض (${patientName}) واعتماد الروشتة. العيادة جاهزة لاستقبال المريض التالي.`,
            ticket,
            timestamp: formatAppTime(new Date()),
            visitId: v.visitId,
            patientId: v.patientId,
          }, { skipPublish: true });
          scheduleBannerDismiss(6000, `finish-${v.visitId}`);
        }
      }

      previousVisitsMapRef.current.set(v.visitId, v.status);
    });
  }, [visitsCanonical, patientsCanonical, visitsReady]);

  // Real-time synchronization of alerts across tabs (BroadcastChannel) and devices/accounts (Firestore)
  const lastReceivedAlertIdRef = useRef<string>('');

  useEffect(() => {
    // 1. Multi-tab BroadcastChannel listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('soli_clinic_alerts_channel');
      channel.onmessage = (event) => {
        if (event.data?.type === 'CLINIC_ALERT' && event.data.alert) {
          const incoming = event.data.alert as ClinicAlertPayload;
          const sender = event.data.senderId;
          if (sender !== (userProfile?.username || 'user') && incoming.id !== lastReceivedAlertIdRef.current) {
            lastReceivedAlertIdRef.current = incoming.id;
            const alertConfig = loadAlertSettings();
            if (alertConfig.audioEnabled) {
              if (
                (incoming.type === 'finish' && alertConfig.finishExamAudio) ||
                (incoming.type === 'call' && alertConfig.callPatientAudio) ||
                (incoming.type === 'new_visit' && alertConfig.newVisitAudio)
              ) {
                playSingleAlertSound(incoming.type);
              }
            }
            if (alertConfig.visualEnabled) {
              registerAlert(incoming, { skipPublish: true });
              scheduleBannerDismiss(6000, incoming.id);
            }
          }
        }
      };
    } catch {}

    // 2. Multi-device Firestore latestAlert subscription
    if (!db) {
      return () => {
        channel?.close();
      };
    }

    const unsubAlerts = subscribeToLatestAlert(
      db,
      (remoteData: any) => {
        if (!remoteData || !remoteData.id) return;
        if (remoteData.id === lastReceivedAlertIdRef.current) return;
        lastReceivedAlertIdRef.current = remoteData.id;

        // Skip if sender is the current user on this device
        if (remoteData.senderId && remoteData.senderId === (userProfile?.username || 'user')) {
          return;
        }

        // Ignore alerts older than 2 minutes
        if (remoteData.updatedAt) {
          const ageMs = Date.now() - new Date(remoteData.updatedAt).getTime();
          if (ageMs > 120000) return;
        }

        const alertItem: ClinicAlertPayload = {
          id: remoteData.id,
          type: remoteData.type || 'finish',
          title: remoteData.title,
          message: remoteData.message,
          ticket: remoteData.ticket,
          timestamp: remoteData.timestamp || formatAppTime(new Date()),
          patientId: remoteData.patientId,
          visitId: remoteData.visitId,
        };

        const alertConfig = loadAlertSettings();
        if (alertConfig.audioEnabled) {
          if (
            (alertItem.type === 'finish' && alertConfig.finishExamAudio) ||
            (alertItem.type === 'call' && alertConfig.callPatientAudio) ||
            (alertItem.type === 'new_visit' && alertConfig.newVisitAudio)
          ) {
            playSingleAlertSound(alertItem.type);
          }
        }

        if (alertConfig.visualEnabled) {
          registerAlert(alertItem, { skipPublish: true });
          scheduleBannerDismiss(6000, alertItem.id);
        }
      },
      (err) => console.warn('Latest alert subscription error:', err)
    );

    return () => {
      channel?.close();
      unsubAlerts();
    };
  }, [db, userProfile?.username]);

  const handleToggleDoctorStatus = async () => {
    const nextStatus = doctorStatus === 'available' ? 'break' : 'available';
    setDoctorStatus(nextStatus);
    lastClinicStatusRef.current = nextStatus;
    const updatedBy = userProfile?.displayName || userProfile?.username || 'الطبيب';
    const statusKey = `${nextStatus}-${Math.floor(Date.now() / 5000)}`;

    // Trigger audio & visual alert in local session
    triggerDoctorStatusAlert(nextStatus, updatedBy, statusKey);

    // 1. Multi-tab BroadcastChannel
    try {
      const channel = new BroadcastChannel('soli_clinic_channel');
      channel.postMessage({ type: 'STATUS_CHANGE', status: nextStatus, updatedBy, statusKey, timestamp: Date.now() });
      channel.close();
    } catch {}

    // 2. LocalStorage cross-tab sync
    safeStorage.setJSON(StorageKeys.CLINIC_STATUS_EVENT, { status: nextStatus, updatedBy, statusKey, timestamp: Date.now() });

    // 3. Sync to Firestore immediately so all other connected accounts & devices receive the status update in real-time
    if (db) {
      try {
        await updateClinicStatusInFirestore(db, nextStatus, updatedBy);
      } catch (err) {
        console.warn('Failed to update clinic status in Firestore:', err);
      }
    }
  };

  // Doctor-determined Follow-ups only (from followUps collection & doctor examination schedules)
  const doctorFollowUpsList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const list: Array<{
      id: string;
      patientName: string;
      phone: string;
      fileNumber?: number;
      medicalCode: string;
      lastVisitDate: string;
      dueDate: string;
      daysRemaining: number;
      isFreeEligible: boolean;
      diagnosis: string;
      notes: string;
    }> = [];

    // 1. From Canonical FollowUps collection (recorded by doctor during exam)
    followUpsCanonical.forEach((fu) => {
      if (fu.status === 'CANCELLED' || fu.status === 'COMPLETED') return;
      const patient = patientsCanonical.find((p) => p.patientId === fu.patientId);
      if (!patient) return;
      
      const pVisits = visitsCanonical.filter((v) => v.patientId === fu.patientId);
      const lastVisit = [...pVisits].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const dueDateObj = new Date(fu.scheduledDate);
      dueDateObj.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDateObj.getTime() - today.getTime()) / 86400000);

      list.push({
        id: fu.followUpId,
        patientName: patient.fullName,
        phone: patient.phone,
        fileNumber: patient.fileNumber,
        medicalCode: patient.medicalCode || `EG-${patient.fileNumber || 101}`,
        lastVisitDate: READ_OPT
          ? (patient.lastVisitAt?.split('T')[0] || fu.createdAt?.split('T')[0] || '')
          : (lastVisit?.createdAt?.split('T')[0] || fu.createdAt?.split('T')[0] || ''),
        dueDate: fu.scheduledDate,
        daysRemaining: diffDays,
        isFreeEligible: fu.isFree || false,
        diagnosis: READ_OPT
          ? (patient.lastDiagnosis || 'متابعة استشارة')
          : (lastVisit?.clinicalData?.diagnosis?.[0] || 'متابعة استشارة'),
        notes: fu.notes || 'متابعة حددها الطبيب',
      });
    });

    // 2. Also include any doctor-scheduled follow-up appointments
    appointmentsCanonical.forEach((app) => {
      if (app.status !== 'SCHEDULED') return;
      if (!app.visitType.includes('متابعة') && !app.visitType.includes('استشارة')) return;
      if (list.some((item) => item.id === app.appointmentId || (item.patientName === patientsCanonical.find(p => p.patientId === app.patientId)?.fullName && item.dueDate === app.scheduledDate))) return;

      const patient = patientsCanonical.find((p) => p.patientId === app.patientId);
      if (!patient) return;

      const dueDateObj = new Date(app.scheduledDate);
      dueDateObj.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDateObj.getTime() - today.getTime()) / 86400000);

      list.push({
        id: app.appointmentId,
        patientName: patient.fullName,
        phone: patient.phone,
        fileNumber: patient.fileNumber,
        medicalCode: patient.medicalCode || `EG-${patient.fileNumber || 101}`,
        lastVisitDate: app.createdAt?.split('T')[0] || '',
        dueDate: app.scheduledDate,
        daysRemaining: diffDays,
        isFreeEligible: false,
        diagnosis: app.visitType,
        notes: app.notes || 'موعد متابعة محدد',
      });
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [followUpsCanonical, appointmentsCanonical, patientsCanonical, visitsCanonical]);

  // Sound Chime for Patient Queue & Status Updates
  const playQueueNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // Ignored if sound blocked by browser policy
    }
  };

  // Next sequential file number
  const nextFileNumber =
    Math.max(
      ...patientsCanonical.map((p) => (typeof p.fileNumber === 'number' ? p.fileNumber : 0)),
      0
    ) + 1;

  // =========================================================================
  // CATALOG MUTATION HANDLERS (Direct Firestore Persistence & Live Sync & Optimistic Updates)
  // =========================================================================
  const handleAddRadiologyToCatalog = async (item: RadiologyCatalogItem) => {
    const rawItem: RadiologyType = {
      radiologyId: item.id,
      nameAr: item.name,
      nameEn: '',
      category: item.category,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRadiologyTypesCanonical((prev) => {
      const filtered = prev.filter((r) => r.radiologyId !== item.id);
      const updated = [rawItem, ...filtered];
      try { localStorage.setItem('soli_radiology_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (db) {
      try {
        await saveCatalogItem(db, 'radiologyTypes', item.id, {
          radiologyId: item.id,
          nameAr: item.name,
          category: item.category,
          isFavorite: !!item.isFavorite,
          active: true,
        });
      } catch (err) {
        console.warn('Failed to save radiology to catalog', err);
      }
    }
  };

  const handleRemoveRadiologyFromCatalog = async (id: string) => {
    setRadiologyTypesCanonical((prev) => {
      const updated = prev.filter((r) => r.radiologyId !== id);
      try { localStorage.setItem('soli_radiology_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (db) {
      try {
        await removeCatalogItem(db, 'radiologyTypes', id);
      } catch (err) {
        console.warn('Failed to remove radiology', err);
      }
    }
  };

  const handleToggleRadiologyFavorite = async (id: string) => {
    setRadiologyTypesCanonical((prev) => {
      const updated = prev.map((r) => (r.radiologyId === id ? { ...r, isFavorite: !r.isFavorite } : r));
      try { localStorage.setItem('soli_radiology_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (!db) return;
    const current = radiologyCatalog.find((r) => r.id === id);
    if (!current) return;
    try {
      await saveCatalogItem(db, 'radiologyTypes', id, {
        isFavorite: !current.isFavorite,
      });
    } catch (err) {
      console.warn('Failed to toggle radiology favorite', err);
    }
  };

  const handleAddLabToCatalog = async (item: LabCatalogItem) => {
    const rawItem: LabTest = {
      labTestId: item.id,
      nameAr: item.name,
      nameEn: '',
      category: item.category,
      sampleType: item.sampleType || 'دم',
      fastingRequired: !!item.fastingRequired,
      referenceRange: item.referenceRange || '',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLabTestsCanonical((prev) => {
      const filtered = prev.filter((l) => l.labTestId !== item.id);
      const updated = [rawItem, ...filtered];
      try { localStorage.setItem('soli_lab_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (db) {
      try {
        await saveCatalogItem(db, 'labTests', item.id, {
          labTestId: item.id,
          nameAr: item.name,
          category: item.category,
          sampleType: item.sampleType || 'دم',
          fastingRequired: !!item.fastingRequired,
          referenceRange: item.referenceRange || '',
          unit: item.unit || '',
          isFavorite: !!item.isFavorite,
          active: true,
        });
      } catch (err) {
        console.warn('Failed to save lab to catalog', err);
      }
    }
  };

  const handleRemoveLabFromCatalog = async (id: string) => {
    setLabTestsCanonical((prev) => {
      const updated = prev.filter((l) => l.labTestId !== id);
      try { localStorage.setItem('soli_lab_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (db) {
      try {
        await removeCatalogItem(db, 'labTests', id);
      } catch (err) {
        console.warn('Failed to remove lab', err);
      }
    }
  };

  const handleToggleLabFavorite = async (id: string) => {
    setLabTestsCanonical((prev) => {
      const updated = prev.map((l) => (l.labTestId === id ? { ...l, isFavorite: !l.isFavorite } : l));
      try { localStorage.setItem('soli_lab_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (!db) return;
    const current = labCatalog.find((l) => l.id === id);
    if (!current) return;
    try {
      await saveCatalogItem(db, 'labTests', id, {
        isFavorite: !current.isFavorite,
      });
    } catch (err) {
      console.warn('Failed to toggle lab favorite', err);
    }
  };

  const handleAddDrugToCatalog = async (item: DrugCatalogItem) => {
    const rawItem: Medication = {
      medicationId: item.id,
      nameAr: item.brandName,
      nameEn: item.brandName,
      genericName: item.genericName,
      strength: item.strength,
      form: item.form,
      manufacturer: '',
      source: 'LOCAL',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setMedicationsCanonical((prev) => {
      const filtered = prev.filter((m) => m.medicationId !== item.id);
      const updated = [rawItem, ...filtered];
      try { localStorage.setItem('soli_medications_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (db) {
      try {
        await saveCatalogItem(db, 'medications', item.id, {
          medicationId: item.id,
          nameAr: item.brandName,
          tradeName: item.brandName,
          nameEn: item.brandName,
          genericName: item.genericName,
          strength: item.strength,
          form: item.form,
          category: item.category,
          defaultDosage: item.defaultDosage,
          defaultDose: item.defaultDosage,
          defaultDuration: item.defaultDuration,
          defaultTiming: item.defaultTiming,
          isFavorite: !!item.isFavorite,
          notes: item.notes || '',
          active: true,
        });
      } catch (err) {
        console.warn('Failed to save drug to catalog', err);
      }
    }
  };

  const handleRemoveDrugFromCatalog = async (id: string) => {
    setMedicationsCanonical((prev) => {
      const updated = prev.filter((m) => m.medicationId !== id);
      try { localStorage.setItem('soli_medications_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (db) {
      try {
        await removeCatalogItem(db, 'medications', id);
      } catch (err) {
        console.warn('Failed to remove drug', err);
      }
    }
  };

  const handleToggleDrugFavorite = async (id: string) => {
    setMedicationsCanonical((prev) => {
      const updated = prev.map((m) => (m.medicationId === id ? { ...m, isFavorite: !m.isFavorite } : m));
      try { localStorage.setItem('soli_medications_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (!db) return;
    const current = drugCatalog.find((d) => d.id === id);
    if (!current) return;
    try {
      await saveCatalogItem(db, 'medications', id, {
        isFavorite: !current.isFavorite,
      });
    } catch (err) {
      console.warn('Failed to toggle drug favorite', err);
    }
  };

  const handleAddDiagnosisToCatalog = async (item: DiagnosisCatalogItem) => {
    const rawItem: Diagnosis = {
      diagnosisId: item.id,
      code: item.code,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      codeSystem: 'ICD10',
      active: true,
      createdAt: new Date().toISOString(),
    };
    setDiagnosesCanonical((prev) => {
      const filtered = prev.filter((d) => d.diagnosisId !== item.id);
      const updated = [rawItem, ...filtered];
      try { localStorage.setItem('soli_diagnoses_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (db) {
      try {
        await saveCatalogItem(db, 'diagnoses', item.id, {
          diagnosisId: item.id,
          code: item.code,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          category: item.category,
          isFavorite: !!item.isFavorite,
          active: true,
        });
      } catch (err) {
        console.warn('Failed to save diagnosis to catalog', err);
      }
    }
  };

  const handleRemoveDiagnosisFromCatalog = async (id: string) => {
    setDiagnosesCanonical((prev) => {
      const updated = prev.filter((d) => d.diagnosisId !== id);
      try { localStorage.setItem('soli_diagnoses_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (db) {
      try {
        await removeCatalogItem(db, 'diagnoses', id);
      } catch (err) {
        console.warn('Failed to remove diagnosis', err);
      }
    }
  };

  const handleToggleDiagnosisFavorite = async (id: string) => {
    setDiagnosesCanonical((prev) => {
      const updated = prev.map((d) => (d.diagnosisId === id ? { ...d, isFavorite: !d.isFavorite } : d));
      try { localStorage.setItem('soli_diagnoses_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (!db) return;
    const current = diagnosesCatalog.find((d) => d.id === id);
    if (!current) return;
    try {
      await saveCatalogItem(db, 'diagnoses', id, {
        isFavorite: !current.isFavorite,
      });
    } catch (err) {
      console.warn('Failed to toggle diagnosis favorite', err);
    }
  };

  const handleAddSymptomToCatalog = async (item: SymptomCatalogItem) => {
    const rawItem: Symptom = {
      symptomId: item.id,
      nameAr: item.name,
      nameEn: item.name,
      category: item.category,
      active: true,
    };
    setSymptomsCanonical((prev) => {
      const filtered = prev.filter((s) => s.symptomId !== item.id);
      const updated = [rawItem, ...filtered];
      try { localStorage.setItem('soli_symptoms_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (db) {
      try {
        await saveCatalogItem(db, 'symptoms', item.id, {
          symptomId: item.id,
          nameAr: item.name,
          category: item.category,
          active: true,
        });
      } catch (err) {
        console.warn('Failed to save symptom to catalog', err);
      }
    }
  };

  const handleRemoveSymptomFromCatalog = async (id: string) => {
    setSymptomsCanonical((prev) => {
      const updated = prev.filter((s) => s.symptomId !== id);
      try { localStorage.setItem('soli_symptoms_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (db) {
      try {
        await removeCatalogItem(db, 'symptoms', id);
      } catch (err) {
        console.warn('Failed to remove symptom', err);
      }
    }
  };

  const handleAddChronicCondition = async (itemOrName: { id?: string; name: string; category?: string } | string) => {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
    const id = typeof itemOrName === 'string' ? `chronic-${Date.now()}` : (itemOrName.id || `chronic-${Date.now()}`);
    const category = typeof itemOrName === 'string' ? 'عام' : (itemOrName.category || 'أمراض مزمنة شائعة');

    const rawItem: ChronicDisease = {
      diseaseId: id,
      nameAr: name,
      nameEn: name,
      category,
      active: true,
    };
    setChronicDiseasesCanonical((prev) => {
      const filtered = prev.filter((c) => c.diseaseId !== id && c.nameAr !== name);
      const updated = [rawItem, ...filtered];
      try { localStorage.setItem('soli_chronic_diseases_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (db) {
      try {
        await saveCatalogItem(db, 'chronicDiseases', id, {
          diseaseId: id,
          nameAr: name,
          category,
          active: true,
        });
      } catch (err) {
        console.warn('Failed to save chronic disease', err);
      }
    }
  };

  const handleRemoveChronicCondition = async (idOrName: string) => {
    setChronicDiseasesCanonical((prev) => {
      const updated = prev.filter((c) => c.diseaseId !== idOrName && c.nameAr !== idOrName);
      try { localStorage.setItem('soli_chronic_diseases_catalog', JSON.stringify(updated)); } catch {}
      return updated;
    });
    if (db) {
      const found = chronicDiseasesCanonical.find((c) => c.diseaseId === idOrName || c.nameAr === idOrName);
      const targetId = found ? found.diseaseId : idOrName;
      try {
        await removeCatalogItem(db, 'chronicDiseases', targetId);
      } catch (err) {
        console.warn('Failed to remove chronic disease', err);
      }
    }
  };

  // =========================================================================
  // WORKFLOW ACTIONS (UI Action -> Firestore Transaction -> onSnapshot -> UI)
  // NO DOUBLE MUTATION!
  // =========================================================================

  // Delete queue item / visit & associated invoices/payments
  const handleRemoveFromQueue = async (ticket: string) => {
    const targetQueueNum = parseInt(ticket.replace(/\D/g, ''), 10);
    const targetVisit =
      visitsCanonical.find((v) => v.visitId === ticket) ||
      visitsCanonical.find((v) => v.queueNumber === targetQueueNum);
    if (targetVisit && db) {
      try {
        // 1. Delete visit document
        await deleteDoc(doc(db, 'visits', targetVisit.visitId));

        if (READ_OPT) {
          const vid = targetVisit.visitId;
          const pid = targetVisit.patientId;

          // 2/3: الفواتير والمدفوعات المرتبطة بالزيارة (بالاستعلام المباشر من الخادم، لا بالنافذة)
          const [invSnap, paySnap] = await Promise.all([
            getDocs(query(collection(db, 'invoices'), where('visitId', '==', vid))),
            getDocs(query(collection(db, 'payments'), where('visitId', '==', vid))),
          ]);
          for (const d of invSnap.docs) await deleteDoc(d.ref).catch(() => {});
          for (const d of paySnap.docs) await deleteDoc(d.ref).catch(() => {});

          // 4: لا تحذف ملف المريض إلا بعد التأكد من الخادم، ومع أي شك لا تحذف
          try {
            const patientDoc = patientsCanonical.find((p) => p.patientId === pid);
            if (!patientDoc?.hasClinicalFile) {
              const [vSnap, aSnap] = await Promise.all([
                getDocs(query(collection(db, 'visits'), where('patientId', '==', pid), limit(2))),
                getDocs(query(collection(db, 'appointments'), where('patientId', '==', pid), limit(1))),
              ]);
              const otherVisits = vSnap.docs.filter((d) => d.id !== vid);
              if (otherVisits.length === 0 && aSnap.empty) {
                await deleteDoc(doc(db, 'patients', pid)).catch(() => {});
              }
            }
          } catch (e) {
            console.warn('تخطي حذف المريض بسبب فشل التحقق:', e); // الفشل = لا حذف
          }
          return;
        }

        // 2. Delete linked invoice(s) (المنطق القديم عند تعطيل READ_OPT)
        const matchingInvoices = invoicesCanonical.filter(
          (inv) => inv.visitId === targetVisit.visitId || (inv.patientId === targetVisit.patientId && inv.createdAt === targetVisit.createdAt)
        );
        for (const inv of matchingInvoices) {
          await deleteDoc(doc(db, 'invoices', inv.invoiceId)).catch(() => {});
        }

        // 3. Delete linked payment(s)
        const matchingPayments = paymentsCanonical.filter(
          (p) => p.visitId === targetVisit.visitId || matchingInvoices.some((inv) => inv.invoiceId === p.invoiceId)
        );
        for (const pm of matchingPayments) {
          await deleteDoc(doc(db, 'payments', pm.paymentId)).catch(() => {});
        }

        // 4. Clean up patient profile if no other visits or appointments exist
        const otherVisits = visitsCanonical.filter((v) => v.patientId === targetVisit.patientId && v.visitId !== targetVisit.visitId);
        const otherAppts = appointmentsCanonical.filter((a) => a.patientId === targetVisit.patientId);
        if (otherVisits.length === 0 && otherAppts.length === 0) {
          await deleteDoc(doc(db, 'patients', targetVisit.patientId)).catch(() => {});
        }
      } catch (err) {
        console.error('Error removing visit and associated payments/invoices from Firestore:', err);
      }
    }
  };

  // Delete patient record
  const handleDeletePatient = async (patientId: string) => {
    if (db) {
      try {
        await deleteDoc(doc(db, 'patients', patientId));
      } catch (err) {
        console.warn('Error deleting patient from Firestore:', err);
      }
    }
  };

  // Update patient record
  const handleUpdatePatient = async (
    patientIdOrUpdated: string | (Partial<Patient> & { patientId: string }),
    maybeFields?: Partial<Patient>
  ) => {
    const timestamp = new Date().toISOString();
    const patientId = typeof patientIdOrUpdated === 'string' ? patientIdOrUpdated : patientIdOrUpdated.patientId;
    const fields = typeof patientIdOrUpdated === 'string' ? maybeFields || {} : patientIdOrUpdated;

    if (db && patientId) {
      try {
        await setDoc(
          doc(db, 'patients', patientId),
          {
            ...fields,
            patientId,
            updatedAt: timestamp,
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Error updating patient in Firestore:', err);
      }
    }
  };

  // Add invoice / transaction safely (UI Action -> Firestore Write -> onSnapshot -> UI)
  const handleAddTransaction = async (newTx: TransactionRecord) => {
    if (newTx.type === 'out') {
      // Clinic expenses are tracked via expense storage and events
      return;
    }

    const txKey = `tx:${newTx.id || `${normalizeArabicName(newTx.patientName)}-${newTx.amount}`}`;
    if (inFlightActionsRef.current.has(txKey)) return;
    inFlightActionsRef.current.add(txKey);

    try {
      // 1. Find or resolve patient using normalized Arabic name matching
      const matchedPatient = findMatchingPatient({ fullName: newTx.patientName });
      let targetPatientId = matchedPatient?.patientId;

      if (!targetPatientId && newTx.patientName.trim()) {
        targetPatientId = `pat-${Date.now()}`;
        const maxNum = patientsCanonical.reduce((max, p) => (p.fileNumber && p.fileNumber > max ? p.fileNumber : max), 0);
        const newPat: Patient = {
          patientId: targetPatientId,
          fileNumber: maxNum + 1,
          fullName: newTx.patientName.trim(),
          phone: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (db) {
          setDoc(doc(db, 'patients', targetPatientId), newPat).catch((e) => console.warn('Patient save fallback:', e));
        }
      }

      const invoiceId = newTx.id && newTx.id.startsWith('inv-') ? newTx.id : `inv-${Date.now()}`;
      const paymentId = `pay-${invoiceId.replace(/^inv-/, '')}`;
      const totalAmount = newTx.totalAmount ?? newTx.amount ?? 0;
      const discountAmount = newTx.discountAmount ?? 0;
      const finalTotal = Math.max(0, totalAmount - discountAmount);
      const paidAmount = newTx.paidAmount ?? (newTx.status === 'مدفوعة' ? finalTotal : (newTx.amount ?? 0));
      const txDateIso = newTx.date
        ? `${newTx.date}T${new Date().toISOString().split('T')[1] || '12:00:00.000Z'}`
        : new Date().toISOString();

      const rawMethod = newTx.paymentMethod || newTx.method || 'نقدي';
      const resolvedPaymentMethod: 'CASH' | 'CARD' | 'TRANSFER' =
        rawMethod.includes('فيزا') || rawMethod.includes('كارت')
          ? 'CARD'
          : rawMethod.includes('إنستا') || rawMethod === 'TRANSFER'
          ? 'TRANSFER'
          : 'CASH';

      const newInvoice: Invoice = {
        invoiceId,
        patientId: targetPatientId || 'pat-general',
        visitId: '',
        clinicLocationId: 'loc-main',
        items: [
          {
            serviceId: `srv-${invoiceId.replace(/^inv-/, '')}`,
            nameAr: newTx.serviceName || newTx.description || 'كشف واستشارة طبية',
            quantity: 1,
            unitPrice: totalAmount,
            total: totalAmount,
          },
        ],
        subtotal: totalAmount,
        discount: discountAmount,
        total: finalTotal,
        paidAmount: paidAmount > 0 ? paidAmount : (newTx.status === 'مدفوعة' ? finalTotal : 0),
        remainingAmount: Math.max(0, finalTotal - (paidAmount > 0 ? paidAmount : (newTx.status === 'مدفوعة' ? finalTotal : 0))),
        status: (newTx.status === 'مدفوعة' || paidAmount >= finalTotal) ? 'PAID' : 'UNPAID',
        createdAt: txDateIso,
        updatedAt: txDateIso,
        dayKey: toDayKey(txDateIso),
      };

      const newPayment: Payment = {
        paymentId,
        patientId: targetPatientId || 'pat-general',
        visitId: '',
        invoiceId,
        clinicLocationId: 'loc-main',
        amount: newInvoice.paidAmount > 0 ? newInvoice.paidAmount : finalTotal,
        method: resolvedPaymentMethod,
        status: 'PAID',
        receiptNumber: newTx.receiptNo || `REC-${Math.floor(10000 + Math.random() * 90000)}`,
        paidAt: txDateIso,
        receivedBy: userProfile?.username || userProfile?.displayName || 'receptionist',
        dayKey: toDayKey(txDateIso),
      };

      if (db) {
        try {
          const tasks: Promise<unknown>[] = [
            setDoc(doc(db, 'invoices', invoiceId), newInvoice),
          ];
          if (newInvoice.status === 'PAID' || newPayment.amount > 0) {
            tasks.push(setDoc(doc(db, 'payments', paymentId), newPayment));
          }
          await Promise.allSettled(tasks);
        } catch (err) {
          console.warn('Error saving transaction to Firestore:', err);
        }
      }
    } finally {
      inFlightActionsRef.current.delete(txKey);
    }
  };

  // Delete invoice / transaction safely (UI Action -> Firestore Delete -> onSnapshot -> UI)
  const handleDeleteTransaction = async (txId: string) => {
    const inMemory = paymentsCanonical.find((p) => p.paymentId === txId || p.invoiceId === txId || p.visitId === txId);
    let targetPaymentId = inMemory?.paymentId;
    let targetInvoiceId = inMemory?.invoiceId;

    if (!inMemory && db) {
      try {
        const snap = await getDoc(doc(db, 'payments', txId)); // سجل قديم خارج النافذة
        if (snap.exists()) {
          targetPaymentId = txId;
          targetInvoiceId = (snap.data() as { invoiceId?: string }).invoiceId;
        }
      } catch (e) {
        console.warn('Payment lookup before delete failed:', e);
      }
    }
    targetPaymentId = targetPaymentId || txId;
    targetInvoiceId = targetInvoiceId || txId;

    // Cloud Firestore deletion
    if (db) {
      try {
        const deleteTasks: Promise<unknown>[] = [];
        if (targetPaymentId) {
          deleteTasks.push(deleteDoc(doc(db, 'payments', targetPaymentId)).catch((e) => console.warn('Payment delete fallback:', e)));
        }
        if (targetInvoiceId) {
          deleteTasks.push(deleteDoc(doc(db, 'invoices', targetInvoiceId)).catch((e) => console.warn('Invoice delete fallback:', e)));
        }
        // Also clean up any standalone transaction entry if registered
        deleteTasks.push(deleteDoc(doc(db, 'transactions', txId)).catch((e) => console.warn('Transaction delete fallback:', e)));

        await Promise.allSettled(deleteTasks);
      } catch (err) {
        console.warn('Error deleting transaction from Firestore:', err);
      }
    }
  };

  // Call Patient
  const handleCallPatient = async (ticket: string, name: string) => {
    const targetQueueNum = parseInt(ticket.replace(/\D/g, ''), 10);
    const targetVisit =
      visitsCanonical.find((v) => v.queueNumber === targetQueueNum) ||
      visitsCanonical.find((v) => v.visitId === ticket) ||
      visitsCanonical.find((v) => patientsCanonical.find((p) => p.patientId === v.patientId)?.fullName === name);
    const visitId = targetVisit ? targetVisit.visitId : ticket;

    const alertConfig = loadAlertSettings();
    if (alertConfig.audioEnabled && alertConfig.callPatientAudio) {
      playSingleAlertSound('call');
    }
    if (alertConfig.visualEnabled && alertConfig.callPatientVisual) {
      registerAlert({
        id: `call-${visitId}`,
        type: 'call',
        title: 'نداء دخول المريض لغرفة الكشف',
        message: `تذكرة (${ticket}) — المريض (${name}) يتفضل لغرفة الطبيب للكشف`,
        ticket,
        timestamp: formatAppTime(new Date()),
      });
      scheduleBannerDismiss(5000, `call-${visitId}`);
    }

    if (!targetVisit) return;

    const canonicalPat = patientsCanonical.find((p) => p.patientId === targetVisit.patientId);
    const basePatient = patients.find((p) => p.id === targetVisit.patientId);
    const registeredComplaint = targetVisit.receptionistData?.symptoms || basePatient?.chiefComplaint || '';
    const registeredSymptoms = targetVisit.receptionistData?.symptoms
      ? [targetVisit.receptionistData.symptoms]
      : basePatient?.intakeSymptoms || [];
    const registeredChronic =
      targetVisit.receptionistData?.chronicDiseases && targetVisit.receptionistData.chronicDiseases.length > 0
        ? targetVisit.receptionistData.chronicDiseases
        : (canonicalPat?.chronicDiseases || basePatient?.chronicConditions || []);

    const birthYear = canonicalPat?.dateOfBirth ? new Date(canonicalPat.dateOfBirth).getFullYear() : undefined;
    const calculatedAge = birthYear ? Math.max(1, new Date().getFullYear() - birthYear) : (basePatient?.age || 0);

    const matchedPatient: PatientListItem = {
      id: targetVisit.patientId,
      medicalCode: canonicalPat?.medicalCode || basePatient?.medicalCode || `EG-${targetVisit.patientId.slice(0, 5)}`,
      fileNumber: canonicalPat?.fileNumber || basePatient?.fileNumber || targetVisit.queueNumber || 1,
      name: canonicalPat?.fullName || basePatient?.name || name,
      age: calculatedAge,
      gender: canonicalPat?.gender || basePatient?.gender || '',
      phone: canonicalPat?.phone || basePatient?.phone || '',
      governorate: canonicalPat?.governorate || basePatient?.governorate || '',
      address: canonicalPat?.address || basePatient?.address || '',
      allergies: canonicalPat?.allergies || basePatient?.allergies || [],
      chronicConditions: registeredChronic,
      bloodGroup: canonicalPat?.bloodType || basePatient?.bloodType || basePatient?.bloodGroup || 'غير محدد',
      visitsCount: basePatient?.visitsCount || 1,
      chiefComplaint: registeredComplaint,
      intakeSymptoms: registeredSymptoms,
      lastDiagnosis: targetVisit.receptionistData?.symptoms || basePatient?.lastDiagnosis || '',
    };
    setActiveExamPatient(matchedPatient);

    const callerDoctorId = userProfile?.username || userProfile?.uid;
    if (db && callerDoctorId) {
      try {
        await startVisitTransaction(db, targetVisit.visitId, callerDoctorId);
      } catch (error) {
        console.error('startVisit error:', error);
      }
    }
  };

  // Check in appointment: Firestore transaction atomically commits ARRIVED + Invoice + Payment + Visit
  const handleConfirmCheckIn = async (app: AppointmentListItem, fee: number, method: string = 'نقدي') => {
    const appt = appointmentsCanonical.find((a) => a.appointmentId === app.id);
    if (!appt || appt.status !== 'SCHEDULED') {
      alert('الموعد غير موجود أو تم تسجيل حضوره بالفعل');
      return;
    }
    const patient = patientsCanonical.find((p) => p.patientId === appt.patientId);
    if (!patient) {
      alert('لا يمكن تسجيل الحضور دون Patient مرتبط بالموعد');
      return;
    }
    const paymentMethodEnum = method.includes('فيزا') || method.includes('كارت') ? 'CARD' : method.includes('إنستا') ? 'TRANSFER' : 'CASH';

    if (db) {
      try {
        const checkInResult = await checkInAppointmentTransaction({
          db,
          appointmentId: appt.appointmentId,
          paymentAmount: fee,
          paymentMethod: paymentMethodEnum,
          receivedBy: userProfile?.username || 'receptionist',
          receptionistData: { symptoms: app.visitType || 'كشف', chronicDiseases: patient.chronicDiseases || [], notes: '' },
        });

        const alertConfig = loadAlertSettings();
        if (alertConfig.audioEnabled && alertConfig.newVisitAudio) {
          playSingleAlertSound('new_visit');
        }
        if (alertConfig.visualEnabled && alertConfig.newVisitVisual) {
          registerAlert({
            id: `new-${checkInResult.visit.visitId}`,
            type: 'new_visit',
            title: 'تسجيل حضور موعد مسبق بالانتظار',
            message: `تم تأكيد حضور المريض (${patient.fullName}) وتحويله لصالة الانتظار.`,
            ticket: String(nextFileNumber),
            timestamp: formatAppTime(new Date()),
          });
          scheduleBannerDismiss(5000, `new-${checkInResult.visit.visitId}`);
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : 'فشل تسجيل حضور المريض في قاعدة البيانات');
      }
    }
  };

  // Walk-in: Patient + Invoice + Payment + Visit are committed in one transaction
  const handleAddPatientToQueue = async (item: QueueItem) => {
    const cleanPhone = (item.phone || '').trim();
    const cleanName = (item.patientName || '').trim();
    const lockKey = `queue:${item.patientId || normalizePhoneDigits(cleanPhone) || normalizeArabicName(cleanName)}`;
    if (inFlightActionsRef.current.has(lockKey)) return;
    inFlightActionsRef.current.add(lockKey);

    try {
      const timestamp = new Date().toISOString();

      // Look up existing patient by patientId, normalized phone digits, or normalized Arabic name
      const basePat = findMatchingPatient({
        patientId: item.patientId,
        phone: cleanPhone,
        fullName: cleanName,
      });

      // Convert entered age to a valid dateOfBirth so the age calculation is perfectly synchronized and correct
      const calculatedDOB = item.age && Number(item.age) > 0
        ? new Date(new Date().getFullYear() - Number(item.age), 0, 1).toISOString().split('T')[0]
        : null;

      const patientGender: 'male' | 'female' | undefined = item.gender === 'female'
        ? 'female'
        : item.gender === 'male'
        ? 'male'
        : (basePat?.gender === 'female' || basePat?.gender === 'male' ? basePat.gender : undefined);

      const targetPatientId = basePat?.patientId || item.patientId || `pat-${Date.now()}`;

      const patient: Patient = basePat
        ? {
            ...basePat,
            fullName: cleanName || basePat.fullName,
            phone: cleanPhone || basePat.phone,
            gender: patientGender,
            chronicDiseases: Array.from(new Set([...(basePat.chronicDiseases || []), ...(item.chronicConditions || [])])),
            address: item.address || basePat.address || basePat.governorate || '',
            bloodType: item.bloodType && item.bloodType !== 'غير محدد' ? item.bloodType : (basePat.bloodType || 'غير محدد'),
            dateOfBirth: calculatedDOB || basePat.dateOfBirth || null,
            updatedAt: timestamp,
          }
        : {
            patientId: targetPatientId,
            fullName: cleanName || 'مريض جديد',
            phone: cleanPhone,
            gender: patientGender,
            fileNumber: typeof item.fileNumber === 'number' ? item.fileNumber : parseInt(String(item.fileNumber), 10) || nextFileNumber,
            medicalCode: item.medicalCode || `EG-${Math.floor(Math.random() * 90000) + 10000}`,
            chronicDiseases: item.chronicConditions || [],
            allergies: [],
            address: item.address || '',
            bloodType: item.bloodType || 'غير محدد',
            dateOfBirth: calculatedDOB,
            createdAt: timestamp,
            updatedAt: timestamp,
            createdBy: userProfile?.username || 'receptionist',
          };
      const paymentMethodEnum =
        item.paymentMethod.includes('فيزا') || item.paymentMethod.includes('كارت')
          ? 'CARD'
          : item.paymentMethod.includes('إنستا')
          ? 'TRANSFER'
          : 'CASH';

      if (db) {
        try {
          const registeredVisit = await registerWalkInTransaction({
            db,
            patient,
            paymentAmount: item.paidAmount,
            paymentMethod: paymentMethodEnum,
            receivedBy: userProfile?.username || 'receptionist',
            clinicLocationId: 'loc-mohandessin',
            appointmentId: item.appointmentId || intakeInitialData?.appointmentId || null,
            receptionistData: { symptoms: item.complaint || '', chronicDiseases: patient.chronicDiseases || [], notes: '' },
          });

          // If this intake was initiated from a scheduled appointment, mark the appointment as ARRIVED in Firestore
          // so it disappears from the active scheduled appointments view across all user accounts
          const apptIdToMark = item.appointmentId || intakeInitialData?.appointmentId;
          if (apptIdToMark && db) {
            try {
              await setDoc(
                doc(db, 'appointments', apptIdToMark),
                { status: 'ARRIVED', updatedAt: timestamp },
                { merge: true }
              );
            } catch (apptErr) {
              console.warn('Could not update appointment status to ARRIVED:', apptErr);
            }
          }
          setIntakeInitialData(null);

          const alertConfig = loadAlertSettings();
          if (alertConfig.audioEnabled && alertConfig.newVisitAudio) {
            playSingleAlertSound('new_visit');
          }
          if (alertConfig.visualEnabled && alertConfig.newVisitVisual) {
            registerAlert({
              id: `new-${registeredVisit.visitId}`,
              type: 'new_visit',
              title: 'تسجيل كشف وزيارة جديدة',
              message: `تم تسجيل المريض (${item.patientName}) في قائمة الانتظار بنجاح.`,
              ticket: String(item.ticketNumber || nextFileNumber),
              timestamp: formatAppTime(new Date()),
            });
            scheduleBannerDismiss(5000, `new-${registeredVisit.visitId}`);
          }
        } catch (error) {
          alert(error instanceof Error ? error.message : 'فشل إضافة المريض للانتظار في قاعدة البيانات');
        }
      }
    } finally {
      inFlightActionsRef.current.delete(lockKey);
    }
  };

  // Add scheduled appointment: Patient first, then Appointment in one Firestore transaction
  const handleAddAppointment = async (app: AppointmentListItem) => {
    const apptId = app.appointmentId || app.id;
    if (apptId && appointmentsCanonical.some((a) => a.appointmentId === apptId)) {
      return;
    }
    const cleanPhone = (app.phone || '').trim();
    const cleanName = (app.patientName || '').trim();
    const lockKey = `appt:${apptId || normalizePhoneDigits(cleanPhone) || normalizeArabicName(cleanName)}-${app.date || ''}`;
    if (inFlightActionsRef.current.has(lockKey)) return;
    inFlightActionsRef.current.add(lockKey);

    try {
      const timestamp = new Date().toISOString();
      const existingPatient = findMatchingPatient({
        patientId: app.patientId,
        phone: cleanPhone,
        fullName: cleanName,
      });

      const targetPatientId = existingPatient?.patientId || app.patientId || `pat-${Date.now()}`;

      const patientToSave: Patient = existingPatient || {
        patientId: targetPatientId,
        fullName: cleanName || 'مريض محجوز',
        phone: cleanPhone,
        fileNumber: nextFileNumber,
        medicalCode: app.medicalCode || `EG-${Math.floor(Math.random() * 90000) + 10000}`,
        chronicDiseases: [],
        allergies: [],
        address: '',
        bloodType: 'غير محدد',
        dateOfBirth: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: userProfile?.username || 'receptionist',
      };

      const resolvedBranch = findBranch(app.branch);
      const newApp: Appointment = {
        appointmentId: apptId || `app-${Date.now()}`,
        patientId: targetPatientId,
        patientName: cleanName || existingPatient?.fullName || 'مريض محجوز',
        phone: cleanPhone || existingPatient?.phone || '',
        clinicLocationId: resolvedBranch.id || resolvedBranch.name || 'loc-mohandessin',
        scheduledDate: app.date || new Date().toISOString().split('T')[0],
        scheduledTime: app.timeSlot || app.time || '07:30 م',
        visitType: app.visitType || 'كشف جديد',
        status: 'SCHEDULED',
        notes: app.notes || '',
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: userProfile?.username || 'receptionist',
      };
      if (db) {
        try {
          await createAppointmentTransaction({ db, patient: patientToSave, appointment: newApp });
        } catch (error) {
          alert(error instanceof Error ? error.message : 'تعذر حفظ الموعد في قاعدة البيانات');
        }
      }
    } finally {
      inFlightActionsRef.current.delete(lockKey);
    }
  };

  // Finish examination: ATOMIC COMPLETE VISIT WORKFLOW (UI Action -> Firestore Complete Visit -> onSnapshot -> UI)
  const handleFinishExam = async (examData?: {
    prescriptionItems: PrescriptionItem[];
    labOrders: LabOrderItem[];
    radiologyOrders: RadiologyOrderItem[];
    diagnoses: any[];
    followupDate: string;
    lifestyleAdvice: string;
    vitals?: Partial<VitalsData> | null;
    chiefComplaint?: string;
    examination?: string;
    history?: string;
  }) => {
    const resolvedDoctorId = userProfile?.username || userProfile?.uid;
    if (!resolvedDoctorId) {
      alert('تعذر التحقق من حساب الطبيب المسجل حاليًا. يرجى إعادة تسجيل الدخول قبل إنهاء الكشف.');
      return;
    }

    const diagnosisStrings = (examData?.diagnoses || [])
      .map((d) => (typeof d === 'string' ? d.trim() : (d?.nameAr || d?.nameEn || '').trim()))
      .filter(Boolean);

    if (diagnosisStrings.length === 0) {
      alert('يرجى إدخال أو اختيار تشخيص طبي واحد على الأقل قبل إنهاء الكشف وحفظ الزيارة.');
      return;
    }

    const activeWaiting =
      visitsCanonical.find((v) => v.patientId === activeExamPatient?.id && (v.status === 'IN_PROGRESS' || v.status === 'WAITING')) ||
      visitsCanonical.find((v) => v.status === 'IN_PROGRESS') ||
      visitsCanonical.find((v) => v.status === 'WAITING');

    const rxItems = examData ? examData.prescriptionItems : activePrescription;

    // Sync to Firestore if db is available
    if (activeWaiting && db) {
      const rxSnapshots: PrescriptionItemSnapshot[] = rxItems.map((item) => ({
        name: item.drugName,
        strength: item.scientificName || '',
        form: item.dosageForm || '',
        dose: item.dosage || '',
        frequency: item.timing || item.dosage || '',
        duration: item.duration || '',
        instructions: item.notes?.trim() || (item as any).dosageInstructions?.trim() || '',
      }));

      const clinicalData = {
        chiefComplaint:
          examData?.chiefComplaint !== undefined
            ? examData.chiefComplaint
            : (activeWaiting.receptionistData?.symptoms || activeExamPatient?.chiefComplaint || ''),
        history: examData?.history ?? '',
        examination: examData?.examination ?? '',
        diagnosis: diagnosisStrings,
        treatment: rxItems.map((p) => p.drugName).join(' + '),
      };

      const vitalSigns = examData?.vitals
        ? vitalsToVisit(examData.vitals)
        : (activeWaiting.vitalSigns || {});

      try {
        await completeVisitTransaction({
          db,
          visitId: activeWaiting.visitId,
          doctorId: resolvedDoctorId,
          clinicalData,
          vitalSigns,
          prescriptionItems: rxSnapshots,
          prescriptionNotes: examData?.lifestyleAdvice ?? '',
          labOrders: examData?.labOrders?.map((l) => {
            const hasResult = !!(l.resultValue && l.resultValue.trim());
            const isReport = l.status === 'REPORT';
            const isResult = l.status === 'RESULT' || hasResult;
            const resolvedStatus: OrderStatus = isReport ? 'REPORT' : isResult ? 'RESULT' : 'ORDERED';
            return {
              testId: l.labTestId || null,
              testName: l.testName,
              status: resolvedStatus,
              result: l.resultValue || '',
              notes: l.instructions || l.reportNotes || '',
            };
          }),
          radiologyOrders: examData?.radiologyOrders?.map((r) => {
            const hasReport = !!(r.reportDetails && r.reportDetails.trim());
            const hasResult = !!(r.resultSummary && r.resultSummary.trim());
            const isReport = r.status === 'REPORT' || hasReport;
            const isResult = r.status === 'RESULT' || hasResult;
            const resolvedStatus: OrderStatus = isReport ? 'REPORT' : isResult ? 'RESULT' : 'ORDERED';
            return {
              radiologyTypeId: r.radiologyId || null,
              radiologyName: r.name,
              status: resolvedStatus,
              result: r.resultSummary || r.reportDetails || '',
              report: r.reportDetails || '',
              notes: r.notes || '',
            };
          }),
          followUp: examData?.followupDate ? {
            scheduledDate: examData.followupDate,
            fee: 0,
            isFree: true,
            notes: examData.lifestyleAdvice || '',
          } : undefined,
        });
      } catch (error) {
        console.warn('Firestore sync notice:', error);
      }
      invalidatePatientHistory(activeWaiting?.patientId || activeExamPatient?.id);
    }

    // Play chime & show alert notification
    const alertConfig = loadAlertSettings();
    if (alertConfig.audioEnabled && alertConfig.finishExamAudio) {
      playSingleAlertSound('finish');
    }
    if (alertConfig.visualEnabled && alertConfig.finishExamVisual) {
      const visitId = activeWaiting?.visitId || activeExamPatient?.id || 'exam';
      registerAlert({
        id: `finish-${visitId}`,
        type: 'finish',
        title: 'إشعار السكرتارية: انتهاء الكشف الطبي',
        message: `تم الانتهاء من كشف المريض (${activeExamPatient?.name || 'المريض'}) واعتماد الروشتة. العيادة جاهزة لاستقبال المريض التالي.`,
        ticket: String(activeWaiting?.queueNumber || ''),
        timestamp: formatAppTime(new Date()),
      });
      scheduleBannerDismiss(6000, `finish-${visitId}`);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-100 dark:bg-black text-slate-900 dark:text-slate-100 font-sans antialiased flex transition-colors"
      dir={dir}
    >
      {/* Permanent Sidebar Navigation & Mobile Drawer */}
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        queueCount={queue.length}
        onLogout={() => { void logoutAccount(); }}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isDark={theme === 'dark'}
        onToggleTheme={toggleTheme}
        doctorStatus={doctorStatus}
        onToggleDoctorStatus={handleToggleDoctorStatus}
      />

      {/* Main Content Area */}
      <div className={`flex-1 ${isRTL ? 'mr-0 lg:mr-72' : 'ml-0 lg:ml-72'} flex flex-col min-h-screen min-w-0 w-full max-w-full overflow-x-hidden`}>
        {/* Top Header */}
        <Header
          syncStatus={syncStatus}
          syncErrorDetails={syncErrorDetails}
          waitingQueue={queue}
          recentAlerts={alertHistory}
          onDismissAlert={handleDismissAlert}
          onClearAllAlerts={handleClearAllAlerts}
          followUpsList={doctorFollowUpsList}
          patients={patients}
          appointments={appointments}
          transactions={transactions}
          onSelectPatient={setActiveExamPatient}
          onStartIntakeFromAppointment={handleStartIntakeFromAppointment}
          onNavigate={handleNavigate}
          onCallPatient={handleCallPatient}
          onRetrySync={() => setSyncRetryCounter((c) => c + 1)}
          onOpenDatabaseInspector={() => setIsDatabaseInspectorOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
          isDark={theme === 'dark'}
          onToggleTheme={toggleTheme}
        />

        {/* Global Live Clinic Notification Banner (Controlled by Settings: Audio & Visual) */}
        {callingBanner && (
          <div
            className={`fixed top-18 ${isRTL ? 'right-4 lg:right-80 left-4 lg:left-8' : 'left-4 lg:left-80 right-4 lg:right-8'} z-50 bg-white dark:bg-[#18233C] border-2 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-in slide-in-from-top-4 max-w-full transition-all ${
              callingBanner.type === 'finish'
                ? 'border-emerald-500 shadow-emerald-500/10'
                : callingBanner.type === 'call'
                ? 'border-amber-500 shadow-amber-500/10'
                : 'border-[#00c2cb] shadow-[#00c2cb]/10'
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center font-black shrink-0 ${
                  callingBanner.type === 'finish'
                    ? 'bg-emerald-500 text-slate-950'
                    : callingBanner.type === 'call'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#00c2cb] text-slate-950'
                }`}
              >
                <span className="material-symbols-outlined text-xl sm:text-2xl animate-pulse">
                  {callingBanner.type === 'finish'
                    ? 'task_alt'
                    : callingBanner.type === 'call'
                    ? 'campaign'
                    : 'person_add'}
                </span>
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono font-bold block ${
                      callingBanner.type === 'finish'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : callingBanner.type === 'call'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[#008f97] dark:text-[#45dee7]'
                    }`}
                  >
                    {callingBanner.title}
                  </span>
                  {callingBanner.timestamp && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      • {callingBanner.timestamp}
                    </span>
                  )}
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#dde2f5] truncate">
                  {callingBanner.message}
                </h4>
              </div>
            </div>
            <button
              onClick={() => setCallingBanner(null)}
              className="text-xs text-slate-500 dark:text-[#859394] hover:text-slate-900 dark:hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#080e1b] dark:hover:bg-[#111A2E] cursor-pointer shrink-0 font-bold transition-colors"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Main View Container */}
        <main className="flex-1 mt-16 p-2 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto min-w-0 overflow-x-hidden">
          {!canAccess(activeScreen) ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#111A2E] border border-rose-500/30 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 text-rose-500 mx-auto flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl">lock</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
                  هذه الصفحة غير مصرحة لحسابك
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#859394]">
                  تم تقييد الوصول لهذه الصفحة من قِبل إدارة العيادة. تواصل مع المسؤول في حال الحاجة لتعديل الصلاحيات.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const firstPermitted =
                    (allowedScreens.find((s) => canAccess(s)) as ScreenType) ||
                    (allowedScreens[0] as ScreenType) ||
                    'new-visit';
                  setActiveScreen(firstPermitted);
                }}
                className="px-4 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                الانتقال إلى أول صفحة مسموحة لك
              </button>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-[#00c2cb] border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              {activeScreen === 'dashboard' && (
                <DashboardScreen
                  onNavigate={handleNavigate}
                  appointments={appointments}
                  queue={queue}
                  visits={visitsCanonical}
                  transactions={transactions}
                  followUps={doctorFollowUpsList}
                  recentAlerts={alertHistory}
                  doctorStatus={doctorStatus}
                  activeExamPatientName={activeExamPatient?.name}
                  onConfirmCheckIn={handleConfirmCheckIn}
                  onCallPatient={handleCallPatient}
                  onSelectPatient={setActiveExamPatient}
                  onStartIntakeFromAppointment={handleStartIntakeFromAppointment}
                  patients={patients}
                  onAddTransaction={handleAddTransaction}
                />
              )}

              {activeScreen === 'new-visit' && (
                <PatientIntakeScreen
                  onAddPatientToQueue={handleAddPatientToQueue}
                  patients={patients}
                  presetChronicConditions={presetChronicConditions}
                  onAddChronicCondition={() => {}}
                  onNavigate={handleNavigate}
                  nextFileNumber={nextFileNumber}
                  symptomsCatalog={symptomsCatalog}
                  visitTypesList={visitTypesList}
                  initialData={intakeInitialData}
                  onClearInitialData={() => setIntakeInitialData(null)}
                />
              )}

              {activeScreen === 'waiting-queue' && (
                <QueueScreen
                  queue={queue}
                  onCallPatient={handleCallPatient}
                  onNavigate={handleNavigate}
                  onRemoveFromQueue={handleRemoveFromQueue}
                  onOpenNewVisit={() => handleNavigate('new-visit')}
                />
              )}

              {(activeScreen === 'appointments' || activeScreen === 'upcoming-followups') && (
                <AppointmentsScreen
                  appointments={appointments}
                  followUps={doctorFollowUpsList}
                  onCheckInPatient={(app) => handleConfirmCheckIn(app, app.expectedFee, 'نقدي')}
                  onOpenNewAppointment={() => setIsNewAppointmentOpen(true)}
                  onAddAppointment={handleAddAppointment}
                  onNavigate={handleNavigate}
                  onStartIntakeFromAppointment={handleStartIntakeFromAppointment}
                  patients={patients}
                  visitTypesList={visitTypesList}
                />
              )}

              {activeScreen === 'clinical-exam' && (
                <ExaminationScreen
                  patient={activeExamPatient}
                  availablePatients={patients}
                  onSelectPatient={setActiveExamPatient}
                  queue={queue}
                  presetChronicConditions={presetChronicConditions}
                  onNavigate={handleNavigate}
                  onFinishExam={handleFinishExam}
                  radiologyCatalog={radiologyCatalog}
                  onAddRadiologyToCatalog={handleAddRadiologyToCatalog}
                  labCatalog={labCatalog}
                  onAddLabToCatalog={handleAddLabToCatalog}
                  drugCatalog={drugCatalog}
                  onAddDrugToCatalog={handleAddDrugToCatalog}
                  diagnosesCatalog={diagnosesCatalog}
                  onAddDiagnosisToCatalog={handleAddDiagnosisToCatalog}
                  symptomsCatalog={symptomsCatalog}
                  onAddSymptomToCatalog={handleAddSymptomToCatalog}
                  activePrescription={activePrescription}
                  onChangeActivePrescription={setActivePrescription}
                  visits={visitsCanonical}
                  prescriptions={prescriptionsCanonical}
                  allLabOrders={labOrdersCanonical}
                  allRadiologyOrders={radiologyOrdersCanonical}
                  currentVisitId={
                    visitsCanonical.find(
                      (v) => v.patientId === activeExamPatient?.id && (v.status === 'IN_PROGRESS' || v.status === 'WAITING'),
                    )?.visitId
                  }
                />
              )}

              {activeScreen === 'prescription-pad' && (
                <PrescriptionPadScreen
                  patient={activeExamPatient}
                  items={activePrescription}
                  onChangeItems={setActivePrescription}
                  onUpdatePatient={(up) => {
                    handleUpdatePatient(up.patientId, { fullName: up.fullName, dateOfBirth: up.dateOfBirth });
                    setActiveExamPatient((prev) => prev ? { ...prev, name: up.fullName, age: up.age ?? prev.age } : null);
                  }}
                />
              )}

              {(activeScreen === 'patient-records' || (activeScreen as string) === 'patients') && (
                <PatientListItemsScreen
                  patients={patients}
                  patientsCanonical={patientsCanonical}
                  selectedPatientId={activeExamPatient?.id}
                  onNavigate={handleNavigate}
                  onSelectPatientForExam={(p) => setActiveExamPatient(p)}
                  onDeletePatient={handleDeletePatient}
                  onUpdatePatient={handleUpdatePatient}
                  visits={visitsCanonical}
                  invoices={invoicesCanonical}
                  prescriptions={prescriptionsCanonical}
                  labOrders={labOrdersCanonical}
                  radiologyOrders={radiologyOrdersCanonical}
                  followUps={followUpsCanonical}
                />
              )}

              {(activeScreen === 'finance' || activeScreen === 'billing-payments') && (
                <FinanceScreen
                  transactions={transactions}
                  onAddTransaction={handleAddTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  patients={patients}
                  patientsCanonical={patientsCanonical}
                />
              )}

              {activeScreen === 'clinical-reports' && (
                <ClinicalReportsScreen
                  visits={visitsCanonical}
                  invoices={invoicesCanonical}
                  payments={paymentsCanonical}
                  prescriptions={prescriptionsCanonical}
                  followUps={followUpsCanonical}
                  patients={patientsCanonical}
                />
              )}

              {activeScreen === 'booking-landing' && (
                <BookingLandingScreen
                  onAddAppointment={handleAddAppointment}
                  onNavigateToAppointments={() => handleNavigate('appointments')}
                />
              )}

              {(activeScreen === 'settings' || activeScreen === 'system-settings') && (
                <SettingsScreen
                  presetChronicConditions={presetChronicConditions}
                  onAddChronicCondition={handleAddChronicCondition}
                  onRemoveChronicCondition={handleRemoveChronicCondition}
                  radiologyCatalog={radiologyCatalog}
                  onAddRadiology={handleAddRadiologyToCatalog}
                  onRemoveRadiology={handleRemoveRadiologyFromCatalog}
                  onToggleRadiologyFavorite={handleToggleRadiologyFavorite}
                  labCatalog={labCatalog}
                  onAddLab={handleAddLabToCatalog}
                  onRemoveLab={handleRemoveLabFromCatalog}
                  onToggleLabFavorite={handleToggleLabFavorite}
                  drugCatalog={drugCatalog}
                  onAddDrug={handleAddDrugToCatalog}
                  onRemoveDrug={handleRemoveDrugFromCatalog}
                  onToggleDrugFavorite={handleToggleDrugFavorite}
                  diagnosesCatalog={diagnosesCatalog}
                  onAddDiagnosis={handleAddDiagnosisToCatalog}
                  onRemoveDiagnosis={handleRemoveDiagnosisFromCatalog}
                  onToggleDiagnosisFavorite={handleToggleDiagnosisFavorite}
                  symptomsCatalog={symptomsCatalog}
                  onAddSymptom={handleAddSymptomToCatalog}
                  onRemoveSymptom={handleRemoveSymptomFromCatalog}
                  visitTypesList={visitTypesList}
                  onAddVisitType={handleAddVisitType}
                  onRemoveVisitType={handleRemoveVisitType}
                  onUpdateVisitTypeFee={handleUpdateVisitTypeFee}
                  onGenerateYearlyDemoData={handleGenerateYearlyDemoData}
                  onClearAllData={handleClearAllData}
                  onClearBrowserVisitsOnly={handleClearBrowserVisitsOnly}
                  onClearAllBrowserAndCloud={handleClearAllBrowserAndCloud}
                  patients={patientsCanonical}
                  appointments={appointmentsCanonical}
                  visits={visitsCanonical}
                  invoices={invoicesCanonical}
                  payments={paymentsCanonical}
                  prescriptions={prescriptionsCanonical}
                  labOrders={labOrdersCanonical}
                  radiologyOrders={radiologyOrdersCanonical}
                  followUps={followUpsCanonical}
                />
              )}
            </Suspense>
          )}
        </main>
      </div>

      {/* Booking Appointment Modal */}
      <NewAppointmentModal
        isOpen={isNewAppointmentOpen}
        onClose={() => setIsNewAppointmentOpen(false)}
        onAddAppointment={handleAddAppointment}
        visitTypesList={visitTypesList}
      />

      {/* Database Architecture Inspector Modal */}
      {isDatabaseInspectorOpen && (
        <Suspense fallback={null}>
          <DatabaseInspectorModal
            isOpen={isDatabaseInspectorOpen}
            onClose={() => setIsDatabaseInspectorOpen(false)}
            users={users}
            doctorProfile={doctorProfile}
            clinicLocations={clinicLocations}
            patients={patientsCanonical}
            appointments={appointmentsCanonical}
            visits={visitsCanonical}
            invoices={invoicesCanonical}
            payments={paymentsCanonical}
            services={services}
            followUps={followUpsCanonical}
            prescriptions={prescriptionsCanonical}
            medications={medicationsCanonical}
            labTests={labTestsCanonical}
            labOrders={labOrdersCanonical}
            radiologyTypes={radiologyTypesCanonical}
            radiologyOrders={radiologyOrdersCanonical}
            diagnoses={diagnosesCanonical}
            symptoms={symptomsCanonical}
            chronicDiseases={chronicDiseasesCanonical}
            doctorSettings={doctorSettingsCanonical}
            systemSettings={systemSettingsCanonical}
          />
        </Suspense>
      )}
    </div>
  );
}

function isPublicBookingRoute() {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  const search = window.location.search;
  const path = window.location.pathname;
  return (
    hash === '#booking' ||
    hash.startsWith('#booking') ||
    search.includes('page=booking') ||
    search.includes('booking=true') ||
    path.endsWith('/booking') ||
    path.endsWith('/booking.html')
  );
}

function PublicBookingApp() {
  return (
    <div className="min-h-screen bg-[#080e1b] text-white p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <Suspense fallback={null}>
          {/* Standalone Landing Page Component */}
          <BookingLandingScreen />
        </Suspense>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const { currentUser, loading } = useAuth();
  const [isPublic, setIsPublic] = useState(isPublicBookingRoute);

  useEffect(() => {
    const handleCheck = () => setIsPublic(isPublicBookingRoute());
    window.addEventListener('hashchange', handleCheck);
    return () => window.removeEventListener('hashchange', handleCheck);
  }, []);

  if (isPublic) {
    return <PublicBookingApp />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080e1b] flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#00c2cb] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-medium">جارٍ تحميل بيانات الجلسة...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  return <ClinicApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
