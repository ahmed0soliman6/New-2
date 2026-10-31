import React, { useState, useEffect } from 'react';
import { QrCodeImage } from '../QrCodeImage';
import { exportPrescriptionToPdf } from '../../utils/exportPrescriptionPdf';
import { printPrescriptionDocument } from '../../utils/printPrescription';
import { CLINIC_INFO } from '../../data/previewClinicData';
import { getClinicBranches, findBranch, ClinicBranchItem } from '../../utils/clinicBranches';
import {
  ScreenType,
  PatientListItem,
  RadiologyCatalogItem,
  RadiologyOrderItem,
  LabCatalogItem,
  LabOrderItem,
  DrugCatalogItem,
  PrescriptionItem,
  DiagnosisCatalogItem,
  SymptomCatalogItem,
  QueueItem,
} from '../../types';
import { VitalsCard, type VitalsData } from '../examination/VitalsCard';
import { hasAnyVital } from '../../utils/vitalsMapper';
import { RadiologyCard } from '../examination/RadiologyCard';
import { LabCard } from '../examination/LabCard';
import { DiagnosisCard, PatientDiagnosis } from '../examination/DiagnosisCard';
import { MedicationsCard } from '../examination/MedicationsCard';
import { FollowupCard } from '../examination/FollowupCard';
import { PreviousVisitCard } from '../examination/PreviousVisitCard';
import { PatientDetailFullScreen } from './PatientDetailFullScreen';
import { READ_OPT } from '../../config/readOpt';
import { usePatientHistory, invalidatePatientHistory } from '../../services/history';
import { recordExamToClinicalMemory, getSmartClinicalSuggestions } from '../../utils/clinicalRecommender';
import {
  Visit,
  Prescription,
  LabOrder,
  RadiologyOrder,
} from '../../types/database';
import { usePermissions } from '../../context/AuthContext';
import { PermissionGate } from '../auth/PermissionGate';
import {
  loadExamDisplaySettings,
  ExamDisplaySettings,
} from '../../utils/examDisplaySettings';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatAppDate, formatAppTime } from '../../utils/numberUtils';
import {
  RecurringRxTemplate,
  loadRecurringTemplates,
  addOrUpdateRecurringTemplate,
  INITIAL_CLINICAL_GUIDES_TEMPLATES,
} from '../../utils/recurringTemplatesManager';

interface ChronicItem {
  id: string;
  name: string;
  category: string;
  color: string;
}

const MARGIN_VALUES: Record<string, string> = {
  very_tight: '2mm',
  tight: '4mm',
  normal: '7mm',
  wide: '10mm',
  very_wide: '14mm',
  balanced: '7mm',
};

interface ExaminationScreenProps {
  patient?: PatientListItem | null;
  availablePatients?: PatientListItem[];
  onSelectPatient?: (patient: PatientListItem | null) => void;
  queue?: QueueItem[];
  presetChronicConditions?: ChronicItem[];
  onNavigate: (screen: ScreenType) => void;
  onFinishExam: (data: {
    prescriptionItems: PrescriptionItem[];
    labOrders: LabOrderItem[];
    radiologyOrders: RadiologyOrderItem[];
    diagnoses: PatientDiagnosis[];
    followupDate: string;
    lifestyleAdvice: string;
    vitals?: Partial<VitalsData> | null;
    chiefComplaint?: string;
    examination?: string;
    history?: string;
  }) => void;

  // Catalogs and handlers
  radiologyCatalog: RadiologyCatalogItem[];
  onAddRadiologyToCatalog: (item: RadiologyCatalogItem) => void;
  labCatalog: LabCatalogItem[];
  onAddLabToCatalog: (item: LabCatalogItem) => void;
  drugCatalog: DrugCatalogItem[];
  onAddDrugToCatalog: (item: DrugCatalogItem) => void;
  diagnosesCatalog: DiagnosisCatalogItem[];
  onAddDiagnosisToCatalog: (item: DiagnosisCatalogItem) => void;
  symptomsCatalog: SymptomCatalogItem[];
  onAddSymptomToCatalog: (item: SymptomCatalogItem) => void;

  // Prescription syncing
  activePrescription: PrescriptionItem[];
  onChangeActivePrescription: (items: PrescriptionItem[]) => void;

  // Visit history and records
  visits?: Visit[];
  prescriptions?: Prescription[];
  allLabOrders?: LabOrder[];
  allRadiologyOrders?: RadiologyOrder[];
  currentVisitId?: string;
}

export const ExaminationScreen: React.FC<ExaminationScreenProps> = ({
  patient = null,
  availablePatients = [],
  onSelectPatient = (_patient: PatientListItem | null) => {},
  queue = [],
  presetChronicConditions = [],
  onNavigate,
  onFinishExam,
  radiologyCatalog,
  onAddRadiologyToCatalog,
  labCatalog,
  onAddLabToCatalog,
  drugCatalog,
  onAddDrugToCatalog,
  diagnosesCatalog,
  onAddDiagnosisToCatalog,
  symptomsCatalog,
  onAddSymptomToCatalog,
  activePrescription,
  onChangeActivePrescription,
  visits = [],
  prescriptions = [],
  allLabOrders = [],
  allRadiologyOrders = [],
  currentVisitId,
}) => {
  const { isRTL, language } = useLanguage();

  // On-demand clinical history for current patient when READ_OPT is true
  const hist = usePatientHistory(patient?.id, READ_OPT);
  const effVisits = READ_OPT ? hist.visits : visits;
  const effPrescriptions = READ_OPT ? hist.prescriptions : prescriptions;
  const effLabOrders = READ_OPT ? hist.labOrders : allLabOrders;
  const effRadOrders = READ_OPT ? hist.radiologyOrders : allRadiologyOrders;

  // Navigation tabs / quick section jump
  const [activeTab, setActiveTab] = useState<'all' | 'vitals' | 'symptoms' | 'lab' | 'rad' | 'diag' | 'rx' | 'followup'>('all');

  // Medical Dossier (Full EMR) view toggle
  const [showMedicalDossier, setShowMedicalDossier] = useState(false);

  // Display toggles from settings (Vitals, Labs, Radiology)
  const [displaySettings, setDisplaySettings] = useState<ExamDisplaySettings>(loadExamDisplaySettings);

  // Load layout settings for the prescription printing & PDF exporting
  const loadPrescriptionSettingsConfig = () => {
    try {
      const cached = localStorage.getItem('soli_prescription_settings');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {
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
      branches: CLINIC_INFO.branches.map((b, i) => ({
        id: `b-${i}`,
        name: b.name,
        address: b.address,
        phone: b.mobile,
      })),
    };
  };

  const [prescriptionConfig, setPrescriptionConfig] = useState<any>(loadPrescriptionSettingsConfig);

  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);

  const handleDirectPrint = () => {
    try {
      printPrescriptionDocument({
        config: prescriptionConfig,
        patient,
        items: activePrescription,
        diagnoses: patientDiagnoses,
        lifestyleAdvice,
        followupDate,
      });
    } catch (err) {
      console.warn('Iframe print error:', err);
    }
  };

  const handleExportPDF = () => {
    exportPrescriptionToPdf({
      config: prescriptionConfig,
      patient,
      items: activePrescription,
      diagnoses: patientDiagnoses,
      lifestyleAdvice,
      followupDate,
    }, patient ? patient.name : 'مريض');
  };

  // Sync display settings and prescription layout settings on mount and updates
  useEffect(() => {
    setDisplaySettings(loadExamDisplaySettings());
    const syncRxSettings = () => setPrescriptionConfig(loadPrescriptionSettingsConfig());
    window.addEventListener('soli_prescription_updated', syncRxSettings);
    window.addEventListener('storage', syncRxSettings);
    return () => {
      window.removeEventListener('soli_prescription_updated', syncRxSettings);
      window.removeEventListener('storage', syncRxSettings);
    };
  }, []);

  // Vital signs state for exam
  const [examVitals, setExamVitals] = useState<Partial<VitalsData>>({});
  const [initialExamVitals] = useState<Partial<VitalsData> | undefined>(() => {
    const activeVisit = visits.find(
      (v) =>
        (currentVisitId && v.visitId === currentVisitId) ||
        (patient?.id && v.patientId === patient.id && (v.status === 'IN_PROGRESS' || v.status === 'WAITING'))
    );
    const vs = activeVisit?.vitalSigns;
    if (!vs) return undefined;
    const mapped: Partial<VitalsData> = {
      bp: vs.bloodPressure || '',
      pulse: vs.pulse != null ? String(vs.pulse) : '',
      temp: vs.temperature != null ? String(vs.temperature) : '',
      rbs: vs.randomBloodSugar != null ? String(vs.randomBloodSugar) : '',
      weight: vs.weight != null ? String(vs.weight) : '',
      height: vs.height != null ? String(vs.height) : '',
      spo2: vs.oxygenSaturation != null ? String(vs.oxygenSaturation) : '',
    };
    return hasAnyVital(mapped) ? mapped : undefined;
  });

  // Consultation state - only loads registered data from visit registration if present
  const [complaint, setComplaint] = useState(patient?.chiefComplaint || '');
  const [physicalExam, setPhysicalExam] = useState('');
  const [patientChronicConditions, setPatientChronicConditions] = useState<string[]>(patient?.chronicConditions || []);
  const [isAddingChronic, setIsAddingChronic] = useState(false);
  const [newChronicInput, setNewChronicInput] = useState('');
  const [isEditingIntakeCard, setIsEditingIntakeCard] = useState(false);
  const [doctorSymptomInput, setDoctorSymptomInput] = useState('');

  // Editable Patient Details
  const [editablePatientName, setEditablePatientName] = useState(patient?.name || '');
  const [editablePatientPhone, setEditablePatientPhone] = useState(patient?.phone || '');
  const [editablePatientAge, setEditablePatientAge] = useState(patient?.age ? String(patient.age) : '');
  const [editablePatientGender, setEditablePatientGender] = useState<'male' | 'female' | ''>(patient?.gender || '');
  const [editablePatientAddress, setEditablePatientAddress] = useState(patient?.address || '');
  const [editablePatientBloodType, setEditablePatientBloodType] = useState(patient?.bloodType || 'غير محدد');
  const [isEditingPatientInfo, setIsEditingPatientInfo] = useState(false);
  const [customSymptomInput, setCustomSymptomInput] = useState('');
  const [selectedPatientIdForOpen, setSelectedPatientIdForOpen] = useState<string>('');

  // Dynamic Radiology Orders - starts empty
  const [radiologyOrders, setRadiologyOrders] = useState<RadiologyOrderItem[]>([]);

  // Dynamic Lab Orders - starts empty
  const [labOrders, setLabOrders] = useState<LabOrderItem[]>([]);

  // Dynamic Patient Diagnoses - starts empty
  const [patientDiagnoses, setPatientDiagnoses] = useState<PatientDiagnosis[]>([]);

  // Follow-up: initially empty so doctor decides whether and when to schedule
  const [followupDate, setFollowupDate] = useState('');
  const [lifestyleAdvice, setLifestyleAdvice] = useState('');

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copiedWhatsAppText, setCopiedWhatsAppText] = useState(false);

  // Clinic Branches for WhatsApp message
  const [clinicBranches, setClinicBranches] = useState<ClinicBranchItem[]>(() => getClinicBranches());
  const [selectedWhatsAppBranchId, setSelectedWhatsAppBranchId] = useState<string>(() => {
    const branches = getClinicBranches();
    if (patient?.branch) {
      const match = branches.find((b) => b.name === patient.branch || b.id === patient.branch);
      if (match) return match.id;
    }
    return branches[0]?.id || '';
  });

  useEffect(() => {
    const handleUpdate = () => {
      const updated = getClinicBranches();
      setClinicBranches(updated);
    };
    window.addEventListener('soli_branches_updated', handleUpdate);
    return () => window.removeEventListener('soli_branches_updated', handleUpdate);
  }, []);

  const handleOpenExamForQueuePatient = (item: QueueItem) => {
    const matched = availablePatients.find((p) => p.id === item.patientId || p.id === item.id || p.name === item.patientName);
    if (matched) {
      if (onSelectPatient) onSelectPatient(matched);
    } else {
      const fallback: PatientListItem = {
        id: item.patientId || item.id,
        name: item.patientName,
        medicalCode: item.medicalCode || 'EG-NEW',
        fileNumber: item.fileNumber || 1,
        phone: item.phone || '',
        age: item.age || 0,
        gender: item.gender || '',
        governorate: '',
        address: item.address || '',
        allergies: [],
        chronicConditions: item.chronicConditions || [],
        bloodType: item.bloodType || 'غير محدد',
        bloodGroup: item.bloodType || 'غير محدد',
        visitsCount: 1,
        chiefComplaint: item.complaint || '',
        intakeSymptoms: item.complaint ? [item.complaint] : [],
        lastDiagnosis: '',
      };
      if (onSelectPatient) onSelectPatient(fallback);
    }
  };

  // Keep in sync if patient prop changes
  useEffect(() => {
    setComplaint(patient?.chiefComplaint || '');
    setPatientChronicConditions(patient?.chronicConditions || []);
    setEditablePatientName(patient?.name || '');
    setEditablePatientPhone(patient?.phone || '');
    setEditablePatientAge(patient?.age ? String(patient.age) : '');
    setEditablePatientGender(patient?.gender || '');
    setEditablePatientAddress(patient?.address || '');
    setEditablePatientBloodType(patient?.bloodType || 'غير محدد');
  }, [patient?.id, patient?.chiefComplaint, patient?.chronicConditions, patient?.name, patient?.phone, patient?.age, patient?.gender, patient?.address, patient?.bloodType]);

  // Derive previous visit details for the current patient
  const {
    hasPreviousVisit,
    previousVisit,
    previousPrescription,
    previousLabOrders,
    previousRadiologyOrders,
    totalVisitsCount,
  } = React.useMemo(() => {
    if (!patient) {
      return {
        hasPreviousVisit: false,
        previousVisit: null,
        previousPrescription: null,
        previousLabOrders: [] as LabOrder[],
        previousRadiologyOrders: [] as RadiologyOrder[],
        totalVisitsCount: 0,
      };
    }

    const patientVisits = (effVisits || []).filter((v) => v.patientId === patient.id);

    // Past visits: COMPLETED visits, or visits with different ID than currentVisitId and not in-progress/waiting
    const pastVisits = patientVisits
      .filter((v) => {
        if (currentVisitId && v.visitId === currentVisitId) return false;
        return (
          v.status === 'COMPLETED' ||
          v.visitId.includes('prev') ||
          (v.status !== 'IN_PROGRESS' && v.status !== 'WAITING')
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Find the latest past visit that ACTUALLY has a registered prescription
    let latestVisitWithRx: Visit | null = null;
    let registeredRx: Prescription | null = null;

    for (const v of pastVisits) {
      const rx = (effPrescriptions || []).find((p) => p.visitId === v.visitId);
      if (rx && rx.items && rx.items.length > 0) {
        latestVisitWithRx = v;
        registeredRx = rx;
        break;
      }
    }

    // STRICT RULE: Only show the previous visit card if there is a real previous visit AND a registered prescription
    if (!latestVisitWithRx || !registeredRx) {
      return {
        hasPreviousVisit: false,
        previousVisit: null,
        previousPrescription: null,
        previousLabOrders: [] as LabOrder[],
        previousRadiologyOrders: [] as RadiologyOrder[],
        totalVisitsCount: pastVisits.length,
      };
    }

    const labs = (effLabOrders || []).filter((l) => l.visitId === latestVisitWithRx!.visitId);
    const rads = (effRadOrders || []).filter((r) => r.visitId === latestVisitWithRx!.visitId);

    const totalCount = Math.max(1, pastVisits.length > 0 ? pastVisits.length : patient.visitsCount || 1);

    return {
      hasPreviousVisit: true,
      previousVisit: latestVisitWithRx,
      previousPrescription: registeredRx,
      previousLabOrders: labs,
      previousRadiologyOrders: rads,
      totalVisitsCount: totalCount,
    };
  }, [patient, effVisits, effPrescriptions, effLabOrders, effRadOrders, currentVisitId]);

  // Recurring Prescription Templates State
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringRxTemplate[]>(loadRecurringTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Save as recurring template modal state
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateTitleInput, setTemplateTitleInput] = useState('');
  const [templateCategoryInput, setTemplateCategoryInput] = useState('باطنة عامة');
  const [showClinicalGuidesPicker, setShowClinicalGuidesPicker] = useState(false);

  // Sync templates list if updated elsewhere (e.g. settings screen template deletion)
  useEffect(() => {
    const handleSyncTemplates = () => {
      setRecurringTemplates(loadRecurringTemplates());
    };
    window.addEventListener('soli_templates_updated', handleSyncTemplates);
    return () => {
      window.removeEventListener('soli_templates_updated', handleSyncTemplates);
    };
  }, []);

  const handleApplyRecurringTemplate = (templateId: string) => {
    const tmpl = recurringTemplates.find((t) => t.id === templateId);
    if (!tmpl) return;
    if (tmpl.diagnoses && tmpl.diagnoses.length > 0) {
      setPatientDiagnoses(tmpl.diagnoses.map((d) => ({
        id: d.id || `diag-${Date.now()}`,
        code: d.code,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        isPrimary: d.isPrimary ?? true,
      })));
    }
    if (tmpl.prescription && tmpl.prescription.length > 0) {
      onChangeActivePrescription(tmpl.prescription);
    }
    if (tmpl.lifestyleAdvice) {
      setLifestyleAdvice(tmpl.lifestyleAdvice);
    }
    setSelectedTemplateId(templateId);
    setToastMessage(`تم استدعاء القالب "${tmpl.title}" وتعبئة الأدوية والتشخيص بنجاح ✓`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSaveCurrentAsRecurringTemplate = () => {
    if (patientDiagnoses.length === 0 && activePrescription.length === 0) {
      setToastMessage('يرجى إضافة تشخيص أو أدوية على الأقل قبل حفظ القائمة المتكررة.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    const primaryDiag = patientDiagnoses.find((d) => d.isPrimary)?.nameAr || patientDiagnoses[0]?.nameAr;
    const defaultName = primaryDiag ? `روشتة ${primaryDiag}` : 'روشتة كشف واستشارة';
    setTemplateTitleInput(defaultName);
    setTemplateCategoryInput('باطنة عامة');
    setShowSaveTemplateModal(true);
  };

  const handleConfirmSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitleInput.trim()) return;

    const newTemplate: RecurringRxTemplate = {
      id: `tmpl-${Date.now()}`,
      title: templateTitleInput.trim(),
      category: templateCategoryInput.trim() || 'باطنة عامة',
      diagnoses: [...patientDiagnoses],
      prescription: [...activePrescription],
      lifestyleAdvice: lifestyleAdvice || '',
      isFavorite: true,
    };

    const updated = addOrUpdateRecurringTemplate(newTemplate);
    setRecurringTemplates(updated);
    setSelectedTemplateId(newTemplate.id);
    setShowSaveTemplateModal(false);
    setToastMessage(`تم حفظ القائمة المتكررة "${templateTitleInput.trim()}" بنجاح! يمكنك استدعاؤها في أي كشف قادم.`);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleImportClinicalGuideDirectly = (guide: RecurringRxTemplate) => {
    if (guide.diagnoses && guide.diagnoses.length > 0) {
      setPatientDiagnoses(guide.diagnoses.map((d) => ({
        id: d.id || `diag-${Date.now()}`,
        code: d.code,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        isPrimary: d.isPrimary ?? true,
      })));
    }
    if (guide.prescription && guide.prescription.length > 0) {
      onChangeActivePrescription(guide.prescription);
    }
    if (guide.lifestyleAdvice) {
      setLifestyleAdvice(guide.lifestyleAdvice);
    }
    setShowClinicalGuidesPicker(false);
    setToastMessage(`تم استدعاء "${guide.title}" وتطبيقه على الروشتة الحالية بنجاح ✓`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Derive smart clinical suggestions based on patient complaint, diagnosis & history
  const smartSuggestions = React.useMemo(() => {
    return getSmartClinicalSuggestions(
      effVisits || [],
      effPrescriptions || [],
      effLabOrders || [],
      effRadOrders || [],
      patientDiagnoses || []
    );
  }, [effVisits, effPrescriptions, effLabOrders, effRadOrders, patientDiagnoses]);

  // Add custom or preset chronic condition
  const handleToggleChronicCondition = (condition: string) => {
    if (patientChronicConditions.includes(condition)) {
      setPatientChronicConditions((prev) => prev.filter((c) => c !== condition));
    } else {
      setPatientChronicConditions((prev) => [...prev, condition]);
    }
  };

  const handleAddCustomChronic = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newChronicInput.trim();
    if (trimmed && !patientChronicConditions.includes(trimmed)) {
      setPatientChronicConditions((prev) => [...prev, trimmed]);
      setNewChronicInput('');
      setIsAddingChronic(false);
    }
  };

  // Generate WhatsApp formatted message
  const generateWhatsAppMessage = () => {
    const todayStr = formatAppDate(new Date(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }, language);

    const diagnosisList = patientDiagnoses.length > 0
      ? patientDiagnoses.map((d) => d.nameAr).join('، ')
      : (language === 'en' ? 'Internal Medicine Consultation' : 'فحص واستشارة باطنة');

    let medsSection = '';
    if (activePrescription.length > 0) {
      const medsList = activePrescription
        .map(
          (item, idx) =>
            `  ${idx + 1}. *${item.drugName}* ${item.dosageForm ? `(${item.dosageForm})` : ''}\n     • الجرعة والمدة: ${item.dosage || 'قرص'}${item.timing ? ` — ${item.timing}` : ''}${item.duration ? ` — ${item.duration}` : ''}${item.notes ? ` (${item.notes})` : ''}`
        )
        .join('\n');
      medsSection = `\n\n💊 *الأدوية الموصوفة:*\n${medsList}`;
    }

    let labsSection = '';
    if (labOrders.length > 0) {
      const labsListStr = labOrders
        .map((l, idx) => `  ${idx + 1}. *${l.testName}*`)
        .join('\n');
      labsSection = `\n\n🧪 *الفحوصات والتحاليل المعملية المطلوبة:*\n${labsListStr}`;
    }

    let radsSection = '';
    if (radiologyOrders.length > 0) {
      const radsListStr = radiologyOrders
        .map((r, idx) => `  ${idx + 1}. *${r.name}*`)
        .join('\n');
      radsSection = `\n\n🩻 *الأشعة والموجات الصوتية المطلوبة:*\n${radsListStr}`;
    }

    let adviceSection = '';
    if (lifestyleAdvice) {
      adviceSection = `\n\n📝 *تعليمات وإرشادات الطبيب:*\n${lifestyleAdvice}`;
    }

    let followUpSection = '';
    if (followupDate) {
      try {
        const formattedFollowUp = formatAppDate(followupDate, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }, language);
        followUpSection = `\n\n🗓 *موعد المتابعة الاستشارية القادمة:* ${formattedFollowUp}`;
      } catch {
        followUpSection = `\n\n🗓 *موعد المتابعة الاستشارية القادمة:* ${followupDate}`;
      }
    }

    const activeBranch =
      clinicBranches.find((b) => b.id === selectedWhatsAppBranchId) ||
      clinicBranches[0] ||
      findBranch();
    const activeBranchPhone = activeBranch.phone || activeBranch.mobile || '01092847162';
    const doctorDisplayName = prescriptionConfig.doctorName || CLINIC_INFO.doctorName;

    return `مرحباً بك أستاذ/ة *${patient?.name || 'مريض'}* 🌸
إليك تفاصيل وتقارير زيارتكم الطبية لدى *عيادة ${doctorDisplayName}* 🩺

🗓 *تاريخ الزيارة:* ${todayStr}
📋 *التشخيص الإكلينيكي:* ${diagnosisList}${medsSection}${labsSection}${radsSection}${adviceSection}${followUpSection}

📍 *الفرع:* ${activeBranch.name}${activeBranch.address ? `\nالعنوان: ${activeBranch.address}` : ''}
📞 *للتأكيد والاستفسار:* ${activeBranchPhone}
مع تمنياتنا لكم بتمام الشفاء ودوام الصحة والعافية ✨`;
  };

  const getCleanPatientWhatsAppUrl = () => {
    const raw = patient?.phone || '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '2' + digits;
    } else if (!digits.startsWith('20') && digits.length === 10) {
      digits = '20' + digits;
    }
    const msg = encodeURIComponent(generateWhatsAppMessage());
    return `https://wa.me/${digits}?text=${msg}`;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text);
    setCopiedWhatsAppText(true);
    setTimeout(() => setCopiedWhatsAppText(false), 3000);
  };

  const handleSavePatientInfo = async () => {
    if (!patient) return;
    try {
      const birthYear = new Date().getFullYear() - (parseInt(editablePatientAge, 10) || 30);
      const dob = `${birthYear}-01-01`;
      
      const updatedData = {
        fullName: editablePatientName.trim(),
        phone: editablePatientPhone.trim(),
        dateOfBirth: dob,
        gender: editablePatientGender === 'female' ? 'female' : 'male',
        address: editablePatientAddress.trim(),
        bloodType: editablePatientBloodType,
        updatedAt: new Date().toISOString(),
      };

      // 1. Update Firestore
      const { db } = await import('../../services/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      if (db) {
        const patientRef = doc(db, 'patients', patient.id);
        await updateDoc(patientRef, updatedData);
        console.log('Patient basic details successfully updated in Firestore!');
      }

      // 2. Propagate to App state
      onSelectPatient({
        ...patient,
        name: editablePatientName.trim(),
        phone: editablePatientPhone.trim(),
        age: parseInt(editablePatientAge, 10) || 30,
        gender: editablePatientGender === 'female' ? 'female' : 'male',
        address: editablePatientAddress.trim(),
        bloodType: editablePatientBloodType,
        bloodGroup: editablePatientBloodType,
      });

      setIsEditingPatientInfo(false);
    } catch (err) {
      console.error('Error updating patient basic details:', err);
      alert('حدث خطأ أثناء حفظ التعديلات.');
    }
  };

  const handleSaveIntakeAndChronic = async () => {
    if (!patient) return;
    try {
      const updatedData = {
        chiefComplaint: complaint.trim(),
        chronicDiseases: patientChronicConditions,
        updatedAt: new Date().toISOString(),
      };

      // 1. Update Firestore
      const { db } = await import('../../services/firebase');
      const { doc, updateDoc } = await import('firebase/firestore');
      if (db) {
        const patientRef = doc(db, 'patients', patient.id);
        await updateDoc(patientRef, updatedData);
        console.log('Patient chief complaint and chronic conditions updated in Firestore!');
      }

      // 2. Propagate to App state
      onSelectPatient({
        ...patient,
        chiefComplaint: complaint.trim(),
        chronicConditions: patientChronicConditions,
      });

      setIsEditingIntakeCard(false);
    } catch (err) {
      console.error('Error updating patient intake/chronic:', err);
      alert('حدث خطأ أثناء حفظ التعديلات.');
    }
  };

  const { assertPermission, canAccess, role, userProfile } = usePermissions();
  const isAllowed = canAccess('clinical-exam');
  const [isExamFinished, setIsExamFinished] = useState(false);

  const handleFinish = () => {
    if (!isAllowed) {
      alert('غير مصرح لك بإنهاء الكشف الطبي أو حفظ الزيارة.');
      return;
    }
    if (patientDiagnoses.length === 0) {
      alert('يرجى إدخال أو اختيار تشخيص طبي واحد على الأقل قبل إنهاء الكشف وحفظ الزيارة.');
      if (activeTab !== 'all' && activeTab !== 'diag') {
        setActiveTab('diag');
      }
      return;
    }
    try {
      assertPermission('clinical.complete', 'إنهاء الكشف وحفظ الزيارة');
      setIsExamFinished(true);
      recordExamToClinicalMemory({
        prescriptionItems: activePrescription,
        labOrders,
        radiologyOrders,
        diagnoses: patientDiagnoses,
        lifestyleAdvice,
      });
      if (patient?.id) {
        invalidatePatientHistory(patient.id);
      }
      onFinishExam({
        prescriptionItems: activePrescription,
        labOrders,
        radiologyOrders,
        diagnoses: patientDiagnoses,
        followupDate,
        lifestyleAdvice,
        vitals: hasAnyVital(examVitals) ? examVitals : null,
        chiefComplaint: complaint.trim(),
        examination: physicalExam.trim(),
        history: '',
      });
      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        const el = document.getElementById('finished-exam-summary');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 1600);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ليس لديك صلاحية لإنهاء الكشف.');
    }
  };

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center max-w-xl mx-auto space-y-5">
        <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined text-4xl">gpp_bad</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            غير مصرح بالوصول إلى غرفة الكشف الطبي
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            حسابك الحالي ({userProfile?.displayName || userProfile?.username || 'المستخدم'}) بدور ({role}) لا يمتلك صلاحية الوصول لشاشة الكشف الإكلينيكي أو تحرير السجلات الطبية.
          </p>
        </div>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-6 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          العودة للوحة التحكم المسموحة
        </button>
      </div>
    );
  }

  // 1. If no patient exam is opened yet, display the dedicated waiting / browse view
  if (!patient) {
    return (
      <div className="flex flex-col w-full max-w-full overflow-x-hidden pb-28 space-y-6 text-slate-800 dark:text-[#dde2f5]">
        {/* Top Header */}
        <div className="bg-white dark:bg-[#111A2E] p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-3xl">stethoscope</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  غرفة الكشف الطبي
                </h1>
                <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 text-xs font-bold">
                  بانتظار فتح الكشف
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#859394] mt-1.5 leading-relaxed">
                لا تظهر بيانات المريض أو تفاصيل الزيارات السابقة إلا عند الضغط على «فتح الكشف». اختر مريضاً لبدء الجلسة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('new-visit')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 text-[#008f97] dark:text-[#45dee7] text-xs sm:text-sm font-bold border border-teal-200 dark:border-teal-800/40 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span>+ تسجيل مريض جديد</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('waiting-queue')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-lg">groups</span>
              <span>قائمة الانتظار ({queue?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Patients in Waiting Queue (Ready for Exam) */}
        {queue && queue.length > 0 && (
          <div className="bg-white dark:bg-[#111A2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">timer</span>
                <h2 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
                  مرضى في صالة الانتظار (جاهزون للكشف)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] text-xs font-bold font-mono">
                  {queue.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-white/10 hover:border-[#00c2cb] dark:hover:border-[#00c2cb] bg-slate-50/60 dark:bg-white/5 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7]">
                        تذكرة #{item.ticketNumber}
                      </span>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {item.arrivalTime}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2">
                      {item.patientName}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#859394] line-clamp-1 mt-1">
                      {item.complaint || 'كشف عيادة'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenExamForQueuePatient(item)}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">stethoscope</span>
                    <span>فتح الكشف</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Select registered patient to open exam */}
        <div className="bg-white dark:bg-[#111A2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">person_search</span>
            <h2 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
              اختيار مريض من السجلات الطبية لفتح الكشف
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <select
              value={selectedPatientIdForOpen}
              onChange={(e) => setSelectedPatientIdForOpen(e.target.value)}
              className="w-full sm:flex-1 bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs sm:text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
            >
              <option value="">-- اختر مريضاً لفتح كشفه الطبي --</option>
              {availablePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone ? `${p.phone} • ` : ''}ملف #{p.fileNumber || p.medicalCode})
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!selectedPatientIdForOpen}
              onClick={() => {
                const matched = availablePatients.find((p) => p.id === selectedPatientIdForOpen);
                if (matched && onSelectPatient) {
                  onSelectPatient(matched);
                }
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs sm:text-sm shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <span className="material-symbols-outlined text-lg">stethoscope</span>
              <span>فتح الكشف</span>
            </button>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-xs flex items-center gap-3">
          <span className="material-symbols-outlined text-lg shrink-0">info</span>
          <span>
            تنبيه خصوصية: لا يتم عرض بيانات المريض أو بطاقة الزيارة السابقة إلا بعد الضغط على «فتح الكشف» رسمياً.
          </span>
        </div>
      </div>
    );
  }

  // 2. Patient Exam is Open: Render Patient Details + Standalone Previous Visit Card + Clinical Examination
  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden pb-28 space-y-6 text-slate-800 dark:text-[#dde2f5]">
      {/* 1. Basic Patient Details Card (Completely separate from previous visit) */}
      <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs space-y-4">
        <div className="flex flex-col gap-4">
          {/* Patient Details Header */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 sm:gap-4 min-w-0">
            <div className="flex items-start gap-3.5 min-w-0 flex-1 w-full">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                {(editablePatientName || patient.name || 'م').charAt(0)}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {!isEditingPatientInfo ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#dde2f5] break-words max-w-full">
                        {editablePatientName}
                      </h1>
                      {editablePatientPhone && (
                        <div className="text-xs text-slate-700 dark:text-[#dde2f5] flex items-center gap-1.5 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-lg font-mono font-bold border border-slate-200/60 dark:border-white/5">
                          <span className="material-symbols-outlined text-xs text-teal-600 dark:text-[#00c2cb] shrink-0">call</span>
                          <span dir="ltr">{editablePatientPhone}</span>
                        </div>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] text-[11px] font-bold whitespace-nowrap">
                        رقم الملف: #{patient.fileNumber || 1}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-[#859394] leading-relaxed">
                      <span className="whitespace-nowrap">{editablePatientAge} سنة</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{patient.gender === 'female' ? 'أنثى' : 'ذكر'}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">
                        فصيلة الدم:{' '}
                        <strong className="text-[#008f97] dark:text-[#00c2cb] font-mono font-bold">
                          {patient.bloodType || 'غير محدد'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        العنوان:{' '}
                        <strong className="text-slate-700 dark:text-[#dde2f5]">
                          {patient.address || 'غير محدد'}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingPatientInfo(true)}
                        className="text-[11px] text-[#008f97] dark:text-[#00c2cb] hover:underline font-bold px-1 inline-block whitespace-nowrap"
                        title="تعديل اسم أو سن أو هاتف المريض"
                      >
                        [تعديل البيانات الأساسية]
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl shadow-md border-2 border-[#00c2cb] flex flex-col gap-4 w-full text-right mt-2 animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl">badge</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-[#dde2f5]">1. البيانات الشخصية والتعريفية</span>
                      </div>
                      <span className="text-xs bg-teal-50 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] font-bold px-3 py-1 rounded-full border border-[#00c2cb]/30">
                        تعديل بيانات مريض مسجل
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">
                          اسم المريض <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={editablePatientName}
                          onChange={(e) => setEditablePatientName(e.target.value)}
                          placeholder="أدخل اسم المريض..."
                          className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                        />
                      </div>

                      {/* Phone */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">رقم الهاتف / الواتساب</label>
                        <input
                          type="tel"
                          value={editablePatientPhone}
                          onChange={(e) => setEditablePatientPhone(e.target.value)}
                          placeholder="01xxxxxxxxx"
                          className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                        />
                      </div>

                      {/* Age */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">السن (بالسنوات)</label>
                        <input
                          type="number"
                          value={editablePatientAge}
                          onChange={(e) => setEditablePatientAge(e.target.value)}
                          placeholder="أدخل السن..."
                          className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-mono focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                        />
                      </div>

                      {/* Gender */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">النوع / الجنس</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setEditablePatientGender('male')}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              editablePatientGender === 'male'
                                ? 'bg-teal-50 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] border-[#00c2cb] ring-1 ring-[#00c2cb]'
                                : 'bg-slate-50 dark:bg-[#080e1b] text-slate-600 dark:text-[#859394] border-slate-200 dark:border-white/5'
                            }`}
                          >
                            ذكر
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditablePatientGender('female')}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              editablePatientGender === 'female'
                                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-[#d0bcff] border-purple-500 ring-1 ring-purple-500'
                                : 'bg-slate-50 dark:bg-[#080e1b] text-slate-600 dark:text-[#859394] border-slate-200 dark:border-white/5'
                            }`}
                          >
                            أنثى
                          </button>
                        </div>
                      </div>

                      {/* Address */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">العنوان / محل الإقامة</label>
                        <input
                          type="text"
                          value={editablePatientAddress}
                          onChange={(e) => setEditablePatientAddress(e.target.value)}
                          placeholder="أدخل العنوان بالتفصيل..."
                          className="bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 dark:placeholder:text-[#859394] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                        />
                      </div>

                      {/* Blood Type */}
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-[#dde2f5]">فصيلة الدم</label>
                        <select
                          value={editablePatientBloodType}
                          onChange={(e) => setEditablePatientBloodType(e.target.value)}
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

                    <div className="flex items-center gap-3 mt-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditingPatientInfo(false)}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#080e1b] dark:hover:bg-[#111A2E] text-slate-700 dark:text-[#dde2f5] font-bold text-xs cursor-pointer border border-slate-200 dark:border-white/5"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePatientInfo}
                        className="px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                      >
                        حفظ التعديلات ✓
                      </button>
                    </div>
                  </div>
                )}

                {/* Badges: Allergies */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {patient.allergies && patient.allergies.length > 0 && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-[11px] font-bold">
                      <span className="material-symbols-outlined text-sm shrink-0">warning</span>
                      <span className="leading-snug">حساسية: {patient.allergies.join('، ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons: Medical Dossier & Close / Select Another Patient */}
            <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => {
                  setShowMedicalDossier(true);
                }}
                className="w-full md:w-auto px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                title="فتح وتحميل وتصفح الملف الطبي الشامل للمريض (PDF)"
              >
                <span className="material-symbols-outlined text-sm shrink-0">folder_shared</span>
                <span className="whitespace-nowrap truncate">الملف الطبي الشامل</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onSelectPatient) {
                    onSelectPatient(null as any);
                  }
                }}
                className="w-full md:w-auto px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                title="إغلاق هذا الكشف والعودة لاختيار مريض"
              >
                <span className="material-symbols-outlined text-sm shrink-0">close</span>
                <span className="whitespace-nowrap truncate">إغلاق الكشف / مريض آخر</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Standalone Previous Visit Card (Separated from patient details, ONLY rendered if previous visit exists AND has prescription) */}
      {hasPreviousVisit && previousVisit && previousPrescription && (
        <div className="w-full">
          <PreviousVisitCard
            patient={patient}
            visit={previousVisit}
            totalVisitsCount={totalVisitsCount}
            prescription={previousPrescription}
            labOrders={previousLabOrders}
            radiologyOrders={previousRadiologyOrders}
            onCopyMedications={(meds) => {
              onChangeActivePrescription([...activePrescription, ...meds]);
            }}
          />
        </div>
      )}



      {/* 3. Responsive Section Jump Tabs & Examination Cards */}
      <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs space-y-4">

        {/* Responsive Section Jump Tabs (Dynamically respects displaySettings) */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {language === 'en' ? 'All Cards' : 'عرض الكل'}
          </button>

          {/* Vitals Tab */}
          {displaySettings.showVitals && (
            <button
              type="button"
              onClick={() => setActiveTab('vitals')}
              className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'vitals'
                  ? 'bg-teal-600 text-white font-bold'
                  : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              {language === 'en' ? 'Vital Signs' : 'العلامات الحيوية'}
            </button>
          )}

          {/* Symptoms Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('symptoms')}
            className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'symptoms'
                ? 'bg-purple-600 text-white font-bold'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {language === 'en' ? 'Intake & Chronic' : 'الشكوى والأمراض المزمنة'}
          </button>

          {/* Labs Tab */}
          {displaySettings.showLabs && (
            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'lab'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span>{language === 'en' ? 'Labs & Diagnostics' : 'المعمل والتحاليل'}</span>
              <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-white/20 text-emerald-800 dark:text-white text-[10px] flex items-center justify-center font-bold">
                {labOrders.length}
              </span>
            </button>
          )}

          {/* Radiology Tab */}
          {displaySettings.showRadiology && (
            <button
              type="button"
              onClick={() => setActiveTab('rad')}
              className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rad'
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <span>{language === 'en' ? 'Radiology & Imaging' : 'الأشعة والتصوير'}</span>
              <span className="w-4 h-4 rounded-full bg-sky-100 dark:bg-white/20 text-sky-800 dark:text-white text-[10px] flex items-center justify-center font-bold">
                {radiologyOrders.length}
              </span>
            </button>
          )}

          {/* Diagnosis Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('diag')}
            className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'diag'
                ? 'bg-amber-500 text-slate-900 font-bold'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span>{language === 'en' ? 'Diagnosis' : 'التشخيص'}</span>
            <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 text-[10px] flex items-center justify-center font-bold">
              {patientDiagnoses.length}
            </span>
          </button>

          {/* Rx Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('rx')}
            className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rx'
                ? 'bg-[#00c2cb] text-slate-900 font-bold'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <span>{language === 'en' ? 'Medications & Rx' : 'الأدوية والروشتة'}</span>
            <span className="w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-800 text-[10px] flex items-center justify-center font-bold">
              {activePrescription.length}
            </span>
          </button>

          {/* Followup Tab */}
          <button
            type="button"
            onClick={() => setActiveTab('followup')}
            className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'followup'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {language === 'en' ? 'Follow-up & Guidance' : 'المتابعة والنظام الغذائي'}
          </button>
        </div>
      </div>

      {/* DYNAMIC EXAMINATION CARDS (Modular Responsive Architecture) */}
      <div className="space-y-6">
        {/* 8. Patient Intake, Complaints & Chronic Conditions Card (Moved to top as requested) */}
        {patient && (
          <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-lg">medical_information</span>
                <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5]">
                  {language === 'en' ? 'Intake & Chronic Conditions' : 'الشكوى والأعراض والأمراض المزمنة'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingIntakeCard(!isEditingIntakeCard)}
                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>
                  {isEditingIntakeCard
                    ? (language === 'en' ? 'Close Edit' : 'إغلاق التعديل')
                    : (language === 'en' ? 'Edit Complaints & Chronic' : 'تعديل الشكوى والأمراض')}
                </span>
              </button>
            </div>

            {/* View Mode */}
            {!isEditingIntakeCard ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Symptoms & Complaint */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-[#859394] block text-[11px]">
                    {language === 'en' ? 'Presented Complaints & Symptoms:' : 'الشكوى والأعراض المقدمة:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {complaint ? (
                      complaint.split('•').map((item, idx) => (
                        <span
                          key={idx}
                          data-no-translate="true"
                          className="px-2.5 py-1 rounded-lg bg-teal-100/70 dark:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] font-bold text-[11px] border border-[#00c2cb]/30 no-translate clinical-data"
                        >
                          {item.trim()}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        {language === 'en' ? 'No symptoms recorded' : 'لا توجد أعراض مسجلة'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Chronic Diseases */}
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-[#859394] block text-[11px]">
                    {language === 'en' ? "Patient's Chronic Conditions:" : 'الأمراض المزمنة للمريض:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {patientChronicConditions.length > 0 ? (
                      patientChronicConditions.map((cond) => (
                        <span
                          key={cond}
                          data-no-translate="true"
                          className="px-2.5 py-1 rounded-lg bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold text-[11px] border border-rose-300 dark:border-rose-900/40 no-translate clinical-data"
                        >
                          {cond}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        {language === 'en' ? 'No chronic conditions recorded' : 'لا توجد أمراض مزمنة مسجلة'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode: Doctor can edit/add using both preset catalogs and custom inputs */
              <div className="flex flex-col gap-6 w-full text-right mt-2 animate-in fade-in">
                {/* Card 2: Symptoms & Complaints */}
                <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl border-2 border-[#00c2cb] flex flex-col gap-4 shadow-sm">
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
                        const current = complaint.split('•').map(s => s.trim()).filter(Boolean);
                        if (!current.includes(val)) {
                          const newComplaint = [...current, val].join(' • ');
                          setComplaint(newComplaint);
                        }
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

                  {/* Selected Symptoms Pills */}
                  {complaint.split('•').map((s) => s.trim()).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-[#080e1b] rounded-xl border border-slate-200 dark:border-white/5">
                      {complaint.split('•').map((s) => s.trim()).filter(Boolean).map((sym, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-xl bg-teal-100 dark:bg-[#00c2cb]/20 border border-[#00c2cb]/30 text-[#008f97] dark:text-[#45dee7] text-xs font-bold flex items-center gap-2 shadow-2xs"
                        >
                          <span>{sym}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const filtered = complaint
                                .split('•')
                                .map((s) => s.trim())
                                .filter((s, i) => i !== idx && Boolean(s));
                              setComplaint(filtered.join(' • '));
                            }}
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
                      value={doctorSymptomInput}
                      onChange={(e) => setDoctorSymptomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = doctorSymptomInput.trim();
                          if (val) {
                            const current = complaint.split('•').map(s => s.trim()).filter(Boolean);
                            if (!current.includes(val)) {
                              setComplaint([...current, val].join(' • '));
                            }
                            setDoctorSymptomInput('');
                          }
                        }
                      }}
                      placeholder="أدخل عرض آخر غير موجود بالقائمة..."
                      className="flex-1 bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = doctorSymptomInput.trim();
                        if (val) {
                          const current = complaint.split('•').map(s => s.trim()).filter(Boolean);
                          if (!current.includes(val)) {
                            setComplaint([...current, val].join(' • '));
                          }
                          setDoctorSymptomInput('');
                        }
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-[#00c2cb] text-slate-950 font-bold text-xs hover:bg-[#45dee7] transition-all cursor-pointer shrink-0"
                    >
                      + إضافة عرض
                    </button>
                  </div>
                </div>

                {/* Card 3: Chronic Diseases */}
                <div className="bg-white dark:bg-[#111A2E] p-4 sm:p-6 rounded-2xl border-2 border-rose-500 flex flex-col gap-4 shadow-sm">
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
                        if (!patientChronicConditions.includes(val)) {
                          setPatientChronicConditions([...patientChronicConditions, val]);
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
                  {patientChronicConditions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {patientChronicConditions.map((item) => (
                        <span
                          key={item}
                          className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 shadow-2xs"
                        >
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setPatientChronicConditions(patientChronicConditions.filter(c => c !== item));
                            }}
                            className="hover:text-red-900 dark:hover:text-white cursor-pointer font-bold text-xs"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Box for Adding Custom Chronic Condition */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newChronicInput}
                      onChange={(e) => setNewChronicInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = newChronicInput.trim();
                          if (val) {
                            if (!patientChronicConditions.includes(val)) {
                              setPatientChronicConditions([...patientChronicConditions, val]);
                            }
                            setNewChronicInput('');
                          }
                        }
                      }}
                      placeholder="إضافة مرض مزمن جديد غير موجود بالقائمة..."
                      className="flex-1 bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] placeholder:text-slate-400 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newChronicInput.trim();
                        if (val) {
                          if (!patientChronicConditions.includes(val)) {
                            setPatientChronicConditions([...patientChronicConditions, val]);
                          }
                          setNewChronicInput('');
                        }
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all cursor-pointer shrink-0"
                    >
                      + إضافة مرض مزمن
                    </button>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="flex items-center gap-3 mt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setComplaint(patient?.chiefComplaint || '');
                      setPatientChronicConditions(patient?.chronicConditions || []);
                      setIsEditingIntakeCard(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#080e1b] dark:hover:bg-[#111A2E] text-slate-700 dark:text-[#dde2f5] font-bold text-xs cursor-pointer border border-slate-200 dark:border-white/5"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveIntakeAndChronic}
                    className="px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    حفظ التعديلات للشكوى والأمراض ✓
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1. Vital Signs Card (Conditional on displaySettings.showVitals) */}
        {displaySettings.showVitals && (activeTab === 'all' || activeTab === 'vitals') && (
          <VitalsCard
            initialVitals={initialExamVitals}
            onChange={(v) => setExamVitals(v)}
            onSave={(v) => setExamVitals(v)}
          />
        )}

        {/* Quick Prescription Template Selector - Placed below Vital Signs */}
        {patient && (activeTab === 'all' || activeTab === 'vitals' || activeTab === 'rx') && (
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-[#00c2cb]/10 dark:to-[#00c2cb]/5 p-4 rounded-2xl border border-teal-200 dark:border-[#00c2cb]/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl shrink-0">bookmark</span>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] block">
                  {language === 'en'
                    ? 'Quick Prescription Templates & Clinical Protocols:'
                    : 'استدعاء سريع من قوالب الروشتة والأدلة الطبية:'}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                  {language === 'en'
                    ? 'Select a saved template or protocol to auto-fill prescription'
                    : 'اختر قالباً محفوظاً أو استدعِ بروتوكولاً إكلينيكياً معتمداً لتعبئة الروشتة فوراً'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleApplyRecurringTemplate(e.target.value)}
                className="w-full sm:w-64 bg-white dark:bg-[#111A2E] text-slate-900 dark:text-[#dde2f5] text-xs p-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-bold focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
              >
                <option value="">
                  {language === 'en' ? '-- Select a recurring template --' : '-- اختر قالب روشتة متكررة لاستدعائه --'}
                </option>
                {recurringTemplates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    📋 {tmpl.title} ({tmpl.prescription?.length || 0} {language === 'en' ? 'drugs' : 'أدوية'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowClinicalGuidesPicker(true)}
                className="px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs whitespace-nowrap"
                title={language === 'en' ? 'Quick access to standard clinical protocols' : 'استدعاء مباشر من الأدلة والبروتوكولات الطبية القياسية'}
              >
                <span className="material-symbols-outlined text-base">menu_book</span>
                <span>{language === 'en' ? 'Clinical Guides' : 'الأدلة الطبية'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Laboratory Investigations Card (Conditional on displaySettings.showLabs) */}
        {displaySettings.showLabs && (activeTab === 'all' || activeTab === 'lab') && (
          <LabCard
            labOrders={labOrders}
            onChangeOrders={setLabOrders}
            labCatalog={labCatalog}
            onAddLabToCatalog={onAddLabToCatalog}
            frequentSuggestions={smartSuggestions.frequentLabs}
          />
        )}

        {/* 4. Radiology & Imaging Card (Conditional on displaySettings.showRadiology) */}
        {displaySettings.showRadiology && (activeTab === 'all' || activeTab === 'rad') && (
          <RadiologyCard
            radiologyOrders={radiologyOrders}
            onChangeOrders={setRadiologyOrders}
            radiologyCatalog={radiologyCatalog}
            onAddRadiologyToCatalog={onAddRadiologyToCatalog}
            frequentSuggestions={smartSuggestions.frequentRadiology}
          />
        )}

        {/* 5. Clinical Diagnoses Card */}
        {(activeTab === 'all' || activeTab === 'diag') && (
          <DiagnosisCard
            diagnoses={patientDiagnoses}
            onChangeDiagnoses={setPatientDiagnoses}
            diagnosesCatalog={diagnosesCatalog}
            onAddDiagnosisToCatalog={onAddDiagnosisToCatalog}
            frequentSuggestions={smartSuggestions.frequentDiagnoses}
          />
        )}

        {/* 6. Medications & Prescription Rx Card */}
        {(activeTab === 'all' || activeTab === 'rx') && (
          <MedicationsCard
            prescriptionItems={activePrescription}
            onChangePrescription={onChangeActivePrescription}
            drugCatalog={drugCatalog}
            onAddDrugToCatalog={onAddDrugToCatalog}
            onOpenPrescriptionPad={() => onNavigate('prescription-pad')}
            onPrintPrescription={handleDirectPrint}
            frequentSuggestions={smartSuggestions.frequentDrugs}
          />
        )}

        {/* 7. Follow-up & Lifestyle Advice Card */}
        {(activeTab === 'all' || activeTab === 'followup') && (
          <FollowupCard
            followupDate={followupDate}
            onChangeFollowupDate={setFollowupDate}
            lifestyleAdvice={lifestyleAdvice}
            onChangeLifestyleAdvice={setLifestyleAdvice}
            frequentSuggestions={smartSuggestions.frequentInstructions}
          />
        )}

        {/* Save current Rx as Template Bar (حفظ الروشتة الحالية كقالب متكرر) */}
        <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-[#00c2cb]/10 dark:to-[#00c2cb]/5 p-4 rounded-2xl border border-teal-200 dark:border-[#00c2cb]/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#008f97] dark:text-[#00c2cb] text-xl shrink-0">bookmark_add</span>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#dde2f5] block">
                حفظ كروشتة متكررة (Save as Recurring Template):
              </span>
              <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                حفظ الأدوية والتشخيص الحالي كقالب جاهز للاستدعاء السريع لاحقاً
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveCurrentAsRecurringTemplate}
              className="px-4 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
              title="حفظ التشخيص والأدوية والإرشادات الحالية كقائمة متكررة"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>حفظ كقائمة متكررة</span>
            </button>
          </div>
        </div>

        {/* 8. Completed Examination Summary & Action Card (At the Bottom) */}
        {isExamFinished && (
          <div
            id="finished-exam-summary"
            className="bg-white dark:bg-[#111A2E] p-5 sm:p-7 rounded-3xl border-2 border-emerald-500/50 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">verified</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    تم اعتماد وإنهاء الكشف الطبي بنجاح
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#859394]">
                    المريض: {patient?.name || 'مريض غير محدد'} • #{patient?.fileNumber || '-'} • الطبيب المعالج: {CLINIC_INFO.doctorName}
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20">
                حالة الزيارة: مكتملة ✓
              </span>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-[#859394] block">
                  التشخيص المعتمد:
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {patientDiagnoses.find((d) => d.isPrimary)?.nameAr || patientDiagnoses[0]?.nameAr || 'كشف واستشارة'}
                </p>
                {complaint && (
                  <p className="text-[11px] text-slate-500 dark:text-[#859394] line-clamp-1">
                    الشكوى: {complaint}
                  </p>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-[#859394] block">
                  الأدوية الموصوفة ({activePrescription.length}):
                </span>
                <p className="text-xs text-slate-900 dark:text-white truncate">
                  {activePrescription.length > 0
                    ? activePrescription.map((m) => m.drugName).join('، ')
                    : 'لم تُحرر أدوية'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-[#859394] block">
                  الفحوصات والاستشارة القادمة:
                </span>
                <p className="text-xs text-slate-700 dark:text-[#dde2f5]">
                  التحاليل: {labOrders.length > 0 ? labOrders.map((l) => l.testName).join('، ') : 'لا يوجد'}
                </p>
                <p className="text-xs text-slate-700 dark:text-[#dde2f5]">
                  الأشعة: {radiologyOrders.length > 0 ? radiologyOrders.map((r) => r.name).join('، ') : 'لا يوجد'}
                </p>
                {followupDate && (
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                    موعد الاستشارة القادمة: {followupDate}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom buttons inside the completed card */}
            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-[#859394]">
                تم حفظ بيانات الزيارة وتحديث رصيد العيادة وقائمة الانتظار بنجاح.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {/* WhatsApp Button */}
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="إرسال عبر الواتساب"
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  <span>واتساب الروشتة</span>
                </button>

                {/* Direct Print Button */}
                <button
                  type="button"
                  onClick={handleDirectPrint}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 dark:bg-slate-700 dark:hover:bg-slate-600"
                  title="الطباعة الفورية على الطابعة الموصلة"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>طباعة مباشرة</span>
                </button>

                {/* Preview Button */}
                <button
                  type="button"
                  onClick={() => setShowPrintPreviewModal(true)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] hover:bg-slate-200 dark:hover:bg-[#242a38] text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-white/5"
                  title="معاينة شكل التنسيق والهوامش للروشتة"
                >
                  <span className="material-symbols-outlined text-base">visibility</span>
                  <span>معاينة الروشتة</span>
                </button>

                {/* Export PDF Button */}
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-950 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95 dark:bg-slate-800 dark:hover:bg-slate-900"
                  title="تصدير كملف PDF بقياس A5 وأبعاد دقيقة"
                >
                  <span className="material-symbols-outlined text-base text-red-400">picture_as_pdf</span>
                  <span>تصدير PDF</span>
                </button>

                {/* Next Patient Button */}
                <button
                  type="button"
                  onClick={() => onNavigate('waiting-queue')}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                  <span>الانتقال للمريض التالي</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Action Bar */}
      <div className={`fixed bottom-0 ${isRTL ? 'right-0 lg:right-72 left-0' : 'left-0 lg:left-72 right-0'} z-40 bg-white/95 dark:bg-[#080e1b]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 p-3 sm:p-4 shadow-2xl transition-all`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-right w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-800 dark:text-[#dde2f5] shrink-0">
              {isExamFinished ? '✅ الكشف مكتمل ومعتمد:' : 'جلسة الكشف الحالية:'}
            </span>
            <span className="text-xs text-slate-500 dark:text-[#859394] truncate">
              {patient?.name || 'كشف حر'} • {patientDiagnoses.find((d) => d.isPrimary)?.nameAr || 'في انتظار اختيار التشخيص'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Finish or Next Patient Button */}
            {isExamFinished ? (
              <button
                type="button"
                onClick={() => onNavigate('waiting-queue')}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs sm:text-sm font-bold shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
                <span>المريض التالي (الانتظار)</span>
              </button>
            ) : (
              <PermissionGate permission="clinical.complete">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-6 py-3 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs sm:text-sm font-bold shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">task_alt</span>
                  <span>إنهاء الكشف وحفظ الزيارة</span>
                </button>
              </PermissionGate>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-emerald-500/30 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                تم حفظ الزيارة بكتالوج الملف الطبي!
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#859394]">
                تم إنهاء جلسة الكشف بنجاح، وتحديث ملف المريض ({patient?.name || 'كشف حر'}) وتحويل الحالة إلى مكتملة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-xl">chat</span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">إرسال الروشتة عبر الواتساب</h3>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#bbc9ca] leading-relaxed">
              سيتم فتح رابط واتساب مباشر لإرسال ملخص الروشتة والتعليمات والتحاليل المطلوبة للمريض <strong>{patient?.name || 'مريض'}</strong> على الرقم <strong>{patient?.phone || 'غير مسجل'}</strong>.
            </p>

            {/* Branch Selector */}
            {clinicBranches.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-teal-600">apartment</span>
                  <span>اختيار فرع العيادة للمتابعة:</span>
                </label>
                <select
                  value={selectedWhatsAppBranchId}
                  onChange={(e) => setSelectedWhatsAppBranchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#00c2cb] focus:outline-none"
                >
                  {clinicBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} - {b.phone || b.mobile}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-slate-50 dark:bg-[#080e1b] p-3 rounded-xl border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-[#dde2f5] max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
              {generateWhatsAppMessage()}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleCopyWhatsApp}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-white/5"
              >
                {copiedWhatsAppText ? 'تم النسخ!' : 'نسخ النص'}
              </button>

              <a
                href={getCleanPatientWhatsAppUrl()}
                target="_blank"
                rel="noreferrer"
                onClick={() => setShowWhatsAppModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-center text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>فتح الواتساب</span>
                <span className="material-symbols-outlined text-base">open_in_new</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Save Recurring Template */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00c2cb] text-xl">bookmark_add</span>
                <span>حفظ كقائمة متكررة للروشتة</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSaveTemplate} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-[#dde2f5]">
                  اسم القائمة المتكررة *
                </label>
                <input
                  type="text"
                  required
                  value={templateTitleInput}
                  onChange={(e) => setTemplateTitleInput(e.target.value)}
                  placeholder="مثال: بروتوكول جرثومة المعدة، روشتة قولون عصبي..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-[#859394]">اقتراحات سريعة للمسمى:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['روشتة باطنة عامة', 'روشتة ضغط وسكر', 'بروتوكول جرثومة المعدة', 'روشتة قولون عصبي', 'روشتة نزلة معوية'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTemplateTitleInput(preset)}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 dark:text-[#dde2f5]">
                  التصنيف الطبي
                </label>
                <select
                  value={templateCategoryInput}
                  onChange={(e) => setTemplateCategoryInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-bold text-xs focus:outline-none cursor-pointer"
                >
                  <option value="باطنة عامة">باطنة عامة</option>
                  <option value="الجهاز الهضمي والكبد">الجهاز الهضمي والكبد</option>
                  <option value="القلب والأوعية الدموية">القلب والأوعية الدموية</option>
                  <option value="الغدد الصماء والسكر">الغدد الصماء والسكر</option>
                  <option value="الجهاز التنفسي">الجهاز التنفسي</option>
                  <option value="المسالك البولية">المسالك البولية</option>
                </select>
              </div>

              {/* Summary of items being saved */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
                  <span>العناصر التي سيتم حفظها:</span>
                </div>
                <div className="text-slate-500 dark:text-[#859394] space-y-0.5">
                  <p>• التشخيصات: {patientDiagnoses.length > 0 ? patientDiagnoses.map((d) => d.nameAr).join('، ') : 'بدون تشخيص'}</p>
                  <p>• الأدوية ({activePrescription.length}): {activePrescription.map((p) => p.drugName).join(' + ')}</p>
                  {lifestyleAdvice && <p>• الإرشادات: {lifestyleAdvice.slice(0, 60)}...</p>}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>حفظ القائمة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Direct Clinical Guides Picker in Examination */}
      {showClinicalGuidesPicker && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
              <div>
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-xl">
                    menu_book
                  </span>
                  <span>الأدلة والبروتوكولات الإكلينيكية القياسية</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5">
                  اختر البروتوكول المطلوب لتطبيقه وتعبئة الروشتة الحالية فوراً
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClinicalGuidesPicker(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {INITIAL_CLINICAL_GUIDES_TEMPLATES.map((guide) => (
                <div
                  key={guide.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-purple-500/40 transition-all text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm truncate">
                        {guide.title}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300">
                        {guide.category}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong>التشخيص:</strong>{' '}
                      {guide.diagnoses.map((d) => d.nameAr).join('، ')}
                    </p>

                    <p className="text-[11px] text-slate-500 dark:text-[#859394]">
                      <strong>الأدوية ({guide.prescription.length}):</strong>{' '}
                      {guide.prescription.map((p) => p.drugName).join(' + ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleImportClinicalGuideDirectly(guide)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-sm">assignment_turned_in</span>
                    <span>تطبيق على الروشتة</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowClinicalGuidesPicker(false)}
                className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 cursor-pointer text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-white/10 rounded-3xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">print</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">طباعة الروشتة المعتمدة</h3>
              <p className="text-xs text-slate-500 dark:text-[#859394]">
                سيتم تحويلك لنموذج المعاينة والطباعة المباشرة مع الترويسة الطبية المسجلة.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrintModal(false);
                  onNavigate('prescription-pad');
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 text-xs font-bold shadow-md"
              >
                الانتقال للطباعة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT-ONLY A5 PRESCRIPTION CONTAINER */}
      <div className="hidden print:block absolute top-0 left-0 right-0 w-full" dir="rtl">
        <div
          id="printable-prescription-pad"
          style={{
            padding: MARGIN_VALUES[prescriptionConfig.outerMargin] || '7mm',
            paddingTop: prescriptionConfig.preprintedPaperMode ? '25mm' : MARGIN_VALUES[prescriptionConfig.headerMarginTop] || '7mm',
            paddingBottom: prescriptionConfig.preprintedPaperMode ? '20mm' : MARGIN_VALUES[prescriptionConfig.footerMarginBottom] || '7mm',
          }}
          className="w-[148mm] h-[210mm] min-h-[210mm] bg-white text-slate-900 flex flex-col justify-between p-[7mm]"
        >
          {/* Header Area */}
          {!prescriptionConfig.preprintedPaperMode && prescriptionConfig.showHeader ? (
            <div className="border-b-2 border-[#00c2cb] pb-3">
              <div className="flex items-start justify-between gap-3">
                {/* Arabic Doctor Info */}
                <div className="text-right flex-1">
                  <h2 className="text-base font-bold text-slate-950 leading-tight">
                    {prescriptionConfig.doctorName || CLINIC_INFO.doctorName}
                  </h2>
                  <div className="text-xs font-bold text-[#008f97] mt-0.5">
                    {prescriptionConfig.specialtyAr || CLINIC_INFO.doctorTitle}
                  </div>
                  <div className="text-[10px] text-slate-600 leading-snug mt-0.5 whitespace-pre-line">
                    {prescriptionConfig.degreesAr || CLINIC_INFO.doctorCredentials}
                  </div>
                </div>

                {/* Logo Center */}
                {prescriptionConfig.showLogo && (
                  <div className="flex flex-col items-center shrink-0">
                    {prescriptionConfig.logoUrl ? (
                      <img
                        src={prescriptionConfig.logoUrl}
                        alt="Clinic Logo"
                        className="w-11 h-11 object-contain"
                        style={{ width: '44px', height: '44px', maxWidth: '44px', maxHeight: '44px', objectFit: 'contain' }}
                        width={44}
                        height={44}
                        referrerPolicy="no-referrer"
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
                <div className="text-left flex-1" dir="ltr">
                  <h2 className="text-sm font-bold text-slate-950 leading-tight">
                    {prescriptionConfig.doctorNameEn || 'Dr. Hazem El-Kady'}
                  </h2>
                  <div className="text-[11px] font-bold text-[#008f97] mt-0.5">
                    {prescriptionConfig.specialtyEn || 'Consultant Cardiology'}
                  </div>
                  <div className="text-[10px] text-slate-600 leading-snug mt-0.5 whitespace-pre-line">
                    {prescriptionConfig.degreesEn || 'M.D., MRCP (London)'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Patient Meta Strip */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 my-2.5 text-[11px] flex items-center justify-between gap-2 text-slate-900" dir="rtl">
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-600">اسم المريض:</span>
              <span className="font-bold text-slate-900">{patient ? patient.name : 'مريض غير محدد'}</span>
            </div>
            {patient?.fileNumber && (
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-600">رقم الملف:</span>
                <span className="font-bold text-slate-900">#{patient.fileNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-600">{language === 'en' ? 'Age:' : 'السن:'}</span>
              <span className="font-bold text-slate-900">{patient ? (language === 'en' ? `${patient.age} yrs` : `${patient.age} سنة`) : '-'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-600">{language === 'en' ? 'Date:' : 'التاريخ:'}</span>
              <span className="font-mono text-slate-900">{formatAppDate(new Date(), undefined, language)}</span>
            </div>
          </div>

          {/* Prescription Body */}
          <div
            className={`flex-1 space-y-2.5 py-1 ${
              prescriptionConfig.sectionSpacing === 'compact'
                ? 'space-y-1.5'
                : prescriptionConfig.sectionSpacing === 'comfortable'
                ? 'space-y-4'
                : 'space-y-2.5'
            }`}
          >
            {/* Diagnosis / Notes in print - strictly LTR and English on TOP */}
            {patientDiagnoses && patientDiagnoses.length > 0 && (
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-800 text-left leading-relaxed font-sans" dir="ltr">
                <strong className="text-[#008f97]">Diagnosis:</strong>{' '}
                <span className="font-semibold text-slate-900">
                  {patientDiagnoses.map((d) => d.nameEn || d.nameAr || d.code).join(', ')}
                </span>
              </div>
            )}

            {/* Treatment section with Rx symbol positioned next to medications */}
            <div className="flex items-start gap-3" dir="ltr">
              <div className="flex flex-col items-center select-none pt-0.5 shrink-0">
                <span className="text-3xl font-serif font-black text-[#008f97] italic leading-none">℞</span>
              </div>
              <div className="flex-1 space-y-2 text-slate-900 text-left" dir="ltr">
                {activePrescription && activePrescription.length > 0 ? (
                  activePrescription.map((item, idx) => (
                    <div key={item.id || idx} className="p-2 rounded-lg bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-2 text-xs text-left" dir="ltr">
                      <div className="text-left">
                        <div className="font-bold text-slate-900">
                          {idx + 1}. {item.drugName} {item.strength || ''} {item.dosageForm || ''} {item.scientificName ? `(${item.scientificName})` : ''}
                        </div>
                        <div className="text-[11px] text-teal-700 font-medium">
                          {item.dosageInstructions || item.dosage || ''} {item.timing ? `• ${item.timing}` : ''} {item.duration ? `• لمدة ${item.duration}` : ''}
                        </div>
                        {item.notes && (
                          <div className="text-[10px] text-slate-500 italic mt-0.5">توجيهات إضافية: {item.notes}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    لا توجد أدوية مضافة للروشتة حالياً.
                  </div>
                )}
              </div>
            </div>

            {/* Lifestyle advice / notes below medications */}
            {lifestyleAdvice && (
              <div className="p-2 rounded-lg bg-teal-50/40 border border-teal-100 text-[10px] text-teal-900 text-right leading-relaxed" dir="rtl">
                <strong className="text-[#0f766e]">تعليمات طبية:</strong> {lifestyleAdvice}
              </div>
            )}

            {/* Follow-up date below advice */}
            {followupDate && (
              <div className="p-2 rounded-lg bg-amber-50/40 border border-amber-100 text-[10px] text-amber-900 text-right font-bold" dir="rtl">
                موعد الاستشارة القادمة: {followupDate}
              </div>
            )}
          </div>

          {/* Footer Area */}
          {!prescriptionConfig.preprintedPaperMode && prescriptionConfig.showFooter ? (
            <div className="border-t-2 border-[#00c2cb] pt-2.5 mt-2">
              <div className="flex items-end justify-between gap-3">
                {/* Branches & Info */}
                <div
                  className={`flex-1 space-y-1 text-right ${
                    prescriptionConfig.footerFontSize === 'small'
                      ? 'text-[8px]'
                      : prescriptionConfig.footerFontSize === 'large'
                      ? 'text-[11px]'
                      : 'text-[9.5px]'
                  } text-slate-600`}
                  dir="rtl"
                >
                  {prescriptionConfig.branches.map((b: any, i: number) => (
                    <div key={b.id || i} className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{b.name}:</span>
                      <span>{b.address || ''}</span>
                      <span className="font-mono text-teal-700 font-bold">{b.phone}</span>
                    </div>
                  ))}
                  <div className="text-slate-500 pt-0.5">
                    رقم الحجز والاستعلام: <span className="font-mono font-bold text-slate-800">{prescriptionConfig.phone}</span>
                  </div>
                </div>

                {/* QR Code Render in Footer */}
                {prescriptionConfig.showQr && (
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-[50px] h-[50px] bg-white p-1 rounded-lg border border-slate-300 flex items-center justify-center">
                      <QrCodeImage
                        qrType={prescriptionConfig.qrType}
                        qrWhatsappPhone={prescriptionConfig.qrWhatsappPhone}
                        qrCustomUrl={prescriptionConfig.qrCustomUrl}
                        className="w-full h-full text-slate-900"
                      />
                    </div>
                    <span className="text-[7.5px] font-bold text-slate-500 mt-0.5">
                      {prescriptionConfig.qrType === 'whatsapp' ? 'واتساب العيادة' : 'موقع العيادة'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Interactive Print Preview Modal */}
      {showPrintPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-100 dark:bg-[#0B132B] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-[640px] shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in duration-250">
            {/* Modal Header */}
            <div className="bg-white dark:bg-[#111A2E] px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">معاينة وتصدير الروشتة (Rx Print Preview)</h3>
                  <p className="text-[10px] text-slate-500 dark:text-[#859394]">قياس A5 متجاوب بالكامل مع ترويسة وهامش العيادة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer font-bold animate-pulse"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Preview Canvas Area */}
            <div className="p-6 overflow-y-auto flex justify-center bg-slate-200/50 dark:bg-[#080e1b]/60 flex-1">
              <div className="shadow-2xl rounded-2xl overflow-hidden border border-slate-300">
                {/* Embedded Sheet Container (Matches EXACT layout configuration) */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '480px',
                    minWidth: '380px',
                    padding: MARGIN_VALUES[prescriptionConfig.outerMargin] || '7mm',
                    paddingTop: prescriptionConfig.preprintedPaperMode ? '25mm' : MARGIN_VALUES[prescriptionConfig.headerMarginTop] || '7mm',
                    paddingBottom: prescriptionConfig.preprintedPaperMode ? '20mm' : MARGIN_VALUES[prescriptionConfig.footerMarginBottom] || '7mm',
                  }}
                  className="bg-white text-slate-900 min-h-[580px] flex flex-col justify-between p-6 leading-relaxed select-none"
                  dir="rtl"
                >
                  {/* Header Area */}
                  {!prescriptionConfig.preprintedPaperMode && prescriptionConfig.showHeader ? (
                    <div className="border-b-2 border-[#00c2cb] pb-3">
                      <div className="flex items-start justify-between gap-2">
                        {/* Arabic Doctor Info */}
                        <div className="text-right flex-1">
                          <h2 className="text-sm font-bold text-slate-950 leading-tight">
                            {prescriptionConfig.doctorName || CLINIC_INFO.doctorName}
                          </h2>
                          <div className="text-[11px] font-bold text-[#008f97] mt-0.5">
                            {prescriptionConfig.specialtyAr || CLINIC_INFO.doctorTitle}
                          </div>
                          <div className="text-[9px] text-slate-600 leading-snug mt-0.5 whitespace-pre-line">
                            {prescriptionConfig.degreesAr || CLINIC_INFO.doctorCredentials}
                          </div>
                        </div>

                        {/* Logo Center */}
                        {prescriptionConfig.showLogo && (
                          <div className="flex flex-col items-center shrink-0">
                            {prescriptionConfig.logoUrl ? (
                              <img
                                src={prescriptionConfig.logoUrl}
                                alt="Clinic Logo"
                                className="w-11 h-11 object-contain"
                                style={{ width: '44px', height: '44px', maxWidth: '44px', maxHeight: '44px', objectFit: 'contain' }}
                                width={44}
                                height={44}
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-950 text-[#00c2cb] flex items-center justify-center font-bold text-sm">
                                <span className="material-symbols-outlined text-base">medical_services</span>
                              </div>
                            )}
                            <span className="text-[7px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">
                              SOLI CLINIC
                            </span>
                          </div>
                        )}

                        {/* English Info */}
                        <div className="text-left flex-1" dir="ltr">
                          <h2 className="text-xs font-bold text-slate-950 leading-tight">
                            {prescriptionConfig.doctorNameEn || 'Dr. Hazem El-Kady'}
                          </h2>
                          <div className="text-[10px] font-bold text-[#008f97] mt-0.5">
                            {prescriptionConfig.specialtyEn || 'Consultant Cardiology'}
                          </div>
                          <div className="text-[9px] text-slate-600 leading-snug mt-0.5 whitespace-pre-line">
                            {prescriptionConfig.degreesEn || 'M.D., MRCP (London)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Patient Meta Strip */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 my-2 text-[10px] flex items-center justify-between gap-2 text-slate-900">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-600">المريض:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[120px]">{patient ? patient.name : 'مريض غير محدد'}</span>
                    </div>
                    {patient?.fileNumber && (
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-600">{language === 'en' ? 'File #:' : 'رقم الملف:'}</span>
                        <span className="font-bold text-slate-900">#{patient.fileNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-600">{language === 'en' ? 'Age:' : 'السن:'}</span>
                      <span className="font-bold text-slate-900">{patient ? (language === 'en' ? `${patient.age} yrs` : `${patient.age} سنة`) : '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-600">{language === 'en' ? 'Date:' : 'التاريخ:'}</span>
                      <span className="font-mono text-slate-900">{formatAppDate(new Date(), undefined, language)}</span>
                    </div>
                  </div>

                  {/* Prescription Body */}
                  <div
                    className={`flex-1 space-y-2 py-1 ${
                      prescriptionConfig.sectionSpacing === 'compact'
                        ? 'space-y-1'
                        : prescriptionConfig.sectionSpacing === 'comfortable'
                        ? 'space-y-3'
                        : 'space-y-2'
                    }`}
                  >
                    {/* Diagnosis / Notes in print - strictly LTR and English ON TOP */}
                    {patientDiagnoses && patientDiagnoses.length > 0 && (
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-800 text-left leading-relaxed font-sans" dir="ltr">
                        <strong className="text-[#008f97]">Diagnosis:</strong>{' '}
                        <span className="font-semibold text-slate-900">
                          {patientDiagnoses.map((d) => d.nameEn || d.nameAr || d.code).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Treatment section with Rx symbol positioned NEXT to medications */}
                    <div className="flex items-start gap-2.5" dir="ltr">
                      <div className="flex flex-col items-center select-none pt-0.5 shrink-0">
                        <span className="text-2xl font-serif font-black text-[#008f97] italic leading-none">℞</span>
                      </div>

                      {/* Items List */}
                      <div className="flex-1 space-y-1.5 text-slate-900 text-left" dir="ltr">
                        {activePrescription && activePrescription.length > 0 ? (
                          activePrescription.map((item, idx) => (
                            <div key={item.id || idx} className="p-1.5 rounded-lg bg-slate-50/80 border border-slate-100 flex items-start justify-between gap-2 text-[11px] text-left" dir="ltr">
                              <div className="text-left">
                                <div className="font-bold text-slate-900">
                                  {idx + 1}. {item.drugName} {item.strength || ''} {item.dosageForm || ''} {item.scientificName ? `(${item.scientificName})` : ''}
                                </div>
                                <div className="text-[10px] text-teal-700 font-medium">
                                  {item.dosageInstructions || item.dosage || ''} {item.timing ? `• ${item.timing}` : ''} {item.duration ? `• لمدة ${item.duration}` : ''}
                                </div>
                                {item.notes && (
                                  <div className="text-[9px] text-slate-500 italic mt-0.5">توجيهات إضافية: {item.notes}</div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-6 text-slate-400 text-[11px]">
                            لا توجد أدوية مضافة للروشتة حالياً.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Advice below medications */}
                    {lifestyleAdvice && (
                      <div className="p-1.5 rounded-lg bg-teal-50/40 border border-teal-100 text-[9px] text-teal-900 text-right leading-relaxed" dir="rtl">
                        <strong className="text-[#0f766e]">تعليمات:</strong> {lifestyleAdvice}
                      </div>
                    )}

                    {/* Follow up below advice */}
                    {followupDate && (
                      <div className="p-1.5 rounded-lg bg-amber-50/40 border border-amber-100 text-[9px] text-amber-950 text-right font-bold" dir="rtl">
                        موعد الاستشارة القادمة: {followupDate}
                      </div>
                    )}
                  </div>

                  {/* Footer Area */}
                  {!prescriptionConfig.preprintedPaperMode && prescriptionConfig.showFooter ? (
                    <div className="border-t border-[#00c2cb] pt-2 mt-2">
                      <div className="flex items-end justify-between gap-3">
                        {/* Branches & Info */}
                        <div
                          className={`flex-1 space-y-0.5 text-right ${
                            prescriptionConfig.footerFontSize === 'small'
                              ? 'text-[8px]'
                              : prescriptionConfig.footerFontSize === 'large'
                              ? 'text-[10px]'
                              : 'text-[9px]'
                          } text-slate-500`}
                        >
                          {prescriptionConfig.branches.slice(0, 2).map((b: any, i: number) => (
                            <div key={b.id || i} className="flex items-center gap-1 flex-wrap">
                              <span className="font-bold text-slate-800">{b.name}:</span>
                              <span>{b.address || ''}</span>
                              <span className="font-mono text-teal-700 font-bold">{b.phone}</span>
                            </div>
                          ))}
                          <div className="text-slate-400 text-[8.5px]">
                            الاستعلام: <span className="font-mono font-bold text-slate-700">{prescriptionConfig.phone}</span>
                          </div>
                        </div>

                        {/* QR Code */}
                        {prescriptionConfig.showQr && (
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-[42px] h-[42px] bg-white p-0.5 rounded border border-slate-300 flex items-center justify-center">
                              <QrCodeImage
                                qrType={prescriptionConfig.qrType}
                                qrWhatsappPhone={prescriptionConfig.qrWhatsappPhone}
                                qrCustomUrl={prescriptionConfig.qrCustomUrl}
                                className="w-full h-full text-slate-900"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="bg-white dark:bg-[#111A2E] px-6 py-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء المعاينة
              </button>

              {/* PDF Download inside modal */}
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-red-400">picture_as_pdf</span>
                <span>تحميل PDF</span>
              </button>

              {/* Direct Print inside modal */}
              <button
                type="button"
                onClick={handleDirectPrint}
                className="px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#00c2cb]/20"
              >
                <span className="material-symbols-outlined text-sm font-bold">print</span>
                <span>طباعة الروشتة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Medical Dossier Modal (الملف الطبي الشامل للمريض) */}
      {showMedicalDossier && patient && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex flex-col p-2 sm:p-4 md:p-6 animate-in fade-in">
          <div className="w-full max-w-7xl mx-auto bg-white dark:bg-[#111A2E] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col my-auto max-h-[96vh]">
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">folder_shared</span>
                </div>
                <div>
                  <h2 className="font-black text-sm sm:text-base flex items-center gap-2">
                    <span>الملف الطبي الشامل للمريض</span>
                    <span className="bg-white/20 text-white text-xs font-mono px-2 py-0.5 rounded-md">
                      #{patient.fileNumber || 1}
                    </span>
                  </h2>
                  <p className="text-xs text-purple-100 font-medium">{editablePatientName || patient.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMedicalDossier(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                <span>إغلاق وعودة للكشف</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-[#080e1b]">
              <PatientDetailFullScreen
                patient={patient}
                onBack={() => setShowMedicalDossier(false)}
                onSelectPatientForExam={() => setShowMedicalDossier(false)}
                onNavigate={(screen) => {
                  setShowMedicalDossier(false);
                  onNavigate(screen);
                }}
                visits={effVisits}
                prescriptions={effPrescriptions}
                labOrders={effLabOrders}
                radiologyOrders={effRadOrders}
              />
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 left-6 sm:right-auto sm:left-6 z-50 bg-emerald-600 dark:bg-emerald-500 text-white px-5 py-4 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-md border border-emerald-500/20">
          <span className="material-symbols-outlined text-xl shrink-0">check_circle</span>
          <p className="text-xs font-bold leading-relaxed">{toastMessage}</p>
        </div>
      )}
    </div>
  );
};
